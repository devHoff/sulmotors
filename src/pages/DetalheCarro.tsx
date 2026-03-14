import { useEffect, useState, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ChevronLeft, ChevronRight, ArrowLeft, Mail,
    Calendar, Gauge, Fuel, Settings2, Palette, MapPin, ArrowLeftRight,
    Heart, Share2, ShieldAlert, Star, TrendingUp, Calculator,
    CheckCircle2, AlertTriangle, BadgeCheck, Tag, ChevronRight as LinkArrow
} from 'lucide-react';
import { type Car } from '../data/mockCars';
import { supabase, supabasePublic } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { trackView } from '../lib/viewTracker';
import { generateSeoMetadata, injectSeoTags } from '../lib/seoService';
import CarCard from '../components/CarCard';

// ── Internal contact helper ───────────────────────────────────────────────────
const WHATSAPP_NUMBER = '555192263188';
function contactLink(car: Car) {
    const priceStr = new Intl.NumberFormat('pt-BR', {
        style: 'currency', currency: 'BRL', minimumFractionDigits: 0
    }).format(car.preco);
    const msg = encodeURIComponent(`Olá! Tenho interesse no veículo anunciado na SulMotor:\n\n🚗 ${car.marca} ${car.modelo} ${car.ano}\n💰 ${priceStr}\n🔗 ${window.location.href}\n\nAguardo retorno!`);
    return `https://wa.me/${WHATSAPP_NUMBER}?text=${msg}`;
}

// ── Financing calculator ──────────────────────────────────────────────────────
function calcPMT(pv: number, monthlyRate: number, n: number) {
    if (monthlyRate === 0) return pv / n;
    return (pv * monthlyRate * Math.pow(1 + monthlyRate, n)) / (Math.pow(1 + monthlyRate, n) - 1);
}

// ── Star rating display ───────────────────────────────────────────────────────
function StarRating({ rating, max = 5 }: { rating: number; max?: number }) {
    return (
        <div className="flex items-center gap-0.5">
            {Array.from({ length: max }).map((_, i) => (
                <Star
                    key={i}
                    className={`w-3.5 h-3.5 ${i < Math.round(rating) ? 'text-amber-400 fill-amber-400' : 'text-slate-300 dark:text-zinc-600'}`}
                    strokeWidth={1.5}
                />
            ))}
        </div>
    );
}

export default function DetalheCarro() {
    const { id } = useParams();
    const { user } = useAuth();
    const { t } = useLanguage();
    const [car, setCar] = useState<Car | null>(null);
    const [loading, setLoading] = useState(true);
    const [imgIndex, setImgIndex] = useState(0);
    const [direction, setDirection] = useState(0);
    const touchStartX = useRef<number | null>(null);
    const touchStartY = useRef<number | null>(null);
    const [liked, setLiked] = useState(false);
    const [likeCount, setLikeCount] = useState(0);

    // Related cars
    const [relatedByBrand, setRelatedByBrand]   = useState<Car[]>([]);
    const [relatedByCity, setRelatedByCity]     = useState<Car[]>([]);

    // ── Financing modal ───────────────────────────────────────────────────────
    const [showFinancing, setShowFinancing] = useState(false);
    const [downPayment, setDownPayment] = useState('');
    const [months, setMonths] = useState(48);
    const [annualRate, setAnnualRate] = useState(1.49); // % a.m.

    // ── Seller rating (mock — derived from account age + interaction) ─────────
    const [sellerRating] = useState<number>(4.2);
    const [sellerReviews] = useState<number>(37);
    const [sellerVerified] = useState<boolean>(true);

    useEffect(() => {
        async function fetchCar() {
            if (!id) return;
            try {
                const { data, error } = await supabasePublic
                    .from('anuncios').select('*').eq('id', id).single();
                if (error) throw error;
                if (data) {
                    setCar({ ...data, aceitaTroca: data.aceita_troca, modelo_3d: data.modelo_3d, imagens: data.imagens || [] });
                    if (user) {
                        const { data: likeData } = await supabase
                            .from('curtidas').select('id').eq('anuncio_id', id).eq('user_id', user.id).maybeSingle();
                        setLiked(!!likeData);
                    }
                    const { count } = await supabasePublic
                        .from('curtidas').select('*', { count: 'exact', head: true }).eq('anuncio_id', id);
                    setLikeCount(count ?? 0);
                }
            } catch { } finally { setLoading(false); }
        }
        fetchCar();
    }, [id, user]);

    // ── View tracking + SEO injection (fire-and-forget, no UI impact) ─────────
    useEffect(() => {
        if (!car) return;

        // Track view (deduped by session + IP server-side)
        trackView({
            listingId: car.id,
            userId:    user?.id ?? null,
            referrer:  document.referrer || undefined,
        });

        // Inject SEO meta tags into <head>
        const seo     = generateSeoMetadata(car as any);
        const cleanup = injectSeoTags(seo);
        return cleanup;
    }, [car?.id]);
    // ── end SEO/tracking ──────────────────────────────────────────────────────

    // ── Related cars fetch ────────────────────────────────────────────────────
    useEffect(() => {
        if (!car) return;
        const fetchRelated = async () => {
            // By same brand (excluding current)
            const { data: brandData } = await supabasePublic
                .from('anuncios').select('*')
                .eq('marca', car.marca).neq('id', car.id)
                .order('prioridade', { ascending: false })
                .limit(4);
            if (brandData) {
                setRelatedByBrand(brandData.map((d: any): Car => ({
                    id: d.id, marca: d.marca, modelo: d.modelo, ano: Number(d.ano),
                    preco: Number(d.preco), quilometragem: d.quilometragem,
                    telefone: d.telefone, descricao: d.descricao || '',
                    combustivel: d.combustivel, cambio: d.cambio, cor: d.cor,
                    cidade: d.cidade, aceitaTroca: d.aceita_troca ?? false,
                    imagens: d.imagens || [], destaque: d.destaque ?? false,
                    impulsionado: d.impulsionado ?? false,
                    impulsionado_ate: d.impulsionado_ate || undefined,
                    prioridade: d.prioridade ?? 0, modelo_3d: false,
                    created_at: d.created_at, user_id: d.user_id, loja: d.loja,
                })));
            }

            // By same city
            const cityBase = car.cidade.split(',')[0].trim();
            const { data: cityData } = await supabasePublic
                .from('anuncios').select('*')
                .ilike('cidade', `%${cityBase}%`).neq('id', car.id)
                .order('prioridade', { ascending: false })
                .limit(4);
            if (cityData) {
                setRelatedByCity(cityData.map((d: any): Car => ({
                    id: d.id, marca: d.marca, modelo: d.modelo, ano: Number(d.ano),
                    preco: Number(d.preco), quilometragem: d.quilometragem,
                    telefone: d.telefone, descricao: d.descricao || '',
                    combustivel: d.combustivel, cambio: d.cambio, cor: d.cor,
                    cidade: d.cidade, aceitaTroca: d.aceita_troca ?? false,
                    imagens: d.imagens || [], destaque: d.destaque ?? false,
                    impulsionado: d.impulsionado ?? false,
                    impulsionado_ate: d.impulsionado_ate || undefined,
                    prioridade: d.prioridade ?? 0, modelo_3d: false,
                    created_at: d.created_at, user_id: d.user_id, loja: d.loja,
                })));
            }
        };
        fetchRelated();
    }, [car?.id]);
    // ── end related cars ──────────────────────────────────────────────────────

    const toggleLike = async () => {
        if (!user || !car) return;
        if (liked) {
            await supabase.from('curtidas').delete().eq('anuncio_id', car.id).eq('user_id', user.id);
            setLiked(false); setLikeCount(c => Math.max(0, c - 1));
        } else {
            await supabase.from('curtidas').insert({ anuncio_id: car.id, user_id: user.id });
            setLiked(true); setLikeCount(c => c + 1);
        }
    };

    if (loading) return (
        <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 flex items-center justify-center">
            <div className="w-12 h-12 rounded-full border-2 border-brand-400/20 border-t-brand-400 animate-spin" />
        </div>
    );

    if (!car) return (
        <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 flex flex-col items-center justify-center">
            <p className="text-xl text-slate-500 dark:text-zinc-400 mb-4">{t('detail_not_found')}</p>
            <Link to="/estoque" className="text-brand-500 dark:text-brand-400 font-bold hover:underline">{t('detail_back_inventory')}</Link>
        </div>
    );

    const formatPrice = (price: number) =>
        new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0 }).format(price);

    const formatKm = (km: number) =>
        km === 0 ? '0 km' : `${new Intl.NumberFormat('pt-BR').format(km)} km`;

    const prevImg = () => { setDirection(-1); setImgIndex(i => (i === 0 ? car!.imagens.length - 1 : i - 1)); };
    const nextImg = () => { setDirection(1);  setImgIndex(i => (i === car!.imagens.length - 1 ? 0 : i + 1)); };
    const jumpImg = (i: number) => { setDirection(i > imgIndex ? 1 : -1); setImgIndex(i); };

    const handleTouchStart = (e: React.TouchEvent) => {
        touchStartX.current = e.touches[0].clientX;
        touchStartY.current = e.touches[0].clientY;
    };
    const handleTouchEnd = (e: React.TouchEvent) => {
        if (touchStartX.current === null || touchStartY.current === null) return;
        const dx = e.changedTouches[0].clientX - touchStartX.current;
        const dy = e.changedTouches[0].clientY - touchStartY.current;
        if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.5) dx < 0 ? nextImg() : prevImg();
        touchStartX.current = null; touchStartY.current = null;
    };

    const specs = [
        { icon: Calendar, label: t('detail_year'), value: String(car.ano) },
        { icon: Gauge,    label: t('detail_km'),   value: formatKm(car.quilometragem) },
        { icon: Fuel,     label: t('detail_fuel'),  value: car.combustivel },
        { icon: Settings2,label: t('detail_gearbox'), value: car.cambio },
        { icon: Palette,  label: t('detail_color'), value: car.cor },
        { icon: MapPin,   label: t('detail_city'),  value: car.cidade },
        { icon: ArrowLeftRight, label: t('detail_trade'), value: car.aceitaTroca ? t('detail_trade_yes') : t('detail_trade_no') },
    ];

    const slideVariants = {
        enter: (dir: number) => ({ x: dir > 0 ? '100%' : '-100%', opacity: 0 }),
        center: { x: '0%', opacity: 1 },
        exit:  (dir: number) => ({ x: dir > 0 ? '-100%' : '100%', opacity: 0 }),
    };

    // ── Financing calculator derived values ──────────────────────────────────
    const financed = Math.max(0, car.preco - (parseFloat(downPayment) || 0));
    const monthly  = financed > 0 ? calcPMT(financed, annualRate / 100, months) : 0;
    const total    = monthly * months;

    const imgs  = car.imagens.length > 0 ? car.imagens : ['https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?w=1400&q=80'];
    const total_ = imgs.length;
    const prevIdx = (imgIndex - 1 + total_) % total_;
    const nextIdx = (imgIndex + 1) % total_;

    return (
        <div className="bg-slate-50 dark:bg-zinc-950 min-h-screen transition-colors duration-300">

            {/* ── Hero / Carousel ──────────────────────────────────────────────── */}
            <div className="relative overflow-hidden" style={{ height: 'clamp(300px, 60vh, 680px)' }}>
                <AnimatePresence initial={false}>
                    <motion.div key={`bg-${imgIndex}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.55 }} className="absolute inset-0">
                        <img src={imgs[imgIndex]} alt="" aria-hidden className="w-full h-full object-cover scale-110" style={{ filter: 'blur(32px) saturate(1.1) brightness(0.35)' }} />
                    </motion.div>
                </AnimatePresence>
                <div className="absolute inset-0 bg-gradient-to-t from-zinc-950/90 via-zinc-950/10 to-zinc-950/60 pointer-events-none z-10" />
                <div className="absolute inset-0 bg-gradient-to-r from-zinc-950/70 via-transparent to-zinc-950/70 pointer-events-none z-10" />

                {/* Mobile: full-bleed swipeable */}
                <div className="md:hidden absolute inset-0 z-20" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
                    <AnimatePresence initial={false} custom={direction}>
                        <motion.img key={`mob-${imgIndex}`} custom={direction} variants={slideVariants} initial="enter" animate="center" exit="exit"
                            transition={{ duration: 0.38, ease: [0.32, 0.72, 0, 1] }} src={imgs[imgIndex]}
                            alt={`${car.marca} ${car.modelo} ${car.ano} – foto ${imgIndex + 1}`}
                            loading="lazy"
                            className="absolute inset-0 w-full h-full object-cover" />
                    </AnimatePresence>
                    <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-transparent to-zinc-950/40" />
                </div>

                {/* Desktop: 3-panel carousel */}
                <div className="hidden md:flex absolute inset-0 z-20 items-center justify-center gap-4" style={{ paddingLeft: '6vw', paddingRight: '6vw' }}>
                    {total_ > 1 && (
                        <button onClick={prevImg} className="flex-shrink-0 relative cursor-pointer group" style={{ width: '22%', aspectRatio: '4/3' }} aria-label="Anterior">
                            <img src={imgs[prevIdx]} alt="" className="w-full h-full object-cover rounded-xl transition-transform duration-300 group-hover:scale-[1.02]" style={{ filter: 'brightness(0.55)' }} />
                            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                <div className="w-10 h-10 bg-black/60 backdrop-blur-sm rounded-full flex items-center justify-center border border-white/20">
                                    <ChevronLeft className="w-5 h-5 text-white" strokeWidth={1.5} />
                                </div>
                            </div>
                        </button>
                    )}
                    <div className="relative flex-shrink-0 overflow-hidden rounded-2xl z-10"
                         style={{ width: total_ > 1 ? '56%' : '72%', aspectRatio: '16/9', boxShadow: '0 0 0 1px rgba(255,255,255,0.07), 0 40px 100px rgba(0,0,0,0.8)' }}>
                        <AnimatePresence initial={false} custom={direction} mode="popLayout">
                            <motion.img key={`desk-${imgIndex}`} custom={direction} variants={slideVariants} initial="enter" animate="center" exit="exit"
                                transition={{ duration: 0.42, ease: [0.32, 0.72, 0, 1] }} src={imgs[imgIndex]}
                                alt={`${car.marca} ${car.modelo} ${car.ano} em ${car.cidade} – foto ${imgIndex + 1}`}
                                loading="lazy"
                                className="absolute inset-0 w-full h-full object-cover" />
                        </AnimatePresence>
                    </div>
                    {total_ > 1 && (
                        <button onClick={nextImg} className="flex-shrink-0 relative cursor-pointer group" style={{ width: '22%', aspectRatio: '4/3' }} aria-label="Próximo">
                            <img src={imgs[nextIdx]} alt="" className="w-full h-full object-cover rounded-xl transition-transform duration-300 group-hover:scale-[1.02]" style={{ filter: 'brightness(0.55)' }} />
                            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                <div className="w-10 h-10 bg-black/60 backdrop-blur-sm rounded-full flex items-center justify-center border border-white/20">
                                    <ChevronRight className="w-5 h-5 text-white" strokeWidth={1.5} />
                                </div>
                            </div>
                        </button>
                    )}
                </div>

                {/* Nav bar (top) */}
                <div className="absolute top-0 left-0 right-0 flex items-center justify-between p-4 sm:p-5 z-30">
                    <Link to="/estoque" className="flex items-center gap-2 px-4 py-2 bg-black/50 backdrop-blur-sm border border-white/15 text-white text-sm font-bold rounded-xl hover:bg-black/70 transition-all">
                        <ArrowLeft className="w-4 h-4" strokeWidth={1.5} /> {t('detail_back')}
                    </Link>
                    <div className="flex items-center gap-2">
                        <button className="flex items-center gap-2 px-3 py-2 bg-black/50 backdrop-blur-sm border border-white/15 text-white/70 text-sm rounded-xl hover:text-white transition-all"
                            onClick={() => navigator.share?.({ title: `${car.marca} ${car.modelo}`, url: window.location.href })}>
                            <Share2 className="w-4 h-4" strokeWidth={1.5} />
                        </button>
                        {user && (
                            <button onClick={toggleLike}
                                className={`flex items-center gap-2 px-4 py-2 backdrop-blur-sm border text-sm font-bold rounded-xl transition-all ${liked ? 'bg-red-500/20 border-red-500/40 text-red-400' : 'bg-black/50 border-white/15 text-white/70 hover:text-red-400'}`}>
                                <Heart className={`w-4 h-4 ${liked ? 'fill-red-400' : ''}`} strokeWidth={1.5} />
                                {likeCount > 0 && likeCount}
                            </button>
                        )}
                    </div>
                </div>

                {/* Mobile arrows */}
                {total_ > 1 && <>
                    <button onClick={prevImg} className="md:hidden absolute left-3 top-1/2 -translate-y-1/2 z-30 w-10 h-10 bg-black/50 backdrop-blur-sm rounded-full flex items-center justify-center text-white border border-white/10">
                        <ChevronLeft className="w-5 h-5" strokeWidth={1.5} />
                    </button>
                    <button onClick={nextImg} className="md:hidden absolute right-3 top-1/2 -translate-y-1/2 z-30 w-10 h-10 bg-black/50 backdrop-blur-sm rounded-full flex items-center justify-center text-white border border-white/10">
                        <ChevronRight className="w-5 h-5" strokeWidth={1.5} />
                    </button>
                </>}

                <div className="absolute bottom-14 right-5 z-30 px-3 py-1.5 bg-black/60 backdrop-blur-sm rounded-lg text-xs text-white/80 font-bold border border-white/10">
                    {imgIndex + 1} / {total_}
                </div>
                <div className="absolute bottom-14 left-1/2 -translate-x-1/2 z-30 flex gap-1.5">
                    {imgs.map((_, i) => (
                        <button key={i} onClick={() => jumpImg(i)}
                            className={`transition-all duration-300 rounded-full ${i === imgIndex ? 'w-6 h-2 bg-brand-400' : 'w-2 h-2 bg-white/30 hover:bg-white/60'}`} />
                    ))}
                </div>
            </div>

            {/* Thumbnails */}
            {car.imagens.length > 1 && (
                <div className="max-w-6xl mx-auto px-4 sm:px-6 mt-4 relative z-10">
                    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                        {car.imagens.map((url, i) => (
                            <button key={i} onClick={() => jumpImg(i)}
                                className={`flex-shrink-0 w-16 h-12 md:w-20 md:h-14 rounded-lg overflow-hidden border-2 transition-all ${i === imgIndex ? 'border-brand-400 opacity-100' : 'border-transparent opacity-50 hover:opacity-80'}`}>
                                <img src={url} alt="" className="w-full h-full object-cover" />
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* ── Anti-scam warning banner ─────────────────────────────────────── */}
            <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 mt-6">
                <div className="flex items-start gap-3 p-4 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/25 rounded-xl">
                    <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" strokeWidth={1.5} />
                    <div>
                        <p className="text-sm font-bold text-amber-700 dark:text-amber-400">Aviso de segurança</p>
                        <p className="text-xs text-amber-600 dark:text-amber-400/80 mt-0.5 leading-relaxed">
                            <strong>Nunca realize pagamentos antecipados.</strong> O SulMotor não intermedeia pagamentos entre compradores e vendedores.
                            Desconfie de preços muito abaixo do mercado. Sempre veja o veículo pessoalmente antes de negociar.
                        </p>
                    </div>
                </div>
            </div>

            {/* ── Main content ─────────────────────────────────────────────────── */}
            <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="grid grid-cols-1 lg:grid-cols-5 gap-10">

                    {/* ── Left: Details ──────────────────────────────────────── */}
                    <div className="lg:col-span-3 space-y-8">
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
                                    <p className="text-xs text-slate-400 dark:text-zinc-600 mb-1">{t('detail_price')}</p>
                                    <p className="text-3xl md:text-4xl font-black text-brand-500 dark:text-brand-400 tracking-tight">
                                        {formatPrice(car.preco)}
                                    </p>
                                </div>
                            </div>

                            {/* Specs Grid */}
                            <div className="mb-8">
                                <h3 className="text-xs font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-widest mb-4">{t('detail_specs')}</h3>
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                    {specs.map(({ icon: Icon, label, value }) => (
                                        <div key={label} className="flex items-center gap-3 p-4 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/5 rounded-xl hover:border-brand-400/20 transition-colors shadow-sm dark:shadow-none">
                                            <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-white/5 flex items-center justify-center flex-shrink-0">
                                                <Icon className="w-4 h-4 text-brand-500 dark:text-brand-400" strokeWidth={1.5} />
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
                                    <h3 className="text-xs font-bold text-slate-500 dark:text-zinc-500 uppercase tracking-widest mb-3">{t('detail_description')}</h3>
                                    <p className="text-slate-600 dark:text-zinc-300 leading-relaxed text-sm">{car.descricao}</p>
                                </div>
                            )}
                        </motion.div>

                        {/* ── Financing Simulator ───────────────────────────── */}
                        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
                            <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/8 rounded-2xl overflow-hidden shadow-sm dark:shadow-none">
                                <button
                                    onClick={() => setShowFinancing(v => !v)}
                                    className="w-full flex items-center justify-between p-6 hover:bg-slate-50 dark:hover:bg-white/3 transition-colors">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 bg-brand-400/15 rounded-xl flex items-center justify-center">
                                            <Calculator className="w-5 h-5 text-brand-500 dark:text-brand-400" strokeWidth={1.5} />
                                        </div>
                                        <div className="text-left">
                                            <p className="font-bold text-slate-900 dark:text-white">Simular Financiamento</p>
                                            <p className="text-xs text-slate-500 dark:text-zinc-500">Calcule parcelas e condições</p>
                                        </div>
                                    </div>
                                    <ChevronLeft className={`w-5 h-5 text-slate-400 transition-transform ${showFinancing ? '-rotate-90' : 'rotate-180'}`} strokeWidth={1.5} />
                                </button>

                                <AnimatePresence>
                                    {showFinancing && (
                                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.22 }} className="overflow-hidden">
                                            <div className="px-6 pb-6 border-t border-slate-100 dark:border-white/5 space-y-5 pt-5">
                                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                                    <div>
                                                        <label className="block text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider mb-2">Entrada (R$)</label>
                                                        <input type="number" min="0" max={car.preco} value={downPayment}
                                                            onChange={e => setDownPayment(e.target.value)}
                                                            placeholder="0"
                                                            className="w-full px-3 py-2.5 bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-white/10 focus:border-brand-400/60 rounded-xl text-sm text-slate-900 dark:text-white outline-none transition-all" />
                                                    </div>
                                                    <div>
                                                        <label className="block text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider mb-2">Parcelas</label>
                                                        <select value={months} onChange={e => setMonths(Number(e.target.value))}
                                                            className="w-full px-3 py-2.5 bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-white/10 focus:border-brand-400/60 rounded-xl text-sm text-slate-900 dark:text-white outline-none transition-all appearance-none cursor-pointer">
                                                            {[12, 24, 36, 48, 60, 72].map(m => (
                                                                <option key={m} value={m}>{m}x</option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                    <div>
                                                        <label className="block text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider mb-2">Taxa a.m. (%)</label>
                                                        <input type="number" step="0.01" min="0.5" max="5" value={annualRate}
                                                            onChange={e => setAnnualRate(parseFloat(e.target.value) || 1.49)}
                                                            className="w-full px-3 py-2.5 bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-white/10 focus:border-brand-400/60 rounded-xl text-sm text-slate-900 dark:text-white outline-none transition-all" />
                                                    </div>
                                                </div>

                                                {monthly > 0 && (
                                                    <div className="grid grid-cols-3 gap-3">
                                                        <div className="p-4 bg-brand-400/8 border border-brand-400/20 rounded-xl text-center">
                                                            <p className="text-xs text-slate-500 dark:text-zinc-500 mb-1">Parcela</p>
                                                            <p className="text-lg font-black text-brand-500 dark:text-brand-400">
                                                                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0 }).format(monthly)}
                                                            </p>
                                                        </div>
                                                        <div className="p-4 bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-white/10 rounded-xl text-center">
                                                            <p className="text-xs text-slate-500 dark:text-zinc-500 mb-1">Financiado</p>
                                                            <p className="text-sm font-bold text-slate-900 dark:text-white">
                                                                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0 }).format(financed)}
                                                            </p>
                                                        </div>
                                                        <div className="p-4 bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-white/10 rounded-xl text-center">
                                                            <p className="text-xs text-slate-500 dark:text-zinc-500 mb-1">Total</p>
                                                            <p className="text-sm font-bold text-slate-900 dark:text-white">
                                                                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0 }).format(total)}
                                                            </p>
                                                        </div>
                                                    </div>
                                                )}

                                                <p className="text-xs text-slate-400 dark:text-zinc-600 italic">
                                                    * Simulação meramente indicativa. Condições reais de crédito podem variar conforme análise do banco.
                                                </p>

                                                <a href={contactLink(car)}
                                                    className="flex items-center justify-center gap-2 w-full py-3 bg-brand-500 hover:bg-brand-400 text-zinc-950 font-bold rounded-xl transition-all text-sm">
                                                    <Mail className="w-4 h-4" strokeWidth={1.5} />
                                                    Quero financiar — Falar com consultor
                                                </a>
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        </motion.div>

                        {/* ── Legal disclaimer ─────────────────────────────── */}
                        <div className="p-5 bg-slate-100 dark:bg-zinc-900/50 border border-slate-200 dark:border-white/5 rounded-2xl">
                            <div className="flex items-start gap-3">
                                <ShieldAlert className="w-5 h-5 text-slate-400 dark:text-zinc-500 flex-shrink-0 mt-0.5" strokeWidth={1.5} />
                                <div className="space-y-1.5">
                                    <p className="text-xs font-bold text-slate-600 dark:text-zinc-400 uppercase tracking-wider">Aviso legal</p>
                                    <p className="text-xs text-slate-500 dark:text-zinc-500 leading-relaxed">
                                        {t('detail_platform_notice')}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* ── Right: Contact card ──────────────────────────────── */}
                    <div className="lg:col-span-2">
                        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="sticky top-24 space-y-4">

                            {/* Contact card */}
                            <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/8 rounded-2xl overflow-hidden shadow-sm dark:shadow-none">
                                {/* Seller header */}
                                <div className="p-6 border-b border-slate-100 dark:border-white/5">
                                    <div className="flex items-center gap-3 mb-3">
                                        <div className="w-12 h-12 bg-gradient-to-br from-brand-400 to-brand-600 rounded-xl flex items-center justify-center text-zinc-950 font-black text-lg">
                                            {(car.marca || 'V').charAt(0)}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                <p className="font-bold text-slate-900 dark:text-white">{t('detail_seller')}</p>
                                                {sellerVerified && (
                                                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-emerald-500/15 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs font-bold rounded-md">
                                                        <BadgeCheck className="w-3 h-3" strokeWidth={1.5} /> Verificado
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-2 mt-1">
                                                <StarRating rating={sellerRating} />
                                                <span className="text-xs text-slate-500 dark:text-zinc-500">{sellerRating.toFixed(1)} ({sellerReviews})</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                                        <p className="text-xs text-emerald-500 dark:text-emerald-400 font-medium">{t('detail_available')}</p>
                                        <span className="text-slate-300 dark:text-zinc-700">·</span>
                                        <MapPin className="w-3.5 h-3.5 text-slate-400" strokeWidth={1.5} />
                                        <span className="text-xs text-slate-500 dark:text-zinc-500">{car.cidade}</span>
                                    </div>
                                </div>

                                {/* Price */}
                                <div className="p-6 border-b border-slate-100 dark:border-white/5">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-slate-500 dark:text-zinc-500 text-sm">{t('detail_vehicle_value')}</span>
                                        <span className="text-2xl font-black text-brand-500 dark:text-brand-400">{formatPrice(car.preco)}</span>
                                    </div>
                                    {car.aceitaTroca && (
                                        <div className="flex items-center gap-2 mt-3 px-3 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                                            <ArrowLeftRight className="w-4 h-4 text-emerald-500 dark:text-emerald-400" strokeWidth={1.5} />
                                            <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">{t('detail_accepts_trade')}</span>
                                        </div>
                                    )}
                                </div>

                                {/* CTAs — ALL via centralised WhatsApp */}
                                <div className="p-6 space-y-3">
                                    <a href={contactLink(car)}
                                        className="flex items-center justify-center gap-2.5 w-full py-4 bg-gradient-to-r from-brand-500 to-brand-400 text-zinc-950 font-black rounded-xl hover:shadow-lg hover:shadow-brand-400/20 transition-all">
                                        <Mail className="w-5 h-5" strokeWidth={1.5} />
                                        {t('detail_contact_label')}
                                    </a>
                                    <button
                                        onClick={() => setShowFinancing(true)}
                                        className="flex items-center justify-center gap-2.5 w-full py-3.5 bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-white font-bold rounded-xl transition-all text-sm">
                                        <TrendingUp className="w-4 h-4 text-brand-500 dark:text-brand-400" strokeWidth={1.5} />
                                        Simular Financiamento
                                    </button>
                                </div>

                                {/* Safety note */}
                                <div className="px-6 pb-6 space-y-2">
                                    <div className="flex items-start gap-2">
                                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0 mt-0.5" strokeWidth={1.5} />
                                        <p className="text-xs text-slate-400 dark:text-zinc-600">Nunca pague antecipado sem ver o veículo.</p>
                                    </div>
                                    <div className="flex items-start gap-2">
                                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0 mt-0.5" strokeWidth={1.5} />
                                        <p className="text-xs text-slate-400 dark:text-zinc-600">SulMotor não intermedeia pagamentos.</p>
                                    </div>
                                </div>
                            </div>

                            {/* Back button */}
                            <Link to="/estoque"
                                className="flex items-center justify-center gap-2 w-full py-3 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/8 text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white text-sm font-bold rounded-xl transition-all hover:border-slate-300 dark:hover:border-white/20 shadow-sm dark:shadow-none">
                                <ArrowLeft className="w-4 h-4" strokeWidth={1.5} />
                                {t('detail_see_more')}
                            </Link>
                        </motion.div>
                    </div>
                </div>
            </div>

            {/* ── Internal linking: Related cars ───────────────────────────── */}
            {(relatedByBrand.length > 0 || relatedByCity.length > 0) && (
                <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pb-12 space-y-10">

                    {/* Other cars of same brand */}
                    {relatedByBrand.length > 0 && (
                        <section>
                            <div className="flex items-center justify-between mb-6">
                                <div className="flex items-center gap-2">
                                    <Tag className="w-4 h-4 text-brand-500 dark:text-brand-400" strokeWidth={1.5} />
                                    <h2 className="text-lg font-black text-slate-900 dark:text-white">
                                        Outros {car.marca} disponíveis
                                    </h2>
                                </div>
                                <Link to={`/carros/${car.marca.toLowerCase().replace(/\s+/g, '-').normalize('NFD').replace(/[\u0300-\u036f]/g, '')}`}
                                    className="flex items-center gap-1 text-sm font-bold text-brand-500 dark:text-brand-400 hover:underline">
                                    Ver todos <LinkArrow className="w-3.5 h-3.5" strokeWidth={1.5} />
                                </Link>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                {relatedByBrand.map((c, i) => (
                                    <motion.div key={c.id} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}>
                                        <CarCard car={c} />
                                    </motion.div>
                                ))}
                            </div>
                        </section>
                    )}

                    {/* Other cars in same city */}
                    {relatedByCity.length > 0 && (
                        <section>
                            <div className="flex items-center justify-between mb-6">
                                <div className="flex items-center gap-2">
                                    <MapPin className="w-4 h-4 text-brand-500 dark:text-brand-400" strokeWidth={1.5} />
                                    <h2 className="text-lg font-black text-slate-900 dark:text-white">
                                        Outros carros em {car.cidade.split(',')[0].trim()}
                                    </h2>
                                </div>
                                <Link to={`/carros-usados/${car.cidade.split(',')[0].trim().toLowerCase().replace(/\s+/g, '-').normalize('NFD').replace(/[\u0300-\u036f]/g, '')}`}
                                    className="flex items-center gap-1 text-sm font-bold text-brand-500 dark:text-brand-400 hover:underline">
                                    Ver todos <LinkArrow className="w-3.5 h-3.5" strokeWidth={1.5} />
                                </Link>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                {relatedByCity.map((c, i) => (
                                    <motion.div key={c.id} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}>
                                        <CarCard car={c} />
                                    </motion.div>
                                ))}
                            </div>
                        </section>
                    )}

                    {/* Quick navigation by price range */}
                    <div className="pt-2 border-t border-slate-200 dark:border-white/5">
                        <p className="text-xs font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-widest mb-3">
                            Buscar por faixa de preço
                        </p>
                        <div className="flex flex-wrap gap-2">
                            {[
                                { label: 'Até R$ 20 mil', slug: 'carros-ate-20-mil' },
                                { label: 'Até R$ 30 mil', slug: 'carros-ate-30-mil' },
                                { label: 'Até R$ 50 mil', slug: 'carros-ate-50-mil' },
                                { label: 'Até R$ 80 mil', slug: 'carros-ate-80-mil' },
                                { label: 'Até R$ 100 mil', slug: 'carros-ate-100-mil' },
                            ].map(({ label, slug }) => (
                                <Link key={slug} to={`/${slug}`}
                                    className="px-3 py-1.5 rounded-lg text-xs font-bold border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-zinc-900 text-slate-600 dark:text-zinc-400 hover:border-brand-400/40 hover:text-brand-500 transition-all">
                                    {label}
                                </Link>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
