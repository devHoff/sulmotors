/**
 * Supabase Edge Function — mp-webhook
 *
 * Receives Mercado Pago IPN / Webhook notifications.
 * Validates the payment and, when approved, activates the listing boost.
 *
 * MP Account: SulMotor (Leonardo Bandas De Oliveira)
 *
 * MP sends a POST like:
 *   { type: "payment", action: "payment.updated", data: { id: "12345" } }
 *
 * Env vars:
 *   MERCADOPAGO_ACCESS_TOKEN  — auto-resolved (secret or fallback)
 *   SUPABASE_URL              — injected automatically
 *   SUPABASE_SERVICE_ROLE_KEY — injected automatically
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
    'Access-Control-Allow-Origin':  '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-signature, x-request-id',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};

// SulMotor production MP access token (Leonardo Bandas De Oliveira)
const SULMOTOR_MP_TOKEN = 'APP_USR-7239440808267582-031221-15802be9b3427f5b9e1e29d49413ed02-2697630578';

function getMpToken(): string {
    return Deno.env.get('MERCADOPAGO_ACCESS_TOKEN') || SULMOTOR_MP_TOKEN;
}

// Priority level mapping based on plan type
const PRIORITY_MAP: Record<string, number> = {
    ultra_boost:   30,
    premium_boost: 20,
    basic_boost:   10,
};

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    // Always respond 200 quickly — MP retries on non-200 responses
    const ok200 = (extra?: object) =>
        new Response(JSON.stringify({ ok: true, ...extra }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

    const mpToken = getMpToken();

    const sbUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const sbKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    if (!sbUrl || !sbKey) {
        console.warn('[mp-webhook] Supabase credentials not configured — boost activation skipped');
        return ok200({ warning: 'supabase_not_configured' });
    }

    const supabase = createClient(sbUrl, sbKey, { auth: { persistSession: false } });

    try {
        const url      = new URL(req.url);
        const topic    = url.searchParams.get('topic') ?? url.searchParams.get('type');
        const idParam  = url.searchParams.get('id') ?? url.searchParams.get('data.id');

        let paymentId: string | null = null;

        if (req.method === 'POST') {
            const body = await req.json().catch(() => ({}));
            if (body?.type === 'payment' || body?.topic === 'payment') {
                paymentId = String(body?.data?.id ?? idParam ?? '');
            } else if (body?.data?.id) {
                // Some MP webhooks only send data.id
                paymentId = String(body.data.id);
            }
        } else if (req.method === 'GET') {
            if (topic === 'payment' || topic === 'merchant_order') {
                paymentId = idParam;
            }
        }

        if (!paymentId) {
            return ok200({ skipped: 'not_a_payment_notification' });
        }

        // ── Fetch payment details from MP ─────────────────────────────────────
        const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
            headers: { Authorization: `Bearer ${mpToken}` },
        });

        if (!mpRes.ok) {
            console.error(`[mp-webhook] Failed to fetch MP payment ${paymentId}`);
            return ok200({ error: 'mp_fetch_failed' });
        }

        const payment = await mpRes.json();
        const status: string            = payment.status;             // approved | pending | rejected | cancelled
        const externalReference: string = payment.external_reference; // our pagamentos.id
        const periodoKey: string        = payment.metadata?.periodo_key ?? '';
        const diasStr: string           = payment.metadata?.dias ?? '7';

        console.log(`[mp-webhook] payment=${paymentId} status=${status} ref=${externalReference}`);

        if (!externalReference) {
            return ok200({ skipped: 'no_external_reference' });
        }

        // ── Update pagamentos row ─────────────────────────────────────────────
        const { data: pagamento, error: pgErr } = await supabase
            .from('pagamentos')
            .update({ status, mp_payment_id: String(paymentId) })
            .eq('id', externalReference)
            .select('anuncio_id, user_id, dias, periodo_key')
            .single();

        if (pgErr || !pagamento) {
            // May not exist if DB record wasn't created (Supabase key not set during payment)
            console.warn('[mp-webhook] pagamento not found for ref', externalReference, pgErr?.message);
            // Still try to activate boost if we have anuncio_id in metadata
            const anuncioId = payment.metadata?.anuncio_id;
            const userId    = payment.metadata?.user_id;
            if (status === 'approved' && anuncioId) {
                const dias    = Number(diasStr) || 7;
                const until   = new Date(Date.now() + dias * 86_400_000);
                const prio    = PRIORITY_MAP[periodoKey] ?? 10;
                await supabase.from('anuncios').update({
                    impulsionado:     true,
                    destaque:         true,
                    impulsionado_ate: until.toISOString(),
                    prioridade:       prio,
                }).eq('id', anuncioId).eq('user_id', userId ?? '');
                console.log(`[mp-webhook] ✅ Boost activated (via metadata) for anuncio ${anuncioId} until ${until.toISOString()}`);
            }
            return ok200({ status, fallback: 'metadata_activation' });
        }

        // ── If approved → activate boost ──────────────────────────────────────
        if (status === 'approved') {
            const dias  = Number(pagamento.dias) || 7;
            const until = new Date(Date.now() + dias * 86_400_000);
            const prio  = PRIORITY_MAP[pagamento.periodo_key ?? ''] ?? 10;

            const { error: upErr } = await supabase
                .from('anuncios')
                .update({
                    impulsionado:     true,
                    destaque:         true,
                    impulsionado_ate: until.toISOString(),
                    prioridade:       prio,
                })
                .eq('id', pagamento.anuncio_id)
                .eq('user_id', pagamento.user_id);

            if (upErr) {
                console.error('[mp-webhook] Failed to activate boost:', upErr.message);
            } else {
                console.log(`[mp-webhook] ✅ Boost activated for anuncio ${pagamento.anuncio_id} until ${until.toISOString()}`);
            }
        }

        return ok200({ status });

    } catch (err) {
        console.error('[mp-webhook] Unexpected error:', err);
        return ok200({ error: 'internal_error' });
    }
});
