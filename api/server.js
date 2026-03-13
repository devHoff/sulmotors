'use strict';

/**
 * api/server.js  –  SulMotor Payment API
 *
 * Routes:
 *   POST /api/payments/create              → Unified PIX + card payment (new)
 *   POST /api/create-payment               → Legacy alias → same handler
 *   GET  /api/payment-status/:payment_id   → Poll payment status
 *   POST /api/webhooks/mercadopago         → MP event notifications (new)
 *   POST /api/webhook/mercadopago          → Legacy alias → same handler
 *   GET  /api/mp-public-key                → Return MP public key to frontend
 *   GET  /api/health                       → Liveness probe
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env.server') });

const express = require('express');
const cors    = require('cors');
const helmet  = require('helmet');

// ── Handlers ───────────────────────────────────────────────────────────────────
const { createPaymentHandler: legacyCreatePayment } = require('./mercadopago/create-payment');
const { createPaymentHandler: newCreatePayment }     = require('./mercadopago/payments');
const { paymentStatusHandler }                       = require('./mercadopago/payment-status');
const { webhookHandler: legacyWebhook }              = require('./mercadopago/webhook');
const { webhookHandler: newWebhook }                 = require('./mercadopago/webhooks');

const app  = express();
const PORT = process.env.PORT || 3001;

// ── Security headers ───────────────────────────────────────────────────────────
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));

// ── CORS — allow ALL origins ───────────────────────────────────────────────────
// Access Token is server-side only; public key is intentionally public.
// Vite proxies /api → localhost:3001 in dev; nginx/cloudflare handles prod.
app.use(cors({
    origin:      true,    // reflect any origin
    methods:     ['GET', 'POST', 'OPTIONS'],
    credentials: true,
}));
app.options('*', cors());   // handle pre-flight for all routes

// ── Raw body + JSON parser ────────────────────────────────────────────────────
// Needed for webhook HMAC verification (raw body) + JSON routes.
app.use((req, res, next) => {
    let data = '';
    req.on('data', chunk => { data += chunk; });
    req.on('end', () => {
        req.rawBody = data;
        if (data) {
            try { req.body = JSON.parse(data); }
            catch { req.body = {}; }
        } else {
            req.body = {};
        }
        next();
    });
});

// ── Request logger ─────────────────────────────────────────────────────────────
app.use((req, _res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
    next();
});

// ── Health ─────────────────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
    const token = process.env.MP_ACCESS_TOKEN;
    res.json({
        status:          'ok',
        service:         'SulMotor Payment API',
        mp_configured:   !!token,
        mp_token_prefix: token ? `${token.slice(0, 12)}...` : null,
        timestamp:       new Date().toISOString(),
    });
});

// ── MP Public Key (safe to expose to frontend) ────────────────────────────────
app.get('/api/mp-public-key', (_req, res) => {
    const key = process.env.MP_PUBLIC_KEY;
    if (!key) return res.status(503).json({ error: 'MP_PUBLIC_KEY não configurado.' });
    res.json({ public_key: key });
});

// ── Primary payment endpoint (Transparent Checkout) ──────────────────────────
app.post('/api/payments/create', newCreatePayment);

// ── Legacy endpoint (kept for backward compat) ───────────────────────────────
app.post('/api/create-payment', legacyCreatePayment);

// ── Payment status polling ────────────────────────────────────────────────────
app.get('/api/payment-status/:payment_id', paymentStatusHandler);

// ── Webhook endpoints ─────────────────────────────────────────────────────────
app.post('/api/webhooks/mercadopago', newWebhook);      // new canonical path
app.post('/api/webhook/mercadopago',  legacyWebhook);   // old path (legacy)

// ── 404 ────────────────────────────────────────────────────────────────────────
app.use((_req, res) => res.status(404).json({ error: 'Endpoint não encontrado.' }));

// ── Global error handler ───────────────────────────────────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
    console.error('[server] Unhandled error:', err?.message ?? err);
    res.status(500).json({ error: 'Erro interno do servidor.' });
});

// ── Start ──────────────────────────────────────────────────────────────────────
app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n🚀 SulMotor Payment API  →  http://0.0.0.0:${PORT}`);
    console.log(`   Health    : GET  /api/health`);
    console.log(`   Payments  : POST /api/payments/create     ← primary`);
    console.log(`   Legacy    : POST /api/create-payment      ← compat`);
    console.log(`   Status    : GET  /api/payment-status/:id`);
    console.log(`   Webhook   : POST /api/webhooks/mercadopago  ← primary`);
    console.log(`   Webhook   : POST /api/webhook/mercadopago   ← legacy\n`);
    if (!process.env.MP_ACCESS_TOKEN) console.warn('⚠️  MP_ACCESS_TOKEN not set');
});

module.exports = app;
