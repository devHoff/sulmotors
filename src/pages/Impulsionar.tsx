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
    { key: '1_semana',   days: 7,   price: 19.90,  perDay: 2.84 },
    { key: '2_semanas',  days: 14,  price: 34.90,  perDay: 2.49 },
    { key: '1_mes',      days: 30,  price: 59.90,  perDay: 2.00, savings: 30 },
    { key: '3_meses',    days: 90,  price: 149.90, perDay: 1.67, savings: 40 },
    { key: '6_meses',    days: 180, price: 269.90, perDay: 1.50, savings: 47 },
    { key: '1_ano',      days: 365, price: 479.90, perDay: 1.32, savings: 53 },
];

const periodLabels: Record<string, Record<string, string>> = {
    'pt-BR': { '1_semana': '1 semana', '2_semanas': '2 semanas', '1_mes': '1 mês', '3_meses': '3 meses', '6_meses': '6 meses', '1_ano': '1 ano' },
    'en':    { '1_semana': '1 week',   '2_semanas': '2 weeks',   '1_mes': '1 month', '3_meses': '3 months', '6_meses': '6 months', '1_ano': '1 year' },
    'es':    { '1_semana': '1 semana', '2_semanas': '2 semanas', '1_mes': '1 mes',   '3_meses': '3 meses',  '6_meses': '6 meses',  '1_ano': '1 año' },
};

export default function Impulsionar() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();
    const { t, language } = useLanguage();
    const [car, setCar] = useState<Car | null>(null);
    const [loading, setLoading] = useState(true);
    const [boosting, setBoosting] = useState(false);
    const [selectedPeriod, setSelectedPeriod] = useState(2);
    // animated display index (follows selectedPeriod with spring)
    const [displayPeriod, setDisplayPeriod] = useState(2);

    const trackRef = useRef<HTMLDivElement>(null);
    const labels = periodLabels[language] ?? periodLabels['pt-BR'];

    const fmt = (p: number) =>
        new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(p);

    useEffect(() => {
        const fetchCar = async () => {
            if (!id) return;
            const { data, error } = await supabase
                .from('anuncios').select('*').eq('id', id).single();
            if (error || !data) {
                toast.error('Anúncio não encontrado.');
                navigate('/meus-anuncios');
                return;
            }
            if (data.user_id !== user?.id) {
                toast.error('Sem permissão.');
                navigate('/meus-anuncios');
                return;
            }
            setCar({ ...data, aceitaTroca: data.aceita_troca, modelo_3d: false, imagens: data.imagens || [] });
            setLoading(false);
        };
        fetchCar();
    }, [id, user, navigate]);

    // Smoothly transition the dot
    useEffect(() => {
        setDisplayPeriod(selectedPeriod);
    }, [selectedPeriod]);

    const handleBoost = async () => {
        if (!id || !user) return;
        setBoosting(true);
        const period = periods[selectedPeriod];
        const until = new Date();
        until.setDate(until.getDate() + period.days);
        const { error } = await supabase
            .from('anuncios')
            .update({ impulsionado: true, destaque: true, impulsionado_ate: until.toISOString(), prioridade: 5 })
            .eq('id', id)
            .eq('user_id', user.id);
        if (error) {
            toast.error('Erro ao impulsionar.');
        } else {
            toast.success(`Impulsionado por ${labels[period.key]}!`);
            navigate('/meus-anuncios');
        }
        setBoosting(false);
    };

    // Compute dot left % for a given index
    const dotLeft = useCallback((idx: number) => {
        if (periods.length <= 1) return 0;
        return (idx / (periods.length - 1)) * 100;
    }, []);

    if (loading || !car) {
        return (
            <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
                <div className="w-12 h-12 rounded-full border-2 border-brand-400/20 border-t-brand-400 animate-spin" />
            </div>
        );
    }

    const period = periods[selectedPeriod];
    const periodLabel = labels[period.key];

    return (
        <div className="bg-zinc-950 min-h-screen py-12">
            <div className="max-w-xl mx-auto px-4">

                {/* Header */}
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                    className="text-center mb-10">
                    <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-brand-400/10 border border-brand-400/30 rounded-full mb-4">
                        <Rocket className="w-3.5 h-3.5 text-brand-400" />
                        <span className="text-xs font-bold text-brand-400 uppercase tracking-widest">
                            {t.imp_badge}
                        </span>
                    </div>
                    <h1 className="text-3xl md:text-4xl font-black text-white mb-3 tracking-tight">
                        {t.imp_title}
                    </h1>
                    <p className="text-zinc-400 text-sm">
                        {t.imp_subtitle}{' '}
                        <span className="text-brand-400 font-bold">{t.imp_subtitle_accent}</span>
                        {' '}para todos os compradores
                    </p>
                </motion.div>

                {/* Car Preview */}
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="flex items-center gap-4 p-4 bg-zinc-900 border border-white/8 rounded-2xl mb-6">
                    {car.imagens[0] && (
                        <img src={car.imagens[0]} alt=""
                            className="w-20 h-14 object-cover rounded-xl flex-shrink-0" />
                    )}
                    <div>
                        <h3 className="text-white font-bold">{car.marca} {car.modelo} {car.ano}</h3>
                        <p className="text-brand-400 font-black text-lg">{fmt(car.preco)}</p>
                    </div>
                </motion.div>

                {/* Benefits */}
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.15 }}
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
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="bg-zinc-900 border border-white/8 rounded-2xl p-6 mb-6">
                    <h3 className="text-center font-black text-white text-lg mb-1">{t.imp_period_title}</h3>
                    <p className="text-center text-zinc-500 text-xs mb-8">{t.imp_period_sub}</p>

                    {/* ── Custom Snap Slider ── */}
                    <div className="relative mb-8 px-2" ref={trackRef}>
                        {/* Track line */}
                        <div className="relative h-[2px] bg-zinc-700 rounded-full mx-auto">

                            {/* Filled portion up to selected */}
                            <motion.div
                                className="absolute top-0 left-0 h-full bg-brand-400 rounded-full origin-left"
                                animate={{ width: `${dotLeft(displayPeriod)}%` }}
                                transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                            />

                            {/* Snap tick marks + invisible click zones */}
                            {periods.map((p, i) => (
                                <button
                                    key={i}
                                    onClick={() => setSelectedPeriod(i)}
                                    aria-label={labels[p.key]}
                                    style={{ left: `${dotLeft(i)}%` }}
                                    className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-8 h-8 flex items-center justify-center group"
                                >
                                    {/* Tick line */}
                                    <span
                                        className={`block w-[2px] h-3 rounded-full transition-colors duration-200
                                            ${i <= selectedPeriod ? 'bg-brand-400' : 'bg-zinc-600'}`}
                                    />
                                </button>
                            ))}

                            {/* Animated dot */}
                            <motion.div
                                className="absolute top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-brand-400 shadow-[0_0_10px_rgba(0,212,255,0.6)] pointer-events-none z-10"
                                animate={{ left: `${dotLeft(displayPeriod)}%` }}
                                transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                                style={{ translateX: '-50%' }}
                            />
                        </div>

                        {/* Labels row — perfectly aligned under each tick */}
                        <div className="relative mt-5">
                            {periods.map((p, i) => (
                                <button
                                    key={i}
                                    onClick={() => setSelectedPeriod(i)}
                                    style={{ left: `${dotLeft(i)}%` }}
                                    className={`absolute -translate-x-1/2 text-[11px] font-semibold whitespace-nowrap transition-colors duration-200 leading-tight
                                        ${selectedPeriod === i
                                            ? 'text-brand-400 font-bold'
                                            : 'text-zinc-500 hover:text-zinc-300'}`}
                                >
                                    {labels[p.key]}
                                </button>
                            ))}
                            {/* spacer so the container has height */}
                            <div className="h-5" />
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

                    <button
                        onClick={handleBoost}
                        disabled={boosting}
                        className="w-full flex items-center justify-center gap-2.5 py-4 bg-brand-400 hover:bg-brand-300 text-zinc-950 font-black rounded-xl transition-all hover:shadow-glow active:scale-[0.98] disabled:opacity-60"
                    >
                        {boosting
                            ? <Loader2 className="w-5 h-5 animate-spin" />
                            : <Rocket className="w-5 h-5" />}
                        {boosting ? t.imp_btn_boosting : `${t.imp_btn_boost} ${fmt(period.price)}`}
                    </button>
                    <p className="text-center text-xs text-zinc-600 mt-3">{t.imp_disclaimer}</p>
                </motion.div>

                <div className="text-center">
                    <Link to="/meus-anuncios"
                        className="inline-flex items-center gap-1.5 text-zinc-500 hover:text-white text-sm transition-colors">
                        <ArrowLeft className="w-4 h-4" />
                        {t.imp_back}
                    </Link>
                </div>
            </div>
        </div>
    );
}
