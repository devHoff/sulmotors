'use strict';

/**
 * api/mercadopago/webhooks.js
 * POST /api/webhooks/mercadopago   ← canonical path
 * POST /api/webhook/mercadopago    ← legacy alias (both route here)
 *
 * Receives Mercado Pago IPN / Webhook notifications.
 *
 * Security:
 *   - Always responds HTTP 200 immediately to prevent MP retries
 *   - Validates HMAC-SHA256 signature when MP_WEBHOOK_SECRET is set
 *   - All DB updates use SUPABASE_SERVICE_KEY (server-side only)
 *   - Prevents replay attacks by checking timestamp freshness (±5 min)
 *   - UUID-validated anuncio_id before any DB call
 *
 * Handles:
 *   payment.created  → log
 *   payment.updated  → if approved: activate boost + log payment
 *                    → if rejected/cancelled: log
 */

const crypto                       = require('crypto');
const { MercadoPagoConfig, Payment } = require('mercadopago');

// ── Constants ─────────────────────────────────────────────────────────────────
const TIMESTAMP_TOLERANCE_S = 300;  // ±5 minutes replay-attack window
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ── MP client factory ─────────────────────────────────────────────────────────
function getMPClient() {
    const token = process.env.MP_ACCESS_TOKEN;
    if (!token) {
        console.warn('[webhook] MP_ACCESS_TOKEN not set');
        return null;
    }
    return new Payment(new MercadoPagoConfig({
        accessToken: token,
        options: { timeout: 10000 },
    }));
}

// ── Signature validation ──────────────────────────────────────────────────────
/**
 * Validates the x-signature header sent by Mercado Pago.
 * Format: "ts=<unix>,v1=<hmac-sha256-hex>"
 * Manifest: "id:<data.id>;request-id:<x-request-id>;ts:<ts>;"
 *
 * Returns { valid: true } or { valid: false, reason: string }
 */
function validateSignature(req, notificationId) {
    const secret    = process.env.MP_WEBHOOK_SECRET;
    const sigHeader = req.headers['x-signature']  ?? '';
    const requestId = req.headers['x-request-id'] ?? '';

    if (!secret) {
        // No secret configured → accept but warn
        console.warn('[webhook] MP_WEBHOOK_SECRET not set – signature check SKIPPED');
        return { valid: true, reason: 'no_secret' };
    }

    if (!sigHeader) return { valid: false, reason: 'missing_x-signature' };

    // Parse "ts=...,v1=..."
    const parts = {};
    sigHeader.split(',').forEach((part) => {
        const eq = part.indexOf('=');
        if (eq > 0) parts[part.slice(0, eq).trim()] = part.slice(eq + 1).trim();
    });

    const { ts, v1: receivedHash } = parts;
    if (!ts || !receivedHash) return { valid: false, reason: 'malformed_x-signature' };

    // Replay-attack check: reject if timestamp is too old or in the future
    const now     = Math.floor(Date.now() / 1000);
    const tsDelta = Math.abs(now - Number(ts));
    if (tsDelta > TIMESTAMP_TOLERANCE_S) {
        console.warn(`[webhook] Stale timestamp ts=${ts} delta=${tsDelta}s`);
        return { valid: false, reason: 'stale_timestamp' };
    }

    // Build manifest and compute expected HMAC
    const manifest     = `id:${notificationId};request-id:${requestId};ts:${ts};`;
    const expectedHash = crypto.createHmac('sha256', secret).update(manifest).digest('hex');

    // Constant-time comparison to prevent timing attacks
    const expected = Buffer.from(expectedHash, 'hex');
    const received = Buffer.from(receivedHash,  'hex');
    if (expected.length !== received.length || !crypto.timingSafeEqual(expected, received)) {
        return { valid: false, reason: 'signature_mismatch' };
    }
    return { valid: true };
}

// ── Supabase helpers (REST API, no client library needed in backend) ───────────
function supabaseHeaders() {
    const key = process.env.SUPABASE_SERVICE_KEY;
    return {
        'Content-Type':  'application/json',
        'apikey':        key,
        'Authorization': `Bearer ${key}`,
        'Prefer':        'return=minimal',
    };
}

async function activateBoost(paymentData) {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
    if (!supabaseUrl || !supabaseKey) {
        console.warn('[webhook] SUPABASE_URL / SUPABASE_SERVICE_KEY not set – skipping DB update');
        return;
    }

    // external_reference format: "<uuid>:<days>"
    const extRef = paymentData.external_reference ?? '';
    const colonIdx = extRef.lastIndexOf(':');
    if (colonIdx < 0) {
        console.warn('[webhook] external_reference missing colon separator:', extRef);
        return;
    }
    const anuncioId = extRef.slice(0, colonIdx);
    const diasStr   = extRef.slice(colonIdx + 1);
    const dias      = parseInt(diasStr, 10) || 30;

    // Validate UUID to prevent injection
    if (!UUID_RE.test(anuncioId)) {
        console.warn('[webhook] anuncio_id is not a valid UUID:', anuncioId);
        return;
    }

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + dias);

    // 1. Activate boost on the listing
    try {
        const patchRes = await fetch(
            `${supabaseUrl}/rest/v1/anuncios?id=eq.${encodeURIComponent(anuncioId)}`,
            {
                method:  'PATCH',
                headers: supabaseHeaders(),
                body:    JSON.stringify({
                    destaque:         true,
                    impulsionado:     true,
                    impulsionado_ate: expiresAt.toISOString(),
                    prioridade:       10,
                }),
            }
        );
        if (patchRes.ok) {
            console.log(`[webhook] ✅ Boost activated anuncio=${anuncioId} days=${dias} until=${expiresAt.toISOString()}`);
        } else {
            const body = await patchRes.text();
            console.error(`[webhook] Supabase PATCH /anuncios failed: ${patchRes.status} ${body}`);
        }
    } catch (e) {
        console.error('[webhook] PATCH /anuncios threw:', e.message);
    }

    // 2. Record payment in pagamentos table (non-fatal)
    try {
        await fetch(`${supabaseUrl}/rest/v1/pagamentos`, {
            method:  'POST',
            headers: supabaseHeaders(),
            body:    JSON.stringify({
                mp_payment_id:  String(paymentData.id),
                anuncio_id:     anuncioId,
                amount:         paymentData.transaction_amount,
                currency:       paymentData.currency_id ?? 'BRL',
                payment_method: paymentData.payment_method_id ?? 'pix',
                status:         'approved',
                payer_email:    paymentData.payer?.email ?? '',
                boost_days:     dias,
                approved_at:    new Date().toISOString(),
            }),
        });
    } catch (e) {
        console.warn('[webhook] INSERT /pagamentos (non-fatal):', e.message);
    }
}

// ── Main handler ──────────────────────────────────────────────────────────────
async function webhookHandler(req, res) {
    // Always respond 200 immediately to prevent MP from retrying
    res.status(200).json({ received: true });

    try {
        const body             = req.body ?? {};
        const queryDataId      = req.query?.['data.id'];
        const notificationId   = body.data?.id ?? queryDataId ?? body.id;
        const { type, action } = body;

        // Accept both IPN (?data.id=) and Webhooks (body.type="payment") format
        const isPaymentEvent =
            type === 'payment'          ||
            action === 'payment.updated' ||
            action === 'payment.created';

        if (!notificationId || !isPaymentEvent) {
            console.log(`[webhook] Ignored: type="${type}" action="${action}" id="${notificationId}"`);
            return;
        }

        // Validate signature (if secret configured)
        const sigCheck = validateSignature(req, String(notificationId));
        if (!sigCheck.valid) {
            console.warn(`[webhook] Signature invalid: ${sigCheck.reason} id=${notificationId}`);
            return; // silently drop — response already sent
        }

        const mp = getMPClient();
        if (!mp) return;

        // Fetch full payment details from MP
        let paymentData;
        try {
            paymentData = await mp.get({ id: String(notificationId) });
        } catch (e) {
            console.error(`[webhook] Failed to fetch payment ${notificationId}:`, e.message);
            return;
        }

        const { status, status_detail, id: mpId } = paymentData;
        console.log(`[webhook] id=${mpId} status="${status}" detail="${status_detail}" ref="${paymentData.external_reference}"`);

        if (status === 'approved') {
            console.log(`[webhook] ✅ APPROVED id=${mpId} amount=${paymentData.transaction_amount}`);
            await activateBoost(paymentData);
        } else if (status === 'rejected') {
            console.log(`[webhook] ❌ REJECTED id=${mpId} detail="${status_detail}"`);
        } else if (status === 'cancelled') {
            console.log(`[webhook] 🚫 CANCELLED id=${mpId}`);
        } else {
            console.log(`[webhook] ℹ️  ${String(status).toUpperCase()} id=${mpId}`);
        }

    } catch (err) {
        // Response already sent — just log
        console.error('[webhook] Unhandled error:', err?.message);
    }
}

module.exports = { webhookHandler };
