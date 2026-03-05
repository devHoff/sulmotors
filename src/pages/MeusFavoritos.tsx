import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Heart, Loader2, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import CarCard from '../components/CarCard';
import type { Car } from '../data/mockCars';

export default function MeusFavoritos() {
    const { user } = useAuth();
    const [favorites, setFavorites] = useState<Car[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchFavorites = async () => {
            if (!user) { setLoading(false); return; }
            const { data: likes } = await supabase.from('curtidas').select('anuncio_id').eq('user_id', user.id);
            if (!likes || likes.length === 0) { setFavorites([]); setLoading(false); return; }
            const { data: ads } = await supabase.from('anuncios').select('*').in('id', likes.map(l => l.anuncio_id));
            if (ads) {
                setFavorites(ads.map(d => ({
                    id: d.id, marca: d.marca, modelo: d.modelo, ano: d.ano,
                    preco: Number(d.preco), quilometragem: d.quilometragem,
                    telefone: d.telefone, descricao: d.descricao || '',
                    combustivel: d.combustivel, cambio: d.cambio, cor: d.cor,
                    cidade: d.cidade, aceitaTroca: d.aceita_troca ?? false,
                    imagens: d.imagens || [], destaque: d.destaque ?? false,
                    impulsionado: d.impulsionado ?? false,
                    impulsionado_ate: d.impulsionado_ate,
                    prioridade: d.prioridade ?? 0, modelo_3d: false,
                    created_at: d.created_at, user_id: d.user_id,
                })));
            }
            setLoading(false);
        };
        fetchFavorites();
    }, [user]);

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 flex items-center justify-center">
                <div className="w-12 h-12 rounded-full border-2 border-brand-400/20 border-t-brand-400 animate-spin" />
            </div>
        );
    }

    if (!user) {
        return (
            <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 flex flex-col items-center justify-center">
                <Heart className="w-16 h-16 text-slate-300 dark:text-zinc-700 mb-4" />
                <h2 className="text-xl font-black text-slate-900 dark:text-white mb-2">Faça login para ver seus favoritos</h2>
                <Link to="/login" className="mt-4 px-6 py-3 bg-brand-400 text-zinc-950 font-black rounded-xl hover:bg-brand-300 transition">
                    Entrar
                </Link>
            </div>
        );
    }

    return (
        <div className="bg-slate-50 dark:bg-zinc-950 min-h-screen py-10 transition-colors duration-300">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-4 mb-10">
                    <div className="w-12 h-12 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center justify-center">
                        <Heart className="w-6 h-6 text-red-400 fill-red-400" />
                    </div>
                    <div>
                        <p className="text-xs font-bold text-brand-500 dark:text-brand-400 uppercase tracking-widest mb-1">{favorites.length} favoritos</p>
                        <h1 className="text-4xl font-black text-slate-900 dark:text-white tracking-tight">Meus Favoritos</h1>
                    </div>
                </motion.div>

                {favorites.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                        {favorites.map((car) => <CarCard key={car.id} car={car} />)}
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center py-32 bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-white/5 shadow-sm dark:shadow-none">
                        <Heart className="w-16 h-16 text-slate-300 dark:text-zinc-700 mb-5" />
                        <h3 className="text-xl font-black text-slate-900 dark:text-white mb-2">Nenhum favorito ainda</h3>
                        <p className="text-slate-500 dark:text-zinc-500 text-sm max-w-sm text-center mb-8">
                            Explore nosso estoque e clique no coração para salvar os veículos que você gostar.
                        </p>
                        <Link
                            to="/estoque"
                            className="inline-flex items-center gap-2 px-6 py-3 bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-white font-bold rounded-xl hover:bg-slate-200 dark:hover:bg-white/10 transition"
                        >
                            <ArrowLeft className="w-4 h-4" />
                            Ver Estoque
                        </Link>
                    </div>
                )}
            </div>
        </div>
    );
}
