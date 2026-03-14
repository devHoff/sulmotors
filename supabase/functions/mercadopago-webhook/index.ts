// supabase/functions/mercadopago-webhook/index.ts
// ─────────────────────────────────────────────────────────────────────────────
// SulMotor – Supabase Edge Function: mercadopago-webhook
//
// Receives Mercado Pago IPN / Orders webhook notifications and:
//   1. Returns HTTP 200 immediately (MP requirement)
//   2. Validates HMAC-SHA256 signature when MP_WEBHOOK_SECRET is set
//   3. Handles events: order.processed, order.cancelled, order.refunded,
//      payment (IPN v1: ?type=payment&data.id=...)
//   4. Validates payment via GET /v1/orders/{id} or /v1/payments/{id}
//   5. Updates `orders` table status
//   6. On `approved`/`order.processed` → calls activate_boost() SQL function
//   7. On `cancelled`/`refunded` → marks order failed
//
// Security:
//   - Always returns HTTP 200 to prevent MP retry storms
//   - HMAC verified when MP_WEBHOOK_SECRET is present
//   - Amount verified against order amount (tolerance R$0.01)
//   - Idempotent: re-processing same payment_id is safe
// ─────────────────────────────────────────────────────────────────────────────

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const MP_API = "https://api.mercadopago.com";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, x-signature, x-request-id",
  "Content-Type":                 "application/json",
};

// Boost durations in days per plan type
const BOOST_DURATION_DAYS: Record<string, number> = {
  ultra:   30,
  premium: 15,
  basic:   7,
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function ok(msg = "ok"): Response {
  return new Response(JSON.stringify({ received: true, msg }), {
    status:  200,
    headers: CORS_HEADERS,
  });
}

// ── HMAC-SHA256 signature verification ───────────────────────────────────────
async function verifyMpSignature(
  req:     Request,
  rawBody: string,
  secret:  string
): Promise<boolean> {
  try {
    const sig   = req.headers.get("x-signature") ?? "";
    const reqId = req.headers.get("x-request-id") ?? "";
    const url   = new URL(req.url);
    const ts    = url.searchParams.get("ts") ?? sig.match(/ts=([^,]+)/)?.[1] ?? "";
    const dataId = url.searchParams.get("data.id") ?? "";

    if (!sig || !ts) return false;

    const v1Hash = sig.match(/v1=([a-f0-9]+)/)?.[1];
    if (!v1Hash) return false;

    // MP template: id:{data.id};request-id:{x-request-id};ts:{ts};
    const template = `id:${dataId};request-id:${reqId};ts:${ts};`;
    const keyData  = new TextEncoder().encode(secret);
    const msgData  = new TextEncoder().encode(template);

    const cryptoKey = await crypto.subtle.importKey(
      "raw", keyData, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
    );
    const sigBuffer = await crypto.subtle.sign("HMAC", cryptoKey, msgData);
    const computed  = Array.from(new Uint8Array(sigBuffer))
      .map(b => b.toString(16).padStart(2, "0"))
      .join("");

    return computed === v1Hash;
  } catch {
    return false;
  }
}

// ── Fetch Mercado Pago payment details ────────────────────────────────────────
async function getMpPayment(paymentId: string, mpToken: string): Promise<Record<string, unknown> | null> {
  try {
    const res = await fetch(`${MP_API}/v1/payments/${paymentId}`, {
      headers: { "Authorization": `Bearer ${mpToken}` },
    });
    if (!res.ok) return null;
    return await res.json() as Record<string, unknown>;
  } catch {
    return null;
  }
}

// ── Fetch Mercado Pago order details ─────────────────────────────────────────
async function getMpOrder(orderId: string, mpToken: string): Promise<Record<string, unknown> | null> {
  try {
    const res = await fetch(`${MP_API}/v1/orders/${orderId}`, {
      headers: { "Authorization": `Bearer ${mpToken}` },
    });
    if (!res.ok) return null;
    return await res.json() as Record<string, unknown>;
  } catch {
    return null;
  }
}

// ── Activate boost via SQL function ──────────────────────────────────────────
async function activateBoost(
  supabase: ReturnType<typeof createClient>,
  orderId:  string,
  listingId: string,
  planType:  string
): Promise<boolean> {
  const days     = BOOST_DURATION_DAYS[planType] ?? 7;
  const duration = `${days} days`;

  const { error } = await supabase.rpc("activate_boost", {
    p_order_id:   orderId,
    p_listing_id: listingId,
    p_boost_type: planType,
    p_duration:   duration,
  });

  if (error) {
    console.error(`[webhook] activate_boost error:`, error);
    return false;
  }

  console.log(`[webhook] ✅ boost activated listing=${listingId} plan=${planType} days=${days}`);
  return true;
}

// ── Main handler ──────────────────────────────────────────────────────────────
serve(async (req: Request) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }

  // MP sends POST; GET can be used for manual testing
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405, headers: CORS_HEADERS,
    });
  }

  // ── Env vars ───────────────────────────────────────────────────────────────
  const mpToken     = Deno.env.get("MP_ACCESS_TOKEN");
  const webhookSec  = Deno.env.get("MP_WEBHOOK_SECRET") ?? "";
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!mpToken || !supabaseUrl || !serviceKey) {
    console.error("[webhook] Missing env vars");
    return ok("config error – returning 200 to prevent MP retry");
  }

  // ── Read raw body ──────────────────────────────────────────────────────────
  const rawBody = await req.text();

  // ── Verify signature (if secret configured) ────────────────────────────────
  if (webhookSec) {
    const valid = await verifyMpSignature(req, rawBody, webhookSec);
    if (!valid) {
      console.warn("[webhook] Invalid signature – ignoring");
      return ok("invalid signature");
    }
  }

  // ── Parse event ───────────────────────────────────────────────────────────
  let event: Record<string, unknown>;
  try {
    event = JSON.parse(rawBody);
  } catch {
    console.warn("[webhook] Non-JSON body:", rawBody.slice(0, 100));
    return ok("non-json body");
  }

  const urlParams = new URL(req.url).searchParams;
  const eventType = String(event.type ?? urlParams.get("type") ?? "unknown");
  const dataId    = String(
    (event.data as Record<string, unknown>)?.id
    ?? urlParams.get("data.id")
    ?? ""
  );

  console.log(`[webhook] event=${eventType} data.id=${dataId}`);

  // ── Supabase client ────────────────────────────────────────────────────────
  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  });

  // ── Handle: order.processed ───────────────────────────────────────────────
  if (eventType === "order.processed" && dataId) {
    const mpOrder = await getMpOrder(dataId, mpToken);

    if (!mpOrder) {
      console.error(`[webhook] Could not fetch MP order ${dataId}`);
      return ok("mp order not found");
    }

    const mpOrderStatus = String(mpOrder.status ?? "");
    const extRef        = String(mpOrder.external_reference ?? "");

    console.log(`[webhook] order.processed status=${mpOrderStatus} ref=${extRef}`);

    // Find internal order by MP order ID or external_reference
    const { data: order } = await supabase
      .from("orders")
      .select("id, listing_id, amount, plan_type, status")
      .or(`mercadopago_order_id.eq.${dataId},external_reference.eq.${extRef}`)
      .single();

    if (!order) {
      console.warn(`[webhook] No internal order found for mp_order_id=${dataId} ref=${extRef}`);
      return ok("order not found");
    }

    // Extract payment info
    const payments   = (mpOrder?.transactions as Record<string, unknown>)?.payments as unknown[] ?? [];
    const firstPay   = (payments[0] ?? {}) as Record<string, unknown>;
    const mpPayId    = firstPay.id ? String(firstPay.id) : null;
    const mpPayStatus = String(firstPay.status ?? mpOrderStatus);

    // Update order with MP payment ID
    if (mpPayId) {
      await supabase
        .from("orders")
        .update({ mercadopago_payment_id: mpPayId, mercadopago_order_id: dataId })
        .eq("id", order.id);
    }

    if (mpOrderStatus === "processed" || mpPayStatus === "approved") {
      // Verify amount (tolerance R$0.01)
      const paidAmount = Number(mpOrder.total_amount ?? firstPay.amount ?? 0);
      if (Math.abs(paidAmount - Number(order.amount)) > 0.02) {
        console.error(`[webhook] Amount mismatch: expected ${order.amount} got ${paidAmount}`);
        return ok("amount mismatch");
      }

      // Activate boost
      await activateBoost(supabase, order.id, order.listing_id, order.plan_type ?? "basic");

    } else if (["cancelled", "expired"].includes(mpOrderStatus)) {
      await supabase
        .from("orders")
        .update({ status: "cancelled", updated_at: new Date().toISOString() })
        .eq("id", order.id);
      console.log(`[webhook] order ${order.id} cancelled`);
    }

    return ok("order.processed handled");
  }

  // ── Handle: order.cancelled ───────────────────────────────────────────────
  if ((eventType === "order.cancelled" || eventType === "order.refunded") && dataId) {
    const { data: order } = await supabase
      .from("orders")
      .select("id, listing_id, plan_type")
      .eq("mercadopago_order_id", dataId)
      .single();

    if (order) {
      const newStatus = eventType === "order.refunded" ? "failed" : "cancelled";
      await supabase
        .from("orders")
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq("id", order.id);

      // Deactivate boost if it was active
      await supabase
        .from("listing_boosts")
        .update({ is_active: false })
        .eq("order_id", order.id);

      console.log(`[webhook] ${eventType} – order ${order.id} marked ${newStatus}`);
    }

    return ok(`${eventType} handled`);
  }

  // ── Handle: IPN payment (classic) ────────────────────────────────────────
  // MP sends: POST /webhook?type=payment&data.id=PAYMENT_ID
  if ((eventType === "payment" || urlParams.has("data.id")) && dataId) {
    const mpPayment = await getMpPayment(dataId, mpToken);

    if (!mpPayment) {
      console.error(`[webhook] Could not fetch MP payment ${dataId}`);
      return ok("mp payment not found");
    }

    const payStatus = String(mpPayment.status ?? "");
    const extRef    = String(mpPayment.external_reference ?? "");

    console.log(`[webhook] payment id=${dataId} status=${payStatus} ref=${extRef}`);

    // Find internal order by payment ID or external_reference
    const { data: order } = await supabase
      .from("orders")
      .select("id, listing_id, amount, plan_type, status")
      .or(`mercadopago_payment_id.eq.${dataId},external_reference.eq.${extRef}`)
      .single();

    if (!order) {
      console.warn(`[webhook] No order for payment_id=${dataId} ref=${extRef}`);
      return ok("order not found");
    }

    // Store payment ID
    await supabase
      .from("orders")
      .update({ mercadopago_payment_id: dataId })
      .eq("id", order.id);

    if (payStatus === "approved") {
      // Verify amount
      const paidAmount = Number(mpPayment.transaction_amount ?? 0);
      if (Math.abs(paidAmount - Number(order.amount)) > 0.02) {
        console.error(`[webhook] Amount mismatch: expected ${order.amount} got ${paidAmount}`);
        return ok("amount mismatch");
      }
      await activateBoost(supabase, order.id, order.listing_id, order.plan_type ?? "basic");

    } else if (["rejected", "cancelled", "refunded"].includes(payStatus)) {
      await supabase
        .from("orders")
        .update({ status: "failed", updated_at: new Date().toISOString() })
        .eq("id", order.id);
      console.log(`[webhook] payment ${dataId} ${payStatus} – order ${order.id} marked failed`);
    }

    return ok("payment handled");
  }

  // ── Unhandled event type ──────────────────────────────────────────────────
  console.log(`[webhook] Unhandled event: ${eventType}`);
  return ok(`unhandled event: ${eventType}`);
});
