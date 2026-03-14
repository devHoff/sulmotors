// supabase/functions/orders/index.ts
// ─────────────────────────────────────────────────────────────────────────────
// SulMotor – Supabase Edge Function: orders
//
// Handles order management:
//   POST /functions/v1/orders/create        — Create pending order
//   GET  /functions/v1/orders/user/list     — List orders for authenticated user
//   GET  /functions/v1/orders/<id>          — Get single order (owner only)
//
// Security:
//   - JWT extracted from Authorization header
//   - Verifies listing belongs to the authenticated user
//   - Cancels any existing pending order for the same listing (dedup)
// ─────────────────────────────────────────────────────────────────────────────

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey",
  "Content-Type":                 "application/json",
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const STATIC_PLANS = [
  { id: "basic_boost",   name: "basic_boost",   label: "Básico",  price: 19.90, duration_days: 7,  priority_level: 1 },
  { id: "premium_boost", name: "premium_boost", label: "Premium", price: 39.90, duration_days: 15, priority_level: 2 },
  { id: "ultra_boost",   name: "ultra_boost",   label: "Ultra",   price: 79.90, duration_days: 30, priority_level: 3 },
];

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: CORS_HEADERS });
}

function getSbAdmin() {
  const url = Deno.env.get("SUPABASE_URL")!;
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SERVICE_KEY")!;
  return createClient(url, key, { auth: { persistSession: false } });
}

function getSbUser(jwt: string) {
  const url = Deno.env.get("SUPABASE_URL")!;
  const key = Deno.env.get("SUPABASE_ANON_KEY")!;
  return createClient(url, key, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
    auth:   { persistSession: false },
  });
}

function extractJWT(req: Request): string | null {
  const auth = req.headers.get("Authorization") ?? "";
  return auth.startsWith("Bearer ") ? auth.slice(7) : null;
}

// ── POST /functions/v1/orders/create ─────────────────────────────────────────
async function handleCreate(req: Request): Promise<Response> {
  const jwt = extractJWT(req);
  if (!jwt) return json({ error: "Autenticação necessária." }, 401);

  const sbUser  = getSbUser(jwt);
  const sbAdmin = getSbAdmin();

  // Get user from JWT
  const { data: { user }, error: userErr } = await sbUser.auth.getUser();
  if (userErr || !user) return json({ error: "Token inválido." }, 401);

  let body: Record<string, unknown>;
  try { body = await req.json(); }
  catch { return json({ error: "JSON inválido." }, 400); }

  const { listing_id, plan_type } = body;

  if (!listing_id || !UUID_RE.test(String(listing_id))) {
    return json({ error: "listing_id inválido." }, 400);
  }

  const validPlans = STATIC_PLANS.map(p => p.name);
  if (!plan_type || !validPlans.includes(String(plan_type))) {
    return json({ error: `plan_type inválido. Use: ${validPlans.join(", ")}` }, 400);
  }

  // Verify listing belongs to user
  const { data: listing, error: listErr } = await sbAdmin
    .from("anuncios")
    .select("id, user_id, marca, modelo, ano")
    .eq("id", String(listing_id))
    .single();

  if (listErr || !listing) return json({ error: "Anúncio não encontrado." }, 404);
  if (listing.user_id !== user.id) return json({ error: "Sem permissão para impulsionar este anúncio." }, 403);

  // Get plan price from DB or fallback
  let plan = STATIC_PLANS.find(p => p.name === plan_type);
  const { data: dbPlans } = await sbAdmin
    .from("boost_plans")
    .select("*")
    .eq("name", String(plan_type))
    .eq("active", true)
    .limit(1);
  if (dbPlans && dbPlans.length > 0) plan = dbPlans[0];

  // Cancel existing pending orders for this listing (prevent duplicates)
  await sbAdmin
    .from("orders")
    .update({ status: "cancelled", updated_at: new Date().toISOString() })
    .eq("user_id", user.id)
    .eq("listing_id", String(listing_id))
    .eq("status", "pending");

  // Create order
  const { data: order, error: orderErr } = await sbAdmin
    .from("orders")
    .insert({
      user_id:    user.id,
      listing_id: String(listing_id),
      plan_type:  String(plan_type),
      amount:     plan!.price,
      currency:   "BRL",
      status:     "pending",
      metadata: {
        plan_label:     plan!.label,
        duration_days:  plan!.duration_days,
        priority_level: plan!.priority_level,
        listing_label:  `${listing.marca} ${listing.modelo} ${listing.ano}`,
      },
    })
    .select()
    .single();

  if (orderErr || !order) {
    console.error("[orders/create] ❌", orderErr?.message);
    return json({ error: "Erro ao criar pedido. Tente novamente." }, 500);
  }

  console.log(`[orders/create] ✅ order=${order.id} user=${user.id} listing=${listing_id} plan=${plan_type}`);

  return json({
    order_id:           order.id,
    external_reference: `${order.id}:${listing_id}`,
    plan:               plan,
    amount:             plan!.price,
    currency:           "BRL",
  }, 201);
}

// ── GET /functions/v1/orders/user/list ───────────────────────────────────────
async function handleList(req: Request): Promise<Response> {
  const jwt = extractJWT(req);
  if (!jwt) return json({ error: "Autenticação necessária." }, 401);

  const sbUser  = getSbUser(jwt);
  const sbAdmin = getSbAdmin();

  const { data: { user }, error: userErr } = await sbUser.auth.getUser();
  if (userErr || !user) return json({ error: "Token inválido." }, 401);

  const { data: orders } = await sbAdmin
    .from("orders")
    .select("*, listing_boosts(*)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  // Enrich with listing data
  const enriched = await Promise.all((orders ?? []).map(async (o) => {
    const { data: listing } = await sbAdmin
      .from("anuncios")
      .select("id, marca, modelo, ano, imagens")
      .eq("id", o.listing_id)
      .single();
    return { ...o, listing: listing ?? null };
  }));

  return json({ orders: enriched });
}

// ── GET /functions/v1/orders/<id> ────────────────────────────────────────────
async function handleGetOne(req: Request, orderId: string): Promise<Response> {
  if (!UUID_RE.test(orderId)) return json({ error: "ID inválido." }, 400);

  const jwt = extractJWT(req);
  if (!jwt) return json({ error: "Autenticação necessária." }, 401);

  const sbUser  = getSbUser(jwt);
  const sbAdmin = getSbAdmin();

  const { data: { user }, error: userErr } = await sbUser.auth.getUser();
  if (userErr || !user) return json({ error: "Token inválido." }, 401);

  const { data: order } = await sbAdmin
    .from("orders")
    .select("*")
    .eq("id", orderId)
    .eq("user_id", user.id)
    .single();

  if (!order) return json({ error: "Pedido não encontrado." }, 404);

  return json({ order });
}

// ── Main handler ──────────────────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }

  const url  = new URL(req.url);
  const path = url.pathname;

  // POST /functions/v1/orders/create
  if (req.method === "POST" && path.endsWith("/create")) {
    return handleCreate(req);
  }

  // GET /functions/v1/orders/user/list
  if (req.method === "GET" && path.endsWith("/user/list")) {
    return handleList(req);
  }

  // GET /functions/v1/orders/<uuid>
  const parts = path.split("/").filter(Boolean);
  const lastPart = parts[parts.length - 1];
  if (req.method === "GET" && UUID_RE.test(lastPart)) {
    return handleGetOne(req, lastPart);
  }

  return json({ error: "Endpoint não encontrado." }, 404);
});
