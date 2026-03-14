// supabase/functions/create-payment/index.ts
// ─────────────────────────────────────────────────────────────────────────────
// SulMotor – Supabase Edge Function: create-payment
//
// Creates a Mercado Pago Order (Orders API v1) and persists an `orders` row.
//
// POST body (JSON):
//   listing_id         : string  (UUID of the anuncio)
//   plan_type          : 'basic' | 'premium' | 'ultra'
//   amount             : number  (BRL, must match plan price)
//   payer_email        : string
//   payer_name?        : string
//   payment_method?    : 'pix' (default) | 'credit_card' | 'boleto'
//   external_reference?: string  (optional override; auto-generated if omitted)
//
// Response:
//   order_id           : string  (internal UUID)
//   mp_order_id        : string  (Mercado Pago order ID)
//   payment_id         : string | null
//   status             : string  (waiting_payment | …)
//   qr_code            : string | null  (PIX copia-e-cola)
//   qr_code_base64     : string | null  (PIX QR image)
//   ticket_url         : string | null
//   pix_expiration     : string | null
//
// Security:
//   MP_ACCESS_TOKEN is read only from Deno.env — never exposed client-side.
//   SUPABASE_SERVICE_ROLE_KEY used for DB writes (bypasses RLS).
// ─────────────────────────────────────────────────────────────────────────────

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ── Constants ─────────────────────────────────────────────────────────────────
const MP_ORDERS_API = "https://api.mercadopago.com/v1/orders";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey, x-client-info",
  "Content-Type":                 "application/json",
};

// Boost durations (days)
const BOOST_DURATION: Record<string, number> = {
  basic:   7,
  premium: 15,
  ultra:   30,
};

// Boost prices (BRL) — kept in sync with boost_plans table
const BOOST_PRICES: Record<string, number> = {
  basic:   29.90,
  premium: 59.90,
  ultra:   99.90,
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: CORS_HEADERS });
}

function pixExpiry(minutes = 30): string {
  return new Date(Date.now() + minutes * 60_000).toISOString();
}

function idempotencyKey(prefix: string, ref: string): string {
  return `${prefix}-${ref}-${Date.now()}`;
}

// ── Build Mercado Pago Orders API payload ─────────────────────────────────────
// Docs: https://www.mercadopago.com.br/developers/pt/reference/mp_purchase_order/_orders/post
function buildMpOrderBody(opts: {
  amount:             number;
  payerEmail:         string;
  payerName:          string;
  externalReference:  string;
  description:        string;
  paymentMethod:      string;
}) {
  const { amount, payerEmail, payerName, externalReference, description, paymentMethod } = opts;

  // Only PIX supported via Orders API in Brazil for this flow
  // Credit-card and boleto fall back to Payments API
  const body: Record<string, unknown> = {
    type:           "online",
    total_amount:   amount,
    external_reference: externalReference,
    payer: {
      email:      payerEmail,
      first_name: payerName.split(" ")[0] || "Cliente",
      last_name:  payerName.split(" ").slice(1).join(" ") || "SulMotor",
    },
    transactions: {
      payments: [
        {
          amount,
          payment_method: {
            id:   paymentMethod === "pix" ? "pix" : paymentMethod,
            type: paymentMethod === "pix" ? "bank_transfer" : "credit_card",
          },
          description,
        },
      ],
    },
  };

  return body;
}

// ── Create PIX via Orders API ──────────────────────────────────────────────────
async function createOrderViaMpOrdersAPI(
  opts: {
    amount:            number;
    payerEmail:        string;
    payerName:         string;
    externalReference: string;
    description:       string;
    paymentMethod:     string;
  },
  mpToken: string
): Promise<{
  mp_order_id:    string;
  payment_id:     string | null;
  status:         string;
  qr_code:        string | null;
  qr_code_base64: string | null;
  ticket_url:     string | null;
  pix_expiration: string | null;
}> {
  const payload = buildMpOrderBody(opts);

  const res = await fetch(MP_ORDERS_API, {
    method:  "POST",
    headers: {
      "Authorization":     `Bearer ${mpToken}`,
      "Content-Type":      "application/json",
      "X-Idempotency-Key": idempotencyKey("order", opts.externalReference),
    },
    body: JSON.stringify(payload),
  });

  const raw = await res.text();
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new Error(`MP Orders API returned non-JSON: ${raw.slice(0, 200)}`);
  }

  if (!res.ok) {
    const cause = (data?.message as string) ?? (data?.error as string) ?? `MP Orders API ${res.status}`;
    throw new Error(cause);
  }

  // Extract PIX data from nested transactions.payments[0]
  const payments  = (data?.transactions as Record<string, unknown>)?.payments as unknown[];
  const payment   = (payments?.[0] ?? {}) as Record<string, unknown>;
  const payId     = payment.id ? String(payment.id) : null;
  const txData    = (payment?.payment_method as Record<string, unknown>)?.transaction_data as Record<string, unknown> | undefined;

  // Some MP accounts return pix_data at payment level
  const pixData   = (payment?.pix_data ?? txData) as Record<string, unknown> | undefined;

  const qrCode        = (pixData?.qr_code       ?? pixData?.qr_code_text)  as string | null ?? null;
  const qrCodeBase64  = (pixData?.qr_code_base64 ?? pixData?.image_base64) as string | null ?? null;
  const ticketUrl     = (pixData?.ticket_url     ?? payment?.ticket_url)    as string | null ?? null;

  return {
    mp_order_id:    String(data.id),
    payment_id:     payId,
    status:         (data.status as string) ?? "waiting_payment",
    qr_code:        qrCode,
    qr_code_base64: qrCodeBase64,
    ticket_url:     ticketUrl,
    pix_expiration: pixExpiry(30),
  };
}

// ── Fallback: create PIX via classic Payments API ────────────────────────────
// Used if Orders API is unavailable or returns unexpected structure
async function createPixViaPaymentsAPI(
  opts: {
    amount:            number;
    payerEmail:        string;
    payerName:         string;
    externalReference: string;
    description:       string;
  },
  mpToken: string
): Promise<{
  mp_order_id:    string;
  payment_id:     string | null;
  status:         string;
  qr_code:        string | null;
  qr_code_base64: string | null;
  ticket_url:     string | null;
  pix_expiration: string | null;
}> {
  const payload = {
    transaction_amount: opts.amount,
    description:        opts.description,
    payment_method_id:  "pix",
    payer: {
      email:      opts.payerEmail,
      first_name: opts.payerName.split(" ")[0] || "Cliente",
    },
    external_reference:  opts.externalReference,
    date_of_expiration:  pixExpiry(30),
  };

  const res = await fetch("https://api.mercadopago.com/v1/payments", {
    method:  "POST",
    headers: {
      "Authorization":     `Bearer ${mpToken}`,
      "Content-Type":      "application/json",
      "X-Idempotency-Key": idempotencyKey("pix", opts.externalReference),
    },
    body: JSON.stringify(payload),
  });

  const data = await res.json() as Record<string, unknown>;

  if (!res.ok) {
    const cause = (data?.cause as Array<{description?: string}>)?.[0]?.description
                ?? (data?.message as string)
                ?? `MP Payments API ${res.status}`;
    throw new Error(cause);
  }

  const pix = (data?.point_of_interaction as Record<string, unknown>)?.transaction_data as Record<string, unknown> | undefined;

  return {
    mp_order_id:    String(data.id),  // use payment ID as pseudo-order ID
    payment_id:     String(data.id),
    status:         (data.status as string) ?? "pending",
    qr_code:        (pix?.qr_code as string) ?? null,
    qr_code_base64: (pix?.qr_code_base64 as string) ?? null,
    ticket_url:     (pix?.ticket_url as string) ?? null,
    pix_expiration: (data.date_of_expiration as string) ?? null,
  };
}

// ── Main handler ──────────────────────────────────────────────────────────────
serve(async (req: Request) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  // ── Env vars ───────────────────────────────────────────────────────────────
  const mpToken       = Deno.env.get("MP_ACCESS_TOKEN");
  const supabaseUrl   = Deno.env.get("SUPABASE_URL");
  const serviceKey    = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!mpToken)     return json({ error: "MP_ACCESS_TOKEN não configurado." },    503);
  if (!supabaseUrl) return json({ error: "SUPABASE_URL não configurado." },        503);
  if (!serviceKey)  return json({ error: "SUPABASE_SERVICE_ROLE_KEY não configurado." }, 503);

  // ── Parse body ─────────────────────────────────────────────────────────────
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: "JSON inválido." }, 400);
  }

  const listingId     = body.listing_id     ? String(body.listing_id)   : null;
  const planType      = String(body.plan_type     ?? "basic").toLowerCase();
  const payerEmail    = String(body.payer_email   ?? "").trim();
  const payerName     = String(body.payer_name    ?? "Cliente SulMotor").trim();
  const paymentMethod = String(body.payment_method ?? "pix").toLowerCase();
  const rawAmount     = Number(body.amount ?? 0);

  // ── Validation ─────────────────────────────────────────────────────────────
  if (!listingId) {
    return json({ error: "listing_id é obrigatório." }, 400);
  }
  if (!["basic","premium","ultra"].includes(planType)) {
    return json({ error: "plan_type inválido. Use: basic, premium ou ultra." }, 400);
  }
  if (!payerEmail || !payerEmail.includes("@")) {
    return json({ error: "payer_email inválido." }, 400);
  }

  // Use plan price; validate submitted amount within tolerance (R$0.01)
  const planPrice = BOOST_PRICES[planType];
  const amount    = rawAmount > 0 ? rawAmount : planPrice;

  if (Math.abs(amount - planPrice) > 0.02) {
    return json({
      error: `Valor inválido para o plano ${planType}. Esperado: R$ ${planPrice.toFixed(2)}.`,
    }, 400);
  }

  // ── Extract user from JWT (optional — allows anon if listing exists) ───────
  let userId: string | null = null;
  const authHeader = req.headers.get("Authorization");
  if (authHeader?.startsWith("Bearer ")) {
    try {
      const supabase = createClient(supabaseUrl, serviceKey);
      const { data: { user } } = await supabase.auth.getUser(authHeader.slice(7));
      userId = user?.id ?? null;
    } catch { /* non-fatal */ }
  }

  // ── Create Supabase client (service role for DB writes) ───────────────────
  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  });

  // ── Verify listing exists ─────────────────────────────────────────────────
  const { data: listing, error: listingErr } = await supabase
    .from("anuncios")
    .select("id, titulo, user_id")
    .eq("id", listingId)
    .single();

  if (listingErr || !listing) {
    return json({ error: "Anúncio não encontrado." }, 404);
  }

  // ── Cancel any open pending orders for this listing ───────────────────────
  await supabase
    .from("orders")
    .update({ status: "cancelled", updated_at: new Date().toISOString() })
    .eq("listing_id", listingId)
    .in("status", ["pending", "waiting_payment"]);

  // ── Build external reference ───────────────────────────────────────────────
  const extRef = String(body.external_reference ?? `sulmot-${listingId.slice(0, 8)}-${Date.now()}`);
  const description = `SulMotor – Impulsionar Anúncio (${planType})`;

  // ── Create order in DB ────────────────────────────────────────────────────
  const { data: order, error: orderErr } = await supabase
    .from("orders")
    .insert({
      user_id:            userId ?? listing.user_id,
      listing_id:         listingId,
      amount,
      status:             "waiting_payment",
      payment_method:     paymentMethod,
      plan_type:          planType,
      external_reference: extRef,
      metadata: {
        payer_email: payerEmail,
        payer_name:  payerName,
        description,
        plan_type:   planType,
        duration_days: BOOST_DURATION[planType],
      },
    })
    .select("id")
    .single();

  if (orderErr || !order) {
    console.error("[create-payment] DB insert error:", orderErr);
    return json({ error: "Erro ao criar pedido interno." }, 500);
  }

  console.log(`[create-payment] order created id=${order.id} plan=${planType} amount=${amount} method=${paymentMethod}`);

  // ── Call Mercado Pago ─────────────────────────────────────────────────────
  let mpResult: Awaited<ReturnType<typeof createOrderViaMpOrdersAPI>>;

  try {
    if (paymentMethod === "pix" || paymentMethod === "bank_transfer") {
      // Try Orders API first
      try {
        mpResult = await createOrderViaMpOrdersAPI(
          { amount, payerEmail, payerName, externalReference: extRef, description, paymentMethod: "pix" },
          mpToken
        );
        // Validate we actually got PIX data
        if (!mpResult.qr_code && !mpResult.qr_code_base64) {
          throw new Error("Orders API returned no PIX QR data — falling back");
        }
      } catch (ordersErr) {
        console.warn(`[create-payment] Orders API failed: ${ordersErr}. Falling back to Payments API.`);
        mpResult = await createPixViaPaymentsAPI(
          { amount, payerEmail, payerName, externalReference: extRef, description },
          mpToken
        );
      }
    } else {
      // For non-PIX methods, use Payments API directly
      mpResult = await createPixViaPaymentsAPI(
        { amount, payerEmail, payerName, externalReference: extRef, description },
        mpToken
      );
    }
  } catch (mpErr: unknown) {
    const msg = mpErr instanceof Error ? mpErr.message : String(mpErr);
    console.error(`[create-payment] ❌ MP error: ${msg}`);

    // Mark order as failed
    await supabase
      .from("orders")
      .update({ status: "failed", updated_at: new Date().toISOString() })
      .eq("id", order.id);

    return json({ error: `Erro ao processar pagamento: ${msg}` }, 502);
  }

  // ── Update order with MP IDs ──────────────────────────────────────────────
  await supabase
    .from("orders")
    .update({
      mercadopago_order_id:   mpResult.mp_order_id,
      mercadopago_payment_id: mpResult.payment_id,
      updated_at:             new Date().toISOString(),
    })
    .eq("id", order.id);

  console.log(`[create-payment] ✅ mp_order=${mpResult.mp_order_id} payment=${mpResult.payment_id} status=${mpResult.status}`);

  // ── Return response ───────────────────────────────────────────────────────
  return json({
    order_id:       order.id,
    mp_order_id:    mpResult.mp_order_id,
    payment_id:     mpResult.payment_id,
    status:         mpResult.status,
    qr_code:        mpResult.qr_code,
    qr_code_base64: mpResult.qr_code_base64,
    ticket_url:     mpResult.ticket_url,
    pix_expiration: mpResult.pix_expiration,
    // Legacy field aliases for CheckoutModal compatibility
    external_reference: extRef,
  });
});
