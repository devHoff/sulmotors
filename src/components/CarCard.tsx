import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Heart, MapPin, Gauge, Calendar, Fuel, ArrowUpRight } from 'lucide-react';
import { motion } from 'framer-motion';
import type { Car } from '../data/mockCars';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface CarCardProps {
    car: Car;
    showActions?: boolean;
    onEdit?: (id: string) => void;
    onDelete?: (id: string) => void;
    onBoost?: (id: string) => void;
}

export default function CarCard({ car, showActions, onEdit, onDelete, onBoost }: CarCardProps) {
    const { user } = useAuth();
    const [liked, setLiked] = useState(false);
    const [likeCount, setLikeCount] = useState(0);
    const [isProcessing, setIsProcessing] = useState(false);

    const formatPrice = (price: number) =>
        new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0 }).format(price);

    const formatKm = (km: number) =>
        km === 0 ? '0 km' : `${new Intl.NumberFormat('pt-BR').format(km)} km`;

    const badge = car.quilometragem === 0
        ? { label: '0 KM', color: 'bg-emerald-500/90 text-white' }
        : car.destaque
            ? { label: 'DESTAQUE', color: 'bg-amber-500/90 text-black' }
            : car.impulsionado
                ? { label: 'IMPULSIONADO', color: 'bg-brand-400/90 text-zinc-950' }
                : null;

    useEffect(() => {
        const fetchLikes = async () => {
            const { count } = await supabase
                .from('curtidas')
                .select('*', { count: 'exact', head: true })
                .eq('anuncio_id', car.id);
            setLikeCount(count ?? 0);

            if (user) {
                const { data } = await supabase
                    .from('curtidas')
                    .select('id')
                    .eq('anuncio_id', car.id)
                    .eq('user_id', user.id)
                    .maybeSingle();
                setLiked(!!data);
            }
        };
        fetchLikes();
    }, [car.id, user]);

    const toggleLike = async (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (!user || isProcessing) return;
        setIsProcessing(true);

        try {
            if (liked) {
                setLiked(false);
                setLikeCount(c => Math.max(0, c - 1));
                await supabase.from('curtidas').delete().eq('anuncio_id', car.id).eq('user_id', user.id);
            } else {
                setLiked(true);
                setLikeCount(c => c + 1);
                await supabase.from('curtidas').insert({ anuncio_id: car.id, user_id: user.id });
            }
        } catch (error) {
            setLiked(!liked);
            setLikeCount(c => liked ? c + 1 : c - 1);
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            whileHover={{ y: -4 }}
            transition={{ duration: 0.25 }}
            className="group relative bg-zinc-900 border border-white/8 rounded-2xl overflow-hidden hover:border-brand-400/30 transition-all duration-300 hover:shadow-[0_8px_40px_rgba(0,212,255,0.12)]"
        >
            <Link to={`/carro/${car.id}`} className="block">
                {/* Image */}
                <div className="relative aspect-[16/10] overflow-hidden bg-zinc-800">
                    <img
                        src={car.imagens[0] || 'https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?w=800&q=80'}
                        alt={`${car.marca} ${car.modelo}`}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                    />

                    {/* Dark overlay gradient */}
                    <div className="absolute inset-0 bg-gradient-to-t from-zinc-900/60 via-transparent to-transparent" />

                    {badge && (
                        <span className={`absolute top-3 left-3 ${badge.color} text-xs font-black px-2.5 py-1 rounded-lg backdrop-blur-sm tracking-wider`}>
                            {badge.label}
                        </span>
                    )}

                    {/* Image count */}
                    {car.imagens.length > 1 && (
                        <div className="absolute bottom-3 right-3 px-2 py-1 bg-black/60 backdrop-blur-sm rounded-lg text-xs text-white/70 font-medium">
                            {car.imagens.length} fotos
                        </div>
                    )}
                </div>
            </Link>

            {/* Like button */}
            <button
                className={`absolute top-3 right-3 w-9 h-9 rounded-full flex items-center justify-center backdrop-blur-sm transition-all ${
                    liked
                        ? 'bg-red-500/20 border border-red-500/40 text-red-400'
                        : 'bg-black/40 border border-white/10 text-white/60 hover:text-red-400 hover:bg-red-500/10 hover:border-red-400/30'
                }`}
                onClick={toggleLike}
            >
                <Heart className={`w-4 h-4 transition-all ${liked ? 'fill-red-400' : ''}`} />
            </button>

            {/* Info */}
            <div className="p-5">
                <Link to={`/carro/${car.id}`}>
                    <div className="flex items-start justify-between gap-2 mb-3">
                        <div className="flex-1 min-w-0">
                            <h3 className="font-bold text-white text-base leading-tight truncate group-hover:text-brand-400 transition-colors">
                                {car.marca} {car.modelo}
                            </h3>
                            <p className="text-zinc-500 text-xs mt-0.5 truncate">{car.descricao || `${car.combustivel} • ${car.cambio}`}</p>
                        </div>
                        <ArrowUpRight className="w-4 h-4 text-zinc-600 group-hover:text-brand-400 transition-colors flex-shrink-0 mt-0.5" />
                    </div>

                    {/* Stats row */}
                    <div className="flex items-center gap-3 mb-4">
                        <div className="flex items-center gap-1 text-xs text-zinc-500">
                            <Gauge className="w-3 h-3" />
                            <span>{formatKm(car.quilometragem)}</span>
                        </div>
                        <div className="w-px h-3 bg-zinc-700" />
                        <div className="flex items-center gap-1 text-xs text-zinc-500">
                            <Calendar className="w-3 h-3" />
                            <span>{car.ano}</span>
                        </div>
                        <div className="w-px h-3 bg-zinc-700" />
                        <div className="flex items-center gap-1 text-xs text-zinc-500">
                            <Fuel className="w-3 h-3" />
                            <span className="truncate">{car.combustivel}</span>
                        </div>
                    </div>

                    {/* Price */}
                    <div className="flex items-end justify-between">
                        <div>
                            <p className="text-xs text-zinc-600 mb-0.5">Preço</p>
                            <p className="text-xl font-black text-brand-400 tracking-tight">
                                {formatPrice(car.preco)}
                            </p>
                        </div>
                        <div className="flex items-center gap-1 text-xs text-zinc-600">
                            <MapPin className="w-3 h-3" />
                            <span className="truncate max-w-[80px]">{car.cidade}</span>
                        </div>
                    </div>
                </Link>

                {/* Action buttons for MeusAnuncios */}
                {showActions && (
                    <div className="flex gap-2 mt-4 pt-4 border-t border-white/5">
                        <button
                            onClick={() => onEdit?.(car.id)}
                            className="flex-1 py-2 text-xs font-bold text-zinc-300 bg-white/5 hover:bg-white/10 rounded-lg transition-colors border border-white/10"
                        >
                            Editar
                        </button>
                        <button
                            onClick={() => onDelete?.(car.id)}
                            className="flex-1 py-2 text-xs font-bold text-red-400 bg-red-500/10 hover:bg-red-500/20 rounded-lg transition-colors border border-red-500/20"
                        >
                            Excluir
                        </button>
                        <button
                            onClick={() => onBoost?.(car.id)}
                            className="flex-1 py-2 text-xs font-bold text-zinc-950 bg-brand-400 hover:bg-brand-300 rounded-lg transition-colors"
                        >
                            Impulsionar
                        </button>
                    </div>
                )}
            </div>
        </motion.div>
    );
}
