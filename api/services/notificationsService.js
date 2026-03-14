'use strict';
/**
 * api/services/notificationsService.js
 * ─────────────────────────────────────────────────────────────────────────────
 * In-app notifications service.
 * Reads/writes the `notifications` table in Supabase.
 *
 * Used by:
 *   • POST /api/notifications/mark-read
 *   • GET  /api/notifications
 */

const SUPABASE_URL = () => process.env.SUPABASE_URL;
const SERVICE_KEY  = () => process.env.SUPABASE_SERVICE_KEY;

function sbHeaders(jwt) {
    const key = SERVICE_KEY();
    return {
        'Content-Type':  'application/json',
        'apikey':        key,
        'Authorization': jwt ? `Bearer ${jwt}` : `Bearer ${key}`,
        'Prefer':        'return=representation',
    };
}

function extractJWT(req) {
    const auth = req.headers['authorization'] ?? '';
    if (auth.startsWith('Bearer ')) return auth.slice(7);
    return null;
}

async function getUserFromJWT(jwt) {
    if (!jwt) return null;
    const res = await fetch(`${SUPABASE_URL()}/auth/v1/user`, {
        headers: { 'apikey': SERVICE_KEY(), 'Authorization': `Bearer ${jwt}` },
    });
    if (!res.ok) return null;
    return res.json();
}

/**
 * GET /api/notifications
 * Returns unread notifications for the authenticated user.
 */
async function getNotifications(req, res) {
    try {
        const jwt  = extractJWT(req);
        const user = await getUserFromJWT(jwt);
        if (!user?.id) return res.status(401).json({ error: 'Autenticação necessária.' });

        const url = new URL(`${SUPABASE_URL()}/rest/v1/notifications`);
        url.searchParams.set('user_id', `eq.${user.id}`);
        url.searchParams.set('order',   'created_at.desc');
        url.searchParams.set('limit',   '50');
        url.searchParams.set('select',  '*');

        const response = await fetch(url.toString(), { headers: sbHeaders(jwt) });
        const notifications = await response.json();

        const unreadCount = Array.isArray(notifications)
            ? notifications.filter(n => !n.read).length
            : 0;

        return res.json({ notifications: notifications ?? [], unread_count: unreadCount });

    } catch (err) {
        console.error('[notifications/get] ❌', err.message);
        return res.status(500).json({ error: 'Erro ao buscar notificações.' });
    }
}

/**
 * POST /api/notifications/mark-read
 * Body: { notification_ids: string[] } — if empty, marks ALL as read
 */
async function markRead(req, res) {
    try {
        const jwt  = extractJWT(req);
        const user = await getUserFromJWT(jwt);
        if (!user?.id) return res.status(401).json({ error: 'Autenticação necessária.' });

        const { notification_ids } = req.body ?? {};

        const url = new URL(`${SUPABASE_URL()}/rest/v1/notifications`);
        url.searchParams.set('user_id', `eq.${user.id}`);
        if (Array.isArray(notification_ids) && notification_ids.length > 0) {
            url.searchParams.set('id', `in.(${notification_ids.join(',')})`);
        }

        await fetch(url.toString(), {
            method:  'PATCH',
            headers: sbHeaders(jwt),
            body:    JSON.stringify({ read: true }),
        });

        return res.json({ success: true });

    } catch (err) {
        console.error('[notifications/mark-read] ❌', err.message);
        return res.status(500).json({ error: 'Erro ao atualizar notificações.' });
    }
}

/**
 * Create a notification programmatically (server-side only).
 * @param {string} userId
 * @param {object} notification
 */
async function createNotification(userId, { type, title, body, actionUrl, metadata = {} }) {
    try {
        await fetch(`${SUPABASE_URL()}/rest/v1/notifications`, {
            method:  'POST',
            headers: { ...sbHeaders(null), 'Prefer': 'return=minimal' },
            body:    JSON.stringify({
                user_id:    userId,
                type,
                title,
                body:       body ?? null,
                action_url: actionUrl ?? null,
                metadata,
            }),
        });
    } catch (err) {
        console.warn(`[notificationsService] createNotification failed (non-fatal): ${err.message}`);
    }
}

module.exports = { getNotifications, markRead, createNotification };
