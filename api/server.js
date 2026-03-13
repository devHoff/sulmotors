'use strict';

/**
 * api/server.js  –  SulMotor Payment API
 *
 * Routes:
 *   POST /api/create-payment              → Create PIX or card payment
 *   GET  /api/payment-status/:payment_id  → Poll payment status
 *   POST /api/webhook/mercadopago         → MP event notifications
 *   GET  /api/mp-public-key               → Return MP public key to frontend
 *   GET  /api/health                      → Liveness probe
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env.server') });

const express = require('express');
const cors    = require('cors');
const helmet  = require('helmet');

const { createPaymentHandler } = require('./mercadopago/create-payment');
const { paymentStatusHandler } = require('./mercadopago/payment-status');
const { webhookHandler }       = require('./mercadopago/webhook');

const app  = express();
const PORT = process.env.PORT || 3001;

// ── Security headers ───────────────────────────────────────────────────────────
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));

// ── CORS — allow ALL origins (sandbox + production) ───────────────────────────
// We trust the Vite proxy in dev, and nginx/cloudflare in prod.
// The MP API token is server-side only, so open CORS is safe here.
app.use(cors({
    origin: true,           // reflect any origin
    methods: ['GET', 'POST', 'OPTIONS'],
    credentials: true,
}));
app.options('*', cors());   // handle pre-flight for all routes

// ── Raw body capture for webhook signature + JSON parser ──────────────────────
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

// ── MP Public Key (safe to expose) ────────────────────────────────────────────
app.get('/api/mp-public-key', (_req, res) => {
    const key = process.env.MP_PUBLIC_KEY;
    if (!key) return res.status(503).json({ error: 'MP_PUBLIC_KEY não configurado.' });
    res.json({ public_key: key });
});

// ── Payment routes ────────────────────────────────────────────────────────────
app.post('/api/create-payment',            createPaymentHandler);
app.get('/api/payment-status/:payment_id', paymentStatusHandler);
app.post('/api/webhook/mercadopago',       webhookHandler);

// ── 404 ────────────────────────────────────────────────────────────────────────
app.use((_req, res) => res.status(404).json({ error: 'Endpoint não encontrado.' }));

// ── Global error handler ───────────────────────────────────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
    console.error('[server] Unhandled error:', err?.message ?? err);
    // Never return CORS error as 500 — return proper status
    if (err?.message?.includes('CORS') || err?.message?.includes('not allowed')) {
        return res.status(403).json({ error: err.message });
    }
    res.status(500).json({ error: 'Erro interno do servidor.' });
});

// ── Start ──────────────────────────────────────────────────────────────────────
app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n🚀 SulMotor Payment API  →  http://0.0.0.0:${PORT}`);
    console.log(`   Health  : GET  /api/health`);
    console.log(`   PIX/Card: POST /api/create-payment`);
    console.log(`   Status  : GET  /api/payment-status/:id`);
    console.log(`   Webhook : POST /api/webhook/mercadopago\n`);
    if (!process.env.MP_ACCESS_TOKEN) console.warn('⚠️  MP_ACCESS_TOKEN not set');
});

module.exports = app;
