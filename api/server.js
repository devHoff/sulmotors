'use strict';

/**
 * api/server.js  –  SulMotor Payment & Orders API v3
 *
 * Routes:
 *   GET  /api/health                     → Liveness probe
 *   GET  /api/mp-public-key              → Safe: return public key to frontend
 *   GET  /api/boost-plans                → List active boost plans
 *   POST /api/orders/create              → Create pending order (auth required)
 *   GET  /api/orders/:id                 → Get order by ID (auth required)
 *   GET  /api/orders/user/list           → List user orders (auth required)
 *   POST /api/payments/create            → Unified PIX + card + boleto payment
 *   POST /api/create-payment             → Legacy alias → same handler
 *   GET  /api/payment-status/:id         → Poll payment status
 *   POST /api/webhooks/mercadopago       → MP event notifications (canonical)
 *   POST /api/webhook/mercadopago        → Legacy alias → same handler
 *   POST /api/cron/expire-boosts         → Daily cron to expire old boosts
 *
 * Security:
 *   - MP_ACCESS_TOKEN is NEVER sent to the client
 *   - Helmet sets strict security headers
 *   - CORS restricted to known origins
 *   - Rate limiting on payment creation (in-process, per IP)
 *   - Raw body captured for webhook HMAC verification
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
    contentSecurityPolicy: false,
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
const rateMap = new Map();
const RATE_LIMIT_MAX    = 10;
const RATE_LIMIT_WINDOW = 60_000;

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
    const safePath = req.path.replace(/\/[0-9a-f-]{36}/g, '/<uuid>').replace(/\/\d{6,}/g, '/<id>');
    console.log(`[${new Date().toISOString()}] ${req.method} ${safePath}`);
    next();
});

// ── Health ─────────────────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
    const token = process.env.MP_ACCESS_TOKEN;
    res.json({
        status:        'ok',
        service:       'SulMotor Payment API v3',
        mp_configured: !!token,
        mp_key_prefix: token ? `${token.slice(0, 12)}…` : null,
        supabase_url:  process.env.SUPABASE_URL ? 'set' : 'missing',
        node_env:      process.env.NODE_ENV ?? 'development',
        timestamp:     new Date().toISOString(),
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

// ── Orders (authenticated) ────────────────────────────────────────────────────
app.post('/api/orders/create',    createOrder);
app.get('/api/orders/user/list',  listUserOrders);
app.get('/api/orders/:id',        getOrder);

// ── Payment creation (rate-limited) ──────────────────────────────────────────
app.post('/api/payments/create', paymentRateLimit, newCreatePayment);
app.post('/api/create-payment',  paymentRateLimit, legacyCreatePayment);

// ── Payment status polling ────────────────────────────────────────────────────
app.get('/api/payment-status/:payment_id', paymentStatusHandler);

// ── Webhooks ──────────────────────────────────────────────────────────────────
app.post('/api/webhooks/mercadopago', webhookHandler);  // canonical
app.post('/api/webhook/mercadopago',  webhookHandler);  // legacy alias

// ── Cron ──────────────────────────────────────────────────────────────────────
app.post('/api/cron/expire-boosts', expireBoosts);

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
    console.log(`   Health:       GET  /api/health`);
    console.log(`   Plans:        GET  /api/boost-plans`);
    console.log(`   Order create: POST /api/orders/create`);
    console.log(`   Order list:   GET  /api/orders/user/list`);
    console.log(`   Order get:    GET  /api/orders/:id`);
    console.log(`   Pay create:   POST /api/payments/create`);
    console.log(`   Pay status:   GET  /api/payment-status/:id`);
    console.log(`   Webhook:      POST /api/webhooks/mercadopago`);
    console.log(`   Cron:         POST /api/cron/expire-boosts\n`);
    if (!process.env.MP_ACCESS_TOKEN)   console.warn('⚠️  MP_ACCESS_TOKEN not set');
    if (!process.env.MP_WEBHOOK_SECRET) console.warn('⚠️  MP_WEBHOOK_SECRET not set – signatures will NOT be verified');
    if (!process.env.SUPABASE_SERVICE_KEY) console.warn('⚠️  SUPABASE_SERVICE_KEY not set – DB writes from webhooks disabled');
});

module.exports = app;
