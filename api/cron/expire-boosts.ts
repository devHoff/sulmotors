/**
 * api/cron/expire-boosts.ts
 * Vercel Cron Function — runs every 10 minutes (configured in vercel.json).
 *
 * When deployed on Vercel, this file is treated as a serverless function.
 * Vercel will call it on the configured schedule with an Authorization header
 * containing the CRON_SECRET (set in Vercel environment variables).
 *
 * Security:
 *   - Vercel cron calls include: Authorization: Bearer <CRON_SECRET>
 *   - We validate this OR the x-cron-secret header (for external callers)
 *   - Returns 403 if neither matches
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';

export const config = {
    schedule: '*/10 * * * *',
    maxDuration: 30,
};

const SUPABASE_URL = process.env.SUPABASE_URL ?? '';
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_KEY ?? '';

async function callExpireBoosts(): Promise<number> {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/expire_boosts`, {
        method:  'POST',
        headers: {
            'Content-Type':  'application/json',
            'apikey':        SERVICE_KEY,
            'Authorization': `Bearer ${SERVICE_KEY}`,
        },
        body: JSON.stringify({}),
    });

    const raw = await res.text();
    if (!res.ok) {
        const err = (() => { try { return JSON.parse(raw); } catch { return { raw }; } })();
        throw new Error((err as any)?.message || `Supabase RPC → HTTP ${res.status}`);
    }

    return (() => { try { return Number(JSON.parse(raw)); } catch { return 0; } })();
}

async function recordAnalytics(expiredCount: number): Promise<void> {
    try {
        await fetch(`${SUPABASE_URL}/rest/v1/analytics_events`, {
            method:  'POST',
            headers: {
                'Content-Type':  'application/json',
                'apikey':        SERVICE_KEY,
                'Authorization': `Bearer ${SERVICE_KEY}`,
                'Prefer':        'return=minimal',
            },
            body: JSON.stringify({
                event_name: 'boost_expired',
                properties: {
                    expired_count: expiredCount,
                    triggered_at:  new Date().toISOString(),
                    source:        'vercel-cron/expire-boosts',
                },
            }),
        });
    } catch { /* non-fatal */ }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const ts = new Date().toISOString();

    // Validate authorization
    const cronSecret   = process.env.CRON_SECRET_KEY ?? process.env.CRON_SECRET ?? '';
    const authHeader   = req.headers['authorization'] ?? '';
    const xCronSecret  = req.headers['x-cron-secret'] ?? '';

    // Vercel sends: Authorization: Bearer <CRON_SECRET>
    const bearerToken  = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';

    const isAuthorized = !cronSecret
        || bearerToken === cronSecret
        || xCronSecret === cronSecret;

    if (!isAuthorized) {
        console.warn(`[vercel-cron] ${ts} ⛔ Unauthorized request`);
        return res.status(403).json({ error: 'Forbidden.' });
    }

    if (!SUPABASE_URL || !SERVICE_KEY) {
        return res.status(503).json({ error: 'Supabase not configured.' });
    }

    console.log(`[vercel-cron] ${ts} ▶ expire_boosts() starting…`);

    try {
        const expiredCount = await callExpireBoosts();

        console.log(`[vercel-cron] ${ts} ✅ expire_boosts: ${expiredCount} expired`);

        if (expiredCount > 0) await recordAnalytics(expiredCount);

        return res.json({
            success:        true,
            expired_boosts: expiredCount,
            executed_at:    ts,
        });

    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[vercel-cron] ${ts} ❌ expire_boosts failed: ${msg}`);
        return res.status(500).json({ success: false, error: msg, executed_at: ts });
    }
}
