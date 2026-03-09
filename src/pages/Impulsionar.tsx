import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Eye, Users, Zap, Rocket, ArrowLeft, QrCode,
    ShieldCheck, CreditCard, CheckCircle2, X, ExternalLink,
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

// ── MP Bricks types (minimal) ─────────────────────────────────────────────────
declare global {
    interface Window {
        MercadoPago?: new (publicKey: string, opts?: { locale: string }) => {
            bricks(): {
                create(brick: string, containerId: string, config: Record<string, unknown>): Promise<{
                    unmount(): void;
                }>;
            };
        };
    }
}

// ── Load MP SDK once ──────────────────────────────────────────────────────────
function loadMPSdk(): Promise<void> {
    return new Promise((resolve, reject) => {
        if (window.MercadoPago) { resolve(); return; }
        const s = document.createElement('script');
        s.src = 'https://sdk.mercadopago.com/js/v2';
        s.onload  = () => resolve();
        s.onerror = () => reject(new Error('Falha ao carregar SDK do Mercado Pago.'));
        document.head.appendChild(s);
    });
}

// ── Main component ────────────────────────────────────────────────────────────
export default function Impulsionar() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();
    const { t, language } = useLanguage();

    const [car, setCar]               = useState<Car | null>(null);
    const [loading, setLoading]       = useState(true);
    const [selectedPeriod, setSelectedPeriod] = useState(2);

    // Modal state
    type ModalView = 'choose' | 'bricks' | 'redirect' | 'approved';
    const [showModal, setShowModal]   = useState(false);
    const [modalView, setModalView]   = useState<ModalView>('choose');
    const [processing, setProcessing] = useState(false);
    const [mpCheckoutUrl, setMpCheckoutUrl] = useState<string | null>(null);
    const [prefId, setPrefId]         = useState<string | null>(null);

    // Slider
    const trackRef    = useRef<HTMLDivElement>(null);
    const isDragging  = useRef(false);
    const [dragging, setDragging] = useState(false);

    // Bricks instance ref for cleanup
    const bricksRef = useRef<{ unmount(): void } | null>(null);
    const bricksContainerId = 'mp-bricks-container';

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

    // Cleanup Bricks on unmount
    useEffect(() => () => { bricksRef.current?.unmount(); }, []);

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

    // ── Get preference (used by both Bricks and redirect) ─────────────────────
    const getPreference = async () => {
        const period = periods[selectedPeriod];
        const data = await callFn('create-mp-preference', {
            anuncio_id:  id,
            user_id:     user!.id,
            user_email:  user!.email ?? 'comprador@sulmotors.com.br',
            periodo_key: period.key,
            dias:        period.days,
            preco:       period.price,
            carro_desc:  `${car!.marca} ${car!.modelo} ${car!.ano}`,
        });
        return {
            preference_id: data.preference_id as string,
            init_point:    (data.sandbox_init_point ?? data.init_point) as string,
        };
    };

    // ── Mount Bricks after container is visible in DOM ────────────────────────
    const mountBricks = async (prefIdValue: string) => {
        try {
            await loadMPSdk();

            const mpPublicKey = import.meta.env.VITE_MP_PUBLIC_KEY as string | undefined;
            if (!mpPublicKey) {
                // No public key configured — show a message to configure it
                throw new Error('VITE_MP_PUBLIC_KEY não configurada. Adicione no .env e rebuilde.');
            }

            const mp = new window.MercadoPago!(mpPublicKey, { locale: 'pt-BR' });
            const bricksBuilder = mp.bricks();

            bricksRef.current?.unmount();

            const instance = await bricksBuilder.create('payment', bricksContainerId, {
                initialization: {
                    amount: periods[selectedPeriod].price,
                    preferenceId: prefIdValue,
                },
                customization: {
                    paymentMethods: {
                        ticket:          'all',
                        bankTransfer:    'all',  // PIX
                        creditCard:      'all',
                        debitCard:       'all',
                        mercadoPago:     'all',
                    },
                    visual: {
                        style: {
                            theme: 'dark',
                        },
                    },
                },
                callbacks: {
                    onReady: () => { /* Bricks loaded */ },
                    onSubmit: ({ selectedPaymentMethod, formData }: { selectedPaymentMethod: string; formData: unknown }) => {
                        console.log('[Bricks] onSubmit', selectedPaymentMethod, formData);
                        // Bricks handles the payment internally when using preferenceId
                        return Promise.resolve();
                    },
                    onError: (error: unknown) => {
                        console.error('[Bricks] error:', error);
                        toast.error('Erro no widget de pagamento. Tente outra forma.');
                    },
                    onBinChange: () => { /* card bin changed */ },
                },
            });

            bricksRef.current = instance;
        } catch (err) {
            console.error('mountBricks error:', err);
            throw err;
        }
    };

    // ── Handle "Pagar com Bricks" (inline widget) ─────────────────────────────
    const handleBricks = async () => {
        if (!id || !user || !car) return;
        setProcessing(true);
        try {
            const { preference_id } = await getPreference();
            setPrefId(preference_id);
            setModalView('bricks');
            // Mount Bricks after the container renders
            setTimeout(() => mountBricks(preference_id), 150);
        } catch (err: unknown) {
            toast.error(err instanceof Error ? err.message : 'Erro ao gerar checkout.');
        } finally {
            setProcessing(false);
        }
    };

    // ── Handle "Abrir no Mercado Pago" (new tab) ──────────────────────────────
    const handleRedirect = async () => {
        if (!id || !user || !car) return;
        setProcessing(true);
        try {
            const { init_point } = await getPreference();
            setMpCheckoutUrl(init_point);
            setModalView('redirect');
        } catch (err: unknown) {
            toast.error(err instanceof Error ? err.message : 'Erro ao gerar link de pagamento.');
        } finally {
            setProcessing(false);
        }
    };

    // ── Close / reset modal ────────────────────────────────────────────────────
    const closeModal = () => {
        bricksRef.current?.unmount();
        bricksRef.current = null;
        setShowModal(false);
        setModalView('choose');
        setProcessing(false);
        setMpCheckoutUrl(null);
        setPrefId(null);
    };

    const openModal = () => {
        bricksRef.current?.unmount();
        bricksRef.current = null;
        setModalView('choose');
        setProcessing(false);
        setMpCheckoutUrl(null);
        setPrefId(null);
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
                                style={{ top: WRAP_H / 2 - TRACK_H / 2, height: TRACK_H }} />
                            <motion.div className="absolute left-0 rounded-full bg-brand-400 origin-left"
                                style={{ top: WRAP_H / 2 - TRACK_H / 2, height: TRACK_H }}
                                animate={{ width: `${dotPct(selectedPeriod)}%` }}
                                transition={{ type: 'spring', stiffness: 350, damping: 35 }} />
                            {periods.map((_, i) => (
                                <div key={i} className="absolute w-[2px] rounded-full transition-colors duration-200"
                                    style={{
                                        left: `${dotPct(i)}%`, top: WRAP_H / 2 - 7, height: 14,
                                        transform: 'translateX(-50%)',
                                        background: i <= selectedPeriod ? 'rgb(0 212 255)' : 'rgb(82 82 91)',
                                    }} />
                            ))}
                            <motion.div
                                className="absolute rounded-full bg-brand-400 z-10 touch-none"
                                style={{
                                    width: DOT_D, height: DOT_D, top: WRAP_H / 2 - DOT_R,
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
                        className="fixed inset-0 z-[999] flex items-end sm:items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
                        onClick={(e) => { if (e.target === e.currentTarget && !processing) closeModal(); }}
                    >
                        <motion.div
                            initial={{ opacity: 0, y: 60, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 60, scale: 0.95 }}
                            transition={{ type: 'spring', stiffness: 320, damping: 32 }}
                            className="w-full max-w-md bg-zinc-900 border border-white/10 rounded-3xl overflow-hidden shadow-2xl"
                        >

                            {/* ═══════════════════════════════════════════════════
                                VIEW: choose — pick payment method
                            ═══════════════════════════════════════════════════ */}
                            {modalView === 'choose' && (
                                <>
                                    {/* Header */}
                                    <div className="flex items-center justify-between p-5 border-b border-white/8">
                                        <div>
                                            <h2 className="text-lg font-black text-white">Como deseja pagar?</h2>
                                            <p className="text-zinc-500 text-xs mt-0.5">
                                                {car.marca} {car.modelo} ·{' '}
                                                <span className="text-brand-400 font-bold">{fmt(period.price)}</span>
                                                {' '}· {periodLabel}
                                            </p>
                                        </div>
                                        <button onClick={closeModal} className="w-8 h-8 flex items-center justify-center rounded-full bg-zinc-800 hover:bg-zinc-700 transition-colors">
                                            <X className="w-4 h-4 text-zinc-400" strokeWidth={1.5} />
                                        </button>
                                    </div>

                                    {/* Options */}
                                    <div className="p-5 space-y-3">

                                        {/* Option 1 — MP Checkout Bricks (inline: PIX + card + boleto) */}
                                        <button
                                            onClick={handleBricks}
                                            disabled={processing}
                                            className="w-full flex items-center gap-4 p-4 bg-zinc-800 hover:bg-zinc-700 border border-white/8 hover:border-brand-400/40 rounded-2xl transition-all text-left group disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            <div className="w-12 h-12 bg-emerald-500/15 border border-emerald-500/30 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:bg-emerald-500/20 transition-colors">
                                                <QrCode className="w-6 h-6 text-emerald-400" strokeWidth={1.5} />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-white font-bold text-sm">PIX / Cartão de crédito</p>
                                                <p className="text-zinc-400 text-xs mt-0.5">QR Code PIX gerado aqui · cartão de crédito · débito</p>
                                            </div>
                                            {processing ? (
                                                <div className="w-4 h-4 rounded-full border-2 border-brand-400/30 border-t-brand-400 animate-spin flex-shrink-0" />
                                            ) : (
                                                <div className="w-5 h-5 rounded-full border-2 border-zinc-600 group-hover:border-brand-400 transition-colors flex-shrink-0" />
                                            )}
                                        </button>

                                        {/* Option 2 — Open Mercado Pago in new tab */}
                                        <button
                                            onClick={handleRedirect}
                                            disabled={processing}
                                            className="w-full flex items-center gap-4 p-4 bg-zinc-800 hover:bg-zinc-700 border border-white/8 hover:border-brand-400/40 rounded-2xl transition-all text-left group disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            <div className="w-12 h-12 bg-brand-400/15 border border-brand-400/30 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:bg-brand-400/20 transition-colors">
                                                <ExternalLink className="w-6 h-6 text-brand-400" strokeWidth={1.5} />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-white font-bold text-sm">Abrir Mercado Pago</p>
                                                <p className="text-zinc-400 text-xs mt-0.5">Redireciona para o checkout oficial do Mercado Pago</p>
                                            </div>
                                            {processing ? (
                                                <div className="w-4 h-4 rounded-full border-2 border-brand-400/30 border-t-brand-400 animate-spin flex-shrink-0" />
                                            ) : (
                                                <div className="w-5 h-5 rounded-full border-2 border-zinc-600 group-hover:border-brand-400 transition-colors flex-shrink-0" />
                                            )}
                                        </button>

                                        <div className="flex items-center justify-center gap-1.5 pt-1">
                                            <ShieldCheck className="w-3 h-3 text-zinc-600" strokeWidth={1.5} />
                                            <p className="text-[11px] text-zinc-600">Ambiente seguro · Mercado Pago</p>
                                        </div>
                                    </div>
                                </>
                            )}

                            {/* ═══════════════════════════════════════════════════
                                VIEW: bricks — inline MP Checkout Bricks widget
                            ═══════════════════════════════════════════════════ */}
                            {modalView === 'bricks' && (
                                <>
                                    <div className="flex items-center justify-between p-5 border-b border-white/8">
                                        <div>
                                            <h2 className="text-lg font-black text-white">Pagamento</h2>
                                            <p className="text-zinc-500 text-xs mt-0.5">
                                                <span className="text-brand-400 font-bold">{fmt(period.price)}</span> · {periodLabel}
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <button onClick={() => { bricksRef.current?.unmount(); setModalView('choose'); }}
                                                className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors px-2 py-1">
                                                ← Voltar
                                            </button>
                                            <button onClick={closeModal} className="w-8 h-8 flex items-center justify-center rounded-full bg-zinc-800 hover:bg-zinc-700 transition-colors">
                                                <X className="w-4 h-4 text-zinc-400" strokeWidth={1.5} />
                                            </button>
                                        </div>
                                    </div>

                                    {/* MP Bricks renders into this div */}
                                    <div className="p-4 max-h-[70vh] overflow-y-auto">
                                        <div id={bricksContainerId} className="min-h-[200px]">
                                            {/* MP Bricks widget mounts here */}
                                            {!prefId && (
                                                <div className="flex flex-col items-center justify-center gap-3 py-12">
                                                    <div className="w-10 h-10 rounded-full border-2 border-brand-400/20 border-t-brand-400 animate-spin" />
                                                    <p className="text-zinc-400 text-sm">Carregando checkout…</p>
                                                </div>
                                            )}
                                        </div>

                                        <div className="flex items-center justify-center gap-1.5 mt-4">
                                            <ShieldCheck className="w-3 h-3 text-zinc-600" strokeWidth={1.5} />
                                            <p className="text-[11px] text-zinc-600">Pagamento seguro certificado pelo Mercado Pago</p>
                                        </div>
                                    </div>
                                </>
                            )}

                            {/* ═══════════════════════════════════════════════════
                                VIEW: redirect — show link to open in new tab
                            ═══════════════════════════════════════════════════ */}
                            {modalView === 'redirect' && mpCheckoutUrl && (
                                <>
                                    <div className="flex items-center justify-between p-5 border-b border-white/8">
                                        <div>
                                            <h2 className="text-lg font-black text-white">Checkout gerado</h2>
                                            <p className="text-zinc-500 text-xs mt-0.5">Abra o link para concluir o pagamento</p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <button onClick={() => setModalView('choose')}
                                                className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors px-2 py-1">
                                                ← Voltar
                                            </button>
                                            <button onClick={closeModal} className="w-8 h-8 flex items-center justify-center rounded-full bg-zinc-800 hover:bg-zinc-700 transition-colors">
                                                <X className="w-4 h-4 text-zinc-400" strokeWidth={1.5} />
                                            </button>
                                        </div>
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

                                        <a
                                            href={mpCheckoutUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="w-full flex items-center justify-center gap-2.5 py-4 bg-brand-400 hover:bg-brand-300 text-zinc-950 font-black rounded-xl transition-all hover:shadow-glow active:scale-[0.98] text-center"
                                        >
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

                            {/* ═══════════════════════════════════════════════════
                                VIEW: approved — success screen
                            ═══════════════════════════════════════════════════ */}
                            {modalView === 'approved' && (
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

                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
