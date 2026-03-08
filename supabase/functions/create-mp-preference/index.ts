/**
 * Supabase Edge Function — create-mp-preference
 *
 * Receives a POST from the frontend with:
 *   { anuncio_id, periodo_key, dias, preco, user_id, user_email, carro_desc }
 *
 * Calls Mercado Pago POST /checkout/preferences and returns the checkout URL.
 * The pagamentos row is created AFTER payment is confirmed (via mp-webhook),
 * avoiding RLS/FK issues in the edge function environment.
 *
 * If MERCADOPAGO_ACCESS_TOKEN is not set, returns a mock response so the
 * UI can still be tested end-to-end.
 *
 * Env vars:
 *   MERCADOPAGO_ACCESS_TOKEN  — MP access token (prod APP_USR-... or sandbox TEST-...)
 *   SUPABASE_URL              — injected automatically
 *   SUPABASE_SERVICE_ROLE_KEY — injected automatically
 *   APP_URL                   — public URL of the app (e.g. https://sulmotors.com.br)
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const body = await req.json();
        const {
            anuncio_id,
            periodo_key,
            dias,
            preco,
            user_id,
            user_email,
            carro_desc,
        } = body;

        // ── Validate required fields ──────────────────────────────────────────
        if (!anuncio_id || !periodo_key || !dias || !preco || !user_id) {
            return new Response(
                JSON.stringify({ error: 'Parâmetros inválidos.' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
            );
        }

        const mpToken = Deno.env.get('MERCADOPAGO_ACCESS_TOKEN');
        const baseUrl = Deno.env.get('APP_URL') ?? 'https://sulmotors.com.br';
        const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
        const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

        // ── 1. Create pagamentos row using service role ────────────────────────
        // Use service role to bypass RLS completely
        let pagamentoId: string | null = null;

        if (supabaseUrl && serviceKey) {
            try {
                const adminClient = createClient(supabaseUrl, serviceKey, {
                    auth: { persistSession: false },
                });

                const { data: pag, error: pagErr } = await adminClient
                    .from('pagamentos')
                    .insert({
                        anuncio_id,
                        user_id,
                        periodo_key,
                        dias: Number(dias),
                        valor: Number(preco),
                        status: 'pendente',
                    })
                    .select('id')
                    .single();

                if (pagErr) {
                    console.error('pagamentos insert error:', JSON.stringify(pagErr));
                    // Don't block the flow — proceed without pagamentoId
                } else {
                    pagamentoId = pag?.id ?? null;
                }
            } catch (dbErr) {
                console.error('DB client error:', dbErr);
                // Continue without DB record
            }
        }

        // ── 2. If no MP token, return mock checkout for development ───────────
        if (!mpToken) {
            console.warn('MERCADOPAGO_ACCESS_TOKEN not set — returning mock response');
            const mockId = pagamentoId ?? crypto.randomUUID();
            return new Response(
                JSON.stringify({
                    preference_id: 'mock-preference-id',
                    init_point: `${baseUrl}/impulsionar/sucesso?pagamento_id=${mockId}&anuncio_id=${anuncio_id}&status=pendente`,
                    sandbox_init_point: `${baseUrl}/impulsionar/sucesso?pagamento_id=${mockId}&anuncio_id=${anuncio_id}&status=pendente`,
                    pagamento_id: mockId,
                    _mock: true,
                }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
            );
        }

        // ── 3. Create Mercado Pago preference ─────────────────────────────────
        const preferenceBody = {
            items: [
                {
                    id: `boost-${anuncio_id}`,
                    title: `Impulsionar Anúncio — ${carro_desc ?? 'Veículo'} (${String(periodo_key).replace(/_/g, ' ')})`,
                    quantity: 1,
                    unit_price: Number(preco),
                    currency_id: 'BRL',
                    category_id: 'services',
                },
            ],
            payer: {
                email: user_email || 'comprador@sulmotors.com.br',
            },
            payment_methods: {
                // Allow PIX only — exclude cards and boleto
                excluded_payment_types: [
                    { id: 'credit_card' },
                    { id: 'debit_card' },
                    { id: 'prepaid_card' },
                    { id: 'ticket' },
                ],
                installments: 1,
            },
            back_urls: {
                success: `${baseUrl}/impulsionar/sucesso?pagamento_id=${pagamentoId ?? ''}&anuncio_id=${anuncio_id}`,
                failure: `${baseUrl}/impulsionar/${anuncio_id}?erro=pagamento_falhou`,
                pending: `${baseUrl}/impulsionar/sucesso?pagamento_id=${pagamentoId ?? ''}&anuncio_id=${anuncio_id}&status=pendente`,
            },
            auto_return: 'approved',
            external_reference: pagamentoId ?? anuncio_id,
            notification_url: `${supabaseUrl}/functions/v1/mp-webhook`,
            expires: false,
            metadata: {
                pagamento_id: pagamentoId ?? '',
                anuncio_id,
                user_id,
                periodo_key,
                dias: String(dias),
            },
        };

        const mpRes = await fetch('https://api.mercadopago.com/checkout/preferences', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${mpToken}`,
            },
            body: JSON.stringify(preferenceBody),
        });

        const mpData = await mpRes.json();

        if (!mpRes.ok) {
            console.error('MP API error:', JSON.stringify(mpData));

            // Cleanup pending row if created
            if (pagamentoId && supabaseUrl && serviceKey) {
                const adminClient = createClient(supabaseUrl, serviceKey, {
                    auth: { persistSession: false },
                });
                await adminClient.from('pagamentos').delete().eq('id', pagamentoId);
            }

            return new Response(
                JSON.stringify({
                    error: 'Erro ao criar preferência de pagamento no Mercado Pago.',
                    details: mpData,
                }),
                { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
            );
        }

        // Save preference_id to DB
        if (pagamentoId && supabaseUrl && serviceKey) {
            const adminClient = createClient(supabaseUrl, serviceKey, {
                auth: { persistSession: false },
            });
            await adminClient
                .from('pagamentos')
                .update({ preference_id: mpData.id })
                .eq('id', pagamentoId);
        }

        return new Response(
            JSON.stringify({
                preference_id: mpData.id,
                init_point: mpData.init_point,
                sandbox_init_point: mpData.sandbox_init_point,
                pagamento_id: pagamentoId,
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );

    } catch (err) {
        console.error('Unexpected error in create-mp-preference:', err);
        return new Response(
            JSON.stringify({ error: 'Erro interno no servidor.' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
    }
});
