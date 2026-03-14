/**
 * Supabase Edge Function — create-mp-preference
 *
 * Handles three modes depending on the `payment_method` field in the body:
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
 *   Accepts a pre-tokenized card_token (from browser MP SDK) OR raw card fields
 *   for server-side tokenization.
 *   { payment_id, pagamento_id, status, status_detail }
 *
 * Body params (all modes):
 *   anuncio_id, periodo_key, dias, preco, user_id, user_email, carro_desc
 *
 * Extra params for credit_card mode:
 *   card_token, payment_method_id, installments, issuer_id
 *   OR raw: card_number, card_holder_name, card_expiry_month, card_expiry_year, card_cvv
 *
 * Env vars:
 *   MERCADOPAGO_ACCESS_TOKEN  — MP access token (TEST-... or APP_USR-...)
 *   APP_URL                   — public app URL (default: https://sulmotor.com)
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

/**
 * Sanitise payer email:
 * - Must be a valid email
 * - In production (APP_USR-* token), the payer should be a real user email
 * - We never use the seller/owner email as fallback — that causes "Payer email forbidden"
 *   when the payer == seller in the MP account
 */
function sanitisePayerEmail(email: string | undefined | null, mpToken: string): string {
    const trimmed = (email ?? '').trim().toLowerCase();
    // Validate format
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed) && trimmed.length <= 254) {
        return trimmed;
    }
    // If we have a test token, use a known good test email
    if (mpToken.startsWith('TEST-')) {
        return 'test_user_123456789@testuser.com';
    }
    // Production: return a generic placeholder that won't be the seller's email
    // In real use, user_email should always be provided
    return 'pagador@sulmotor.com';
}

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
            // OR pre-tokenized from browser MP SDK (preferred)
            card_token,
            installments = 1,
            payment_method_id,
            issuer_id,
        } = body;

        if (!anuncio_id || !periodo_key || !dias || !preco || !user_id) {
            return json({ error: 'Parâmetros inválidos: anuncio_id, periodo_key, dias, preco e user_id são obrigatórios.' }, 400);
        }

        const mpToken  = Deno.env.get('MERCADOPAGO_ACCESS_TOKEN');
        const baseUrl  = Deno.env.get('APP_URL') ?? 'https://sulmotor.com';
        const sbUrl    = Deno.env.get('SUPABASE_URL') ?? '';
        const sbSvcKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

        const payerEmail = mpToken
            ? sanitisePayerEmail(user_email, mpToken)
            : (user_email ?? 'pagador@sulmotor.com');

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
                if (pagErr) console.warn('[create-mp-preference] pagamentos insert warning:', pagErr.message);
                else pagamentoId = pag?.id ?? null;
            } catch (dbErr) { console.warn('[create-mp-preference] DB client warning:', dbErr); }
        }

        const description = `Impulsionar: ${carro_desc ?? 'Veículo'} — ${String(periodo_key).replace(/_/g, ' ')}`;
        const idempotencyKey = `${anuncio_id}-${periodo_key}-${user_id}-${Date.now()}`;
        const notificationUrl = sbUrl
            ? `${sbUrl}/functions/v1/mp-webhook`
            : `${baseUrl}/api/webhook/mercadopago`;

        // ── 2. MOCK MODE (no MP token configured) ─────────────────────────────
        if (!mpToken) {
            console.warn('[create-mp-preference] MERCADOPAGO_ACCESS_TOKEN not set — using mock response');
            const mockId = pagamentoId ?? crypto.randomUUID();
            if (payment_method === 'pix') {
                return json({
                    payment_id:         'mock-pix-id',
                    pagamento_id:       mockId,
                    status:             'pending',
                    status_detail:      'waiting_transfer',
                    pix_qr_code:        '00020126580014BR.GOV.BCB.PIX0136mock-pix-key-for-testing-only52040000530398654051985802BR5925SulMotor Plataforma000006009SAO PAULO62270523sulmotor-mock-ref-000163042A4E',
                    pix_qr_code_base64: null,
                    pix_expiration:     new Date(Date.now() + 30 * 60 * 1000).toISOString(),
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
                external_reference: pagamentoId ?? String(anuncio_id),
                date_of_expiration: exp.toISOString().replace('Z', '-03:00'),
                notification_url:   notificationUrl,
                metadata: {
                    pagamento_id: pagamentoId ?? '',
                    anuncio_id:   String(anuncio_id),
                    user_id:      String(user_id),
                    periodo_key:  String(periodo_key),
                    dias:         String(dias),
                },
                payer: { email: payerEmail },
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
                console.error('[create-mp-preference] MP PIX error:', JSON.stringify(mpData));
                // Clean up pending record on hard failure
                if (pagamentoId && sbUrl && sbSvcKey) {
                    try {
                        const admin = createClient(sbUrl, sbSvcKey, { auth: { persistSession: false } });
                        await admin.from('pagamentos').delete().eq('id', pagamentoId);
                    } catch (_) { /* ignore */ }
                }
                const cause = (mpData?.cause ?? []) as Array<{ code?: string; description?: string }>;
                const causeMsg = cause[0]?.description ?? mpData?.message ?? 'Erro ao criar pagamento PIX.';
                return json({ error: causeMsg, mp_error: mpData }, 502);
            }

            // Update DB with mp_payment_id
            if (pagamentoId && sbUrl && sbSvcKey) {
                try {
                    const admin = createClient(sbUrl, sbSvcKey, { auth: { persistSession: false } });
                    await admin.from('pagamentos').update({ mp_payment_id: String(mpData.id) }).eq('id', pagamentoId);
                } catch (_) { /* non-fatal */ }
            }

            const pixInfo = mpData.point_of_interaction?.transaction_data ?? {};
            return json({
                payment_id:         mpData.id,
                pagamento_id:       pagamentoId,
                status:             mpData.status,
                status_detail:      mpData.status_detail,
                pix_qr_code:        pixInfo.qr_code         ?? null,
                pix_qr_code_base64: pixInfo.qr_code_base64  ?? null,
                pix_expiration:     mpData.date_of_expiration ?? null,
            });
        }

        // ══════════════════════════════════════════════════════════════════════
        // MODE C — Credit Card payment
        // Accepts either:
        //   (a) card_token — pre-tokenized by browser MP SDK (preferred, more secure)
        //   (b) raw card fields — server tokenizes via /v1/card_tokens
        // ══════════════════════════════════════════════════════════════════════
        if (payment_method === 'credit_card') {
            let resolvedToken: string;

            if (card_token) {
                // Browser already tokenized — use directly
                resolvedToken = String(card_token);
            } else {
                // Server-side tokenization from raw card data
                if (!card_number) return json({ error: 'Dados do cartão ausentes (card_token ou card_number obrigatório).' }, 400);

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
                    console.error('[create-mp-preference] card tokenization error:', JSON.stringify(tokenData));
                    return json({ error: tokenData?.message ?? 'Erro ao tokenizar cartão.', details: tokenData }, 400);
                }
                resolvedToken = tokenData.id;
            }

            // Create payment with token
            const mpBody = {
                transaction_amount: Number(preco),
                description,
                token:              resolvedToken,
                installments:       Number(installments) || 1,
                payment_method_id:  payment_method_id ?? 'visa',
                external_reference: pagamentoId ?? String(anuncio_id),
                notification_url:   notificationUrl,
                capture:            true,
                metadata: {
                    pagamento_id: pagamentoId ?? '',
                    anuncio_id:   String(anuncio_id),
                    user_id:      String(user_id),
                    periodo_key:  String(periodo_key),
                    dias:         String(dias),
                },
                payer: { email: payerEmail },
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
                console.error('[create-mp-preference] MP card payment error:', JSON.stringify(mpData));
                if (pagamentoId && sbUrl && sbSvcKey) {
                    try {
                        const admin = createClient(sbUrl, sbSvcKey, { auth: { persistSession: false } });
                        await admin.from('pagamentos').delete().eq('id', pagamentoId);
                    } catch (_) { /* ignore */ }
                }
                const cause = (mpData?.cause ?? []) as Array<{ code?: string; description?: string }>;
                const causeMsg = cause[0]?.description ?? mpData?.message ?? 'Erro ao processar cartão.';
                return json({ error: causeMsg, mp_error: mpData }, 502);
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
            payer: { email: payerEmail },
            back_urls: {
                success: `${baseUrl}/impulsionar/sucesso?pagamento_id=${pagamentoId ?? ''}&anuncio_id=${anuncio_id}`,
                failure: `${baseUrl}/impulsionar/${anuncio_id}?erro=pagamento_falhou`,
                pending: `${baseUrl}/impulsionar/sucesso?pagamento_id=${pagamentoId ?? ''}&anuncio_id=${anuncio_id}&status=pendente`,
            },
            auto_return:        'approved',
            external_reference: pagamentoId ?? String(anuncio_id),
            notification_url:   notificationUrl,
            expires:            false,
            metadata: {
                pagamento_id: pagamentoId ?? '',
                anuncio_id:   String(anuncio_id),
                user_id:      String(user_id),
                periodo_key:  String(periodo_key),
                dias:         String(dias),
            },
        };

        console.log('[create-mp-preference] Creating preference for', { anuncio_id, periodo_key, preco, payerEmail });

        const mpRes  = await fetch('https://api.mercadopago.com/checkout/preferences', {
            method:  'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization:  `Bearer ${mpToken}`,
            },
            body: JSON.stringify(preferenceBody),
        });
        const mpData = await mpRes.json();

        if (!mpRes.ok) {
            console.error('[create-mp-preference] MP preference error:', JSON.stringify(mpData));
            if (pagamentoId && sbUrl && sbSvcKey) {
                try {
                    const admin = createClient(sbUrl, sbSvcKey, { auth: { persistSession: false } });
                    await admin.from('pagamentos').delete().eq('id', pagamentoId);
                } catch (_) { /* ignore */ }
            }
            return json({
                error: mpData?.message ?? 'Erro ao criar preferência no Mercado Pago.',
                mp_error: mpData,
            }, 502);
        }

        if (pagamentoId && sbUrl && sbSvcKey) {
            try {
                const admin = createClient(sbUrl, sbSvcKey, { auth: { persistSession: false } });
                await admin.from('pagamentos').update({ preference_id: mpData.id }).eq('id', pagamentoId);
            } catch (_) { /* non-fatal */ }
        }

        console.log('[create-mp-preference] ✅ Preference created:', mpData.id);

        return json({
            preference_id:      mpData.id,
            init_point:         mpData.init_point,
            sandbox_init_point: mpData.sandbox_init_point,
            pagamento_id:       pagamentoId,
        });

    } catch (err) {
        console.error('[create-mp-preference] Unexpected error:', err);
        return json({ error: 'Erro interno no servidor. Tente novamente.' }, 500);
    }
});
