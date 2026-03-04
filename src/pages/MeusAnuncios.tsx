import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Plus, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import CarCard from '../components/CarCard';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import type { Car } from '../data/mockCars';

export default function MeusAnuncios() {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [myCars, setMyCars] = useState<Car[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (user) {
            fetchMyAds();
        }
    }, [user]);

    const fetchMyAds = async () => {
        try {
            const { data, error } = await supabase
                .from('anuncios')
                .select('*')
                .eq('user_id', user!.id)
                .order('created_at', { ascending: false });

            if (error) throw error;
            setMyCars(data || []);
        } catch (error) {
            console.error('Error fetching ads:', error);
            toast.error('Erro ao carregar seus anúncios');
        } finally {
            setLoading(false);
        }
    };

    const handleEdit = (id: string) => {
        navigate(`/editar/${id}`);
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Tem certeza que deseja excluir este anúncio?')) return;

        try {
            const { error } = await supabase
                .from('anuncios')
                .delete()
                .eq('id', id);

            if (error) throw error;

            setMyCars(myCars.filter(car => car.id !== id));
            toast.success('Anúncio excluído com sucesso!');
        } catch (error) {
            console.error('Error deleting ad:', error);
            toast.error('Erro ao excluir anúncio');
        }
    };

    const handleBoost = (id: string) => {
        navigate(`/impulsionar/${id}`);
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center h-[60vh]">
                <Loader2 className="w-8 h-8 animate-spin text-brand-600" />
            </div>
        );
    }

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center justify-between mb-8"
            >
                <div>
                    <h1 className="text-3xl font-bold text-slate-900">Meus Anúncios</h1>
                    <p className="text-slate-500 mt-1">Gerencie seus anúncios de carros</p>
                </div>
                <button
                    onClick={() => navigate('/anunciar')}
                    className="flex items-center gap-2 px-5 py-3 bg-brand-600 text-white text-sm font-semibold rounded-xl hover:bg-brand-700 transition-all hover:shadow-lg hover:shadow-brand-600/25"
                >
                    <Plus className="w-4 h-4" />
                    Novo Anúncio
                </button>
            </motion.div>

            {myCars.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {myCars.map((car) => (
                        <CarCard
                            key={car.id}
                            car={car}
                            showActions
                            onEdit={() => handleEdit(car.id)}
                            onDelete={() => handleDelete(car.id)}
                            onBoost={() => handleBoost(car.id)}
                        />
                    ))}
                </div>
            ) : (
                <div className="text-center py-20">
                    <p className="text-xl font-semibold text-slate-700">Você ainda não tem anúncios</p>
                    <p className="text-slate-400 mt-2 mb-6">Comece anunciando seu primeiro carro!</p>
                    <button
                        onClick={() => navigate('/anunciar')}
                        className="px-8 py-3 bg-brand-600 text-white font-semibold rounded-xl hover:bg-brand-700 transition-colors"
                    >
                        Anunciar Carro
                    </button>
                </div>
            )}
        </div>
    );
}
