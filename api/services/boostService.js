'use strict';
/**
 * api/services/boostService.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Server-side boost management service.
 * Wraps Supabase RPC calls for boost activation, expiration, and status checks.
 *
 * Used by:
 *   • api/mercadopago/webhooks.js   (payment confirmation → activate boost)
 *   • api/jobs/expire-boosts.js     (cron job)
 *   • api/server.js                 (route handlers)
 */

const SUPABASE_URL = () => process.env.SUPABASE_URL;
const SERVICE_KEY  = () => process.env.SUPABASE_SERVICE_KEY;

function sbHeaders() {
    const key = SERVICE_KEY();
    return {
        'Content-Type':  'application/json',
        'apikey':        key,
        'Authorization': `Bearer ${key}`,
        'Prefer':        'return=representation',
    };
}

async function rpc(fnName, params = {}) {
    const res = await fetch(`${SUPABASE_URL()}/rest/v1/rpc/${fnName}`, {
        method:  'POST',
        headers: sbHeaders(),
        body:    JSON.stringify(params),
    });
    const raw = await res.text();
    if (!res.ok) {
        const err = (() => { try { return JSON.parse(raw); } catch { return { raw }; } })();
        throw new Error(err?.message || err?.error || `RPC ${fnName} → HTTP ${res.status}`);
    }
    try { return JSON.parse(raw); } catch { return raw; }
}

/**
 * Activate a boost from a confirmed Mercado Pago order.
 * Calls activate_boost_from_order(order_id, mercadopago_payment_id).
 * @param {string} orderId
 * @param {string} mpPaymentId
 */
async function activateBoostFromOrder(orderId, mpPaymentId) {
    return rpc('activate_boost_from_order', {
        order_id:               orderId,
        mercadopago_payment_id: mpPaymentId,
    });
}

/**
 * Expire all boosts whose end_date has passed.
 * Calls expire_boosts().
 * @returns {Promise<number>} count of expired boosts
 */
async function expireBoosts() {
    const result = await rpc('expire_boosts');
    return Number(result) || 0;
}

/**
 * Get all active boosts for a listing.
 * @param {string} listingId
 * @returns {Promise<Array>}
 */
async function getActiveBoosts(listingId) {
    const url = new URL(`${SUPABASE_URL()}/rest/v1/listing_boosts`);
    url.searchParams.set('listing_id', `eq.${listingId}`);
    url.searchParams.set('active',     'eq.true');
    url.searchParams.set('end_date',   `gt.${new Date().toISOString()}`);
    url.searchParams.set('select',     '*');
    const res  = await fetch(url.toString(), { headers: sbHeaders() });
    const data = await res.json();
    return Array.isArray(data) ? data : [];
}

/**
 * Check if a listing has any active boost.
 * @param {string} listingId
 * @returns {Promise<boolean>}
 */
async function hasActiveBoost(listingId) {
    const boosts = await getActiveBoosts(listingId);
    return boosts.length > 0;
}

/**
 * Send a boost notification to the listing owner.
 * Creates a record in the notifications table.
 * @param {string} userId
 * @param {string} listingId
 * @param {'boost_activated'|'boost_expiring'|'boost_expired'} type
 * @param {object} metadata
 */
async function sendBoostNotification(userId, listingId, type, metadata = {}) {
    const titles = {
        boost_activated: '🚀 Seu anúncio foi impulsionado!',
        boost_expiring:  '⚠️ Seu impulso está expirando em breve',
        boost_expired:   '📅 Seu impulso expirou',
    };
    const bodies = {
        boost_activated: 'Seu anúncio agora aparece em destaque para mais compradores.',
        boost_expiring:  'Renove seu impulso para continuar aparecendo em destaque.',
        boost_expired:   'Seu anúncio voltou à posição orgânica. Renove para se destacar novamente.',
    };

    try {
        await fetch(`${SUPABASE_URL()}/rest/v1/notifications`, {
            method:  'POST',
            headers: { ...sbHeaders(), 'Prefer': 'return=minimal' },
            body:    JSON.stringify({
                user_id:    userId,
                type,
                title:      titles[type] ?? type,
                body:       bodies[type] ?? '',
                action_url: `/impulsionar/${listingId}`,
                metadata:   { listing_id: listingId, ...metadata },
            }),
        });
    } catch (err) {
        console.warn(`[boostService] notification failed (non-fatal): ${err.message}`);
    }
}

module.exports = {
    activateBoostFromOrder,
    expireBoosts,
    getActiveBoosts,
    hasActiveBoost,
    sendBoostNotification,
};
