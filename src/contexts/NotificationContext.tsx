/**
 * SulMotors – NotificationContext
 * ─────────────────────────────────────────────────────────────────────────────
 * Persistent notification history center (separate from ephemeral toasts).
 *
 * Features:
 *  • Stores up to 50 notifications in localStorage (sm_notifications)
 *  • Unread count badge on Navbar bell icon
 *  • mark-as-read (single) / markAllRead / clear helpers
 *  • Bridge (notifyBridge) for use outside the React tree (e.g. utils/toast.ts)
 *  • Ties into ToastContext: every push also shows an ephemeral toast
 *  • Types: success | error | warning | info | message
 */

import {
    createContext,
    useContext,
    useState,
    useCallback,
    useEffect,
    type ReactNode,
} from 'react';
import { toastBridge } from './ToastContext';

// ── Types ─────────────────────────────────────────────────────────────────────

export type NotifType = 'success' | 'error' | 'warning' | 'info' | 'message';

export interface Notification {
    id: string;
    type: NotifType;
    title: string;
    description?: string;
    timestamp: number;   // Date.now()
    isRead: boolean;
    /** Optional link to navigate to on click */
    href?: string;
}

interface NotificationContextValue {
    notifications: Notification[];
    unreadCount: number;

    /** Push a new notification (and an ephemeral toast simultaneously) */
    push: (opts: Omit<Notification, 'id' | 'timestamp' | 'isRead'> & { toast?: boolean }) => void;

    markRead:    (id: string)  => void;
    markAllRead: ()            => void;
    remove:      (id: string)  => void;
    clearAll:    ()            => void;
}

// ── Context ───────────────────────────────────────────────────────────────────

const NotificationContext = createContext<NotificationContextValue | null>(null);

const STORAGE_KEY = 'sm_notifications';
const MAX_STORED  = 50;
let _notifIdCtr   = 0;
const uid = () => `n-${Date.now()}-${++_notifIdCtr}`;

// ── Persistence helpers ───────────────────────────────────────────────────────

function loadNotifs(): Notification[] {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return [];
        const arr = JSON.parse(raw) as Notification[];
        // Only keep last MAX_STORED
        return Array.isArray(arr) ? arr.slice(0, MAX_STORED) : [];
    } catch {
        return [];
    }
}

function saveNotifs(notifs: Notification[]) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(notifs.slice(0, MAX_STORED)));
    } catch {}
}

// ── Provider ──────────────────────────────────────────────────────────────────

export function NotificationProvider({ children }: { children: ReactNode }) {
    const [notifications, setNotifications] = useState<Notification[]>(loadNotifs);

    // Persist on every change
    useEffect(() => {
        saveNotifs(notifications);
    }, [notifications]);

    const unreadCount = notifications.filter(n => !n.isRead).length;

    const push = useCallback((
        opts: Omit<Notification, 'id' | 'timestamp' | 'isRead'> & { toast?: boolean }
    ) => {
        const { toast: showToast = true, ...rest } = opts;
        const notif: Notification = {
            ...rest,
            id: uid(),
            timestamp: Date.now(),
            isRead: false,
        };

        setNotifications(prev => [notif, ...prev].slice(0, MAX_STORED));

        // Also fire an ephemeral toast
        if (showToast) {
            // Map 'message' → 'info' for toast system
            const toastType = notif.type === 'message' ? 'info' : notif.type;
            toastBridge({
                type: toastType,
                title: notif.title,
                description: notif.description,
                duration: 3500,
            });
        }
    }, []);

    const markRead = useCallback((id: string) => {
        setNotifications(prev =>
            prev.map(n => n.id === id ? { ...n, isRead: true } : n)
        );
    }, []);

    const markAllRead = useCallback(() => {
        setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    }, []);

    const remove = useCallback((id: string) => {
        setNotifications(prev => prev.filter(n => n.id !== id));
    }, []);

    const clearAll = useCallback(() => setNotifications([]), []);

    const value: NotificationContextValue = {
        notifications,
        unreadCount,
        push,
        markRead,
        markAllRead,
        remove,
        clearAll,
    };

    return (
        <NotificationContext.Provider value={value}>
            {children}
        </NotificationContext.Provider>
    );
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useNotifications(): NotificationContextValue {
    const ctx = useContext(NotificationContext);
    if (!ctx) throw new Error('useNotifications must be used inside <NotificationProvider>');
    return ctx;
}

// ── Singleton bridge (for use outside React tree) ─────────────────────────────

type PushFn = NotificationContextValue['push'];
let _notifPush: PushFn | null = null;

export function _registerNotifPush(fn: PushFn) { _notifPush = fn; }

export function notifyBridge(
    opts: Omit<Notification, 'id' | 'timestamp' | 'isRead'> & { toast?: boolean }
) {
    if (!_notifPush) {
        // Not mounted yet – fallback to toast-only
        const toastType = opts.type === 'message' ? 'info' : opts.type;
        toastBridge({ type: toastType, title: opts.title, description: opts.description, duration: 3500 });
        return;
    }
    _notifPush(opts);
}
