'use strict';

/**
 * api/mercadopago/webhooks.js
 * POST /api/webhooks/mercadopago
 *
 * Receives Mercado Pago IPN/Webhook notifications.
 * Always returns 200 to prevent MP retries.
 * On approved payments → activates boost in Supabase.
 */

const { MercadoPagoConfig, Payment } = require('mercadopago');

function getMPClient() {
    const token = process.env.MP_ACCESS_TOKEN;
    if (!token) {
        console.warn('[webhooks] MP_ACCESS_TOKEN not set');
        return null;
    }
    return new Payment(new MercadoPagoConfig({
        accessToken: token,
        options: { timeout: 10000 },
    }));
}

// ── Activate boost in Supabase ────────────────────────────────────────────────
async function activateBoost(paymentData) {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
    if (!supabaseUrl || !supabaseKey) {
        console.warn('[webhooks] SUPABASE vars not set – skipping DB update');
        return;
    }

    // external_reference format: "<anuncioId>:<days>"
    const extRef  = paymentData.external_reference ?? '';
    const [anuncioId, diasStr] = extRef.split(':');
    const dias    = parseInt(diasStr ?? '30', 10) || 30;
    if (!anuncioId) {
        console.warn('[webhooks] No anuncio_id in external_reference:', extRef);
        return;
    }

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + dias);

    try {
        // Update anuncios table
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
            console.error(`[webhooks] Supabase PATCH failed: ${patchRes.status} ${txt}`);
        } else {
            console.log(`[webhooks] ✅ Boost activated anuncio=${anuncioId} until ${expiresAt.toISOString()}`);
        }

        // Record payment in pagamentos table (non-fatal)
        await fetch(`${supabaseUrl}/rest/v1/pagamentos`, {
            method:  'POST',
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
        }).catch(e => console.warn('[webhooks] pagamentos insert (non-fatal):', e.message));

    } catch (err) {
        console.error('[webhooks] activateBoost error:', err?.message);
    }
}

// ── Handler ───────────────────────────────────────────────────────────────────
async function webhookHandler(req, res) {
    // Always respond 200 quickly — prevents MP from retrying indefinitely
    res.status(200).json({ received: true });

    try {
        const body = req.body ?? {};
        const { type, action, data } = body;
        const notificationId = data?.id ?? req.query?.['data.id'];

        console.log(`[webhooks] type="${type}" action="${action}" id="${notificationId}"`);

        // Only process payment events
        const isPaymentEvent = type === 'payment'
            || action === 'payment.updated'
            || action === 'payment.created';

        if (!isPaymentEvent || !notificationId) {
            return; // response already sent
        }

        // ── Fetch payment from MP ────────────────────────────────────────────
        const mp = getMPClient();
        if (!mp) return;

        let paymentData;
        try {
            paymentData = await mp.get({ id: String(notificationId) });
        } catch (err) {
            console.error(`[webhooks] Failed to fetch payment ${notificationId}:`, err?.message);
            return;
        }

        const { status, status_detail, id: mpId } = paymentData;
        console.log(`[webhooks] Payment ${mpId} status="${status}" detail="${status_detail}" ref="${paymentData.external_reference}"`);

        // ── Business logic ───────────────────────────────────────────────────
        if (status === 'approved') {
            console.log(`[webhooks] ✅ APPROVED id=${mpId} amount=${paymentData.transaction_amount}`);
            await activateBoost(paymentData);
        } else if (status === 'rejected') {
            console.log(`[webhooks] ❌ REJECTED id=${mpId} detail="${status_detail}"`);
        } else {
            console.log(`[webhooks] ℹ️  ${status?.toUpperCase()} id=${mpId}`);
        }

    } catch (err) {
        console.error('[webhooks] Unhandled error:', err?.message);
        // Response already sent — nothing to do
    }
}

module.exports = { webhookHandler };
