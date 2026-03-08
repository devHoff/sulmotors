import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Eye, Users, Zap, Rocket, ArrowLeft, Loader2, QrCode, ExternalLink, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import type { Car } from '../data/mockCars';

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

// Slider geometry
const DOT_D   = 20;
const DOT_R   = DOT_D / 2;
const TRACK_H = 2;
const WRAP_H  = 28;

// Detect if using sandbox token (starts with TEST-)
const isSandbox = (token?: string) => !token || token.startsWith('TEST-') || token.startsWith('APP_USR-');

export default function Impulsionar() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();
    const { t, language } = useLanguage();
    const [car, setCar] = useState<Car | null>(null);
    const [loading, setLoading] = useState(true);
    const [paying, setPaying] = useState(false);
    const [selectedPeriod, setSelectedPeriod] = useState(2);

    // Payment modal state
    const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);
    const [showCheckoutModal, setShowCheckoutModal] = useState(false);

    const trackRef = useRef<HTMLDivElement>(null);
    const isDragging = useRef(false);
    const [dragging, setDragging] = useState(false);

    const labels = periodLabels[language] ?? periodLabels['pt-BR'];
    const fmt = (p: number) =>
        new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(p);

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

    // ── Slider helpers ──────────────────────────────────────────────────────────
    const xToSnap = useCallback((clientX: number) => {
        const track = trackRef.current;
        if (!track) return selectedPeriod;
        const rect = track.getBoundingClientRect();
        const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
        return Math.round(ratio * (periods.length - 1));
    }, [selectedPeriod]);

    const dotPct = (idx: number) =>
        periods.length <= 1 ? 0 : (idx / (periods.length - 1)) * 100;

    // ── Drag handlers ───────────────────────────────────────────────────────────
    const onPointerDown = useCallback((e: React.PointerEvent) => {
        e.preventDefault();
        e.stopPropagation();
        e.currentTarget.setPointerCapture(e.pointerId);
        isDragging.current = true;
        setDragging(true);
    }, []);

    const onPointerMove = useCallback((e: React.PointerEvent) => {
        if (!isDragging.current) return;
        setSelectedPeriod(xToSnap(e.clientX));
    }, [xToSnap]);

    const onPointerUp = useCallback((e: React.PointerEvent) => {
        if (!isDragging.current) return;
        isDragging.current = false;
        setDragging(false);
        setSelectedPeriod(xToSnap(e.clientX));
    }, [xToSnap]);

    // ── Payment flow ────────────────────────────────────────────────────────────
    const handlePay = async () => {
        if (!id || !user || !car) return;
        setPaying(true);

        try {
            const period = periods[selectedPeriod];
            const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
            const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

            // Get the user's JWT access token
            const { data: sessionData } = await supabase.auth.getSession();
            const accessToken = sessionData.session?.access_token ?? supabaseAnonKey;

            // Call our edge function
            const res = await fetch(`${supabaseUrl}/functions/v1/create-mp-preference`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': supabaseAnonKey,
                    'Authorization': `Bearer ${accessToken}`,
                },
                body: JSON.stringify({
                    anuncio_id: id,
                    periodo_key: period.key,
                    dias: period.days,
                    preco: period.price,
                    user_id: user.id,
                    user_email: user.email ?? '',
                    carro_desc: `${car.marca} ${car.modelo} ${car.ano}`,
                }),
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error ?? 'Erro ao gerar preferência de pagamento.');
            }

            if (!data.init_point && !data.sandbox_init_point) {
                throw new Error('URL de pagamento não retornada pelo servidor.');
            }

            // Prefer sandbox_init_point for TEST- tokens, otherwise use init_point
            const checkoutLink = data.sandbox_init_point ?? data.init_point;
            setCheckoutUrl(checkoutLink);
            setShowCheckoutModal(true);

        } catch (err: unknown) {
            console.error('handlePay error:', err);
            toast.error(err instanceof Error ? err.message : 'Erro ao iniciar pagamento.');
        } finally {
            setPaying(false);
        }
    };

    const openCheckout = () => {
        if (checkoutUrl) {
            window.open(checkoutUrl, '_blank', 'noopener,noreferrer');
        }
    };

    if (loading || !car) {
        return (
            <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
                <div className="w-12 h-12 rounded-full border-2 border-brand-400/20 border-t-brand-400 animate-spin" />
            </div>
        );
    }

    const period = periods[selectedPeriod];
    const periodLabel = labels[period.key];
    const railTop = WRAP_H / 2;

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

                    {/* ── Custom Snap Slider ── */}
                    <div className="mb-10" style={{ paddingLeft: DOT_R, paddingRight: DOT_R }}>
                        <div
                            ref={trackRef}
                            className="relative select-none cursor-pointer"
                            style={{ height: WRAP_H }}
                            onClick={(e) => { if (!isDragging.current) setSelectedPeriod(xToSnap(e.clientX)); }}
                        >
                            {/* Background rail */}
                            <div className="absolute left-0 right-0 rounded-full bg-zinc-700"
                                style={{ top: railTop - TRACK_H / 2, height: TRACK_H }} />

                            {/* Filled rail */}
                            <motion.div
                                className="absolute left-0 rounded-full bg-brand-400 origin-left"
                                style={{ top: railTop - TRACK_H / 2, height: TRACK_H }}
                                animate={{ width: `${dotPct(selectedPeriod)}%` }}
                                transition={{ type: 'spring', stiffness: 350, damping: 35 }}
                            />

                            {/* Tick marks */}
                            {periods.map((_, i) => (
                                <div key={i} className="absolute w-[2px] rounded-full transition-colors duration-200"
                                    style={{
                                        left: `${dotPct(i)}%`,
                                        top: railTop - 7,
                                        height: 14,
                                        transform: 'translateX(-50%)',
                                        background: i <= selectedPeriod ? 'rgb(0 212 255)' : 'rgb(82 82 91)',
                                    }}
                                />
                            ))}

                            {/* Animated dot */}
                            <motion.div
                                className="absolute rounded-full bg-brand-400 z-10 touch-none"
                                style={{
                                    width: DOT_D, height: DOT_D,
                                    top: railTop - DOT_R,
                                    boxShadow: dragging ? '0 0 18px rgba(0,212,255,0.9)' : '0 0 12px rgba(0,212,255,0.6)',
                                    cursor: dragging ? 'grabbing' : 'grab',
                                    transform: 'translateX(-50%)',
                                }}
                                animate={{ left: `${dotPct(selectedPeriod)}%` }}
                                transition={{ type: 'spring', stiffness: 350, damping: 35 }}
                                onPointerDown={onPointerDown}
                                onPointerMove={onPointerMove}
                                onPointerUp={onPointerUp}
                                onPointerCancel={onPointerUp}
                            />
                        </div>

                        {/* Labels */}
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

                    {/* PIX badge */}
                    <div className="flex items-center justify-center gap-2 mb-4">
                        <QrCode className="w-4 h-4 text-emerald-400" strokeWidth={1.5} />
                        <span className="text-xs text-emerald-400 font-bold">Pague com PIX — aprovação imediata</span>
                    </div>

                    {/* CTA Button */}
                    <button onClick={handlePay} disabled={paying}
                        className="w-full flex items-center justify-center gap-2.5 py-4 bg-brand-400 hover:bg-brand-300 text-zinc-950 font-black rounded-xl transition-all hover:shadow-glow active:scale-[0.98] disabled:opacity-60">
                        {paying
                            ? <><Loader2 className="w-5 h-5 animate-spin" strokeWidth={1.5} /> Gerando pagamento...</>
                            : <><Rocket className="w-5 h-5" strokeWidth={1.5} /> {t.imp_btn_boost} {fmt(period.price)}</>
                        }
                    </button>

                    {/* Security note */}
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

            {/* ── Checkout Modal ── */}
            <AnimatePresence>
                {showCheckoutModal && checkoutUrl && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[999] flex items-end sm:items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
                        onClick={(e) => { if (e.target === e.currentTarget) setShowCheckoutModal(false); }}
                    >
                        <motion.div
                            initial={{ opacity: 0, y: 60, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 60, scale: 0.95 }}
                            transition={{ type: 'spring', stiffness: 320, damping: 32 }}
                            className="w-full max-w-sm bg-zinc-900 border border-white/10 rounded-3xl overflow-hidden shadow-2xl"
                        >
                            {/* Header */}
                            <div className="p-6 border-b border-white/8 text-center">
                                <div className="w-14 h-14 bg-brand-400/10 border border-brand-400/30 rounded-2xl flex items-center justify-center mx-auto mb-4">
                                    <QrCode className="w-7 h-7 text-brand-400" strokeWidth={1.5} />
                                </div>
                                <h2 className="text-xl font-black text-white mb-1">Finalizar Pagamento</h2>
                                <p className="text-zinc-400 text-sm">Você será redirecionado para o Mercado Pago para concluir o pagamento com PIX ou outro método.</p>
                            </div>

                            {/* Summary */}
                            <div className="p-6 space-y-3">
                                <div className="flex items-center justify-between text-sm">
                                    <span className="text-zinc-400">Período</span>
                                    <span className="text-white font-bold">{periodLabel}</span>
                                </div>
                                <div className="flex items-center justify-between text-sm">
                                    <span className="text-zinc-400">Valor</span>
                                    <span className="text-brand-400 font-black text-lg">{fmt(period.price)}</span>
                                </div>
                                <div className="flex items-center justify-between text-sm">
                                    <span className="text-zinc-400">Anúncio</span>
                                    <span className="text-white font-bold text-right max-w-[60%]">{car.marca} {car.modelo} {car.ano}</span>
                                </div>

                                {/* PIX highlight */}
                                <div className="flex items-center gap-2.5 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl mt-2">
                                    <QrCode className="w-5 h-5 text-emerald-400 flex-shrink-0" strokeWidth={1.5} />
                                    <p className="text-emerald-300 text-xs font-medium">PIX disponível — aprovação em segundos, ativação imediata do boost.</p>
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="px-6 pb-6 space-y-3">
                                <button
                                    onClick={openCheckout}
                                    className="w-full flex items-center justify-center gap-2.5 py-4 bg-brand-400 hover:bg-brand-300 text-zinc-950 font-black rounded-xl transition-all hover:shadow-glow active:scale-[0.98]"
                                >
                                    <ExternalLink className="w-5 h-5" strokeWidth={1.5} />
                                    Ir para o Mercado Pago
                                </button>
                                <button
                                    onClick={() => setShowCheckoutModal(false)}
                                    className="w-full py-3 text-zinc-500 hover:text-zinc-300 text-sm font-medium transition-colors"
                                >
                                    Cancelar
                                </button>
                            </div>

                            {/* Security footer */}
                            <div className="px-6 pb-5 flex items-center justify-center gap-1.5">
                                <ShieldCheck className="w-3.5 h-3.5 text-zinc-600" strokeWidth={1.5} />
                                <p className="text-xs text-zinc-600">Ambiente seguro certificado pelo Mercado Pago</p>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
