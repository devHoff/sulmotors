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
// Never use the seller/merchant MP account email as payer – that causes error 4390.
// If the payer IS the seller (e.g. store owner testing their own listing),
// substitute a safe fallback. In production, real user emails always pass through.
//
// All emails listed here belong to the MP merchant account (Leonardo Bandas de Oliveira).
const SELLER_EMAILS = [
    'contato@sulmotor.com',
    'bandasleonardo@gmail.com',
    // Add any other MP merchant account emails here if needed
];

function sanitiseEmail(email) {
    if (!email || typeof email !== 'string') return null;
    const lower = email.toLowerCase().trim();
    // Basic RFC format check
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(lower)) return null;
    // If it matches a seller/merchant email, return null so we can inform the user
    if (SELLER_EMAILS.some(s => lower === s.toLowerCase())) return null;
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
            return 'E-mail do pagador não permitido. Use um e-mail diferente para o pagamento.';
        if (code === '2034' || desc.includes('invalid users involved') || desc.includes('invalid users'))
            return 'E-mail do pagador não pode ser o mesmo da conta do vendedor. Use outro e-mail.';
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
    if (msg.includes('invalid users involved')) return 'E-mail do pagador inválido para este pagamento.';
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

        // sanitiseEmail returns null for seller/invalid emails
        const safeEmail = sanitiseEmail(payer_email);
        if (!safeEmail) {
            // If payer IS the store owner (merchant account email), reject gracefully
            // Logged-in store owners should not be able to pay themselves (MP rule)
            return res.status(400).json({
                error: 'Este e-mail não pode ser usado como pagador. Por favor, use outro e-mail para realizar o pagamento.',
            });
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
