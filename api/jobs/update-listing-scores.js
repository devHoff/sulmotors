'use strict';
/**
 * api/jobs/update-listing-scores.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Background job: update ranking scores for all active listings.
 *
 * Calls the SQL function `update_all_listing_scores()` which:
 *   UPDATE anuncios SET ranking_score = calculate_listing_score(id) WHERE status='active'
 *
 * Schedule: every 1 hour (0 * * * *)
 * Secret:   x-cron-secret header / CRON_SECRET_KEY env var
 *
 * Exports:
 *   { start, stop, runNow, stats }
 */

const cron = require('node-cron');

const SCHEDULE     = process.env.CRON_SCORES_SCHEDULE || '0 * * * *';
const MAX_RETRIES  = 3;
const RETRY_BASE_MS = 10_000;

const SUPABASE_URL = () => process.env.SUPABASE_URL;
const SERVICE_KEY  = () => process.env.SUPABASE_SERVICE_KEY;

// ── State ─────────────────────────────────────────────────────────────────────
let _task             = null;
let _running          = false;
let _consecutiveFails = 0;
let _totalRuns        = 0;
let _totalUpdated     = 0;
let _lastRunAt        = null;
let _lastResult       = null;

// ── Logger ────────────────────────────────────────────────────────────────────
function log(level, msg) {
    const ts = new Date().toISOString();
    const prefix = {
        info: '  [scores-cron]', ok: '✅ [scores-cron]',
        warn: '⚠️  [scores-cron]', error: '❌ [scores-cron]', crit: '🚨 [scores-cron]',
    }[level] || '[scores-cron]';
    if (level === 'error' || level === 'crit') console.error(`${prefix} ${ts} ${msg}`);
    else if (level === 'warn') console.warn(`${prefix} ${ts} ${msg}`);
    else console.log(`${prefix} ${ts} ${msg}`);
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// ── Core execution ────────────────────────────────────────────────────────────
async function runUpdateScores() {
    const sbUrl = SUPABASE_URL();
    const sbKey = SERVICE_KEY();

    if (!sbUrl || !sbKey) {
        throw new Error('SUPABASE_URL or SUPABASE_SERVICE_KEY not configured.');
    }

    const res = await fetch(`${sbUrl}/rest/v1/rpc/update_all_listing_scores`, {
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
        throw new Error(err?.message || err?.error || `RPC update_all_listing_scores → HTTP ${res.status}`);
    }

    const count = (() => { try { return Number(JSON.parse(raw)); } catch { return 0; } })();
    return count;
}

// ── Retry wrapper ─────────────────────────────────────────────────────────────
async function executeWithRetry(attempt = 1) {
    try {
        const count = await runUpdateScores();

        _consecutiveFails = 0;
        _totalRuns++;
        _totalUpdated += count;
        _lastRunAt  = new Date().toISOString();
        _lastResult = { success: true, updated_count: count };

        log('ok', `update_all_listing_scores: ${count} listings updated`);
        return { success: true, updated_count: count, executed_at: _lastRunAt };

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

        log('error', `update_all_listing_scores failed after ${MAX_RETRIES} attempts: ${err.message}`);
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

// ── HTTP handler (POST /api/cron/update-scores) ───────────────────────────────
async function updateScoresHandler(req, res) {
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
        log('error', `[cron] ${ts} update_all_listing_scores failed: ${err.message}`);
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
    log('info', 'Manual trigger: running update_all_listing_scores immediately…');
    return executeWithRetry();
}

function stats() {
    return {
        schedule:          SCHEDULE,
        running:           _running,
        total_runs:        _totalRuns,
        total_updated:     _totalUpdated,
        consecutive_fails: _consecutiveFails,
        last_run_at:       _lastRunAt,
        last_result:       _lastResult,
    };
}

module.exports = { start, stop, runNow, stats, updateScoresHandler };
