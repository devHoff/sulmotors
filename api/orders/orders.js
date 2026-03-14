'use strict';

/**
 * api/orders/orders.js
 *
 * Order management API:
 *   POST /api/orders/create       — Create a new pending order
 *   GET  /api/orders/:id          — Get order by ID (owner only via JWT)
 *   GET  /api/orders/user/list    — List all orders for the authenticated user
 *   GET  /api/boost-plans         — List all active boost plans (public)
 */

const SUPABASE_URL = () => process.env.SUPABASE_URL;
const SERVICE_KEY  = () => process.env.SUPABASE_SERVICE_KEY;
const ANON_KEY     = () => process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ── Supabase REST helpers ─────────────────────────────────────────────────────

function sbHeaders(jwtToken) {
    const key = SERVICE_KEY();
    return {
        'Content-Type':  'application/json',
        'apikey':        key,
        'Authorization': jwtToken ? `Bearer ${jwtToken}` : `Bearer ${key}`,
        'Prefer':        'return=representation',
    };
}

async function sbGet(path, params = {}, jwt) {
    const url = new URL(`${SUPABASE_URL()}/rest/v1/${path}`);
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    const res  = await fetch(url.toString(), { headers: sbHeaders(jwt) });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.message || data?.error || `Supabase GET ${path} → ${res.status}`);
    return data;
}

async function sbPost(path, body, jwt) {
    const res  = await fetch(`${SUPABASE_URL()}/rest/v1/${path}`, {
        method:  'POST',
        headers: sbHeaders(jwt),
        body:    JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.message || data?.error || `Supabase POST ${path} → ${res.status}`);
    return Array.isArray(data) ? data[0] : data;
}

async function sbPatch(path, filter, body, jwt) {
    const url = new URL(`${SUPABASE_URL()}/rest/v1/${path}`);
    for (const [k, v] of Object.entries(filter)) url.searchParams.set(k, v);
    const res  = await fetch(url.toString(), {
        method:  'PATCH',
        headers: sbHeaders(jwt),
        body:    JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.message || data?.error || `Supabase PATCH ${path} → ${res.status}`);
    return data;
}

// ── Extract JWT from Authorization header ─────────────────────────────────────
function extractJWT(req) {
    const auth = req.headers['authorization'] ?? '';
    if (auth.startsWith('Bearer ')) return auth.slice(7);
    return null;
}

// ── Verify JWT user_id using Supabase /auth/v1/user ──────────────────────────
async function getUserFromJWT(jwt) {
    if (!jwt) return null;
    const res  = await fetch(`${SUPABASE_URL()}/auth/v1/user`, {
        headers: {
            'apikey':        SERVICE_KEY(),
            'Authorization': `Bearer ${jwt}`,
        },
    });
    if (!res.ok) return null;
    return res.json();
}

// ── GET /api/boost-plans ──────────────────────────────────────────────────────
async function getBoostPlans(_req, res) {
    try {
        const url = SUPABASE_URL();
        const key = SERVICE_KEY();
        if (!url || !key) {
            // Fallback static plans when Supabase is not configured
            return res.json({ plans: STATIC_PLANS });
        }
        const plans = await sbGet('boost_plans', { 'active=eq.true': '', order: 'priority_level.asc' });
        return res.json({ plans });
    } catch (err) {
        console.warn('[boost-plans] Supabase unavailable, returning static plans:', err.message);
        return res.json({ plans: STATIC_PLANS });
    }
}

// ── Static fallback plans ─────────────────────────────────────────────────────
const STATIC_PLANS = [
    { id: 'basic_boost',   name: 'basic_boost',   label: 'Básico',  price: 19.90,  duration_days: 7,  priority_level: 1 },
    { id: 'premium_boost', name: 'premium_boost', label: 'Premium', price: 39.90,  duration_days: 15, priority_level: 2 },
    { id: 'ultra_boost',   name: 'ultra_boost',   label: 'Ultra',   price: 79.90,  duration_days: 30, priority_level: 3 },
];

// ── POST /api/orders/create ───────────────────────────────────────────────────
async function createOrder(req, res) {
    try {
        const jwt = extractJWT(req);
        const user = await getUserFromJWT(jwt);
        if (!user?.id) {
            return res.status(401).json({ error: 'Autenticação necessária.' });
        }

        const { listing_id, plan_type } = req.body ?? {};

        if (!listing_id || !UUID_RE.test(listing_id)) {
            return res.status(400).json({ error: 'listing_id inválido.' });
        }

        const validPlans = STATIC_PLANS.map(p => p.name);
        if (!plan_type || !validPlans.includes(plan_type)) {
            return res.status(400).json({ error: `plan_type inválido. Use: ${validPlans.join(', ')}.` });
        }

        // Verify the listing belongs to the user
        let listing;
        try {
            const rows = await sbGet('anuncios', {
                'id=eq': listing_id,
                select: 'id,user_id,marca,modelo,ano',
            }, jwt);
            listing = Array.isArray(rows) ? rows[0] : rows;
        } catch (e) {
            return res.status(404).json({ error: 'Anúncio não encontrado.' });
        }

        if (!listing || listing.user_id !== user.id) {
            return res.status(403).json({ error: 'Sem permissão para impulsionar este anúncio.' });
        }

        // Get plan price (from DB or static fallback)
        let plan = STATIC_PLANS.find(p => p.name === plan_type);
        try {
            const rows = await sbGet('boost_plans', {
                'name=eq': plan_type,
                'active=eq.true': '',
                select: 'id,name,label,price,duration_days,priority_level',
            });
            if (Array.isArray(rows) && rows[0]) plan = rows[0];
        } catch { /* use static fallback */ }

        // Cancel any existing pending orders for this listing (prevent duplicates)
        try {
            await sbPatch('orders',
                { 'user_id=eq': user.id, 'listing_id=eq': listing_id, 'status=eq.pending': '' },
                { status: 'cancelled', updated_at: new Date().toISOString() }
            );
        } catch { /* non-fatal */ }

        // Create the order
        const order = await sbPost('orders', {
            user_id:    user.id,
            listing_id,
            plan_type,
            amount:     plan.price,
            currency:   'BRL',
            status:     'pending',
            metadata: {
                plan_label:     plan.label,
                duration_days:  plan.duration_days,
                priority_level: plan.priority_level,
                listing_label:  `${listing.marca} ${listing.modelo} ${listing.ano}`,
            },
        });

        console.log(`[orders/create] ✅ order=${order.id} user=${user.id} listing=${listing_id} plan=${plan_type} amount=${plan.price}`);

        return res.status(201).json({
            order_id:           order.id,
            external_reference: `${order.id}:${listing_id}`,
            plan,
            amount:             plan.price,
            currency:           'BRL',
        });

    } catch (err) {
        console.error('[orders/create] ❌', err.message);
        return res.status(500).json({ error: 'Erro ao criar pedido. Tente novamente.' });
    }
}

// ── GET /api/orders/:id ───────────────────────────────────────────────────────
async function getOrder(req, res) {
    try {
        const jwt = extractJWT(req);
        const user = await getUserFromJWT(jwt);
        if (!user?.id) return res.status(401).json({ error: 'Autenticação necessária.' });

        const { id } = req.params;
        if (!id || !UUID_RE.test(id)) return res.status(400).json({ error: 'ID inválido.' });

        const rows = await sbGet('orders', {
            'id=eq': id,
            'user_id=eq': user.id,
            select: '*',
        }, jwt);

        const order = Array.isArray(rows) ? rows[0] : rows;
        if (!order) return res.status(404).json({ error: 'Pedido não encontrado.' });

        return res.json({ order });

    } catch (err) {
        console.error('[orders/get] ❌', err.message);
        return res.status(500).json({ error: 'Erro ao buscar pedido.' });
    }
}

// ── GET /api/orders/user/list ─────────────────────────────────────────────────
async function listUserOrders(req, res) {
    try {
        const jwt = extractJWT(req);
        const user = await getUserFromJWT(jwt);
        if (!user?.id) return res.status(401).json({ error: 'Autenticação necessária.' });

        const url = `${SUPABASE_URL()}/rest/v1/orders?user_id=eq.${user.id}&order=created_at.desc&select=*,listing_boosts(*)`;
        const response = await fetch(url, { headers: sbHeaders(jwt) });
        const orders   = await response.json();

        // Enrich with listing data
        const enriched = await Promise.all((orders || []).map(async (o) => {
            try {
                const lRows = await sbGet('anuncios', {
                    'id=eq': o.listing_id,
                    select: 'id,marca,modelo,ano,imagens',
                });
                const listing = Array.isArray(lRows) ? lRows[0] : lRows;
                return { ...o, listing };
            } catch { return o; }
        }));

        return res.json({ orders: enriched });

    } catch (err) {
        console.error('[orders/list] ❌', err.message);
        return res.status(500).json({ error: 'Erro ao listar pedidos.' });
    }
}

// ── POST /api/cron/expire-boosts ─────────────────────────────────────────────
/**
 * HTTP handler for the cron endpoint.
 * Called by:
 *   • The internal node-cron scheduler (api/cron/expire-boosts.js)
 *   • GitHub Actions workflow (.github/workflows/cron-expire-boosts.yml)
 *   • Vercel Cron (vercel.json)
 *   • Any external scheduler via HTTP POST with x-cron-secret header
 *
 * Security:
 *   • Requires x-cron-secret header matching CRON_SECRET_KEY env var.
 *   • Internal calls (same process, req === null) bypass HTTP auth.
 *   • Returns HTTP 403 if secret is missing or wrong.
 *   • Returns HTTP 503 if Supabase is not configured.
 */
async function expireBoosts(req, res) {
    const ts = new Date().toISOString();

    // ── Security: validate x-cron-secret ──────────────────────────────────────
    const expectedSecret = process.env.CRON_SECRET_KEY || process.env.CRON_SECRET;
    const receivedSecret = req?.headers?.['x-cron-secret'];

    if (expectedSecret) {
        if (!receivedSecret) {
            console.warn(`[cron] ${ts} ⛔ Missing x-cron-secret header`);
            return res?.status(403).json({ error: 'Forbidden: missing cron secret.' });
        }
        if (receivedSecret !== expectedSecret) {
            console.warn(`[cron] ${ts} ⛔ Invalid x-cron-secret`);
            return res?.status(403).json({ error: 'Forbidden: invalid cron secret.' });
        }
    } else {
        console.warn(`[cron] ${ts} ⚠️  CRON_SECRET_KEY not set – endpoint is unprotected!`);
    }

    // ── Supabase availability check ────────────────────────────────────────────
    const sbUrl = SUPABASE_URL();
    const sbKey = SERVICE_KEY();

    if (!sbUrl || !sbKey) {
        const msg = 'Supabase SUPABASE_URL or SUPABASE_SERVICE_KEY not configured.';
        console.error(`[cron] ${ts} ❌ ${msg}`);
        return res?.status(503).json({ error: msg });
    }

    // ── Execute expire_boosts() ────────────────────────────────────────────────
    console.log(`[cron] ${ts} ▶  expire_boosts() starting…`);

    try {
        const rpcRes = await fetch(`${sbUrl}/rest/v1/rpc/expire_boosts`, {
            method:  'POST',
            headers: {
                'Content-Type':  'application/json',
                'apikey':        sbKey,
                'Authorization': `Bearer ${sbKey}`,
                'Prefer':        'return=representation',
            },
            body: JSON.stringify({}),
        });

        const raw = await rpcRes.text();

        if (!rpcRes.ok) {
            const errBody = (() => { try { return JSON.parse(raw); } catch { return { raw }; } })();
            throw new Error(errBody?.message || errBody?.error || `Supabase RPC → HTTP ${rpcRes.status}: ${raw}`);
        }

        // expire_boosts() returns the integer count of deactivated boosts
        const expiredCount = (() => {
            try { return Number(JSON.parse(raw)); } catch { return 0; }
        })();

        console.log(`[cron] ${ts} ✅ expire_boosts executed successfully`);
        console.log(`[cron] ${ts} 📊 expired_boost_count = ${expiredCount}`);

        // ── Optional: insert analytics event for each expiration batch ────────
        if (expiredCount > 0) {
            try {
                await fetch(`${sbUrl}/rest/v1/analytics_events`, {
                    method:  'POST',
                    headers: {
                        'Content-Type':  'application/json',
                        'apikey':        sbKey,
                        'Authorization': `Bearer ${sbKey}`,
                        'Prefer':        'return=minimal',
                    },
                    body: JSON.stringify({
                        event_name: 'boost_expired',
                        properties: {
                            expired_count: expiredCount,
                            triggered_at:  ts,
                            source:        'cron/expire-boosts',
                        },
                    }),
                });
                console.log(`[cron] ${ts} 📝 analytics event "boost_expired" recorded (count=${expiredCount})`);
            } catch (analyticsErr) {
                // Non-fatal — log but don't fail the cron run
                console.warn(`[cron] ${ts} ⚠️  analytics insert failed (non-fatal): ${analyticsErr.message}`);
            }
        }

        const payload = {
            success:       true,
            expired_boosts: expiredCount,
            executed_at:   ts,
        };

        if (res) return res.json(payload);
        return payload;  // internal call (no HTTP response object)

    } catch (err) {
        console.error(`[cron] ${ts} ❌ expire_boosts failed: ${err.message}`);

        if (res) return res.status(500).json({
            success: false,
            error:   err.message,
            executed_at: ts,
        });
        throw err;  // re-throw for internal callers to handle
    }
}

// ── Internal direct caller (no HTTP req/res, used by node-cron) ──────────────
/**
 * Calls expire_boosts() directly without HTTP overhead.
 * Returns { success, expired_boosts, executed_at } or throws.
 */
async function runExpireBoostsDirect() {
    return expireBoosts(
        { headers: { 'x-cron-secret': process.env.CRON_SECRET_KEY || process.env.CRON_SECRET || '' } },
        null,
    );
}

module.exports = {
    getBoostPlans,
    createOrder,
    getOrder,
    listUserOrders,
    expireBoosts,
    runExpireBoostsDirect,
    STATIC_PLANS,
};
