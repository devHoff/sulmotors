/**
 * Supabase Edge Function — mp-webhook
 *
 * Receives Mercado Pago IPN / Webhook notifications.
 * Validates the payment status and, when approved, activates the boost.
 *
 * MP sends a POST like:
 *   { type: "payment", action: "payment.updated", data: { id: "12345" } }
 *
 * Env vars required:
 *   MERCADOPAGO_ACCESS_TOKEN   — same token used to create preference
 *   SUPABASE_URL               — injected automatically
 *   SUPABASE_SERVICE_ROLE_KEY  — injected automatically
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-signature, x-request-id',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    const mpToken = Deno.env.get('MERCADOPAGO_ACCESS_TOKEN');
    if (!mpToken) {
        // Always 200 to prevent MP retries
        console.warn('[mp-webhook] MERCADOPAGO_ACCESS_TOKEN not configured');
        return new Response(JSON.stringify({ ok: true, warning: 'token_not_configured' }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }

    const supabase = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    try {
        // MP can send GET (query params) or POST (json body)
        const url = new URL(req.url);
        const topicParam = url.searchParams.get('topic') ?? url.searchParams.get('type');
        const idParam = url.searchParams.get('id') ?? url.searchParams.get('data.id');

        let paymentId: string | null = null;

        if (req.method === 'POST') {
            const body = await req.json().catch(() => ({}));
            if (body?.type === 'payment' || body?.topic === 'payment') {
                paymentId = String(body?.data?.id ?? idParam ?? '');
            }
        } else if (req.method === 'GET') {
            if (topicParam === 'payment' || topicParam === 'merchant_order') {
                paymentId = idParam;
            }
        }

        if (!paymentId) {
            // Not a payment notification — just acknowledge
            return new Response(JSON.stringify({ ok: true }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        // ── Fetch payment details from MP ─────────────────────────────────────
        const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
            headers: { Authorization: `Bearer ${mpToken}` },
        });

        if (!mpRes.ok) {
            console.error('Failed to fetch MP payment', paymentId);
            return new Response('ok', { status: 200, headers: corsHeaders });
        }

        const payment = await mpRes.json();
        const status: string = payment.status; // approved | pending | rejected | cancelled
        const externalReference: string = payment.external_reference; // our pagamento_id

        if (!externalReference) {
            return new Response('ok', { status: 200, headers: corsHeaders });
        }

        // ── Update pagamentos row ─────────────────────────────────────────────
        const { data: pagamento, error: pgErr } = await supabase
            .from('pagamentos')
            .update({ status, mp_payment_id: String(paymentId) })
            .eq('id', externalReference)
            .select('anuncio_id, user_id, dias, periodo_key')
            .single();

        if (pgErr || !pagamento) {
            console.error('pagamento not found for ref', externalReference, pgErr);
            return new Response('ok', { status: 200, headers: corsHeaders });
        }

        // ── If approved → activate boost ──────────────────────────────────────
        if (status === 'approved') {
            const until = new Date();
            until.setDate(until.getDate() + Number(pagamento.dias));

            const { error: upErr } = await supabase
                .from('anuncios')
                .update({
                    impulsionado: true,
                    destaque: true,
                    impulsionado_ate: until.toISOString(),
                    prioridade: 5,
                })
                .eq('id', pagamento.anuncio_id)
                .eq('user_id', pagamento.user_id);

            if (upErr) {
                console.error('Failed to activate boost:', upErr);
            } else {
                console.log(`✅ Boost activated for anuncio ${pagamento.anuncio_id} until ${until.toISOString()}`);
            }
        }

        return new Response(JSON.stringify({ ok: true, status }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

    } catch (err) {
        console.error('Webhook error:', err);
        // Always return 200 to MP so it doesn't retry indefinitely
        return new Response('ok', { status: 200, headers: corsHeaders });
    }
});
