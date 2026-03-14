/**
 * api/cron/expire-pending-orders.ts
 * Vercel Cron Function — runs every 30 minutes (configured in vercel.json).
 *
 * Expires payment orders that have been in 'pending' status for > 24 hours.
 * Calls the Supabase SQL function expire_pending_orders().
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';

export const config = {
    schedule: '*/30 * * * *',
    maxDuration: 30,
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

    console.log(`[vercel-cron] ${ts} ▶ expire_pending_orders() starting…`);

    try {
        const rpcRes = await fetch(`${SUPABASE_URL}/rest/v1/rpc/expire_pending_orders`, {
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

        console.log(`[vercel-cron] ${ts} ✅ expire_pending_orders: ${count} orders expired`);

        if (count > 0) {
            // Record analytics event
            await fetch(`${SUPABASE_URL}/rest/v1/analytics_events`, {
                method:  'POST',
                headers: {
                    'Content-Type':  'application/json',
                    'apikey':        SERVICE_KEY,
                    'Authorization': `Bearer ${SERVICE_KEY}`,
                    'Prefer':        'return=minimal',
                },
                body: JSON.stringify({
                    event_name: 'orders_expired',
                    properties: { expired_count: count, triggered_at: ts, source: 'vercel-cron' },
                }),
            }).catch(() => {});
        }

        return res.json({ success: true, expired_count: count, executed_at: ts });

    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[vercel-cron] ${ts} ❌ expire_pending_orders failed: ${msg}`);
        return res.status(500).json({ success: false, error: msg });
    }
}
