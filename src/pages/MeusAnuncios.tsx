import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Plus, Car, Zap } from 'lucide-react';
import { toast } from 'sonner';
import CarCard from '../components/CarCard';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { supabase } from '../lib/supabase';
import type { Car as CarType } from '../data/mockCars';

export default function MeusAnuncios() {
    const navigate = useNavigate();
    const { user } = useAuth();
    const { t } = useLanguage();
    const [myCars, setMyCars] = useState<CarType[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => { if (user) fetchMyAds(); }, [user]);

    const fetchMyAds = async () => {
        try {
            const { data, error } = await supabase
                .from('anuncios').select('*').eq('user_id', user!.id).order('created_at', { ascending: false });
            if (error) throw error;
            setMyCars(data || []);
        } catch {
            toast.error('Erro ao carregar seus anúncios');
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm(t.mads_confirm_delete)) return;
        try {
            const { error } = await supabase.from('anuncios').delete().eq('id', id);
            if (error) throw error;
            setMyCars(myCars.filter(car => car.id !== id));
            toast.success('Anúncio excluído com sucesso!');
        } catch {
            toast.error('Erro ao excluir anúncio');
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 flex items-center justify-center">
                <div className="w-12 h-12 rounded-full border-2 border-brand-400/20 border-t-brand-400 animate-spin" />
            </div>
        );
    }

    return (
        <div className="bg-slate-50 dark:bg-zinc-950 min-h-screen py-10 transition-colors duration-300">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between mb-10">
                    <div>
                        <p className="text-xs font-bold text-brand-500 dark:text-brand-400 uppercase tracking-widest mb-2">{myCars.length} {t.mads_count}</p>
                        <h1 className="text-4xl font-black text-slate-900 dark:text-white tracking-tight">{t.mads_title}</h1>
                        <p className="text-slate-500 dark:text-zinc-500 mt-1 text-sm">{t.mads_subtitle}</p>
                    </div>
                    <button
                        onClick={() => navigate('/anunciar')}
                        className="flex items-center gap-2 px-5 py-3 bg-brand-400 hover:bg-brand-300 text-zinc-950 text-sm font-black rounded-xl transition-all hover:shadow-glow"
                    >
                        <Plus className="w-4 h-4" strokeWidth={1.5} />
                        {t.mads_new}
                    </button>
                </motion.div>

                {myCars.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                        {myCars.map((car) => (
                            <CarCard
                                key={car.id} car={car} showActions
                                onEdit={() => navigate(`/editar/${car.id}`)}
                                onDelete={() => handleDelete(car.id)}
                                onBoost={() => navigate(`/impulsionar/${car.id}`)}
                            />
                        ))}
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center py-32 bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-white/5 shadow-sm dark:shadow-none">
                        <Car className="w-16 h-16 text-slate-300 dark:text-zinc-700 mb-5" strokeWidth={1.5} />
                        <h3 className="text-xl font-black text-slate-900 dark:text-white mb-2">{t.mads_empty_title}</h3>
                        <p className="text-slate-500 dark:text-zinc-500 text-sm mb-8">{t.mads_empty_sub}</p>
                        <button
                            onClick={() => navigate('/anunciar')}
                            className="flex items-center gap-2 px-6 py-3 bg-brand-400 hover:bg-brand-300 text-zinc-950 font-black rounded-xl transition-all"
                        >
                            <Zap className="w-4 h-4" strokeWidth={1.5} />
                            {t.mads_empty_btn}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
