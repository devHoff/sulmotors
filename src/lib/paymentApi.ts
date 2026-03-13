/**
 * src/lib/paymentApi.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Client-side helpers to call the SulMotor Payment API backend.
 *
 * The backend base URL is read from:
 *   VITE_PAYMENT_API_URL  (e.g. http://localhost:3001)
 *
 * If the env var is absent it defaults to the same origin as the frontend.
 * This means in production you can proxy /api via nginx/Vite to the backend.
 */

const API_BASE = (import.meta.env.VITE_PAYMENT_API_URL as string | undefined)?.replace(/\/$/, '')
    ?? '';   // empty string → same-origin (works via Vite proxy)

// ── Types ─────────────────────────────────────────────────────────────────────

export interface CreatePaymentRequest {
    transaction_amount  : number;   // BRL, e.g. 59.90
    description         : string;   // e.g. "Impulsionar Honda Civic 2022"
    payer_email         : string;
    payer_name?         : string;
    payment_method_id?  : 'pix' | 'credit_card' | 'debit_card';  // default 'pix'
    external_reference? : string;   // your internal order/anuncio ID
    installments?       : number;   // card only
    card_token?         : string;   // card only – tokenised via MP JS SDK
    issuer_id?          : string;   // card only
}

export interface CreatePaymentResponse {
    payment_id      : string;
    status          : 'pending' | 'approved' | 'rejected' | 'in_process' | 'cancelled';
    status_detail   : string;
    qr_code         : string | null;  // PIX copy-paste string
    qr_code_base64  : string | null;  // PNG base64 (for <img>)
    ticket_url      : string | null;  // PIX deep-link
    pix_expiration  : string | null;  // ISO timestamp
}

export interface PaymentStatusResponse {
    payment_id    : string;
    status        : 'pending' | 'approved' | 'rejected' | 'in_process' | 'cancelled';
    status_detail : string;
}

// ── Internal fetch wrapper ────────────────────────────────────────────────────

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
    const url = `${API_BASE}${path}`;
    const res = await fetch(url, {
        ...init,
        headers: {
            'Content-Type': 'application/json',
            ...init?.headers,
        },
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
        const message = (data as any)?.error ?? `HTTP ${res.status}`;
        throw new Error(message);
    }

    return data as T;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * POST /api/create-payment
 * Creates a PIX (or card) payment and returns QR code data.
 */
export async function createPayment(body: CreatePaymentRequest): Promise<CreatePaymentResponse> {
    return apiFetch<CreatePaymentResponse>('/api/create-payment', {
        method: 'POST',
        body:   JSON.stringify(body),
    });
}

/**
 * GET /api/payment-status/:payment_id
 * Returns the current status of a payment.
 */
export async function getPaymentStatus(paymentId: string): Promise<PaymentStatusResponse> {
    return apiFetch<PaymentStatusResponse>(`/api/payment-status/${encodeURIComponent(paymentId)}`);
}

/**
 * GET /api/mp-public-key
 * Returns the Mercado Pago public key for initialising the JS SDK.
 */
export async function getMPPublicKey(): Promise<string> {
    const data = await apiFetch<{ public_key: string }>('/api/mp-public-key');
    return data.public_key;
}
