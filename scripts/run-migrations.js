#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// SulMotor – Supabase Migration Runner
// Applies SQL migrations via the Supabase REST API using service role key.
//
// Usage:
//   SUPABASE_SERVICE_ROLE_KEY=<key> node scripts/run-migrations.js
//
// The service role key is needed to:
//   1. Execute DDL (CREATE TABLE, CREATE INDEX, etc.)
//   2. Create RLS policies
//   3. Create SQL functions
//
// Get your service role key from:
//   https://supabase.com/dashboard/project/imkzkvlktrixaxougqie/settings/api
// ─────────────────────────────────────────────────────────────────────────────

const fs   = require('fs');
const path = require('path');
const https = require('https');

const PROJECT_REF  = 'imkzkvlktrixaxougqie';
const SUPABASE_URL = `https://${PROJECT_REF}.supabase.co`;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SERVICE_KEY) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY not set.');
  console.error('   Get it from: https://supabase.com/dashboard/project/imkzkvlktrixaxougqie/settings/api');
  process.exit(1);
}

// Migrations to apply (in order)
const MIGRATIONS = [
  '001_monetization.sql',
  '002_production_architecture.sql',
  '003_payment_tables.sql',
  '003_payment_system.sql',
];

const MIGRATIONS_DIR = path.join(__dirname, '..', 'supabase', 'migrations');

async function fetchSupabase(endpoint, options = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(endpoint, SUPABASE_URL);
    const req = https.request(url, {
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SERVICE_KEY,
        'Authorization': `Bearer ${SERVICE_KEY}`,
        'Prefer': 'return=representation',
        ...options.headers,
      },
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });
    req.on('error', reject);
    if (options.body) req.write(JSON.stringify(options.body));
    req.end();
  });
}

async function executeSql(sql) {
  // Use the Supabase SQL API endpoint (requires service role)
  const result = await fetchSupabase('/rest/v1/rpc/exec_sql', {
    method: 'POST',
    body: { query: sql },
  });
  return result;
}

async function checkTableExists(tableName) {
  const result = await fetchSupabase(
    `/rest/v1/${tableName}?limit=0`,
    { headers: { 'Range-Unit': 'items', 'Range': '0-0' } }
  );
  return result.status !== 404;
}

async function runMigrations() {
  console.log('🚀 SulMotor Database Migration Runner');
  console.log(`📡 Project: ${PROJECT_REF}`);
  console.log('');

  // Check existing tables
  console.log('📋 Checking existing tables...');
  const tablesToCheck = ['anuncios', 'orders', 'listing_boosts', 'boost_plans', 'pagamentos'];
  for (const table of tablesToCheck) {
    const exists = await checkTableExists(table);
    console.log(`  ${exists ? '✅' : '❌'} ${table}`);
  }
  console.log('');

  // Apply migrations
  for (const migrationFile of MIGRATIONS) {
    const filePath = path.join(MIGRATIONS_DIR, migrationFile);

    if (!fs.existsSync(filePath)) {
      console.log(`⚠️  Skipping ${migrationFile} (file not found)`);
      continue;
    }

    const sql = fs.readFileSync(filePath, 'utf8');
    console.log(`📦 Applying ${migrationFile} (${sql.length} bytes)...`);

    // Split into statements and execute
    const statements = sql
      .split(/;\s*\n/)
      .map(s => s.trim())
      .filter(s => s.length > 10 && !s.startsWith('--'));

    console.log(`   ${statements.length} statements to execute`);

    // Note: exec_sql RPC may not exist; the migration SQL needs to be run
    // via Supabase Dashboard > SQL Editor or via psql direct connection
    console.log(`   ⚠️  To apply: paste ${migrationFile} in Supabase SQL Editor`);
    console.log(`   URL: https://supabase.com/dashboard/project/${PROJECT_REF}/sql/new`);
  }

  console.log('');
  console.log('📌 Manual steps required:');
  console.log('');
  console.log('1. Open Supabase SQL Editor:');
  console.log(`   https://supabase.com/dashboard/project/${PROJECT_REF}/sql/new`);
  console.log('');
  console.log('2. Apply each migration file in order:');
  MIGRATIONS.forEach(m => {
    console.log(`   • supabase/migrations/${m}`);
  });
  console.log('');
  console.log('3. Deploy Edge Functions (requires PAT):');
  console.log('   supabase functions deploy create-payment --project-ref imkzkvlktrixaxougqie');
  console.log('   supabase functions deploy mercadopago-webhook --project-ref imkzkvlktrixaxougqie');
  console.log('   supabase functions deploy payment-status --project-ref imkzkvlktrixaxougqie');
  console.log('   supabase functions deploy boost-plans --project-ref imkzkvlktrixaxougqie');
  console.log('   supabase functions deploy orders --project-ref imkzkvlktrixaxougqie');
  console.log('   supabase functions deploy expire-boosts --project-ref imkzkvlktrixaxougqie');
}

runMigrations().catch(console.error);
