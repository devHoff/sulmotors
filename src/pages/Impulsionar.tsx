import { useState, useEffect, useRef, useCallback } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Eye, Users, Zap, Rocket, ArrowLeft, QrCode,
    ShieldCheck, CreditCard, Copy, Check, RefreshCw,
    CheckCircle2, XCircle, Clock, X, ExternalLink,
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import type { Car } from '../data/mockCars';

// ── Period definitions ────────────────────────────────────────────────────────
const periods = [
    { key: '1_semana',  days: 7,   price: 19.90,  perDay: 2.84 },
    { key: '2_semanas', days: 14,  price: 34.90,  perDay: 2.49 },
    { key: '1_mes',     days: 30,  price: 59.90,  perDay: 2.00, savings: 30 },
    { key: '3_meses',   days: 90,  price: 149.90, perDay: 1.67, savings: 40 },
    { key: '6_meses',   days: 180, price: 269.90, perDay: 1.50, savings: 47 },
    { key: '1_ano',     days: 365, price: 479.90, perDay: 1.32, savings: 53 },
];

const periodLabels: Record<string, Record<string, string>> = {
    'pt-BR': { '1_semana': '1 semana',  '2_semanas': '2 semanas', '1_mes': '1 mês',   '3_meses': '3 meses',  '6_meses': '6 meses',  '1_ano': '1 ano' },
    'en':    { '1_semana': '1 week',    '2_semanas': '2 weeks',   '1_mes': '1 month', '3_meses': '3 months', '6_meses': '6 months', '1_ano': '1 year' },
    'es':    { '1_semana': '1 semana',  '2_semanas': '2 semanas', '1_mes': '1 mes',   '3_meses': '3 meses',  '6_meses': '6 meses',  '1_ano': '1 año' },
};

// ── Slider geometry ───────────────────────────────────────────────────────────
const DOT_D  = 20;
const DOT_R  = DOT_D / 2;
const TRACK_H = 2;
const WRAP_H  = 28;

// ── Types ─────────────────────────────────────────────────────────────────────
type PayMethod = 'pix' | 'credit_card' | 'mercadopago';
type PayStatus = 'idle' | 'loading' | 'pix_waiting' | 'card_form' | 'mp_redirect' | 'approved' | 'rejected';

interface PaymentResult {
    payment_id:          string;
    pagamento_id:        string | null;
    status:              string;
    status_detail:       string;
    pix_qr_code?:        string | null;
    pix_qr_code_base64?: string | null;
    pix_expiration?:     string | null;
    init_point?:         string | null;
    preference_id?:      string | null;
    _mock?:              boolean;
}

// ── Card input helpers ────────────────────────────────────────────────────────
const fmtCardNumber = (v: string) =>
    v.replace(/\D/g, '').slice(0, 16).replace(/(.{4})/g, '$1 ').trim();
const fmtExpiry = (v: string) => {
    const d = v.replace(/\D/g, '').slice(0, 4);
    return d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d;
};

// ── QR Code renderer ──────────────────────────────────────────────────────────
function QRImage({ base64, code, url }: { base64?: string | null; code?: string | null; url?: string | null }) {
    if (base64) {
        return (
            <img
                src={`data:image/png;base64,${base64}`}
                alt="PIX QR Code"
                className="w-48 h-48 mx-auto"
            />
        );
    }
    if (code) return <QRCodeSVG value={code} size={192} bgColor="#ffffff" fgColor="#18181b" level="M" />;
    if (url)  return <QRCodeSVG value={url}  size={192} bgColor="#ffffff" fgColor="#18181b" level="M" />;
    return (
        <div className="w-48 h-48 bg-white rounded-xl flex items-center justify-center">
            <QrCode className="w-32 h-32 text-zinc-800" strokeWidth={1} />
        </div>
    );
}

// ── Declare MercadoPago global (loaded from CDN) ──────────────────────────────
declare global {
    interface Window {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        MercadoPago: any;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        cardFormInstance: any;
    }
}

// ── Main component ────────────────────────────────────────────────────────────
export default function Impulsionar() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();
    const { t, language } = useLanguage();

    const [car, setCar]             = useState<Car | null>(null);
    const [loading, setLoading]     = useState(true);
    const [selectedPeriod, setSelectedPeriod] = useState(2);

    // Payment modal
    const [showModal, setShowModal] = useState(false);
    const [payMethod, setPayMethod] = useState<PayMethod>('pix');
    const [payStatus, setPayStatus] = useState<PayStatus>('idle');
    const [payResult, setPayResult] = useState<PaymentResult | null>(null);
    const [copied, setCopied]       = useState(false);

    // Credit card form (own fields — tokenized via MP SDK)
    const [cardNumber, setCardNumber]   = useState('');
    const [cardName, setCardName]       = useState('');
    const [cardExpiry, setCardExpiry]   = useState('');
    const [cardCVV, setCardCVV]         = useState('');
    const [cardInstall, setCardInstall] = useState(1);
    const [cardBrand, setCardBrand]     = useState<string | null>(null);
    const [cardProcessing, setCardProcessing] = useState(false);

    // Slider
    const trackRef   = useRef<HTMLDivElement>(null);
    const isDragging = useRef(false);
    const [dragging, setDragging] = useState(false);

    // PIX polling
    const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // Mercado Pago checkout URL (for the external-redirect / mp tab)
    const [mpCheckoutUrl, setMpCheckoutUrl] = useState<string | null>(null);

    const labels = periodLabels[language] ?? periodLabels['pt-BR'];
    const fmt = (p: number) =>
        new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(p);

    // ── Fetch car ──────────────────────────────────────────────────────────────
    useEffect(() => {
        const fetchCar = async () => {
            if (!id) return;
            const { data, error } = await supabase.from('anuncios').select('*').eq('id', id).single();
            if (error || !data) { toast.error('Anúncio não encontrado.'); navigate('/meus-anuncios'); return; }
            if (data.user_id !== user?.id) { toast.error('Sem permissão.'); navigate('/meus-anuncios'); return; }
            setCar({ ...data, aceitaTroca: data.aceita_troca, modelo_3d: false, imagens: data.imagens || [] });
            setLoading(false);
        };
        fetchCar();
    }, [id, user, navigate]);

    // Cleanup poll on unmount
    useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

    // ── Load MP SDK once ───────────────────────────────────────────────────────
    useEffect(() => {
        if (window.MercadoPago) return;
        const script = document.createElement('script');
        script.src = 'https://sdk.mercadopago.com/js/v2';
        script.async = true;
        document.head.appendChild(script);
    }, []);

    // ── Slider helpers ─────────────────────────────────────────────────────────
    const xToSnap = useCallback((clientX: number) => {
        const track = trackRef.current;
        if (!track) return selectedPeriod;
        const rect  = track.getBoundingClientRect();
        const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
        return Math.round(ratio * (periods.length - 1));
    }, [selectedPeriod]);

    const dotPct = (idx: number) => periods.length <= 1 ? 0 : (idx / (periods.length - 1)) * 100;

    const onPointerDown = useCallback((e: React.PointerEvent) => {
        e.preventDefault(); e.stopPropagation();
        e.currentTarget.setPointerCapture(e.pointerId);
        isDragging.current = true; setDragging(true);
    }, []);
    const onPointerMove = useCallback((e: React.PointerEvent) => {
        if (!isDragging.current) return;
        setSelectedPeriod(xToSnap(e.clientX));
    }, [xToSnap]);
    const onPointerUp = useCallback((e: React.PointerEvent) => {
        if (!isDragging.current) return;
        isDragging.current = false; setDragging(false);
        setSelectedPeriod(xToSnap(e.clientX));
    }, [xToSnap]);

    // ── Edge function caller ───────────────────────────────────────────────────
    const callFn = async (fnName: string, body: object) => {
        const supabaseUrl  = import.meta.env.VITE_SUPABASE_URL as string;
        const supabaseAnon = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
        const res = await fetch(`${supabaseUrl}/functions/v1/${fnName}`, {
            method: 'POST',
            headers: {
                'Content-Type':  'application/json',
                'apikey':        supabaseAnon,
                'Authorization': `Bearer ${supabaseAnon}`,
            },
            body: JSON.stringify(body),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || data?.error) throw new Error(data?.error ?? data?.message ?? `Erro ${res.status}`);
        return data;
    };

    // ── PIX polling ────────────────────────────────────────────────────────────
    const startPolling = (mpPaymentId: string) => {
        if (pollRef.current) clearInterval(pollRef.current);
        pollRef.current = setInterval(async () => {
            try {
                const r = await callFn('check-mp-payment', { mp_payment_id: mpPaymentId });
                if (r.status === 'approved') {
                    clearInterval(pollRef.current!);
                    setPayStatus('approved');
                } else if (r.status === 'rejected' || r.status === 'cancelled') {
                    clearInterval(pollRef.current!);
                    setPayStatus('rejected');
                }
            } catch (_) { /* keep polling */ }
        }, 4000);
    };

    // ── Handle PIX ────────────────────────────────────────────────────────────
    // Calls create-mp-payment (the correct function for real PIX QR codes).
    // Falls back to create-mp-preference (checkout redirect) only if the
    // payment function is still returning a server error.
    const handlePix = async () => {
        if (!id || !user || !car) return;
        setPayStatus('loading');
        try {
            const period = periods[selectedPeriod];
            const payload = {
                payment_method: 'pix',
                anuncio_id:     id,
                user_id:        user.id,
                user_email:     user.email ?? 'comprador@sulmotors.com.br',
                periodo_key:    period.key,
                dias:           period.days,
                preco:          period.price,
                carro_desc:     `${car.marca} ${car.modelo} ${car.ano}`,
            };

            // Try create-mp-payment first (returns real pix_qr_code + pix_qr_code_base64)
            let raw: Record<string, unknown>;
            try {
                raw = await callFn('create-mp-payment', payload);
            } catch (primaryErr) {
                // If the deployed function is still broken, fall back to
                // create-mp-preference (returns init_point for checkout redirect)
                console.warn('create-mp-payment failed, falling back:', primaryErr);
                const fallback = await callFn('create-mp-preference', {
                    anuncio_id:  id,
                    user_id:     user.id,
                    user_email:  user.email ?? 'comprador@sulmotors.com.br',
                    periodo_key: period.key,
                    dias:        period.days,
                    preco:       period.price,
                    carro_desc:  `${car.marca} ${car.modelo} ${car.ano}`,
                });
                raw = fallback;
            }

            const result: PaymentResult = {
                payment_id:         String(raw.payment_id   ?? raw.preference_id ?? 'mp-checkout'),
                pagamento_id:       (raw.pagamento_id as string) ?? null,
                status:             String(raw.status        ?? 'pending'),
                status_detail:      String(raw.status_detail ?? 'waiting_transfer'),
                pix_qr_code:        (raw.pix_qr_code        as string) ?? null,
                pix_qr_code_base64: (raw.pix_qr_code_base64 as string) ?? null,
                pix_expiration:     (raw.pix_expiration     as string) ?? null,
                init_point:         (raw.sandbox_init_point as string) ?? (raw.init_point as string) ?? null,
                preference_id:      (raw.preference_id      as string) ?? null,
                _mock:              Boolean(raw._mock),
            };

            setPayResult(result);
            setPayStatus('pix_waiting');

            if (result.payment_id && !result._mock && !result.preference_id) {
                startPolling(String(result.payment_id));
            }
            if (result._mock) {
                setTimeout(() => setPayStatus('approved'), 8000);
            }
        } catch (err: unknown) {
            setPayStatus('idle');
            toast.error(err instanceof Error ? err.message : 'Erro ao gerar PIX.');
        }
    };

    // ── Handle Card — tokenize via MP SDK, then call edge function ────────────
    const handleCard = async () => {
        if (!id || !user || !car) return;

        const rawNum = cardNumber.replace(/\s/g, '');
        if (rawNum.length < 13)     { toast.error('Número do cartão inválido.'); return; }
        if (!cardName.trim())        { toast.error('Nome no cartão obrigatório.'); return; }
        if (cardExpiry.length < 5)  { toast.error('Validade inválida (MM/AA).'); return; }
        if (cardCVV.length < 3)     { toast.error('CVV inválido.'); return; }

        setCardProcessing(true);
        setPayStatus('loading');

        try {
            const period = periods[selectedPeriod];
            const [expMonthStr, expYearStr] = cardExpiry.split('/');
            const expMonth = Number(expMonthStr);
            const expYear  = Number(`20${expYearStr}`);

            // ── Step 1: tokenize card via MP JS SDK ────────────────────────────
            const mpPubKey = import.meta.env.VITE_MP_PUBLIC_KEY as string;

            // Wait for MP SDK to load if it hasn't yet
            let mp = window.MercadoPago;
            if (!mp) {
                await new Promise<void>((resolve, reject) => {
                    const t = setTimeout(() => reject(new Error('MP SDK não carregou. Tente novamente.')), 8000);
                    const check = setInterval(() => {
                        if (window.MercadoPago) { clearInterval(check); clearTimeout(t); resolve(); }
                    }, 100);
                });
                mp = window.MercadoPago;
            }

            const mpInstance = new mp(mpPubKey, { locale: 'pt-BR' });

            // Create card token using the MP SDK
            const tokenResult = await mpInstance.createCardToken({
                cardNumber:      rawNum,
                cardholderName:  cardName.trim().toUpperCase(),
                cardExpirationMonth: String(expMonth).padStart(2, '0'),
                cardExpirationYear:  String(expYear),
                securityCode:    cardCVV,
                identificationType: 'CPF',
                identificationNumber: '00000000000',
            });

            if (!tokenResult?.id) {
                throw new Error(tokenResult?.cause?.[0]?.description ?? 'Erro ao tokenizar cartão. Verifique os dados.');
            }

            // ── Step 2: send token to create-mp-payment (correct function) ──────
            const result = await callFn('create-mp-payment', {
                payment_method:    'credit_card',
                anuncio_id:        id,
                user_id:           user.id,
                user_email:        user.email ?? 'comprador@sulmotors.com.br',
                periodo_key:       period.key,
                dias:              period.days,
                preco:             period.price,
                carro_desc:        `${car.marca} ${car.modelo} ${car.ano}`,
                card_token:        tokenResult.id,
                installments:      cardInstall,
                payment_method_id: cardBrand ?? 'visa',
            });

            setPayResult({
                payment_id:    result.payment_id    ?? result.preference_id ?? '',
                pagamento_id:  result.pagamento_id  ?? null,
                status:        result.status         ?? 'pending',
                status_detail: result.status_detail  ?? '',
                preference_id: result.preference_id  ?? null,
                init_point:    result.sandbox_init_point ?? result.init_point ?? null,
                _mock:         result._mock ?? false,
            });

            if (result.status === 'approved' || result._mock) {
                setPayStatus('approved');
            } else if (result.status === 'rejected') {
                setPayStatus('rejected');
            } else if (result.preference_id) {
                // Edge function returned a preference (old deployed version) — redirect to MP
                setMpCheckoutUrl(result.sandbox_init_point ?? result.init_point);
                setPayStatus('mp_redirect');
            } else {
                setPayStatus('approved'); // in_process → treat as pending approval
            }
        } catch (err: unknown) {
            setPayStatus('idle');
            toast.error(err instanceof Error ? err.message : 'Erro ao processar cartão.');
        } finally {
            setCardProcessing(false);
        }
    };

    // ── Detect card brand from first digits ───────────────────────────────────
    const detectBrand = (num: string): string | null => {
        const n = num.replace(/\s/g, '');
        if (/^4/.test(n)) return 'visa';
        if (/^5[1-5]/.test(n) || /^2[2-7]/.test(n)) return 'master';
        if (/^3[47]/.test(n)) return 'amex';
        if (/^6(?:011|5)/.test(n)) return 'elo';
        if (/^(?:606282|3841)/.test(n)) return 'hipercard';
        return null;
    };

    const onCardNumberChange = (val: string) => {
        const formatted = fmtCardNumber(val);
        setCardNumber(formatted);
        setCardBrand(detectBrand(formatted));
    };

    // ── Handle Mercado Pago redirect tab ──────────────────────────────────────
    const handleMercadoPago = async () => {
        if (!id || !user || !car) return;
        setPayStatus('loading');
        try {
            const period = periods[selectedPeriod];
            const data = await callFn('create-mp-preference', {
                anuncio_id:  id,
                user_id:     user.id,
                user_email:  user.email ?? 'comprador@sulmotors.com.br',
                periodo_key: period.key,
                dias:        period.days,
                preco:       period.price,
                carro_desc:  `${car.marca} ${car.modelo} ${car.ano}`,
            });
            const url = data.sandbox_init_point ?? data.init_point;
            if (!url) throw new Error('URL de pagamento não retornada.');
            setMpCheckoutUrl(url);
            setPayStatus('mp_redirect');
        } catch (err: unknown) {
            setPayStatus('idle');
            toast.error(err instanceof Error ? err.message : 'Erro ao gerar link.');
        }
    };

    // ── Copy helper ───────────────────────────────────────────────────────────
    const copyText = async (text: string) => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
    };

    // ── Close / reset modal ────────────────────────────────────────────────────
    const closeModal = () => {
        if (pollRef.current) clearInterval(pollRef.current);
        setShowModal(false);
        setPayStatus('idle');
        setPayResult(null);
        setMpCheckoutUrl(null);
        setCopied(false);
        setCardNumber(''); setCardName(''); setCardExpiry('');
        setCardCVV(''); setCardBrand(null);
    };

    const openModal = () => {
        setPayStatus('idle');
        setPayResult(null);
        setMpCheckoutUrl(null);
        setPayMethod('pix');
        setShowModal(true);
    };

    if (loading || !car) {
        return (
            <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
                <div className="w-12 h-12 rounded-full border-2 border-brand-400/20 border-t-brand-400 animate-spin" />
            </div>
        );
    }

    const period      = periods[selectedPeriod];
    const periodLabel = labels[period.key];
    const railTop     = WRAP_H / 2;

    // ── Render ─────────────────────────────────────────────────────────────────
    return (
        <div className="bg-zinc-950 min-h-screen py-12">
            <div className="max-w-xl mx-auto px-4">

                {/* Header */}
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-10">
                    <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-brand-400/10 border border-brand-400/30 rounded-full mb-4">
                        <Rocket className="w-3.5 h-3.5 text-brand-400" strokeWidth={1.5} />
                        <span className="text-xs font-bold text-brand-400 uppercase tracking-widest">{t.imp_badge}</span>
                    </div>
                    <h1 className="text-3xl md:text-4xl font-black text-white mb-3 tracking-tight">{t.imp_title}</h1>
                    <p className="text-zinc-400 text-sm">
                        {t.imp_subtitle} <span className="text-brand-400 font-bold">{t.imp_subtitle_accent}</span> {t.imp_subtitle_rest}
                    </p>
                </motion.div>

                {/* Car Preview */}
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
                    className="flex items-center gap-4 p-4 bg-zinc-900 border border-white/8 rounded-2xl mb-6">
                    {car.imagens[0] && <img src={car.imagens[0]} alt="" className="w-20 h-14 object-cover rounded-xl flex-shrink-0" />}
                    <div>
                        <h3 className="text-white font-bold">{car.marca} {car.modelo} {car.ano}</h3>
                        <p className="text-brand-400 font-black text-lg">{fmt(car.preco)}</p>
                    </div>
                </motion.div>

                {/* Benefits */}
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
                    className="grid grid-cols-3 gap-3 mb-6">
                    {[
                        { icon: Eye,   title: t.imp_benefit_views_title,    desc: t.imp_benefit_views_desc },
                        { icon: Users, title: t.imp_benefit_contacts_title, desc: t.imp_benefit_contacts_desc },
                        { icon: Zap,   title: t.imp_benefit_instant_title,  desc: t.imp_benefit_instant_desc },
                    ].map(({ icon: Icon, title, desc }) => (
                        <div key={title} className="text-center p-4 bg-zinc-900 border border-brand-400/15 rounded-2xl">
                            <Icon className="w-6 h-6 text-brand-400 mx-auto mb-2" strokeWidth={1.5} />
                            <h4 className="text-white text-xs font-bold">{title}</h4>
                            <p className="text-zinc-500 text-xs mt-0.5">{desc}</p>
                        </div>
                    ))}
                </motion.div>

                {/* Period Selector */}
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
                    className="bg-zinc-900 border border-white/8 rounded-2xl p-6 mb-6">
                    <h3 className="text-center font-black text-white text-lg mb-1">{t.imp_period_title}</h3>
                    <p className="text-center text-zinc-500 text-xs mb-10">{t.imp_period_sub}</p>

                    {/* Snap Slider */}
                    <div className="mb-10" style={{ paddingLeft: DOT_R, paddingRight: DOT_R }}>
                        <div ref={trackRef} className="relative select-none cursor-pointer" style={{ height: WRAP_H }}
                            onClick={(e) => { if (!isDragging.current) setSelectedPeriod(xToSnap(e.clientX)); }}>

                            <div className="absolute left-0 right-0 rounded-full bg-zinc-700"
                                style={{ top: railTop - TRACK_H / 2, height: TRACK_H }} />
                            <motion.div className="absolute left-0 rounded-full bg-brand-400 origin-left"
                                style={{ top: railTop - TRACK_H / 2, height: TRACK_H }}
                                animate={{ width: `${dotPct(selectedPeriod)}%` }}
                                transition={{ type: 'spring', stiffness: 350, damping: 35 }} />
                            {periods.map((_, i) => (
                                <div key={i} className="absolute w-[2px] rounded-full transition-colors duration-200"
                                    style={{
                                        left: `${dotPct(i)}%`, top: railTop - 7, height: 14,
                                        transform: 'translateX(-50%)',
                                        background: i <= selectedPeriod ? 'rgb(0 212 255)' : 'rgb(82 82 91)',
                                    }} />
                            ))}
                            <motion.div
                                className="absolute rounded-full bg-brand-400 z-10 touch-none"
                                style={{
                                    width: DOT_D, height: DOT_D, top: railTop - DOT_R,
                                    boxShadow: dragging ? '0 0 18px rgba(0,212,255,0.9)' : '0 0 12px rgba(0,212,255,0.6)',
                                    cursor: dragging ? 'grabbing' : 'grab',
                                    transform: 'translateX(-50%)',
                                }}
                                animate={{ left: `${dotPct(selectedPeriod)}%` }}
                                transition={{ type: 'spring', stiffness: 350, damping: 35 }}
                                onPointerDown={onPointerDown} onPointerMove={onPointerMove}
                                onPointerUp={onPointerUp} onPointerCancel={onPointerUp} />
                        </div>

                        <div className="relative mt-3" style={{ height: 20 }}>
                            {periods.map((p, i) => (
                                <button key={i} onClick={() => setSelectedPeriod(i)}
                                    className={`absolute text-[11px] font-semibold whitespace-nowrap leading-tight transition-colors duration-200
                                        ${selectedPeriod === i ? 'text-brand-400 font-bold' : 'text-zinc-500 hover:text-zinc-300'}`}
                                    style={{ left: `${dotPct(i)}%`, transform: 'translateX(-50%)' }}>
                                    {labels[p.key]}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Price Card */}
                    <AnimatePresence mode="wait">
                        <motion.div key={selectedPeriod}
                            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                            transition={{ duration: 0.18 }}
                            className="text-center p-6 bg-brand-400/8 border border-brand-400/20 rounded-xl mb-5">
                            <div className="flex items-center justify-center gap-1.5 text-brand-400 text-xs font-bold mb-2">
                                <Rocket className="w-3.5 h-3.5" strokeWidth={1.5} />
                                {periodLabel}
                            </div>
                            <p className="text-4xl font-black text-white">{fmt(period.price)}</p>
                            <p className="text-zinc-500 text-sm mt-1">{fmt(period.perDay)}{t.imp_per_day}</p>
                            {period.savings && (
                                <span className="inline-block mt-3 px-3 py-1 bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-bold rounded-full">
                                    {t.imp_economy.replace('{pct}', String(period.savings))}
                                </span>
                            )}
                        </motion.div>
                    </AnimatePresence>

                    {/* Payment method badges */}
                    <div className="flex items-center justify-center gap-2 mb-4 flex-wrap">
                        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-full">
                            <QrCode className="w-3.5 h-3.5 text-emerald-400" strokeWidth={1.5} />
                            <span className="text-xs text-emerald-400 font-bold">PIX</span>
                        </div>
                        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500/10 border border-blue-500/20 rounded-full">
                            <CreditCard className="w-3.5 h-3.5 text-blue-400" strokeWidth={1.5} />
                            <span className="text-xs text-blue-400 font-bold">Cartão de crédito</span>
                        </div>
                        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-400/10 border border-brand-400/20 rounded-full">
                            <ExternalLink className="w-3.5 h-3.5 text-brand-400" strokeWidth={1.5} />
                            <span className="text-xs text-brand-400 font-bold">Mercado Pago</span>
                        </div>
                    </div>

                    {/* CTA */}
                    <button onClick={openModal}
                        className="w-full flex items-center justify-center gap-2.5 py-4 bg-brand-400 hover:bg-brand-300 text-zinc-950 font-black rounded-xl transition-all hover:shadow-glow active:scale-[0.98]">
                        <Rocket className="w-5 h-5" strokeWidth={1.5} />
                        {t.imp_btn_boost} {fmt(period.price)}
                    </button>

                    <div className="flex items-center justify-center gap-1.5 mt-3">
                        <ShieldCheck className="w-3.5 h-3.5 text-zinc-600" strokeWidth={1.5} />
                        <p className="text-center text-xs text-zinc-600">Pagamento processado com segurança pelo Mercado Pago</p>
                    </div>
                </motion.div>

                <div className="text-center">
                    <Link to="/meus-anuncios" className="inline-flex items-center gap-1.5 text-zinc-500 hover:text-white text-sm transition-colors">
                        <ArrowLeft className="w-4 h-4" strokeWidth={1.5} />
                        {t.imp_back}
                    </Link>
                </div>
            </div>

            {/* ── Payment Modal ─────────────────────────────────────────────────── */}
            <AnimatePresence>
                {showModal && (
                    <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[999] flex items-end sm:items-center justify-center p-4 bg-black/75 backdrop-blur-sm"
                        onClick={(e) => { if (e.target === e.currentTarget && payStatus === 'idle') closeModal(); }}
                    >
                        <motion.div
                            initial={{ opacity: 0, y: 60, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 60, scale: 0.95 }}
                            transition={{ type: 'spring', stiffness: 320, damping: 32 }}
                            className="w-full max-w-sm bg-zinc-900 border border-white/10 rounded-3xl overflow-hidden shadow-2xl max-h-[92vh] overflow-y-auto"
                        >

                            {/* ────────────────────────────────────────────────────────
                                IDLE — method selector + forms
                            ──────────────────────────────────────────────────────── */}
                            {payStatus === 'idle' && (
                                <>
                                    {/* Header */}
                                    <div className="flex items-center justify-between p-5 border-b border-white/8">
                                        <div>
                                            <h2 className="text-lg font-black text-white">Finalizar pagamento</h2>
                                            <p className="text-zinc-500 text-xs mt-0.5">
                                                {car.marca} {car.modelo} · <span className="text-brand-400 font-bold">{fmt(period.price)}</span>
                                            </p>
                                        </div>
                                        <button onClick={closeModal} className="w-8 h-8 flex items-center justify-center rounded-full bg-zinc-800 hover:bg-zinc-700 transition-colors">
                                            <X className="w-4 h-4 text-zinc-400" strokeWidth={1.5} />
                                        </button>
                                    </div>

                                    {/* Tab switcher */}
                                    <div className="flex gap-1.5 p-4 pb-0">
                                        {([
                                            { id: 'pix',         label: 'PIX',          icon: QrCode,       active: 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400' },
                                            { id: 'credit_card', label: 'Cartão',       icon: CreditCard,   active: 'bg-blue-500/15 border-blue-500/30 text-blue-400' },
                                            { id: 'mercadopago', label: 'Mercado Pago', icon: ExternalLink, active: 'bg-brand-400/15 border-brand-400/30 text-brand-400' },
                                        ] as { id: PayMethod; label: string; icon: React.ElementType; active: string }[]).map(({ id: mId, label, icon: Icon, active }) => (
                                            <button key={mId} onClick={() => setPayMethod(mId)}
                                                className={`flex-1 flex flex-col items-center justify-center gap-1 py-2.5 px-1 rounded-xl text-[11px] font-bold transition-all
                                                    ${payMethod === mId
                                                        ? `border ${active}`
                                                        : 'bg-zinc-800 border border-transparent text-zinc-500 hover:text-zinc-300'
                                                    }`}>
                                                <Icon className="w-4 h-4" strokeWidth={1.5} />
                                                {label}
                                            </button>
                                        ))}
                                    </div>

                                    <div className="p-4 space-y-3">

                                        {/* ── PIX tab ── */}
                                        {payMethod === 'pix' && (
                                            <>
                                                <div className="p-4 bg-emerald-500/8 border border-emerald-500/15 rounded-2xl text-center">
                                                    <QrCode className="w-10 h-10 text-emerald-400 mx-auto mb-2" strokeWidth={1.5} />
                                                    <p className="text-emerald-300 text-sm font-bold mb-1">Pague com PIX</p>
                                                    <p className="text-zinc-400 text-xs">QR Code gerado na próxima tela. Aprovação em segundos.</p>
                                                </div>
                                                <div className="flex items-center justify-between text-sm py-1">
                                                    <span className="text-zinc-400">Período</span>
                                                    <span className="text-white font-bold">{periodLabel}</span>
                                                </div>
                                                <div className="flex items-center justify-between text-sm pb-1">
                                                    <span className="text-zinc-400">Total</span>
                                                    <span className="text-brand-400 font-black text-lg">{fmt(period.price)}</span>
                                                </div>
                                                <button onClick={handlePix}
                                                    className="w-full flex items-center justify-center gap-2.5 py-3.5 bg-emerald-500 hover:bg-emerald-400 text-white font-black rounded-xl transition-all active:scale-[0.98]">
                                                    <QrCode className="w-5 h-5" strokeWidth={1.5} />
                                                    Gerar QR Code PIX
                                                </button>
                                            </>
                                        )}

                                        {/* ── Credit Card tab ── */}
                                        {payMethod === 'credit_card' && (
                                            <>
                                                <div className="space-y-3">
                                                    {/* Card number + brand */}
                                                    <div>
                                                        <label className="text-xs text-zinc-400 font-medium mb-1 block">Número do cartão</label>
                                                        <div className="relative">
                                                            <input
                                                                type="text" inputMode="numeric" placeholder="0000 0000 0000 0000"
                                                                value={cardNumber}
                                                                onChange={(e) => onCardNumberChange(e.target.value)}
                                                                className="w-full bg-zinc-800 border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder-zinc-600 focus:outline-none focus:border-brand-400/50 font-mono tracking-widest pr-16"
                                                            />
                                                            {cardBrand && (
                                                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-zinc-400 uppercase">{cardBrand}</span>
                                                            )}
                                                        </div>
                                                    </div>
                                                    {/* Name */}
                                                    <div>
                                                        <label className="text-xs text-zinc-400 font-medium mb-1 block">Nome no cartão</label>
                                                        <input
                                                            type="text" placeholder="NOME COMO NO CARTÃO"
                                                            value={cardName}
                                                            onChange={(e) => setCardName(e.target.value.toUpperCase())}
                                                            className="w-full bg-zinc-800 border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder-zinc-600 focus:outline-none focus:border-brand-400/50 uppercase"
                                                        />
                                                    </div>
                                                    {/* Expiry + CVV */}
                                                    <div className="grid grid-cols-2 gap-3">
                                                        <div>
                                                            <label className="text-xs text-zinc-400 font-medium mb-1 block">Validade</label>
                                                            <input
                                                                type="text" inputMode="numeric" placeholder="MM/AA"
                                                                value={cardExpiry}
                                                                onChange={(e) => setCardExpiry(fmtExpiry(e.target.value))}
                                                                className="w-full bg-zinc-800 border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder-zinc-600 focus:outline-none focus:border-brand-400/50 font-mono"
                                                            />
                                                        </div>
                                                        <div>
                                                            <label className="text-xs text-zinc-400 font-medium mb-1 block">CVV</label>
                                                            <input
                                                                type="text" inputMode="numeric" placeholder="123"
                                                                value={cardCVV}
                                                                onChange={(e) => setCardCVV(e.target.value.replace(/\D/g, '').slice(0, 4))}
                                                                className="w-full bg-zinc-800 border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder-zinc-600 focus:outline-none focus:border-brand-400/50 font-mono"
                                                            />
                                                        </div>
                                                    </div>
                                                    {/* Installments */}
                                                    <div>
                                                        <label className="text-xs text-zinc-400 font-medium mb-1 block">Parcelas</label>
                                                        <select
                                                            value={cardInstall}
                                                            onChange={(e) => setCardInstall(Number(e.target.value))}
                                                            className="w-full bg-zinc-800 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-brand-400/50 appearance-none"
                                                        >
                                                            {[1, 2, 3, 6, 12].map((n) => (
                                                                <option key={n} value={n}>
                                                                    {n}x de {fmt(period.price / n)}{n === 1 ? ' (sem juros)' : ''}
                                                                </option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                </div>
                                                <button onClick={handleCard} disabled={cardProcessing}
                                                    className="w-full flex items-center justify-center gap-2.5 py-3.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-60 disabled:cursor-not-allowed text-white font-black rounded-xl transition-all active:scale-[0.98] mt-1">
                                                    {cardProcessing
                                                        ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Processando…</>
                                                        : <><CreditCard className="w-5 h-5" strokeWidth={1.5} />Pagar {fmt(period.price)}</>
                                                    }
                                                </button>
                                            </>
                                        )}

                                        {/* ── Mercado Pago tab ── */}
                                        {payMethod === 'mercadopago' && (
                                            <>
                                                <div className="p-4 bg-brand-400/8 border border-brand-400/15 rounded-2xl text-center">
                                                    <ExternalLink className="w-10 h-10 text-brand-400 mx-auto mb-2" strokeWidth={1.5} />
                                                    <p className="text-brand-300 text-sm font-bold mb-1">Checkout Mercado Pago</p>
                                                    <p className="text-zinc-400 text-xs">Você será redirecionado para o ambiente seguro do Mercado Pago. Aceita PIX, cartão e boleto.</p>
                                                </div>
                                                <div className="flex items-center justify-between text-sm py-1">
                                                    <span className="text-zinc-400">Período</span>
                                                    <span className="text-white font-bold">{periodLabel}</span>
                                                </div>
                                                <div className="flex items-center justify-between text-sm pb-1">
                                                    <span className="text-zinc-400">Total</span>
                                                    <span className="text-brand-400 font-black text-lg">{fmt(period.price)}</span>
                                                </div>
                                                <button onClick={handleMercadoPago}
                                                    className="w-full flex items-center justify-center gap-2.5 py-3.5 bg-brand-400 hover:bg-brand-300 text-zinc-950 font-black rounded-xl transition-all active:scale-[0.98]">
                                                    <ExternalLink className="w-5 h-5" strokeWidth={1.5} />
                                                    Ir para o Mercado Pago
                                                </button>
                                            </>
                                        )}

                                        <div className="flex items-center justify-center gap-1.5 pt-1">
                                            <ShieldCheck className="w-3 h-3 text-zinc-600" strokeWidth={1.5} />
                                            <p className="text-[11px] text-zinc-600">Ambiente seguro · Mercado Pago</p>
                                        </div>
                                    </div>
                                </>
                            )}

                            {/* ────────────────────────────────────────────────────────
                                LOADING
                            ──────────────────────────────────────────────────────── */}
                            {payStatus === 'loading' && (
                                <div className="p-12 flex flex-col items-center gap-4">
                                    <div className="w-16 h-16 rounded-full border-2 border-brand-400/20 border-t-brand-400 animate-spin" />
                                    <p className="text-white font-bold">Processando pagamento…</p>
                                    <p className="text-zinc-500 text-sm text-center">Aguarde, estamos se comunicando com o Mercado Pago.</p>
                                </div>
                            )}

                            {/* ────────────────────────────────────────────────────────
                                PIX WAITING — QR Code + copia e cola
                            ──────────────────────────────────────────────────────── */}
                            {payStatus === 'pix_waiting' && payResult && (
                                <>
                                    <div className="flex items-center justify-between p-5 border-b border-white/8">
                                        <div>
                                            <h2 className="text-lg font-black text-white">QR Code PIX</h2>
                                            <p className="text-zinc-500 text-xs mt-0.5">Escaneie para pagar {fmt(period.price)}</p>
                                        </div>
                                        <div className="flex items-center gap-1.5 px-2.5 py-1 bg-yellow-500/15 border border-yellow-500/30 rounded-full">
                                            <Clock className="w-3 h-3 text-yellow-400" strokeWidth={1.5} />
                                            <span className="text-xs text-yellow-400 font-bold">Aguardando</span>
                                        </div>
                                    </div>

                                    <div className="p-6 flex flex-col items-center gap-5">
                                        {/* QR image */}
                                        <div className="bg-white p-3 rounded-2xl shadow-lg">
                                            <QRImage
                                                base64={payResult.pix_qr_code_base64}
                                                code={payResult.pix_qr_code}
                                                url={payResult.init_point}
                                            />
                                        </div>

                                        {/* Notice when using MP checkout URL as QR */}
                                        {!payResult.pix_qr_code && !payResult.pix_qr_code_base64 && payResult.init_point && (
                                            <p className="text-yellow-400/80 text-xs text-center px-2">
                                                Escaneie para abrir o checkout Mercado Pago e selecione PIX para pagar.
                                            </p>
                                        )}

                                        {/* Polling indicator — only when we have a real payment ID */}
                                        {!payResult.preference_id && (
                                            <div className="flex items-center gap-2 text-zinc-400 text-xs">
                                                <RefreshCw className="w-3.5 h-3.5 animate-spin" strokeWidth={1.5} />
                                                Verificando pagamento automaticamente…
                                            </div>
                                        )}

                                        {/* ── PIX Copia e Cola ── always shown when there's any code/url */}
                                        {(payResult.pix_qr_code || payResult.init_point) && (() => {
                                            const pixCode = payResult.pix_qr_code ?? payResult.init_point ?? '';
                                            const label   = payResult.pix_qr_code
                                                ? 'Chave PIX copia e cola:'
                                                : 'Ou acesse o link de pagamento:';
                                            return (
                                                <div className="w-full space-y-2">
                                                    <p className="text-zinc-400 text-xs font-medium text-center">{label}</p>
                                                    <div className="flex gap-2 items-stretch">
                                                        <div className="flex-1 bg-zinc-800 border border-white/8 rounded-xl px-3 py-2.5 min-w-0">
                                                            <p className="text-zinc-300 text-xs font-mono break-all leading-relaxed">
                                                                {pixCode}
                                                            </p>
                                                        </div>
                                                        <button onClick={() => copyText(pixCode)}
                                                            className={`flex-shrink-0 flex flex-col items-center justify-center gap-1 px-3 rounded-xl text-xs font-bold transition-all border
                                                                ${copied
                                                                    ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
                                                                    : 'bg-zinc-800 border-white/10 text-zinc-300 hover:text-white'
                                                                }`}>
                                                            {copied
                                                                ? <><Check className="w-4 h-4" strokeWidth={1.5} /><span>Copiado</span></>
                                                                : <><Copy className="w-4 h-4" strokeWidth={1.5} /><span>Copiar</span></>
                                                            }
                                                        </button>
                                                    </div>
                                                </div>
                                            );
                                        })()}

                                        {/* Button to open MP checkout when using preference mode */}
                                        {payResult.preference_id && payResult.init_point && (
                                            <a href={payResult.init_point} target="_blank" rel="noopener noreferrer"
                                                className="w-full flex items-center justify-center gap-2 py-3 bg-brand-400 hover:bg-brand-300 text-zinc-950 font-black rounded-xl transition-all text-sm">
                                                <ExternalLink className="w-4 h-4" strokeWidth={1.5} />
                                                Abrir Mercado Pago para pagar com PIX
                                            </a>
                                        )}

                                        <p className="text-zinc-600 text-xs text-center">
                                            {payResult.preference_id
                                                ? 'Após pagar no Mercado Pago, o boost é ativado automaticamente.'
                                                : 'Esta tela atualiza automaticamente. Não feche esta janela.'
                                            }
                                        </p>
                                    </div>
                                </>
                            )}

                            {/* ────────────────────────────────────────────────────────
                                MP REDIRECT — show link to open in new tab
                            ──────────────────────────────────────────────────────── */}
                            {payStatus === 'mp_redirect' && mpCheckoutUrl && (
                                <>
                                    <div className="flex items-center justify-between p-5 border-b border-white/8">
                                        <div>
                                            <h2 className="text-lg font-black text-white">Checkout gerado</h2>
                                            <p className="text-zinc-500 text-xs mt-0.5">Abra o link para concluir o pagamento</p>
                                        </div>
                                        <button onClick={closeModal} className="w-8 h-8 flex items-center justify-center rounded-full bg-zinc-800 hover:bg-zinc-700 transition-colors">
                                            <X className="w-4 h-4 text-zinc-400" strokeWidth={1.5} />
                                        </button>
                                    </div>
                                    <div className="p-6 flex flex-col gap-4">
                                        <div className="p-4 bg-brand-400/8 border border-brand-400/20 rounded-2xl">
                                            <div className="flex items-center gap-3 mb-3">
                                                <div className="w-10 h-10 bg-brand-400/15 border border-brand-400/30 rounded-xl flex items-center justify-center flex-shrink-0">
                                                    <ExternalLink className="w-5 h-5 text-brand-400" strokeWidth={1.5} />
                                                </div>
                                                <div>
                                                    <p className="text-white font-bold text-sm">Mercado Pago</p>
                                                    <p className="text-zinc-500 text-xs">PIX · Cartão · Boleto</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center justify-between text-sm mb-1">
                                                <span className="text-zinc-400">Período</span>
                                                <span className="text-white font-bold">{periodLabel}</span>
                                            </div>
                                            <div className="flex items-center justify-between text-sm">
                                                <span className="text-zinc-400">Valor</span>
                                                <span className="text-brand-400 font-black">{fmt(period.price)}</span>
                                            </div>
                                        </div>
                                        <a href={mpCheckoutUrl} target="_blank" rel="noopener noreferrer"
                                            className="w-full flex items-center justify-center gap-2.5 py-4 bg-brand-400 hover:bg-brand-300 text-zinc-950 font-black rounded-xl transition-all hover:shadow-glow active:scale-[0.98] text-center">
                                            <ExternalLink className="w-5 h-5" strokeWidth={1.5} />
                                            Abrir Mercado Pago
                                        </a>
                                        <p className="text-zinc-500 text-xs text-center">
                                            Após pagar, o boost é ativado automaticamente. Você pode fechar esta janela.
                                        </p>
                                        <div className="flex items-center justify-center gap-1.5">
                                            <ShieldCheck className="w-3 h-3 text-zinc-600" strokeWidth={1.5} />
                                            <p className="text-[11px] text-zinc-600">Ambiente seguro certificado pelo Mercado Pago</p>
                                        </div>
                                    </div>
                                </>
                            )}

                            {/* ────────────────────────────────────────────────────────
                                APPROVED
                            ──────────────────────────────────────────────────────── */}
                            {payStatus === 'approved' && (
                                <div className="p-8 flex flex-col items-center gap-4 text-center">
                                    <motion.div
                                        initial={{ scale: 0.5, opacity: 0 }}
                                        animate={{ scale: 1, opacity: 1 }}
                                        transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                                        className="w-20 h-20 bg-emerald-500/15 border border-emerald-500/30 rounded-3xl flex items-center justify-center"
                                    >
                                        <CheckCircle2 className="w-10 h-10 text-emerald-400" strokeWidth={1.5} />
                                    </motion.div>
                                    <h2 className="text-2xl font-black text-white">Pagamento aprovado!</h2>
                                    <p className="text-zinc-400 text-sm leading-relaxed">
                                        Seu anúncio já está sendo impulsionado. Ele aparecerá no topo das buscas imediatamente.
                                    </p>
                                    <div className="flex items-center gap-2 px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-full">
                                        <Rocket className="w-3.5 h-3.5 text-emerald-400" strokeWidth={1.5} />
                                        <span className="text-emerald-400 text-xs font-bold">Boost ativo por {periodLabel}</span>
                                    </div>
                                    <button onClick={() => { closeModal(); navigate('/meus-anuncios'); }}
                                        className="w-full flex items-center justify-center gap-2 py-3.5 bg-brand-400 hover:bg-brand-300 text-zinc-950 font-black rounded-xl transition-all mt-2">
                                        <Rocket className="w-4 h-4" strokeWidth={1.5} />
                                        Ver Meus Anúncios
                                    </button>
                                </div>
                            )}

                            {/* ────────────────────────────────────────────────────────
                                REJECTED
                            ──────────────────────────────────────────────────────── */}
                            {payStatus === 'rejected' && (
                                <div className="p-8 flex flex-col items-center gap-4 text-center">
                                    <div className="w-20 h-20 bg-red-500/15 border border-red-500/30 rounded-3xl flex items-center justify-center">
                                        <XCircle className="w-10 h-10 text-red-400" strokeWidth={1.5} />
                                    </div>
                                    <h2 className="text-2xl font-black text-white">Pagamento recusado</h2>
                                    <p className="text-zinc-400 text-sm leading-relaxed">
                                        Seu pagamento foi recusado. Verifique os dados do cartão e tente novamente.
                                    </p>
                                    <button onClick={() => setPayStatus('idle')}
                                        className="w-full flex items-center justify-center gap-2 py-3 bg-zinc-800 hover:bg-zinc-700 border border-white/8 text-white font-bold rounded-xl transition-all text-sm">
                                        <RefreshCw className="w-4 h-4" strokeWidth={1.5} />
                                        Tentar novamente
                                    </button>
                                    <button onClick={closeModal} className="text-zinc-500 hover:text-zinc-300 text-sm transition-colors">
                                        Cancelar
                                    </button>
                                </div>
                            )}

                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
