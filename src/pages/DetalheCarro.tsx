import { useEffect, useState, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ChevronLeft, ChevronRight, ArrowLeft, Phone, MessageCircle,
    Calendar, Gauge, Fuel, Settings2, Palette, MapPin, ArrowLeftRight,
    Heart, Share2
} from 'lucide-react';
import { type Car } from '../data/mockCars';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';



export default function DetalheCarro() {
    const { id } = useParams();
    const { user } = useAuth();
    const { t } = useLanguage();
    const [car, setCar] = useState<Car | null>(null);
    const [loading, setLoading] = useState(true);
    const [imgIndex, setImgIndex] = useState(0);
    const [direction, setDirection] = useState(0); // -1 prev | 1 next
    const touchStartX = useRef<number | null>(null);
    const touchStartY = useRef<number | null>(null);
    const [liked, setLiked] = useState(false);
    const [likeCount, setLikeCount] = useState(0);

    useEffect(() => {
        async function fetchCar() {
            if (!id) return;
            try {
                const { data, error } = await supabase
                    .from('anuncios').select('*').eq('id', id).single();
                if (error) throw error;
                if (data) {
                    setCar({ ...data, aceitaTroca: data.aceita_troca, modelo_3d: data.modelo_3d, imagens: data.imagens || [] });
                    if (user) {
                        const { data: likeData } = await supabase
                            .from('curtidas').select('id').eq('anuncio_id', id).eq('user_id', user.id).maybeSingle();
                        setLiked(!!likeData);
                    }
                    const { count } = await supabase
                        .from('curtidas').select('*', { count: 'exact', head: true }).eq('anuncio_id', id);
                    setLikeCount(count ?? 0);
                }
            } catch (error) {
                console.error('Error fetching car:', error);
            } finally {
                setLoading(false);
            }
        }
        fetchCar();
    }, [id, user]);

    const toggleLike = async () => {
        if (!user || !car) return;
        if (liked) {
            await supabase.from('curtidas').delete().eq('anuncio_id', car.id).eq('user_id', user.id);
            setLiked(false);
            setLikeCount(c => Math.max(0, c - 1));
        } else {
            await supabase.from('curtidas').insert({ anuncio_id: car.id, user_id: user.id });
            setLiked(true);
            setLikeCount(c => c + 1);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 flex items-center justify-center">
                <div className="w-12 h-12 rounded-full border-2 border-brand-400/20 border-t-brand-400 animate-spin" />
            </div>
        );
    }

    if (!car) {
        return (
            <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 flex flex-col items-center justify-center">
                <p className="text-xl text-slate-500 dark:text-zinc-400 mb-4">{t.detail_not_found}</p>
                <Link to="/estoque" className="text-brand-500 dark:text-brand-400 font-bold hover:underline">{t.detail_back_inventory}</Link>
            </div>
        );
    }

    const formatPrice = (price: number) =>
        new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0 }).format(price);

    const formatKm = (km: number) =>
        km === 0 ? '0 km' : `${new Intl.NumberFormat('pt-BR').format(km)} km`;

    const prevImg = () => {
        setDirection(-1);
        setImgIndex((i) => (i === 0 ? car!.imagens.length - 1 : i - 1));
    };
    const nextImg = () => {
        setDirection(1);
        setImgIndex((i) => (i === car!.imagens.length - 1 ? 0 : i + 1));
    };
    const jumpImg = (i: number) => {
        setDirection(i > imgIndex ? 1 : -1);
        setImgIndex(i);
    };

    /* ── touch swipe handlers (mobile) ── */
    const handleTouchStart = (e: React.TouchEvent) => {
        touchStartX.current = e.touches[0].clientX;
        touchStartY.current = e.touches[0].clientY;
    };
    const handleTouchEnd = (e: React.TouchEvent) => {
        if (touchStartX.current === null || touchStartY.current === null) return;
        const dx = e.changedTouches[0].clientX - touchStartX.current;
        const dy = e.changedTouches[0].clientY - touchStartY.current;
        // only trigger if horizontal swipe is dominant and long enough
        if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.5) {
            dx < 0 ? nextImg() : prevImg();
        }
        touchStartX.current = null;
        touchStartY.current = null;
    };

    const specs = [
        { icon: Calendar, label: t.detail_year, value: String(car.ano) },
        { icon: Gauge, label: t.detail_km, value: formatKm(car.quilometragem) },
        { icon: Fuel, label: t.detail_fuel, value: car.combustivel },
        { icon: Settings2, label: t.detail_gearbox, value: car.cambio },
        { icon: Palette, label: t.detail_color, value: car.cor },
        { icon: MapPin, label: t.detail_city, value: car.cidade },
        { icon: ArrowLeftRight, label: t.detail_trade, value: car.aceitaTroca ? t.detail_trade_yes : t.detail_trade_no },
    ];

    /* ── slide variants ── */
    const slideVariants = {
        enter: (dir: number) => ({ x: dir > 0 ? '100%' : '-100%', opacity: 0 }),
        center: { x: '0%', opacity: 1 },
        exit:  (dir: number) => ({ x: dir > 0 ? '-100%' : '100%', opacity: 0 }),
    };

    const imgs = car.imagens.length > 0 ? car.imagens : ['https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?w=1400&q=80'];
    const total = imgs.length;
    const prevIdx = (imgIndex - 1 + total) % total;
    const nextIdx = (imgIndex + 1) % total;

    return (
        <div className="bg-slate-50 dark:bg-zinc-950 min-h-screen transition-colors duration-300">

            {/* ════════════════════════════════════════════════════════
                HERO  –  DESKTOP: 3-panel carousel on blurred bg
                        MOBILE:  simple full-bleed (unchanged)
            ════════════════════════════════════════════════════════ */}
            <div className="relative overflow-hidden" style={{ height: 'clamp(300px, 60vh, 680px)' }}>

                {/* ── Blurred background (both mobile & desktop, but only visible on desktop) ── */}
                <AnimatePresence initial={false}>
                    <motion.div
                        key={`bg-${imgIndex}`}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.55 }}
                        className="absolute inset-0"
                    >
                        <img
                            src={imgs[imgIndex]}
                            alt=""
                            aria-hidden
                            className="w-full h-full object-cover scale-110"
                            style={{ filter: 'blur(32px) saturate(1.1) brightness(0.35)' }}
                        />
                    </motion.div>
                </AnimatePresence>
                {/* dark vignette over blur */}
                <div className="absolute inset-0 bg-gradient-to-t from-zinc-950/90 via-zinc-950/10 to-zinc-950/60 pointer-events-none z-10" />
                <div className="absolute inset-0 bg-gradient-to-r from-zinc-950/70 via-transparent to-zinc-950/70 pointer-events-none z-10" />

                {/* ══ MOBILE: simple full-bleed sharp image (swipeable) ══ */}
                <div
                    className="md:hidden absolute inset-0 z-20"
                    onTouchStart={handleTouchStart}
                    onTouchEnd={handleTouchEnd}
                >
                    <AnimatePresence initial={false} custom={direction}>
                        <motion.img
                            key={`mob-${imgIndex}`}
                            custom={direction}
                            variants={slideVariants}
                            initial="enter"
                            animate="center"
                            exit="exit"
                            transition={{ duration: 0.38, ease: [0.32, 0.72, 0, 1] }}
                            src={imgs[imgIndex]}
                            alt={`${car.marca} ${car.modelo}`}
                            className="absolute inset-0 w-full h-full object-cover"
                        />
                    </AnimatePresence>
                    <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-transparent to-zinc-950/40" />
                </div>

                {/* ══ DESKTOP: 3-panel carousel ══ */}
                <div className="hidden md:flex absolute inset-0 z-20 items-center justify-center gap-4"
                     style={{ paddingLeft: '6vw', paddingRight: '6vw' }}>

                    {/* PREV peek */}
                    {total > 1 && (
                        <button
                            onClick={prevImg}
                            className="flex-shrink-0 relative cursor-pointer group"
                            style={{ width: '22%', aspectRatio: '4/3' }}
                            aria-label="Anterior"
                        >
                            <img
                                src={imgs[prevIdx]}
                                alt=""
                                className="w-full h-full object-cover rounded-xl transition-transform duration-300 group-hover:scale-[1.02]"
                                style={{ filter: 'brightness(0.55)' }}
                            />
                            {/* left arrow centred on peek */}
                            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                <div className="w-10 h-10 bg-black/60 backdrop-blur-sm rounded-full flex items-center justify-center border border-white/20">
                                    <ChevronLeft className="w-5 h-5 text-white" />
                                </div>
                            </div>
                        </button>
                    )}

                    {/* CENTER – current image */}
                    <div className="relative flex-shrink-0 overflow-hidden rounded-2xl z-10"
                         style={{
                             width: total > 1 ? '56%' : '72%',
                             aspectRatio: '16/9',
                             boxShadow: '0 0 0 1px rgba(255,255,255,0.07), 0 40px 100px rgba(0,0,0,0.8)',
                             marginLeft: 0,
                             marginRight: 0,
                         }}>
                        <AnimatePresence initial={false} custom={direction} mode="popLayout">
                            <motion.img
                                key={`desk-${imgIndex}`}
                                custom={direction}
                                variants={slideVariants}
                                initial="enter"
                                animate="center"
                                exit="exit"
                                transition={{ duration: 0.42, ease: [0.32, 0.72, 0, 1] }}
                                src={imgs[imgIndex]}
                                alt={`${car.marca} ${car.modelo}`}
                                className="absolute inset-0 w-full h-full object-cover"
                            />
                        </AnimatePresence>
                    </div>

                    {/* NEXT peek */}
                    {total > 1 && (
                        <button
                            onClick={nextImg}
                            className="flex-shrink-0 relative cursor-pointer group"
                            style={{ width: '22%', aspectRatio: '4/3' }}
                            aria-label="Próximo"
                        >
                            <img
                                src={imgs[nextIdx]}
                                alt=""
                                className="w-full h-full object-cover rounded-xl transition-transform duration-300 group-hover:scale-[1.02]"
                                style={{ filter: 'brightness(0.55)' }}
                            />
                            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                <div className="w-10 h-10 bg-black/60 backdrop-blur-sm rounded-full flex items-center justify-center border border-white/20">
                                    <ChevronRight className="w-5 h-5 text-white" />
                                </div>
                            </div>
                        </button>
                    )}
                </div>

                {/* ── Nav bar (top) – shared ── */}
                <div className="absolute top-0 left-0 right-0 flex items-center justify-between p-4 sm:p-5 z-30">
                    <Link
                        to="/estoque"
                        className="flex items-center gap-2 px-4 py-2 bg-black/50 backdrop-blur-sm border border-white/15 text-white text-sm font-bold rounded-xl hover:bg-black/70 transition-all"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        {t.detail_back}
                    </Link>
                    <div className="flex items-center gap-2">
                        <button
                            className="flex items-center gap-2 px-3 py-2 bg-black/50 backdrop-blur-sm border border-white/15 text-white/70 text-sm rounded-xl hover:text-white transition-all"
                            onClick={() => navigator.share?.({ title: `${car.marca} ${car.modelo}`, url: window.location.href })}
                        >
                            <Share2 className="w-4 h-4" />
                        </button>
                        {user && (
                            <button
                                onClick={toggleLike}
                                className={`flex items-center gap-2 px-4 py-2 backdrop-blur-sm border text-sm font-bold rounded-xl transition-all ${
                                    liked
                                        ? 'bg-red-500/20 border-red-500/40 text-red-400'
                                        : 'bg-black/50 border-white/15 text-white/70 hover:text-red-400'
                                }`}
                            >
                                <Heart className={`w-4 h-4 ${liked ? 'fill-red-400' : ''}`} />
                                {likeCount > 0 && likeCount}
                            </button>
                        )}
                    </div>
                </div>

                {/* ── Mobile prev/next arrows ── */}
                {total > 1 && (
                    <>
                        <button onClick={prevImg}
                            className="md:hidden absolute left-3 top-1/2 -translate-y-1/2 z-30 w-10 h-10 bg-black/50 backdrop-blur-sm rounded-full flex items-center justify-center text-white border border-white/10">
                            <ChevronLeft className="w-5 h-5" />
                        </button>
                        <button onClick={nextImg}
                            className="md:hidden absolute right-3 top-1/2 -translate-y-1/2 z-30 w-10 h-10 bg-black/50 backdrop-blur-sm rounded-full flex items-center justify-center text-white border border-white/10">
                            <ChevronRight className="w-5 h-5" />
                        </button>
                    </>
                )}

                {/* ── Image counter ── */}
                <div className="absolute bottom-14 right-5 z-30 px-3 py-1.5 bg-black/60 backdrop-blur-sm rounded-lg text-xs text-white/80 font-bold border border-white/10">
                    {imgIndex + 1} / {total}
                </div>

                {/* ── Dots ── */}
                <div className="absolute bottom-14 left-1/2 -translate-x-1/2 z-30 flex gap-1.5">
                    {imgs.map((_, i) => (
                        <button
                            key={i}
                            onClick={() => jumpImg(i)}
                            className={`transition-all duration-300 rounded-full ${i === imgIndex ? 'w-6 h-2 bg-brand-400' : 'w-2 h-2 bg-white/30 hover:bg-white/60'}`}
                        />
                    ))}
                </div>
            </div>

            {/* Thumbnails strip */}
            {car.imagens.length > 1 && (
                <div className="max-w-6xl mx-auto px-4 sm:px-6 mt-4 relative z-10">
                    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                        {car.imagens.map((url, i) => (
                            <button
                                key={i}
                                onClick={() => jumpImg(i)}
                                className={`flex-shrink-0 w-16 h-12 md:w-20 md:h-14 rounded-lg overflow-hidden border-2 transition-all ${
                                    i === imgIndex
                                        ? 'border-brand-400 opacity-100'
                                        : 'border-transparent opacity-50 hover:opacity-80'
                                }`}
                            >
                                <img src={url} alt="" className="w-full h-full object-cover" />
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Content */}
            <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
                <div className="grid grid-cols-1 lg:grid-cols-5 gap-10">
                    {/* Left - Details */}
                    <div className="lg:col-span-3">
                        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                            {/* Title & Price */}
                            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-8">
                                <div>
                                    <h1 className="text-3xl md:text-4xl font-black text-slate-900 dark:text-white tracking-tight mb-1">
                                        {car.marca} {car.modelo}
                                    </h1>
                                    <p className="text-slate-500 dark:text-zinc-500 text-sm">{car.ano} • {formatKm(car.quilometragem)}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-xs text-slate-400 dark:text-zinc-600 mb-1">{t.detail_price}</p>
                                    <p className="text-3xl md:text-4xl font-black text-brand-500 dark:text-brand-400 tracking-tight">
                                        {formatPrice(car.preco)}
                                    </p>
                                </div>
                            </div>

                            {/* Specs Grid */}
                            <div className="mb-8">
                                <h3 className="text-xs font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-widest mb-4">{t.detail_specs}</h3>
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                    {specs.map(({ icon: Icon, label, value }) => (
                                        <div
                                            key={label}
                                            className="flex items-center gap-3 p-4 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/5 rounded-xl hover:border-brand-400/20 transition-colors shadow-sm dark:shadow-none"
                                        >
                                            <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-white/5 flex items-center justify-center flex-shrink-0">
                                                <Icon className="w-4 h-4 text-brand-500 dark:text-brand-400" />
                                            </div>
                                            <div>
                                                <p className="text-xs text-slate-400 dark:text-zinc-600">{label}</p>
                                                <p className="text-sm font-bold text-slate-900 dark:text-white">{value}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Description */}
                            {car.descricao && (
                                <div className="p-6 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/5 rounded-2xl shadow-sm dark:shadow-none">
                                    <h3 className="text-xs font-bold text-slate-500 dark:text-zinc-500 uppercase tracking-widest mb-3">{t.detail_description}</h3>
                                    <p className="text-slate-600 dark:text-zinc-300 leading-relaxed text-sm">{car.descricao}</p>
                                </div>
                            )}
                        </motion.div>
                    </div>

                    {/* Right - Contact */}
                    <div className="lg:col-span-2">
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.1 }}
                            className="sticky top-24"
                        >
                            <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/8 rounded-2xl overflow-hidden shadow-sm dark:shadow-none">
                                {/* Header */}
                                <div className="p-6 border-b border-slate-100 dark:border-white/5">
                                    <div className="flex items-center gap-3 mb-4">
                                        <div className="w-12 h-12 bg-gradient-to-br from-brand-400 to-brand-600 rounded-xl flex items-center justify-center text-zinc-950 font-black text-lg">
                                            V
                                        </div>
                                        <div>
                                            <p className="font-bold text-slate-900 dark:text-white">{t.detail_seller}</p>
                                            <div className="flex items-center gap-1.5">
                                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                                                <p className="text-xs text-emerald-500 dark:text-emerald-400 font-medium">{t.detail_available}</p>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-zinc-400">
                                        <MapPin className="w-4 h-4" />
                                        {car.cidade}
                                    </div>
                                </div>

                                {/* Price summary */}
                                <div className="p-6 border-b border-slate-100 dark:border-white/5">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-slate-500 dark:text-zinc-500 text-sm">{t.detail_vehicle_value}</span>
                                        <span className="text-2xl font-black text-brand-500 dark:text-brand-400">{formatPrice(car.preco)}</span>
                                    </div>
                                    {car.aceitaTroca && (
                                        <div className="flex items-center gap-2 mt-3 px-3 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                                            <ArrowLeftRight className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
                                            <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">{t.detail_accepts_trade}</span>
                                        </div>
                                    )}
                                </div>

                                {/* CTA Buttons */}
                                <div className="p-6 space-y-3">
                                    <a
                                        href={`https://wa.me/55${car.telefone.replace(/\D/g, '')}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center justify-center gap-2.5 w-full py-4 bg-gradient-to-r from-emerald-600 to-emerald-500 text-white font-black rounded-xl hover:shadow-lg hover:shadow-emerald-500/20 transition-all"
                                    >
                                        <MessageCircle className="w-5 h-5" />
                                        {t.detail_whatsapp}
                                    </a>
                                    <a
                                        href={`tel:${car.telefone}`}
                                        className="flex items-center justify-center gap-2.5 w-full py-4 bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 border border-slate-200 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20 text-slate-700 dark:text-white font-bold rounded-xl transition-all"
                                    >
                                        <Phone className="w-5 h-5" />
                                        {car.telefone}
                                    </a>
                                </div>

                                {/* Safety note */}
                                <div className="px-6 pb-6">
                                    <p className="text-xs text-slate-400 dark:text-zinc-600 text-center">
                                        {t.detail_safety}
                                    </p>
                                </div>
                            </div>

                            {/* Share */}
                            <div className="mt-4 flex gap-3">
                                <Link
                                    to="/estoque"
                                    className="flex-1 flex items-center justify-center gap-2 py-3 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/8 text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white text-sm font-bold rounded-xl transition-all hover:border-slate-300 dark:hover:border-white/20 shadow-sm dark:shadow-none"
                                >
                                    <ArrowLeft className="w-4 h-4" />
                                    {t.detail_see_more}
                                </Link>
                            </div>
                        </motion.div>
                    </div>
                </div>
            </div>
        </div>
    );
}
