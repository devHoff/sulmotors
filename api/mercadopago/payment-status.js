'use strict';

/**
 * api/mercadopago/payment-status.js
 * GET /api/payment-status/:payment_id
 */

const { MercadoPagoConfig, Payment } = require('mercadopago');

function getMPClient() {
    const token = process.env.MP_ACCESS_TOKEN;
    if (!token) throw new Error('MP_ACCESS_TOKEN não configurado.');
    return new Payment(new MercadoPagoConfig({
        accessToken: token,
        options: { timeout: 8000 },
    }));
}

async function paymentStatusHandler(req, res) {
    const { payment_id } = req.params;

    if (!payment_id || !/^\d+$/.test(payment_id)) {
        return res.status(400).json({ error: 'payment_id inválido. Deve ser numérico.' });
    }

    try {
        const mp = getMPClient();
        const r  = await mp.get({ id: payment_id });

        return res.json({
            payment_id:    String(r.id),
            status:        r.status,
            status_detail: r.status_detail,
        });

    } catch (err) {
        console.error(`[payment-status] ❌ id=${payment_id}:`, err?.message);

        const status = err?.status ?? 502;
        if (status === 404 || (err?.message ?? '').includes('404')) {
            return res.status(404).json({ error: `Pagamento ${payment_id} não encontrado.` });
        }
        return res.status(502).json({
            error: err?.message ?? 'Erro ao consultar status do pagamento.',
        });
    }
}

module.exports = { paymentStatusHandler };
