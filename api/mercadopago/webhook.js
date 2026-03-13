'use strict';

/**
 * api/mercadopago/webhook.js
 * POST /api/webhook/mercadopago
 *
 * Receives MP IPN/Webhook notifications, validates, fetches payment,
 * activates boost in Supabase when approved.
 */

const { MercadoPagoConfig, Payment } = require('mercadopago');
const { validateWebhookSignature }   = require('../security/validateWebhook');

function getMPClient() {
    const token = process.env.MP_ACCESS_TOKEN;
    if (!token) throw new Error('MP_ACCESS_TOKEN não configurado.');
    return new Payment(new MercadoPagoConfig({
        accessToken: token,
        options: { timeout: 8000 },
    }));
}

async function activateBoostInSupabase(paymentData) {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
    if (!supabaseUrl || !supabaseKey) {
        console.warn('[webhook] SUPABASE vars not set – skipping DB update');
        return;
    }

    const externalRef = paymentData.external_reference ?? '';
    const [anuncioId, diasStr] = externalRef.split(':');
    const dias = parseInt(diasStr ?? '30', 10) || 30;
    if (!anuncioId) { console.warn('[webhook] No anuncio_id in external_reference'); return; }

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + dias);

    try {
        const patchRes = await fetch(`${supabaseUrl}/rest/v1/anuncios?id=eq.${anuncioId}`, {
            method:  'PATCH',
            headers: {
                'Content-Type':  'application/json',
                'apikey':        supabaseKey,
                'Authorization': `Bearer ${supabaseKey}`,
                'Prefer':        'return=minimal',
            },
            body: JSON.stringify({
                destaque:         true,
                impulsionado:     true,
                impulsionado_ate: expiresAt.toISOString(),
                prioridade:       10,
            }),
        });
        if (!patchRes.ok) {
            const txt = await patchRes.text();
            console.error(`[webhook] Supabase PATCH failed: ${patchRes.status} ${txt}`);
            return;
        }
        console.log(`[webhook] ✅ Boost activated anuncio=${anuncioId} until ${expiresAt.toISOString()}`);

        // record in pagamentos table (non-fatal)
        await fetch(`${supabaseUrl}/rest/v1/pagamentos`, {
            method: 'POST',
            headers: {
                'Content-Type':  'application/json',
                'apikey':        supabaseKey,
                'Authorization': `Bearer ${supabaseKey}`,
                'Prefer':        'return=minimal',
            },
            body: JSON.stringify({
                mp_payment_id: String(paymentData.id),
                anuncio_id:    anuncioId,
                amount:        paymentData.transaction_amount,
                currency:      paymentData.currency_id ?? 'BRL',
                status:        'approved',
                payer_email:   paymentData.payer?.email ?? '',
                approved_at:   new Date().toISOString(),
            }),
        }).catch(e => console.warn('[webhook] pagamentos insert (non-fatal):', e.message));
    } catch (err) {
        console.error('[webhook] activateBoost error:', err?.message);
    }
}

async function webhookHandler(req, res) {
    // Always respond 200 quickly to prevent MP retries
    try {
        // ── Signature validation (optional) ─────────────────────────────────
        const sigResult = validateWebhookSignature({
            secret:          process.env.MP_WEBHOOK_SECRET ?? '',
            signatureHeader: req.headers['x-signature']  ?? '',
            requestId:       req.headers['x-request-id'] ?? '',
            dataId:          req.query['data.id']         ?? req.body?.data?.id ?? '',
        });
        if (!sigResult.valid) {
            console.warn(`[webhook] Sig invalid: ${sigResult.reason}`);
        }

        const body = req.body ?? {};
        const { type, action, data } = body;
        const notificationId = data?.id ?? req.query['data.id'];

        console.log(`[webhook] type="${type}" action="${action}" id="${notificationId}"`);

        // Only process payment events
        const isPaymentEvent = type === 'payment'
            || action === 'payment.updated'
            || action === 'payment.created';

        if (!isPaymentEvent) {
            return res.status(200).json({ received: true, processed: false });
        }

        if (!notificationId) {
            console.warn('[webhook] No payment ID in notification');
            return res.status(200).json({ received: true, processed: false });
        }

        // ── Fetch payment ────────────────────────────────────────────────────
        let paymentData;
        try {
            const mp = getMPClient();
            paymentData = await mp.get({ id: String(notificationId) });
        } catch (err) {
            console.error(`[webhook] Failed to fetch payment ${notificationId}:`, err?.message);
            // Still return 200 so MP doesn't retry indefinitely
            return res.status(200).json({ received: true, error: 'fetch_failed', payment_id: String(notificationId) });
        }

        const { status, status_detail, id: mpId } = paymentData;
        console.log(`[webhook] Payment ${mpId} status="${status}" detail="${status_detail}"`);

        // ── Business logic ───────────────────────────────────────────────────
        if (status === 'approved') {
            console.log(`[webhook] ✅ APPROVED id=${mpId} ref="${paymentData.external_reference}" amount=${paymentData.transaction_amount}`);
            await activateBoostInSupabase(paymentData);
        } else if (status === 'rejected') {
            console.log(`[webhook] ❌ REJECTED id=${mpId} detail="${status_detail}"`);
        } else if (status === 'pending' || status === 'in_process') {
            console.log(`[webhook] ⏳ ${status.toUpperCase()} id=${mpId}`);
        } else if (status === 'cancelled' || status === 'refunded') {
            console.log(`[webhook] 🔄 ${status.toUpperCase()} id=${mpId}`);
        }

        return res.status(200).json({ received: true, payment_id: String(mpId), status });

    } catch (err) {
        console.error('[webhook] Unhandled error:', err?.message);
        // Always 200 to stop MP retries
        return res.status(200).json({ received: true, error: 'internal_error' });
    }
}

module.exports = { webhookHandler };
