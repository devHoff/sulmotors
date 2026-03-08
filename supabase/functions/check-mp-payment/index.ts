/**
 * Supabase Edge Function — check-mp-payment
 *
 * Polls Mercado Pago for the current status of a payment.
 * Called by the frontend every few seconds while showing the PIX QR code.
 *
 * Body: { mp_payment_id: string }
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

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

    try {
        const { mp_payment_id } = await req.json();
        if (!mp_payment_id) return json({ error: 'mp_payment_id obrigatório.' }, 400);

        const mpToken = Deno.env.get('MERCADOPAGO_ACCESS_TOKEN');
        if (!mpToken) {
            // Mock: simulate approval after a few seconds
            return json({ status: 'pending', status_detail: 'waiting_transfer', _mock: true });
        }

        const res = await fetch(`https://api.mercadopago.com/v1/payments/${mp_payment_id}`, {
            headers: { Authorization: `Bearer ${mpToken}` },
        });

        const data = await res.json();
        if (!res.ok) return json({ error: data?.message ?? 'Erro ao verificar pagamento.' }, 502);

        return json({
            status:        data.status,
            status_detail: data.status_detail,
        });

    } catch (err) {
        console.error('check-mp-payment error:', err);
        return json({ error: 'Erro interno.' }, 500);
    }
});
