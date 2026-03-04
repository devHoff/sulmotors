import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
    ChevronLeft, ChevronRight, ArrowLeft, Phone, MessageCircle,
    Calendar, Gauge, Fuel, Settings2, Palette, MapPin, ArrowLeftRight,
    Loader2, Heart, Share2, ArrowUpRight
} from 'lucide-react';
import { type Car } from '../data/mockCars';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

export default function DetalheCarro() {
    const { id } = useParams();
    const { user } = useAuth();
    const [car, setCar] = useState<Car | null>(null);
    const [loading, setLoading] = useState(true);
    const [imgIndex, setImgIndex] = useState(0);
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
            <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
                <div className="w-12 h-12 rounded-full border-2 border-brand-400/20 border-t-brand-400 animate-spin" />
            </div>
        );
    }

    if (!car) {
        return (
            <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center">
                <p className="text-xl text-zinc-400 mb-4">Veículo não encontrado.</p>
                <Link to="/estoque" className="text-brand-400 font-bold hover:underline">Voltar ao estoque</Link>
            </div>
        );
    }

    const formatPrice = (price: number) =>
        new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0 }).format(price);

    const formatKm = (km: number) =>
        km === 0 ? '0 km' : `${new Intl.NumberFormat('pt-BR').format(km)} km`;

    const prevImg = () => setImgIndex((i) => (i === 0 ? car.imagens.length - 1 : i - 1));
    const nextImg = () => setImgIndex((i) => (i === car.imagens.length - 1 ? 0 : i + 1));

    const specs = [
        { icon: Calendar, label: 'Ano', value: String(car.ano) },
        { icon: Gauge, label: 'Quilometragem', value: formatKm(car.quilometragem) },
        { icon: Fuel, label: 'Combustível', value: car.combustivel },
        { icon: Settings2, label: 'Câmbio', value: car.cambio },
        { icon: Palette, label: 'Cor', value: car.cor },
        { icon: MapPin, label: 'Cidade', value: car.cidade },
        { icon: ArrowLeftRight, label: 'Aceita troca', value: car.aceitaTroca ? 'Sim' : 'Não' },
    ];

    return (
        <div className="bg-zinc-950 min-h-screen">
            {/* Hero Image - full bleed */}
            <div className="relative h-[50vh] md:h-[65vh] overflow-hidden">
                <motion.img
                    key={imgIndex}
                    initial={{ opacity: 0.7, scale: 1.02 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.4 }}
                    src={car.imagens[imgIndex] || 'https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?w=1400&q=80'}
                    alt={`${car.marca} ${car.modelo}`}
                    className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/20 to-zinc-950/40" />

                {/* Nav overlay */}
                <div className="absolute top-0 left-0 right-0 flex items-center justify-between p-4 sm:p-6">
                    <Link
                        to="/estoque"
                        className="flex items-center gap-2 px-4 py-2.5 bg-black/40 backdrop-blur-sm border border-white/15 text-white text-sm font-bold rounded-xl hover:bg-black/60 transition-all"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        Estoque
                    </Link>
                    <div className="flex items-center gap-2">
                        <button
                            className="flex items-center gap-2 px-3 py-2.5 bg-black/40 backdrop-blur-sm border border-white/15 text-white/70 text-sm rounded-xl hover:text-white transition-all"
                            onClick={() => navigator.share?.({ title: `${car.marca} ${car.modelo}`, url: window.location.href })}
                        >
                            <Share2 className="w-4 h-4" />
                        </button>
                        {user && (
                            <button
                                onClick={toggleLike}
                                className={`flex items-center gap-2 px-4 py-2.5 backdrop-blur-sm border text-sm font-bold rounded-xl transition-all ${
                                    liked
                                        ? 'bg-red-500/20 border-red-500/40 text-red-400'
                                        : 'bg-black/40 border-white/15 text-white/70 hover:text-red-400'
                                }`}
                            >
                                <Heart className={`w-4 h-4 ${liked ? 'fill-red-400' : ''}`} />
                                {likeCount > 0 && likeCount}
                            </button>
                        )}
                    </div>
                </div>

                {/* Image navigation */}
                {car.imagens.length > 1 && (
                    <>
                        <button
                            onClick={prevImg}
                            className="absolute left-4 top-1/2 -translate-y-1/2 w-11 h-11 bg-black/50 backdrop-blur-sm rounded-full flex items-center justify-center text-white hover:bg-black/70 transition border border-white/10"
                        >
                            <ChevronLeft className="w-5 h-5" />
                        </button>
                        <button
                            onClick={nextImg}
                            className="absolute right-4 top-1/2 -translate-y-1/2 w-11 h-11 bg-black/50 backdrop-blur-sm rounded-full flex items-center justify-center text-white hover:bg-black/70 transition border border-white/10"
                        >
                            <ChevronRight className="w-5 h-5" />
                        </button>
                    </>
                )}

                {/* Image counter */}
                <div className="absolute bottom-6 right-6 px-3 py-1.5 bg-black/60 backdrop-blur-sm rounded-lg text-xs text-white/80 font-bold border border-white/10">
                    {imgIndex + 1} / {car.imagens.length}
                </div>

                {/* Dots */}
                <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-1.5">
                    {car.imagens.map((_, i) => (
                        <button
                            key={i}
                            onClick={() => setImgIndex(i)}
                            className={`transition-all duration-300 rounded-full ${i === imgIndex ? 'w-6 h-2 bg-brand-400' : 'w-2 h-2 bg-white/30 hover:bg-white/60'}`}
                        />
                    ))}
                </div>
            </div>

            {/* Thumbnails strip */}
            {car.imagens.length > 1 && (
                <div className="max-w-6xl mx-auto px-4 sm:px-6 -mt-6 relative z-10">
                    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                        {car.imagens.map((url, i) => (
                            <button
                                key={i}
                                onClick={() => setImgIndex(i)}
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
                                    <h1 className="text-3xl md:text-4xl font-black text-white tracking-tight mb-1">
                                        {car.marca} {car.modelo}
                                    </h1>
                                    <p className="text-zinc-500 text-sm">{car.ano} • {formatKm(car.quilometragem)}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-xs text-zinc-600 mb-1">Preço</p>
                                    <p className="text-3xl md:text-4xl font-black text-brand-400 tracking-tight">
                                        {formatPrice(car.preco)}
                                    </p>
                                </div>
                            </div>

                            {/* Specs Grid */}
                            <div className="mb-8">
                                <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-4">Especificações</h3>
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                    {specs.map(({ icon: Icon, label, value }) => (
                                        <div
                                            key={label}
                                            className="flex items-center gap-3 p-4 bg-zinc-900 border border-white/5 rounded-xl hover:border-brand-400/20 transition-colors"
                                        >
                                            <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center flex-shrink-0">
                                                <Icon className="w-4 h-4 text-brand-400" />
                                            </div>
                                            <div>
                                                <p className="text-xs text-zinc-600">{label}</p>
                                                <p className="text-sm font-bold text-white">{value}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Description */}
                            {car.descricao && (
                                <div className="p-6 bg-zinc-900 border border-white/5 rounded-2xl">
                                    <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-3">Descrição do vendedor</h3>
                                    <p className="text-zinc-300 leading-relaxed text-sm">{car.descricao}</p>
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
                            <div className="bg-zinc-900 border border-white/8 rounded-2xl overflow-hidden">
                                {/* Header */}
                                <div className="p-6 border-b border-white/5">
                                    <div className="flex items-center gap-3 mb-4">
                                        <div className="w-12 h-12 bg-gradient-to-br from-brand-400 to-brand-600 rounded-xl flex items-center justify-center text-zinc-950 font-black text-lg">
                                            V
                                        </div>
                                        <div>
                                            <p className="font-bold text-white">Vendedor</p>
                                            <div className="flex items-center gap-1.5">
                                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                                                <p className="text-xs text-emerald-400 font-medium">Disponível</p>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 text-sm text-zinc-400">
                                        <MapPin className="w-4 h-4" />
                                        {car.cidade}
                                    </div>
                                </div>

                                {/* Price summary */}
                                <div className="p-6 border-b border-white/5">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-zinc-500 text-sm">Valor do veículo</span>
                                        <span className="text-2xl font-black text-brand-400">{formatPrice(car.preco)}</span>
                                    </div>
                                    {car.aceitaTroca && (
                                        <div className="flex items-center gap-2 mt-3 px-3 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                                            <ArrowLeftRight className="w-4 h-4 text-emerald-400" />
                                            <span className="text-xs font-bold text-emerald-400">Aceita troca</span>
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
                                        Chamar no WhatsApp
                                    </a>
                                    <a
                                        href={`tel:${car.telefone}`}
                                        className="flex items-center justify-center gap-2.5 w-full py-4 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 text-white font-bold rounded-xl transition-all"
                                    >
                                        <Phone className="w-5 h-5" />
                                        {car.telefone}
                                    </a>
                                </div>

                                {/* Safety note */}
                                <div className="px-6 pb-6">
                                    <p className="text-xs text-zinc-600 text-center">
                                        🔒 Negocie com segurança. Nunca faça pagamentos antecipados.
                                    </p>
                                </div>
                            </div>

                            {/* Share */}
                            <div className="mt-4 flex gap-3">
                                <Link
                                    to="/estoque"
                                    className="flex-1 flex items-center justify-center gap-2 py-3 bg-zinc-900 border border-white/8 text-zinc-400 hover:text-white text-sm font-bold rounded-xl transition-all hover:border-white/20"
                                >
                                    <ArrowLeft className="w-4 h-4" />
                                    Ver mais carros
                                </Link>
                            </div>
                        </motion.div>
                    </div>
                </div>
            </div>
        </div>
    );
}
