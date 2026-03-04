import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
    Search, Tag, ChevronLeft, ChevronRight, ShieldCheck,
    BadgePercent, Landmark, Award, Car, Headset, ArrowRight,
    DollarSign, CreditCard, BadgeCheck, Bike, Truck, Plus, Loader2,
} from 'lucide-react';
import CarCard from '../components/CarCard';
import { type Car as CarType } from '../data/mockCars';
import { supabase } from '../lib/supabase';

const heroImages = [
    'https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?w=1400&q=80',
    'https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=1400&q=80',
    'https://images.unsplash.com/photo-1544636331-e26879cd4d9b?w=1400&q=80',
];

export default function Home() {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState<'comprar' | 'vender'>('comprar');
    const [searchTerm, setSearchTerm] = useState('');
    const [heroIndex, setHeroIndex] = useState(0);
    const [featuredCars, setFeaturedCars] = useState<CarType[]>([]);
    const [loadingFeatured, setLoadingFeatured] = useState(true);

    useEffect(() => {
        const fetchFeatured = async () => {
            setLoadingFeatured(true);

            // Fetch ONLY from Supabase
            const { data, error } = await supabase
                .from('anuncios')
                .select('*')
                .or('destaque.eq.true,impulsionado.eq.true')
                .order('prioridade', { ascending: false })
                .order('created_at', { ascending: false })
                .limit(8);

            let supabaseFeatured: CarType[] = [];
            if (!error && data) {
                supabaseFeatured = data.map((d: any) => ({
                    id: d.id,
                    marca: d.marca,
                    modelo: d.modelo,
                    ano: d.ano,
                    preco: Number(d.preco),
                    quilometragem: d.quilometragem,
                    telefone: d.telefone,
                    descricao: d.descricao || '',
                    combustivel: d.combustivel,
                    cambio: d.cambio,
                    cor: d.cor,
                    cidade: d.cidade,
                    aceitaTroca: d.aceita_troca ?? false,
                    imagens: d.imagens || [],
                    destaque: d.destaque ?? false,
                    impulsionado: d.impulsionado ?? false,
                    impulsionado_ate: d.impulsionado_ate || undefined,
                    prioridade: d.prioridade ?? 0,
                    modelo_3d: false,
                    created_at: d.created_at,
                    user_id: d.user_id,
                }));
            }

            setFeaturedCars(supabaseFeatured);
            setLoadingFeatured(false);
        };
        fetchFeatured();
    }, []);

    const handleSearch = () => {
        navigate(`/estoque?q=${encodeURIComponent(searchTerm)}`);
    };

    const prevHero = () => setHeroIndex((i) => (i === 0 ? heroImages.length - 1 : i - 1));
    const nextHero = () => setHeroIndex((i) => (i === heroImages.length - 1 ? 0 : i + 1));

    const quickCategories = [
        { icon: DollarSign, label: 'Valor do veículo' },
        { icon: CreditCard, label: 'Valor da parcela' },
        { icon: BadgeCheck, label: 'Seminovos com garantia' },
        { icon: Bike, label: 'Motos' },
        { icon: Car, label: '0 KM' },
        { icon: Truck, label: 'Camionete' },
        { icon: Plus, label: 'Ver mais' },
    ];

    return (
        <div>
            {/* ====== HERO ====== */}
            <section className="relative h-[420px] md:h-[480px] overflow-hidden">
                {heroImages.map((img, i) => (
                    <motion.div
                        key={i}
                        initial={false}
                        animate={{ opacity: i === heroIndex ? 1 : 0 }}
                        transition={{ duration: 0.7 }}
                        className="absolute inset-0"
                    >
                        <img src={img} alt="" className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-black/50" />
                    </motion.div>
                ))}

                {/* Arrows */}
                <button onClick={prevHero} className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center text-white hover:bg-white/40 transition z-10">
                    <ChevronLeft className="w-5 h-5" />
                </button>
                <button onClick={nextHero} className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center text-white hover:bg-white/40 transition z-10">
                    <ChevronRight className="w-5 h-5" />
                </button>

                {/* Dots */}
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 z-10">
                    {heroImages.map((_, i) => (
                        <button
                            key={i}
                            onClick={() => setHeroIndex(i)}
                            className={`w-2.5 h-2.5 rounded-full transition-all ${i === heroIndex ? 'bg-white w-7' : 'bg-white/50'
                                }`}
                        />
                    ))}
                </div>
            </section>

            {/* ====== SEARCH BAR ====== */}
            <section className="bg-brand-600 py-8">
                <div className="max-w-5xl mx-auto px-4">
                    {/* Tabs */}
                    <div className="flex gap-2 mb-5">
                        <button
                            onClick={() => setActiveTab('comprar')}
                            className={`flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold transition-all ${activeTab === 'comprar'
                                ? 'bg-white text-slate-900 shadow-lg'
                                : 'bg-brand-500/40 text-white hover:bg-brand-500/60'
                                }`}
                        >
                            <Search className="w-4 h-4" />
                            QUERO COMPRAR
                        </button>
                        <button
                            onClick={() => setActiveTab('vender')}
                            className={`flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold transition-all ${activeTab === 'vender'
                                ? 'bg-white text-slate-900 shadow-lg'
                                : 'bg-brand-500/40 text-white hover:bg-brand-500/60'
                                }`}
                        >
                            <Tag className="w-4 h-4" />
                            QUERO VENDER
                        </button>
                    </div>

                    {activeTab === 'comprar' ? (
                        <div className="flex flex-col sm:flex-row gap-3">
                            <div className="relative flex-1">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                                <input
                                    type="text"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                                    placeholder="Digite aqui marca ou modelo"
                                    className="w-full pl-12 pr-4 py-4 rounded-xl text-sm bg-white border-0 focus:ring-2 focus:ring-brand-300 outline-none"
                                />
                            </div>
                            <button
                                onClick={handleSearch}
                                className="px-8 py-4 bg-brand-900 text-white font-bold text-sm rounded-xl hover:bg-brand-950 transition-colors whitespace-nowrap"
                            >
                                VER TUDO
                            </button>
                        </div>
                    ) : (
                        <div className="text-center py-4">
                            <p className="text-white/80 mb-4">Quer vender seu carro? Anuncie agora gratuitamente!</p>
                            <Link
                                to="/anunciar"
                                className="inline-flex items-center gap-2 px-8 py-4 bg-white text-brand-700 font-bold text-sm rounded-xl hover:bg-slate-50 transition-colors"
                            >
                                Anunciar Carro
                                <ArrowRight className="w-4 h-4" />
                            </Link>
                        </div>
                    )}
                </div>
            </section>

            {/* ====== QUICK CATEGORIES ====== */}
            <section className="max-w-6xl mx-auto px-4 py-12">
                <h2 className="text-lg font-bold text-slate-800 mb-6">Outras opções de busca</h2>
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-7 gap-4">
                    {quickCategories.map(({ icon: Icon, label }) => (
                        <button
                            key={label}
                            className="flex flex-col items-center gap-3 p-5 bg-white rounded-2xl border border-slate-200 hover:border-brand-300 hover:shadow-md transition-all group"
                        >
                            <Icon className="w-7 h-7 text-slate-500 group-hover:text-brand-600 transition-colors" />
                            <span className="text-xs font-medium text-slate-600 text-center leading-tight">{label}</span>
                        </button>
                    ))}
                </div>
            </section>

            {/* ====== RECOMMENDED STORES ====== */}
            <section className="max-w-6xl mx-auto px-4 py-8">
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h2 className="text-xl font-bold text-slate-900">Lojas recomendadas</h2>
                        <p className="text-sm text-slate-500 mt-1">Seminovos selecionados nas melhores lojas da região</p>
                    </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    {[
                        {
                            name: 'AlexMegaMotors',
                            bg: 'bg-[#000000]',
                            logo: 'https://imkzkvlktrixaxougqie.supabase.co/storage/v1/object/public/brands/alexmegamotors.png'
                        },
                        { name: 'MoloCars', bg: 'bg-orange-500', text: 'text-white' },
                        { name: 'NiggaMotors', bg: 'bg-white border border-slate-100 shadow-sm', text: 'text-slate-900' },
                        { name: 'DriveCu', bg: 'bg-gradient-to-br from-blue-500 to-purple-600', text: 'text-white' },
                        { name: 'VrumVrum', bg: 'bg-[#0f172a]', text: 'text-white' },
                    ].map((store) => (
                        <Link
                            key={store.name}
                            to={`/estoque?loja=${store.name}`}
                            className={`${store.bg} h-32 rounded-2xl flex items-center justify-center p-4 text-center transition-transform hover:scale-[1.02] active:scale-[0.98] shadow-sm overflow-hidden`}
                        >
                            {store.logo ? (
                                <img src={store.logo} alt={store.name} className="w-full h-full object-contain scale-150" />
                            ) : (
                                <span className={`text-lg font-black tracking-tight ${store.text}`}>{store.name}</span>
                            )}
                        </Link>
                    ))}
                </div>

                <div className="flex justify-end mt-4">
                    <Link to="/estoque" className="text-xs font-bold text-brand-600 hover:text-brand-700 flex items-center gap-1 uppercase tracking-wider">
                        Ver todas as lojas
                        <ChevronRight className="w-3 h-3" />
                    </Link>
                </div>
            </section>

            {/* ====== HIGHLIGHTS ====== */}
            <section className="bg-gradient-to-r from-brand-50 to-blue-50">
                <div className="max-w-6xl mx-auto px-4 py-10">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {[
                            { icon: ShieldCheck, title: 'Seminovos Inspecionados', desc: 'Todos os veículos passam por inspeção rigorosa' },
                            { icon: BadgePercent, title: 'Melhores Ofertas', desc: 'Preços competitivos e imbatíveis do mercado' },
                            { icon: Landmark, title: 'Financiamento Fácil', desc: 'Condições especiais com taxa reduzida' },
                        ].map(({ icon: Icon, title, desc }) => (
                            <div key={title} className="flex items-start gap-4 p-6 bg-white/70 backdrop-blur-sm rounded-2xl">
                                <div className="w-12 h-12 bg-brand-100 rounded-xl flex items-center justify-center flex-shrink-0">
                                    <Icon className="w-6 h-6 text-brand-600" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-slate-900">{title}</h3>
                                    <p className="text-sm text-slate-500 mt-1">{desc}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ====== FEATURED CARS ====== */}
            <section className="max-w-6xl mx-auto px-4 py-16">
                <h2 className="text-2xl font-bold text-slate-900 mb-2">Veículos em destaque</h2>
                <p className="text-slate-500 mb-8">Os melhores carros selecionados para você</p>

                {loadingFeatured ? (
                    <div className="flex items-center justify-center py-12">
                        <Loader2 className="w-8 h-8 text-brand-600 animate-spin" />
                    </div>
                ) : featuredCars.length > 0 ? (
                    <>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                            {featuredCars.map((car) => (
                                <CarCard key={car.id} car={car} />
                            ))}
                        </div>
                        <div className="text-center mt-10">
                            <Link
                                to="/estoque"
                                className="inline-flex items-center gap-2 px-8 py-3 border-2 border-brand-600 text-brand-600 font-semibold rounded-xl hover:bg-brand-600 hover:text-white transition-all"
                            >
                                VER TODOS OS VEÍCULOS
                            </Link>
                        </div>
                    </>
                ) : (
                    <div className="text-center py-12 bg-slate-50 rounded-2xl">
                        <p className="text-slate-500 mb-2">Nenhum veículo em destaque no momento.</p>
                        <Link to="/estoque" className="text-brand-600 font-semibold hover:underline">
                            Ver todos os veículos disponíveis ({featuredCars.length})
                        </Link>
                    </div>
                )}
            </section>

            {/* ====== BENEFITS ====== */}
            <section className="bg-slate-900 text-white py-20">
                <div className="max-w-6xl mx-auto px-4">
                    <div className="text-center mb-14">
                        <h2 className="text-3xl font-bold">Por que escolher a SulMotors?</h2>
                        <p className="text-slate-400 mt-3">Sua experiência é nossa prioridade</p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        {[
                            { icon: Award, title: 'Confiança e Credibilidade', desc: 'Anos de mercado construindo uma reputação sólida com nossos clientes.' },
                            { icon: Car, title: 'Variedade de Veículos', desc: 'Amplo estoque de seminovos e 0KM de diversas marcas e modelos.' },
                            { icon: Headset, title: 'Atendimento Personalizado', desc: 'Nossa equipe está pronta para te ajudar em cada etapa da compra.' },
                        ].map(({ icon: Icon, title, desc }) => (
                            <motion.div
                                key={title}
                                initial={{ opacity: 0, y: 30 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                className="text-center p-8 bg-slate-800/50 rounded-2xl border border-slate-700/50"
                            >
                                <div className="w-16 h-16 bg-brand-600/20 rounded-2xl flex items-center justify-center mx-auto mb-5">
                                    <Icon className="w-8 h-8 text-brand-400" />
                                </div>
                                <h3 className="text-xl font-bold mb-3">{title}</h3>
                                <p className="text-slate-400 text-sm leading-relaxed">{desc}</p>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ====== FINAL CTA ====== */}
            <section className="bg-gradient-to-r from-brand-600 to-blue-600 py-16">
                <div className="max-w-3xl mx-auto px-4 text-center">
                    <h2 className="text-3xl font-bold text-white mb-4">Quer vender seu carro?</h2>
                    <p className="text-white/80 mb-8">Anuncie gratuitamente e alcance milhares de compradores interessados.</p>
                    <Link
                        to="/anunciar"
                        className="inline-flex items-center gap-2 px-10 py-4 bg-white text-brand-700 font-bold rounded-xl hover:bg-slate-50 transition-all hover:shadow-xl"
                    >
                        Anunciar Agora
                        <ArrowRight className="w-5 h-5" />
                    </Link>
                </div>
            </section>
        </div>
    );
}
