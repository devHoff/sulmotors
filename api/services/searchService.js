'use strict';
/**
 * api/services/searchService.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Server-side search service.
 * Routes search queries to the Supabase RPC `get_listings_ranked()`
 * with an in-process memory cache (TTL 60 s).
 *
 * Cache key strategy:
 *   cache:home:listings          → no filters, page 1
 *   cache:search:{djb2hash}      → filtered queries
 *
 * Used by:
 *   • GET /api/listings/search   (to be registered in server.js)
 */

// ── In-process cache (Map-based LRU, TTL 60 s) ───────────────────────────────
const CACHE_TTL_MS = 60_000;
const CACHE_MAX    = 200;
const cache        = new Map();

function cacheGet(key) {
    const entry = cache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) { cache.delete(key); return null; }
    return entry.data;
}

function cacheSet(key, data) {
    if (cache.size >= CACHE_MAX) {
        const firstKey = cache.keys().next().value;
        if (firstKey) cache.delete(firstKey);
    }
    cache.set(key, { data, expiresAt: Date.now() + CACHE_TTL_MS });
}

// ── Hash function (djb2) ──────────────────────────────────────────────────────
function djb2Hash(str) {
    let hash = 5381;
    for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) + hash) ^ str.charCodeAt(i);
        hash = hash & hash;
    }
    return (hash >>> 0).toString(16);
}

function buildCacheKey(filters) {
    const { query = '', marca = '', modelo = '', cidade = '',
            yearMin = '', yearMax = '', priceMin = '', priceMax = '',
            page = 1, pageSize = 20, sortBy = 'ranking' } = filters;

    const hasFilters = query || marca || modelo || cidade ||
                       yearMin || yearMax || priceMin || priceMax;

    if (!hasFilters && page === 1) return 'cache:home:listings';

    const str = JSON.stringify({ query, marca, modelo, cidade, yearMin,
                                  yearMax, priceMin, priceMax, page, pageSize, sortBy });
    return `cache:search:${djb2Hash(str)}`;
}

// ── Supabase helpers ──────────────────────────────────────────────────────────
const SUPABASE_URL = () => process.env.SUPABASE_URL;
const SERVICE_KEY  = () => process.env.SUPABASE_SERVICE_KEY;

async function rpc(fnName, params = {}) {
    const res = await fetch(`${SUPABASE_URL()}/rest/v1/rpc/${fnName}`, {
        method:  'POST',
        headers: {
            'Content-Type':  'application/json',
            'apikey':        SERVICE_KEY(),
            'Authorization': `Bearer ${SERVICE_KEY()}`,
        },
        body:    JSON.stringify(params),
    });
    const raw = await res.text();
    if (!res.ok) {
        const err = (() => { try { return JSON.parse(raw); } catch { return { raw }; } })();
        throw new Error(err?.message || err?.error || `RPC ${fnName} → HTTP ${res.status}`);
    }
    try { return JSON.parse(raw) ?? []; } catch { return []; }
}

// ── Main search handler (Express middleware) ──────────────────────────────────
async function searchHandler(req, res) {
    const {
        query, marca, modelo, cidade, estado,
        year_min: yearMin, year_max: yearMax,
        price_min: priceMin, price_max: priceMax,
        page = '1', page_size: pageSize = '20',
        sort_by: sortBy = 'ranking',
    } = req.query;

    const filters = {
        query:    query    || null,
        marca:    marca    || null,
        modelo:   modelo   || null,
        cidade:   cidade   || null,
        estado:   estado   || null,
        yearMin:  yearMin  ? Number(yearMin)  : null,
        yearMax:  yearMax  ? Number(yearMax)  : null,
        priceMin: priceMin ? Number(priceMin) : null,
        priceMax: priceMax ? Number(priceMax) : null,
        page:     Math.max(1, Number(page)),
        pageSize: Math.min(100, Math.max(1, Number(pageSize))),
        sortBy:   sortBy || 'ranking',
    };

    const cacheKey = buildCacheKey(filters);

    // Cache hit
    const cached = cacheGet(cacheKey);
    if (cached) {
        return res.json({ ...cached, from_cache: true, cache_key: cacheKey });
    }

    try {
        const all = await rpc('get_listings_ranked', {
            p_marca:     filters.marca,
            p_modelo:    filters.modelo,
            p_year_min:  filters.yearMin,
            p_year_max:  filters.yearMax,
            p_price_min: filters.priceMin,
            p_price_max: filters.priceMax,
            p_cidade:    filters.cidade,
            p_query:     filters.query,
            p_limit:     500,
            p_offset:    0,
        });

        const listings  = Array.isArray(all) ? all : [];
        const total     = listings.length;
        const offset    = (filters.page - 1) * filters.pageSize;
        const paginated = listings.slice(offset, offset + filters.pageSize);

        const result = {
            listings:    paginated,
            total,
            page:        filters.page,
            page_size:   filters.pageSize,
            total_pages: Math.ceil(total / filters.pageSize),
            from_cache:  false,
            cache_key:   cacheKey,
            executed_at: new Date().toISOString(),
        };

        cacheSet(cacheKey, result);

        // Fire-and-forget analytics
        logSearchEvent(filters.query, total).catch(() => {});

        return res.json(result);

    } catch (err) {
        console.error('[searchService] ❌', err.message);
        return res.status(500).json({ error: 'Erro ao buscar anúncios.', details: err.message });
    }
}

async function logSearchEvent(query, resultCount) {
    if (!query) return;
    await fetch(`${SUPABASE_URL()}/rest/v1/analytics_events`, {
        method:  'POST',
        headers: {
            'Content-Type':  'application/json',
            'apikey':        SERVICE_KEY(),
            'Authorization': `Bearer ${SERVICE_KEY()}`,
            'Prefer':        'return=minimal',
        },
        body: JSON.stringify({
            event_name: 'search_query',
            properties: { query, result_count: resultCount },
        }),
    });
}

function getCacheStats() {
    const now = Date.now();
    let active = 0, expired = 0;
    for (const [, entry] of cache) {
        if (now > entry.expiresAt) expired++;
        else active++;
    }
    return { size: cache.size, active, expired, maxSize: CACHE_MAX, ttlMs: CACHE_TTL_MS };
}

function invalidateCache(pattern) {
    if (!pattern) { cache.clear(); return; }
    for (const key of cache.keys()) if (key.includes(pattern)) cache.delete(key);
}

module.exports = { searchHandler, getCacheStats, invalidateCache };
