/**
 * api/cron/update-scores.ts
 * Vercel Cron Function — runs every hour (configured in vercel.json).
 *
 * Recalculates ranking scores for all active listings.
 * Calls the Supabase SQL function update_all_listing_scores().
 *
 * Algorithm: score = boost_score + recency_score + (views*0.5) + (favorites*1.5)
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';

export const config = {
    schedule: '0 * * * *',
    maxDuration: 60,
};

const SUPABASE_URL = process.env.SUPABASE_URL ?? '';
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_KEY ?? '';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const ts = new Date().toISOString();

    // Validate authorization
    const cronSecret   = process.env.CRON_SECRET_KEY ?? process.env.CRON_SECRET ?? '';
    const authHeader   = req.headers['authorization'] ?? '';
    const xCronSecret  = req.headers['x-cron-secret'] ?? '';
    const bearerToken  = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
    const isAuthorized = !cronSecret || bearerToken === cronSecret || xCronSecret === cronSecret;

    if (!isAuthorized) {
        return res.status(403).json({ error: 'Forbidden.' });
    }

    if (!SUPABASE_URL || !SERVICE_KEY) {
        return res.status(503).json({ error: 'Supabase not configured.' });
    }

    console.log(`[vercel-cron] ${ts} ▶ update_all_listing_scores() starting…`);

    try {
        const rpcRes = await fetch(`${SUPABASE_URL}/rest/v1/rpc/update_all_listing_scores`, {
            method:  'POST',
            headers: {
                'Content-Type':  'application/json',
                'apikey':        SERVICE_KEY,
                'Authorization': `Bearer ${SERVICE_KEY}`,
            },
            body: JSON.stringify({}),
        });

        const raw = await rpcRes.text();
        if (!rpcRes.ok) throw new Error(`Supabase RPC → HTTP ${rpcRes.status}: ${raw}`);

        const count = (() => { try { return Number(JSON.parse(raw)); } catch { return 0; } })();

        console.log(`[vercel-cron] ${ts} ✅ update_all_listing_scores: ${count} listings updated`);

        return res.json({ success: true, updated_count: count, executed_at: ts });

    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[vercel-cron] ${ts} ❌ update_all_listing_scores failed: ${msg}`);
        return res.status(500).json({ success: false, error: msg });
    }
}
