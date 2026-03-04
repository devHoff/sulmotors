import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
    ChevronLeft, ChevronRight, ArrowLeft, Phone, MessageCircle,
    Calendar, Gauge, Fuel, Settings2, Palette, MapPin, ArrowLeftRight, Loader2, Heart
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

    useEffect(() => {
        async function fetchCar() {
            if (!id) return;
            // 1. Fetch ONLY from Supabase
            try {
                const { data, error } = await supabase
                    .from('anuncios')
                    .select('*')
                    .eq('id', id)
                    .single();

                if (error) throw error;

                if (data) {
                    const mappedCar: Car = {
                        ...data,
                        aceitaTroca: data.aceita_troca,
                        modelo_3d: data.modelo_3d,
                        imagens: data.imagens || [],
                    };
                    setCar(mappedCar);

                    // Check like status
                    if (user) {
                        const { data: likeData } = await supabase
                            .from('curtidas')
                            .select('id')
                            .eq('anuncio_id', id)
                            .eq('user_id', user.id)
                            .maybeSingle();
                        setLiked(!!likeData);
                    }
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
        } else {
            await supabase.from('curtidas').insert({ anuncio_id: car.id, user_id: user.id });
            setLiked(true);
        }
    };

    if (loading) {
        return (
            <div className="min-h-[60vh] flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-brand-600" />
            </div>
        );
    }

    if (!car) {
        return (
            <div className="min-h-[60vh] flex flex-col items-center justify-center">
                <p className="text-xl text-slate-500 mb-4">Carro não encontrado.</p>
                <Link to="/estoque" className="text-brand-600 font-bold hover:underline">Voltar para o estoque</Link>
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
        { icon: Calendar, label: 'Ano', value: car.ano },
        { icon: Gauge, label: 'Quilometragem', value: formatKm(car.quilometragem) },
        { icon: Fuel, label: 'Combustível', value: car.combustivel },
        { icon: Settings2, label: 'Câmbio', value: car.cambio },
        { icon: Palette, label: 'Cor', value: car.cor },
        { icon: MapPin, label: 'Cidade', value: car.cidade },
        { icon: ArrowLeftRight, label: 'Aceita troca', value: car.aceitaTroca ? 'Sim' : 'Não' },
    ];

    return (
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="flex justify-between items-center mb-6">
                <Link to="/estoque" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-brand-600 transition-colors">
                    <ArrowLeft className="w-4 h-4" />
                    Voltar ao estoque
                </Link>
                {/* Like Button on Details Page */}
                {user && (
                    <button
                        onClick={toggleLike}
                        className={`p-2 rounded-full border transition-colors ${liked ? 'bg-red-50 border-red-200 text-red-500' : 'bg-white border-slate-200 text-slate-400 hover:text-red-500'}`}
                    >
                        <Heart className={`w-5 h-5 ${liked ? 'fill-red-500' : ''}`} />
                    </button>
                )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
                {/* Left — Image Gallery */}
                <div className="lg:col-span-3">
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="relative aspect-[16/10] rounded-2xl overflow-hidden bg-slate-100">
                        <img src={car.imagens[imgIndex] || 'https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?w=800&q=80'} alt="" className="w-full h-full object-cover" />
                        {car.imagens.length > 1 && (
                            <>
                                <button onClick={prevImg} className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/80 backdrop-blur-sm rounded-full flex items-center justify-center hover:bg-white transition">
                                    <ChevronLeft className="w-5 h-5 text-slate-700" />
                                </button>
                                <button onClick={nextImg} className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/80 backdrop-blur-sm rounded-full flex items-center justify-center hover:bg-white transition">
                                    <ChevronRight className="w-5 h-5 text-slate-700" />
                                </button>
                            </>
                        )}
                        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                            {car.imagens.map((_, i) => (
                                <button key={i} onClick={() => setImgIndex(i)} className={`w-2 h-2 rounded-full transition-all ${i === imgIndex ? 'bg-white w-5' : 'bg-white/50'}`} />
                            ))}
                        </div>
                    </motion.div>

                    {/* Thumbnails */}
                    <div className="flex gap-3 mt-4">
                        {car.imagens.map((url, i) => (
                            <button key={i} onClick={() => setImgIndex(i)} className={`w-20 h-14 rounded-xl overflow-hidden border-2 transition-all ${i === imgIndex ? 'border-brand-500' : 'border-transparent opacity-60 hover:opacity-100'}`}>
                                <img src={url} alt="" className="w-full h-full object-cover" />
                            </button>
                        ))}
                    </div>
                </div>

                {/* Right — Info */}
                <div className="lg:col-span-2">
                    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
                        <h1 className="text-2xl md:text-3xl font-bold text-slate-900 mb-1">
                            {car.marca} {car.modelo}
                        </h1>
                        <p className="text-4xl font-extrabold text-brand-600 mt-4 mb-6">
                            {formatPrice(car.preco)}
                        </p>

                        {/* Specs Grid */}
                        <div className="grid grid-cols-2 gap-4 mb-8">
                            {specs.map(({ icon: Icon, label, value }) => (
                                <div key={label} className="flex items-start gap-3 p-3 bg-slate-50 rounded-xl">
                                    <Icon className="w-5 h-5 text-brand-500 mt-0.5 flex-shrink-0" />
                                    <div>
                                        <p className="text-xs text-slate-400">{label}</p>
                                        <p className="text-sm font-semibold text-slate-700">{value}</p>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Description */}
                        <div className="mb-8">
                            <h3 className="font-bold text-slate-900 mb-2">Descrição</h3>
                            <p className="text-sm text-slate-600 leading-relaxed">{car.descricao}</p>
                        </div>

                        {/* Contact */}
                        <div className="space-y-3">
                            <a
                                href={`tel:${car.telefone}`}
                                className="flex items-center justify-center gap-2 w-full py-4 bg-brand-600 text-white font-bold rounded-xl hover:bg-brand-700 transition-all hover:shadow-lg"
                            >
                                <Phone className="w-5 h-5" />
                                Ligar: {car.telefone}
                            </a>
                            <a
                                href={`https://wa.me/55${car.telefone.replace(/\D/g, '')}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center justify-center gap-2 w-full py-4 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 transition-all hover:shadow-lg"
                            >
                                <MessageCircle className="w-5 h-5" />
                                WhatsApp
                            </a>
                        </div>
                    </motion.div>
                </div>
            </div>
        </div>
    );
}
