'use strict';

/**
 * api/mercadopago/payment-status.js
 * ─────────────────────────────────────────────────────────────────────────────
 * GET /api/payment-status/:payment_id
 *
 * Queries Mercado Pago for the current status of a payment.
 * Used by the frontend polling loop while showing the PIX QR code.
 *
 * Success response:
 *   {
 *     payment_id    : string
 *     status        : "pending" | "approved" | "rejected" | "cancelled" | "in_process"
 *     status_detail : string
 *   }
 *
 * Env vars required:
 *   MP_ACCESS_TOKEN
 */

const { MercadoPagoConfig, Payment } = require('mercadopago');

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
 * Express route handler – called by server.js as:
 *   app.get('/api/payment-status/:payment_id', paymentStatusHandler);
 *
 * @param {import('express').Request}  req
 * @param {import('express').Response} res
 */
async function paymentStatusHandler(req, res) {
    const { payment_id } = req.params;

    if (!payment_id || !/^\d+$/.test(payment_id)) {
        return res.status(400).json({ error: 'payment_id inválido. Deve ser numérico.' });
    }

    try {
        const paymentClient = getMPClient();
        const mpResponse = await paymentClient.get({ id: payment_id });

        return res.json({
            payment_id:    String(mpResponse.id),
            status:        mpResponse.status,
            status_detail: mpResponse.status_detail,
        });

    } catch (err) {
        console.error(`[payment-status] Error for id=${payment_id}:`, err?.message ?? err);

        // If MP returns 404 it means the ID doesn't exist
        if (err?.status === 404 || err?.message?.includes('404')) {
            return res.status(404).json({ error: `Pagamento ${payment_id} não encontrado.` });
        }

        return res.status(502).json({
            error: err?.message ?? 'Erro ao consultar status do pagamento.',
        });
    }
}

module.exports = { paymentStatusHandler };
