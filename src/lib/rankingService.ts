/**
 * src/lib/rankingService.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Client-side ranking service.
 *
 * Implements the same scoring algorithm as the SQL function
 * `calculate_listing_score()` so the frontend can sort locally without
 * an extra round-trip when the backend already returns ranking_score.
 *
 * Algorithm:
 *   score = boost_score + recency_score + (views * 0.5) + (favorites * 1.5)
 *
 *   boost_score:
 *     • ultra_boost  (priority=3) → 300
 *     • premium_boost(priority=2) → 200
 *     • basic_boost  (priority=1) → 100
 *     • legacy impulsionado flag  → prioridade * 10
 *     • none                      → 0
 *
 *   recency_score:
 *     max(0, 30 − days_since_post)   [max 30, decays over 30 days]
 *
 * Usage:
 *   import { computeScore, sortByRanking, getSortedListings } from '@/lib/rankingService';
 */

export interface RankedListing {
    id:                  string;
    created_at:          string;
    impulsionado:        boolean;
    destaque:            boolean;
    prioridade:          number;
    views_count?:        number;
    favorites_count?:    number;
    ranking_score?:      number;
    // listing_boosts indicates active paid boost with priority level
    listing_boosts?:     Array<{ active: boolean; end_date: string; priority_level: number }>;
    // Allow any other car fields
    [key: string]:       unknown;
}

// ── Boost score weights (matches SQL calculate_listing_score) ─────────────────
const BOOST_SCORE_BY_PRIORITY: Record<number, number> = {
    3: 300,   // ultra_boost
    2: 200,   // premium_boost
    1: 100,   // basic_boost
};
const RECENCY_MAX_DAYS  = 30;   // recency decays to 0 after 30 days
const VIEW_WEIGHT       = 0.5;
const FAVORITE_WEIGHT   = 1.5;

// ── computeScore — mirrors calculate_listing_score() SQL function ─────────────
export function computeScore(listing: RankedListing): number {
    // If the backend already computed ranking_score, trust it
    if (typeof listing.ranking_score === 'number' && listing.ranking_score > 0) {
        return listing.ranking_score;
    }

    // 1. Boost score
    let boostScore = 0;

    // Check for active paid boost from listing_boosts join
    const now = Date.now();
    const activeBoost = listing.listing_boosts?.find(
        (b) => b.active && new Date(b.end_date).getTime() > now
    );

    if (activeBoost) {
        boostScore = BOOST_SCORE_BY_PRIORITY[activeBoost.priority_level] ?? 100;
    } else if (listing.impulsionado) {
        // Legacy boost via impulsionado flag
        const p = typeof listing.prioridade === 'number' ? listing.prioridade : 0;
        boostScore = p > 0 ? p * 10 : 50; // default legacy score
    }

    // 2. Recency score
    const createdMs   = new Date(listing.created_at).getTime();
    const daysSinceMs = (Date.now() - createdMs) / (1000 * 60 * 60 * 24);
    const recencyScore = Math.max(0, RECENCY_MAX_DAYS - daysSinceMs);

    // 3. Engagement scores
    const views     = typeof listing.views_count    === 'number' ? listing.views_count    : 0;
    const favorites = typeof listing.favorites_count === 'number' ? listing.favorites_count : 0;

    const score = boostScore
        + recencyScore
        + (views     * VIEW_WEIGHT)
        + (favorites * FAVORITE_WEIGHT);

    return Math.round(score * 10000) / 10000; // 4 decimal places
}

// ── sortByRanking — sort a list of listings by computed score DESC ─────────────
export function sortByRanking<T extends RankedListing>(listings: T[]): T[] {
    return [...listings].sort((a, b) => {
        const scoreA = computeScore(a);
        const scoreB = computeScore(b);

        if (scoreB !== scoreA) return scoreB - scoreA;

        // Tiebreak: most recent first
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
}

// ── getSortedListings — fetch from Supabase and return sorted ─────────────────
/**
 * Fetches car listings from Supabase (already sorted by ranking_score from DB),
 * then applies client-side ranking as a fallback for listings without a
 * pre-computed score.
 *
 * @param supabase   A Supabase client instance
 * @param limit      Number of results (default 50)
 * @param extraQuery Additional query modifiers (e.g. filters)
 */
export async function getSortedListings(
    supabase: { from: (table: string) => unknown },
    limit = 50
): Promise<RankedListing[]> {
    try {
        const client = supabase.from('anuncios') as {
            select: (cols: string) => {
                eq: (col: string, val: unknown) => {
                    order: (col: string, opts: { ascending: boolean }) => {
                        limit: (n: number) => Promise<{ data: RankedListing[] | null; error: unknown }>;
                    };
                };
            };
        };

        const { data, error } = await client
            .select('*,listing_boosts(active,end_date,priority_level)')
            .eq('status', 'active')
            .order('ranking_score', { ascending: false })
            .limit(limit);

        if (error) throw error;

        const listings = data ?? [];
        return sortByRanking(listings);
    } catch (err) {
        console.warn('[rankingService] getSortedListings failed:', err);
        return [];
    }
}

// ── getBoostLabel — human readable boost tier ─────────────────────────────────
export function getBoostLabel(listing: RankedListing): string | null {
    const now = Date.now();
    const activeBoost = listing.listing_boosts?.find(
        (b) => b.active && new Date(b.end_date).getTime() > now
    );

    if (activeBoost) {
        const labels: Record<number, string> = { 3: 'Ultra', 2: 'Premium', 1: 'Básico' };
        return labels[activeBoost.priority_level] ?? 'Impulsionado';
    }
    if (listing.impulsionado) return 'Impulsionado';
    return null;
}

// ── isBoostActive — check if listing has an active paid boost ─────────────────
export function isBoostActive(listing: RankedListing): boolean {
    const now = Date.now();
    return !!(listing.listing_boosts?.some(
        (b) => b.active && new Date(b.end_date).getTime() > now
    ));
}

// ── getBoostTimeRemaining — ms until boost expires ────────────────────────────
export function getBoostTimeRemaining(listing: RankedListing): number {
    const now = Date.now();
    const activeBoost = listing.listing_boosts
        ?.filter((b) => b.active && new Date(b.end_date).getTime() > now)
        .sort((a, b) => new Date(b.end_date).getTime() - new Date(a.end_date).getTime())[0];

    if (!activeBoost) return 0;
    return new Date(activeBoost.end_date).getTime() - now;
}

// ── formatBoostExpiry — human readable time remaining ─────────────────────────
export function formatBoostExpiry(listing: RankedListing): string | null {
    const ms = getBoostTimeRemaining(listing);
    if (ms <= 0) return null;

    const days    = Math.floor(ms / (1000 * 60 * 60 * 24));
    const hours   = Math.floor((ms % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));

    if (days > 0)    return `${days}d ${hours}h restantes`;
    if (hours > 0)   return `${hours}h ${minutes}min restantes`;
    return `${minutes}min restantes`;
}

// ── computeScoreBreakdown — debug / analytics ─────────────────────────────────
export function computeScoreBreakdown(listing: RankedListing): {
    total:       number;
    boost:       number;
    recency:     number;
    views:       number;
    favorites:   number;
} {
    const now = Date.now();
    const activeBoost = listing.listing_boosts?.find(
        (b) => b.active && new Date(b.end_date).getTime() > now
    );

    let boostScore = 0;
    if (activeBoost) {
        boostScore = BOOST_SCORE_BY_PRIORITY[activeBoost.priority_level] ?? 100;
    } else if (listing.impulsionado) {
        const p = typeof listing.prioridade === 'number' ? listing.prioridade : 0;
        boostScore = p > 0 ? p * 10 : 50;
    }

    const createdMs    = new Date(listing.created_at).getTime();
    const daysSince    = (Date.now() - createdMs) / (1000 * 60 * 60 * 24);
    const recency      = Math.max(0, RECENCY_MAX_DAYS - daysSince);
    const views        = (typeof listing.views_count    === 'number' ? listing.views_count    : 0) * VIEW_WEIGHT;
    const favorites    = (typeof listing.favorites_count === 'number' ? listing.favorites_count : 0) * FAVORITE_WEIGHT;
    const total        = boostScore + recency + views + favorites;

    return {
        total:     Math.round(total * 10000) / 10000,
        boost:     Math.round(boostScore * 100) / 100,
        recency:   Math.round(recency * 100) / 100,
        views:     Math.round(views * 100) / 100,
        favorites: Math.round(favorites * 100) / 100,
    };
}
