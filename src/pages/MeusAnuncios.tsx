import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Plus, Car, Zap, Shield, Users } from 'lucide-react';
import { toast } from '../utils/toast';
import CarCard from '../components/CarCard';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { supabase } from '../lib/supabase';
import type { Car as CarType } from '../data/mockCars';

export default function MeusAnuncios() {
    const navigate = useNavigate();
    const { user, isAdmin } = useAuth();
    const { t } = useLanguage();
    const [myCars, setMyCars]   = useState<CarType[]>([]);
    const [loading, setLoading] = useState(true);
    // Admin: filter between "all listings" and "mine only"
    const [adminFilter, setAdminFilter] = useState<'all' | 'mine'>('all');

    useEffect(() => { if (user) fetchAds(); }, [user, isAdmin, adminFilter]);

    const fetchAds = async () => {
        setLoading(true);
        try {
            let query = supabase.from('anuncios').select('*').order('created_at', { ascending: false });
            // Admin can see all listings OR filter to their own
            if (!isAdmin || adminFilter === 'mine') {
                query = query.eq('user_id', user!.id);
            }
            const { data, error } = await query;
            if (error) throw error;
            setMyCars(data || []);
        } catch {
            toast.error('Erro ao carregar anúncios');
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm(t('mads_confirm_delete'))) return;
        try {
            const { error } = await supabase.from('anuncios').delete().eq('id', id);
            if (error) throw error;
            setMyCars(prev => prev.filter(car => car.id !== id));
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

                {/* ── Header ── */}
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-10">
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                        <div>
                            {isAdmin && (
                                <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-500/15 border border-amber-500/30 rounded-full mb-3">
                                    <Shield className="w-3.5 h-3.5 text-amber-500" strokeWidth={1.5} />
                                    <span className="text-xs font-black text-amber-500 uppercase tracking-wider">Modo Admin</span>
                                </div>
                            )}
                            <p className="text-xs font-bold text-brand-500 dark:text-brand-400 uppercase tracking-widest mb-2">
                                {myCars.length} {t('mads_count')}
                            </p>
                            <h1 className="text-4xl font-black text-slate-900 dark:text-white tracking-tight">
                                {isAdmin && adminFilter === 'all' ? 'Todos os Anúncios' : t('mads_title')}
                            </h1>
                            <p className="text-slate-500 dark:text-zinc-500 mt-1 text-sm">
                                {isAdmin && adminFilter === 'all' ? 'Visão completa — todos os anúncios da plataforma' : t('mads_subtitle')}
                            </p>
                        </div>
                        <div className="flex items-center gap-3 flex-wrap">
                            {/* Admin filter toggle */}
                            {isAdmin && (
                                <div className="flex bg-zinc-900 border border-white/10 rounded-xl p-1 gap-1">
                                    <button
                                        onClick={() => setAdminFilter('all')}
                                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                            adminFilter === 'all'
                                                ? 'bg-amber-500 text-zinc-950'
                                                : 'text-zinc-400 hover:text-white'
                                        }`}
                                    >
                                        <Users className="w-3.5 h-3.5" strokeWidth={1.5} />
                                        Todos
                                    </button>
                                    <button
                                        onClick={() => setAdminFilter('mine')}
                                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                            adminFilter === 'mine'
                                                ? 'bg-brand-400 text-zinc-950'
                                                : 'text-zinc-400 hover:text-white'
                                        }`}
                                    >
                                        <Car className="w-3.5 h-3.5" strokeWidth={1.5} />
                                        Meus
                                    </button>
                                </div>
                            )}
                            <button
                                onClick={() => navigate('/anunciar')}
                                className="flex items-center gap-2 px-5 py-3 bg-brand-400 hover:bg-brand-300 text-zinc-950 text-sm font-black rounded-xl transition-all hover:shadow-glow"
                            >
                                <Plus className="w-4 h-4" strokeWidth={1.5} />
                                {t('mads_new')}
                            </button>
                        </div>
                    </div>
                </motion.div>

                {/* ── Listings grid ── */}
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
                        <h3 className="text-xl font-black text-slate-900 dark:text-white mb-2">{t('mads_empty_title')}</h3>
                        <p className="text-slate-500 dark:text-zinc-500 text-sm mb-8">{t('mads_empty_sub')}</p>
                        <button
                            onClick={() => navigate('/anunciar')}
                            className="flex items-center gap-2 px-6 py-3 bg-brand-400 hover:bg-brand-300 text-zinc-950 font-black rounded-xl transition-all"
                        >
                            <Zap className="w-4 h-4" strokeWidth={1.5} />
                            {t('mads_empty_btn')}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
