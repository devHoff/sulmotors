'use strict';
/**
 * api/services/rankingService.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Server-side ranking service.
 * Wraps the Supabase SQL function `update_all_listing_scores()` and
 * provides helpers for computing and updating individual scores.
 *
 * Used by:
 *   • api/jobs/update-listing-scores.js   (hourly cron)
 *   • api/server.js                        (route registration)
 */

const SUPABASE_URL = () => process.env.SUPABASE_URL;
const SERVICE_KEY  = () => process.env.SUPABASE_SERVICE_KEY;

function sbHeaders() {
    const key = SERVICE_KEY();
    return {
        'Content-Type':  'application/json',
        'apikey':        key,
        'Authorization': `Bearer ${key}`,
        'Prefer':        'return=representation',
    };
}

async function rpc(fnName, params = {}) {
    const res = await fetch(`${SUPABASE_URL()}/rest/v1/rpc/${fnName}`, {
        method:  'POST',
        headers: sbHeaders(),
        body:    JSON.stringify(params),
    });
    const raw = await res.text();
    if (!res.ok) {
        const err = (() => { try { return JSON.parse(raw); } catch { return { raw }; } })();
        throw new Error(err?.message || err?.error || `RPC ${fnName} → HTTP ${res.status}`);
    }
    try { return JSON.parse(raw); } catch { return raw; }
}

/**
 * Update ranking scores for ALL active listings.
 * Calls the SQL function update_all_listing_scores().
 * @returns {Promise<number>} number of updated listings
 */
async function updateAllScores() {
    const result = await rpc('update_all_listing_scores');
    return Number(result) || 0;
}

/**
 * Update ranking score for a single listing.
 * Calls calculate_listing_score(id) and patches anuncios.ranking_score.
 * @param {string} listingId
 * @returns {Promise<number>} new score
 */
async function updateScore(listingId) {
    const score = await rpc('calculate_listing_score', { p_listing_id: listingId });
    const numScore = Number(score) || 0;

    // Patch the listing
    const url = new URL(`${SUPABASE_URL()}/rest/v1/anuncios`);
    url.searchParams.set('id', `eq.${listingId}`);
    await fetch(url.toString(), {
        method:  'PATCH',
        headers: sbHeaders(),
        body:    JSON.stringify({ ranking_score: numScore }),
    });

    return numScore;
}

/**
 * Get ranked listings via the SQL function get_listings_ranked().
 * @param {Object} filters
 * @returns {Promise<Array>}
 */
async function getRankedListings(filters = {}) {
    return rpc('get_listings_ranked', {
        p_marca:     filters.marca     ?? null,
        p_modelo:    filters.modelo    ?? null,
        p_year_min:  filters.yearMin   ?? null,
        p_year_max:  filters.yearMax   ?? null,
        p_price_min: filters.priceMin  ?? null,
        p_price_max: filters.priceMax  ?? null,
        p_cidade:    filters.cidade    ?? null,
        p_query:     filters.query     ?? null,
        p_limit:     filters.limit     ?? 50,
        p_offset:    filters.offset    ?? 0,
    });
}

module.exports = { updateAllScores, updateScore, getRankedListings };
