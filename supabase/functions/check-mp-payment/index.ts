/**
 * Supabase Edge Function — check-mp-payment
 *
 * Polls Mercado Pago for the current status of a payment.
 * Called by the frontend every 5 seconds while showing the PIX QR code.
 *
 * MP Account: SulMotor (Leonardo Bandas De Oliveira)
 *
 * Body: { mp_payment_id: string | number }
 * Returns: { status: 'pending'|'approved'|'rejected'|'cancelled', status_detail: string }
 */

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

// SulMotor production MP access token (Leonardo Bandas De Oliveira)
const SULMOTOR_MP_TOKEN = 'APP_USR-7239440808267582-031221-15802be9b3427f5b9e1e29d49413ed02-2697630578';

function getMpToken(): string {
    return Deno.env.get('MERCADOPAGO_ACCESS_TOKEN') || SULMOTOR_MP_TOKEN;
}

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

    try {
        const body = await req.json().catch(() => ({}));
        const mpPaymentId = body?.mp_payment_id;

        if (!mpPaymentId) {
            return json({ error: 'mp_payment_id obrigatório.' }, 400);
        }

        const mpToken = getMpToken();

        const res = await fetch(`https://api.mercadopago.com/v1/payments/${mpPaymentId}`, {
            headers: {
                'Authorization': `Bearer ${mpToken}`,
                'Content-Type':  'application/json',
            },
        });

        const data = await res.json();

        if (!res.ok) {
            console.error(`[check-mp-payment] MP API error for payment ${mpPaymentId}:`, data?.message);
            return json({ error: data?.message ?? 'Erro ao verificar pagamento.' }, 502);
        }

        console.log(`[check-mp-payment] payment ${mpPaymentId} → status=${data.status}`);

        return json({
            status:        data.status,         // 'pending' | 'approved' | 'rejected' | 'cancelled'
            status_detail: data.status_detail,
        });

    } catch (err) {
        console.error('[check-mp-payment] Unexpected error:', err);
        return json({ error: 'Erro interno.' }, 500);
    }
});
