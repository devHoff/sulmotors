'use strict';

/**
 * api/mercadopago/create-payment.js
 * POST /api/create-payment
 *
 * Handles PIX and credit-card payments via Mercado Pago SDK v2.
 *
 * PIX flow:
 *   → creates payment with method_id "pix"
 *   → returns qr_code + qr_code_base64 + ticket_url + expiration
 *
 * Card flow (MP Brick / SDK token):
 *   → frontend tokenises card with mp.createCardToken(formEl)
 *   → sends token here
 *   → we create the payment with the token
 *
 * IMPORTANT (sandbox):
 *   - payer_email must be a TEST USER email, never the seller account email.
 *   - In production payer_email is always the real logged-in user email.
 */

const { MercadoPagoConfig, Payment } = require('mercadopago');

function getMPClient() {
    const token = process.env.MP_ACCESS_TOKEN;
    if (!token) throw new Error('MP_ACCESS_TOKEN não configurado.');
    return new Payment(new MercadoPagoConfig({
        accessToken: token,
        options: { timeout: 15000 },
    }));
}

/**
 * Map MP error cause array → user-friendly Portuguese message.
 */
function friendlyError(err) {
    const causes = err?.cause ?? [];

    for (const c of causes) {
        const code = String(c.code ?? '');
        const desc = String(c.description ?? '').toLowerCase();

        if (code === '4390' || desc.includes('forbidden'))
            return 'E-mail do pagador não permitido no ambiente de teste. Use um e-mail de usuário de teste do Mercado Pago.';
        if (desc.includes('invalid card token') || desc.includes('token'))
            return 'Token do cartão inválido ou expirado. Por favor, insira os dados do cartão novamente.';
        if (desc.includes('invalid expiration') || desc.includes('expiration_month'))
            return 'Validade do cartão inválida.';
        if (desc.includes('insufficient amount') || desc.includes('insufficient funds'))
            return 'Saldo insuficiente no cartão.';
        if (desc.includes('security_code'))
            return 'CVV inválido.';
        if (desc.includes('blacklist') || desc.includes('high_risk'))
            return 'Pagamento recusado por risco. Tente outro método de pagamento.';
        if (desc.includes('bad_filled'))
            return 'Dados do cartão inválidos. Verifique o número, validade e CVV.';
    }

    const msg = (err?.message ?? '').toLowerCase();
    if (msg.includes('forbidden')) return 'E-mail do pagador não permitido.';
    if (msg.includes('network') || msg.includes('timeout')) return 'Timeout ao conectar ao Mercado Pago. Tente novamente.';

    return err?.message || 'Erro ao processar pagamento. Tente novamente.';
}

async function createPaymentHandler(req, res) {
    try {
        const {
            transaction_amount,
            description,
            payer_email,
            payer_name         = '',
            payer_cpf          = '00000000000',
            payment_method_id  = 'pix',
            external_reference = '',
            installments       = 1,
            card_token,
            issuer_id,
        } = req.body ?? {};

        // ── Validation ──────────────────────────────────────────────────────
        const amount = parseFloat(transaction_amount);
        if (!amount || isNaN(amount) || amount <= 0) {
            return res.status(400).json({ error: 'transaction_amount inválido ou ausente.' });
        }
        if (!description || typeof description !== 'string') {
            return res.status(400).json({ error: 'description ausente.' });
        }
        if (!payer_email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payer_email)) {
            return res.status(400).json({ error: 'payer_email inválido.' });
        }

        const nameParts  = payer_name.trim().split(/\s+/);
        const firstName  = nameParts[0]  || 'Cliente';
        const lastName   = nameParts.slice(1).join(' ') || 'SulMotor';

        // ── Build body ──────────────────────────────────────────────────────
        const body = {
            transaction_amount: parseFloat(amount.toFixed(2)),
            description:        description.slice(0, 255),
            payment_method_id,
            installments:       Number(installments) || 1,
            payer: {
                email:      payer_email,
                first_name: firstName,
                last_name:  lastName,
                identification: {
                    type:   'CPF',
                    number: payer_cpf.replace(/\D/g, '') || '00000000000',
                },
            },
            external_reference: String(external_reference),
        };

        // PIX — set expiry 30 min
        if (payment_method_id === 'pix') {
            body.date_of_expiration = new Date(Date.now() + 30 * 60 * 1000).toISOString();
        }

        // Card — attach token + issuer
        if (payment_method_id !== 'pix') {
            if (!card_token) {
                return res.status(400).json({ error: 'card_token ausente para pagamento com cartão.' });
            }
            body.token        = card_token;
            body.capture      = true;
            if (issuer_id) body.issuer_id = String(issuer_id);
        }

        const idempotencyKey = `sm-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const mp = getMPClient();

        console.log(`[create-payment] Creating ${payment_method_id.toUpperCase()} R$${amount} payer=${payer_email}`);

        const r = await mp.create({ body, requestOptions: { idempotencyKey } });

        const pixData = r.point_of_interaction?.transaction_data ?? {};

        const response = {
            payment_id:     String(r.id),
            status:         r.status,
            status_detail:  r.status_detail,
            // PIX fields
            qr_code:        pixData.qr_code         ?? null,
            qr_code_base64: pixData.qr_code_base64  ?? null,
            ticket_url:     pixData.ticket_url       ?? null,
            pix_expiration: r.date_of_expiration     ?? null,
        };

        console.log(`[create-payment] ✅ id=${response.payment_id} status=${response.status} detail=${response.status_detail}`);
        return res.status(201).json(response);

    } catch (err) {
        console.error('[create-payment] ❌ Error:', err?.message);
        if (err?.cause?.length) console.error('[create-payment] Cause:', JSON.stringify(err.cause));

        return res.status(502).json({ error: friendlyError(err) });
    }
}

module.exports = { createPaymentHandler };
