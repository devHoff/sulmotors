// supabase/functions/expire-boosts/index.ts
// ─────────────────────────────────────────────────────────────────────────────
// SulMotor – Supabase Edge Function: expire-boosts
//
// Called by Supabase Scheduled Jobs (or externally with secret) every 10 min.
// Executes the SQL function expire_boosts() to deactivate expired boosts.
//
// Also optionally runs expire_pending_orders() when ?job=expire_orders is set.
//
// Request:
//   POST /functions/v1/expire-boosts
//   Headers: x-cron-secret: <CRON_SECRET_KEY>
//
// Response:
//   { success: true, expired_boosts: <n>, expired_orders?: <n> }
// ─────────────────────────────────────────────────────────────────────────────

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey, x-cron-secret",
  "Content-Type":                 "application/json",
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: CORS_HEADERS });
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }

  // ── Auth: require cron secret ──────────────────────────────────────────────
  const cronSecret  = Deno.env.get("CRON_SECRET_KEY");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceKey) {
    return json({ error: "Supabase env vars not configured." }, 503);
  }

  // Validate secret (required unless CRON_SECRET_KEY is not set)
  if (cronSecret) {
    const provided = req.headers.get("x-cron-secret")
                  ?? req.headers.get("authorization")?.replace("Bearer ", "");
    if (provided !== cronSecret) {
      console.warn("[expire-boosts] Unauthorized request");
      return json({ error: "Unauthorized" }, 403);
    }
  }

  // ── Run expire_boosts() ────────────────────────────────────────────────────
  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  });

  const url        = new URL(req.url);
  const runOrders  = url.searchParams.get("job") === "expire_orders";

  let expiredBoosts = 0;
  let expiredOrders: number | undefined;

  // Run expire_boosts
  const { data: boostsResult, error: boostsErr } = await supabase
    .rpc("expire_boosts");

  if (boostsErr) {
    console.error("[expire-boosts] expire_boosts() error:", boostsErr);
    return json({ success: false, error: boostsErr.message }, 500);
  }

  expiredBoosts = Number(boostsResult ?? 0);
  console.log(`[expire-boosts] ✅ expired_boosts=${expiredBoosts} at ${new Date().toISOString()}`);

  // Log analytics event
  if (expiredBoosts > 0) {
    await supabase.from("analytics_events").insert({
      event_type:  "boost_expired",
      event_data:  { expired_count: expiredBoosts },
      created_at:  new Date().toISOString(),
    }).then(() => {}).catch(() => {});
  }

  // Optionally run expire_pending_orders
  if (runOrders) {
    const { data: ordersResult, error: ordersErr } = await supabase
      .rpc("expire_pending_orders");

    if (!ordersErr) {
      expiredOrders = Number(ordersResult ?? 0);
      console.log(`[expire-boosts] ✅ expired_orders=${expiredOrders}`);
    }
  }

  return json({
    success:         true,
    expired_boosts:  expiredBoosts,
    expired_orders:  expiredOrders,
    timestamp:       new Date().toISOString(),
  });
});
