/**
 * storeProfiles.ts
 *
 * Static configuration for partner stores on SulMotor.
 * Stores are identified by their store key (lowercased, no spaces).
 *
 * STORE_EMAIL_MAP: maps authorized email → store key.
 * Used by PainelLoja to grant access and auto-tag listings.
 */

export interface StoreProfile {
    /** Display name shown on the contact card and store panel */
    name: string;
    /** Authorized email(s) that can access this store's panel */
    emails: string[];
    /** WhatsApp number — digits only, with country code (55 = Brazil) */
    whatsappNumber: string;
    /** Formatted display phone, e.g. "+55 51 98044-6474" */
    phoneDisplay: string;
    /** Logo path (public/) or full URL */
    logo: string;
    /** Short tagline shown below the name */
    tagline?: string;
}

/**
 * Known partner stores.
 * Key: lowercased store name with no spaces.
 */
export const STORE_PROFILES: Record<string, StoreProfile> = {
    alexmegamotors: {
        name:          'AlexMegamotors',
        emails:        ['bandasleonardo@gmail.com'],
        whatsappNumber:'5551980446474',
        phoneDisplay:  '+55 51 98044-6474',
        logo:          '/alex-megamotors-logo.png',
        tagline:       'Especialistas em veículos seminovos',
    },
};

/**
 * Maps authorized emails to store keys for fast lookup.
 * Auto-generated from STORE_PROFILES — do not edit manually.
 */
export const STORE_EMAIL_MAP: Record<string, string> = Object.fromEntries(
    Object.entries(STORE_PROFILES).flatMap(([key, profile]) =>
        profile.emails.map(email => [email.toLowerCase(), key])
    )
);

/**
 * Returns the StoreProfile for a given email address, or undefined.
 */
export function getStoreByEmail(email: string | undefined | null): StoreProfile | undefined {
    if (!email) return undefined;
    const key = STORE_EMAIL_MAP[email.toLowerCase()];
    return key ? STORE_PROFILES[key] : undefined;
}

/**
 * Looks up a store profile by store name (case-insensitive, spaces ignored).
 * Returns undefined if not found.
 */
export function getStoreProfile(storeName: string | undefined | null): StoreProfile | undefined {
    if (!storeName) return undefined;
    return STORE_PROFILES[storeName.toLowerCase().replace(/\s+/g, '')];
}

/**
 * Builds a WhatsApp deep-link with a pre-filled message.
 *
 * Message format (as requested):
 *   "Olá, vi o anúncio do veículo [NOME] no site e tenho interesse.
 *    Poderia me passar mais informações?
 *    🔗 [URL]"
 */
export function buildWhatsAppLink(params: {
    whatsappNumber: string;
    vehicleName: string;
    listingUrl?: string;
}): string {
    const { whatsappNumber, vehicleName, listingUrl } = params;
    const urlPart = listingUrl ? `\n🔗 ${listingUrl}` : '';
    const msg = `Olá, vi o anúncio do veículo ${vehicleName} no site e tenho interesse. Poderia me passar mais informações?${urlPart}`;
    return `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(msg)}`;
}
