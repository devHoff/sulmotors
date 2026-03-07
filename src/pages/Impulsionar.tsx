import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Eye, Users, Zap, Rocket, ArrowLeft, Loader2 } from 'lucide-react';
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

// Slider geometry constants
const DOT_D   = 20;  // dot diameter px
const DOT_R   = DOT_D / 2;  // dot radius = 10 px
const TRACK_H = 2;   // rail height px
// Total wrapper height: enough room for dot + tick marks (14 px tall, centred on rail)
const WRAP_H  = 28;  // px — rail sits at WRAP_H/2 = 14 px from top

export default function Impulsionar() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();
    const { t, language } = useLanguage();
    const [car, setCar] = useState<Car | null>(null);
    const [loading, setLoading] = useState(true);
    const [boosting, setBoosting] = useState(false);
    const [selectedPeriod, setSelectedPeriod] = useState(2);

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

    // Convert a clientX to the nearest snap index
    const xToSnap = useCallback((clientX: number) => {
        const track = trackRef.current;
        if (!track) return selectedPeriod;
        const rect = track.getBoundingClientRect();
        const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
        return Math.round(ratio * (periods.length - 1));
    }, [selectedPeriod]);

    // Left % for a given index
    const dotPct = (idx: number) =>
        periods.length <= 1 ? 0 : (idx / (periods.length - 1)) * 100;

    const handleBoost = async () => {
        if (!id || !user) return;
        setBoosting(true);
        const period = periods[selectedPeriod];
        const until = new Date();
        until.setDate(until.getDate() + period.days);
        const { error } = await supabase
            .from('anuncios')
            .update({ impulsionado: true, destaque: true, impulsionado_ate: until.toISOString(), prioridade: 5 })
            .eq('id', id).eq('user_id', user.id);
        if (error) { toast.error('Erro ao impulsionar.'); }
        else { toast.success(`Impulsionado por ${labels[period.key]}!`); navigate('/meus-anuncios'); }
        setBoosting(false);
    };

    // ── Drag handlers ──────────────────────────────────────────────────────────
    // During drag: snap to nearest position in real-time (no free movement)
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

    if (loading || !car) {
        return (
            <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
                <div className="w-12 h-12 rounded-full border-2 border-brand-400/20 border-t-brand-400 animate-spin" />
            </div>
        );
    }

    const period = periods[selectedPeriod];
    const periodLabel = labels[period.key];

    // Rail mid-point in px from top of wrapper
    const railTop = WRAP_H / 2;

    return (
        <div className="bg-zinc-950 min-h-screen py-12">
            <div className="max-w-xl mx-auto px-4">

                {/* Header */}
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-10">
                    <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-brand-400/10 border border-brand-400/30 rounded-full mb-4">
                        <Rocket className="w-3.5 h-3.5 text-brand-400" />
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
                            <Icon className="w-6 h-6 text-brand-400 mx-auto mb-2" />
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

                    {/* ── Custom Snap Slider ────────────────────────────────────────────
                        Layout:
                          • Horizontal padding = DOT_R so dot never overflows on edges
                          • Wrapper height = WRAP_H (28 px); rail sits at railTop (14 px)
                          • Dot (20×20 px): top = railTop - DOT_R  → center == railTop ✓
                          • Tick marks (2×14 px): top = railTop - 7 → center == railTop ✓
                    ────────────────────────────────────────────────────────────────── */}
                    <div className="mb-10" style={{ paddingLeft: DOT_R, paddingRight: DOT_R }}>

                        {/* Clickable track reference div */}
                        <div
                            ref={trackRef}
                            className="relative select-none cursor-pointer"
                            style={{ height: WRAP_H }}
                            onClick={(e) => {
                                // Only handle click if not a drag event
                                if (!isDragging.current) setSelectedPeriod(xToSnap(e.clientX));
                            }}
                        >
                            {/* Background rail — centered at railTop */}
                            <div
                                className="absolute left-0 right-0 rounded-full bg-zinc-700"
                                style={{ top: railTop - TRACK_H / 2, height: TRACK_H }}
                            />

                            {/* Filled rail — animated width */}
                            <motion.div
                                className="absolute left-0 rounded-full bg-brand-400 origin-left"
                                style={{ top: railTop - TRACK_H / 2, height: TRACK_H }}
                                animate={{ width: `${dotPct(selectedPeriod)}%` }}
                                transition={{ type: 'spring', stiffness: 350, damping: 35 }}
                            />

                            {/* Snap tick marks — centered at railTop */}
                            {periods.map((_, i) => (
                                <div
                                    key={i}
                                    className="absolute w-[2px] rounded-full transition-colors duration-200"
                                    style={{
                                        left: `${dotPct(i)}%`,
                                        top: railTop - 7,      // 7 = half of 14px tick height
                                        height: 14,
                                        transform: 'translateX(-50%)',
                                        background: i <= selectedPeriod ? 'rgb(0 212 255)' : 'rgb(82 82 91)',
                                    }}
                                />
                            ))}

                            {/* Animated dot — center is at railTop */}
                            <motion.div
                                className="absolute rounded-full bg-brand-400 z-10 touch-none"
                                style={{
                                    width: DOT_D,
                                    height: DOT_D,
                                    top: railTop - DOT_R,     // center of dot == railTop ✓
                                    boxShadow: dragging
                                        ? '0 0 18px rgba(0,212,255,0.9)'
                                        : '0 0 12px rgba(0,212,255,0.6)',
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

                        {/* Labels row — each label centred under its tick */}
                        <div className="relative mt-3" style={{ height: 20 }}>
                            {periods.map((p, i) => (
                                <button
                                    key={i}
                                    onClick={() => setSelectedPeriod(i)}
                                    className={`absolute text-[11px] font-semibold whitespace-nowrap leading-tight transition-colors duration-200
                                        ${selectedPeriod === i ? 'text-brand-400 font-bold' : 'text-zinc-500 hover:text-zinc-300'}`}
                                    style={{ left: `${dotPct(i)}%`, transform: 'translateX(-50%)' }}
                                >
                                    {labels[p.key]}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Price Card */}
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={selectedPeriod}
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -8 }}
                            transition={{ duration: 0.18 }}
                            className="text-center p-6 bg-brand-400/8 border border-brand-400/20 rounded-xl mb-5"
                        >
                            <div className="flex items-center justify-center gap-1.5 text-brand-400 text-xs font-bold mb-2">
                                <Rocket className="w-3.5 h-3.5" />
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

                    <button onClick={handleBoost} disabled={boosting}
                        className="w-full flex items-center justify-center gap-2.5 py-4 bg-brand-400 hover:bg-brand-300 text-zinc-950 font-black rounded-xl transition-all hover:shadow-glow active:scale-[0.98] disabled:opacity-60">
                        {boosting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Rocket className="w-5 h-5" />}
                        {boosting ? t.imp_btn_boosting : `${t.imp_btn_boost} ${fmt(period.price)}`}
                    </button>
                    <p className="text-center text-xs text-zinc-600 mt-3">{t.imp_disclaimer}</p>
                </motion.div>

                <div className="text-center">
                    <Link to="/meus-anuncios" className="inline-flex items-center gap-1.5 text-zinc-500 hover:text-white text-sm transition-colors">
                        <ArrowLeft className="w-4 h-4" />
                        {t.imp_back}
                    </Link>
                </div>
            </div>
        </div>
    );
}
