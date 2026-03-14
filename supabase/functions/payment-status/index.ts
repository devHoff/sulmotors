// supabase/functions/payment-status/index.ts
// ─────────────────────────────────────────────────────────────────────────────
// SulMotor – Supabase Edge Function: payment-status
//
// Polls the status of a Mercado Pago payment (used by CheckoutModal).
//
// GET /functions/v1/payment-status?payment_id=<id>
// or
// GET /functions/v1/payment-status/<payment_id>
//
// Response:
//   payment_id : string
//   status     : string  (pending | approved | rejected | cancelled | refunded | in_process | in_mediation | charged_back)
//   status_detail?: string
//   order_status?: string  (internal DB order status)
// ─────────────────────────────────────────────────────────────────────────────

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey, x-client-info",
  "Content-Type":                 "application/json",
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: CORS_HEADERS });
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }

  if (req.method !== "GET") {
    return json({ error: "Method not allowed" }, 405);
  }

  // ── Env vars ───────────────────────────────────────────────────────────────
  const mpToken     = Deno.env.get("MP_ACCESS_TOKEN");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!mpToken)     return json({ error: "MP_ACCESS_TOKEN não configurado." }, 503);
  if (!supabaseUrl) return json({ error: "SUPABASE_URL não configurado." },     503);
  if (!serviceKey)  return json({ error: "SUPABASE_SERVICE_ROLE_KEY não configurado." }, 503);

  // ── Extract payment_id from URL path or query string ──────────────────────
  const url       = new URL(req.url);
  const pathParts = url.pathname.split("/").filter(Boolean);
  // Path: /functions/v1/payment-status/<payment_id>
  const paymentIdFromPath  = pathParts[pathParts.length - 1];
  const paymentIdFromQuery = url.searchParams.get("payment_id");
  const orderId            = url.searchParams.get("order_id");

  // Determine what to look up
  const mpPaymentId = (paymentIdFromQuery ?? paymentIdFromPath) || null;

  if (!mpPaymentId && !orderId) {
    return json({ error: "Forneça payment_id ou order_id." }, 400);
  }

  // ── Supabase client ────────────────────────────────────────────────────────
  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  });

  // ── If order_id provided, check internal DB status first ──────────────────
  if (orderId) {
    const { data: order } = await supabase
      .from("orders")
      .select("id, status, mercadopago_payment_id")
      .eq("id", orderId)
      .single();

    if (order) {
      if (order.status === "paid") {
        return json({ payment_id: order.mercadopago_payment_id, status: "approved", order_status: "paid" });
      }
      if (["cancelled", "failed", "expired"].includes(order.status)) {
        return json({ payment_id: order.mercadopago_payment_id, status: "rejected", order_status: order.status });
      }
      // If we have a payment ID, check MP directly
      if (order.mercadopago_payment_id) {
        const res = await fetch(`https://api.mercadopago.com/v1/payments/${order.mercadopago_payment_id}`, {
          headers: { "Authorization": `Bearer ${mpToken}` },
        });
        if (res.ok) {
          const data = await res.json() as Record<string, unknown>;
          return json({
            payment_id:    String(data.id),
            status:        data.status,
            status_detail: data.status_detail,
            order_status:  order.status,
          });
        }
      }
      return json({ payment_id: null, status: "pending", order_status: order.status });
    }
    return json({ error: "Pedido não encontrado." }, 404);
  }

  // ── Check internal DB for this payment_id ─────────────────────────────────
  const { data: order } = await supabase
    .from("orders")
    .select("id, status")
    .eq("mercadopago_payment_id", mpPaymentId)
    .single();

  // ── Fetch directly from MP ────────────────────────────────────────────────
  let mpStatus: string | null = null;
  let mpStatusDetail: string | null = null;

  const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${mpPaymentId}`, {
    headers: { "Authorization": `Bearer ${mpToken}` },
  });

  if (mpRes.ok) {
    const mpData = await mpRes.json() as Record<string, unknown>;
    mpStatus       = String(mpData.status       ?? "");
    mpStatusDetail = String(mpData.status_detail ?? "");
  } else if (mpRes.status === 404) {
    // Try as MP order ID
    const mpOrderRes = await fetch(`https://api.mercadopago.com/v1/orders/${mpPaymentId}`, {
      headers: { "Authorization": `Bearer ${mpToken}` },
    });
    if (mpOrderRes.ok) {
      const mpOrderData = await mpOrderRes.json() as Record<string, unknown>;
      const orderStatus = String(mpOrderData.status ?? "");
      mpStatus = orderStatus === "processed" ? "approved" : orderStatus === "cancelled" ? "rejected" : "pending";
    }
  }

  return json({
    payment_id:    mpPaymentId,
    status:        mpStatus ?? "pending",
    status_detail: mpStatusDetail,
    order_status:  order?.status ?? null,
  });
});
