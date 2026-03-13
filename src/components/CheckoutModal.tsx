import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { QRCodeSVG } from 'qrcode.react';
import {
    X, QrCode, CreditCard, Copy, Check, Loader2,
    Clock, CheckCircle2, XCircle, RefreshCw,
    ShieldCheck, Lock, AlertTriangle, Rocket,
} from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────
export interface CheckoutOrder {
    amount:            number;       // BRL value e.g. 19.90
    description:       string;       // e.g. "Impulsionar – Honda Civic 2022"
    periodLabel:       string;       // e.g. "1 semana"
    perDay:            number;       // e.g. 2.84
    externalReference: string;       // e.g. "anuncio-id:7"
    payerEmail:        string;
    payerName:         string;
}

interface CheckoutModalProps {
    open:       boolean;
    order:      CheckoutOrder;
    onClose:    () => void;
    onApproved: (paymentId: string) => void;
}

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
    visa:      '#1A1F71',
    master:    '#EB001B',
    amex:      '#007BC1',
    elo:       '#B8860B',
    hipercard: '#8B0000',
};
const BRAND_LABELS: Record<string, string> = {
    visa: 'VISA', master: 'MASTER', amex: 'AMEX', elo: 'ELO', hipercard: 'HIPER',
};
const brandToMethodId = (b: string | null): string =>
    ({ visa: 'visa', master: 'master', amex: 'amex', elo: 'elo', hipercard: 'hipercard' })[b ?? ''] ?? 'visa';

// ── Countdown for PIX ─────────────────────────────────────────────────────────
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
    const m = Math.floor(secs / 60), s = secs % 60;
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
        <QRCodeSVG value={code} size={208} bgColor="#ffffff"
            fgColor="#18181b" level="M" className="rounded-xl" />
    );
    return (
        <div className="w-52 h-52 bg-white rounded-xl flex items-center justify-center">
            <QrCode className="w-20 h-20 text-zinc-300" strokeWidth={1} />
        </div>
    );
}

// ── Card Brand Badge ───────────────────────────────────────────────────────────
function BrandBadge({ brand }: { brand: string | null }) {
    if (!brand) return null;
    return (
        <span
            className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-black px-2 py-0.5 rounded"
            style={{ background: BRAND_COLORS[brand] ?? '#555', color: '#fff' }}
        >
            {BRAND_LABELS[brand] ?? brand.toUpperCase()}
        </span>
    );
}

// ── Declare MP global ─────────────────────────────────────────────────────────
declare global {
    interface Window {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        MercadoPago: any;
    }
}

// ── Types ─────────────────────────────────────────────────────────────────────
type Tab   = 'pix' | 'card';
type Stage = 'select' | 'creating' | 'pix_waiting' | 'card_processing' | 'approved' | 'rejected';

// ── Main Modal ────────────────────────────────────────────────────────────────
export default function CheckoutModal({ open, order, onClose, onApproved }: CheckoutModalProps) {
    const [tab,   setTab]   = useState<Tab>('pix');
    const [stage, setStage] = useState<Stage>('select');
    const [error, setError] = useState('');

    // PIX state
    const [pixId,     setPixId]     = useState('');
    const [qrBase64,  setQrBase64]  = useState<string | null>(null);
    const [qrCode,    setQrCode]    = useState<string | null>(null);
    const [ticketUrl, setTicketUrl] = useState<string | null>(null);
    const [expiresAt, setExpiresAt] = useState<string | null>(null);
    const [copied,    setCopied]    = useState(false);

    // Card state
    const [cardNumber,  setCardNumber]  = useState('');
    const [cardName,    setCardName]    = useState('');
    const [cardExpiry,  setCardExpiry]  = useState('');
    const [cardCVV,     setCardCVV]     = useState('');
    const [cardInstall, setCardInstall] = useState(1);
    const [cardCPF,     setCardCPF]     = useState('');
    const [cardBrand,   setCardBrand]   = useState<string | null>(null);

    const pollRef    = useRef<ReturnType<typeof setInterval> | null>(null);
    const createdRef = useRef(false);
    const mpPubKey   = (import.meta.env.VITE_MP_PUBLIC_KEY as string) || '';
    const apiBase    = (import.meta.env.VITE_PAYMENT_API_URL as string) || '';

    // ── Lock body scroll ──────────────────────────────────────────────────────
    useEffect(() => {
        document.body.style.overflow = open ? 'hidden' : '';
        return () => { document.body.style.overflow = ''; };
    }, [open]);

    // ── Reset on close ────────────────────────────────────────────────────────
    useEffect(() => {
        if (!open) {
            if (pollRef.current) clearInterval(pollRef.current);
            createdRef.current = false;
            setTab('pix'); setStage('select'); setError('');
            setPixId(''); setQrBase64(null); setQrCode(null);
            setTicketUrl(null); setExpiresAt(null); setCopied(false);
            setCardNumber(''); setCardName(''); setCardExpiry('');
            setCardCVV(''); setCardInstall(1); setCardCPF('');
            setCardBrand(null);
        }
    }, [open]);

    // ── Cleanup on unmount ────────────────────────────────────────────────────
    useEffect(() => () => {
        if (pollRef.current) clearInterval(pollRef.current);
        document.body.style.overflow = '';
    }, []);

    // ── Ensure MP SDK is loaded ───────────────────────────────────────────────
    useEffect(() => {
        if (window.MercadoPago) return;
        const s = document.createElement('script');
        s.src = 'https://sdk.mercadopago.com/js/v2';
        s.async = true;
        document.head.appendChild(s);
    }, []);

    // ── API helper (POST /api/payments/create) ────────────────────────────────
    const post = useCallback(async (path: string, body: object) => {
        const res  = await fetch(`${apiBase}${path}`, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify(body),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || data?.error) throw new Error(data?.error ?? `Erro ${res.status}`);
        return data;
    }, [apiBase]);

    // ── PIX flow ──────────────────────────────────────────────────────────────
    const createPix = useCallback(async () => {
        if (createdRef.current) return;
        createdRef.current = true;
        setStage('creating');
        setError('');
        try {
            const data = await post('/api/payments/create', {
                payment_method:     'pix',
                transaction_amount: order.amount,
                description:        order.description,
                payer_email:        order.payerEmail || 'cliente@sulmotor.com.br',
                payer_name:         order.payerName,
                external_reference: order.externalReference,
            });

            setPixId(data.payment_id);
            setQrBase64(data.qr_code_base64 ?? null);
            setQrCode(data.qr_code ?? null);
            setTicketUrl(data.ticket_url ?? null);
            setExpiresAt(data.pix_expiration ?? null);
            setStage('pix_waiting');

            // Start polling every 4 s
            if (pollRef.current) clearInterval(pollRef.current);
            pollRef.current = setInterval(async () => {
                try {
                    const r = await fetch(`${apiBase}/api/payment-status/${data.payment_id}`);
                    const s = await r.json().catch(() => ({}));
                    if (s.status === 'approved') {
                        clearInterval(pollRef.current!);
                        setStage('approved');
                        setTimeout(() => onApproved(data.payment_id), 600);
                    } else if (s.status === 'rejected' || s.status === 'cancelled') {
                        clearInterval(pollRef.current!);
                        setError('Pagamento recusado ou cancelado.');
                        setStage('rejected');
                    }
                } catch { /* keep polling on network blip */ }
            }, 4000);

        } catch (e: unknown) {
            createdRef.current = false;
            setError(e instanceof Error ? e.message : 'Erro ao gerar PIX.');
            setStage('rejected');
        }
    }, [order, post, apiBase, onApproved]);

    const handlePixButton = () => { if (stage === 'select') createPix(); };

    // ── Wait for MP SDK ───────────────────────────────────────────────────────
    const waitForSDK = (): Promise<void> =>
        new Promise((resolve, reject) => {
            if (window.MercadoPago) { resolve(); return; }
            const t = setTimeout(() => reject(new Error('SDK do Mercado Pago não carregou. Recarregue a página.')), 12000);
            const i = setInterval(() => {
                if (window.MercadoPago) { clearInterval(i); clearTimeout(t); resolve(); }
            }, 100);
        });

    // ── Card payment flow ─────────────────────────────────────────────────────
    const handleCard = async () => {
        // Validate inputs
        const rawNum = cardNumber.replace(/\s/g, '');
        if (rawNum.length < 13)         { setError('Número do cartão inválido.'); return; }
        if (!cardName.trim())            { setError('Nome no cartão obrigatório.'); return; }
        if (cardExpiry.length < 5)      { setError('Validade inválida (MM/AA).'); return; }
        if (cardCVV.length < 3)         { setError('CVV inválido.'); return; }
        const rawCPF = cardCPF.replace(/\D/g, '');
        if (rawCPF.length < 11)         { setError('CPF inválido (11 dígitos).'); return; }

        const [mStr, yStr] = cardExpiry.split('/');
        const expMonth = Number(mStr);
        const expYear  = Number(yStr?.length === 2 ? `20${yStr}` : (yStr ?? '99'));
        if (expMonth < 1 || expMonth > 12)           { setError('Mês de validade inválido.'); return; }
        if (expYear < new Date().getFullYear())       { setError('Cartão expirado.'); return; }

        setStage('card_processing');
        setError('');

        try {
            if (!mpPubKey) throw new Error('Chave pública do Mercado Pago não configurada.');
            await waitForSDK();

            // ── Tokenize card via MP SDK ───────────────────────────────────────
            const mp = new window.MercadoPago(mpPubKey, { locale: 'pt-BR' });
            let tokenId: string;
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

            // ── POST to backend /api/payments/create ──────────────────────────
            const result = await post('/api/payments/create', {
                payment_method:     'credit_card',
                transaction_amount: order.amount,
                description:        order.description,
                payer_email:        order.payerEmail || 'cliente@sulmotor.com.br',
                payer_name:         cardName.trim(),
                payer_cpf:          rawCPF,
                payment_method_id:  brandToMethodId(cardBrand),
                external_reference: order.externalReference,
                installments:       cardInstall,
                token:              tokenId,   // MP card token
            });

            // MP statuses: approved | in_process | pending | rejected
            if (result.status === 'approved' || result.status === 'in_process' || result.status === 'pending') {
                setStage('approved');
                setTimeout(() => onApproved(String(result.payment_id)), 600);
            } else {
                const d = (result.status_detail ?? '') as string;
                let msg = 'Pagamento recusado. Tente outro cartão.';
                if (/insufficient|funds/i.test(d))       msg = 'Saldo insuficiente no cartão.';
                else if (/invalid|bad_filled/i.test(d))  msg = 'Dados do cartão inválidos.';
                else if (/security_code/i.test(d))       msg = 'CVV inválido.';
                else if (/blacklist|high_risk/i.test(d)) msg = 'Cartão não autorizado. Tente outro.';
                setError(msg);
                setStage('rejected');
            }
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : 'Erro ao processar cartão.');
            setStage('rejected');
        }
    };

    // ── Copy PIX code ─────────────────────────────────────────────────────────
    const copyPix = async () => {
        const text = qrCode ?? ticketUrl ?? '';
        if (!text) return;
        await navigator.clipboard.writeText(text).catch(() => {});
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
    };

    // ── Retry ─────────────────────────────────────────────────────────────────
    const retry = () => {
        createdRef.current = false;
        if (pollRef.current) clearInterval(pollRef.current);
        setPixId(''); setQrBase64(null); setQrCode(null);
        setTicketUrl(null); setExpiresAt(null);
        setError('');
        setStage('select');
    };

    if (!open) return null;

    const isProcessing = stage === 'creating' || stage === 'card_processing';

    return (
        <AnimatePresence>
            {open && (
                /* ── Backdrop ── */
                <motion.div
                    key="checkout-backdrop"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="fixed inset-0 z-[1000] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-sm"
                    onClick={(e) => {
                        if (e.target === e.currentTarget && !isProcessing && stage !== 'pix_waiting') {
                            onClose();
                        }
                    }}
                >
                    {/* ── Panel ── */}
                    <motion.div
                        key="checkout-panel"
                        initial={{ opacity: 0, y: 80, scale: 0.97 }}
                        animate={{ opacity: 1, y: 0,  scale: 1 }}
                        exit={{ opacity: 0,  y: 60,  scale: 0.97 }}
                        transition={{ type: 'spring', stiffness: 340, damping: 32 }}
                        className="relative w-full sm:max-w-md bg-zinc-900 border border-white/10 rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[96vh]"
                    >

                        {/* ─────────── HEADER ─────────── */}
                        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-white/8 flex-shrink-0">
                            <div>
                                <h2 className="text-lg font-black text-white tracking-tight">Finalizar pagamento</h2>
                                <p className="text-zinc-500 text-xs mt-0.5">Impulsionamento de anúncio</p>
                            </div>
                            {!isProcessing && stage !== 'approved' && (
                                <button
                                    onClick={onClose}
                                    aria-label="Fechar"
                                    className="w-8 h-8 flex items-center justify-center rounded-full bg-zinc-800 hover:bg-zinc-700 transition-colors"
                                >
                                    <X className="w-4 h-4 text-zinc-400" strokeWidth={1.5} />
                                </button>
                            )}
                        </div>

                        {/* ─────────── ORDER SUMMARY ─────────── */}
                        {(stage === 'select' || stage === 'creating') && (
                            <div className="mx-5 mt-4 mb-1 p-3.5 bg-zinc-800/60 border border-white/8 rounded-2xl flex items-center justify-between flex-shrink-0">
                                <div>
                                    <p className="text-white text-sm font-bold">
                                        Impulsionamento · {order.periodLabel}
                                    </p>
                                    <p className="text-zinc-500 text-xs mt-0.5">{fmt(order.perDay)}/dia</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-2xl font-black text-white">{fmt(order.amount)}</p>
                                    <p className="text-zinc-500 text-[11px]">único pagamento</p>
                                </div>
                            </div>
                        )}

                        {/* ─────────── SCROLLABLE BODY ─────────── */}
                        <div className="overflow-y-auto flex-1 min-h-0">

                            {/* ══ SELECT / CREATE STAGE ══ */}
                            {(stage === 'select' || stage === 'creating') && (
                                <div className="px-5 pt-4 pb-6 space-y-4">

                                    {/* Tab selector */}
                                    <div className="grid grid-cols-2 gap-2 p-1 bg-zinc-800 rounded-2xl">
                                        {([
                                            { id: 'pix',  label: 'PIX',    icon: QrCode,     ring: 'ring-emerald-400 bg-zinc-700' },
                                            { id: 'card', label: 'Cartão', icon: CreditCard, ring: 'ring-blue-400 bg-zinc-700' },
                                        ] as const).map(({ id, label, icon: Icon, ring }) => (
                                            <button
                                                key={id}
                                                onClick={() => { if (stage === 'select') setTab(id as Tab); }}
                                                disabled={stage === 'creating'}
                                                className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all
                                                    ${tab === id
                                                        ? `${ring} ring-1 text-white`
                                                        : 'text-zinc-500 hover:text-zinc-300'
                                                    }`}
                                            >
                                                <Icon className="w-4 h-4" strokeWidth={1.5} />
                                                {label}
                                            </button>
                                        ))}
                                    </div>

                                    {/* ── PIX TAB ── */}
                                    {tab === 'pix' && (
                                        <>
                                            {stage === 'creating' ? (
                                                <div className="flex flex-col items-center gap-4 py-8">
                                                    <div className="w-14 h-14 rounded-full border-2 border-emerald-400/20 border-t-emerald-400 animate-spin" />
                                                    <p className="text-white font-bold text-sm">Gerando QR Code PIX…</p>
                                                    <p className="text-zinc-500 text-xs">Conectando ao Mercado Pago</p>
                                                </div>
                                            ) : (
                                                <>
                                                    <div className="p-4 bg-emerald-500/8 border border-emerald-500/15 rounded-2xl space-y-2">
                                                        <div className="flex items-center gap-2">
                                                            <div className="w-8 h-8 bg-emerald-500/15 border border-emerald-500/30 rounded-lg flex items-center justify-center flex-shrink-0">
                                                                <QrCode className="w-4 h-4 text-emerald-400" strokeWidth={1.5} />
                                                            </div>
                                                            <p className="text-emerald-300 text-sm font-bold">Pague com PIX</p>
                                                        </div>
                                                        <ul className="text-zinc-400 text-xs space-y-1 pl-1">
                                                            <li>✓ QR Code gerado na hora</li>
                                                            <li>✓ Aprovação em segundos</li>
                                                            <li>✓ Sem dados de cartão</li>
                                                        </ul>
                                                    </div>

                                                    <button
                                                        onClick={handlePixButton}
                                                        className="w-full flex items-center justify-center gap-2.5 py-4 bg-emerald-500 hover:bg-emerald-400 text-white font-black rounded-xl transition-all active:scale-[0.98] text-base shadow-lg shadow-emerald-500/20"
                                                    >
                                                        <QrCode className="w-5 h-5" strokeWidth={1.5} />
                                                        Gerar QR Code PIX · {fmt(order.amount)}
                                                    </button>
                                                </>
                                            )}
                                        </>
                                    )}

                                    {/* ── CARD TAB ── */}
                                    {tab === 'card' && (
                                        <div className="space-y-3">
                                            {/* Card number */}
                                            <div>
                                                <label className="text-xs text-zinc-400 font-semibold mb-1.5 block">
                                                    Número do cartão
                                                </label>
                                                <div className="relative">
                                                    <input
                                                        type="text"
                                                        inputMode="numeric"
                                                        placeholder="0000 0000 0000 0000"
                                                        value={cardNumber}
                                                        onChange={(e) => {
                                                            const f = fmtCard(e.target.value);
                                                            setCardNumber(f);
                                                            setCardBrand(detectBrand(f));
                                                            if (error) setError('');
                                                        }}
                                                        className="w-full bg-zinc-800 border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder-zinc-600 focus:outline-none focus:border-blue-400/50 focus:ring-1 focus:ring-blue-400/20 font-mono tracking-widest pr-20 transition-all"
                                                        autoComplete="cc-number"
                                                        disabled={stage === 'card_processing'}
                                                    />
                                                    <BrandBadge brand={cardBrand} />
                                                </div>
                                            </div>

                                            {/* Cardholder name */}
                                            <div>
                                                <label className="text-xs text-zinc-400 font-semibold mb-1.5 block">
                                                    Nome no cartão
                                                </label>
                                                <input
                                                    type="text"
                                                    placeholder="NOME COMO NO CARTÃO"
                                                    value={cardName}
                                                    onChange={(e) => { setCardName(e.target.value.toUpperCase()); if (error) setError(''); }}
                                                    className="w-full bg-zinc-800 border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder-zinc-600 focus:outline-none focus:border-blue-400/50 focus:ring-1 focus:ring-blue-400/20 uppercase transition-all"
                                                    autoComplete="cc-name"
                                                    disabled={stage === 'card_processing'}
                                                />
                                            </div>

                                            {/* Expiry + CVV */}
                                            <div className="grid grid-cols-2 gap-3">
                                                <div>
                                                    <label className="text-xs text-zinc-400 font-semibold mb-1.5 block">Validade</label>
                                                    <input
                                                        type="text"
                                                        inputMode="numeric"
                                                        placeholder="MM/AA"
                                                        value={cardExpiry}
                                                        onChange={(e) => { setCardExpiry(fmtExpiry(e.target.value)); if (error) setError(''); }}
                                                        className="w-full bg-zinc-800 border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder-zinc-600 focus:outline-none focus:border-blue-400/50 focus:ring-1 focus:ring-blue-400/20 font-mono transition-all"
                                                        autoComplete="cc-exp"
                                                        disabled={stage === 'card_processing'}
                                                    />
                                                </div>
                                                <div>
                                                    <label className="text-xs text-zinc-400 font-semibold mb-1.5 block flex items-center gap-1">
                                                        CVV
                                                        <Lock className="w-3 h-3 text-zinc-600" strokeWidth={1.5} />
                                                    </label>
                                                    <input
                                                        type="password"
                                                        inputMode="numeric"
                                                        placeholder="•••"
                                                        value={cardCVV}
                                                        onChange={(e) => { setCardCVV(e.target.value.replace(/\D/g, '').slice(0, 4)); if (error) setError(''); }}
                                                        className="w-full bg-zinc-800 border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder-zinc-600 focus:outline-none focus:border-blue-400/50 focus:ring-1 focus:ring-blue-400/20 font-mono transition-all"
                                                        autoComplete="cc-csc"
                                                        disabled={stage === 'card_processing'}
                                                    />
                                                </div>
                                            </div>

                                            {/* CPF */}
                                            <div>
                                                <label className="text-xs text-zinc-400 font-semibold mb-1.5 block">CPF do titular</label>
                                                <input
                                                    type="text"
                                                    inputMode="numeric"
                                                    placeholder="000.000.000-00"
                                                    value={cardCPF}
                                                    onChange={(e) => { setCardCPF(fmtCPF(e.target.value)); if (error) setError(''); }}
                                                    className="w-full bg-zinc-800 border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder-zinc-600 focus:outline-none focus:border-blue-400/50 focus:ring-1 focus:ring-blue-400/20 font-mono transition-all"
                                                    autoComplete="off"
                                                    disabled={stage === 'card_processing'}
                                                />
                                            </div>

                                            {/* Installments */}
                                            <div>
                                                <label className="text-xs text-zinc-400 font-semibold mb-1.5 block">Parcelas</label>
                                                <select
                                                    value={cardInstall}
                                                    onChange={(e) => setCardInstall(Number(e.target.value))}
                                                    className="w-full bg-zinc-800 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-blue-400/50 focus:ring-1 focus:ring-blue-400/20 appearance-none transition-all cursor-pointer"
                                                    disabled={stage === 'card_processing'}
                                                >
                                                    {[1, 2, 3, 6, 12].map((n) => (
                                                        <option key={n} value={n}>
                                                            {n === 1
                                                                ? `1x de ${fmt(order.amount)} (sem juros)`
                                                                : `${n}x de ${fmt(order.amount / n)}`}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>

                                            {/* Error */}
                                            {error && (
                                                <div className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-400/25 rounded-xl">
                                                    <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" strokeWidth={1.5} />
                                                    <p className="text-red-400 text-xs">{error}</p>
                                                </div>
                                            )}

                                            {/* Pay button */}
                                            <button
                                                onClick={handleCard}
                                                disabled={stage === 'card_processing'}
                                                className="w-full flex items-center justify-center gap-2.5 py-4 bg-blue-600 hover:bg-blue-500 disabled:opacity-60 disabled:cursor-not-allowed text-white font-black rounded-xl transition-all active:scale-[0.98] text-base shadow-lg shadow-blue-600/20 mt-1"
                                            >
                                                {stage === 'card_processing' ? (
                                                    <><Loader2 className="w-5 h-5 animate-spin" strokeWidth={1.5} />Processando…</>
                                                ) : (
                                                    <><CreditCard className="w-5 h-5" strokeWidth={1.5} />Pagar {fmt(order.amount)}</>
                                                )}
                                            </button>

                                            <p className="text-[11px] text-zinc-600 text-center">
                                                Dados tokenizados pelo SDK do Mercado Pago. Não armazenamos dados do cartão.
                                            </p>
                                        </div>
                                    )}

                                    {/* Security footer */}
                                    <div className="flex items-center justify-center gap-1.5 pt-1">
                                        <ShieldCheck className="w-3.5 h-3.5 text-zinc-600" strokeWidth={1.5} />
                                        <span className="text-[11px] text-zinc-600">Pagamento seguro via Mercado Pago</span>
                                    </div>
                                </div>
                            )}

                            {/* ══ PIX WAITING STAGE ══ */}
                            {stage === 'pix_waiting' && (
                                <div className="px-5 py-5 flex flex-col items-center gap-4">
                                    {/* Status badge */}
                                    <div className="flex items-center gap-2 px-3 py-1.5 bg-yellow-500/15 border border-yellow-500/30 rounded-full">
                                        <RefreshCw className="w-3.5 h-3.5 text-yellow-400 animate-spin" strokeWidth={1.5} />
                                        <span className="text-xs text-yellow-400 font-bold">Aguardando pagamento…</span>
                                        {expiresAt && (
                                            <>
                                                <span className="text-yellow-600 text-xs">·</span>
                                                <Clock className="w-3 h-3 text-yellow-600" strokeWidth={1.5} />
                                                <Countdown expiresAt={expiresAt} />
                                            </>
                                        )}
                                    </div>

                                    {/* Amount */}
                                    <div className="text-center">
                                        <p className="text-3xl font-black text-white">{fmt(order.amount)}</p>
                                        <p className="text-zinc-500 text-xs mt-0.5">Impulsionamento · {order.periodLabel}</p>
                                    </div>

                                    {/* QR Code */}
                                    <div className="bg-white p-3 rounded-2xl shadow-lg ring-4 ring-emerald-400/10">
                                        <QRImg base64={qrBase64} code={qrCode} />
                                    </div>

                                    {/* Instructions */}
                                    <ol className="w-full text-xs text-zinc-400 space-y-1.5 list-decimal list-inside bg-zinc-800/50 border border-white/6 rounded-xl p-4">
                                        <li>Abra o app do seu banco</li>
                                        <li>Selecione <strong className="text-white">PIX → Ler QR Code</strong></li>
                                        <li>Escaneie o código acima</li>
                                        <li>Confirme o pagamento de <strong className="text-brand-400">{fmt(order.amount)}</strong></li>
                                    </ol>

                                    {/* Copy-paste code */}
                                    {(qrCode ?? ticketUrl) && (
                                        <div className="w-full space-y-2">
                                            <p className="text-xs text-zinc-500 font-medium text-center">PIX copia e cola:</p>
                                            <div className="flex gap-2 items-stretch">
                                                <div className="flex-1 min-w-0 bg-zinc-800 border border-white/8 rounded-xl px-3 py-2.5">
                                                    <p className="text-zinc-300 text-[11px] font-mono break-all leading-relaxed line-clamp-3">
                                                        {qrCode ?? ticketUrl}
                                                    </p>
                                                </div>
                                                <button
                                                    onClick={copyPix}
                                                    aria-label="Copiar código PIX"
                                                    className={`flex-shrink-0 flex flex-col items-center justify-center gap-1 px-3 rounded-xl text-[11px] font-bold transition-all border
                                                        ${copied
                                                            ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
                                                            : 'bg-zinc-800 border-white/10 text-zinc-300 hover:text-white'
                                                        }`}
                                                >
                                                    {copied
                                                        ? <><Check className="w-4 h-4" strokeWidth={1.5} /><span>Copiado</span></>
                                                        : <><Copy className="w-4 h-4" strokeWidth={1.5} /><span>Copiar</span></>
                                                    }
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                    {/* Open in MP app */}
                                    {ticketUrl && (
                                        <a
                                            href={ticketUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="w-full flex items-center justify-center gap-2 py-3 bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-bold rounded-xl hover:bg-emerald-500/25 transition-all text-sm"
                                        >
                                            Abrir no app Mercado Pago
                                        </a>
                                    )}

                                    <p className="text-zinc-600 text-xs text-center">
                                        Esta tela atualiza automaticamente. Não feche o modal.
                                    </p>

                                    <button
                                        onClick={onClose}
                                        className="text-zinc-600 hover:text-zinc-400 text-xs transition-colors"
                                    >
                                        Cancelar e fechar
                                    </button>

                                    <div className="flex items-center gap-1.5">
                                        <ShieldCheck className="w-3.5 h-3.5 text-zinc-600" strokeWidth={1.5} />
                                        <span className="text-[11px] text-zinc-600">Pagamento seguro · Mercado Pago</span>
                                    </div>
                                </div>
                            )}

                            {/* ══ CARD PROCESSING ══ */}
                            {stage === 'card_processing' && (
                                <div className="px-5 py-14 flex flex-col items-center gap-4">
                                    <div className="w-16 h-16 rounded-full border-2 border-blue-400/20 border-t-blue-400 animate-spin" />
                                    <p className="text-white font-bold">Processando pagamento…</p>
                                    <p className="text-zinc-500 text-sm text-center">
                                        Validando dados do cartão com segurança.
                                    </p>
                                </div>
                            )}

                            {/* ══ APPROVED ══ */}
                            {stage === 'approved' && (
                                <div className="px-6 py-10 flex flex-col items-center gap-5 text-center">
                                    <motion.div
                                        initial={{ scale: 0.4, opacity: 0 }}
                                        animate={{ scale: 1, opacity: 1 }}
                                        transition={{ type: 'spring', stiffness: 280, damping: 18 }}
                                        className="w-24 h-24 bg-emerald-500/15 border border-emerald-500/30 rounded-3xl flex items-center justify-center"
                                    >
                                        <CheckCircle2 className="w-12 h-12 text-emerald-400" strokeWidth={1.5} />
                                    </motion.div>
                                    <div>
                                        <h3 className="text-2xl font-black text-white mb-2">Pagamento aprovado!</h3>
                                        <p className="text-zinc-400 text-sm leading-relaxed">
                                            Seu anúncio já está sendo impulsionado. Ele aparecerá no topo das buscas imediatamente.
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-2 px-5 py-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-full">
                                        <Rocket className="w-4 h-4 text-emerald-400" strokeWidth={1.5} />
                                        <span className="text-emerald-400 text-sm font-bold">
                                            Boost ativo por {order.periodLabel}
                                        </span>
                                    </div>
                                    <button
                                        onClick={onClose}
                                        className="w-full flex items-center justify-center gap-2 py-4 bg-brand-400 hover:bg-brand-300 text-zinc-950 font-black rounded-xl transition-all text-base mt-1 shadow-lg shadow-brand-400/20"
                                    >
                                        <Rocket className="w-5 h-5" strokeWidth={1.5} />
                                        Ver Meus Anúncios
                                    </button>
                                </div>
                            )}

                            {/* ══ REJECTED ══ */}
                            {stage === 'rejected' && (
                                <div className="px-6 py-10 flex flex-col items-center gap-4 text-center">
                                    <div className="w-20 h-20 bg-red-500/15 border border-red-500/30 rounded-3xl flex items-center justify-center">
                                        <XCircle className="w-10 h-10 text-red-400" strokeWidth={1.5} />
                                    </div>
                                    <h3 className="text-xl font-black text-white">Pagamento não realizado</h3>
                                    {error && (
                                        <div className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-400/25 rounded-xl w-full text-left">
                                            <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" strokeWidth={1.5} />
                                            <p className="text-red-400 text-xs">{error}</p>
                                        </div>
                                    )}
                                    <button
                                        onClick={retry}
                                        className="w-full flex items-center justify-center gap-2 py-3.5 bg-zinc-800 hover:bg-zinc-700 border border-white/8 text-white font-bold rounded-xl transition-all"
                                    >
                                        <RefreshCw className="w-4 h-4" strokeWidth={1.5} />
                                        Tentar novamente
                                    </button>
                                    <button
                                        onClick={onClose}
                                        className="text-zinc-500 hover:text-zinc-300 text-sm transition-colors"
                                    >
                                        Cancelar
                                    </button>
                                </div>
                            )}

                        </div>
                        {/* end scrollable body */}

                    </motion.div>
                    {/* end panel */}
                </motion.div>
                /* end backdrop */
            )}
        </AnimatePresence>
    );
}

// Re-export pixId for external use if needed
export type { Tab, Stage };
