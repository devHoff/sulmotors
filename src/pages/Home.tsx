import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
    Search, ArrowRight, ShieldCheck, BadgePercent,
    Award, Car, Headset, PlusCircle, ChevronRight, Star, TrendingUp,
    Users, Store, Globe,
} from 'lucide-react';
import CarCard from '../components/CarCard';
import AddStoreModal from '../components/AddStoreModal';
import { type Car as CarType } from '../data/mockCars';
import { supabase, supabasePublic } from '../lib/supabase';
import { useLanguage } from '../contexts/LanguageContext';

const heroImages = [
    'https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?w=1400&q=80',
    'https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=1400&q=80',
    'https://images.unsplash.com/photo-1544636331-e26879cd4d9b?w=1400&q=80',
];

export default function Home() {
    const navigate = useNavigate();
    const { t } = useLanguage();
    const [searchTerm, setSearchTerm] = useState('');
    const [heroIndex, setHeroIndex] = useState(0);
    const [featuredCars, setFeaturedCars] = useState<CarType[]>([]);
    const [loadingFeatured, setLoadingFeatured] = useState(true);
    const [totalCars, setTotalCars] = useState<number | null>(null);
    const [totalUsers, setTotalUsers] = useState<number | null>(null);
    const [addStoreOpen, setAddStoreOpen] = useState(false);
    const heroTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

    useEffect(() => {
        heroTimerRef.current = setInterval(() => setHeroIndex(i => (i + 1) % heroImages.length), 5000);
        return () => { if (heroTimerRef.current) clearInterval(heroTimerRef.current); };
    }, []);

    useEffect(() => {
        const fetchFeatured = async () => {
            setLoadingFeatured(true);
            // Fetch only cars that have paid for boost (impulsionado=true or destaque=true)
            const { data, error } = await supabasePublic.from('anuncios').select('*')
                .or('impulsionado.eq.true,destaque.eq.true')
                .order('impulsionado', { ascending: false })
                .order('prioridade',   { ascending: false })
                .order('created_at',   { ascending: false })
                .limit(8);
            if (!error && data) {
                setFeaturedCars(data.map((d: any) => ({
                    id: d.id, marca: d.marca, modelo: d.modelo, ano: d.ano,
                    preco: Number(d.preco), quilometragem: d.quilometragem,
                    telefone: d.telefone, descricao: d.descricao || '',
                    combustivel: d.combustivel, cambio: d.cambio, cor: d.cor,
                    cidade: d.cidade, aceitaTroca: d.aceita_troca ?? false,
                    imagens: d.imagens || [], destaque: d.destaque ?? false,
                    impulsionado: d.impulsionado ?? false,
                    impulsionado_ate: d.impulsionado_ate || undefined,
                    prioridade: d.prioridade ?? 0, modelo_3d: false,
                    created_at: d.created_at, user_id: d.user_id,
                })));
            }
            setLoadingFeatured(false);
        };
        fetchFeatured();

        // Separate count query for total cars in estoque
        const fetchCount = async () => {
            const { count } = await supabasePublic
                .from('anuncios')
                .select('id', { count: 'exact', head: true });
            if (count !== null) setTotalCars(count);
        };
        fetchCount();
    }, []);

    // Fetch user count
    useEffect(() => {
        const fetchUsers = async () => {
            const { count } = await supabasePublic
                .from('profiles')
                .select('id', { count: 'exact', head: true });
            if (count !== null) setTotalUsers(count);
        };
        fetchUsers();
    }, []);

    const handleSearch = () => navigate(`/estoque?q=${encodeURIComponent(searchTerm)}`);

    const stats = [
        { value: totalCars !== null ? String(totalCars) : '…', label: t.home_stats_vehicles, icon: Car    },
        { value: '-%',                                          label: t.home_stats_clients,  icon: Users  },
        { value: '1',                                           label: t.home_stats_stores,   icon: Store  },
        { value: totalUsers !== null ? String(totalUsers) : '…', label: t.home_stats_market, icon: Globe  },
    ];

    const categories = [
        { label: t.home_cat_sedans,  img: 'https://images.unsplash.com/photo-1552519507-da3b142c6e3d?w=400&q=70', q: 'Sedan'    },
        { label: t.home_cat_suvs,    img: 'https://images.unsplash.com/photo-1519641471654-76ce0107ad1b?w=400&q=70', q: 'SUV'      },
        { label: t.home_cat_sports,  img: 'https://images.unsplash.com/photo-1504215680853-026ed2a45def?w=400&q=70', q: 'Esportivo' },
        { label: t.home_cat_pickups, img: 'https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?w=400&q=70', q: 'Pickup'   },
    ];

    const features = [
        {
            icon: ShieldCheck,
            title: t.home_security_title,
            desc:  t.home_security_desc,
            color: 'from-emerald-500/15 to-emerald-500/5',
            accent: 'text-emerald-500 dark:text-emerald-400',
            border: 'border-emerald-200 dark:border-emerald-500/20',
        },
        {
            icon: BadgePercent,
            title: t.home_price_title,
            desc:  t.home_price_desc,
            color: 'from-brand-500/15 to-brand-500/5',
            accent: 'text-brand-500 dark:text-brand-400',
            border: 'border-brand-200 dark:border-brand-500/20',
        },
        {
            icon: Headset,
            title: t.home_support_title,
            desc:  t.home_support_desc,
            color: 'from-purple-500/15 to-purple-500/5',
            accent: 'text-purple-500 dark:text-purple-400',
            border: 'border-purple-200 dark:border-purple-500/20',
        },
    ];

    return (
        <div className="bg-slate-50 dark:bg-zinc-950 transition-colors duration-300">

            {/* ── HERO (always dark – photo bg) ── */}
            <section className="relative min-h-[92vh] flex items-center overflow-hidden">
                {heroImages.map((img, i) => (
                    <motion.div key={i} initial={false} animate={{ opacity: i === heroIndex ? 1 : 0 }} transition={{ duration: 1.2 }} className="absolute inset-0">
                        <img src={img} alt="" className="w-full h-full object-cover" />
                    </motion.div>
                ))}
                <div className="absolute inset-0 bg-gradient-to-r from-zinc-950 via-zinc-950/85 to-zinc-950/40 z-10" />
                <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-transparent to-zinc-950/30 z-10" />
                <div className="absolute inset-0 z-10 opacity-30"
                    style={{ backgroundImage: 'linear-gradient(rgba(0,212,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(0,212,255,0.05) 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
                <div className="absolute top-1/2 left-1/4 -translate-y-1/2 w-[600px] h-[600px] bg-brand-400/5 rounded-full blur-[120px] z-10" />

                <div className="relative z-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full pt-20 pb-24">
                    <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }} className="max-w-3xl">
                        <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-brand-400/10 border border-brand-400/30 rounded-full mb-6">
                            <div className="w-1.5 h-1.5 rounded-full bg-brand-400 animate-pulse" />
                            <span className="text-xs font-bold text-brand-400 uppercase tracking-widest">{t.home_badge}</span>
                        </div>
                        <h1 className="text-5xl md:text-7xl font-black text-white leading-none mb-6 tracking-tight">
                            {t.home_hero_title1}<br />
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-400 to-brand-300">{t.home_hero_title2}</span><br />
                            {t.home_hero_title3}
                        </h1>
                        <p className="text-zinc-300 text-lg md:text-xl max-w-xl mb-10 leading-relaxed">
                            {t.home_hero_sub}
                        </p>
                        <div className="flex flex-col sm:flex-row gap-3 max-w-xl">
                            <div className="relative flex-1">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400" strokeWidth={1.5} />
                                <input
                                    type="text"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                                    placeholder={t.home_search_placeholder}
                                    className="w-full pl-12 pr-4 py-4 bg-white/10 border border-white/20 hover:border-brand-400/50 focus:border-brand-400/70 rounded-xl text-white placeholder-zinc-400 outline-none transition-all text-sm backdrop-blur-sm"
                                />
                            </div>
                            <button
                                onClick={handleSearch}
                                className="flex items-center justify-center gap-2 px-6 py-4 bg-brand-400 hover:bg-brand-300 text-zinc-950 font-black text-sm rounded-xl transition-all hover:shadow-glow whitespace-nowrap"
                            >
                                <Search className="w-4 h-4" strokeWidth={1.5} /> {t.home_search_btn}
                            </button>
                        </div>
                        <div className="flex flex-wrap gap-2 mt-5">
                            {['SUV', 'Sedan', 'Hatch', 'Pickup', '0 KM'].map((term) => (
                                <button key={term} onClick={() => navigate(`/estoque?q=${term}`)}
                                    className="px-3 py-1.5 bg-white/10 hover:bg-brand-400/20 border border-white/15 hover:border-brand-400/40 rounded-lg text-xs font-medium text-zinc-300 hover:text-brand-400 transition-all">
                                    {term}
                                </button>
                            ))}
                        </div>
                    </motion.div>
                    <div className="absolute bottom-8 left-4 sm:left-8 flex gap-2">
                        {heroImages.map((_, i) => (
                            <button key={i} onClick={() => setHeroIndex(i)}
                                className={`transition-all duration-300 rounded-full ${i === heroIndex ? 'w-8 h-2 bg-brand-400' : 'w-2 h-2 bg-white/25 hover:bg-white/50'}`} />
                        ))}
                    </div>
                </div>
            </section>

            {/* ── STATS ── */}
            <section className="border-y border-slate-200 dark:border-white/5 bg-white dark:bg-zinc-900/50 backdrop-blur-sm transition-colors">
                <div className="max-w-6xl mx-auto px-4">
                    <div className="grid grid-cols-2 md:grid-cols-4">
                        {stats.map(({ value, label, icon: Icon }, i) => (
                            <div key={i} className={`px-8 py-8 text-center ${i < stats.length - 1 ? 'border-r border-slate-200 dark:border-white/5' : ''}`}>
                                <div className="flex justify-center mb-2">
                                    <Icon className="w-5 h-5 text-brand-400/60" strokeWidth={1.5} />
                                </div>
                                <p className="text-3xl font-black text-brand-500 dark:text-brand-400 mb-1">{value}</p>
                                <p className="text-xs text-slate-500 dark:text-zinc-500 font-medium uppercase tracking-wider">{label}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ── FEATURED CARS ── */}
            <section className="max-w-6xl mx-auto px-4 py-20">
                <div className="flex items-end justify-between mb-10">
                    <div>
                        <div className="flex items-center gap-2 mb-3">
                            <Star className="w-4 h-4 text-brand-500 dark:text-brand-400" strokeWidth={1.5} />
                            <span className="text-xs font-bold text-brand-500 dark:text-brand-400 uppercase tracking-widest">{t.home_featured_label}</span>
                        </div>
                        <h2 className="text-3xl md:text-4xl font-black text-slate-900 dark:text-white tracking-tight">
                            {t.home_featured_title}<span className="text-brand-500 dark:text-brand-400">{t.home_featured_accent}</span>
                        </h2>
                    </div>
                    <Link to="/estoque" className="hidden sm:flex items-center gap-2 text-sm font-bold text-slate-500 dark:text-zinc-400 hover:text-brand-500 dark:hover:text-brand-400 transition-colors group">
                        {t.home_see_all} <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" strokeWidth={1.5} />
                    </Link>
                </div>

                {loadingFeatured ? (
                    <div className="flex items-center justify-center py-20">
                        <div className="w-12 h-12 rounded-full border-2 border-brand-400/20 border-t-brand-400 animate-spin" />
                    </div>
                ) : featuredCars.length > 0 ? (
                    <>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                            {featuredCars.map((car, i) => (
                                <motion.div key={car.id} initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.07 }}>
                                    <CarCard car={car} />
                                </motion.div>
                            ))}
                        </div>
                        <div className="text-center mt-10">
                            <Link to="/estoque" className="inline-flex items-center gap-2 px-8 py-4 bg-slate-100 dark:bg-white/5 hover:bg-brand-400/10 border border-slate-200 dark:border-white/10 hover:border-brand-400/30 text-slate-700 dark:text-white hover:text-brand-500 dark:hover:text-brand-400 font-bold rounded-xl transition-all">
                                {t.home_see_all_vehicles} <ArrowRight className="w-4 h-4" strokeWidth={1.5} />
                            </Link>
                        </div>
                    </>
                ) : (
                    <div className="text-center py-16 bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-white/5">
                        <Car className="w-12 h-12 text-slate-300 dark:text-zinc-700 mx-auto mb-4" strokeWidth={1.5} />
                        <p className="text-slate-500 dark:text-zinc-500 mb-4">{t.home_no_featured}</p>
                        <Link to="/estoque" className="text-brand-500 dark:text-brand-400 font-bold hover:underline">{t.home_see_all_vehicles}</Link>
                    </div>
                )}
            </section>

            {/* ── STORES ── */}
            <section className="bg-white dark:bg-zinc-900/50 border-y border-slate-200 dark:border-white/5 py-16 transition-colors">
                <div className="max-w-6xl mx-auto px-4">
                    <div className="flex items-end justify-between mb-8">
                        <div>
                            <div className="flex items-center gap-2 mb-3">
                                <TrendingUp className="w-4 h-4 text-brand-500 dark:text-brand-400" strokeWidth={1.5} />
                                <span className="text-xs font-bold text-brand-500 dark:text-brand-400 uppercase tracking-widest">{t.home_partners_label}</span>
                            </div>
                            <h2 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white">{t.home_partners_title}</h2>
                        </div>
                        <Link to="/estoque" className="text-xs font-bold text-slate-400 dark:text-zinc-500 hover:text-brand-500 dark:hover:text-brand-400 flex items-center gap-1 uppercase tracking-wider transition-colors">
                            {t.stores_see_all} <ChevronRight className="w-3.5 h-3.5" strokeWidth={1.5} />
                        </Link>
                    </div>

                    {/* Same 5-column grid as before – only 2 slots used */}
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                        {/* AlexMegaMotors – the only real partner store */}
                        <Link
                            to="/estoque?loja=AlexMegaMotors"
                            className="bg-black h-28 rounded-2xl flex items-center justify-center p-4 border border-white/5 hover:border-brand-400/30 transition-all hover:scale-[1.02] active:scale-[0.98] overflow-hidden group"
                        >
                            <img
                                src="https://imkzkvlktrixaxougqie.supabase.co/storage/v1/object/public/brands/alexmegamotors.png"
                                alt="AlexMegaMotors"
                                className="w-full h-full object-contain scale-150"
                            />
                        </Link>

                        {/* Add your store placeholder */}
                        <button
                            onClick={() => setAddStoreOpen(true)}
                            className="h-28 rounded-2xl flex flex-col items-center justify-center gap-2 p-4 border-2 border-dashed border-slate-300 dark:border-white/15 hover:border-brand-400/60 bg-slate-50 dark:bg-white/[0.02] hover:bg-brand-400/5 transition-all group"
                        >
                            <div className="w-9 h-9 rounded-full border-2 border-dashed border-slate-300 dark:border-white/20 group-hover:border-brand-400/60 flex items-center justify-center transition-colors">
                                <PlusCircle className="w-4 h-4 text-slate-400 dark:text-zinc-500 group-hover:text-brand-400 transition-colors" strokeWidth={1.5} />
                            </div>
                            <span className="text-xs font-semibold text-slate-400 dark:text-zinc-500 group-hover:text-brand-400 transition-colors text-center leading-tight">
                                {t.home_add_store}
                            </span>
                        </button>
                    </div>
                </div>
            </section>

            {/* Add Store Modal */}
            <AddStoreModal isOpen={addStoreOpen} onClose={() => setAddStoreOpen(false)} />

            {/* ── WHY CHOOSE US ── */}
            <section className="max-w-6xl mx-auto px-4 py-20">
                <div className="text-center mb-14">
                    <div className="flex items-center justify-center gap-2 mb-3">
                        <Award className="w-4 h-4 text-brand-500 dark:text-brand-400" strokeWidth={1.5} />
                        <span className="text-xs font-bold text-brand-500 dark:text-brand-400 uppercase tracking-widest">{t.home_why_label}</span>
                    </div>
                    <h2 className="text-3xl md:text-4xl font-black text-slate-900 dark:text-white tracking-tight mb-3">
                        {t.home_why_title}<span className="text-brand-500 dark:text-brand-400">{t.home_why_accent}</span>
                    </h2>
                    <p className="text-slate-500 dark:text-zinc-500 max-w-lg mx-auto">
                        {t.home_why_sub}
                    </p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {features.map(({ icon: Icon, title, desc, color, accent, border }, i) => (
                        <motion.div key={title} initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}
                            className={`relative p-8 bg-white dark:bg-zinc-900 rounded-2xl border ${border} overflow-hidden group hover:border-opacity-70 transition-all shadow-sm hover:shadow-md dark:shadow-none`}>
                            <div className={`absolute inset-0 bg-gradient-to-br ${color} opacity-0 group-hover:opacity-100 transition-opacity`} />
                            <div className="relative">
                                <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 flex items-center justify-center mb-5">
                                    <Icon className={`w-6 h-6 ${accent}`} strokeWidth={1.5} />
                                </div>
                                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">{title}</h3>
                                <p className="text-sm text-slate-500 dark:text-zinc-500 leading-relaxed">{desc}</p>
                            </div>
                        </motion.div>
                    ))}
                </div>
            </section>

            {/* ── CATEGORY GRID ── */}
            <section className="bg-white dark:bg-zinc-900/50 border-y border-slate-200 dark:border-white/5 py-16 transition-colors">
                <div className="max-w-6xl mx-auto px-4">
                    <div className="mb-8">
                        <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-1">{t.home_categories_title}</h2>
                        <p className="text-slate-500 dark:text-zinc-500 text-sm">{t.home_categories_sub}</p>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {categories.map(({ label, img, q }) => (
                            <Link key={q} to={`/estoque?q=${q}`}
                                className="group relative h-40 rounded-2xl overflow-hidden border border-slate-200 dark:border-white/5 hover:border-brand-400/30 transition-all">
                                <img src={img} alt={label} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                                <div className="absolute bottom-0 left-0 right-0 p-4">
                                    <p className="text-white font-bold text-sm">{label}</p>
                                    <p className="text-zinc-300 text-xs flex items-center gap-1 mt-0.5 group-hover:text-brand-400 transition-colors">
                                        {t.home_cat_see_more} <ChevronRight className="w-3 h-3" strokeWidth={1.5} />
                                    </p>
                                </div>
                            </Link>
                        ))}
                    </div>
                </div>
            </section>

            {/* ── CTA (always dark – photo bg) ── */}
            <section className="py-24 relative overflow-hidden">
                <div className="absolute inset-0">
                    <img src="https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=1400&q=60" alt="" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-zinc-950/90" />
                    <div className="absolute inset-0 bg-gradient-to-r from-brand-950/80 to-zinc-950/90" />
                </div>
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[300px] bg-brand-400/10 blur-[100px] rounded-full" />
                <div className="relative z-10 max-w-4xl mx-auto px-4 text-center">
                    <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-brand-400/10 border border-brand-400/30 rounded-full mb-6">
                        <PlusCircle className="w-3.5 h-3.5 text-brand-400" strokeWidth={1.5} />
                        <span className="text-xs font-bold text-brand-400 uppercase tracking-widest">{t.home_cta_badge}</span>
                    </div>
                    <h2 className="text-4xl md:text-6xl font-black text-white mb-6 leading-tight tracking-tight">
                        {t.home_cta_title}<br />
                        <span className="text-brand-400">{t.home_cta_accent}</span>
                    </h2>
                    <p className="text-zinc-300 text-lg mb-10 max-w-xl mx-auto">
                        {t.home_cta_sub}
                    </p>
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                        <Link to="/anunciar" className="group flex items-center gap-3 px-8 py-4 bg-brand-400 hover:bg-brand-300 text-zinc-950 font-black rounded-xl transition-all hover:shadow-glow-lg">
                            <PlusCircle className="w-5 h-5" strokeWidth={1.5} /> {t.home_cta_btn}
                            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" strokeWidth={1.5} />
                        </Link>
                        <Link to="/estoque" className="flex items-center gap-2 px-8 py-4 bg-white/10 hover:bg-white/15 border border-white/20 text-white font-bold rounded-xl transition-all">
                            {t.home_cta_explore}
                        </Link>
                    </div>
                </div>
            </section>
        </div>
    );
}
