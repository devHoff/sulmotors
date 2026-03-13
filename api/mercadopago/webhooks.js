'use strict';

/**
 * api/mercadopago/webhooks.js
 * POST /api/webhooks/mercadopago   ← canonical path
 * POST /api/webhook/mercadopago    ← legacy alias
 *
 * Receives Mercado Pago IPN / Webhook notifications and:
 *   1. Validates HMAC-SHA256 signature (when MP_WEBHOOK_SECRET is set)
 *   2. Verifies payment via MP API (status + amount cross-check)
 *   3. Updates order status in Supabase
 *   4. Creates listing_boost record
 *   5. Updates listing priority
 *   6. Records analytics event
 *
 * Security:
 *   - Always responds HTTP 200 immediately to prevent MP retries
 *   - HMAC-SHA256 signature validated (constant-time compare)
 *   - Replay-attack protection via timestamp tolerance (±5 min)
 *   - UUID validation on all IDs before DB calls
 *   - Idempotent: safe to call multiple times for same payment
 */

const crypto = require('crypto');
const { MercadoPagoConfig, Payment } = require('mercadopago');

// ── Constants ─────────────────────────────────────────────────────────────────
const TIMESTAMP_TOLERANCE_S = 300;  // ±5 minutes
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ── Mercado Pago client ───────────────────────────────────────────────────────
function getMPClient() {
    const token = process.env.MP_ACCESS_TOKEN;
    if (!token) { console.warn('[webhook] MP_ACCESS_TOKEN not set'); return null; }
    return new Payment(new MercadoPagoConfig({
        accessToken: token,
        options: { timeout: 12000 },
    }));
}

// ── Signature validation ──────────────────────────────────────────────────────
/**
 * Validates the x-signature header sent by Mercado Pago.
 * Format: "ts=<unix>,v1=<hmac-sha256-hex>"
 * Manifest: "id:<data.id>;request-id:<x-request-id>;ts:<ts>;"
 */
function validateSignature(req, notificationId) {
    const secret    = process.env.MP_WEBHOOK_SECRET;
    const sigHeader = req.headers['x-signature']  ?? '';
    const requestId = req.headers['x-request-id'] ?? '';

    if (!secret) {
        console.warn('[webhook] MP_WEBHOOK_SECRET not set – signature check SKIPPED');
        return { valid: true, reason: 'no_secret' };
    }
    if (!sigHeader) return { valid: false, reason: 'missing_x-signature' };

    const parts = {};
    sigHeader.split(',').forEach(p => {
        const eq = p.indexOf('=');
        if (eq > 0) parts[p.slice(0, eq).trim()] = p.slice(eq + 1).trim();
    });

    const { ts, v1: receivedHash } = parts;
    if (!ts || !receivedHash) return { valid: false, reason: 'malformed_x-signature' };

    const now     = Math.floor(Date.now() / 1000);
    const tsDelta = Math.abs(now - Number(ts));
    if (tsDelta > TIMESTAMP_TOLERANCE_S) {
        console.warn(`[webhook] Stale timestamp ts=${ts} delta=${tsDelta}s`);
        return { valid: false, reason: 'stale_timestamp' };
    }

    const manifest     = `id:${notificationId};request-id:${requestId};ts:${ts};`;
    const expectedHash = crypto.createHmac('sha256', secret).update(manifest).digest('hex');
    const exp = Buffer.from(expectedHash, 'hex');
    const rec = Buffer.from(receivedHash,  'hex');
    if (exp.length !== rec.length || !crypto.timingSafeEqual(exp, rec)) {
        return { valid: false, reason: 'signature_mismatch' };
    }
    return { valid: true };
}

// ── Supabase REST helpers ─────────────────────────────────────────────────────
function sbHeaders() {
    const key = process.env.SUPABASE_SERVICE_KEY;
    return {
        'Content-Type':  'application/json',
        'apikey':        key,
        'Authorization': `Bearer ${key}`,
        'Prefer':        'return=representation',
    };
}

const SB_URL = () => process.env.SUPABASE_URL;

async function sbGet(path, qs = '') {
    const res  = await fetch(`${SB_URL()}/rest/v1/${path}${qs ? '?' + qs : ''}`, { headers: sbHeaders() });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.message || `Supabase GET ${path} → ${res.status}`);
    return Array.isArray(data) ? data[0] : data;
}

async function sbPost(path, body) {
    const res  = await fetch(`${SB_URL()}/rest/v1/${path}`, {
        method: 'POST', headers: sbHeaders(), body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.message || `Supabase POST ${path} → ${res.status}`);
    return Array.isArray(data) ? data[0] : data;
}

async function sbPatch(path, qs, body) {
    const res  = await fetch(`${SB_URL()}/rest/v1/${path}?${qs}`, {
        method: 'PATCH', headers: sbHeaders(), body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.message || `Supabase PATCH ${path} → ${res.status}`);
    return data;
}

async function sbRpc(fn, args = {}) {
    const res  = await fetch(`${SB_URL()}/rest/v1/rpc/${fn}`, {
        method: 'POST', headers: sbHeaders(), body: JSON.stringify(args),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.message || `Supabase RPC ${fn} → ${res.status}`);
    return data;
}

// ── Static boost plans fallback ───────────────────────────────────────────────
const PLAN_MAP = {
    'basic_boost':   { duration_days:  7, priority_level: 1 },
    'premium_boost': { duration_days: 15, priority_level: 2 },
    'ultra_boost':   { duration_days: 30, priority_level: 3 },
};

// Duration fallback: derive from external_reference "order_id:listing_id" if plan lookup fails
function daysFromPlan(planType) {
    return PLAN_MAP[planType]?.duration_days ?? 30;
}
function priorityFromPlan(planType) {
    return PLAN_MAP[planType]?.priority_level ?? 1;
}

// ── Payment verification ──────────────────────────────────────────────────────
/**
 * Verifies payment via MP API and cross-checks amount against order.
 * Returns { ok: true } or { ok: false, reason: string }
 */
async function verifyPayment(mp, paymentId, expectedAmount) {
    try {
        const data = await mp.get({ id: String(paymentId) });
        if (data.status !== 'approved') {
            return { ok: false, reason: `status=${data.status}` };
        }
        // Allow ±1 cent tolerance for floating point
        if (Math.abs(Number(data.transaction_amount) - Number(expectedAmount)) > 0.02) {
            console.warn(`[webhook] Amount mismatch: paid=${data.transaction_amount} expected=${expectedAmount}`);
            return { ok: false, reason: 'amount_mismatch' };
        }
        return { ok: true, data };
    } catch (e) {
        return { ok: false, reason: e.message };
    }
}

// ── Activate boost (new order-based flow) ─────────────────────────────────────
async function activateBoostForOrder(orderId, mpPaymentId, paymentData) {
    const url = SB_URL();
    const key = process.env.SUPABASE_SERVICE_KEY;
    if (!url || !key) {
        console.warn('[webhook] Supabase not configured – skipping DB update');
        return;
    }

    // Try using the SQL function first (atomic + idempotent)
    try {
        await sbRpc('activate_boost_from_order', {
            p_order_id:       orderId,
            p_mp_payment_id:  String(mpPaymentId),
        });
        console.log(`[webhook] ✅ activate_boost_from_order(${orderId}) succeeded`);

        // Track analytics event
        try {
            await sbPost('analytics_events', {
                event_name: 'boost_payment_approved',
                properties: {
                    mp_payment_id:     String(mpPaymentId),
                    order_id:          orderId,
                    amount:            paymentData.transaction_amount,
                    payment_method:    paymentData.payment_method_id,
                },
            });
        } catch { /* non-fatal */ }

        return;
    } catch (e) {
        console.warn('[webhook] RPC activate_boost_from_order failed, falling back:', e.message);
    }

    // ── Fallback: manual update if RPC function not deployed ────────────────
    // Parse order to get listing_id and plan_type
    try {
        const order = await sbGet('orders', `id=eq.${orderId}&select=*`);
        if (!order) {
            console.error('[webhook] Order not found for fallback:', orderId);
            return;
        }

        const planType     = order.plan_type;
        const listingId    = order.listing_id;
        const durationDays = daysFromPlan(planType);
        const priorityLvl  = priorityFromPlan(planType);
        const endDate      = new Date(Date.now() + durationDays * 86400_000).toISOString();

        // 1. Update order
        await sbPatch('orders', `id=eq.${orderId}`, {
            status:                'approved',
            mercadopago_payment_id: String(mpPaymentId),
            updated_at:             new Date().toISOString(),
        });

        // 2. Upsert listing_boost
        await fetch(`${url}/rest/v1/listing_boosts`, {
            method: 'POST',
            headers: { ...sbHeaders(), 'Prefer': 'resolution=merge-duplicates,return=minimal' },
            body: JSON.stringify({
                listing_id:     listingId,
                order_id:       orderId,
                plan_type:      planType,
                priority_level: priorityLvl,
                start_date:     new Date().toISOString(),
                end_date:       endDate,
                active:         true,
            }),
        });

        // 3. Update anuncio
        await sbPatch('anuncios', `id=eq.${listingId}`, {
            impulsionado:     true,
            destaque:         true,
            impulsionado_ate: endDate,
            prioridade:       priorityLvl * 10,
        });

        console.log(`[webhook] ✅ Fallback boost activated: listing=${listingId} order=${orderId} days=${durationDays}`);

    } catch (err) {
        console.error('[webhook] Fallback activation failed:', err.message);
    }
}

// ── Legacy boost activation (external_reference = "uuid:days") ───────────────
async function activateBoostLegacy(paymentData) {
    const extRef   = String(paymentData.external_reference ?? '');
    const colonIdx = extRef.lastIndexOf(':');
    if (colonIdx < 0) {
        console.warn('[webhook] Legacy: invalid external_reference:', extRef);
        return;
    }

    const part1 = extRef.slice(0, colonIdx);
    const part2 = extRef.slice(colonIdx + 1);

    // Detect new format: "order_uuid:listing_uuid" (both are UUIDs)
    if (UUID_RE.test(part1) && UUID_RE.test(part2)) {
        // New order-based format
        await activateBoostForOrder(part1, paymentData.id, paymentData);
        return;
    }

    // Old format: "listing_uuid:days"
    if (!UUID_RE.test(part1)) {
        console.warn('[webhook] Legacy: invalid UUID:', part1);
        return;
    }

    const url = SB_URL();
    const key = process.env.SUPABASE_SERVICE_KEY;
    if (!url || !key) return;

    const dias     = parseInt(part2, 10) || 30;
    const endDate  = new Date(Date.now() + dias * 86400_000).toISOString();

    try {
        await sbPatch('anuncios', `id=eq.${part1}`, {
            destaque:         true,
            impulsionado:     true,
            impulsionado_ate: endDate,
            prioridade:       10,
        });
        console.log(`[webhook] ✅ Legacy boost: anuncio=${part1} days=${dias}`);
    } catch (e) {
        console.error('[webhook] Legacy patch failed:', e.message);
    }

    // Record in pagamentos table (legacy)
    try {
        await sbPost('pagamentos', {
            mp_payment_id:  String(paymentData.id),
            anuncio_id:     part1,
            amount:         paymentData.transaction_amount,
            currency:       paymentData.currency_id ?? 'BRL',
            payment_method: paymentData.payment_method_id ?? 'pix',
            status:         'approved',
            payer_email:    paymentData.payer?.email ?? '',
            boost_days:     dias,
            approved_at:    new Date().toISOString(),
        });
    } catch { /* non-fatal */ }
}

// ── Handle rejected / cancelled / expired ────────────────────────────────────
async function handleNonApprovedStatus(paymentData, status) {
    const extRef = String(paymentData.external_reference ?? '');
    const parts  = extRef.split(':');
    if (parts.length < 2) return;

    const part1 = parts[0];
    const part2 = parts[1];

    const orderStatus = status === 'rejected' ? 'rejected'
                      : status === 'cancelled' ? 'cancelled'
                      : 'expired';

    // New format: order_id:listing_id
    if (UUID_RE.test(part1) && UUID_RE.test(part2)) {
        const url = SB_URL();
        const key = process.env.SUPABASE_SERVICE_KEY;
        if (!url || !key) return;
        try {
            await sbPatch('orders', `id=eq.${part1}`, {
                status:                 orderStatus,
                mercadopago_payment_id: String(paymentData.id),
                updated_at:             new Date().toISOString(),
            });
            // Track analytics
            await sbPost('analytics_events', {
                event_name: 'boost_payment_failed',
                order_id:   part1,
                listing_id: part2,
                properties: {
                    mp_payment_id: String(paymentData.id),
                    status,
                    status_detail: paymentData.status_detail,
                },
            }).catch(() => {});
        } catch (e) {
            console.warn('[webhook] handleNonApproved patch failed:', e.message);
        }
    }
}

// ── Main webhook handler ──────────────────────────────────────────────────────
async function webhookHandler(req, res) {
    // Always respond 200 immediately to prevent MP retries
    res.status(200).json({ received: true });

    try {
        const body           = req.body ?? {};
        const queryDataId    = req.query?.['data.id'];
        const notificationId = body.data?.id ?? queryDataId ?? body.id;
        const { type, action } = body;

        const isPaymentEvent =
            type === 'payment'           ||
            action === 'payment.updated' ||
            action === 'payment.created' ||
            action === 'payment.approved' ||
            action === 'payment.rejected' ||
            action === 'payment.cancelled';

        if (!notificationId || !isPaymentEvent) {
            console.log(`[webhook] Ignored: type="${type}" action="${action}" id="${notificationId}"`);
            return;
        }

        // Validate HMAC signature
        const sigCheck = validateSignature(req, String(notificationId));
        if (!sigCheck.valid) {
            console.warn(`[webhook] Signature REJECTED: ${sigCheck.reason} id=${notificationId}`);
            return;
        }

        const mp = getMPClient();
        if (!mp) return;

        // Fetch full payment from MP API
        let paymentData;
        try {
            paymentData = await mp.get({ id: String(notificationId) });
        } catch (e) {
            console.error(`[webhook] Failed to fetch payment ${notificationId}:`, e.message);
            return;
        }

        const { status, status_detail, id: mpId, external_reference } = paymentData;
        console.log(`[webhook] id=${mpId} status="${status}" detail="${status_detail}" ref="${external_reference}"`);

        if (status === 'approved') {
            // ── Payment verification ────────────────────────────────────────
            // Extract order_id to get expected amount
            const extRef = String(external_reference ?? '');
            const parts  = extRef.split(':');

            if (parts.length === 2 && UUID_RE.test(parts[0]) && UUID_RE.test(parts[1])) {
                // New order-based format: verify amount
                try {
                    const orderRow = await sbGet('orders', `id=eq.${parts[0]}&select=amount,status`);
                    if (orderRow?.status === 'approved') {
                        console.log(`[webhook] Already approved order=${parts[0]}, skipping`);
                        return;
                    }
                    if (orderRow?.amount) {
                        const vResult = await verifyPayment(mp, mpId, orderRow.amount);
                        if (!vResult.ok) {
                            console.warn(`[webhook] Payment verification failed: ${vResult.reason}`);
                            return;
                        }
                    }
                } catch { /* if order lookup fails, proceed anyway */ }
            }

            console.log(`[webhook] ✅ APPROVED id=${mpId} amount=${paymentData.transaction_amount}`);
            await activateBoostLegacy(paymentData);

        } else if (status === 'rejected') {
            console.log(`[webhook] ❌ REJECTED id=${mpId} detail="${status_detail}"`);
            await handleNonApprovedStatus(paymentData, 'rejected');

        } else if (status === 'cancelled') {
            console.log(`[webhook] 🚫 CANCELLED id=${mpId}`);
            await handleNonApprovedStatus(paymentData, 'cancelled');

        } else {
            console.log(`[webhook] ℹ️  ${String(status).toUpperCase()} id=${mpId}`);
        }

    } catch (err) {
        console.error('[webhook] Unhandled error:', err?.message);
    }
}

module.exports = { webhookHandler };
