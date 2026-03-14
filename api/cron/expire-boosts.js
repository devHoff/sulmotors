'use strict';

/**
 * api/cron/expire-boosts.js
 * ─────────────────────────────────────────────────────────────────────────────
 * In-process node-cron scheduler for the boost expiration job.
 *
 * Responsibilities:
 *   • Schedule expire_boosts() every 10 minutes (or per CRON_SCHEDULE env var).
 *   • Call the endpoint internally via runExpireBoostsDirect() — no HTTP round-trip.
 *   • Retry up to MAX_RETRIES times on transient failures with exponential back-off.
 *   • Write structured log lines with ISO timestamps for easy parsing.
 *   • Track consecutive failures and emit a critical alert after ALERT_THRESHOLD.
 *   • Export { start, stop, runNow } for lifecycle management by server.js.
 *
 * Environment variables consumed:
 *   CRON_SCHEDULE          Cron expression (default: "*/10 * * * *")
 *   CRON_SECRET_KEY        Secret used when calling the HTTP endpoint externally
 *   SUPABASE_URL           Supabase project URL
 *   SUPABASE_SERVICE_KEY   Supabase service-role key
 *
 * Usage (auto-started by server.js):
 *   const cronJob = require('./cron/expire-boosts');
 *   cronJob.start();   // called once at server boot
 *   cronJob.stop();    // graceful shutdown
 *   await cronJob.runNow();  // force immediate run
 */

const cron = require('node-cron');
const { runExpireBoostsDirect } = require('../orders/orders');

// ── Configuration ─────────────────────────────────────────────────────────────
const SCHEDULE        = process.env.CRON_SCHEDULE || '*/10 * * * *';
const MAX_RETRIES     = 3;
const RETRY_BASE_MS   = 5_000;   // 5 s initial back-off, doubles each retry
const ALERT_THRESHOLD = 5;       // consecutive failures before "critical" log

// ── State ─────────────────────────────────────────────────────────────────────
let _task             = null;      // node-cron task handle
let _running          = false;     // prevent overlapping executions
let _consecutiveFails = 0;
let _totalRuns        = 0;
let _totalExpired     = 0;
let _lastRunAt        = null;
let _lastResult       = null;

// ── Logger ────────────────────────────────────────────────────────────────────
function log(level, msg, extra = '') {
    const ts = new Date().toISOString();
    const prefix = {
        info:  '  [cron]',
        ok:    '✅ [cron]',
        warn:  '⚠️  [cron]',
        error: '❌ [cron]',
        crit:  '🚨 [cron]',
    }[level] || '   [cron]';
    const line = extra ? `${prefix} ${ts} ${msg} ${extra}` : `${prefix} ${ts} ${msg}`;
    if (level === 'error' || level === 'crit') {
        console.error(line);
    } else if (level === 'warn') {
        console.warn(line);
    } else {
        console.log(line);
    }
}

// ── Sleep helper ─────────────────────────────────────────────────────────────
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// ── Core job execution with retries ──────────────────────────────────────────
async function executeWithRetry(attempt = 1) {
    try {
        const result = await runExpireBoostsDirect();

        // Success
        _consecutiveFails = 0;
        _totalRuns++;
        _totalExpired += result?.expired_boosts ?? 0;
        _lastRunAt   = new Date().toISOString();
        _lastResult  = result;

        log('ok', `expire_boosts executed successfully`);
        log('info', `expired_boost_count = ${result?.expired_boosts ?? 0}`);
        log('info', `stats → total_runs=${_totalRuns} total_expired=${_totalExpired} last_run=${_lastRunAt}`);

        return result;

    } catch (err) {
        if (attempt < MAX_RETRIES) {
            const backoffMs = RETRY_BASE_MS * Math.pow(2, attempt - 1);
            log('warn', `expire_boosts failed (attempt ${attempt}/${MAX_RETRIES}), retrying in ${backoffMs}ms…`, `— ${err.message}`);
            await sleep(backoffMs);
            return executeWithRetry(attempt + 1);
        }

        // All retries exhausted
        _consecutiveFails++;
        _totalRuns++;
        _lastRunAt  = new Date().toISOString();
        _lastResult = { success: false, error: err.message };

        log('error', `expire_boosts failed after ${MAX_RETRIES} attempts: ${err.message}`);

        if (_consecutiveFails >= ALERT_THRESHOLD) {
            log('crit', `CRITICAL: ${_consecutiveFails} consecutive failures!`, `last_error="${err.message}"`);
            log('crit', `Action required: check SUPABASE_URL, SUPABASE_SERVICE_KEY, and the expire_boosts() SQL function.`);
        }

        throw err;
    }
}

// ── Guarded tick — prevents overlapping runs ──────────────────────────────────
async function tick() {
    if (_running) {
        log('warn', 'Previous run still in progress, skipping this tick.');
        return;
    }
    _running = true;
    try {
        await executeWithRetry();
    } catch { /* already logged */ } finally {
        _running = false;
    }
}

// ── Validate cron expression ──────────────────────────────────────────────────
function validateSchedule(expr) {
    if (!cron.validate(expr)) {
        log('error', `Invalid CRON_SCHEDULE expression: "${expr}". Falling back to "*/10 * * * *".`);
        return '*/10 * * * *';
    }
    return expr;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Start the cron scheduler.
 * Safe to call multiple times — only one task is ever scheduled.
 */
function start() {
    if (_task) {
        log('warn', 'Cron scheduler already running.');
        return;
    }

    const schedule = validateSchedule(SCHEDULE);
    log('info', `Cron scheduler starting. schedule="${schedule}" (UTC)`);
    log('info', `Max retries per run: ${MAX_RETRIES}, retry base backoff: ${RETRY_BASE_MS}ms`);

    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
        log('warn', 'SUPABASE_URL or SUPABASE_SERVICE_KEY not set — cron will fail until configured.');
    }
    if (!process.env.CRON_SECRET_KEY) {
        log('warn', 'CRON_SECRET_KEY not set — HTTP cron endpoint is unprotected!');
    }

    _task = cron.schedule(schedule, tick, {
        scheduled: true,
        timezone:  'UTC',
    });

    log('ok', `Cron scheduler started. Next run: ~${schedule}`);
}

/**
 * Stop the cron scheduler gracefully.
 */
function stop() {
    if (_task) {
        _task.stop();
        _task = null;
        log('info', 'Cron scheduler stopped.');
    }
}

/**
 * Force an immediate execution regardless of the schedule.
 * Returns the result object or throws on failure.
 */
async function runNow() {
    log('info', 'Manual trigger: running expire_boosts immediately…');
    return executeWithRetry();
}

/**
 * Return current runtime statistics (useful for health checks).
 */
function stats() {
    return {
        schedule:         SCHEDULE,
        running:          _running,
        total_runs:       _totalRuns,
        total_expired:    _totalExpired,
        consecutive_fails: _consecutiveFails,
        last_run_at:      _lastRunAt,
        last_result:      _lastResult,
    };
}

module.exports = { start, stop, runNow, stats };
