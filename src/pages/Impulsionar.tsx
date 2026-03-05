import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Eye, Users, Zap, Rocket, ArrowLeft, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import type { Car } from '../data/mockCars';

const periods = [
    { label: '1 semana', days: 7, price: 19.90, perDay: 2.84 },
    { label: '2 semanas', days: 14, price: 34.90, perDay: 2.49 },
    { label: '1 mês', days: 30, price: 59.90, perDay: 2.00, savings: 30 },
    { label: '3 meses', days: 90, price: 149.90, perDay: 1.67, savings: 40 },
    { label: '6 meses', days: 180, price: 269.90, perDay: 1.50, savings: 47 },
    { label: '1 ano', days: 365, price: 479.90, perDay: 1.32, savings: 53 },
];

export default function Impulsionar() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();
    const [car, setCar] = useState<Car | null>(null);
    const [loading, setLoading] = useState(true);
    const [boosting, setBoosting] = useState(false);
    const [selectedPeriod, setSelectedPeriod] = useState(2);

    const fmt = (p: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(p);

    useEffect(() => {
        const fetchCar = async () => {
            if (!id) return;
            const { data, error } = await supabase.from('anuncios').select('*').eq('id', id).single();
            if (error || !data) { toast.error('Anúncio não encontrado.'); navigate('/meus-anuncios'); return; }
            if (data.user_id !== user?.id) { toast.error('Sem permissão.'); navigate('/meus-anuncios'); return; }
            setCar({ ...data, aceitaTroca: data.aceita_troca, modelo_3d: false, imagens: data.imagens || [] });
            setLoading(false);
        };
        fetchCar();
    }, [id, user, navigate]);

    const handleBoost = async () => {
        if (!id || !user) return;
        setBoosting(true);
        const period = periods[selectedPeriod];
        const until = new Date();
        until.setDate(until.getDate() + period.days);
        const { error } = await supabase.from('anuncios').update({ impulsionado: true, destaque: true, impulsionado_ate: until.toISOString(), prioridade: 5 }).eq('id', id).eq('user_id', user.id);
        if (error) { toast.error('Erro ao impulsionar.'); } else { toast.success(`Impulsionado por ${period.label}!`); navigate('/meus-anuncios'); }
        setBoosting(false);
    };

    if (loading || !car) {
        return (
            <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
                <div className="w-12 h-12 rounded-full border-2 border-brand-400/20 border-t-brand-400 animate-spin" />
            </div>
        );
    }

    const period = periods[selectedPeriod];

    return (
        <div className="bg-zinc-950 min-h-screen py-12">
            <div className="max-w-xl mx-auto px-4">
                {/* Header */}
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-10">
                    <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-brand-400/10 border border-brand-400/30 rounded-full mb-4">
                        <Rocket className="w-3.5 h-3.5 text-brand-400" />
                        <span className="text-xs font-bold text-brand-400 uppercase tracking-widest">Impulsionar Anúncio</span>
                    </div>
                    <h1 className="text-3xl md:text-4xl font-black text-white mb-3 tracking-tight">Destaque seu carro</h1>
                    <p className="text-zinc-400 text-sm">
                        Anúncios impulsionados aparecem <span className="text-brand-400 font-bold">primeiro</span> para todos os compradores
                    </p>
                </motion.div>

                {/* Car Preview */}
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
                    className="flex items-center gap-4 p-4 bg-zinc-900 border border-white/8 rounded-2xl mb-6">
                    {car.imagens[0] && <img src={car.imagens[0]} alt="" className="w-20 h-14 object-cover rounded-xl flex-shrink-0" />}
                    <div>
                        <h3 className="text-white font-bold">{car.marca} {car.modelo} {car.ano}</h3>
                        <p className="text-brand-400 font-black text-lg">{fmt(car.preco)}</p>
                    </div>
                </motion.div>

                {/* Benefits */}
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
                    className="grid grid-cols-3 gap-3 mb-6">
                    {[
                        { icon: Eye, title: '10x mais views', desc: 'Apareça primeiro' },
                        { icon: Users, title: 'Mais contatos', desc: 'Venda mais rápido' },
                        { icon: Zap, title: 'Imediato', desc: 'Ativo na hora' },
                    ].map(({ icon: Icon, title, desc }) => (
                        <div key={title} className="text-center p-4 bg-zinc-900 border border-brand-400/15 rounded-2xl">
                            <Icon className="w-6 h-6 text-brand-400 mx-auto mb-2" />
                            <h4 className="text-white text-xs font-bold">{title}</h4>
                            <p className="text-zinc-500 text-xs mt-0.5">{desc}</p>
                        </div>
                    ))}
                </motion.div>

                {/* Period Selector */}
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
                    className="bg-zinc-900 border border-white/8 rounded-2xl p-6 mb-6">
                    <h3 className="text-center font-black text-white text-lg mb-1">Escolha o período</h3>
                    <p className="text-center text-zinc-500 text-xs mb-6">Deslize para selecionar</p>

                    <input type="range" min={0} max={periods.length - 1} value={selectedPeriod}
                        onChange={(e) => setSelectedPeriod(Number(e.target.value))} className="w-full mb-3" />
                    <div className="flex justify-between text-xs mb-6">
                        {periods.map((p, i) => (
                            <span key={i} className={selectedPeriod === i ? 'text-brand-400 font-bold' : 'text-zinc-600'}>{p.label}</span>
                        ))}
                    </div>

                    {/* Price */}
                    <div className="text-center p-6 bg-brand-400/8 border border-brand-400/20 rounded-xl">
                        <div className="flex items-center justify-center gap-1.5 text-brand-400 text-xs font-bold mb-2">
                            <Rocket className="w-3.5 h-3.5" />
                            {period.label}
                        </div>
                        <p className="text-4xl font-black text-white">{fmt(period.price)}</p>
                        <p className="text-zinc-500 text-sm mt-1">{fmt(period.perDay)}/dia</p>
                        {period.savings && (
                            <span className="inline-block mt-3 px-3 py-1 bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-bold rounded-full">
                                Economia de {period.savings}% por dia
                            </span>
                        )}
                    </div>

                    <button onClick={handleBoost} disabled={boosting}
                        className="w-full mt-5 flex items-center justify-center gap-2.5 py-4 bg-brand-400 hover:bg-brand-300 text-zinc-950 font-black rounded-xl transition-all hover:shadow-glow active:scale-[0.98] disabled:opacity-60">
                        {boosting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Rocket className="w-5 h-5" />}
                        {boosting ? 'Impulsionando...' : `Impulsionar por ${fmt(period.price)}`}
                    </button>
                    <p className="text-center text-xs text-zinc-600 mt-3">Destaque ativado imediatamente após a confirmação.</p>
                </motion.div>

                <div className="text-center">
                    <Link to="/meus-anuncios" className="inline-flex items-center gap-1.5 text-zinc-500 hover:text-white text-sm transition-colors">
                        <ArrowLeft className="w-4 h-4" />
                        Voltar para Meus Anúncios
                    </Link>
                </div>
            </div>
        </div>
    );
}
