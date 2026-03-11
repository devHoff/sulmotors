/**
 * SulMotors Enterprise Toast + Notification Utility
 * ─────────────────────────────────────────────────────────────────────────────
 * Semantic helper wrappers around ToastContext + NotificationContext bridges.
 * All messages are fully localized using the LanguageContext singleton (getT()).
 *
 * Usage:
 *   import { smToast } from '../utils/toast';
 *   smToast.profileSaved();
 *   smToast.listingCreated('Honda Civic 2022');
 *   smToast.newMessage('João Silva');
 *   smToast.priceAlert('Fiat Argo', 45000);
 *
 * For legacy `toast.success / toast.error` calls: export `toast` compat shim.
 */

import { toastBridge } from '../contexts/ToastContext';
import { notifyBridge } from '../contexts/NotificationContext';
import { getT } from '../contexts/LanguageContext';

// ── Semantic helpers ──────────────────────────────────────────────────────────

export const smToast = {

    // ── Profile ───────────────────────────────────────────────────────────────
    profileSaved: () => {
        const t = getT();
        return notifyBridge({ type: 'success', title: t('notif_profile_saved'), description: t('notif_profile_saved_desc') });
    },
    profileError: (msg?: string) => {
        const t = getT();
        return notifyBridge({ type: 'error', title: t('notif_profile_error'), description: msg ?? t('notif_profile_error_desc') });
    },
    profileIncomplete: () => {
        const t = getT();
        return notifyBridge({ type: 'warning', title: t('notif_profile_incomplete'), description: t('notif_profile_incomplete_desc') });
    },

    // ── Listings ─────────────────────────────────────────────────────────────
    listingCreated: (name?: string) => {
        const t = getT();
        return notifyBridge({
            type: 'success',
            title: t('notif_listing_created'),
            description: name ? `"${name}" — ${t('notif_listing_created_desc')}` : t('notif_listing_created_desc'),
            href: '/meus-anuncios',
        });
    },
    listingApproved: (name?: string) => {
        const t = getT();
        return notifyBridge({
            type: 'success',
            title: t('notif_listing_approved'),
            description: name ? `"${name}" — ${t('notif_listing_approved_desc')}` : t('notif_listing_approved_desc'),
            href: '/meus-anuncios',
        });
    },
    listingRejected: (reason?: string) => {
        const t = getT();
        return notifyBridge({
            type: 'error',
            title: t('notif_listing_rejected'),
            description: reason ?? t('notif_listing_rejected_desc'),
            href: '/meus-anuncios',
        });
    },
    listingDeleted: () => {
        const t = getT();
        return toastBridge({ type: 'success', title: t('notif_listing_deleted'), duration: 3000 });
    },
    listingUpdated: () => {
        const t = getT();
        return notifyBridge({ type: 'success', title: t('notif_listing_updated'), description: t('notif_listing_updated_desc') });
    },
    listingError: (msg?: string) => {
        const t = getT();
        return notifyBridge({ type: 'error', title: t('notif_listing_error'), description: msg ?? t('notif_listing_error_desc') });
    },
    dailyLimitReached: () => {
        const t = getT();
        return notifyBridge({ type: 'warning', title: t('notif_daily_limit'), description: t('notif_daily_limit_desc') });
    },

    // ── Chat ─────────────────────────────────────────────────────────────────
    newMessage: (senderName?: string) => {
        const t = getT();
        return notifyBridge({
            type: 'message',
            title: t('notif_new_message'),
            description: senderName ? `${senderName} — ${t('notif_new_message_desc')}` : t('notif_new_message_desc'),
        });
    },
    messageFlagged: () => {
        const t = getT();
        return notifyBridge({ type: 'warning', title: t('notif_message_flagged'), description: t('notif_message_flagged_desc') });
    },

    // ── Favorites ────────────────────────────────────────────────────────────
    favoriteAdded: (carName?: string) => {
        const t = getT();
        return toastBridge({
            type: 'success',
            title: t('notif_favorite_added'),
            description: carName ? `"${carName}"` : undefined,
            duration: 3000,
        });
    },
    favoriteRemoved: (carName?: string) => {
        const t = getT();
        return toastBridge({
            type: 'info',
            title: t('notif_favorite_removed'),
            description: carName ? `"${carName}"` : undefined,
            duration: 3000,
        });
    },

    // ── Alerts ───────────────────────────────────────────────────────────────
    priceAlert: (carName: string, price: number) => {
        const t = getT();
        return notifyBridge({
            type: 'info',
            title: t('notif_price_alert'),
            description: `"${carName}" — R$ ${price.toLocaleString('pt-BR')}`,
            href: '/alertas',
        });
    },
    alertCreated: () => {
        const t = getT();
        return toastBridge({ type: 'success', title: t('notif_alert_created'), description: t('notif_alert_created_desc'), duration: 3500 });
    },
    alertDeleted: () => {
        const t = getT();
        return toastBridge({ type: 'info', title: t('notif_alert_deleted'), duration: 3000 });
    },

    // ── Auth ─────────────────────────────────────────────────────────────────
    loginSuccess: () => {
        const t = getT();
        return notifyBridge({ type: 'success', title: t('notif_login_success'), description: t('notif_login_welcome') });
    },
    logoutSuccess: () => {
        const t = getT();
        return toastBridge({ type: 'info', title: t('notif_logout'), duration: 3000 });
    },
    signupSuccess: () => {
        const t = getT();
        return notifyBridge({ type: 'success', title: t('notif_signup'), description: t('notif_signup_desc') });
    },
    emailVerified: () => {
        const t = getT();
        return notifyBridge({ type: 'success', title: t('notif_email_verified'), description: t('notif_email_verified_desc') });
    },

    // ── Verification ─────────────────────────────────────────────────────────
    verificationSubmitted: () => {
        const t = getT();
        return notifyBridge({ type: 'success', title: t('notif_verification_submitted'), description: t('notif_verification_submitted_desc') });
    },
    verifiedBadgeGranted: () => {
        const t = getT();
        return notifyBridge({ type: 'success', title: t('notif_verified_badge'), description: t('notif_verified_badge_desc') });
    },

    // ── Generic ──────────────────────────────────────────────────────────────
    copied: () => {
        const t = getT();
        return toastBridge({ type: 'success', title: t('notif_copied'), duration: 2500 });
    },
    networkError: () => {
        const t = getT();
        return toastBridge({ type: 'error', title: t('notif_network_error'), description: t('notif_network_error_desc'), duration: 5000 });
    },
    authRequired: () => {
        const t = getT();
        return toastBridge({ type: 'warning', title: t('notif_auth_required'), description: t('notif_auth_required_desc'), duration: 4500 });
    },
};

export default smToast;

// ── Compat shim — replaces `import { toast } from 'sonner'` calls ─────────────

type SonnerOpts = { description?: string; duration?: number };

function compat(type: 'success' | 'error' | 'warning' | 'info') {
    return (title: string, opts?: SonnerOpts) =>
        toastBridge({
            type,
            title,
            description: opts?.description,
            duration: opts?.duration ?? 3500,
        });
}

export const toast = {
    success: compat('success'),
    error:   compat('error'),
    warning: compat('warning'),
    info:    compat('info'),
    message: (title: string, opts?: SonnerOpts) => compat('info')(title, opts),
};
