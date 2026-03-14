'use strict';
/**
 * api/jobs/expire-pending-orders.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Background job: expire orders that have been in `pending` status for > 24h.
 *
 * Calls the SQL function `expire_pending_orders()` which:
 *   UPDATE orders SET status='expired' WHERE status='pending' AND created_at < now()-24h
 *
 * Schedule: every 30 minutes (*/30 * * * *)
 * Secret:   x-cron-secret header / CRON_SECRET_KEY env var
 *
 * Exports:
 *   { start, stop, runNow, stats }
 */

const cron = require('node-cron');

const SCHEDULE        = process.env.CRON_EXPIRE_ORDERS_SCHEDULE || '*/30 * * * *';
const MAX_RETRIES     = 3;
const RETRY_BASE_MS   = 5_000;

const SUPABASE_URL = () => process.env.SUPABASE_URL;
const SERVICE_KEY  = () => process.env.SUPABASE_SERVICE_KEY;

// ── State ─────────────────────────────────────────────────────────────────────
let _task             = null;
let _running          = false;
let _consecutiveFails = 0;
let _totalRuns        = 0;
let _totalExpired     = 0;
let _lastRunAt        = null;
let _lastResult       = null;

// ── Logger ────────────────────────────────────────────────────────────────────
function log(level, msg) {
    const ts = new Date().toISOString();
    const prefix = { info: '  [orders-cron]', ok: '✅ [orders-cron]', warn: '⚠️  [orders-cron]', error: '❌ [orders-cron]', crit: '🚨 [orders-cron]' }[level] || '[orders-cron]';
    if (level === 'error' || level === 'crit') console.error(`${prefix} ${ts} ${msg}`);
    else if (level === 'warn') console.warn(`${prefix} ${ts} ${msg}`);
    else console.log(`${prefix} ${ts} ${msg}`);
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// ── Core execution ────────────────────────────────────────────────────────────
async function runExpirePendingOrders() {
    const sbUrl = SUPABASE_URL();
    const sbKey = SERVICE_KEY();

    if (!sbUrl || !sbKey) {
        throw new Error('SUPABASE_URL or SUPABASE_SERVICE_KEY not configured.');
    }

    const res = await fetch(`${sbUrl}/rest/v1/rpc/expire_pending_orders`, {
        method:  'POST',
        headers: {
            'Content-Type':  'application/json',
            'apikey':        sbKey,
            'Authorization': `Bearer ${sbKey}`,
        },
        body: JSON.stringify({}),
    });

    const raw = await res.text();
    if (!res.ok) {
        const err = (() => { try { return JSON.parse(raw); } catch { return { raw }; } })();
        throw new Error(err?.message || err?.error || `RPC expire_pending_orders → HTTP ${res.status}`);
    }

    const count = (() => { try { return Number(JSON.parse(raw)); } catch { return 0; } })();

    // Insert analytics event if any orders expired
    if (count > 0) {
        try {
            await fetch(`${sbUrl}/rest/v1/analytics_events`, {
                method:  'POST',
                headers: { 'Content-Type': 'application/json', 'apikey': sbKey, 'Authorization': `Bearer ${sbKey}`, 'Prefer': 'return=minimal' },
                body: JSON.stringify({
                    event_name: 'orders_expired',
                    properties: { expired_count: count, triggered_at: new Date().toISOString(), source: 'cron/expire-pending-orders' },
                }),
            });
        } catch { /* non-fatal */ }
    }

    return count;
}

// ── Retry wrapper ─────────────────────────────────────────────────────────────
async function executeWithRetry(attempt = 1) {
    try {
        const count = await runExpirePendingOrders();

        _consecutiveFails = 0;
        _totalRuns++;
        _totalExpired += count;
        _lastRunAt  = new Date().toISOString();
        _lastResult = { success: true, expired_count: count };

        log('ok', `expire_pending_orders: ${count} orders expired`);
        return { success: true, expired_count: count, executed_at: _lastRunAt };

    } catch (err) {
        if (attempt < MAX_RETRIES) {
            const backoff = RETRY_BASE_MS * Math.pow(2, attempt - 1);
            log('warn', `Failed (attempt ${attempt}/${MAX_RETRIES}), retrying in ${backoff}ms — ${err.message}`);
            await sleep(backoff);
            return executeWithRetry(attempt + 1);
        }

        _consecutiveFails++;
        _totalRuns++;
        _lastRunAt  = new Date().toISOString();
        _lastResult = { success: false, error: err.message };

        log('error', `expire_pending_orders failed after ${MAX_RETRIES} attempts: ${err.message}`);
        if (_consecutiveFails >= 5) {
            log('crit', `CRITICAL: ${_consecutiveFails} consecutive failures!`);
        }
        throw err;
    }
}

// ── Guarded tick ──────────────────────────────────────────────────────────────
async function tick() {
    if (_running) { log('warn', 'Previous run still in progress, skipping.'); return; }
    _running = true;
    try { await executeWithRetry(); } catch { /* logged */ } finally { _running = false; }
}

// ── HTTP handler (POST /api/cron/expire-pending-orders) ───────────────────────
async function expirePendingOrdersHandler(req, res) {
    const ts = new Date().toISOString();
    const expected = process.env.CRON_SECRET_KEY || process.env.CRON_SECRET;
    const received = req?.headers?.['x-cron-secret'];

    if (expected) {
        if (!received)             return res?.status(403).json({ error: 'Forbidden: missing cron secret.' });
        if (received !== expected) return res?.status(403).json({ error: 'Forbidden: invalid cron secret.' });
    }

    try {
        const result = await executeWithRetry();
        if (res) return res.json(result);
        return result;
    } catch (err) {
        log('error', `[cron] ${ts} expire_pending_orders failed: ${err.message}`);
        if (res) return res.status(500).json({ success: false, error: err.message });
        throw err;
    }
}

// ── Public API ────────────────────────────────────────────────────────────────
function start() {
    if (_task) { log('warn', 'Already running.'); return; }
    log('info', `Starting. schedule="${SCHEDULE}" (UTC)`);
    _task = cron.schedule(SCHEDULE, tick, { scheduled: true, timezone: 'UTC' });
    log('ok', `Started. schedule=${SCHEDULE}`);
}

function stop() {
    if (_task) { _task.stop(); _task = null; log('info', 'Stopped.'); }
}

async function runNow() {
    log('info', 'Manual trigger: running expire_pending_orders immediately…');
    return executeWithRetry();
}

function stats() {
    return {
        schedule:          SCHEDULE,
        running:           _running,
        total_runs:        _totalRuns,
        total_expired:     _totalExpired,
        consecutive_fails: _consecutiveFails,
        last_run_at:       _lastRunAt,
        last_result:       _lastResult,
    };
}

module.exports = { start, stop, runNow, stats, expirePendingOrdersHandler };
