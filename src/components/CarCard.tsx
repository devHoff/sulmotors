import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Heart, MapPin, Gauge, Calendar } from 'lucide-react';
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

    const formatPrice = (price: number) =>
        new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0 }).format(price);

    const formatKm = (km: number) =>
        km === 0 ? '0 km' : `${new Intl.NumberFormat('pt-BR').format(km)} km`;

    const badge = car.quilometragem === 0
        ? { label: '0 KM', color: 'bg-emerald-500' }
        : car.destaque
            ? { label: 'DESTAQUE', color: 'bg-amber-500' }
            : car.impulsionado
                ? { label: 'IMPULSIONADO', color: 'bg-brand-600' }
                : null;

    const [isProcessing, setIsProcessing] = useState(false);

    useEffect(() => {
        // Fetch like count
        const fetchLikes = async () => {
            const { count } = await supabase
                .from('curtidas')
                .select('*', { count: 'exact', head: true })
                .eq('anuncio_id', car.id);
            setLikeCount(count ?? 0);

            // Check if current user liked this car
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

        if (!user) {
            // Could redirect to login, but for now just skip
            return;
        }

        if (isProcessing) return; // Prevent spam
        setIsProcessing(true);

        try {
            if (liked) {
                // Optimistic update
                setLiked(false);
                setLikeCount(c => Math.max(0, c - 1));

                await supabase
                    .from('curtidas')
                    .delete()
                    .eq('anuncio_id', car.id)
                    .eq('user_id', user.id);
            } else {
                // Optimistic update
                setLiked(true);
                setLikeCount(c => c + 1);

                await supabase
                    .from('curtidas')
                    .insert({ anuncio_id: car.id, user_id: user.id });
            }
        } catch (error) {
            // Revert changes on error
            console.error("Erro ao curtir:", error);
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
            transition={{ duration: 0.3 }}
            className="bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-xl border border-slate-100 transition-shadow group"
        >
            <Link to={`/carro/${car.id}`} className="block">
                {/* Image */}
                <div className="relative aspect-[16/10] overflow-hidden">
                    <img
                        src={car.imagens[0] || 'https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?w=800&q=80'}
                        alt={`${car.marca} ${car.modelo}`}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    {badge && (
                        <span className={`absolute top-3 left-3 ${badge.color} text-white text-xs font-bold px-3 py-1 rounded-lg`}>
                            {badge.label}
                        </span>
                    )}
                    <button
                        className="absolute top-3 right-3 w-9 h-9 bg-white/80 backdrop-blur-sm rounded-full flex items-center justify-center hover:bg-white transition-colors"
                        onClick={toggleLike}
                    >
                        <Heart
                            className={`w-4 h-4 transition-colors ${liked ? 'text-red-500 fill-red-500' : 'text-slate-500 hover:text-red-500'}`}
                        />
                    </button>
                </div>
            </Link>

            {/* Info */}
            <div className="p-5">
                <Link to={`/carro/${car.id}`}>
                    <h3 className="font-bold text-slate-900 text-lg leading-tight group-hover:text-brand-600 transition-colors">
                        {car.marca} {car.modelo}
                    </h3>
                    {car.descricao && (
                        <p className="text-slate-500 text-sm mt-1 line-clamp-1">{car.descricao}</p>
                    )}

                    <div className="flex items-center gap-4 mt-3 text-xs text-slate-400">
                        <span className="flex items-center gap-1">
                            <Gauge className="w-3.5 h-3.5" />
                            {formatKm(car.quilometragem)}
                        </span>
                        <span className="flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5" />
                            {car.ano}
                        </span>
                        {likeCount > 0 && (
                            <span className="flex items-center gap-1 text-red-400">
                                <Heart className="w-3.5 h-3.5 fill-red-400" />
                                {likeCount}
                            </span>
                        )}
                    </div>

                    <p className="text-brand-600 font-extrabold text-xl mt-3">
                        {formatPrice(car.preco)}
                    </p>

                    <div className="flex items-center gap-1 mt-2 text-xs text-slate-400">
                        <MapPin className="w-3.5 h-3.5" />
                        {car.cidade}
                    </div>
                </Link>

                {/* Action buttons for MeusAnuncios */}
                {showActions && (
                    <div className="flex gap-2 mt-4 pt-4 border-t border-slate-100">
                        <button
                            onClick={() => onEdit?.(car.id)}
                            className="flex-1 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                        >
                            Editar
                        </button>
                        <button
                            onClick={() => onDelete?.(car.id)}
                            className="flex-1 py-2 text-xs font-semibold text-white bg-red-500 hover:bg-red-600 rounded-lg transition-colors"
                        >
                            Excluir
                        </button>
                        <button
                            onClick={() => onBoost?.(car.id)}
                            className="flex-1 py-2 text-xs font-semibold text-white bg-brand-600 hover:bg-brand-700 rounded-lg transition-colors"
                        >
                            Impulsionar
                        </button>
                    </div>
                )}
            </div>
        </motion.div>
    );
}
