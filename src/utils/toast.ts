/**
 * SulMotor Toast Utility
 * ─────────────────────────────────────────────────────────────────────────────
 * Semantic helper wrappers around ToastContext.
 * All messages are fully localized using the LanguageContext singleton (getT()).
 */

import { toastBridge } from '../contexts/ToastContext';
import { getT } from '../contexts/LanguageContext';

const D = 3500; // default duration ms

export const smToast = {

    profileSaved: () => {
        const t = getT();
        return toastBridge({ type: 'success', title: t('notif_profile_saved'), description: t('notif_profile_saved_desc'), duration: D });
    },
    profileError: (msg?: string) => {
        const t = getT();
        return toastBridge({ type: 'error', title: t('notif_profile_error'), description: msg ?? t('notif_profile_error_desc'), duration: D });
    },
    profileIncomplete: () => {
        const t = getT();
        return toastBridge({ type: 'warning', title: t('notif_profile_incomplete'), description: t('notif_profile_incomplete_desc'), duration: D });
    },

    listingCreated: (name?: string) => {
        const t = getT();
        const desc = name ? `"${name}" — ${t('notif_listing_created_desc')}` : t('notif_listing_created_desc');
        return toastBridge({ type: 'success', title: t('notif_listing_created'), description: desc, duration: D });
    },
    listingApproved: (name?: string) => {
        const t = getT();
        const desc = name ? `"${name}" — ${t('notif_listing_approved_desc')}` : t('notif_listing_approved_desc');
        return toastBridge({ type: 'success', title: t('notif_listing_approved'), description: desc, duration: D });
    },
    listingRejected: (reason?: string) => {
        const t = getT();
        return toastBridge({ type: 'error', title: t('notif_listing_rejected'), description: reason ?? t('notif_listing_rejected_desc'), duration: D });
    },
    listingDeleted: () => {
        const t = getT();
        return toastBridge({ type: 'success', title: t('notif_listing_deleted'), duration: 3000 });
    },
    listingUpdated: () => {
        const t = getT();
        return toastBridge({ type: 'success', title: t('notif_listing_updated'), description: t('notif_listing_updated_desc'), duration: D });
    },
    listingError: (msg?: string) => {
        const t = getT();
        return toastBridge({ type: 'error', title: t('notif_listing_error'), description: msg ?? t('notif_listing_error_desc'), duration: D });
    },
    dailyLimitReached: () => {
        const t = getT();
        return toastBridge({ type: 'warning', title: t('notif_daily_limit'), description: t('notif_daily_limit_desc'), duration: D });
    },

    newMessage: (senderName?: string) => {
        const t = getT();
        const desc = senderName ? `${senderName} — ${t('notif_new_message_desc')}` : t('notif_new_message_desc');
        return toastBridge({ type: 'info', title: t('notif_new_message'), description: desc, duration: D });
    },
    messageFlagged: () => {
        const t = getT();
        return toastBridge({ type: 'warning', title: t('notif_message_flagged'), description: t('notif_message_flagged_desc'), duration: D });
    },

    favoriteAdded: (carName?: string) => {
        const t = getT();
        return toastBridge({ type: 'success', title: t('notif_favorite_added'), description: carName ? `"${carName}"` : undefined, duration: 3000 });
    },
    favoriteRemoved: (carName?: string) => {
        const t = getT();
        return toastBridge({ type: 'info', title: t('notif_favorite_removed'), description: carName ? `"${carName}"` : undefined, duration: 3000 });
    },

    loginSuccess: () => {
        const t = getT();
        return toastBridge({ type: 'success', title: t('notif_login_success'), description: t('notif_login_welcome'), duration: D });
    },
    logoutSuccess: () => {
        const t = getT();
        return toastBridge({ type: 'info', title: t('notif_logout'), duration: 3000 });
    },
    signupSuccess: () => {
        const t = getT();
        return toastBridge({ type: 'success', title: t('notif_signup'), description: t('notif_signup_desc'), duration: D });
    },
    emailVerified: () => {
        const t = getT();
        return toastBridge({ type: 'success', title: t('notif_email_verified'), description: t('notif_email_verified_desc'), duration: D });
    },

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

// ── Compat shim ───────────────────────────────────────────────────────────────

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
