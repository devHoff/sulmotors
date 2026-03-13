'use strict';

/**
 * api/mercadopago/payments.js
 * POST /api/payments/create
 *
 * Unified Mercado Pago Transparent Checkout endpoint.
 * Handles PIX and credit-card payments.
 *
 * Body fields:
 *   payment_method      'pix' | 'credit_card'
 *   transaction_amount  number
 *   description         string
 *   payer_email         string
 *   payer_name          string (optional)
 *   payer_cpf           string (optional, for card)
 *   payment_method_id   string (visa|master|amex|elo|hipercard — for card)
 *   external_reference  string (optional)
 *   installments        number (1 default, for card)
 *   token               string (MP card token — required for card)
 *   issuer_id           string (optional, for card)
 *
 * Response:
 *   payment_id, status, status_detail,
 *   qr_code, qr_code_base64, ticket_url, pix_expiration  (PIX only)
 */

const { MercadoPagoConfig, Payment } = require('mercadopago');

// ── Sanitise payer email ───────────────────────────────────────────────────────
// Never use the seller/merchant email as payer – that causes error 4390.
const SELLER_EMAILS = [
    'luishenriquegrings@gmail.com',
    'bandasleonardo@gmail.com',
    'test_user_',
];
function sanitiseEmail(email) {
    if (!email || typeof email !== 'string') return null;
    const lower = email.toLowerCase().trim();
    // Reject if it contains any seller email fragment
    if (SELLER_EMAILS.some(s => lower.includes(s))) return null;
    // Basic RFC format check
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(lower)) return null;
    return lower;
}

// ── MP client factory ─────────────────────────────────────────────────────────
function getMPClient() {
    const token = process.env.MP_ACCESS_TOKEN;
    if (!token) throw new Error('MP_ACCESS_TOKEN não configurado.');
    return new Payment(new MercadoPagoConfig({
        accessToken: token,
        options: { timeout: 20000 },
    }));
}

// ── Friendly error messages ───────────────────────────────────────────────────
function friendlyError(err) {
    const causes = err?.cause ?? [];
    for (const c of causes) {
        const code = String(c.code ?? '');
        const desc = String(c.description ?? '').toLowerCase();
        if (code === '4390' || desc.includes('forbidden'))
            return 'E-mail do pagador não permitido. Use um e-mail diferente para teste.';
        if (desc.includes('invalid card token') || desc.includes('token'))
            return 'Token do cartão inválido ou expirado. Insira os dados do cartão novamente.';
        if (desc.includes('invalid expiration') || desc.includes('expiration_month'))
            return 'Validade do cartão inválida.';
        if (desc.includes('insufficient amount') || desc.includes('insufficient funds'))
            return 'Saldo insuficiente no cartão.';
        if (desc.includes('security_code') || desc.includes('cvv'))
            return 'CVV inválido.';
        if (desc.includes('blacklist') || desc.includes('high_risk'))
            return 'Pagamento recusado por risco. Tente outro cartão.';
        if (desc.includes('bad_filled'))
            return 'Dados do cartão inválidos. Verifique número, validade e CVV.';
        if (code === '3003' || desc.includes('invalid parameter') || desc.includes('invalid card token'))
            return 'Token do cartão inválido. Insira os dados novamente.';
    }
    const msg = (err?.message ?? '').toLowerCase();
    if (msg.includes('forbidden'))           return 'E-mail do pagador não permitido.';
    if (msg.includes('network') || msg.includes('timeout'))
        return 'Timeout ao conectar ao Mercado Pago. Tente novamente.';
    return err?.message || 'Erro ao processar pagamento. Tente novamente.';
}

// ── Handler ───────────────────────────────────────────────────────────────────
async function createPaymentHandler(req, res) {
    try {
        const {
            payment_method     = 'pix',
            transaction_amount,
            description,
            payer_email,
            payer_name          = '',
            payer_cpf           = '00000000000',
            payment_method_id,   // visa|master|amex|elo|hipercard
            external_reference  = '',
            installments        = 1,
            token,               // MP card token (required for credit_card)
            card_token,          // alias for token (legacy compat)
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

        const safeEmail = sanitiseEmail(payer_email);
        if (!safeEmail) {
            return res.status(400).json({ error: 'payer_email inválido ou não permitido.' });
        }

        const cardToken = token ?? card_token;
        const method    = payment_method === 'credit_card' ? 'credit_card' : 'pix';

        if (method === 'credit_card' && !cardToken) {
            return res.status(400).json({ error: 'Token do cartão ausente para pagamento com cartão.' });
        }

        const nameParts = payer_name.trim().split(/\s+/);
        const firstName = nameParts[0]  || 'Cliente';
        const lastName  = nameParts.slice(1).join(' ') || 'SulMotor';

        // ── Build MP payment body ────────────────────────────────────────────
        const body = {
            transaction_amount: parseFloat(amount.toFixed(2)),
            description:        description.slice(0, 255),
            payment_method_id:  method === 'pix' ? 'pix' : (payment_method_id ?? 'visa'),
            installments:       method === 'pix' ? 1 : (Number(installments) || 1),
            payer: {
                email:      safeEmail,
                first_name: firstName,
                last_name:  lastName,
                identification: {
                    type:   'CPF',
                    number: String(payer_cpf).replace(/\D/g, '') || '00000000000',
                },
            },
            external_reference: String(external_reference),
            notification_url:   process.env.WEBHOOK_URL
                ?? `${process.env.APP_URL ?? 'https://sulmotor.com.br'}/api/webhooks/mercadopago`,
            metadata: {
                source:  'sulmotor',
                service: 'impulsionar',
            },
        };

        // PIX — expiry 30 min
        if (method === 'pix') {
            body.date_of_expiration = new Date(Date.now() + 30 * 60 * 1000).toISOString();
        }

        // Card — attach token
        if (method === 'credit_card') {
            body.token   = cardToken;
            body.capture = true;
            if (issuer_id) body.issuer_id = String(issuer_id);
        }

        const idempotencyKey = `sm-pay-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const mp = getMPClient();

        console.log(`[payments/create] ${method.toUpperCase()} R$${amount} payer=${safeEmail}`);

        const r = await mp.create({ body, requestOptions: { idempotencyKey } });

        const pixData = r.point_of_interaction?.transaction_data ?? {};

        const response = {
            payment_id:     String(r.id),
            status:         r.status,
            status_detail:  r.status_detail,
            // PIX fields (null for card)
            qr_code:        pixData.qr_code         ?? null,
            qr_code_base64: pixData.qr_code_base64  ?? null,
            ticket_url:     pixData.ticket_url       ?? null,
            pix_expiration: r.date_of_expiration     ?? null,
        };

        console.log(`[payments/create] ✅ id=${response.payment_id} status=${response.status} detail=${response.status_detail}`);
        return res.status(201).json(response);

    } catch (err) {
        console.error('[payments/create] ❌ Error:', err?.message);
        if (err?.cause?.length) console.error('[payments/create] Cause:', JSON.stringify(err.cause));
        return res.status(502).json({ error: friendlyError(err) });
    }
}

module.exports = { createPaymentHandler };
