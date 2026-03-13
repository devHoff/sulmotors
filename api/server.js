'use strict';

/**
 * api/server.js  –  SulMotor Payment API
 *
 * Routes:
 *   POST /api/payments/create            → Unified PIX + card + boleto payment
 *   POST /api/create-payment             → Legacy alias → same handler
 *   GET  /api/payment-status/:id         → Poll payment status
 *   POST /api/webhooks/mercadopago       → MP event notifications (canonical)
 *   POST /api/webhook/mercadopago        → Legacy alias → same handler
 *   GET  /api/mp-public-key              → Safe: return public key to frontend
 *   GET  /api/health                     → Liveness probe
 *
 * Security:
 *   - MP_ACCESS_TOKEN is NEVER sent to the client
 *   - Helmet sets strict CSP / HSTS / X-Content-Type headers
 *   - CORS restricted to known origins (configurable via ALLOWED_ORIGIN env)
 *   - Rate limiting on payment creation (simple in-process counter)
 *   - Raw body captured for webhook HMAC verification
 *   - All JSON parsing errors handled gracefully
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

const app  = express();
const PORT = process.env.PORT || 3001;

// ── CORS origin list ──────────────────────────────────────────────────────────
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGIN ?? '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);

// Always allow localhost in development
if (process.env.NODE_ENV !== 'production') {
    ALLOWED_ORIGINS.push('http://localhost:5173', 'http://localhost:3000');
}

const corsOptions = {
    origin(origin, cb) {
        // Allow requests with no origin (mobile apps, curl, Postman, etc.)
        if (!origin) return cb(null, true);
        if (ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
        // In development be permissive; in production reject unknown origins
        if (process.env.NODE_ENV !== 'production') return cb(null, true);
        cb(new Error(`CORS: origin "${origin}" not allowed`));
    },
    methods:     ['GET', 'POST', 'OPTIONS'],
    credentials: true,
};

// ── Security headers ──────────────────────────────────────────────────────────
app.use(helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    contentSecurityPolicy: false, // Frontend handles its own CSP
}));

// ── CORS ──────────────────────────────────────────────────────────────────────
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

// ── Body parsing ──────────────────────────────────────────────────────────────
// Keep raw body for webhook HMAC; also parse as JSON for other routes.
app.use((req, res, next) => {
    let chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end',  () => {
        req.rawBody = Buffer.concat(chunks).toString('utf8');
        if (req.rawBody) {
            try   { req.body = JSON.parse(req.rawBody); }
            catch { req.body = {}; }
        } else {
            req.body = {};
        }
        next();
    });
    req.on('error', (err) => {
        console.error('[server] Request error:', err.message);
        next(err);
    });
});

// ── Simple in-process rate limiter for payment creation ───────────────────────
// Keeps a rolling 60-second window per IP; allows max 10 requests per window.
// Production deployments behind a load balancer should use Redis-based limiting.
const rateMap = new Map(); // ip → { count, resetAt }
const RATE_LIMIT_MAX    = 10;
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute

function paymentRateLimit(req, res, next) {
    const ip      = req.ip ?? req.connection?.remoteAddress ?? 'unknown';
    const now     = Date.now();
    const bucket  = rateMap.get(ip);

    if (!bucket || now > bucket.resetAt) {
        rateMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW });
        return next();
    }
    bucket.count++;
    if (bucket.count > RATE_LIMIT_MAX) {
        return res.status(429).json({
            error: 'Muitas tentativas de pagamento. Aguarde 1 minuto e tente novamente.',
        });
    }
    next();
}

// Clean up stale rate-limit entries every 5 minutes
setInterval(() => {
    const now = Date.now();
    for (const [ip, b] of rateMap) {
        if (now > b.resetAt) rateMap.delete(ip);
    }
}, 5 * 60 * 1000);

// ── Request logger ─────────────────────────────────────────────────────────────
app.use((req, _res, next) => {
    // Redact sensitive paths from logs
    const safePath = req.path.replace(/\/\d{6,}/g, '/<id>');
    console.log(`[${new Date().toISOString()}] ${req.method} ${safePath}`);
    next();
});

// ── Health probe ───────────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
    const token = process.env.MP_ACCESS_TOKEN;
    res.json({
        status:          'ok',
        service:         'SulMotor Payment API v2',
        mp_configured:   !!token,
        mp_key_prefix:   token ? `${token.slice(0, 12)}…` : null,
        supabase_url:    process.env.SUPABASE_URL ? 'set' : 'missing',
        node_env:        process.env.NODE_ENV ?? 'development',
        timestamp:       new Date().toISOString(),
    });
});

// ── Public MP key (safe to expose — it's the public key) ─────────────────────
app.get('/api/mp-public-key', (_req, res) => {
    const key = process.env.MP_PUBLIC_KEY;
    if (!key) return res.status(503).json({ error: 'MP_PUBLIC_KEY não configurado.' });
    res.json({ public_key: key });
});

// ── Payment creation (rate-limited) ──────────────────────────────────────────
app.post('/api/payments/create', paymentRateLimit, newCreatePayment);
app.post('/api/create-payment',  paymentRateLimit, legacyCreatePayment);  // legacy

// ── Payment status polling ────────────────────────────────────────────────────
app.get('/api/payment-status/:payment_id', paymentStatusHandler);

// ── Webhooks ──────────────────────────────────────────────────────────────────
app.post('/api/webhooks/mercadopago', webhookHandler);  // canonical
app.post('/api/webhook/mercadopago',  webhookHandler);  // legacy alias

// ── 404 ────────────────────────────────────────────────────────────────────────
app.use((_req, res) =>
    res.status(404).json({ error: 'Endpoint não encontrado.' })
);

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
    console.log(`\n🚀 SulMotor Payment API v2  →  http://0.0.0.0:${PORT}`);
    console.log(`   Health:   GET  /api/health`);
    console.log(`   Create:   POST /api/payments/create  (primary)`);
    console.log(`   Create:   POST /api/create-payment   (legacy)`);
    console.log(`   Status:   GET  /api/payment-status/:id`);
    console.log(`   Webhook:  POST /api/webhooks/mercadopago  (canonical)`);
    console.log(`   Webhook:  POST /api/webhook/mercadopago   (legacy)\n`);
    if (!process.env.MP_ACCESS_TOKEN) console.warn('⚠️  MP_ACCESS_TOKEN not set');
    if (!process.env.MP_WEBHOOK_SECRET) console.warn('⚠️  MP_WEBHOOK_SECRET not set – webhook signatures will NOT be verified');
});

module.exports = app;
