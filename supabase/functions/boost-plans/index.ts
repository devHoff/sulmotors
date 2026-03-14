// supabase/functions/boost-plans/index.ts
// ─────────────────────────────────────────────────────────────────────────────
// SulMotor – Supabase Edge Function: boost-plans
//
// Returns the list of available boost plans with all required fields:
//   id, name, days, price, priority_level
//
// GET /functions/v1/boost-plans
// ─────────────────────────────────────────────────────────────────────────────

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey, x-client-info",
  "Content-Type":                 "application/json",
};

// Static fallback plans with all required fields
const STATIC_PLANS = [
  {
    id:             "basic",
    name:           "Impulso Básico",
    type:           "basic",
    price:          29.90,
    days:           7,
    duration_days:  7,
    priority_level: 1,
    description:    "Destaque seu anúncio por 7 dias",
    features:       ["7 dias de destaque", "Posição prioritária", "Mais visualizações"],
    is_active:      true,
  },
  {
    id:             "premium",
    name:           "Impulso Premium",
    type:           "premium",
    price:          59.90,
    days:           15,
    duration_days:  15,
    priority_level: 2,
    description:    "Destaque seu anúncio por 15 dias",
    features:       ["15 dias de destaque", "Posição premium", "Badge exclusivo", "3× mais visualizações"],
    is_active:      true,
  },
  {
    id:             "ultra",
    name:           "Impulso Ultra",
    type:           "ultra",
    price:          99.90,
    days:           30,
    duration_days:  30,
    priority_level: 3,
    description:    "Destaque máximo por 30 dias",
    features:       ["30 dias de destaque", "Posição máxima", "Badge ultra", "5× mais visualizações", "Suporte prioritário"],
    is_active:      true,
  },
];

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: CORS_HEADERS });
}

serve(async (_req: Request) => {
  if (_req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey     = Deno.env.get("SUPABASE_ANON_KEY");

  // Try DB first – normalise rows to include both days and duration_days + priority_level
  if (supabaseUrl && anonKey) {
    try {
      const supabase = createClient(supabaseUrl, anonKey, {
        auth: { persistSession: false },
      });
      const { data: dbPlans } = await supabase
        .from("boost_plans")
        .select("*")
        .eq("is_active", true)
        .order("price", { ascending: true });

      if (dbPlans && dbPlans.length > 0) {
        // Normalise: ensure both `days` and `duration_days`, and `priority_level`
        const normalised = dbPlans.map((p: Record<string, unknown>) => ({
          ...p,
          days:           p.days           ?? p.duration_days ?? 7,
          duration_days:  p.duration_days  ?? p.days          ?? 7,
          priority_level: p.priority_level ?? (p.type === "ultra" ? 3 : p.type === "premium" ? 2 : 1),
        }));
        return json({ plans: normalised });
      }
    } catch { /* fall through to static */ }
  }

  return json({ plans: STATIC_PLANS });
});
