/**
 * Supabase Edge Function — create-mp-preference
 *
 * Receives a POST from the frontend with:
 *   { anuncio_id, periodo_key, dias, preco, user_id, user_email, carro_desc }
 *
 * Flow:
 *   1. (Optional) Insert a `pagamentos` row with status = 'pendente'
 *   2. If MERCADOPAGO_ACCESS_TOKEN is set → call MP Preferences API
 *      Else → return a mock checkout URL (development mode)
 *   3. Return { preference_id, init_point, sandbox_init_point, pagamento_id }
 *
 * Env vars (set via Supabase Dashboard → Project Settings → Edge Functions → Secrets):
 *   MERCADOPAGO_ACCESS_TOKEN  — MP access token (TEST-... or APP_USR-...)
 *   APP_URL                   — public app URL (default: https://sulmotors.com.br)
 *   SUPABASE_URL              — auto-injected by Supabase runtime
 *   SUPABASE_SERVICE_ROLE_KEY — auto-injected by Supabase runtime
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

        const mpToken   = Deno.env.get('MERCADOPAGO_ACCESS_TOKEN');
        const baseUrl   = Deno.env.get('APP_URL') ?? 'https://sulmotors.com.br';
        const sbUrl     = Deno.env.get('SUPABASE_URL') ?? '';
        const sbSvcKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

        // ── 1. Create pagamentos row (best-effort – does not block payment flow) ──
        let pagamentoId: string | null = null;

        if (sbUrl && sbSvcKey) {
            try {
                const admin = createClient(sbUrl, sbSvcKey, {
                    auth: { persistSession: false },
                });
                const { data: pag, error: pagErr } = await admin
                    .from('pagamentos')
                    .insert({
                        anuncio_id,
                        user_id,
                        periodo_key,
                        dias:   Number(dias),
                        valor:  Number(preco),
                        status: 'pendente',
                    })
                    .select('id')
                    .single();

                if (pagErr) {
                    // Log but don't block — the webhook will reconcile later
                    console.warn('pagamentos insert warning:', pagErr.message);
                } else {
                    pagamentoId = pag?.id ?? null;
                }
            } catch (dbErr) {
                console.warn('DB client warning:', dbErr);
            }
        }

        // ── 2. Development mode: return mock checkout when token is missing ───
        if (!mpToken) {
            console.info('MERCADOPAGO_ACCESS_TOKEN not configured — returning mock checkout URL');
            const mockPagId = pagamentoId ?? crypto.randomUUID();
            return new Response(
                JSON.stringify({
                    preference_id:      'mock-preference-id',
                    init_point:         `${baseUrl}/impulsionar/sucesso?pagamento_id=${mockPagId}&anuncio_id=${anuncio_id}&status=pendente`,
                    sandbox_init_point: `${baseUrl}/impulsionar/sucesso?pagamento_id=${mockPagId}&anuncio_id=${anuncio_id}&status=pendente`,
                    pagamento_id:       mockPagId,
                    _mock:              true,
                }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
            );
        }

        // ── 3. Create Mercado Pago preference ─────────────────────────────────
        const preferenceBody = {
            items: [{
                id:          `boost-${anuncio_id}`,
                title:       `Impulsionar Anúncio — ${carro_desc ?? 'Veículo'} (${String(periodo_key).replace(/_/g, ' ')})`,
                quantity:    1,
                unit_price:  Number(preco),
                currency_id: 'BRL',
                category_id: 'services',
            }],
            payer: {
                email: user_email || 'comprador@sulmotors.com.br',
            },
            payment_methods: {
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
            auto_return:        'approved',
            external_reference: pagamentoId ?? anuncio_id,
            notification_url:   sbUrl ? `${sbUrl}/functions/v1/mp-webhook` : undefined,
            expires:            false,
            metadata: {
                pagamento_id: pagamentoId ?? '',
                anuncio_id,
                user_id,
                periodo_key,
                dias: String(dias),
            },
        };

        const mpRes  = await fetch('https://api.mercadopago.com/checkout/preferences', {
            method:  'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization:  `Bearer ${mpToken}`,
            },
            body: JSON.stringify(preferenceBody),
        });

        const mpData = await mpRes.json();

        if (!mpRes.ok) {
            console.error('MP API error:', JSON.stringify(mpData));

            // Clean up pending DB row on MP failure
            if (pagamentoId && sbUrl && sbSvcKey) {
                try {
                    const admin = createClient(sbUrl, sbSvcKey, { auth: { persistSession: false } });
                    await admin.from('pagamentos').delete().eq('id', pagamentoId);
                } catch (_) { /* ignore cleanup errors */ }
            }

            return new Response(
                JSON.stringify({
                    error:   'Erro ao criar preferência no Mercado Pago.',
                    details: mpData,
                }),
                { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
            );
        }

        // ── 4. Save preference_id to DB ────────────────────────────────────────
        if (pagamentoId && sbUrl && sbSvcKey) {
            try {
                const admin = createClient(sbUrl, sbSvcKey, { auth: { persistSession: false } });
                await admin.from('pagamentos').update({ preference_id: mpData.id }).eq('id', pagamentoId);
            } catch (_) { /* non-fatal */ }
        }

        // ── 5. Return checkout URLs ────────────────────────────────────────────
        return new Response(
            JSON.stringify({
                preference_id:      mpData.id,
                init_point:         mpData.init_point,
                sandbox_init_point: mpData.sandbox_init_point,
                pagamento_id:       pagamentoId,
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
