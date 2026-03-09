/**
 * Supabase Edge Function — create-mp-preference
 *
 * Handles two modes depending on the `payment_method` field in the body:
 *
 * MODE A — preference/redirect (payment_method omitted or 'redirect'):
 *   Creates a Mercado Pago Checkout Preference and returns init_point URLs.
 *   { preference_id, init_point, sandbox_init_point, pagamento_id }
 *
 * MODE B — PIX direct payment (payment_method = 'pix'):
 *   Creates a Mercado Pago Payment with payment_method_id='pix' and
 *   returns the PIX QR code + copy-paste code inline.
 *   { payment_id, pagamento_id, status, pix_qr_code, pix_qr_code_base64, pix_expiration }
 *
 * MODE C — credit card (payment_method = 'credit_card'):
 *   Tokenizes the raw card data via /v1/card_tokens then creates a Payment.
 *   { payment_id, pagamento_id, status, status_detail }
 *
 * Body params (all modes):
 *   anuncio_id, periodo_key, dias, preco, user_id, user_email, carro_desc
 *
 * Extra params for credit_card mode:
 *   card_number, card_holder_name, card_expiry_month, card_expiry_year,
 *   card_cvv, installments, payment_method_id, issuer_id
 *
 * Env vars:
 *   MERCADOPAGO_ACCESS_TOKEN  — MP access token (TEST-... or APP_USR-...)
 *   APP_URL                   — public app URL (default: https://sulmotors.com.br)
 *   SUPABASE_URL              — auto-injected
 *   SUPABASE_SERVICE_ROLE_KEY — auto-injected
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
        status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

    try {
        const body = await req.json();
        const {
            payment_method = 'redirect', // 'redirect' | 'pix' | 'credit_card'
            anuncio_id,
            periodo_key,
            dias,
            preco,
            user_id,
            user_email,
            carro_desc,
            // credit card fields (raw — server tokenizes)
            card_number,
            card_holder_name,
            card_expiry_month,
            card_expiry_year,
            card_cvv,
            // OR pre-tokenized from browser MP SDK
            card_token,
            installments = 1,
            payment_method_id,
            issuer_id,
        } = body;

        if (!anuncio_id || !periodo_key || !dias || !preco || !user_id) {
            return json({ error: 'Parâmetros inválidos.' }, 400);
        }

        const mpToken  = Deno.env.get('MERCADOPAGO_ACCESS_TOKEN');
        const baseUrl  = Deno.env.get('APP_URL') ?? 'https://sulmotor.com.br';
        const sbUrl    = Deno.env.get('SUPABASE_URL') ?? '';
        const sbSvcKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

        // ── 1. Register pending pagamento in DB (best-effort) ─────────────────
        let pagamentoId: string | null = null;
        if (sbUrl && sbSvcKey) {
            try {
                const admin = createClient(sbUrl, sbSvcKey, { auth: { persistSession: false } });
                const { data: pag, error: pagErr } = await admin
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
                if (pagErr) console.warn('pagamentos insert warning:', pagErr.message);
                else pagamentoId = pag?.id ?? null;
            } catch (dbErr) { console.warn('DB client warning:', dbErr); }
        }

        const description = `Impulsionar: ${carro_desc ?? 'Veículo'} — ${String(periodo_key).replace(/_/g, ' ')}`;
        const idempotencyKey = `${anuncio_id}-${periodo_key}-${user_id}-${Date.now()}`;

        // ── 2. MOCK MODE (no MP token) ─────────────────────────────────────────
        if (!mpToken) {
            const mockId = pagamentoId ?? crypto.randomUUID();
            if (payment_method === 'pix') {
                return json({
                    payment_id:        'mock-pix-id',
                    pagamento_id:      mockId,
                    status:            'pending',
                    status_detail:     'waiting_transfer',
                    pix_qr_code:       '00020126580014BR.GOV.BCB.PIX0136mock-pix-key-for-testing-only52040000530398654051985802BR5925SulMotor Plataforma000006009SAO PAULO62270523sulmotor-mock-ref-000163042A4E',
                    pix_qr_code_base64: null,
                    pix_expiration:    new Date(Date.now() + 30 * 60 * 1000).toISOString(),
                    _mock: true,
                });
            }
            if (payment_method === 'credit_card') {
                return json({
                    payment_id:    'mock-card-id',
                    pagamento_id:  mockId,
                    status:        'approved',
                    status_detail: 'accredited',
                    _mock: true,
                });
            }
            // redirect mock
            return json({
                preference_id:      'mock-preference-id',
                init_point:         `${baseUrl}/impulsionar/sucesso?pagamento_id=${mockId}&anuncio_id=${anuncio_id}&status=pendente`,
                sandbox_init_point: `${baseUrl}/impulsionar/sucesso?pagamento_id=${mockId}&anuncio_id=${anuncio_id}&status=pendente`,
                pagamento_id:       mockId,
                _mock: true,
            });
        }

        // ══════════════════════════════════════════════════════════════════════
        // MODE B — PIX direct payment
        // ══════════════════════════════════════════════════════════════════════
        if (payment_method === 'pix') {
            const exp = new Date(Date.now() + 30 * 60 * 1000);
            const mpBody = {
                transaction_amount: Number(preco),
                description,
                payment_method_id:  'pix',
                external_reference: pagamentoId ?? anuncio_id,
                date_of_expiration: exp.toISOString().replace('Z', '-03:00'),
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
                console.error('MP Payments PIX error:', JSON.stringify(mpData));
                if (pagamentoId && sbUrl && sbSvcKey) {
                    try {
                        const admin = createClient(sbUrl, sbSvcKey, { auth: { persistSession: false } });
                        await admin.from('pagamentos').delete().eq('id', pagamentoId);
                    } catch (_) { /* ignore */ }
                }
                return json({ error: mpData?.message ?? 'Erro ao criar pagamento PIX.', details: mpData }, 502);
            }

            // Update DB with mp_payment_id
            if (pagamentoId && sbUrl && sbSvcKey) {
                try {
                    const admin = createClient(sbUrl, sbSvcKey, { auth: { persistSession: false } });
                    await admin.from('pagamentos').update({ mp_payment_id: String(mpData.id) }).eq('id', pagamentoId);
                } catch (_) { /* non-fatal */ }
            }

            const pixInfo = mpData.point_of_interaction?.transaction_data;
            return json({
                payment_id:         mpData.id,
                pagamento_id:       pagamentoId,
                status:             mpData.status,
                status_detail:      mpData.status_detail,
                pix_qr_code:        pixInfo?.qr_code        ?? null,
                pix_qr_code_base64: pixInfo?.qr_code_base64 ?? null,
                pix_expiration:     mpData.date_of_expiration ?? null,
            });
        }

        // ══════════════════════════════════════════════════════════════════════
        // MODE C — Credit Card payment
        // Accepts either:
        //   (a) card_token — pre-tokenized by browser MP SDK (preferred)
        //   (b) raw card fields — server tokenizes via /v1/card_tokens
        // ══════════════════════════════════════════════════════════════════════
        if (payment_method === 'credit_card') {
            // Step 1: Get or create card token
            let resolvedToken: string;

            if (card_token) {
                // Browser already tokenized — use directly
                resolvedToken = String(card_token);
            } else {
                // Server-side tokenization from raw card data
                if (!card_number) return json({ error: 'Dados do cartão ausentes.' }, 400);

                const tokenRes = await fetch('https://api.mercadopago.com/v1/card_tokens', {
                    method: 'POST',
                    headers: {
                        'Content-Type':  'application/json',
                        'Authorization': `Bearer ${mpToken}`,
                    },
                    body: JSON.stringify({
                        card_number:      String(card_number).replace(/\s/g, ''),
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
                    return json({ error: tokenData?.message ?? 'Erro ao tokenizar cartão.', details: tokenData }, 400);
                }
                resolvedToken = tokenData.id;
            }

            // Step 2: Create payment with token
            const mpBody = {
                transaction_amount: Number(preco),
                description,
                token:              resolvedToken,
                installments:       Number(installments),
                payment_method_id:  payment_method_id ?? 'visa',
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
                ...(issuer_id ? { issuer_id: String(issuer_id) } : {}),
            };

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
                console.error('MP Payments card error:', JSON.stringify(mpData));
                if (pagamentoId && sbUrl && sbSvcKey) {
                    try {
                        const admin = createClient(sbUrl, sbSvcKey, { auth: { persistSession: false } });
                        await admin.from('pagamentos').delete().eq('id', pagamentoId);
                    } catch (_) { /* ignore */ }
                }
                return json({ error: mpData?.message ?? 'Erro ao processar cartão.', details: mpData }, 502);
            }

            if (pagamentoId && sbUrl && sbSvcKey) {
                try {
                    const admin = createClient(sbUrl, sbSvcKey, { auth: { persistSession: false } });
                    await admin.from('pagamentos').update({
                        mp_payment_id: String(mpData.id),
                        status: mpData.status === 'approved' ? 'approved' : 'pendente',
                    }).eq('id', pagamentoId);
                } catch (_) { /* non-fatal */ }
            }

            return json({
                payment_id:    mpData.id,
                pagamento_id:  pagamentoId,
                status:        mpData.status,
                status_detail: mpData.status_detail,
            });
        }

        // ══════════════════════════════════════════════════════════════════════
        // MODE A — Checkout Preference (redirect)
        // ══════════════════════════════════════════════════════════════════════
        const preferenceBody = {
            items: [{
                id:          `boost-${anuncio_id}`,
                title:       `Impulsionar Anúncio — ${carro_desc ?? 'Veículo'} (${String(periodo_key).replace(/_/g, ' ')})`,
                quantity:    1,
                unit_price:  Number(preco),
                currency_id: 'BRL',
                category_id: 'services',
            }],
            payer: { email: user_email || 'comprador@sulmotors.com.br' },
            back_urls: {
                success: `${baseUrl}/impulsionar/sucesso?pagamento_id=${pagamentoId ?? ''}&anuncio_id=${anuncio_id}`,
                failure: `${baseUrl}/impulsionar/${anuncio_id}?erro=pagamento_falhou`,
                pending: `${baseUrl}/impulsionar/sucesso?pagamento_id=${pagamentoId ?? ''}&anuncio_id=${anuncio_id}&status=pendente`,
            },
            auto_return:        'approved',
            external_reference: pagamentoId ?? anuncio_id,
            notification_url:   sbUrl ? `${sbUrl}/functions/v1/mp-webhook` : undefined,
            expires:            false,
            metadata: {
                pagamento_id: pagamentoId ?? '',
                anuncio_id,
                user_id,
                periodo_key,
                dias: String(dias),
            },
        };

        const mpRes  = await fetch('https://api.mercadopago.com/checkout/preferences', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${mpToken}` },
            body: JSON.stringify(preferenceBody),
        });
        const mpData = await mpRes.json();

        if (!mpRes.ok) {
            console.error('MP Preference error:', JSON.stringify(mpData));
            if (pagamentoId && sbUrl && sbSvcKey) {
                try {
                    const admin = createClient(sbUrl, sbSvcKey, { auth: { persistSession: false } });
                    await admin.from('pagamentos').delete().eq('id', pagamentoId);
                } catch (_) { /* ignore */ }
            }
            return json({ error: 'Erro ao criar preferência no Mercado Pago.', details: mpData }, 502);
        }

        if (pagamentoId && sbUrl && sbSvcKey) {
            try {
                const admin = createClient(sbUrl, sbSvcKey, { auth: { persistSession: false } });
                await admin.from('pagamentos').update({ preference_id: mpData.id }).eq('id', pagamentoId);
            } catch (_) { /* non-fatal */ }
        }

        return json({
            preference_id:      mpData.id,
            init_point:         mpData.init_point,
            sandbox_init_point: mpData.sandbox_init_point,
            pagamento_id:       pagamentoId,
        });

    } catch (err) {
        console.error('Unexpected error in create-mp-preference:', err);
        return json({ error: 'Erro interno no servidor.' }, 500);
    }
});
