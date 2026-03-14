#!/usr/bin/env -S deno run --allow-net --allow-read --allow-env
// ─────────────────────────────────────────────────────────────────────────────
// SulMotor – Full Supabase Deployment Script (Deno)
// Deploys migrations via SQL REST API + Edge Functions via Management API
//
// Usage:
//   SUPABASE_ACCESS_TOKEN=sbp_xxx \
//   SUPABASE_SERVICE_ROLE_KEY=eyJhb... \
//   DB_PASSWORD=your-db-password \
//   deno run --allow-net --allow-read --allow-env scripts/deploy-supabase.ts
//
// Required env vars:
//   SUPABASE_ACCESS_TOKEN    - PAT from https://supabase.com/dashboard/account/tokens
//   SUPABASE_SERVICE_ROLE_KEY - Service role key from project settings
//
// Optional:
//   DB_PASSWORD - Database password (for psql direct connection)
// ─────────────────────────────────────────────────────────────────────────────

const PROJECT_REF     = "imkzkvlktrixaxougqie";
const SUPABASE_URL    = `https://${PROJECT_REF}.supabase.co`;
const MANAGEMENT_API  = "https://api.supabase.com/v1";

const PAT             = Deno.env.get("SUPABASE_ACCESS_TOKEN") ?? "";
const SERVICE_KEY     = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const ANON_KEY        = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlta3prdmxrdHJpeGF4b3VncWllIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzExNjY0NDEsImV4cCI6MjA4Njc0MjQ0MX0.JgmaLYSZp1oD5OZRCVA8jci1t6HCZyb6xE96ctuersE";
const MP_ACCESS_TOKEN = "APP_USR-7239440808267582-031221-15802be9b3427f5b9e1e29d49413ed02-2697630578";
const CRON_SECRET     = "bgUZaN9ChtIX6CuqzIX4VycQZTU36nRNrfQ3Lqy2_5c";

// Colors
const G = "\x1b[32m", Y = "\x1b[33m", R = "\x1b[31m", C = "\x1b[36m", NC = "\x1b[0m";
const ok   = (m: string) => console.log(`${G}[✓]${NC} ${m}`);
const warn = (m: string) => console.log(`${Y}[!]${NC} ${m}`);
const err  = (m: string) => console.log(`${R}[✗]${NC} ${m}`);
const log  = (m: string) => console.log(`${C}[→]${NC} ${m}`);

// ── Migrations to apply ───────────────────────────────────────────────────────
const MIGRATIONS = [
  "001_monetization.sql",
  "002_production_architecture.sql",
  "003_payment_tables.sql",
  "003_payment_system.sql",
  "20260308_create_pagamentos.sql",
  "20260308_fix_pagamentos_rls.sql",
];

// ── Edge Functions to deploy ──────────────────────────────────────────────────
const FUNCTIONS = [
  { name: "boost-plans",          noVerifyJwt: true  },
  { name: "orders",               noVerifyJwt: true  },
  { name: "create-payment",       noVerifyJwt: true  },
  { name: "payment-status",       noVerifyJwt: true  },
  { name: "mercadopago-webhook",  noVerifyJwt: true  },
  { name: "expire-boosts",        noVerifyJwt: true  },
];

// ── Management API helper ─────────────────────────────────────────────────────
async function mgmtFetch(path: string, opts: RequestInit = {}): Promise<Response> {
  return fetch(`${MANAGEMENT_API}${path}`, {
    ...opts,
    headers: {
      "Authorization": `Bearer ${PAT}`,
      "Content-Type":  "application/json",
      ...(opts.headers as Record<string, string> ?? {}),
    },
  });
}

// ── Project REST API helper ───────────────────────────────────────────────────
async function projectFetch(path: string, opts: RequestInit = {}, key = SERVICE_KEY || ANON_KEY): Promise<Response> {
  return fetch(`${SUPABASE_URL}${path}`, {
    ...opts,
    headers: {
      "apikey":        key,
      "Authorization": `Bearer ${key}`,
      "Content-Type":  "application/json",
      ...(opts.headers as Record<string, string> ?? {}),
    },
  });
}

// ── Check table existence ─────────────────────────────────────────────────────
async function tableExists(table: string): Promise<boolean> {
  const res = await projectFetch(`/rest/v1/${table}?limit=0`);
  return res.status !== 404;
}

// ── Execute SQL via pg_query RPC ──────────────────────────────────────────────
async function executeSql(sql: string, label: string): Promise<boolean> {
  if (!SERVICE_KEY) {
    warn(`  Skipping SQL execution for "${label}" — SUPABASE_SERVICE_ROLE_KEY not set`);
    return false;
  }

  // Use the Management API SQL endpoint
  const res = await mgmtFetch(`/projects/${PROJECT_REF}/database/query`, {
    method: "POST",
    body: JSON.stringify({ query: sql }),
  });

  if (res.ok) {
    ok(`  SQL executed: ${label}`);
    return true;
  } else {
    const body = await res.text();
    warn(`  SQL failed for "${label}": ${res.status} ${body.slice(0, 200)}`);
    return false;
  }
}

// ── Deploy Edge Function via Management API ───────────────────────────────────
async function deployFunction(fnName: string, noVerifyJwt: boolean): Promise<boolean> {
  if (!PAT) {
    warn(`  Skipping deploy of ${fnName} — SUPABASE_ACCESS_TOKEN not set`);
    return false;
  }

  // Read source
  const srcPath = `${Deno.cwd()}/supabase/functions/${fnName}/index.ts`;
  let source: string;
  try {
    source = await Deno.readTextFile(srcPath);
  } catch {
    err(`  Source not found: ${srcPath}`);
    return false;
  }

  // Check if function already exists
  const checkRes = await mgmtFetch(`/projects/${PROJECT_REF}/functions/${fnName}`);
  const exists = checkRes.status === 200;

  const method = exists ? "PATCH" : "POST";
  const url    = exists
    ? `/projects/${PROJECT_REF}/functions/${fnName}`
    : `/projects/${PROJECT_REF}/functions`;

  const body: Record<string, unknown> = {
    slug:          fnName,
    name:          fnName,
    body:          source,
    verify_jwt:    !noVerifyJwt,
    import_map:    false,
  };

  const res = await mgmtFetch(url, {
    method,
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });

  if (res.ok) {
    ok(`  Function deployed: ${fnName}`);
    return true;
  } else {
    const body2 = await res.text();
    err(`  Deploy failed for ${fnName}: ${res.status} ${body2.slice(0, 300)}`);
    return false;
  }
}

// ── Set secrets via Management API ───────────────────────────────────────────
async function setSecrets(secrets: Record<string, string>): Promise<boolean> {
  if (!PAT) {
    warn("Skipping secrets — SUPABASE_ACCESS_TOKEN not set");
    return false;
  }

  const payload = Object.entries(secrets).map(([name, value]) => ({ name, value }));

  const res = await mgmtFetch(`/projects/${PROJECT_REF}/secrets`, {
    method: "POST",
    body:   JSON.stringify(payload),
  });

  if (res.ok) {
    ok(`Secrets set: ${Object.keys(secrets).join(", ")}`);
    return true;
  } else {
    const body = await res.text();
    err(`Failed to set secrets: ${res.status} ${body.slice(0, 200)}`);
    return false;
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log("");
  console.log("╔══════════════════════════════════════════════════════╗");
  console.log("║   SulMotor – Supabase Production Deployment          ║");
  console.log(`║   Project: ${PROJECT_REF}          ║`);
  console.log("╚══════════════════════════════════════════════════════╝");
  console.log("");

  if (!PAT)         warn("SUPABASE_ACCESS_TOKEN not set — function deployment and secrets will be skipped");
  if (!SERVICE_KEY) warn("SUPABASE_SERVICE_ROLE_KEY not set — SQL execution will be skipped");

  // ── Step 1: Verify project connectivity ───────────────────────────────────
  log("Step 1: Verifying project connectivity...");
  const pingRes = await projectFetch("/rest/v1/", {}, ANON_KEY);
  if (pingRes.ok) {
    ok("Project is accessible");
  } else {
    err(`Project not accessible: ${pingRes.status}`);
    Deno.exit(1);
  }

  // ── Step 2: Check existing tables ─────────────────────────────────────────
  log("Step 2: Checking existing tables...");
  const tables = ["anuncios", "orders", "listing_boosts", "boost_plans", "pagamentos", "curtidas", "profiles"];
  for (const t of tables) {
    const exists = await tableExists(t);
    console.log(`  ${exists ? "✅" : "❌"} ${t}`);
  }

  // ── Step 3: Apply migrations ───────────────────────────────────────────────
  log("Step 3: Applying migrations...");
  for (const migration of MIGRATIONS) {
    const filePath = `${Deno.cwd()}/supabase/migrations/${migration}`;
    let sql: string;
    try {
      sql = await Deno.readTextFile(filePath);
    } catch {
      warn(`  Skipping ${migration} (file not found)`);
      continue;
    }

    log(`  Applying ${migration} (${sql.length} bytes)...`);
    await executeSql(sql, migration);
  }

  // ── Step 4: Deploy Edge Functions ─────────────────────────────────────────
  log("Step 4: Deploying Edge Functions...");
  for (const fn of FUNCTIONS) {
    log(`  Deploying ${fn.name}...`);
    await deployFunction(fn.name, fn.noVerifyJwt);
  }

  // ── Step 5: Set secrets ────────────────────────────────────────────────────
  log("Step 5: Setting Edge Function secrets...");
  const secrets: Record<string, string> = {
    MP_ACCESS_TOKEN: MP_ACCESS_TOKEN,
    CRON_SECRET_KEY: CRON_SECRET,
  };
  if (SERVICE_KEY) secrets.SUPABASE_SERVICE_ROLE_KEY = SERVICE_KEY;
  await setSecrets(secrets);

  // ── Step 6: Verify functions ───────────────────────────────────────────────
  log("Step 6: Verifying deployed functions...");
  if (PAT) {
    const listRes = await mgmtFetch(`/projects/${PROJECT_REF}/functions`);
    if (listRes.ok) {
      const fns = await listRes.json() as Array<{ slug: string; status: string }>;
      for (const fn of fns) {
        console.log(`  ✅ ${fn.slug} (${fn.status ?? "active"})`);
      }
    }
  } else {
    // Test each function endpoint
    for (const fn of FUNCTIONS) {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/${fn.name}`, {
        headers: { "apikey": ANON_KEY },
      });
      console.log(`  ${res.status !== 404 ? "✅" : "❌"} ${fn.name} (HTTP ${res.status})`);
    }
  }

  // ── Summary ────────────────────────────────────────────────────────────────
  console.log("");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`${G}📋 Deployment Summary${NC}`);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("");
  console.log("Edge Function endpoints:");
  for (const fn of FUNCTIONS) {
    console.log(`  ${SUPABASE_URL}/functions/v1/${fn.name}`);
  }
  console.log("");
  console.log("Mercado Pago Webhook URL:");
  console.log(`  ${SUPABASE_URL}/functions/v1/mercadopago-webhook`);
  console.log("");

  if (!PAT || !SERVICE_KEY) {
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log(`${Y}⚠️  Manual Steps Required${NC}`);
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("");

    if (!SERVICE_KEY) {
      console.log("1. Apply migrations in Supabase SQL Editor:");
      console.log(`   https://supabase.com/dashboard/project/${PROJECT_REF}/sql/new`);
      console.log("   Files to run (in order):");
      for (const m of MIGRATIONS) {
        console.log(`   • supabase/migrations/${m}`);
      }
      console.log("");
    }

    if (!PAT) {
      console.log("2. Get your PAT from: https://supabase.com/dashboard/account/tokens");
      console.log("   Then run:");
      console.log(`   SUPABASE_ACCESS_TOKEN=sbp_xxx bash deploy.sh`);
      console.log("");
      console.log("   Or deploy functions individually:");
      for (const fn of FUNCTIONS) {
        console.log(`   supabase functions deploy ${fn.name} --project-ref ${PROJECT_REF} --no-verify-jwt`);
      }
      console.log("");
      console.log("3. Set secrets:");
      console.log(`   supabase secrets set MP_ACCESS_TOKEN="${MP_ACCESS_TOKEN}" --project-ref ${PROJECT_REF}`);
      console.log(`   supabase secrets set SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key> --project-ref ${PROJECT_REF}`);
      console.log(`   supabase secrets set CRON_SECRET_KEY="${CRON_SECRET}" --project-ref ${PROJECT_REF}`);
    }
  }
}

main().catch(e => { err(String(e)); Deno.exit(1); });
