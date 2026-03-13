'use strict';

/**
 * validateWebhook.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Mercado Pago Webhook Signature Validation
 *
 * MP sends two headers on every webhook notification:
 *   x-signature   → "ts=<timestamp>,v1=<hmac>"
 *   x-request-id  → unique request UUID
 *
 * The HMAC-SHA256 is computed over the string:
 *   "id:<notification_id>;request-id:<x-request-id>;ts:<timestamp>;"
 *
 * Reference:
 *   https://www.mercadopago.com.br/developers/en/docs/your-integrations/notifications/webhooks
 */

const crypto = require('crypto');

/**
 * Validates the Mercado Pago webhook signature.
 *
 * @param {object} params
 * @param {string} params.secret          – MP_WEBHOOK_SECRET env variable
 * @param {string} params.signatureHeader – value of 'x-signature' header
 * @param {string} params.requestId       – value of 'x-request-id' header
 * @param {string} params.dataId          – query param 'data.id' (notification id)
 * @returns {{ valid: boolean, reason?: string }}
 */
function validateWebhookSignature({ secret, signatureHeader, requestId, dataId }) {
    if (!secret) {
        // No secret configured → skip validation but warn
        console.warn('[webhook] MP_WEBHOOK_SECRET not set – skipping signature check');
        return { valid: true, reason: 'no_secret_configured' };
    }

    if (!signatureHeader) {
        return { valid: false, reason: 'missing_x-signature_header' };
    }

    // Parse "ts=<ts>,v1=<hash>" from header
    const parts = {};
    signatureHeader.split(',').forEach((part) => {
        const [key, value] = part.split('=');
        if (key && value) parts[key.trim()] = value.trim();
    });

    const { ts, v1: receivedHash } = parts;
    if (!ts || !receivedHash) {
        return { valid: false, reason: 'malformed_x-signature_header' };
    }

    // Build the manifest string
    const manifest = `id:${dataId};request-id:${requestId};ts:${ts};`;

    // Compute expected HMAC-SHA256
    const expectedHash = crypto
        .createHmac('sha256', secret)
        .update(manifest)
        .digest('hex');

    const valid = crypto.timingSafeEqual(
        Buffer.from(expectedHash, 'hex'),
        Buffer.from(receivedHash,  'hex'),
    );

    return valid
        ? { valid: true }
        : { valid: false, reason: 'signature_mismatch' };
}

module.exports = { validateWebhookSignature };
