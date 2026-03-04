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
    const [selectedPeriod, setSelectedPeriod] = useState(2); // default 1 mês

    const formatPrice = (price: number) =>
        new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(price);

    useEffect(() => {
        const fetchCar = async () => {
            if (!id) return;
            const { data, error } = await supabase
                .from('anuncios')
                .select('*')
                .eq('id', id)
                .single();

            if (error || !data) {
                toast.error('Anúncio não encontrado.');
                navigate('/meus-anuncios');
                return;
            }

            if (data.user_id !== user?.id) {
                toast.error('Você não tem permissão para impulsionar este anúncio.');
                navigate('/meus-anuncios');
                return;
            }

            setCar({
                id: data.id,
                marca: data.marca,
                modelo: data.modelo,
                ano: data.ano,
                preco: Number(data.preco),
                quilometragem: data.quilometragem,
                telefone: data.telefone,
                descricao: data.descricao || '',
                combustivel: data.combustivel,
                cambio: data.cambio,
                cor: data.cor,
                cidade: data.cidade,
                aceitaTroca: data.aceita_troca ?? false,
                imagens: data.imagens || [],
                destaque: data.destaque ?? false,
                impulsionado: data.impulsionado ?? false,
                impulsionado_ate: data.impulsionado_ate || undefined,
                prioridade: data.prioridade ?? 0,
                modelo_3d: false,
                created_at: data.created_at,
                user_id: data.user_id,
            });
            setLoading(false);
        };
        fetchCar();
    }, [id, user, navigate]);

    const handleBoost = async () => {
        if (!id || !user) return;
        setBoosting(true);

        const period = periods[selectedPeriod];
        const boostUntil = new Date();
        boostUntil.setDate(boostUntil.getDate() + period.days);

        const { error } = await supabase
            .from('anuncios')
            .update({
                impulsionado: true,
                destaque: true,
                impulsionado_ate: boostUntil.toISOString(),
                prioridade: 5,
            })
            .eq('id', id)
            .eq('user_id', user.id);

        if (error) {
            toast.error('Erro ao impulsionar. Tente novamente.');
        } else {
            toast.success(`Anúncio impulsionado por ${period.label}!`);
            navigate('/meus-anuncios');
        }
        setBoosting(false);
    };

    if (loading || !car) {
        return (
            <div className="min-h-[60vh] flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-brand-600 animate-spin" />
            </div>
        );
    }

    const period = periods[selectedPeriod];

    return (
        <div className="min-h-screen bg-gradient-to-b from-slate-900 via-brand-950 to-slate-900">
            <div className="max-w-2xl mx-auto px-4 py-12">
                {/* Header */}
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-10">
                    <span className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-brand-600/20 text-brand-400 text-xs font-bold rounded-full mb-4">
                        <Rocket className="w-3.5 h-3.5" />
                        Impulsionar Anúncio
                    </span>
                    <h1 className="text-3xl md:text-4xl font-bold text-white mb-3">Destaque seu carro</h1>
                    <p className="text-slate-400">
                        Anúncios impulsionados aparecem <span className="text-brand-400 font-semibold">primeiro</span> para todos os compradores
                    </p>
                </motion.div>

                {/* Car Preview */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="flex items-center gap-4 p-5 bg-slate-800/60 backdrop-blur rounded-2xl border border-slate-700/50 mb-8"
                >
                    <img src={car.imagens[0]} alt="" className="w-20 h-14 object-cover rounded-xl" />
                    <div>
                        <h3 className="text-white font-bold">{car.marca} {car.modelo} {car.ano}</h3>
                        <p className="text-slate-400 text-sm">{formatPrice(car.preco)}</p>
                    </div>
                </motion.div>

                {/* Benefits */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="grid grid-cols-3 gap-4 mb-10"
                >
                    {[
                        { icon: Eye, title: '10x mais visualizações', desc: 'Apareça primeiro na listagem' },
                        { icon: Users, title: 'Mais interessados', desc: 'Receba contatos mais rápido' },
                        { icon: Zap, title: 'Destaque imediato', desc: 'Ativo assim que impulsionar' },
                    ].map(({ icon: Icon, title, desc }) => (
                        <div key={title} className="text-center p-5 bg-brand-600/10 border border-brand-500/20 rounded-2xl">
                            <Icon className="w-7 h-7 text-brand-400 mx-auto mb-2" />
                            <h4 className="text-white text-sm font-bold">{title}</h4>
                            <p className="text-slate-400 text-xs mt-1">{desc}</p>
                        </div>
                    ))}
                </motion.div>

                {/* Period Selector */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="bg-white rounded-2xl p-8 mb-8"
                >
                    <h3 className="text-center font-bold text-slate-900 text-lg mb-1">Escolha o período</h3>
                    <p className="text-center text-slate-400 text-sm mb-6">Deslize para selecionar</p>

                    {/* Slider */}
                    <input
                        type="range"
                        min={0}
                        max={periods.length - 1}
                        value={selectedPeriod}
                        onChange={(e) => setSelectedPeriod(Number(e.target.value))}
                        className="w-full mb-4 accent-brand-600"
                    />
                    <div className="flex justify-between text-xs text-slate-400 mb-8">
                        {periods.map((p, i) => (
                            <span key={i} className={selectedPeriod === i ? 'text-brand-600 font-bold' : ''}>{p.label}</span>
                        ))}
                    </div>

                    {/* Price Display */}
                    <div className="text-center p-6 bg-brand-50 rounded-2xl">
                        <div className="flex items-center justify-center gap-1.5 text-brand-600 text-sm font-semibold mb-2">
                            <Rocket className="w-4 h-4" />
                            {period.label}
                        </div>
                        <p className="text-4xl font-extrabold text-slate-900">{formatPrice(period.price)}</p>
                        <p className="text-slate-500 text-sm mt-1">{formatPrice(period.perDay)}/dia</p>
                        {period.savings && (
                            <span className="inline-block mt-2 px-3 py-1 bg-emerald-100 text-emerald-700 text-xs font-bold rounded-full">
                                Economia de {period.savings}% por dia
                            </span>
                        )}
                    </div>

                    {/* CTA */}
                    <button
                        onClick={handleBoost}
                        disabled={boosting}
                        className="w-full mt-6 flex items-center justify-center gap-2 py-4 bg-gradient-to-r from-brand-600 to-blue-600 text-white font-bold rounded-xl hover:from-brand-700 hover:to-blue-700 transition-all hover:shadow-lg active:scale-[0.98] disabled:opacity-70"
                    >
                        {boosting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Rocket className="w-5 h-5" />}
                        {boosting ? 'Impulsionando...' : `Impulsionar por ${formatPrice(period.price)}`}
                    </button>

                    <p className="text-center text-xs text-slate-400 mt-4">
                        O destaque é ativado imediatamente após a confirmação.
                    </p>
                </motion.div>

                {/* Back link */}
                <div className="text-center">
                    <Link to="/meus-anuncios" className="inline-flex items-center gap-1.5 text-slate-400 hover:text-white text-sm transition-colors">
                        <ArrowLeft className="w-4 h-4" />
                        Voltar para Meus Anúncios
                    </Link>
                </div>
            </div>
        </div>
    );
}
