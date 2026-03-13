'use strict';

/**
 * api/mercadopago/webhook.js
 * ─────────────────────────────────────────────────────────────────────────────
 * POST /api/webhook/mercadopago
 *
 * Receives Mercado Pago payment event notifications (IPN/Webhooks).
 *
 * MP sends a JSON body with the notification type and data.id.
 * We verify the payment status directly with the MP API and
 * trigger the appropriate business logic (activate boost in Supabase).
 *
 * Reference:
 *   https://www.mercadopago.com.br/developers/en/docs/your-integrations/notifications/webhooks
 *
 * Env vars required:
 *   MP_ACCESS_TOKEN
 *   MP_WEBHOOK_SECRET       (optional – enables signature verification)
 *   SUPABASE_URL            (optional – for DB updates)
 *   SUPABASE_SERVICE_KEY    (optional – service role key for DB updates)
 */

const { MercadoPagoConfig, Payment } = require('mercadopago');
const { validateWebhookSignature }   = require('../security/validateWebhook');

/**
 * Returns a configured MP Payment client.
 */
function getMPClient() {
    const token = process.env.MP_ACCESS_TOKEN;
    if (!token) throw new Error('MP_ACCESS_TOKEN não configurado.');
    const client = new MercadoPagoConfig({ accessToken: token, options: { timeout: 8000 } });
    return new Payment(client);
}

/**
 * Activates the boost in Supabase for the given anuncio_id.
 * Reads days from paymentData.metadata or defaults to 30.
 *
 * @param {object} paymentData  – full payment object from MP API
 */
async function activateBoostInSupabase(paymentData) {
    const supabaseUrl    = process.env.SUPABASE_URL;
    const supabaseKey    = process.env.SUPABASE_SERVICE_KEY;

    if (!supabaseUrl || !supabaseKey) {
        console.warn('[webhook] SUPABASE_URL or SUPABASE_SERVICE_KEY not set – skipping DB update');
        return;
    }

    const externalRef = paymentData.external_reference ?? '';
    // external_reference format: "<anuncio_id>:<dias>" or just "<anuncio_id>"
    const [anuncioId, diasStr] = externalRef.split(':');
    const dias = parseInt(diasStr ?? '30', 10) || 30;

    if (!anuncioId) {
        console.warn('[webhook] No anuncio_id in external_reference – cannot activate boost');
        return;
    }

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + dias);

    try {
        // ── Update anuncios ────────────────────────────────────────────────────
        const res = await fetch(`${supabaseUrl}/rest/v1/anuncios?id=eq.${anuncioId}`, {
            method: 'PATCH',
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

        if (!res.ok) {
            const txt = await res.text();
            console.error(`[webhook] Supabase PATCH failed: ${res.status} ${txt}`);
            return;
        }

        console.log(`[webhook] ✅ Boost activated for anuncio=${anuncioId} until ${expiresAt.toISOString()}`);

        // ── Optionally record payment in pagamentos table ──────────────────────
        await fetch(`${supabaseUrl}/rest/v1/pagamentos`, {
            method: 'POST',
            headers: {
                'Content-Type':  'application/json',
                'apikey':        supabaseKey,
                'Authorization': `Bearer ${supabaseKey}`,
                'Prefer':        'return=minimal',
            },
            body: JSON.stringify({
                mp_payment_id:  String(paymentData.id),
                anuncio_id:     anuncioId,
                amount:         paymentData.transaction_amount,
                currency:       paymentData.currency_id ?? 'BRL',
                status:         'approved',
                payer_email:    paymentData.payer?.email ?? '',
                approved_at:    new Date().toISOString(),
            }),
        }).catch(e => console.warn('[webhook] pagamentos insert error (non-fatal):', e.message));

    } catch (err) {
        console.error('[webhook] activateBoostInSupabase error:', err?.message ?? err);
    }
}

/**
 * Business logic: called when a payment is approved.
 *
 * @param {object} paymentData  – full payment object from MP API
 */
async function onPaymentApproved(paymentData) {
    const paymentId   = String(paymentData.id);
    const externalRef = paymentData.external_reference ?? '';
    const amount      = paymentData.transaction_amount;
    const payerEmail  = paymentData.payer?.email ?? '';

    console.log(`[webhook] ✅ APPROVED payment_id=${paymentId} ref="${externalRef}" amount=${amount} payer=${payerEmail}`);

    await activateBoostInSupabase(paymentData);

    return { paymentId, externalRef, amount };
}

/**
 * Express route handler – called by server.js as:
 *   app.post('/api/webhook/mercadopago', webhookHandler);
 */
async function webhookHandler(req, res) {
    // ── 1. Validate signature (if MP_WEBHOOK_SECRET is set) ──────────────────
    const signatureValidation = validateWebhookSignature({
        secret:          process.env.MP_WEBHOOK_SECRET ?? '',
        signatureHeader: req.headers['x-signature']  ?? '',
        requestId:       req.headers['x-request-id'] ?? '',
        dataId:          req.query['data.id']         ?? req.body?.data?.id ?? '',
    });

    if (!signatureValidation.valid) {
        console.warn(`[webhook] Signature validation failed: ${signatureValidation.reason}`);
        // Log but continue – prevents MP from retrying indefinitely
    }

    // ── 2. Parse notification ─────────────────────────────────────────────────
    const body = req.body ?? {};
    const { type, action, data } = body;
    const notificationId = data?.id ?? req.query['data.id'];

    console.log(`[webhook] type="${type}" action="${action}" id="${notificationId}"`);

    if (type !== 'payment' && action !== 'payment.updated' && action !== 'payment.created') {
        return res.status(200).json({ received: true, processed: false });
    }

    if (!notificationId) {
        console.warn('[webhook] No payment ID in notification.');
        return res.status(200).json({ received: true, processed: false });
    }

    // ── 3. Fetch payment from MP API ─────────────────────────────────────────
    let paymentData;
    try {
        const paymentClient = getMPClient();
        paymentData = await paymentClient.get({ id: String(notificationId) });
    } catch (err) {
        console.error(`[webhook] Failed to fetch payment ${notificationId}:`, err?.message);
        return res.status(200).json({ received: true, error: 'fetch_failed', payment_id: String(notificationId) });
    }

    const { status, status_detail, id: mpId } = paymentData;
    console.log(`[webhook] Payment ${mpId} → status="${status}" detail="${status_detail}"`);

    // ── 4. Business logic ─────────────────────────────────────────────────────
    try {
        if (status === 'approved') {
            await onPaymentApproved(paymentData);
        } else if (status === 'rejected') {
            console.log(`[webhook] ❌ REJECTED payment_id=${mpId} detail="${status_detail}"`);
        } else if (status === 'in_process' || status === 'pending') {
            console.log(`[webhook] ⏳ PENDING payment_id=${mpId}`);
        } else if (status === 'cancelled' || status === 'refunded') {
            console.log(`[webhook] 🔄 ${status.toUpperCase()} payment_id=${mpId}`);
        }
    } catch (bizErr) {
        console.error(`[webhook] Business logic error for ${mpId}:`, bizErr?.message);
    }

    // ── 5. Always respond 200 ────────────────────────────────────────────────
    return res.status(200).json({ received: true, payment_id: String(mpId), status });
}

module.exports = { webhookHandler };
