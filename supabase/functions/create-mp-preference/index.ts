/**
 * Supabase Edge Function — create-mp-preference
 *
 * Receives a POST from the frontend with:
 *   { anuncio_id, periodo_key, dias, preco, user_id, user_email, carro_desc }
 *
 * 1. Persists a `pagamentos` row with status = 'pendente'
 * 2. Calls Mercado Pago POST /checkout/preferences
 *    - PIX + boleto enabled, credit/debit cards disabled (Brazil only)
 * 3. Returns { preference_id, init_point (redirect URL), pix_qr_code? }
 *
 * Env vars required (set via `supabase secrets set`):
 *   MERCADOPAGO_ACCESS_TOKEN   — your MP access token (prod or sandbox TEST-...)
 *   SUPABASE_URL               — injected automatically
 *   SUPABASE_SERVICE_ROLE_KEY  — injected automatically
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
        const {
            anuncio_id,
            periodo_key,
            dias,
            preco,
            user_id,
            user_email,
            carro_desc,
        } = await req.json();

        if (!anuncio_id || !periodo_key || !dias || !preco || !user_id) {
            return new Response(JSON.stringify({ error: 'Parâmetros inválidos.' }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        const mpToken = Deno.env.get('MERCADOPAGO_ACCESS_TOKEN');
        if (!mpToken) {
            return new Response(JSON.stringify({ error: 'Token MP não configurado.' }), {
                status: 500,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        // ── Supabase admin client ──────────────────────────────────────────────
        const supabase = createClient(
            Deno.env.get('SUPABASE_URL')!,
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
        );

        // ── 1. Create pagamentos row (pendente) ───────────────────────────────
        const { data: pagamento, error: dbError } = await supabase
            .from('pagamentos')
            .insert({
                anuncio_id,
                user_id,
                periodo_key,
                dias,
                valor: preco,
                status: 'pendente',
            })
            .select('id')
            .single();

        if (dbError || !pagamento) {
            console.error('DB insert error:', dbError);
            return new Response(JSON.stringify({ error: 'Erro ao registrar pagamento.' }), {
                status: 500,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        const pagamentoId = pagamento.id as string;

        // ── 2. Create Mercado Pago preference ─────────────────────────────────
        // back_urls must be real URLs — we use the Supabase function URL as base
        const baseUrl = Deno.env.get('APP_URL') ?? 'https://sulmotors.com.br';

        const preferenceBody = {
            items: [
                {
                    id: `boost-${anuncio_id}`,
                    title: `Impulsionar Anúncio — ${carro_desc ?? 'Veículo'} (${periodo_key.replace('_', ' ')})`,
                    quantity: 1,
                    unit_price: Number(preco),
                    currency_id: 'BRL',
                    category_id: 'services',
                },
            ],
            payer: {
                email: user_email ?? 'comprador@sulmotors.com.br',
            },
            payment_methods: {
                // PIX only (allowed_payment_types), disable credit cards
                excluded_payment_types: [
                    { id: 'credit_card' },
                    { id: 'debit_card' },
                    { id: 'prepaid_card' },
                    { id: 'ticket' },    // boleto
                ],
                installments: 1,
            },
            back_urls: {
                success: `${baseUrl}/impulsionar/sucesso?pagamento_id=${pagamentoId}&anuncio_id=${anuncio_id}`,
                failure: `${baseUrl}/impulsionar/${anuncio_id}?erro=pagamento_falhou`,
                pending: `${baseUrl}/impulsionar/sucesso?pagamento_id=${pagamentoId}&anuncio_id=${anuncio_id}&status=pendente`,
            },
            auto_return: 'approved',
            external_reference: pagamentoId,
            notification_url: `${Deno.env.get('SUPABASE_URL')}/functions/v1/mp-webhook`,
            expires: false,
            metadata: {
                pagamento_id: pagamentoId,
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
            console.error('MP API error:', mpData);
            // cleanup: delete pending row
            await supabase.from('pagamentos').delete().eq('id', pagamentoId);
            return new Response(JSON.stringify({ error: 'Erro ao criar preferência de pagamento.', details: mpData }), {
                status: 502,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        // Save preference_id to DB for later matching
        await supabase
            .from('pagamentos')
            .update({ preference_id: mpData.id })
            .eq('id', pagamentoId);

        return new Response(
            JSON.stringify({
                preference_id: mpData.id,
                init_point: mpData.init_point,           // production checkout URL
                sandbox_init_point: mpData.sandbox_init_point, // sandbox checkout URL
                pagamento_id: pagamentoId,
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );

    } catch (err) {
        console.error('Unexpected error:', err);
        return new Response(JSON.stringify({ error: 'Erro interno.' }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
});
