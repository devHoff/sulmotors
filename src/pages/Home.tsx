import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
    Search, ArrowRight, ShieldCheck, BadgePercent, Landmark,
    Award, Car, Headset, Zap, ChevronRight, Star, TrendingUp,
    Fuel, Settings2,
} from 'lucide-react';
import CarCard from '../components/CarCard';
import { type Car as CarType } from '../data/mockCars';
import { supabase } from '../lib/supabase';

const heroImages = [
    'https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?w=1400&q=80',
    'https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=1400&q=80',
    'https://images.unsplash.com/photo-1544636331-e26879cd4d9b?w=1400&q=80',
];

const brands = [
    { name: 'BMW', logo: 'https://upload.wikimedia.org/wikipedia/commons/4/44/BMW.svg' },
    { name: 'Mercedes', logo: 'https://upload.wikimedia.org/wikipedia/commons/9/90/Mercedes-Logo.svg' },
    { name: 'Audi', logo: 'https://upload.wikimedia.org/wikipedia/commons/9/92/Audi-Logo_2016.svg' },
    { name: 'Toyota', logo: 'https://upload.wikimedia.org/wikipedia/commons/9/9d/Toyota_carlogo.svg' },
    { name: 'Honda', logo: 'https://upload.wikimedia.org/wikipedia/commons/3/38/Honda.svg' },
    { name: 'Volkswagen', logo: 'https://upload.wikimedia.org/wikipedia/commons/6/6d/Volkswagen_logo_2019.svg' },
];

export default function Home() {
    const navigate = useNavigate();
    const [searchTerm, setSearchTerm] = useState('');
    const [heroIndex, setHeroIndex] = useState(0);
    const [featuredCars, setFeaturedCars] = useState<CarType[]>([]);
    const [loadingFeatured, setLoadingFeatured] = useState(true);
    const heroTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

    useEffect(() => {
        heroTimerRef.current = setInterval(() => setHeroIndex(i => (i + 1) % heroImages.length), 5000);
        return () => { if (heroTimerRef.current) clearInterval(heroTimerRef.current); };
    }, []);

    useEffect(() => {
        const fetchFeatured = async () => {
            setLoadingFeatured(true);
            const { data, error } = await supabase.from('anuncios').select('*')
                .or('destaque.eq.true,impulsionado.eq.true')
                .order('prioridade', { ascending: false })
                .order('created_at', { ascending: false })
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
    }, []);

    const handleSearch = () => navigate(`/estoque?q=${encodeURIComponent(searchTerm)}`);

    const stats = [
        { value: '2.400+', label: 'Veículos disponíveis' },
        { value: '98%', label: 'Clientes satisfeitos' },
        { value: '150+', label: 'Lojas parceiras' },
        { value: '8 anos', label: 'No mercado' },
    ];

    const stores = [
        { name: 'AlexMegaMotors', bg: 'bg-black', logo: 'https://imkzkvlktrixaxougqie.supabase.co/storage/v1/object/public/brands/alexmegamotors.png' },
        { name: 'MoloCars', bg: 'bg-gradient-to-br from-orange-500 to-red-600', text: 'text-white' },
        { name: 'NiggaMotors', bg: 'bg-zinc-800', text: 'text-white' },
        { name: 'DriveCu', bg: 'bg-gradient-to-br from-blue-600 to-purple-700', text: 'text-white' },
        { name: 'VrumVrum', bg: 'bg-gradient-to-br from-zinc-900 to-zinc-800', text: 'text-white' },
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
                            <span className="text-xs font-bold text-brand-400 uppercase tracking-widest">Marketplace #1 do Sul</span>
                        </div>
                        <h1 className="text-5xl md:text-7xl font-black text-white leading-none mb-6 tracking-tight">
                            Encontre o<br />
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-400 to-brand-300">carro perfeito</span><br />
                            para você.
                        </h1>
                        <p className="text-zinc-300 text-lg md:text-xl max-w-xl mb-10 leading-relaxed">
                            Milhares de veículos seminovos e 0km com os melhores preços. Compra segura e garantida.
                        </p>
                        <div className="flex flex-col sm:flex-row gap-3 max-w-xl">
                            <div className="relative flex-1">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400" />
                                <input type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                                    placeholder="Marca, modelo ou palavra-chave..."
                                    className="w-full pl-12 pr-4 py-4 bg-white/10 border border-white/20 hover:border-brand-400/50 focus:border-brand-400/70 rounded-xl text-white placeholder-zinc-400 outline-none transition-all text-sm backdrop-blur-sm" />
                            </div>
                            <button onClick={handleSearch}
                                className="flex items-center justify-center gap-2 px-6 py-4 bg-brand-400 hover:bg-brand-300 text-zinc-950 font-black text-sm rounded-xl transition-all hover:shadow-glow whitespace-nowrap">
                                <Search className="w-4 h-4" /> Buscar
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
                        {stats.map(({ value, label }, i) => (
                            <div key={i} className={`px-8 py-8 text-center ${i < stats.length - 1 ? 'border-r border-slate-200 dark:border-white/5' : ''}`}>
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
                            <Star className="w-4 h-4 text-brand-500 dark:text-brand-400" />
                            <span className="text-xs font-bold text-brand-500 dark:text-brand-400 uppercase tracking-widest">Selecionados para você</span>
                        </div>
                        <h2 className="text-3xl md:text-4xl font-black text-slate-900 dark:text-white tracking-tight">
                            Veículos em <span className="text-brand-500 dark:text-brand-400">destaque</span>
                        </h2>
                    </div>
                    <Link to="/estoque" className="hidden sm:flex items-center gap-2 text-sm font-bold text-slate-500 dark:text-zinc-400 hover:text-brand-500 dark:hover:text-brand-400 transition-colors group">
                        Ver todos <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
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
                                Ver todos os veículos <ArrowRight className="w-4 h-4" />
                            </Link>
                        </div>
                    </>
                ) : (
                    <div className="text-center py-16 bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-white/5">
                        <Car className="w-12 h-12 text-slate-300 dark:text-zinc-700 mx-auto mb-4" />
                        <p className="text-slate-500 dark:text-zinc-500 mb-4">Nenhum veículo em destaque no momento.</p>
                        <Link to="/estoque" className="text-brand-500 dark:text-brand-400 font-bold hover:underline">Ver todos os veículos</Link>
                    </div>
                )}
            </section>

            {/* ── STORES ── */}
            <section className="bg-white dark:bg-zinc-900/50 border-y border-slate-200 dark:border-white/5 py-16 transition-colors">
                <div className="max-w-6xl mx-auto px-4">
                    <div className="flex items-end justify-between mb-8">
                        <div>
                            <div className="flex items-center gap-2 mb-3">
                                <TrendingUp className="w-4 h-4 text-brand-500 dark:text-brand-400" />
                                <span className="text-xs font-bold text-brand-500 dark:text-brand-400 uppercase tracking-widest">Parceiros verificados</span>
                            </div>
                            <h2 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white">Lojas em destaque</h2>
                        </div>
                        <Link to="/estoque" className="text-xs font-bold text-slate-400 dark:text-zinc-500 hover:text-brand-500 dark:hover:text-brand-400 flex items-center gap-1 uppercase tracking-wider transition-colors">
                            Ver todas <ChevronRight className="w-3.5 h-3.5" />
                        </Link>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                        {stores.map((store) => (
                            <Link key={store.name} to={`/estoque?loja=${store.name}`}
                                className={`${store.bg} h-28 rounded-2xl flex items-center justify-center p-4 border border-white/5 hover:border-brand-400/30 transition-all hover:scale-[1.02] active:scale-[0.98] overflow-hidden group`}>
                                {store.logo ? (
                                    <img src={store.logo} alt={store.name} className="w-full h-full object-contain scale-150" />
                                ) : (
                                    <span className={`text-sm font-black tracking-tight ${store.text} group-hover:scale-105 transition-transform`}>{store.name}</span>
                                )}
                            </Link>
                        ))}
                    </div>
                </div>
            </section>

            {/* ── WHY CHOOSE US ── */}
            <section className="max-w-6xl mx-auto px-4 py-20">
                <div className="text-center mb-14">
                    <div className="flex items-center justify-center gap-2 mb-3">
                        <Award className="w-4 h-4 text-brand-500 dark:text-brand-400" />
                        <span className="text-xs font-bold text-brand-500 dark:text-brand-400 uppercase tracking-widest">Diferenciais</span>
                    </div>
                    <h2 className="text-3xl md:text-4xl font-black text-slate-900 dark:text-white tracking-tight mb-3">
                        Por que escolher a <span className="text-brand-500 dark:text-brand-400">SulMotors?</span>
                    </h2>
                    <p className="text-slate-500 dark:text-zinc-500 max-w-lg mx-auto">
                        Tecnologia, segurança e a melhor experiência em compra e venda de veículos.
                    </p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {[
                        { icon: ShieldCheck, title: 'Segurança Garantida', desc: 'Todos os anúncios são verificados. Compre com total tranquilidade.', color: 'from-emerald-500/15 to-emerald-500/5', accent: 'text-emerald-500 dark:text-emerald-400', border: 'border-emerald-200 dark:border-emerald-500/20' },
                        { icon: BadgePercent, title: 'Melhores Preços', desc: 'Preços competitivos e transparentes, sem surpresas na hora da compra.', color: 'from-brand-500/15 to-brand-500/5', accent: 'text-brand-500 dark:text-brand-400', border: 'border-brand-200 dark:border-brand-500/20' },
                        { icon: Headset, title: 'Suporte Dedicado', desc: 'Nossa equipe está disponível para te auxiliar em cada etapa.', color: 'from-purple-500/15 to-purple-500/5', accent: 'text-purple-500 dark:text-purple-400', border: 'border-purple-200 dark:border-purple-500/20' },
                    ].map(({ icon: Icon, title, desc, color, accent, border }, i) => (
                        <motion.div key={title} initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}
                            className={`relative p-8 bg-white dark:bg-zinc-900 rounded-2xl border ${border} overflow-hidden group hover:border-opacity-70 transition-all shadow-sm hover:shadow-md dark:shadow-none`}>
                            <div className={`absolute inset-0 bg-gradient-to-br ${color} opacity-0 group-hover:opacity-100 transition-opacity`} />
                            <div className="relative">
                                <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 flex items-center justify-center mb-5">
                                    <Icon className={`w-6 h-6 ${accent}`} />
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
                        <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-1">Explore por categoria</h2>
                        <p className="text-slate-500 dark:text-zinc-500 text-sm">Encontre o veículo ideal para o seu estilo de vida</p>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {[
                            { label: 'Sedans', img: 'https://images.unsplash.com/photo-1552519507-da3b142c6e3d?w=400&q=70', q: 'Sedan' },
                            { label: 'SUVs', img: 'https://images.unsplash.com/photo-1519641471654-76ce0107ad1b?w=400&q=70', q: 'SUV' },
                            { label: 'Esportivos', img: 'https://images.unsplash.com/photo-1504215680853-026ed2a45def?w=400&q=70', q: 'Esportivo' },
                            { label: 'Picapes', img: 'https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?w=400&q=70', q: 'Pickup' },
                        ].map(({ label, img, q }) => (
                            <Link key={label} to={`/estoque?q=${q}`}
                                className="group relative h-40 rounded-2xl overflow-hidden border border-slate-200 dark:border-white/5 hover:border-brand-400/30 transition-all">
                                <img src={img} alt={label} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                                <div className="absolute bottom-0 left-0 right-0 p-4">
                                    <p className="text-white font-bold text-sm">{label}</p>
                                    <p className="text-zinc-300 text-xs flex items-center gap-1 mt-0.5 group-hover:text-brand-400 transition-colors">
                                        Ver mais <ChevronRight className="w-3 h-3" />
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
                        <Zap className="w-3.5 h-3.5 text-brand-400" />
                        <span className="text-xs font-bold text-brand-400 uppercase tracking-widest">Grátis para anunciar</span>
                    </div>
                    <h2 className="text-4xl md:text-6xl font-black text-white mb-6 leading-tight tracking-tight">
                        Quer vender seu<br />
                        <span className="text-brand-400">carro mais rápido?</span>
                    </h2>
                    <p className="text-zinc-300 text-lg mb-10 max-w-xl mx-auto">
                        Anuncie gratuitamente e alcance milhares de compradores interessados na sua região.
                    </p>
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                        <Link to="/anunciar" className="group flex items-center gap-3 px-8 py-4 bg-brand-400 hover:bg-brand-300 text-zinc-950 font-black rounded-xl transition-all hover:shadow-glow-lg">
                            <Zap className="w-5 h-5" /> Anunciar Agora — Grátis
                            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                        </Link>
                        <Link to="/estoque" className="flex items-center gap-2 px-8 py-4 bg-white/10 hover:bg-white/15 border border-white/20 text-white font-bold rounded-xl transition-all">
                            Explorar estoque
                        </Link>
                    </div>
                </div>
            </section>
        </div>
    );
}
