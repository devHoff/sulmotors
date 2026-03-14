'use strict';

/**
 * api/server.js  –  SulMotor Payment & Orders API v3
 *
 * Routes:
 *   GET  /api/health                          → Liveness probe + cron stats
 *   GET  /api/mp-public-key                   → Safe: return public key to frontend
 *   GET  /api/boost-plans                     → List active boost plans
 *   GET  /api/listings/search                 → Search listings with ranking
 *   POST /api/orders/create                   → Create pending order (auth required)
 *   GET  /api/orders/user/list                → List user orders (auth required)
 *   GET  /api/orders/:id                      → Get order by ID (auth required)
 *   POST /api/payments/create                 → Unified PIX + card + boleto payment
 *   POST /api/create-payment                  → Legacy alias → same handler
 *   GET  /api/payment-status/:id              → Poll payment status
 *   POST /api/webhooks/mercadopago            → MP event notifications (canonical)
 *   POST /api/webhook/mercadopago             → Legacy alias → same handler
 *   POST /api/cron/expire-boosts              → Expire old boosts (every 10 min)
 *   POST /api/cron/expire-pending-orders      → Expire 24h+ pending orders (every 30 min)
 *   POST /api/cron/update-scores              → Recalculate ranking scores (every 1h)
 *   GET  /api/cron/stats                      → All cron job stats (protected)
 *   GET  /api/notifications                   → User notifications (auth required)
 *   POST /api/notifications/mark-read         → Mark notifications read (auth required)
 *
 * Security:
 *   - MP_ACCESS_TOKEN is NEVER sent to the client
 *   - Helmet sets strict security headers
 *   - CORS restricted to known origins
 *   - Rate limiting on payment creation (in-process, per IP)
 *   - Raw body captured for webhook HMAC verification
 *   - Cron endpoints require x-cron-secret: CRON_SECRET_KEY header
 *
 * Background Jobs (in-process node-cron):
 *   - expire_boosts()              every 10 min  (CRON_SCHEDULE env)
 *   - expire_pending_orders()      every 30 min  (CRON_EXPIRE_ORDERS_SCHEDULE env)
 *   - update_all_listing_scores()  every 1 hour  (CRON_SCORES_SCHEDULE env)
 *
 * Each job:
 *   - Retries up to 3× with exponential back-off
 *   - Prevents overlapping executions
 *   - Emits structured logs: ✅/❌/⚠️/🚨 prefixes
 *   - Tracks consecutive failures and alerts at threshold 5
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env.server') });

const express = require('express');
const cors    = require('cors');
const helmet  = require('helmet');

// ── Import handlers ───────────────────────────────────────────────────────────
const { createPaymentHandler: legacyCreatePayment } = require('./mercadopago/create-payment');
const { createPaymentHandler: newCreatePayment }     = require('./mercadopago/payments');
const { paymentStatusHandler }                       = require('./mercadopago/payment-status');
const { webhookHandler }                             = require('./mercadopago/webhooks');

const {
    getBoostPlans,
    createOrder,
    getOrder,
    listUserOrders,
    expireBoosts,
} = require('./orders/orders');

// ── Background cron jobs ──────────────────────────────────────────────────────
const cronExpireBoosts        = require('./cron/expire-boosts');
const cronExpireOrders        = require('./jobs/expire-pending-orders');
const cronUpdateScores        = require('./jobs/update-listing-scores');

// ── Services ──────────────────────────────────────────────────────────────────
const { searchHandler, getCacheStats, invalidateCache } = require('./services/searchService');
const { getNotifications, markRead }                    = require('./services/notificationsService');

const app  = express();
const PORT = process.env.PORT || 3001;

// ── CORS ──────────────────────────────────────────────────────────────────────
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGIN ?? '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);

if (process.env.NODE_ENV !== 'production') {
    ALLOWED_ORIGINS.push('http://localhost:5173', 'http://localhost:3000');
}

const corsOptions = {
    origin(origin, cb) {
        if (!origin) return cb(null, true);
        if (ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
        if (process.env.NODE_ENV !== 'production') return cb(null, true);
        cb(new Error(`CORS: origin "${origin}" not allowed`));
    },
    methods:     ['GET', 'POST', 'OPTIONS'],
    credentials: true,
};

// ── Security headers ──────────────────────────────────────────────────────────
app.use(helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    contentSecurityPolicy:     false,
}));

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

// ── Body parsing (raw body for webhook HMAC) ──────────────────────────────────
app.use((req, res, next) => {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => {
        req.rawBody = Buffer.concat(chunks).toString('utf8');
        if (req.rawBody) {
            try   { req.body = JSON.parse(req.rawBody); }
            catch { req.body = {}; }
        } else {
            req.body = {};
        }
        next();
    });
    req.on('error', err => {
        console.error('[server] Request error:', err.message);
        next(err);
    });
});

// ── Payment rate limiter ──────────────────────────────────────────────────────
const rateMap            = new Map();
const RATE_LIMIT_MAX     = 10;
const RATE_LIMIT_WINDOW  = 60_000;

function paymentRateLimit(req, res, next) {
    const ip     = req.ip ?? req.connection?.remoteAddress ?? 'unknown';
    const now    = Date.now();
    const bucket = rateMap.get(ip);
    if (!bucket || now > bucket.resetAt) {
        rateMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW });
        return next();
    }
    bucket.count++;
    if (bucket.count > RATE_LIMIT_MAX) {
        return res.status(429).json({ error: 'Muitas tentativas. Aguarde 1 minuto.' });
    }
    next();
}

setInterval(() => {
    const now = Date.now();
    for (const [ip, b] of rateMap) if (now > b.resetAt) rateMap.delete(ip);
}, 5 * 60_000);

// ── Request logger ─────────────────────────────────────────────────────────────
app.use((req, _res, next) => {
    const safePath = req.path
        .replace(/\/[0-9a-f-]{36}/g, '/<uuid>')
        .replace(/\/\d{6,}/g, '/<id>');
    console.log(`[${new Date().toISOString()}] ${req.method} ${safePath}`);
    next();
});

// ── Health ─────────────────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
    const token = process.env.MP_ACCESS_TOKEN;
    res.json({
        status:            'ok',
        service:           'SulMotor Payment API v3',
        mp_configured:     !!token,
        mp_key_prefix:     token ? `${token.slice(0, 12)}…` : null,
        supabase_url:      process.env.SUPABASE_URL ? 'set' : 'missing',
        cron_secret_set:   !!process.env.CRON_SECRET_KEY,
        node_env:          process.env.NODE_ENV ?? 'development',
        timestamp:         new Date().toISOString(),
        search_cache:      getCacheStats(),
        cron_jobs: {
            expire_boosts:         cronExpireBoosts.stats(),
            expire_pending_orders: cronExpireOrders.stats(),
            update_listing_scores: cronUpdateScores.stats(),
        },
    });
});

// ── Public MP key ─────────────────────────────────────────────────────────────
app.get('/api/mp-public-key', (_req, res) => {
    const key = process.env.MP_PUBLIC_KEY;
    if (!key) return res.status(503).json({ error: 'MP_PUBLIC_KEY não configurado.' });
    res.json({ public_key: key });
});

// ── Boost plans (public) ──────────────────────────────────────────────────────
app.get('/api/boost-plans', getBoostPlans);

// ── Listings search (public) ──────────────────────────────────────────────────
app.get('/api/listings/search', searchHandler);

// ── Cache management (protected) ─────────────────────────────────────────────
app.post('/api/cache/invalidate', (req, res) => {
    const expected = process.env.CRON_SECRET_KEY;
    if (expected && req.headers['x-cron-secret'] !== expected) {
        return res.status(403).json({ error: 'Forbidden.' });
    }
    const { pattern } = req.body ?? {};
    invalidateCache(pattern);
    res.json({ success: true, cache: getCacheStats() });
});

// ── Orders (authenticated) ────────────────────────────────────────────────────
app.post('/api/orders/create',   createOrder);
app.get('/api/orders/user/list', listUserOrders);
app.get('/api/orders/:id',       getOrder);

// ── Payment creation (rate-limited) ──────────────────────────────────────────
app.post('/api/payments/create', paymentRateLimit, newCreatePayment);
app.post('/api/create-payment',  paymentRateLimit, legacyCreatePayment);

// ── Payment status polling ────────────────────────────────────────────────────
app.get('/api/payment-status/:payment_id', paymentStatusHandler);

// ── Webhooks ──────────────────────────────────────────────────────────────────
app.post('/api/webhooks/mercadopago', webhookHandler);  // canonical
app.post('/api/webhook/mercadopago',  webhookHandler);  // legacy alias

// ── Cron HTTP endpoints (all require x-cron-secret) ──────────────────────────
app.post('/api/cron/expire-boosts',         expireBoosts);
app.post('/api/cron/expire-pending-orders', cronExpireOrders.expirePendingOrdersHandler);
app.post('/api/cron/update-scores',         cronUpdateScores.updateScoresHandler);

// ── Cron stats (protected) ────────────────────────────────────────────────────
app.get('/api/cron/stats', (req, res) => {
    const expected = process.env.CRON_SECRET_KEY;
    if (expected && req.headers['x-cron-secret'] !== expected) {
        return res.status(403).json({ error: 'Forbidden.' });
    }
    res.json({
        timestamp: new Date().toISOString(),
        expire_boosts:         cronExpireBoosts.stats(),
        expire_pending_orders: cronExpireOrders.stats(),
        update_listing_scores: cronUpdateScores.stats(),
        search_cache:          getCacheStats(),
    });
});

// ── Notifications (authenticated) ─────────────────────────────────────────────
app.get('/api/notifications',            getNotifications);
app.post('/api/notifications/mark-read', markRead);

// ── 404 ────────────────────────────────────────────────────────────────────────
app.use((_req, res) => res.status(404).json({ error: 'Endpoint não encontrado.' }));

// ── Global error handler ───────────────────────────────────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
    if (err.message?.startsWith('CORS')) {
        return res.status(403).json({ error: 'CORS: origem não permitida.' });
    }
    console.error('[server] Unhandled:', err?.message ?? err);
    res.status(500).json({ error: 'Erro interno do servidor.' });
});

// ── Start ──────────────────────────────────────────────────────────────────────
app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n🚀 SulMotor Payment API v3  →  http://0.0.0.0:${PORT}`);
    console.log(`\n📋 Routes:`);
    console.log(`   Health:         GET  /api/health`);
    console.log(`   Plans:          GET  /api/boost-plans`);
    console.log(`   Search:         GET  /api/listings/search`);
    console.log(`   Order create:   POST /api/orders/create`);
    console.log(`   Order list:     GET  /api/orders/user/list`);
    console.log(`   Order get:      GET  /api/orders/:id`);
    console.log(`   Pay create:     POST /api/payments/create`);
    console.log(`   Pay status:     GET  /api/payment-status/:id`);
    console.log(`   Webhook:        POST /api/webhooks/mercadopago`);
    console.log(`   Notifications:  GET  /api/notifications`);
    console.log(`\n⏱️  Cron jobs (in-process, UTC):`);
    console.log(`   expire-boosts:         POST /api/cron/expire-boosts         [${process.env.CRON_SCHEDULE || '*/10 * * * *'}]`);
    console.log(`   expire-pending-orders: POST /api/cron/expire-pending-orders [${process.env.CRON_EXPIRE_ORDERS_SCHEDULE || '*/30 * * * *'}]`);
    console.log(`   update-scores:         POST /api/cron/update-scores         [${process.env.CRON_SCORES_SCHEDULE || '0 * * * *'}]`);
    console.log(`   stats:                 GET  /api/cron/stats`);
    console.log('');

    if (!process.env.MP_ACCESS_TOKEN)      console.warn('⚠️  MP_ACCESS_TOKEN not set');
    if (!process.env.MP_WEBHOOK_SECRET)    console.warn('⚠️  MP_WEBHOOK_SECRET not set – signatures will NOT be verified');
    if (!process.env.SUPABASE_SERVICE_KEY) console.warn('⚠️  SUPABASE_SERVICE_KEY not set – DB writes disabled');
    if (!process.env.CRON_SECRET_KEY)      console.warn('⚠️  CRON_SECRET_KEY not set – cron endpoints are UNPROTECTED');

    // ── Start all in-process cron schedulers ──────────────────────────────────
    cronExpireBoosts.start();
    cronExpireOrders.start();
    cronUpdateScores.start();
});

// ── Graceful shutdown ──────────────────────────────────────────────────────────
function shutdown(signal) {
    console.log(`\n[server] ${signal} received — shutting down gracefully…`);
    cronExpireBoosts.stop();
    cronExpireOrders.stop();
    cronUpdateScores.stop();
    process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));

module.exports = app;
