// src/lib/paymentApi.ts
// ─────────────────────────────────────────────────────────────────────────────
// SulMotor – Payment API client
//
// All payment calls go to deployed Supabase Edge Functions:
//   https://imkzkvlktrixaxougqie.supabase.co/functions/v1/<function-name>
//
// Deployed functions (confirmed live):
//   POST /create-mp-payment  – create PIX / card payment via Mercado Pago
//   POST /check-mp-payment   – poll payment status by mp_payment_id
//   GET  /boost-plans        – list boost plans
//   POST /mp-webhook         – Mercado Pago IPN (server-side, not called by FE)
//
// The base URL is resolved from env vars in this priority:
//   1. VITE_SUPABASE_FUNCTIONS_URL   (explicit override, e.g. for local dev)
//   2. VITE_SUPABASE_URL + /functions/v1  (auto-derived from Supabase project URL)
//   3. Fallback to VITE_PAYMENT_API_URL  (legacy Express backend, local dev only)
// ─────────────────────────────────────────────────────────────────────────────

import { supabase } from './supabase';

// ── Types ─────────────────────────────────────────────────────────────────────

/**
 * Body sent to POST /functions/v1/create-mp-payment
 * Field names match the deployed Edge Function contract exactly.
 */
export interface CreateMpPaymentRequest {
  /** UUID of the anuncio (listing) being boosted */
  anuncio_id:     string;
  /** Authenticated user UUID */
  user_id:        string;
  /** Payer email */
  user_email:     string;
  /** Plan key: basic_boost | premium_boost | ultra_boost */
  periodo_key:    string;
  /** Boost duration in days (7 | 15 | 30) */
  dias:           number;
  /** Price in BRL */
  preco:          number;
  /** Car description shown in MP order */
  carro_desc:     string;
  /** Payment method: 'pix' (default) | 'credit_card' */
  payment_method?: 'pix' | 'credit_card';
  // Credit-card-only fields (pre-tokenised via MP SDK)
  card_token?:          string;
  installments?:        number;
  issuer_id?:           string;
  payment_method_id?:   string;
}

/**
 * Response from POST /functions/v1/create-mp-payment
 */
export interface CreateMpPaymentResponse {
  /** Mercado Pago payment ID (numeric, returned as number or string) */
  payment_id:          number | string | null;
  /** Internal pagamentos table UUID */
  pagamento_id:        string | null;
  status:              string;   // 'pending' | 'approved' | 'rejected'
  status_detail?:      string | null;
  /** PIX copia-e-cola string */
  pix_qr_code:         string | null;
  /** Base64-encoded PIX QR image */
  pix_qr_code_base64:  string | null;
  /** ISO datetime when PIX expires */
  pix_expiration:      string | null;
  /** Card last 4 digits (credit card only) */
  last_four_digits?:   string | null;
  /** True when running without a real MP token */
  _mock?:              boolean;
}

/**
 * Response from POST /functions/v1/check-mp-payment
 */
export interface CheckMpPaymentResponse {
  status:        string;          // 'pending' | 'approved' | 'rejected' | 'cancelled'
  status_detail?: string | null;
  _mock?:        boolean;
}

export interface BoostPlan {
  id:            string;
  name:          string;
  type:          string;
  price:         number;
  duration_days: number;
  description:   string;
  features:      string[];
  is_active:     boolean;
}

// ── Legacy aliases (kept for CheckoutModal compat) ────────────────────────────
/** @deprecated Use CreateMpPaymentRequest */
export type CreatePaymentRequest = CreateMpPaymentRequest;
/** @deprecated Use CreateMpPaymentResponse */
export type CreatePaymentResponse = CreateMpPaymentResponse & {
  // Old fields that CheckoutModal may still read
  order_id?:          string | null;
  mp_order_id?:       string | null;
  qr_code?:           string | null;
  qr_code_base64?:    string | null;
  ticket_url?:        string | null;
  pix_expiration?:    string | null;
  external_reference?: string;
};
export interface PaymentStatusResponse {
  payment_id?:    string | null;
  status:         string;
  status_detail?: string | null;
  order_status?:  string | null;
}

// ── Base URL resolution ───────────────────────────────────────────────────────

function getEdgeFunctionsBase(): string {
  // 1. Explicit override
  const explicit = import.meta.env.VITE_SUPABASE_FUNCTIONS_URL as string | undefined;
  if (explicit) return explicit.replace(/\/$/, '');

  // 2. Auto-derive from Supabase URL
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  if (supabaseUrl) return `${supabaseUrl.replace(/\/$/, '')}/functions/v1`;

  // 3. Legacy Express API fallback (local dev only)
  const legacyBase = import.meta.env.VITE_PAYMENT_API_URL as string | undefined;
  if (legacyBase) return legacyBase.replace(/\/$/, '');

  // 4. Same-origin fallback
  return '/api';
}

// ── Generic fetch helper ──────────────────────────────────────────────────────

async function edgeFetch<T>(
  path:    string,
  options: RequestInit = {},
): Promise<T> {
  const base = getEdgeFunctionsBase();
  const url  = `${base}${path.startsWith('/') ? '' : '/'}${path}`;

  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> | undefined),
  };

  if (anonKey) {
    headers['apikey'] = anonKey;
    if (!headers['Authorization']) {
      headers['Authorization'] = `Bearer ${anonKey}`;
    }
  }

  let res: Response;
  try {
    res = await fetch(url, { ...options, headers });
  } catch (networkErr) {
    throw new Error(
      `Falha de rede ao conectar com o servidor de pagamentos. Verifique sua conexão. (${(networkErr as Error).message})`
    );
  }

  const data = await res.json().catch(() => ({})) as Record<string, unknown>;

  if (!res.ok || data?.error) {
    throw new Error(
      (data?.error as string)
      ?? (data?.message as string)
      ?? `Erro ${res.status}`
    );
  }

  return data as T;
}

// ── Attach user JWT to requests when available ────────────────────────────────

async function getAuthHeader(): Promise<{ Authorization?: string }> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) {
      return { Authorization: `Bearer ${session.access_token}` };
    }
  } catch { /* non-fatal */ }
  return {};
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Create a PIX or credit-card payment via the `create-mp-payment` Edge Function.
 *
 * Returns Mercado Pago payment ID, PIX QR code data, etc.
 * Field names returned match the deployed function response exactly.
 */
export async function createPayment(
  body: CreateMpPaymentRequest,
): Promise<CreatePaymentResponse> {
  const authHeader = await getAuthHeader();
  const raw = await edgeFetch<CreateMpPaymentResponse>('/create-mp-payment', {
    method:  'POST',
    headers: authHeader,
    body:    JSON.stringify(body),
  });

  // Normalise into the CreatePaymentResponse shape that CheckoutModal uses
  return {
    ...raw,
    // Map deployed response fields → legacy field aliases
    order_id:          raw.pagamento_id ?? null,
    mp_order_id:       null,
    qr_code:           raw.pix_qr_code ?? null,
    qr_code_base64:    raw.pix_qr_code_base64 ?? null,
    ticket_url:        null,  // create-mp-payment doesn't return a ticket_url
    pix_expiration:    raw.pix_expiration ?? null,
    external_reference: '',
  };
}

/**
 * Poll the status of a Mercado Pago payment via `check-mp-payment`.
 *
 * Note: the deployed function is POST with body `{ mp_payment_id }`,
 * not a GET with a path parameter.
 */
export async function getPaymentStatus(
  paymentId: string,
  _orderId?: string, // kept for call-site compatibility; not used by this function
): Promise<PaymentStatusResponse> {
  let res: CheckMpPaymentResponse;
  try {
    res = await edgeFetch<CheckMpPaymentResponse>('/check-mp-payment', {
      method: 'POST',
      body:   JSON.stringify({ mp_payment_id: String(paymentId) }),
    });
  } catch (e) {
    // Surface network errors rather than silently swallowing them
    throw e;
  }

  return {
    payment_id:    String(paymentId),
    status:        res.status,
    status_detail: res.status_detail ?? null,
    order_status:  null,
  };
}

/**
 * Fetch the list of available boost plans from the `boost-plans` Edge Function.
 * Returns an empty array on error so callers fall back to their static plans.
 */
export async function getBoostPlans(): Promise<BoostPlan[]> {
  try {
    const res = await edgeFetch<{ plans: BoostPlan[] }>('/boost-plans');
    return res.plans ?? [];
  } catch {
    // boost-plans may not be deployed yet; caller will use static fallback
    return [];
  }
}

/**
 * Get the Mercado Pago public key.
 * Returns from env var; no backend call needed.
 */
export function getMPPublicKey(): string {
  return (import.meta.env.VITE_MP_PUBLIC_KEY as string) ?? '';
}

// ── Legacy shim – kept only for backward compatibility ────────────────────────

/**
 * @deprecated  Use createPayment() with the CreateMpPaymentRequest shape.
 * This shim maps the old CheckoutModal call signature to the new Edge Function.
 */
export async function createLegacyPayment(body: {
  payment_method:      string;
  transaction_amount:  number;
  description:         string;
  payer_email:         string;
  payer_name?:         string;
  external_reference?: string;
  token?:              string;
  installments?:       number;
  payment_method_id?:  string;
  payer_cpf?:          string;
  listing_id?:         string;
  plan_type?:          string;
}): Promise<CreatePaymentResponse & {
  boleto_url?:         string | null;
  boleto_barcode?:     string | null;
  boleto_expiration?:  string | null;
}> {
  const planKey    = (body.plan_type ?? 'basic') + '_boost';
  const daysMap: Record<string, number> = { basic: 7, premium: 15, ultra: 30 };
  const days       = daysMap[body.plan_type ?? 'basic'] ?? 7;

  const { data: { session } } = await supabase.auth.getSession();
  const userId = session?.user?.id ?? '';

  const mapped: CreateMpPaymentRequest = {
    anuncio_id:       body.listing_id ?? '',
    user_id:          userId,
    user_email:       body.payer_email,
    periodo_key:      planKey,
    dias:             days,
    preco:            body.transaction_amount,
    carro_desc:       body.description,
    payment_method:   body.payment_method as 'pix' | 'credit_card',
    card_token:       body.token,
    installments:     body.installments,
    payment_method_id: body.payment_method_id,
  };

  const result = await createPayment(mapped);
  return {
    ...result,
    boleto_url:        result.ticket_url ?? null,
    boleto_barcode:    null,
    boleto_expiration: null,
  };
}
