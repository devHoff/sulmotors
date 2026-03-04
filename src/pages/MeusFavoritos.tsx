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
            if (!user) {
                setLoading(false);
                return;
            }

            // Fetch liked ad IDs first
            const { data: likes, error: likesError } = await supabase
                .from('curtidas')
                .select('anuncio_id')
                .eq('user_id', user.id);

            if (likesError) {
                console.error('Error fetching likes:', likesError);
                setLoading(false);
                return;
            }

            if (!likes || likes.length === 0) {
                setFavorites([]);
                setLoading(false);
                return;
            }

            const adIds = likes.map(l => l.anuncio_id);

            // Fetch actual ad data
            const { data: ads, error: adsError } = await supabase
                .from('anuncios')
                .select('*')
                .in('id', adIds);

            if (adsError) {
                console.error('Error fetching ads:', adsError);
            } else if (ads) {
                const mappedCars: Car[] = ads.map(d => ({
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
                    impulsionado_ate: d.impulsionado_ate,
                    prioridade: d.prioridade ?? 0,
                    modelo_3d: false, // Legacy field
                    created_at: d.created_at,
                    user_id: d.user_id,
                }));
                setFavorites(mappedCars);
            }
            setLoading(false);
        };

        fetchFavorites();
    }, [user]);

    if (loading) {
        return (
            <div className="min-h-[60vh] flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-brand-600 animate-spin" />
            </div>
        );
    }

    if (!user) {
        return (
            <div className="min-h-[60vh] flex flex-col items-center justify-center">
                <Heart className="w-16 h-16 text-slate-300 mb-4" />
                <h2 className="text-xl font-bold text-slate-700">Faça login para ver seus favoritos</h2>
                <Link to="/login" className="mt-4 px-6 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition">
                    Entrar
                </Link>
            </div>
        );
    }

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
            <div className="flex items-center gap-3 mb-8">
                <div className="p-3 bg-brand-100 rounded-xl">
                    <Heart className="w-6 h-6 text-brand-600 fill-brand-600" />
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Meus Favoritos</h1>
                    <p className="text-slate-500">Veículos que você curtiu</p>
                </div>
            </div>

            {favorites.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {favorites.map((car) => (
                        <CarCard key={car.id} car={car} />
                    ))}
                </div>
            ) : (
                <div className="text-center py-20 bg-slate-50 rounded-2xl border border-slate-200">
                    <Heart className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                    <h3 className="text-lg font-bold text-slate-700">Nenhum favorito ainda</h3>
                    <p className="text-slate-500 max-w-sm mx-auto mt-2 mb-6">Explore nosso estoque e clique no coração para salvar os veículos que você gostar.</p>
                    <Link to="/estoque" className="inline-flex items-center gap-2 px-6 py-3 bg-white border border-slate-300 text-slate-700 font-semibold rounded-xl hover:bg-slate-50 transition">
                        <ArrowLeft className="w-4 h-4" />
                        Ver Estoque
                    </Link>
                </div>
            )}
        </div>
    );
}
