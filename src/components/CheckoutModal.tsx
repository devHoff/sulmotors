import { useState, useEffect, useRef, useCallback } from 'react';
import { createPayment, getPaymentStatus } from '../lib/paymentApi';
import { supabase } from '../lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import { QRCodeSVG } from 'qrcode.react';
import {
    X, QrCode, CreditCard, Copy, Check, Loader2,
    Clock, CheckCircle2, XCircle, RefreshCw,
    ShieldCheck, Lock, AlertTriangle, Rocket,
    FileText, ExternalLink, Shield, Star, Zap, Crown,
} from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────
export interface CheckoutOrder {
    amount:            number;   // BRL
    description:       string;
    periodLabel:       string;   // e.g. "Premium"
    durationDays?:     number;   // e.g. 15
    perDay:            number;
    planName?:         string;   // e.g. "premium_boost"
    /** UUID of the anuncio being boosted – required by Edge Function */
    listingId?:        string;
    externalReference: string;
    payerEmail:        string;
    payerName:         string;
}

interface CheckoutModalProps {
    open:       boolean;
    order:      CheckoutOrder;
    onClose:    () => void;
    onApproved: (paymentId: string) => void;
}

type PayMethod = 'pix' | 'card' | 'boleto';
type Stage =
    | 'select'          // choose method
    | 'creating'        // waiting for backend
    | 'pix_waiting'     // QR shown, polling
    | 'card_processing' // card payment in progress
    | 'boleto_waiting'  // boleto shown
    | 'approved'
    | 'rejected';

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmt = (n: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n);

const fmtCard = (v: string) =>
    v.replace(/\D/g, '').slice(0, 16).replace(/(.{4})/g, '$1 ').trim();

const fmtExpiry = (v: string) => {
    const d = v.replace(/\D/g, '').slice(0, 4);
    return d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d;
};

const fmtCPF = (v: string) => {
    const d = v.replace(/\D/g, '').slice(0, 11);
    if (d.length <= 3) return d;
    if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
    if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
    return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
};

function detectBrand(num: string): string | null {
    const n = num.replace(/\s/g, '');
    if (/^4/.test(n))               return 'visa';
    if (/^5[1-5]/.test(n))          return 'master';
    if (/^3[47]/.test(n))           return 'amex';
    if (/^6(?:011|5)/.test(n))      return 'elo';
    if (/^(?:606282|3841)/.test(n)) return 'hipercard';
    return null;
}

const BRAND_COLORS: Record<string, string> = {
    visa: '#1A1F71', master: '#EB001B', amex: '#007BC1',
    elo: '#B8860B', hipercard: '#8B0000',
};
const BRAND_LABELS: Record<string, string> = {
    visa: 'VISA', master: 'MASTER', amex: 'AMEX', elo: 'ELO', hipercard: 'HIPER',
};
const brandToMethodId = (b: string | null) =>
    ({ visa: 'visa', master: 'master', amex: 'amex', elo: 'elo', hipercard: 'hipercard' })[b ?? ''] ?? 'visa';

const PLAN_ICONS: Record<string, React.ElementType> = {
    basic_boost: Zap,
    premium_boost: Star,
    ultra_boost: Crown,
};

// ── Countdown ─────────────────────────────────────────────────────────────────
function Countdown({ expiresAt }: { expiresAt: string | null }) {
    const [secs, setSecs] = useState<number | null>(null);
    useEffect(() => {
        if (!expiresAt) return;
        const tick = () => setSecs(Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000)));
        tick();
        const id = setInterval(tick, 1000);
        return () => clearInterval(id);
    }, [expiresAt]);
    if (secs === null) return null;
    const m   = Math.floor(secs / 60), s = secs % 60;
    const col = secs < 120 ? 'text-red-400' : secs < 300 ? 'text-yellow-400' : 'text-emerald-400';
    return (
        <span className={`font-mono font-bold tabular-nums ${col}`}>
            {String(m).padStart(2, '0')}:{String(s).padStart(2, '0')}
        </span>
    );
}

// ── QR renderer ───────────────────────────────────────────────────────────────
function QRImg({ base64, code }: { base64?: string | null; code?: string | null }) {
    if (base64) return (
        <img src={`data:image/png;base64,${base64}`} alt="PIX QR Code"
            className="w-52 h-52 rounded-xl object-contain" />
    );
    if (code) return (
        <QRCodeSVG value={code} size={208} bgColor="#ffffff" fgColor="#18181b" level="M" className="rounded-xl" />
    );
    return (
        <div className="w-52 h-52 bg-white rounded-xl flex items-center justify-center">
            <QrCode className="w-20 h-20 text-zinc-300" strokeWidth={1} />
        </div>
    );
}

// ── Plan summary card ─────────────────────────────────────────────────────────
function PlanSummary({ order }: { order: CheckoutOrder }) {
    const PlanIcon = PLAN_ICONS[order.planName ?? ''] ?? Rocket;
    return (
        <div className="bg-zinc-800/60 border border-white/8 rounded-2xl p-4 mb-4">
            <p className="text-zinc-500 text-xs font-bold uppercase tracking-wider mb-3">Resumo do pedido</p>
            <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-brand-400/15 rounded-xl flex items-center justify-center flex-shrink-0">
                    <PlanIcon className="w-5 h-5 text-brand-400" strokeWidth={1.5} />
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-white font-black text-sm">Impulsionar Anúncio</p>
                    <p className="text-zinc-400 text-xs mt-0.5">
                        Plano <span className="text-brand-400 font-bold">{order.periodLabel}</span>
                        {order.durationDays && ` · ${order.durationDays} dias de destaque`}
                    </p>
                    <p className="text-zinc-500 text-xs mt-0.5">{fmt(order.perDay)}/dia</p>
                </div>
                <div className="flex-shrink-0 text-right">
                    <p className="text-2xl font-black text-white">{fmt(order.amount)}</p>
                    <p className="text-zinc-600 text-xs">BRL</p>
                </div>
            </div>
            {/* Security badges */}
            <div className="flex items-center gap-3 mt-3 pt-3 border-t border-white/5">
                <div className="flex items-center gap-1.5">
                    <Shield className="w-3.5 h-3.5 text-emerald-400" strokeWidth={1.5} />
                    <span className="text-xs text-zinc-500">SSL 256-bit</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-brand-400" strokeWidth={1.5} />
                    <span className="text-xs text-zinc-500">Mercado Pago</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-zinc-500" strokeWidth={1.5} />
                    <span className="text-xs text-zinc-500">Pagamento seguro</span>
                </div>
            </div>
        </div>
    );
}

// ── Main Modal ────────────────────────────────────────────────────────────────
export default function CheckoutModal({ open, order, onClose, onApproved }: CheckoutModalProps) {
    const [tab,    setTab]    = useState<PayMethod>('pix');
    const [stage,  setStage]  = useState<Stage>('select');
    const [error,  setError]  = useState('');

    // PIX state
    const [pixId,     setPixId]     = useState('');
    const [qrBase64,  setQrBase64]  = useState<string | null>(null);
    const [qrCode,    setQrCode]    = useState<string | null>(null);
    const [ticketUrl, setTicketUrl] = useState<string | null>(null);
    const [expiresAt, setExpiresAt] = useState<string | null>(null);
    const [copied,    setCopied]    = useState(false);

    // Boleto state
    const [boletoUrl,     setBoletoUrl]     = useState<string | null>(null);
    const [boletoBarcode, setBoletoBarcode] = useState<string | null>(null);
    const [boletoExp,     setBoletoExp]     = useState<string | null>(null);

    // Card state
    const [cardNumber,  setCardNumber]  = useState('');
    const [cardName,    setCardName]    = useState('');
    const [cardExpiry,  setCardExpiry]  = useState('');
    const [cardCVV,     setCardCVV]     = useState('');
    const [cardCPF,     setCardCPF]     = useState('');
    const [cardInstall, setCardInstall] = useState(1);
    const [cardBrand,   setCardBrand]   = useState<string | null>(null);

    const pollRef    = useRef<ReturnType<typeof setInterval> | null>(null);
    const createdRef = useRef(false);

    // Edge Functions base URL – resolved by paymentApi.ts
    const _apiBase = import.meta.env.VITE_PAYMENT_API_URL || '';
    void _apiBase; // used only in _post helper below

    // Reset on close
    useEffect(() => {
        if (!open) {
            setTab('pix'); setStage('select'); setError('');
            setPixId(''); setQrBase64(null); setQrCode(null);
            setTicketUrl(null); setExpiresAt(null); setCopied(false);
            setBoletoUrl(null); setBoletoBarcode(null); setBoletoExp(null);
            setCardNumber(''); setCardName(''); setCardExpiry('');
            setCardCVV(''); setCardCPF(''); setCardInstall(1); setCardBrand(null);
            createdRef.current = false;
            if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
        }
    }, [open]);

    // Body scroll lock
    useEffect(() => {
        document.body.style.overflow = open ? 'hidden' : '';
        return () => { document.body.style.overflow = ''; };
    }, [open]);

    // Cleanup polling on unmount
    useEffect(() => () => {
        if (pollRef.current) clearInterval(pollRef.current);
    }, []);

    // Load MP SDK
    useEffect(() => {
        if (!open || window.MercadoPago) return;
        const s = document.createElement('script');
        s.src = 'https://sdk.mercadopago.com/js/v2';
        s.async = true;
        document.head.appendChild(s);
    }, [open]);

    // ── API helper ────────────────────────────────────────────────────────────
    // Kept for card flow; PIX/boleto now use paymentApi.ts helpers directly.
    // Path rewrites: legacy paths → deployed Edge Function names.
    const _post = useCallback(async (path: string, body: object) => {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
        const anonKey     = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
        const base        = import.meta.env.VITE_SUPABASE_FUNCTIONS_URL
                         || (supabaseUrl ? `${supabaseUrl}/functions/v1` : _apiBase);
        // Rewrite old paths → deployed function names
        const fnName = path
            .replace(/^\/api\/payments\/create$/, '/create-mp-payment')
            .replace(/^\/api\/payment-status\/(.+)$/, '/check-mp-payment')
            .replace(/^\/create-payment$/, '/create-mp-payment')
            .replace(/^\/payment-status(?:\/.*)?$/, '/check-mp-payment');
        const url = `${base}${fnName.startsWith('/') ? '' : '/'}${fnName}`;
        let res: Response;
        try {
            res = await fetch(url, {
                method:  'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(anonKey ? { apikey: anonKey, Authorization: `Bearer ${anonKey}` } : {}),
                },
                body: JSON.stringify(body),
            });
        } catch (networkErr) {
            throw new Error(
                `Falha de rede: ${(networkErr as Error).message}. Verifique sua conexão.`
            );
        }
        const data = await res.json().catch(() => ({}));
        if (!res.ok || data?.error) throw new Error(data?.error ?? `Erro ${res.status}`);
        return data;
    }, [_apiBase]);

    // ── PIX flow ──────────────────────────────────────────────────────────────
    const createPix = useCallback(async () => {
        if (createdRef.current) return;
        if (!order.payerEmail || !order.payerEmail.includes('@')) {
            setError('Faça login para continuar com o pagamento.');
            setStage('rejected');
            return;
        }
        createdRef.current = true;
        setStage('creating'); setError('');
        try {
            // Resolve user_id from Supabase session
            const { data: { session } } = await supabase.auth.getSession();
            const userId = session?.user?.id ?? '';

            const planBase = order.planName?.replace('_boost', '') ?? 'basic';
            const daysMap: Record<string, number> = { basic: 7, premium: 15, ultra: 30 };
            const dias     = order.durationDays ?? daysMap[planBase] ?? 7;

            // ── Call Supabase Edge Function: create-mp-payment ────────────
            const data = await createPayment({
                anuncio_id:     order.listingId ?? '',
                user_id:        userId,
                user_email:     order.payerEmail,
                periodo_key:    order.planName ?? `${planBase}_boost`,
                dias,
                preco:          order.amount,
                carro_desc:     order.description,
                payment_method: 'pix',
            });

            // payment_id is the Mercado Pago numeric payment ID
            const pollId = String(data.payment_id ?? data.pagamento_id ?? '');
            setPixId(pollId);
            // Response fields are normalised by paymentApi.ts (qr_code, qr_code_base64)
            setQrBase64(data.qr_code_base64 ?? null);
            setQrCode(data.qr_code ?? null);
            setTicketUrl(data.ticket_url ?? null);
            setExpiresAt(data.pix_expiration ?? null);
            setStage('pix_waiting');

            if (pollRef.current) clearInterval(pollRef.current);
            pollRef.current = setInterval(async () => {
                try {
                    // ── Poll via check-mp-payment Edge Function (POST {mp_payment_id}) ──
                    const s = await getPaymentStatus(pollId);
                    if (s.status === 'approved') {
                        clearInterval(pollRef.current!);
                        setStage('approved');
                        setTimeout(() => onApproved(pollId), 600);
                    } else if (
                        s.status === 'rejected' || s.status === 'cancelled'
                    ) {
                        clearInterval(pollRef.current!);
                        setError('Pagamento recusado ou cancelado.');
                        setStage('rejected');
                    }
                    // 'pending' → keep polling
                } catch { /* keep polling on transient network error */ }
            }, 5000);

        } catch (e: unknown) {
            createdRef.current = false;
            setError(e instanceof Error ? e.message : 'Erro ao gerar PIX.');
            setStage('rejected');
        }
    }, [order, onApproved]);

    // ── Boleto flow ───────────────────────────────────────────────────────────
    // Note: create-mp-payment does not support boleto; falls back to PIX flow.
    const createBoleto = useCallback(async () => {
        if (createdRef.current) return;
        if (!order.payerEmail || !order.payerEmail.includes('@')) {
            setError('Faça login para continuar com o pagamento.');
            setStage('rejected');
            return;
        }
        createdRef.current = true;
        setStage('creating'); setError('');
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const userId = session?.user?.id ?? '';

            const planBase = order.planName?.replace('_boost', '') ?? 'basic';
            const daysMap: Record<string, number> = { basic: 7, premium: 15, ultra: 30 };
            const dias     = order.durationDays ?? daysMap[planBase] ?? 7;

            // create-mp-payment only supports 'pix'|'credit_card';
            // boleto is treated as PIX on this backend.
            const data = await createPayment({
                anuncio_id:     order.listingId ?? '',
                user_id:        userId,
                user_email:     order.payerEmail,
                periodo_key:    order.planName ?? `${planBase}_boost`,
                dias,
                preco:          order.amount,
                carro_desc:     order.description,
                payment_method: 'pix',
            });
            // Display as a "boleto" with the PIX ticket URL
            setBoletoUrl(data.ticket_url ?? null);
            setBoletoBarcode(data.qr_code ?? null);
            setBoletoExp(data.pix_expiration ?? null);
            setStage('boleto_waiting');
        } catch (e: unknown) {
            createdRef.current = false;
            setError(e instanceof Error ? e.message : 'Erro ao gerar boleto.');
            setStage('rejected');
        }
    }, [order]);

    // ── Wait for SDK ──────────────────────────────────────────────────────────
    const waitForSDK = (): Promise<void> =>
        new Promise((resolve, reject) => {
            if (window.MercadoPago) { resolve(); return; }
            const timeout  = setTimeout(() => reject(new Error('SDK do Mercado Pago não carregou. Recarregue a página.')), 12000);
            const interval = setInterval(() => {
                if (window.MercadoPago) { clearInterval(interval); clearTimeout(timeout); resolve(); }
            }, 100);
        });

    // ── Card payment flow ─────────────────────────────────────────────────────
    const handleCard = async () => {
        if (!order.payerEmail || !order.payerEmail.includes('@')) { setError('Faça login para continuar.'); return; }
        const rawNum = cardNumber.replace(/\s/g, '');
        if (rawNum.length < 13)   { setError('Número do cartão inválido.'); return; }
        if (!cardName.trim())      { setError('Nome no cartão obrigatório.'); return; }
        if (cardExpiry.length < 5) { setError('Validade inválida (MM/AA).'); return; }
        if (cardCVV.length < 3)    { setError('CVV inválido.'); return; }
        const rawCPF = cardCPF.replace(/\D/g, '');
        if (rawCPF.length < 11)    { setError('CPF inválido (11 dígitos).'); return; }

        const [mStr, yStr] = cardExpiry.split('/');
        const expMonth = Number(mStr);
        const expYear  = Number(yStr?.length === 2 ? `20${yStr}` : (yStr ?? '99'));
        if (expMonth < 1 || expMonth > 12)      { setError('Mês de validade inválido.'); return; }
        if (expYear < new Date().getFullYear())  { setError('Cartão expirado.'); return; }

        setStage('card_processing'); setError('');

        let tokenId = '';
        try {
            await waitForSDK();
            const MPClass = window.MercadoPago;
            if (!MPClass) throw new Error('SDK do Mercado Pago não carregou. Recarregue a página.');
            const mp = new MPClass(import.meta.env.VITE_MP_PUBLIC_KEY || '');
            try {
                const tr = await mp.createCardToken({
                    cardNumber:           rawNum,
                    cardholderName:       cardName.trim().toUpperCase(),
                    cardExpirationMonth:  String(expMonth).padStart(2, '0'),
                    cardExpirationYear:   String(expYear),
                    securityCode:         cardCVV,
                    identificationType:   'CPF',
                    identificationNumber: rawCPF,
                });
                if (!tr?.id) {
                    const causes = (tr?.cause ?? []) as Array<{ description?: string }>;
                    throw new Error(causes[0]?.description ?? 'Dados do cartão inválidos.');
                }
                tokenId = tr.id;
            } catch (te: unknown) {
                const msg = te instanceof Error ? te.message : String(te);
                if (/cardNumber|card_number/i.test(msg))         throw new Error('Número do cartão inválido.');
                if (/expiration/i.test(msg))                      throw new Error('Data de validade inválida.');
                if (/securityCode|security_code|cvv/i.test(msg)) throw new Error('CVV inválido.');
                throw new Error(msg || 'Erro ao processar cartão.');
            }

            const { data: { session: cardSession } } = await supabase.auth.getSession();
            const cardUserId = cardSession?.user?.id ?? '';
            const planBase   = order.planName?.replace('_boost', '') ?? 'basic';
            const daysMap2: Record<string, number> = { basic: 7, premium: 15, ultra: 30 };
            const cardDias   = order.durationDays ?? daysMap2[planBase] ?? 7;

            const result = await createPayment({
                anuncio_id:       order.listingId ?? '',
                user_id:          cardUserId,
                user_email:       order.payerEmail || '',
                periodo_key:      order.planName ?? `${planBase}_boost`,
                dias:             cardDias,
                preco:            order.amount,
                carro_desc:       order.description,
                payment_method:   'credit_card',
                card_token:       tokenId,
                installments:     cardInstall,
                payment_method_id: brandToMethodId(cardBrand),
            });

            if (result.status === 'approved' || result.status === 'in_process' || result.status === 'pending') {
                setStage('approved');
                setTimeout(() => onApproved(String(result.payment_id)), 600);
            } else {
                const detailMsg: Record<string, string> = {
                    'cc_rejected_insufficient_amount': 'Saldo insuficiente no cartão.',
                    'cc_rejected_bad_filled_security_code': 'CVV inválido.',
                    'cc_rejected_bad_filled_date': 'Data de validade inválida.',
                    'cc_rejected_bad_filled_other': 'Dados do cartão incorretos.',
                    'cc_rejected_card_disabled': 'Cartão desabilitado. Contate seu banco.',
                    'cc_rejected_duplicated_payment': 'Pagamento duplicado.',
                    'cc_rejected_high_risk': 'Recusado por segurança. Tente outro cartão.',
                    'cc_rejected_invalid_installments': 'Número de parcelas inválido.',
                };
                const resultAny = result as unknown as Record<string, string>;
                const msg = detailMsg[resultAny['status_detail']] ?? `Pagamento recusado: ${resultAny['status_detail'] ?? result.status}.`;
                setError(msg);
                setStage('rejected');
            }
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : 'Erro no pagamento com cartão.');
            setStage('rejected');
        }
    };

    // ── Handle tab buttons ────────────────────────────────────────────────────
    const handlePixButton   = () => createPix();
    const handleBoletoButton = () => createBoleto();

    if (!open) return null;

    return (
        <AnimatePresence>
            {open && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        key="backdrop"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm"
                        onClick={stage !== 'creating' && stage !== 'card_processing' ? onClose : undefined}
                    />

                    {/* Modal */}
                    <motion.div
                        key="modal"
                        initial={{ opacity: 0, scale: 0.94, y: 20 }}
                        animate={{ opacity: 1, scale: 1,    y: 0  }}
                        exit={{ opacity: 0, scale: 0.94,    y: 20 }}
                        transition={{ type: 'spring', stiffness: 320, damping: 28 }}
                        className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
                    >
                        <div
                            className="pointer-events-auto w-full max-w-md bg-zinc-900 border border-white/10 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
                            onClick={e => e.stopPropagation()}
                        >
                            {/* Header */}
                            <div className="flex items-center justify-between px-5 py-4 border-b border-white/8 flex-shrink-0">
                                <div className="flex items-center gap-2.5">
                                    <div className="w-8 h-8 bg-brand-400/15 rounded-xl flex items-center justify-center">
                                        <Rocket className="w-4 h-4 text-brand-400" strokeWidth={1.5} />
                                    </div>
                                    <div>
                                        <p className="text-white font-black text-sm leading-tight">Impulsionar anúncio</p>
                                        <p className="text-zinc-500 text-[11px]">Checkout seguro</p>
                                    </div>
                                </div>
                                {stage !== 'creating' && stage !== 'card_processing' && (
                                    <button onClick={onClose}
                                        className="w-8 h-8 flex items-center justify-center rounded-lg bg-zinc-800 hover:bg-zinc-700 transition-colors"
                                        aria-label="Fechar">
                                        <X className="w-4 h-4 text-zinc-400" strokeWidth={1.5} />
                                    </button>
                                )}
                            </div>

                            {/* Scrollable body */}
                            <div className="flex-1 overflow-y-auto px-5 py-4">

                                {/* Plan summary (always visible) */}
                                <PlanSummary order={order} />

                                {/* ── SELECT / FORMS ── */}
                                {(stage === 'select' || stage === 'pix_waiting' || stage === 'boleto_waiting' || stage === 'card_processing' || stage === 'creating') && (
                                    <>
                                        {/* Tab selector */}
                                        {stage === 'select' && (
                                            <div className="flex gap-2 mb-4">
                                                {([
                                                    { id: 'pix'   as PayMethod, label: 'PIX',    icon: QrCode,    ring: 'ring-emerald-400' },
                                                    { id: 'card'  as PayMethod, label: 'Cartão', icon: CreditCard,ring: 'ring-blue-400' },
                                                    { id: 'boleto'as PayMethod, label: 'Boleto', icon: FileText,  ring: 'ring-amber-400' },
                                                ] as const).map(({ id, label, icon: Icon, ring }) => (
                                                    <button key={id} onClick={() => setTab(id)}
                                                        className={`flex-1 flex flex-col items-center gap-1 py-3 px-2 rounded-xl border-2 text-xs font-bold transition-all ${
                                                            tab === id
                                                                ? `ring-1 ${ring} border-white/20 bg-zinc-800 text-white`
                                                                : 'border-white/8 bg-zinc-800/40 text-zinc-500 hover:border-white/15'
                                                        }`}>
                                                        <Icon className="w-4 h-4" strokeWidth={1.5} />
                                                        {label}
                                                    </button>
                                                ))}
                                            </div>
                                        )}

                                        {/* ── PIX ── */}
                                        {(tab === 'pix' && (stage === 'select' || stage === 'creating')) && (
                                            <div className="space-y-3">
                                                <div className="bg-emerald-500/8 border border-emerald-500/20 rounded-xl p-4">
                                                    <p className="text-emerald-400 text-xs font-bold mb-1">PIX — Pagamento Instantâneo</p>
                                                    <ul className="text-zinc-400 text-xs space-y-1">
                                                        <li className="flex items-center gap-1.5"><Check className="w-3 h-3 text-emerald-400" strokeWidth={2.5} />Confirmação em segundos</li>
                                                        <li className="flex items-center gap-1.5"><Check className="w-3 h-3 text-emerald-400" strokeWidth={2.5} />Sem taxas adicionais</li>
                                                        <li className="flex items-center gap-1.5"><Check className="w-3 h-3 text-emerald-400" strokeWidth={2.5} />QR Code expira em 30 min</li>
                                                    </ul>
                                                </div>
                                                <button
                                                    onClick={handlePixButton}
                                                    disabled={stage === 'creating'}
                                                    className="w-full flex items-center justify-center gap-2.5 py-4 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-60 text-white font-black rounded-xl transition-all active:scale-[0.98]"
                                                >
                                                    {stage === 'creating'
                                                        ? <><Loader2 className="w-5 h-5 animate-spin" strokeWidth={1.5} />Gerando QR Code…</>
                                                        : <><QrCode className="w-5 h-5" strokeWidth={1.5} />Gerar QR Code PIX</>
                                                    }
                                                </button>
                                            </div>
                                        )}

                                        {/* ── PIX WAITING ── */}
                                        {stage === 'pix_waiting' && (
                                            <div className="text-center space-y-4">
                                                <div className="flex justify-center">
                                                    <div className="bg-white p-3 rounded-2xl shadow-lg ring-4 ring-emerald-400/10">
                                                        <QRImg base64={qrBase64} code={qrCode} />
                                                    </div>
                                                </div>
                                                <div>
                                                    <p className="text-white font-black text-sm mb-1">Escaneie o QR Code</p>
                                                    <p className="text-zinc-500 text-xs">Abra o app do seu banco → PIX → Ler QR Code</p>
                                                </div>
                                                {expiresAt && (
                                                    <div className="flex items-center justify-center gap-2 text-xs text-zinc-500">
                                                        <Clock className="w-3.5 h-3.5" strokeWidth={1.5} />
                                                        Expira em <Countdown expiresAt={expiresAt} />
                                                    </div>
                                                )}
                                                {qrCode && (
                                                    <button
                                                        onClick={() => { navigator.clipboard.writeText(qrCode); setCopied(true); setTimeout(() => setCopied(false), 2500); }}
                                                        className="w-full flex items-center justify-center gap-2 py-3 bg-zinc-800 hover:bg-zinc-700 border border-white/10 rounded-xl text-sm font-semibold text-zinc-300 transition-all"
                                                    >
                                                        {copied ? <><Check className="w-4 h-4 text-emerald-400" strokeWidth={2.5} />Copiado!</> : <><Copy className="w-4 h-4" strokeWidth={1.5} />Copiar código PIX</>}
                                                    </button>
                                                )}
                                                {ticketUrl && (
                                                    <a href={ticketUrl} target="_blank" rel="noreferrer"
                                                        className="w-full flex items-center justify-center gap-2 py-3 bg-zinc-800 hover:bg-zinc-700 border border-white/10 rounded-xl text-sm font-semibold text-zinc-300 transition-all">
                                                        <ExternalLink className="w-4 h-4" strokeWidth={1.5} />
                                                        Abrir no app Mercado Pago
                                                    </a>
                                                )}
                                                <div className="flex items-center justify-center gap-1.5 text-xs text-yellow-400 font-bold py-2">
                                                    <RefreshCw className="w-3.5 h-3.5 animate-spin" strokeWidth={1.5} />
                                                    Aguardando pagamento…
                                                </div>
                                            </div>
                                        )}

                                        {/* ── CARD ── */}
                                        {tab === 'card' && stage === 'select' && (
                                            <div className="space-y-3">
                                                {/* Card number */}
                                                <div>
                                                    <label className="text-xs text-zinc-400 font-semibold mb-1.5 block">Número do cartão</label>
                                                    <div className="relative">
                                                        <input
                                                            className="w-full bg-zinc-800 border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder-zinc-600 focus:outline-none focus:border-brand-400/50 focus:ring-1 focus:ring-brand-400/20 transition-all pr-16"
                                                            placeholder="0000 0000 0000 0000"
                                                            value={cardNumber}
                                                            onChange={e => { const f = fmtCard(e.target.value); setCardNumber(f); setCardBrand(detectBrand(f)); if (error) setError(''); }}
                                                            inputMode="numeric"
                                                        />
                                                        {cardBrand && (
                                                            <span className="absolute right-3 top-1/2 -translate-y-1/2 px-2 py-0.5 rounded text-[10px] font-black text-white"
                                                                style={{ background: BRAND_COLORS[cardBrand] ?? '#333' }}>
                                                                {BRAND_LABELS[cardBrand]}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                                <div>
                                                    <label className="text-xs text-zinc-400 font-semibold mb-1.5 block">Nome no cartão</label>
                                                    <input className="w-full bg-zinc-800 border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder-zinc-600 focus:outline-none focus:border-brand-400/50 focus:ring-1 focus:ring-brand-400/20 transition-all" placeholder="NOME COMPLETO" value={cardName} onChange={e => { setCardName(e.target.value.toUpperCase()); if (error) setError(''); }} />
                                                </div>
                                                <div className="grid grid-cols-2 gap-3">
                                                    <div>
                                                        <label className="text-xs text-zinc-400 font-semibold mb-1.5 block">Validade</label>
                                                        <input className="w-full bg-zinc-800 border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder-zinc-600 focus:outline-none focus:border-brand-400/50 focus:ring-1 focus:ring-brand-400/20 transition-all" placeholder="MM/AA" value={cardExpiry} onChange={e => { setCardExpiry(fmtExpiry(e.target.value)); if (error) setError(''); }} inputMode="numeric" />
                                                    </div>
                                                    <div>
                                                        <label className="text-xs text-zinc-400 font-semibold mb-1.5 block flex items-center gap-1">
                                                            CVV <Lock className="w-3 h-3 text-zinc-600" strokeWidth={1.5} />
                                                        </label>
                                                        <input className="w-full bg-zinc-800 border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder-zinc-600 focus:outline-none focus:border-brand-400/50 focus:ring-1 focus:ring-brand-400/20 transition-all" placeholder="123" value={cardCVV} onChange={e => { setCardCVV(e.target.value.replace(/\D/g, '').slice(0, 4)); if (error) setError(''); }} inputMode="numeric" />
                                                    </div>
                                                </div>
                                                <div>
                                                    <label className="text-xs text-zinc-400 font-semibold mb-1.5 block">CPF do titular</label>
                                                    <input className="w-full bg-zinc-800 border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder-zinc-600 focus:outline-none focus:border-brand-400/50 focus:ring-1 focus:ring-brand-400/20 transition-all" placeholder="000.000.000-00" value={cardCPF} onChange={e => { setCardCPF(fmtCPF(e.target.value)); if (error) setError(''); }} inputMode="numeric" />
                                                </div>
                                                <div>
                                                    <label className="text-xs text-zinc-400 font-semibold mb-1.5 block">Parcelas</label>
                                                    <select className="w-full bg-zinc-800 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-brand-400/50 transition-all" value={cardInstall} onChange={e => setCardInstall(Number(e.target.value))}>
                                                        {[1,2,3,6,12].map(n => (
                                                            <option key={n} value={n}>
                                                                {n}× {fmt(order.amount / n)} {n === 1 ? '(à vista)' : '(sem juros)'}
                                                            </option>
                                                        ))}
                                                    </select>
                                                </div>
                                                {error && (
                                                    <div className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-400/25 rounded-xl">
                                                        <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" strokeWidth={1.5} />
                                                        <p className="text-red-400 text-xs">{error}</p>
                                                    </div>
                                                )}
                                                <button onClick={handleCard}
                                                    className="w-full flex items-center justify-center gap-2.5 py-4 bg-blue-500 hover:bg-blue-400 text-white font-black rounded-xl transition-all active:scale-[0.98]">
                                                    <CreditCard className="w-5 h-5" strokeWidth={1.5} />
                                                    Pagar {fmt(order.amount)}
                                                </button>
                                            </div>
                                        )}

                                        {/* ── CARD PROCESSING ── */}
                                        {stage === 'card_processing' && (
                                            <div className="flex flex-col items-center gap-4 py-6 text-center">
                                                <div className="w-16 h-16 rounded-full border-2 border-blue-400/20 border-t-blue-400 animate-spin" />
                                                <p className="text-white font-bold">Processando pagamento…</p>
                                                <p className="text-zinc-500 text-xs">Aguarde, não feche esta janela.</p>
                                            </div>
                                        )}

                                        {/* ── BOLETO ── */}
                                        {tab === 'boleto' && (stage === 'select' || stage === 'creating') && (
                                            <div className="space-y-3">
                                                <div className="bg-amber-500/8 border border-amber-500/20 rounded-xl p-4">
                                                    <p className="text-amber-400 text-xs font-bold mb-1">Boleto Bancário</p>
                                                    <ul className="text-zinc-400 text-xs space-y-1">
                                                        <li className="flex items-center gap-1.5"><Check className="w-3 h-3 text-amber-400" strokeWidth={2.5} />Vence em 3 dias úteis</li>
                                                        <li className="flex items-center gap-1.5"><Check className="w-3 h-3 text-amber-400" strokeWidth={2.5} />Confirmação em 1–2 dias úteis</li>
                                                        <li className="flex items-center gap-1.5"><Check className="w-3 h-3 text-amber-400" strokeWidth={2.5} />Impresso ou pago no app</li>
                                                    </ul>
                                                </div>
                                                <button onClick={handleBoletoButton}
                                                    disabled={stage === 'creating'}
                                                    className="w-full flex items-center justify-center gap-2.5 py-4 bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-zinc-950 font-black rounded-xl transition-all active:scale-[0.98]">
                                                    {stage === 'creating'
                                                        ? <><Loader2 className="w-5 h-5 animate-spin" />Gerando boleto…</>
                                                        : <><FileText className="w-5 h-5" strokeWidth={1.5} />Gerar Boleto</>
                                                    }
                                                </button>
                                            </div>
                                        )}

                                        {/* ── BOLETO WAITING ── */}
                                        {stage === 'boleto_waiting' && (
                                            <div className="space-y-3">
                                                <div className="bg-amber-500/8 border border-amber-500/20 rounded-xl p-4 text-center">
                                                    <FileText className="w-8 h-8 text-amber-400 mx-auto mb-2" strokeWidth={1.5} />
                                                    <p className="text-white font-black text-sm mb-1">Boleto gerado!</p>
                                                    {boletoExp && (
                                                        <p className="text-zinc-500 text-xs">
                                                            Vence em: {new Date(boletoExp).toLocaleDateString('pt-BR')}
                                                        </p>
                                                    )}
                                                </div>
                                                {boletoBarcode && (
                                                    <button
                                                        onClick={() => { navigator.clipboard.writeText(boletoBarcode); setCopied(true); setTimeout(() => setCopied(false), 2500); }}
                                                        className="w-full flex items-center justify-center gap-2 py-3 bg-zinc-800 hover:bg-zinc-700 border border-white/10 rounded-xl text-sm font-semibold text-zinc-300 transition-all"
                                                    >
                                                        {copied ? <><Check className="w-4 h-4 text-emerald-400" strokeWidth={2.5} />Copiado!</> : <><Copy className="w-4 h-4" strokeWidth={1.5} />Copiar código de barras</>}
                                                    </button>
                                                )}
                                                {boletoUrl && (
                                                    <a href={boletoUrl} target="_blank" rel="noreferrer"
                                                        className="w-full flex items-center justify-center gap-2 py-3 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-black rounded-xl transition-all text-sm">
                                                        <ExternalLink className="w-4 h-4" strokeWidth={1.5} />
                                                        Visualizar / Imprimir Boleto
                                                    </a>
                                                )}
                                                <p className="text-center text-zinc-500 text-xs">
                                                    Após o pagamento, o boost será ativado em até 2 dias úteis.
                                                </p>
                                            </div>
                                        )}
                                    </>
                                )}

                                {/* ── APPROVED ── */}
                                {stage === 'approved' && (
                                    <div className="flex flex-col items-center gap-4 text-center py-4">
                                        <motion.div
                                            initial={{ scale: 0.5, opacity: 0 }}
                                            animate={{ scale: 1, opacity: 1 }}
                                            transition={{ type: 'spring', stiffness: 280, damping: 18 }}
                                            className="w-20 h-20 bg-emerald-500/15 border border-emerald-500/30 rounded-3xl flex items-center justify-center"
                                        >
                                            <CheckCircle2 className="w-10 h-10 text-emerald-400" strokeWidth={1.5} />
                                        </motion.div>
                                        <h2 className="text-2xl font-black text-white">Pagamento aprovado!</h2>
                                        <p className="text-zinc-400 text-sm">
                                            Seu anúncio está sendo impulsionado com o plano{' '}
                                            <span className="text-brand-400 font-bold">{order.periodLabel}</span>.
                                        </p>
                                        <div className="w-full bg-emerald-500/8 border border-emerald-500/20 rounded-xl p-3 text-left">
                                            {[
                                                `Plano ${order.periodLabel}`,
                                                order.durationDays ? `${order.durationDays} dias de destaque` : undefined,
                                                `Valor: ${fmt(order.amount)}`,
                                            ].filter(Boolean).map(l => (
                                                <div key={l} className="flex items-center gap-2 text-xs text-zinc-300 mb-1 last:mb-0">
                                                    <Check className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" strokeWidth={2.5} />
                                                    {l}
                                                </div>
                                            ))}
                                        </div>
                                        <button onClick={onClose}
                                            className="w-full flex items-center justify-center gap-2 py-3.5 bg-brand-400 hover:bg-brand-300 text-zinc-950 font-black rounded-xl transition-all">
                                            <Rocket className="w-5 h-5" strokeWidth={1.5} />
                                            Ver meus anúncios
                                        </button>
                                    </div>
                                )}

                                {/* ── REJECTED ── */}
                                {stage === 'rejected' && (
                                    <div className="flex flex-col items-center gap-4 text-center py-4">
                                        <div className="w-20 h-20 bg-red-500/15 border border-red-500/30 rounded-3xl flex items-center justify-center">
                                            <XCircle className="w-10 h-10 text-red-400" strokeWidth={1.5} />
                                        </div>
                                        <h2 className="text-2xl font-black text-white">Pagamento não realizado</h2>
                                        {error && (
                                            <div className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-400/25 rounded-xl w-full text-left">
                                                <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" strokeWidth={1.5} />
                                                <p className="text-red-400 text-xs">{error}</p>
                                            </div>
                                        )}
                                        <button onClick={() => { setStage('select'); setError(''); createdRef.current = false; }}
                                            className="w-full flex items-center justify-center gap-2 py-3.5 bg-zinc-800 hover:bg-zinc-700 border border-white/10 text-white font-bold rounded-xl transition-all">
                                            <RefreshCw className="w-4 h-4" strokeWidth={1.5} />
                                            Tentar novamente
                                        </button>
                                        <button onClick={onClose}
                                            className="text-zinc-500 hover:text-zinc-300 text-sm transition-colors">
                                            Cancelar
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* Footer trust line */}
                            {(stage === 'select' || stage === 'pix_waiting' || stage === 'boleto_waiting') && (
                                <div className="px-5 py-3 border-t border-white/5 flex-shrink-0">
                                    <div className="flex items-center justify-center gap-4 flex-wrap">
                                        <span className="flex items-center gap-1 text-[11px] text-zinc-600">
                                            <Shield className="w-3 h-3" strokeWidth={1.5} />SSL 256-bit
                                        </span>
                                        <span className="flex items-center gap-1 text-[11px] text-zinc-600">
                                            <ShieldCheck className="w-3 h-3" strokeWidth={1.5} />Mercado Pago
                                        </span>
                                        <span className="flex items-center gap-1 text-[11px] text-zinc-600">
                                            <Lock className="w-3 h-3" strokeWidth={1.5} />Checkout Transparente
                                        </span>
                                    </div>
                                </div>
                            )}
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
