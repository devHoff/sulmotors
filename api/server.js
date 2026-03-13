'use strict';

/**
 * api/server.js
 * ─────────────────────────────────────────────────────────────────────────────
 * SulMotor – Mercado Pago Payment API Server
 *
 * Routes:
 *   POST /api/create-payment              → Create PIX (or card) payment
 *   GET  /api/payment-status/:payment_id  → Poll payment status
 *   POST /api/webhook/mercadopago         → Receive MP event notifications
 *   GET  /api/health                      → Liveness probe
 *
 * Env vars (see .env.server):
 *   PORT              default 3001
 *   MP_ACCESS_TOKEN   required
 *   MP_PUBLIC_KEY     required (used by frontend via /api/mp-public-key)
 *   MP_WEBHOOK_SECRET optional – enables signature verification
 *   ALLOWED_ORIGIN    default http://localhost:5173
 *
 * Start:
 *   node api/server.js
 *   # or with auto-reload:
 *   npx nodemon api/server.js
 */

require('dotenv').config({ path: '.env.server' });

const express = require('express');
const cors    = require('cors');
const helmet  = require('helmet');

const { createPaymentHandler }  = require('./mercadopago/create-payment');
const { paymentStatusHandler }  = require('./mercadopago/payment-status');
const { webhookHandler }        = require('./mercadopago/webhook');

// ── App setup ──────────────────────────────────────────────────────────────────
const app  = express();
const PORT = process.env.PORT || 3001;

// ── Security headers ──────────────────────────────────────────────────────────
app.use(helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

// ── CORS ──────────────────────────────────────────────────────────────────────
const allowedOrigins = (process.env.ALLOWED_ORIGIN ?? 'http://localhost:5173')
    .split(',')
    .map(o => o.trim())
    .filter(Boolean);

app.use(cors({
    origin(origin, callback) {
        // Allow same-origin requests (no Origin header) and explicitly allowed origins
        if (!origin || allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
            return callback(null, true);
        }
        console.warn(`[CORS] Blocked origin: ${origin}`);
        return callback(new Error(`Origin "${origin}" not allowed by CORS policy.`));
    },
    methods:     ['GET', 'POST', 'OPTIONS'],
    credentials: true,
}));

// ── JSON body parser with raw body capture for webhook ───────────────────────
// Using express.json with verify callback to capture raw body for signature check
app.use(express.json({
    limit: '1mb',
    verify(req, _res, buf) {
        // Store raw body on all requests so the webhook handler can verify it
        req.rawBody = buf.toString('utf8');
    },
}));

// ── Request logger ────────────────────────────────────────────────────────────
app.use((req, _res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
    next();
});

// ── Routes ────────────────────────────────────────────────────────────────────

/** Health check */
app.get('/api/health', (_req, res) => {
    const token = process.env.MP_ACCESS_TOKEN;
    res.json({
        status:  'ok',
        service: 'SulMotor Payment API',
        mp_configured: !!token,
        mp_token_prefix: token ? `${token.slice(0, 12)}...` : null,
        timestamp: new Date().toISOString(),
    });
});

/**
 * Returns the public MP key so the frontend can initialise the MP JS SDK
 * without embedding it in the Vite build.
 * NOTE: the public key is NOT a secret, but we still serve it from the
 * backend so it can be rotated centrally.
 */
app.get('/api/mp-public-key', (_req, res) => {
    const key = process.env.MP_PUBLIC_KEY;
    if (!key) return res.status(503).json({ error: 'MP_PUBLIC_KEY não configurado.' });
    res.json({ public_key: key });
});

/** Create PIX / card payment */
app.post('/api/create-payment', createPaymentHandler);

/** Poll payment status */
app.get('/api/payment-status/:payment_id', paymentStatusHandler);

/** Receive Mercado Pago webhook notifications */
app.post('/api/webhook/mercadopago', webhookHandler);

// ── 404 fallback ──────────────────────────────────────────────────────────────
app.use((_req, res) => {
    res.status(404).json({ error: 'Endpoint não encontrado.' });
});

// ── Global error handler ──────────────────────────────────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
    console.error('[server] Unhandled error:', err?.message ?? err);
    res.status(500).json({ error: 'Erro interno do servidor.' });
});

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n🚀 SulMotor Payment API running on http://0.0.0.0:${PORT}`);
    console.log(`   Health : http://localhost:${PORT}/api/health`);
    console.log(`   PIX    : POST http://localhost:${PORT}/api/create-payment`);
    console.log(`   Status : GET  http://localhost:${PORT}/api/payment-status/:id`);
    console.log(`   Webhook: POST http://localhost:${PORT}/api/webhook/mercadopago\n`);
    if (!process.env.MP_ACCESS_TOKEN) {
        console.warn('⚠️  MP_ACCESS_TOKEN not set – payment calls will fail.');
    }
});

module.exports = app; // for testing
