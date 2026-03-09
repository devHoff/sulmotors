/**
 * Supabase Edge Function — create-mp-payment
 *
 * Creates a Mercado Pago payment directly (not a preference/redirect).
 * Supports PIX and credit card payments, returning results inline.
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
 *   MERCADOPAGO_ACCESS_TOKEN
 *   SUPABASE_URL              (auto-injected)
 *   SUPABASE_SERVICE_ROLE_KEY (auto-injected)
 *   APP_URL                   (optional, default https://sulmotors.com.br)
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

        const mpToken  = Deno.env.get('MERCADOPAGO_ACCESS_TOKEN');
        const sbUrl    = Deno.env.get('SUPABASE_URL') ?? '';
        const sbKey    = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
        const baseUrl  = Deno.env.get('APP_URL') ?? 'https://sulmotor.com.br';

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

        // ── 2. Mock mode when no MP token configured ──────────────────────────
        if (!mpToken) {
            const mockId = pagamentoId ?? crypto.randomUUID();
            // Return a test PIX QR (real-looking placeholder)
            if (payment_method === 'pix') {
                return json({
                    payment_id:        'mock-pix-id',
                    pagamento_id:      mockId,
                    status:            'pending',
                    status_detail:     'waiting_transfer',
                    pix_qr_code:       '00020126580014BR.GOV.BCB.PIX0136mock-pix-key-for-testing-only52040000530398654051985802BR5925SulMotor Plataforma000006009SAO PAULO62270523sulmotor-mock-ref-000163042A4E',
                    pix_qr_code_base64: '',
                    pix_expiration:    new Date(Date.now() + 30 * 60 * 1000).toISOString(),
                    _mock:             true,
                });
            }
            return json({
                payment_id:    'mock-card-id',
                pagamento_id:  mockId,
                status:        'approved',
                status_detail: 'accredited',
                _mock:         true,
            });
        }

        // ── 3. Build Mercado Pago payment payload ─────────────────────────────
        const idempotencyKey = `${anuncio_id}-${periodo_key}-${Date.now()}`;

        // deno-lint-ignore no-explicit-any
        const mpBody: Record<string, any> = {
            transaction_amount: Number(preco),
            description: `Impulsionar: ${carro_desc ?? 'Veículo'} — ${String(periodo_key).replace(/_/g, ' ')}`,
            external_reference: pagamentoId ?? anuncio_id,
            notification_url:   sbUrl ? `${sbUrl}/functions/v1/mp-webhook` : `${baseUrl}/api/mp-webhook`,
            metadata: {
                pagamento_id: pagamentoId ?? '',
                anuncio_id,
                user_id,
                periodo_key,
                dias: String(dias),
            },
            payer: { email: user_email || 'comprador@sulmotors.com.br' },
        };

        if (payment_method === 'pix') {
            mpBody.payment_method_id = 'pix';
            // PIX expires in 30 minutes
            const exp = new Date(Date.now() + 30 * 60 * 1000);
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
            mpBody.token           = resolvedToken;
            mpBody.payment_method_id = payment_method_id ?? 'visa';
            mpBody.installments    = Number(installments);
            if (issuer_id) mpBody.issuer_id = String(issuer_id);
        } else {
            return json({ error: 'Método de pagamento inválido.' }, 400);
        }

        // ── 4. Call MP Payments API ───────────────────────────────────────────
        const mpRes = await fetch('https://api.mercadopago.com/v1/payments', {
            method: 'POST',
            headers: {
                'Content-Type':     'application/json',
                'Authorization':    `Bearer ${mpToken}`,
                'X-Idempotency-Key': idempotencyKey,
            },
            body: JSON.stringify(mpBody),
        });

        const mpData = await mpRes.json();

        if (!mpRes.ok) {
            console.error('MP Payments error:', JSON.stringify(mpData));
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

        // ── 5. Update DB with mp_payment_id + status ──────────────────────────
        if (pagamentoId && sbUrl && sbKey) {
            try {
                const admin = createClient(sbUrl, sbKey, { auth: { persistSession: false } });
                await admin.from('pagamentos').update({
                    mp_payment_id: String(mpData.id),
                    status:        mpData.status === 'approved' ? 'approved' : 'pendente',
                }).eq('id', pagamentoId);
            } catch (_) { /* non-fatal */ }
        }

        // ── 6. Build response ─────────────────────────────────────────────────
        const pixInfo = mpData.point_of_interaction?.transaction_data;

        return json({
            payment_id:         mpData.id,
            pagamento_id:       pagamentoId,
            status:             mpData.status,          // 'pending' | 'approved' | 'rejected'
            status_detail:      mpData.status_detail,
            // PIX fields (only present when payment_method_id === 'pix')
            pix_qr_code:        pixInfo?.qr_code        ?? null,
            pix_qr_code_base64: pixInfo?.qr_code_base64 ?? null,
            pix_expiration:     mpData.date_of_expiration ?? null,
            // Card fields
            last_four_digits:   mpData.card?.last_four_digits ?? null,
        });

    } catch (err) {
        console.error('Unexpected error in create-mp-payment:', err);
        return json({ error: 'Erro interno no servidor.' }, 500);
    }
});
