/**
 * Supabase Edge Function — create-mp-payment
 *
 * Creates a Mercado Pago payment directly (not a preference/redirect).
 * Supports PIX and credit card payments, returning results inline.
 *
 * Receiver: SulMotor (Leonardo Bandas De Oliveira)
 * MP Account: APP_USR-7239440808267582-031221-...-2697630578
 *
 * PIX response includes:
 *   { payment_id, status, pix_qr_code, pix_qr_code_base64, pix_expiration }
 *
 * Credit card response includes:
 *   { payment_id, status, status_detail }
 *
 * Body params:
 *   payment_method: 'pix' | 'credit_card'
 *   anuncio_id, user_id, user_email, periodo_key, dias, preco, carro_desc
 *   -- credit card only:
 *   card_token, installments, issuer_id, payment_method_id
 *
 * Env vars (set in Supabase Dashboard → Project Settings → Edge Functions → Secrets):
 *   MERCADOPAGO_ACCESS_TOKEN  — APP_USR-7239440808267582-...-2697630578
 *   SUPABASE_URL              (auto-injected)
 *   SUPABASE_SERVICE_ROLE_KEY (auto-injected)
 *   APP_URL                   (optional, default https://sulmotor.com.br)
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = {
    'Access-Control-Allow-Origin':  '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
        status,
        headers: { ...cors, 'Content-Type': 'application/json' },
    });

// ── MP token resolution ───────────────────────────────────────────────────────
// Primary:  Supabase secret MERCADOPAGO_ACCESS_TOKEN (set via dashboard or CLI)
// Fallback: hardcoded production token for SulMotor (Leonardo Bandas De Oliveira)
//           This token belongs to the MP account that will RECEIVE the payments.
const SULMOTOR_MP_TOKEN = 'APP_USR-7239440808267582-031221-15802be9b3427f5b9e1e29d49413ed02-2697630578';

function getMpToken(): string {
    return Deno.env.get('MERCADOPAGO_ACCESS_TOKEN') || SULMOTOR_MP_TOKEN;
}

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

    try {
        const body = await req.json();
        const {
            payment_method = 'pix',   // 'pix' | 'credit_card'
            anuncio_id,
            user_id,
            user_email,
            periodo_key,
            dias,
            preco,
            carro_desc,
            // credit card: either pass a pre-tokenized card_token OR raw card data
            card_token,               // pre-tokenized (optional)
            card_number,              // raw (server-side tokenization)
            card_holder_name,
            card_expiry_month,
            card_expiry_year,
            card_cvv,
            installments = 1,
            issuer_id,
            payment_method_id,        // e.g. 'visa', 'master'
        } = body;

        if (!anuncio_id || !user_id || !preco || !periodo_key) {
            return json({ error: 'Parâmetros obrigatórios ausentes.' }, 400);
        }

        const mpToken = getMpToken();
        const sbUrl   = Deno.env.get('SUPABASE_URL') ?? '';
        const sbKey   = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
        const baseUrl = Deno.env.get('APP_URL') ?? 'https://sulmotor.com.br';

        // ── Payer email sanitisation ──────────────────────────────────────────
        // The payer is the BUYER (customer), NOT the seller (SulMotor).
        // Never use the seller's email here or MP may reject the payment.
        const rawEmail   = (user_email ?? '').trim().toLowerCase();
        const payerEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawEmail)
            ? rawEmail
            : 'comprador@sulmotor.com.br';

        // ── 1. Register pending pagamento in DB (best-effort) ─────────────────
        let pagamentoId: string | null = null;
        if (sbUrl && sbKey) {
            try {
                const admin = createClient(sbUrl, sbKey, { auth: { persistSession: false } });
                const { data, error } = await admin
                    .from('pagamentos')
                    .insert({
                        anuncio_id,
                        user_id,
                        periodo_key,
                        dias:   Number(dias),
                        valor:  Number(preco),
                        status: 'pendente',
                    })
                    .select('id')
                    .single();
                if (error) console.warn('DB insert warn:', error.message);
                else pagamentoId = data?.id ?? null;
            } catch (e) { console.warn('DB warn:', e); }
        }

        // ── 2. Build Mercado Pago payment payload ─────────────────────────────
        // Use a timestamp+anuncio key to allow retries without idempotency conflicts
        const idempotencyKey = `sulmotor-${anuncio_id}-${periodo_key}-${Date.now()}`;

        // deno-lint-ignore no-explicit-any
        const mpBody: Record<string, any> = {
            transaction_amount: Number(preco),
            description: `SulMotor – Impulsionar: ${carro_desc ?? 'Veículo'} (${String(periodo_key).replace(/_/g, ' ')})`,
            external_reference: pagamentoId ?? anuncio_id,
            notification_url:   sbUrl
                ? `${sbUrl}/functions/v1/mp-webhook`
                : `${baseUrl}/api/mp-webhook`,
            metadata: {
                pagamento_id: pagamentoId ?? '',
                anuncio_id,
                user_id,
                periodo_key,
                dias: String(dias),
                plataforma: 'sulmotor',
            },
            // Payer info (buyer / customer)
            payer: {
                email: payerEmail,
            },
        };

        if (payment_method === 'pix') {
            mpBody.payment_method_id = 'pix';
            // PIX expires in 30 minutes (MP requires ISO-8601 with timezone offset)
            const exp = new Date(Date.now() + 30 * 60 * 1000);
            // Use UTC-3 (Brasília time) as required by MP Brazil
            mpBody.date_of_expiration = exp.toISOString().replace('Z', '-03:00');

        } else if (payment_method === 'credit_card') {
            // ── Server-side tokenization if raw card data provided ────────────
            let resolvedToken = card_token;
            if (!resolvedToken && card_number) {
                const tokenRes = await fetch('https://api.mercadopago.com/v1/card_tokens', {
                    method: 'POST',
                    headers: {
                        'Content-Type':  'application/json',
                        'Authorization': `Bearer ${mpToken}`,
                    },
                    body: JSON.stringify({
                        card_number:       String(card_number).replace(/\s/g, ''),
                        cardholder: {
                            name:           card_holder_name ?? '',
                            identification: { type: 'CPF', number: '00000000000' },
                        },
                        expiration_month: Number(card_expiry_month),
                        expiration_year:  Number(card_expiry_year),
                        security_code:    String(card_cvv),
                    }),
                });
                const tokenData = await tokenRes.json();
                if (!tokenRes.ok || !tokenData.id) {
                    return json({
                        error: tokenData?.message ?? 'Erro ao tokenizar cartão.',
                        details: tokenData,
                    }, 400);
                }
                resolvedToken = tokenData.id;
            }
            if (!resolvedToken) return json({ error: 'Dados do cartão ausentes.' }, 400);

            mpBody.token             = resolvedToken;
            mpBody.payment_method_id = payment_method_id ?? 'visa';
            mpBody.installments      = Number(installments);
            if (issuer_id) mpBody.issuer_id = String(issuer_id);

        } else {
            return json({ error: 'Método de pagamento inválido. Use pix ou credit_card.' }, 400);
        }

        // ── 3. Call MP Payments API ───────────────────────────────────────────
        console.log(`[create-mp-payment] Creating ${payment_method} payment of R$${preco} for anuncio ${anuncio_id}`);

        const mpRes = await fetch('https://api.mercadopago.com/v1/payments', {
            method: 'POST',
            headers: {
                'Content-Type':      'application/json',
                'Authorization':     `Bearer ${mpToken}`,
                'X-Idempotency-Key': idempotencyKey,
            },
            body: JSON.stringify(mpBody),
        });

        const mpData = await mpRes.json();

        if (!mpRes.ok) {
            console.error('[create-mp-payment] MP API error:', JSON.stringify(mpData));
            // Clean up pending DB record on MP failure
            if (pagamentoId && sbUrl && sbKey) {
                try {
                    const admin = createClient(sbUrl, sbKey, { auth: { persistSession: false } });
                    await admin.from('pagamentos').delete().eq('id', pagamentoId);
                } catch (_) { /* ignore */ }
            }
            return json({
                error:   mpData?.message ?? 'Erro ao criar pagamento no Mercado Pago.',
                details: mpData,
            }, 502);
        }

        // ── 4. Update DB with mp_payment_id + status ──────────────────────────
        if (pagamentoId && sbUrl && sbKey) {
            try {
                const admin = createClient(sbUrl, sbKey, { auth: { persistSession: false } });
                await admin.from('pagamentos').update({
                    mp_payment_id: String(mpData.id),
                    status:        mpData.status === 'approved' ? 'approved' : 'pendente',
                }).eq('id', pagamentoId);
            } catch (_) { /* non-fatal */ }
        }

        // ── 5. Build response ─────────────────────────────────────────────────
        // PIX QR data lives inside point_of_interaction.transaction_data
        const pixInfo = mpData.point_of_interaction?.transaction_data;

        console.log(`[create-mp-payment] Payment created: id=${mpData.id} status=${mpData.status}`);

        return json({
            payment_id:         mpData.id,
            pagamento_id:       pagamentoId,
            status:             mpData.status,        // 'pending' | 'approved' | 'rejected'
            status_detail:      mpData.status_detail,
            // PIX fields (present when payment_method_id === 'pix')
            pix_qr_code:        pixInfo?.qr_code        ?? null,
            pix_qr_code_base64: pixInfo?.qr_code_base64 ?? null,
            pix_expiration:     mpData.date_of_expiration ?? null,
            // Boleto / ticket (not used for PIX but kept for future boleto support)
            ticket_url:         mpData.transaction_details?.external_resource_url ?? null,
            // Card fields
            last_four_digits:   mpData.card?.last_four_digits ?? null,
        });

    } catch (err) {
        console.error('[create-mp-payment] Unexpected error:', err);
        return json({ error: 'Erro interno no servidor.' }, 500);
    }
});
