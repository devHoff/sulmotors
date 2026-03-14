/**
 * src/lib/viewTracker.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Listing view tracker with client-side deduplication.
 *
 * Features:
 *   • Deduplication: same listing_id + same session within 1h is counted once
 *   • Session ID: generated once per browser tab (sessionStorage), persisted
 *   • IP hash: not available client-side; handled server-side in the SQL function
 *   • Supabase RPC call to record_listing_view() — server deduplicates by IP+user
 *   • Referrer tracking
 *   • Fire-and-forget — never blocks rendering
 *
 * Usage:
 *   import { trackView } from '@/lib/viewTracker';
 *   // Inside DetalheCarro useEffect after car loads:
 *   trackView({ listingId: car.id, userId: user?.id });
 */

import { supabase } from './supabase';

// ── Session ID (per-tab unique ID) ────────────────────────────────────────────
function getSessionId(): string {
    const key = 'sm_session_id';
    try {
        let sid = sessionStorage.getItem(key);
        if (!sid) {
            sid = `sm_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
            sessionStorage.setItem(key, sid);
        }
        return sid;
    } catch {
        // SSR or blocked storage
        return `sm_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    }
}

// ── Client-side dedup cache ───────────────────────────────────────────────────
// Key: `${sessionId}:${listingId}` — expires after DEDUP_WINDOW_MS
const DEDUP_WINDOW_MS = 60 * 60 * 1000; // 1 hour

interface DedupEntry { seenAt: number }
const dedupCache = new Map<string, DedupEntry>();

function isDuplicate(sessionId: string, listingId: string): boolean {
    const key   = `${sessionId}:${listingId}`;
    const entry = dedupCache.get(key);
    if (!entry) return false;
    if (Date.now() - entry.seenAt > DEDUP_WINDOW_MS) {
        dedupCache.delete(key);
        return false;
    }
    return true;
}

function markSeen(sessionId: string, listingId: string): void {
    const key = `${sessionId}:${listingId}`;
    dedupCache.set(key, { seenAt: Date.now() });
    // Evict old entries (cap at 200)
    if (dedupCache.size > 200) {
        const oldest = [...dedupCache.entries()]
            .sort((a, b) => a[1].seenAt - b[1].seenAt)
            .slice(0, 50)
            .map(([k]) => k);
        oldest.forEach(k => dedupCache.delete(k));
    }
}

// ── Track options ─────────────────────────────────────────────────────────────
export interface TrackViewOptions {
    listingId:  string;
    userId?:    string | null;
    userAgent?: string;
    referrer?:  string;
}

/**
 * Track a listing view.
 * Fire-and-forget: never throws, never blocks rendering.
 *
 * @param opts - Listing ID + optional user/referrer data
 */
export async function trackView(opts: TrackViewOptions): Promise<void> {
    if (!opts.listingId) return;

    const sessionId = getSessionId();

    // Client-side dedup
    if (isDuplicate(sessionId, opts.listingId)) return;

    // Mark seen immediately (optimistic dedup)
    markSeen(sessionId, opts.listingId);

    try {
        // Call the SQL function which handles server-side dedup by IP hash
        const { error } = await (supabase as unknown as {
            rpc: (fn: string, params: Record<string, unknown>) => Promise<{ error: unknown }>;
        }).rpc('record_listing_view', {
            p_listing_id: opts.listingId,
            p_user_id:    opts.userId    ?? null,
            p_ip_hash:    null,   // IP hash is handled server-side
            p_user_agent: opts.userAgent ?? (typeof navigator !== 'undefined' ? navigator.userAgent : null),
            p_referrer:   opts.referrer  ?? (typeof document   !== 'undefined' ? document.referrer || null : null),
            p_session_id: sessionId,
        });

        if (error) {
            // Fallback: direct insert (less strict dedup)
            await supabase.from('listing_views').insert({
                listing_id: opts.listingId,
                user_id:    opts.userId    ?? null,
                user_agent: opts.userAgent ?? (typeof navigator !== 'undefined' ? navigator.userAgent : null),
                referrer:   opts.referrer  ?? (typeof document   !== 'undefined' ? document.referrer || null : null),
                session_id: sessionId,
            });
        }
    } catch {
        // Non-fatal — view tracking never blocks the user
    }
}

/**
 * Get view count for a listing (from the anuncios.views_count column).
 * Returns null if unavailable.
 */
export async function getViewCount(listingId: string): Promise<number | null> {
    try {
        const { data, error } = await supabase
            .from('anuncios')
            .select('views_count')
            .eq('id', listingId)
            .single() as unknown as { data: { views_count: number } | null; error: unknown };

        if (error || !data) return null;
        return data.views_count ?? 0;
    } catch {
        return null;
    }
}

/**
 * Track a search event (for analytics).
 */
export async function trackSearch(query: string, resultCount: number): Promise<void> {
    try {
        await supabase.from('analytics_events').insert({
            event_name: 'search_query',
            properties: { query, result_count: resultCount },
        });
    } catch {
        // non-fatal
    }
}

/**
 * Track a listing click (e.g., from Estoque card click).
 */
export async function trackListingClick(listingId: string, source: string): Promise<void> {
    try {
        await supabase.from('analytics_events').insert({
            event_name: 'listing_click',
            properties: { listing_id: listingId, source },
        });
    } catch {
        // non-fatal
    }
}
