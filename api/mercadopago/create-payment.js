'use strict';

/**
 * api/mercadopago/create-payment.js
 * ─────────────────────────────────────────────────────────────────────────────
 * POST /api/create-payment
 *
 * Creates a Mercado Pago PIX payment (expandable to card/boleto).
 *
 * Request body:
 *   {
 *     transaction_amount : number   – amount in BRL (e.g. 59.90)
 *     description        : string   – e.g. "Impulsionar anúncio – Honda Civic 2022"
 *     payer_email        : string   – buyer email
 *     payer_name?        : string   – buyer full name (optional)
 *     payment_method_id? : string   – default: "pix"
 *     external_reference?: string   – your internal ID (anuncio_id, order_id, etc.)
 *     installments?      : number   – card only (default 1)
 *     card_token?        : string   – card only (tokenized via MP SDK)
 *     issuer_id?         : string   – card only
 *   }
 *
 * Success response:
 *   {
 *     payment_id      : string
 *     status          : string        – "pending" | "approved" | "rejected"
 *     status_detail   : string
 *     qr_code?        : string        – PIX copy-paste string
 *     qr_code_base64? : string        – PNG base64 for <img>
 *     ticket_url?     : string        – PIX link
 *     pix_expiration? : string        – ISO timestamp
 *   }
 *
 * Env vars required:
 *   MP_ACCESS_TOKEN
 */

const { MercadoPagoConfig, Payment } = require('mercadopago');

/**
 * Returns a configured MP Payment client.
 * Throws if MP_ACCESS_TOKEN is missing.
 */
function getMPClient() {
    const token = process.env.MP_ACCESS_TOKEN;
    if (!token) throw new Error('MP_ACCESS_TOKEN não configurado.');
    const client = new MercadoPagoConfig({ accessToken: token, options: { timeout: 10000 } });
    return new Payment(client);
}

/**
 * Express route handler – called by server.js as:
 *   app.post('/api/create-payment', createPaymentHandler);
 *
 * @param {import('express').Request}  req
 * @param {import('express').Response} res
 */
async function createPaymentHandler(req, res) {
    try {
        const {
            transaction_amount,
            description,
            payer_email,
            payer_name        = '',
            payment_method_id = 'pix',
            external_reference = '',
            installments       = 1,
            card_token,
            issuer_id,
        } = req.body;

        // ── Input validation ────────────────────────────────────────────────
        if (!transaction_amount || isNaN(Number(transaction_amount))) {
            return res.status(400).json({ error: 'transaction_amount inválido ou ausente.' });
        }
        if (!description || typeof description !== 'string') {
            return res.status(400).json({ error: 'description ausente.' });
        }
        if (!payer_email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payer_email)) {
            return res.status(400).json({ error: 'payer_email inválido.' });
        }

        const amount = Number(Number(transaction_amount).toFixed(2));

        // ── Build MP payment body ───────────────────────────────────────────
        const paymentBody = {
            transaction_amount: amount,
            description:        String(description).slice(0, 255),
            payment_method_id,
            payer: {
                email:            payer_email,
                first_name:       payer_name.split(' ')[0]  || 'Cliente',
                last_name:        payer_name.split(' ').slice(1).join(' ') || 'SulMotor',
                identification: {
                    type:   'CPF',
                    number: '00000000000', // placeholder – user didn't provide
                },
            },
            external_reference: String(external_reference),
        };

        // ── PIX-specific fields ────────────────────────────────────────────
        if (payment_method_id === 'pix') {
            // PIX payments expire in 30 minutes by default
            const expiry = new Date(Date.now() + 30 * 60 * 1000).toISOString();
            paymentBody.date_of_expiration = expiry;
        }

        // ── Card-specific fields ───────────────────────────────────────────
        if (payment_method_id !== 'pix' && card_token) {
            paymentBody.token        = card_token;
            paymentBody.installments = Number(installments) || 1;
            if (issuer_id) paymentBody.issuer_id = String(issuer_id);
        }

        // ── Call Mercado Pago API ──────────────────────────────────────────
        const paymentClient = getMPClient();

        // Idempotency key prevents duplicate charges on retry
        const idempotencyKey = `sulmtr-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

        const mpResponse = await paymentClient.create({
            body:            paymentBody,
            requestOptions:  { idempotencyKey },
        });

        // ── Extract PIX QR code data ────────────────────────────────────────
        const pixData = mpResponse.point_of_interaction?.transaction_data ?? {};

        const response = {
            payment_id:      String(mpResponse.id),
            status:          mpResponse.status,
            status_detail:   mpResponse.status_detail,
            qr_code:         pixData.qr_code         ?? null,
            qr_code_base64:  pixData.qr_code_base64  ?? null,
            ticket_url:      pixData.ticket_url       ?? null,
            pix_expiration:  mpResponse.date_of_expiration ?? null,
        };

        console.log(`[create-payment] ${payment_method_id.toUpperCase()} created → id=${response.payment_id} status=${response.status}`);
        return res.status(201).json(response);

    } catch (err) {
        console.error('[create-payment] Error:', err?.message ?? err);

        // Surface the MP error detail if available
        const detail = err?.cause?.[0]?.description
            ?? err?.response?.data?.message
            ?? err?.message
            ?? 'Erro interno ao criar pagamento.';

        return res.status(502).json({ error: detail });
    }
}

module.exports = { createPaymentHandler };
