'use strict';

/**
 * api/mercadopago/payments.js
 * POST /api/payments/create
 *
 * Unified Mercado Pago Transparent Checkout endpoint.
 * Handles PIX, credit-card, and boleto payments.
 *
 * Security:
 *   - MP_ACCESS_TOKEN never exposed to frontend
 *   - Input validated and sanitised server-side
 *   - Seller email blocked as payer (MP error 4390 / 2034)
 *   - Idempotency key per request prevents double-charges
 *   - Notification URL always set server-side
 *
 * Body fields:
 *   payment_method      'pix' | 'credit_card' | 'boleto'
 *   transaction_amount  number  (positive, max 2 decimal places)
 *   description         string  (max 255 chars)
 *   payer_email         string
 *   payer_name          string  (optional)
 *   payer_cpf           string  (optional, required for boleto)
 *   payment_method_id   string  (visa|master|amex|elo|hipercard — for card)
 *   external_reference  string  (optional, e.g. "anuncio-id:days")
 *   installments        number  (1 default, for card)
 *   token               string  (MP card token — required for credit_card)
 *   issuer_id           string  (optional, for card)
 *
 * Response:
 *   payment_id, status, status_detail
 *   PIX:    qr_code, qr_code_base64, ticket_url, pix_expiration
 *   Boleto: boleto_url, boleto_barcode, boleto_expiration
 */

const { MercadoPagoConfig, Payment } = require('mercadopago');

// ── Constants ─────────────────────────────────────────────────────────────────
const MAX_AMOUNT        = 50000;   // R$50,000 upper safety cap
const MAX_DESC_LEN      = 255;
const PIX_EXPIRY_MINS   = 30;
const BOLETO_EXPIRY_DAYS = 3;

// ── Seller / merchant account emails ─────────────────────────────────────────
// These emails are associated with the MP merchant account (Leonardo Bandas de
// Oliveira). Mercado Pago forbids the seller from also being the payer — doing
// so triggers error 4390 or 2034 ("Invalid users involved").
// Real buyers will always have different emails, so this list is a safety net
// for when the store owner tests checkout using their own login.
const SELLER_EMAILS = new Set([
    'contato@sulmotor.com',
    'bandasleonardo@gmail.com',
]);

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Validate and sanitise payer email.
 * Returns { email: string } on success or { error: string } on failure.
 */
function sanitiseEmail(email) {
    if (!email || typeof email !== 'string' || !email.trim()) {
        return { error: 'E-mail do pagador é obrigatório. Faça login para continuar.' };
    }
    const lower = email.toLowerCase().trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(lower)) {
        return { error: 'E-mail do pagador inválido. Verifique e tente novamente.' };
    }
    if (SELLER_EMAILS.has(lower)) {
        return { error: 'O e-mail da conta vendedora não pode ser usado como pagador. Use outro e-mail para realizar o pagamento.' };
    }
    return { email: lower };
}

/** Strips all non-digit chars, returns 11-digit CPF string or default. */
function sanitiseCPF(cpf) {
    const digits = String(cpf || '').replace(/\D/g, '');
    return digits.length >= 11 ? digits.slice(0, 11) : '00000000000';
}

/** Strips all non-digit chars from CNPJ. */
function sanitiseCNPJ(doc) {
    return String(doc || '').replace(/\D/g, '').slice(0, 14);
}

/** Creates and returns a Payment client with the server-side access token. */
function getMPClient() {
    const token = process.env.MP_ACCESS_TOKEN;
    if (!token) throw new Error('MP_ACCESS_TOKEN não configurado no servidor.');
    return new Payment(new MercadoPagoConfig({
        accessToken: token,
        options: { timeout: 20000 },
    }));
}

/** Translates MP cause codes / descriptions into user-friendly Portuguese. */
function friendlyError(err) {
    const causes = err?.cause ?? [];
    for (const c of causes) {
        const code = String(c.code ?? '');
        const desc = String(c.description ?? '').toLowerCase();

        if (code === '4390' || code === '2034' || desc.includes('forbidden') || desc.includes('invalid users'))
            return 'O e-mail do pagador não pode ser o mesmo da conta do vendedor. Use outro e-mail.';
        if (desc.includes('invalid card token') || code === '3003')
            return 'Token do cartão inválido ou expirado. Insira os dados novamente.';
        if (desc.includes('invalid expiration') || desc.includes('expiration_month'))
            return 'Validade do cartão inválida.';
        if (desc.includes('insufficient amount') || desc.includes('insufficient funds'))
            return 'Saldo insuficiente no cartão.';
        if (desc.includes('security_code') || desc.includes('cvv'))
            return 'CVV do cartão inválido.';
        if (desc.includes('blacklist') || desc.includes('high_risk'))
            return 'Pagamento recusado por segurança. Tente outro cartão.';
        if (desc.includes('bad_filled'))
            return 'Dados do cartão inválidos. Verifique número, validade e CVV.';
        if (desc.includes('invalid parameter'))
            return 'Parâmetro inválido. Verifique os dados e tente novamente.';
    }
    const msg = (err?.message ?? '').toLowerCase();
    if (msg.includes('invalid users'))      return 'E-mail do pagador inválido para este pagamento.';
    if (msg.includes('forbidden'))          return 'Acesso negado. Verifique seu e-mail.';
    if (msg.includes('network') || msg.includes('timeout'))
        return 'Timeout ao conectar ao Mercado Pago. Tente novamente em instantes.';
    // Return raw message only if it is a safe string (not internal stack traces)
    if (typeof err?.message === 'string' && err.message.length < 200)
        return err.message;
    return 'Erro ao processar pagamento. Tente novamente.';
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
            payer_cpf,
            payer_doc_type,      // 'CPF' | 'CNPJ'
            payment_method_id,   // visa|master|amex|elo|hipercard — for card
            external_reference  = '',
            installments        = 1,
            token,               // MP card token (required for credit_card)
            card_token,          // legacy alias for token
            issuer_id,
        } = req.body ?? {};

        // ── Amount validation ────────────────────────────────────────────────
        const amount = parseFloat(transaction_amount);
        if (!amount || isNaN(amount) || amount <= 0) {
            return res.status(400).json({ error: 'transaction_amount inválido ou ausente.' });
        }
        if (amount > MAX_AMOUNT) {
            return res.status(400).json({ error: `transaction_amount não pode exceder R$${MAX_AMOUNT.toFixed(2)}.` });
        }

        // ── Description validation ───────────────────────────────────────────
        if (!description || typeof description !== 'string' || !description.trim()) {
            return res.status(400).json({ error: 'description ausente.' });
        }

        // ── Payer email validation ───────────────────────────────────────────
        const emailResult = sanitiseEmail(payer_email);
        if (emailResult.error) {
            return res.status(400).json({ error: emailResult.error });
        }
        const safeEmail = emailResult.email;

        // ── Method normalisation ─────────────────────────────────────────────
        const method = ['credit_card', 'boleto'].includes(payment_method)
            ? payment_method
            : 'pix';

        // Card-specific validation
        const cardToken = token ?? card_token;
        if (method === 'credit_card' && !cardToken) {
            return res.status(400).json({ error: 'Token do cartão ausente para pagamento com cartão.' });
        }

        // Boleto requires CPF/CNPJ for Brazilian compliance
        const docDigits = payer_cpf
            ? String(payer_cpf).replace(/\D/g, '')
            : '';
        const docType = payer_doc_type === 'CNPJ' || docDigits.length === 14
            ? 'CNPJ'
            : 'CPF';
        const docNumber = docType === 'CNPJ'
            ? sanitiseCNPJ(payer_cpf)
            : sanitiseCPF(payer_cpf);

        // ── Name parsing ─────────────────────────────────────────────────────
        const nameParts = (payer_name ?? '').trim().split(/\s+/);
        const firstName = nameParts[0]  || 'Cliente';
        const lastName  = nameParts.slice(1).join(' ') || 'SulMotor';

        // ── Build MP request body ────────────────────────────────────────────
        const body = {
            transaction_amount: parseFloat(amount.toFixed(2)),
            description:        description.trim().slice(0, MAX_DESC_LEN),
            installments:       method === 'credit_card' ? (Number(installments) || 1) : 1,
            payer: {
                email:      safeEmail,
                first_name: firstName.slice(0, 60),
                last_name:  lastName.slice(0, 60),
                identification: {
                    type:   docType,
                    number: docNumber,
                },
            },
            external_reference: String(external_reference).slice(0, 256),
            // Webhook URL: always set server-side, never from client
            notification_url: process.env.WEBHOOK_URL
                ?? `${process.env.APP_URL ?? 'https://sulmotor.com.br'}/api/webhooks/mercadopago`,
            metadata: {
                source:  'sulmotor',
                service: 'impulsionar',
                version: '2',
            },
        };

        // ── Method-specific fields ───────────────────────────────────────────
        if (method === 'pix') {
            body.payment_method_id = 'pix';
            body.date_of_expiration = new Date(
                Date.now() + PIX_EXPIRY_MINS * 60 * 1000
            ).toISOString();
        } else if (method === 'credit_card') {
            body.payment_method_id = payment_method_id ?? 'visa';
            body.token   = cardToken;
            body.capture = true;
            if (issuer_id) body.issuer_id = String(issuer_id);
        } else if (method === 'boleto') {
            body.payment_method_id = 'bolbradesco';  // boleto via Bradesco (most common)
            const exp = new Date();
            exp.setDate(exp.getDate() + BOLETO_EXPIRY_DAYS);
            body.date_of_expiration = exp.toISOString();
            // Boleto requires full address for Brazilian regulation
            if (req.body.payer_address) {
                body.payer.address = {
                    zip_code:     String(req.body.payer_address.zip_code    ?? '').replace(/\D/g, ''),
                    street_name:  String(req.body.payer_address.street_name  ?? 'Rua não informada').slice(0, 100),
                    street_number:String(req.body.payer_address.street_number ?? '0'),
                    neighborhood: String(req.body.payer_address.neighborhood  ?? '').slice(0, 80),
                    city:         String(req.body.payer_address.city           ?? 'Não informado').slice(0, 60),
                    federal_unit: String(req.body.payer_address.federal_unit   ?? 'SC').toUpperCase().slice(0, 2),
                };
            }
        }

        // ── Create payment ───────────────────────────────────────────────────
        const idempotencyKey = `sm-pay-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
        const mp = getMPClient();

        console.log(`[payments/create] method=${method} amount=R$${amount} payer=${safeEmail} ref="${external_reference}"`);

        const r = await mp.create({ body, requestOptions: { idempotencyKey } });

        // ── Build response ───────────────────────────────────────────────────
        const pixData    = r.point_of_interaction?.transaction_data ?? {};
        const boletoData = r.transaction_details ?? {};

        const response = {
            payment_id:    String(r.id),
            status:        r.status,
            status_detail: r.status_detail,
            // PIX fields (null for card/boleto)
            qr_code:           pixData.qr_code         ?? null,
            qr_code_base64:    pixData.qr_code_base64  ?? null,
            ticket_url:        pixData.ticket_url       ?? r.transaction_details?.external_resource_url ?? null,
            pix_expiration:    method === 'pix' ? (r.date_of_expiration ?? null) : null,
            // Boleto fields (null for card/pix)
            boleto_url:        method === 'boleto' ? (boletoData.external_resource_url ?? null) : null,
            boleto_barcode:    method === 'boleto' ? (r.barcode?.content ?? null)               : null,
            boleto_expiration: method === 'boleto' ? (r.date_of_expiration ?? null)              : null,
        };

        console.log(`[payments/create] ✅ id=${response.payment_id} status=${response.status} detail=${response.status_detail}`);
        return res.status(201).json(response);

    } catch (err) {
        console.error('[payments/create] ❌', err?.message);
        if (err?.cause?.length) {
            console.error('[payments/create] cause:', JSON.stringify(err.cause));
        }
        return res.status(502).json({ error: friendlyError(err) });
    }
}

module.exports = { createPaymentHandler };
