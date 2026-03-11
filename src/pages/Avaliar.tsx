import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TrendingUp, Calculator, Car, Gauge, Calendar, Search, ArrowLeft, Zap, CheckCircle2, AlertTriangle, BarChart2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { brands, fuels } from '../data/mockCars';
import { useLanguage } from '../contexts/LanguageContext';

interface EstimateResult {
    min: number;
    median: number;
    max: number;
    trend: 'up' | 'down' | 'stable';
    confidence: number;
    tips: string[];
}

const CURRENT_YEAR = new Date().getFullYear();

function formatBRL(n: number) {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0 }).format(n);
}

// Simplified price estimator — real implementation would call an AI/ML endpoint
function estimatePrice(marca: string, modelo: string, ano: number, km: number, combustivel: string): EstimateResult {
    // Base prices by brand tier
    const premiumBrands = ['BMW', 'Mercedes-Benz', 'Audi', 'Porsche', 'Volvo', 'Land Rover', 'Jaguar'];
    const midBrands     = ['Toyota', 'Honda', 'Volkswagen', 'Hyundai', 'Kia', 'Nissan', 'Mitsubishi'];
    const budget        = ['Fiat', 'Chevrolet', 'Ford', 'Renault', 'Peugeot', 'Citroen'];

    let base = 80000;
    if (premiumBrands.includes(marca)) base = 220000;
    else if (midBrands.includes(marca)) base = 95000;
    else if (budget.includes(marca)) base = 60000;

    // Depreciation: ~12% per year after first year
    const age = CURRENT_YEAR - ano;
    const depreciationFactor = Math.pow(0.88, Math.max(0, age - 1));
    base *= depreciationFactor;

    // Km penalty: 0km = no penalty; 100k = -15%
    const kmFactor = Math.max(0.70, 1 - (km / 100000) * 0.15);
    base *= kmFactor;

    // Electric/Hybrid premium
    if (combustivel === 'Elétrico') base *= 1.4;
    else if (combustivel === 'Híbrido') base *= 1.2;

    const median = Math.round(base / 1000) * 1000;
    const min    = Math.round(median * 0.88 / 1000) * 1000;
    const max    = Math.round(median * 1.12 / 1000) * 1000;

    // Trend based on age
    const trend: 'up' | 'down' | 'stable' = age <= 1 ? 'stable' : age <= 3 ? 'down' : 'down';

    // Tips
    const tips: string[] = [];
    if (km > 80000) tips.push('Quilometragem alta pode reduzir o preço. Destaque a revisão em dia.');
    if (ano < CURRENT_YEAR - 5) tips.push('Veículos com mais de 5 anos desvalorizam mais rapidamente.');
    if (combustivel === 'Flex') tips.push('Flex tem boa demanda no mercado brasileiro — vantagem na venda.');
    if (combustivel === 'Elétrico') tips.push('Elétricos estão em alta — destaque a autonomia e infraestrutura de recarga.');
    if (tips.length === 0) tips.push('Veículo em perfil ideal para venda. Fotos de qualidade aumentam o interesse.');
    tips.push('Anúncios com 6 fotos recebem 3x mais contatos.');

    return { min, median, max, trend, confidence: 78, tips };
}

export default function Avaliar() {
    const { t } = useLanguage();
    const [form, setForm] = useState({ marca: '', modelo: '', ano: String(CURRENT_YEAR - 2), km: '', combustivel: '' });
    const [result, setResult] = useState<EstimateResult | null>(null);
    const [loading, setLoading] = useState(false);

    const years = Array.from({ length: 30 }, (_, i) => CURRENT_YEAR - i);

    const handleEstimate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.marca || !form.modelo || !form.ano) return;
        setLoading(true);
        // Simulate API call delay
        await new Promise(r => setTimeout(r, 1400));
        const res = estimatePrice(
            form.marca, form.modelo,
            parseInt(form.ano),
            parseInt(form.km) || 0,
            form.combustivel,
        );
        setResult(res);
        setLoading(false);
    };

    const reset = () => { setResult(null); setForm({ marca: '', modelo: '', ano: String(CURRENT_YEAR - 2), km: '', combustivel: '' }); };

    const inputCls = "w-full px-4 py-3 bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-white/10 focus:border-brand-400/60 rounded-xl text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-zinc-500 outline-none transition-all";
    const selectCls = `${inputCls} appearance-none cursor-pointer`;
    const lCls = "block text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider mb-2";

    return (
        <div className="bg-slate-50 dark:bg-zinc-950 min-h-screen transition-colors duration-300">

            {/* Hero */}
            <div className="relative overflow-hidden bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950 border-b border-white/5">
                <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 30% 50%, rgba(0,212,255,0.3) 0%, transparent 60%), radial-gradient(circle at 80% 20%, rgba(0,212,255,0.15) 0%, transparent 50%)' }} />
                <div className="max-w-4xl mx-auto px-4 sm:px-6 py-16 relative z-10">
                    <Link to="/estoque" className="inline-flex items-center gap-2 text-zinc-400 hover:text-brand-400 mb-8 transition-colors text-sm">
                        <ArrowLeft className="w-4 h-4" strokeWidth={1.5} /> Voltar ao estoque
                    </Link>
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 bg-brand-400/20 border border-brand-400/30 rounded-xl flex items-center justify-center">
                            <TrendingUp className="w-5 h-5 text-brand-400" strokeWidth={1.5} />
                        </div>
                        <span className="text-xs font-bold text-brand-400 uppercase tracking-widest">Avaliação de preço</span>
                    </div>
                    <h1 className="text-4xl md:text-5xl font-black text-white tracking-tight mb-3">
                        Quanto vale o <span className="text-brand-400">seu carro?</span>
                    </h1>
                    <p className="text-zinc-400 text-lg max-w-2xl leading-relaxed">
                        Descubra o valor justo de mercado do seu veículo com base em marca, modelo, ano e quilometragem.
                        Use essa estimativa para precificar seu anúncio com confiança.
                    </p>
                </div>
            </div>

            <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10">
                <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">

                    {/* Form */}
                    <div className="lg:col-span-3">
                        <motion.div
                            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                            className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/8 rounded-2xl overflow-hidden shadow-sm dark:shadow-none"
                        >
                            <div className="p-6 border-b border-slate-100 dark:border-white/5">
                                <h2 className="font-black text-slate-900 dark:text-white flex items-center gap-2">
                                    <Calculator className="w-5 h-5 text-brand-400" strokeWidth={1.5} />
                                    Dados do veículo
                                </h2>
                                <p className="text-sm text-slate-500 dark:text-zinc-500 mt-1">Preencha as informações para obter a estimativa</p>
                            </div>
                            <form onSubmit={handleEstimate} className="p-6 space-y-5">
                                <div className="grid sm:grid-cols-2 gap-4">
                                    <div>
                                        <label className={lCls}>Marca *</label>
                                        <div className="relative">
                                            <select value={form.marca} onChange={e => setForm(f => ({ ...f, marca: e.target.value }))} className={selectCls} required>
                                                <option value="">Selecione a marca</option>
                                                {brands.map(b => <option key={b} value={b}>{b}</option>)}
                                            </select>
                                            <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                                            </div>
                                        </div>
                                    </div>
                                    <div>
                                        <label className={lCls}>Modelo *</label>
                                        <div className="relative">
                                            <Car className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-zinc-500" strokeWidth={1.5} />
                                            <input type="text" value={form.modelo} onChange={e => setForm(f => ({ ...f, modelo: e.target.value }))}
                                                placeholder="Ex: Civic, Corolla, Argo" className={`${inputCls} pl-10`} required />
                                        </div>
                                    </div>
                                </div>
                                <div className="grid sm:grid-cols-2 gap-4">
                                    <div>
                                        <label className={lCls}>Ano *</label>
                                        <div className="relative">
                                            <Calendar className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-zinc-500" strokeWidth={1.5} />
                                            <select value={form.ano} onChange={e => setForm(f => ({ ...f, ano: e.target.value }))} className={`${selectCls} pl-10`} required>
                                                {years.map(y => <option key={y} value={y}>{y}</option>)}
                                            </select>
                                            <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                                            </div>
                                        </div>
                                    </div>
                                    <div>
                                        <label className={lCls}>Quilometragem</label>
                                        <div className="relative">
                                            <Gauge className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-zinc-500" strokeWidth={1.5} />
                                            <input type="number" min="0" value={form.km} onChange={e => setForm(f => ({ ...f, km: e.target.value }))}
                                                placeholder="Ex: 45000" className={`${inputCls} pl-10`} />
                                        </div>
                                    </div>
                                </div>
                                <div>
                                    <label className={lCls}>Combustível</label>
                                    <div className="relative">
                                        <select value={form.combustivel} onChange={e => setForm(f => ({ ...f, combustivel: e.target.value }))} className={selectCls}>
                                            <option value="">Selecione</option>
                                            {fuels.map(f => <option key={f} value={f}>{f}</option>)}
                                        </select>
                                        <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                                        </div>
                                    </div>
                                </div>
                                <button type="submit" disabled={loading}
                                    className="w-full flex items-center justify-center gap-2.5 py-4 bg-brand-400 hover:bg-brand-300 text-zinc-950 font-black rounded-xl transition-all hover:shadow-glow disabled:opacity-60 text-sm">
                                    {loading ? (
                                        <><div className="w-5 h-5 rounded-full border-2 border-zinc-950/20 border-t-zinc-950 animate-spin" />Analisando mercado...</>
                                    ) : (
                                        <><Search className="w-5 h-5" strokeWidth={1.5} />Estimar preço de mercado</>
                                    )}
                                </button>
                                {result && (
                                    <button type="button" onClick={reset} className="w-full py-2.5 text-sm text-slate-500 dark:text-zinc-500 hover:text-slate-700 dark:hover:text-zinc-300 transition-colors">
                                        Nova avaliação
                                    </button>
                                )}
                            </form>
                        </motion.div>
                    </div>

                    {/* Result / Tips */}
                    <div className="lg:col-span-2 space-y-5">
                        <AnimatePresence mode="wait">
                            {result ? (
                                <motion.div key="result" initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }} className="space-y-4">

                                    {/* Price card */}
                                    <div className="bg-gradient-to-br from-brand-400/20 to-brand-600/10 border border-brand-400/30 rounded-2xl p-6">
                                        <div className="flex items-center gap-2 mb-4">
                                            <BarChart2 className="w-5 h-5 text-brand-400" strokeWidth={1.5} />
                                            <span className="text-xs font-bold text-brand-400 uppercase tracking-wider">Estimativa de mercado</span>
                                        </div>
                                        <div className="text-center mb-4">
                                            <p className="text-xs text-slate-500 dark:text-zinc-400 mb-1">Preço mediano</p>
                                            <p className="text-4xl font-black text-slate-900 dark:text-white">{formatBRL(result.median)}</p>
                                            <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
                                                Confiança: <strong className="text-brand-400">{result.confidence}%</strong>
                                            </p>
                                        </div>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="bg-white/60 dark:bg-zinc-800/60 border border-slate-200 dark:border-white/10 rounded-xl p-3 text-center">
                                                <p className="text-xs text-slate-400 dark:text-zinc-500 mb-1">Mínimo</p>
                                                <p className="text-lg font-black text-slate-900 dark:text-white">{formatBRL(result.min)}</p>
                                            </div>
                                            <div className="bg-white/60 dark:bg-zinc-800/60 border border-slate-200 dark:border-white/10 rounded-xl p-3 text-center">
                                                <p className="text-xs text-slate-400 dark:text-zinc-500 mb-1">Máximo</p>
                                                <p className="text-lg font-black text-slate-900 dark:text-white">{formatBRL(result.max)}</p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Tips */}
                                    <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/8 rounded-2xl p-5">
                                        <h3 className="font-bold text-slate-900 dark:text-white mb-3 flex items-center gap-2 text-sm">
                                            <Zap className="w-4 h-4 text-brand-400" strokeWidth={1.5} /> Dicas para vender mais rápido
                                        </h3>
                                        <ul className="space-y-2">
                                            {result.tips.map((tip, i) => (
                                                <li key={i} className="flex items-start gap-2">
                                                    <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" strokeWidth={1.5} />
                                                    <p className="text-xs text-slate-600 dark:text-zinc-300 leading-relaxed">{tip}</p>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>

                                    {/* CTA */}
                                    <Link to="/anunciar"
                                        className="flex items-center justify-center gap-2.5 w-full py-4 bg-brand-400 hover:bg-brand-300 text-zinc-950 font-black rounded-xl transition-all hover:shadow-glow text-sm">
                                        <Car className="w-5 h-5" strokeWidth={1.5} />
                                        Anunciar este veículo
                                    </Link>
                                </motion.div>
                            ) : (
                                <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                                    className="space-y-4">

                                    {/* Feature cards */}
                                    {[
                                        { icon: TrendingUp, title: 'Análise de mercado',      desc: 'Baseada em dados de milhares de anúncios ativos no Brasil.', color: 'text-brand-400' },
                                        { icon: CheckCircle2, title: 'Preço justo',            desc: 'Evite cobrar caro demais ou deixar dinheiro na mesa.', color: 'text-emerald-400' },
                                        { icon: Zap, title: 'Venda mais rápido',               desc: 'Veículos precificados corretamente vendem até 60% mais rápido.', color: 'text-amber-400' },
                                    ].map(({ icon: Icon, title, desc, color }) => (
                                        <div key={title} className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/8 rounded-xl p-4 flex items-start gap-3 shadow-sm dark:shadow-none">
                                            <div className={`w-8 h-8 bg-slate-100 dark:bg-zinc-800 rounded-lg flex items-center justify-center flex-shrink-0`}>
                                                <Icon className={`w-4 h-4 ${color}`} strokeWidth={1.5} />
                                            </div>
                                            <div>
                                                <p className="text-sm font-bold text-slate-900 dark:text-white">{title}</p>
                                                <p className="text-xs text-slate-500 dark:text-zinc-500 mt-0.5 leading-relaxed">{desc}</p>
                                            </div>
                                        </div>
                                    ))}

                                    <div className="flex items-start gap-3 p-4 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/25 rounded-xl">
                                        <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" strokeWidth={1.5} />
                                        <p className="text-xs text-amber-700 dark:text-amber-400 leading-relaxed">
                                            Esta estimativa é uma referência baseada em padrões de mercado. O preço final pode variar conforme estado de conservação, opcionais e localização.
                                        </p>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </div>
            </div>
        </div>
    );
}
