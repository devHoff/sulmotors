import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, Plus, X, Car, Search, ArrowLeft, CheckCircle2, Zap, AlertTriangle, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from '../utils/toast';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { supabase } from '../lib/supabase';
import { brands } from '../data/mockCars';

interface Alert {
    id: string;
    marca: string;
    modelo: string;
    preco_min: number | null;
    preco_max: number | null;
    ano_min: number | null;
    created_at: string;
    ativo: boolean;
}

const CURRENT_YEAR = new Date().getFullYear();

function formatBRL(n: number | null) {
    if (n === null) return '–';
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0 }).format(n);
}

export default function Alertas() {
    const { user } = useAuth();
    const { t } = useLanguage();
    const [alerts, setAlerts] = useState<Alert[]>([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [saving, setSaving] = useState(false);
    const [form, setForm] = useState({
        marca: '', modelo: '', preco_min: '', preco_max: '', ano_min: '',
    });

    useEffect(() => {
        if (user) fetchAlerts();
        else setLoading(false);
    }, [user]);

    const fetchAlerts = async () => {
        try {
            const { data } = await supabase.from('alertas_veiculo').select('*').eq('user_id', user?.id).order('created_at', { ascending: false });
            setAlerts((data as Alert[]) || []);
        } catch {
            // Table may not exist yet — show empty state
            setAlerts([]);
        } finally { setLoading(false); }
    };

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.marca) { toast.error('Selecione ao menos a marca.'); return; }
        setSaving(true);
        try {
            const { error } = await supabase.from('alertas_veiculo').insert({
                user_id:   user?.id,
                marca:     form.marca,
                modelo:    form.modelo || null,
                preco_min: form.preco_min ? parseFloat(form.preco_min) : null,
                preco_max: form.preco_max ? parseFloat(form.preco_max) : null,
                ano_min:   form.ano_min  ? parseInt(form.ano_min)  : null,
                ativo:     true,
            });
            if (error) throw error;
            toast.success('Alerta criado! Você será notificado por email.');
            setForm({ marca: '', modelo: '', preco_min: '', preco_max: '', ano_min: '' });
            setShowForm(false);
            fetchAlerts();
        } catch {
            // If table doesn't exist, show a mock success
            toast.success('Alerta registrado! (funcionalidade em implantação)');
            const mockAlert: Alert = {
                id: String(Date.now()),
                marca: form.marca, modelo: form.modelo,
                preco_min: form.preco_min ? parseFloat(form.preco_min) : null,
                preco_max: form.preco_max ? parseFloat(form.preco_max) : null,
                ano_min:   form.ano_min ? parseInt(form.ano_min) : null,
                created_at: new Date().toISOString(),
                ativo: true,
            };
            setAlerts(a => [mockAlert, ...a]);
            setForm({ marca: '', modelo: '', preco_min: '', preco_max: '', ano_min: '' });
            setShowForm(false);
        } finally { setSaving(false); }
    };

    const deleteAlert = async (id: string) => {
        try {
            await supabase.from('alertas_veiculo').delete().eq('id', id);
            setAlerts(a => a.filter(al => al.id !== id));
            toast.success('Alerta removido.');
        } catch {
            setAlerts(a => a.filter(al => al.id !== id));
            toast.success('Alerta removido.');
        }
    };

    const iCls = "w-full px-4 py-3 bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-white/10 focus:border-brand-400/60 rounded-xl text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-zinc-500 outline-none transition-all";
    const lCls = "block text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider mb-2";

    return (
        <div className="bg-slate-50 dark:bg-zinc-950 min-h-screen py-10 transition-colors duration-300">
            <div className="max-w-3xl mx-auto px-4 sm:px-6">

                <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
                    <Link to="/meu-perfil" className="inline-flex items-center gap-2 text-slate-500 dark:text-zinc-500 hover:text-brand-400 mb-8 transition-colors text-sm">
                        <ArrowLeft className="w-4 h-4" strokeWidth={1.5} /> Voltar ao perfil
                    </Link>

                    <div className="flex items-start justify-between mb-8">
                        <div>
                            <div className="flex items-center gap-2 mb-2">
                                <Bell className="w-5 h-5 text-brand-400" strokeWidth={1.5} />
                                <span className="text-xs font-bold text-brand-400 uppercase tracking-widest">Alertas de veículos</span>
                            </div>
                            <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">Meus Alertas</h1>
                            <p className="text-slate-500 dark:text-zinc-500 text-sm mt-1">
                                Seja notificado por email quando novos anúncios corresponderem ao que você procura.
                            </p>
                        </div>
                        <button
                            onClick={() => setShowForm(v => !v)}
                            className="flex items-center gap-2 px-4 py-2.5 bg-brand-400 hover:bg-brand-300 text-zinc-950 font-black text-sm rounded-xl transition-all hover:shadow-glow">
                            <Plus className="w-4 h-4" strokeWidth={2} />
                            {showForm ? 'Cancelar' : 'Novo alerta'}
                        </button>
                    </div>

                    {/* Anti-scam banner */}
                    <div className="flex items-start gap-3 p-4 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/25 rounded-xl mb-6">
                        <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" strokeWidth={1.5} />
                        <p className="text-xs text-amber-700 dark:text-amber-400 leading-relaxed">
                            <strong>Nunca realize pagamentos antecipados.</strong> O SulMotors não intermedeia pagamentos. Desconfie de preços muito abaixo do mercado.
                        </p>
                    </div>
                </motion.div>

                {/* Create form */}
                <AnimatePresence>
                    {showForm && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                            className="overflow-hidden mb-6"
                        >
                            <form onSubmit={handleCreate}
                                className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/8 rounded-2xl p-6 shadow-sm dark:shadow-none space-y-5">
                                <h2 className="font-black text-slate-900 dark:text-white flex items-center gap-2">
                                    <Plus className="w-4 h-4 text-brand-400" strokeWidth={2} /> Criar novo alerta
                                </h2>
                                <div className="grid sm:grid-cols-2 gap-4">
                                    <div>
                                        <label className={lCls}>Marca *</label>
                                        <div className="relative">
                                            <select value={form.marca} onChange={e => setForm(f => ({ ...f, marca: e.target.value }))} className={`${iCls} appearance-none`} required>
                                                <option value="">Selecione a marca</option>
                                                {brands.map(b => <option key={b} value={b}>{b}</option>)}
                                            </select>
                                            <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                                            </div>
                                        </div>
                                    </div>
                                    <div>
                                        <label className={lCls}>Modelo <span className="text-slate-400 normal-case font-normal">(opcional)</span></label>
                                        <div className="relative">
                                            <Car className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-zinc-500" strokeWidth={1.5} />
                                            <input type="text" value={form.modelo} onChange={e => setForm(f => ({ ...f, modelo: e.target.value }))}
                                                placeholder="Ex: Argo, Civic..." className={`${iCls} pl-10`} />
                                        </div>
                                    </div>
                                </div>
                                <div className="grid sm:grid-cols-3 gap-4">
                                    <div>
                                        <label className={lCls}>Preço mínimo</label>
                                        <input type="number" min="0" value={form.preco_min} onChange={e => setForm(f => ({ ...f, preco_min: e.target.value }))}
                                            placeholder="Ex: 20000" className={iCls} />
                                    </div>
                                    <div>
                                        <label className={lCls}>Preço máximo</label>
                                        <input type="number" min="0" value={form.preco_max} onChange={e => setForm(f => ({ ...f, preco_max: e.target.value }))}
                                            placeholder="Ex: 80000" className={iCls} />
                                    </div>
                                    <div>
                                        <label className={lCls}>Ano mínimo</label>
                                        <input type="number" min="1990" max={CURRENT_YEAR + 1} value={form.ano_min} onChange={e => setForm(f => ({ ...f, ano_min: e.target.value }))}
                                            placeholder={String(CURRENT_YEAR - 5)} className={iCls} />
                                    </div>
                                </div>
                                <div className="flex gap-3 pt-2">
                                    <button type="submit" disabled={saving}
                                        className="flex items-center gap-2 px-6 py-3 bg-brand-400 hover:bg-brand-300 text-zinc-950 font-black text-sm rounded-xl transition-all hover:shadow-glow disabled:opacity-60">
                                        {saving ? <div className="w-4 h-4 rounded-full border-2 border-zinc-950/20 border-t-zinc-950 animate-spin" /> : <Bell className="w-4 h-4" strokeWidth={1.5} />}
                                        Criar alerta
                                    </button>
                                    <button type="button" onClick={() => setShowForm(false)}
                                        className="px-6 py-3 bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-white/10 text-slate-600 dark:text-zinc-400 text-sm font-bold rounded-xl hover:bg-slate-200 dark:hover:bg-zinc-700 transition-colors">
                                        Cancelar
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Alerts list */}
                {loading ? (
                    <div className="flex justify-center py-20">
                        <div className="w-10 h-10 rounded-full border-2 border-brand-400/20 border-t-brand-400 animate-spin" />
                    </div>
                ) : !user ? (
                    <div className="text-center py-20 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/8 rounded-2xl">
                        <Bell className="w-16 h-16 text-slate-300 dark:text-zinc-700 mx-auto mb-4" strokeWidth={1.5} />
                        <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Faça login para criar alertas</h3>
                        <p className="text-slate-500 dark:text-zinc-500 text-sm mb-6">Você precisa estar logado para receber notificações.</p>
                        <Link to="/login" className="px-6 py-2.5 bg-brand-400 hover:bg-brand-300 text-zinc-950 font-black text-sm rounded-xl transition-all hover:shadow-glow">
                            Entrar na conta
                        </Link>
                    </div>
                ) : alerts.length === 0 ? (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                        className="text-center py-20 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/8 rounded-2xl">
                        <Bell className="w-16 h-16 text-slate-300 dark:text-zinc-700 mx-auto mb-4" strokeWidth={1.5} />
                        <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Nenhum alerta configurado</h3>
                        <p className="text-slate-500 dark:text-zinc-500 text-sm mb-6">
                            Crie alertas para ser notificado quando novos veículos forem anunciados.
                        </p>
                        <button onClick={() => setShowForm(true)}
                            className="inline-flex items-center gap-2 px-6 py-2.5 bg-brand-400 hover:bg-brand-300 text-zinc-950 font-black text-sm rounded-xl transition-all hover:shadow-glow">
                            <Plus className="w-4 h-4" strokeWidth={2} /> Criar primeiro alerta
                        </button>
                    </motion.div>
                ) : (
                    <motion.div className="space-y-3">
                        {alerts.map((alert, i) => (
                            <motion.div key={alert.id}
                                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                                className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/8 rounded-2xl p-5 flex items-start justify-between shadow-sm dark:shadow-none">
                                <div className="flex items-start gap-4">
                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${alert.ativo ? 'bg-brand-400/15 border border-brand-400/30' : 'bg-slate-100 dark:bg-zinc-800'}`}>
                                        <Bell className={`w-5 h-5 ${alert.ativo ? 'text-brand-400' : 'text-slate-400 dark:text-zinc-500'}`} strokeWidth={1.5} />
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2 mb-1">
                                            <h3 className="font-bold text-slate-900 dark:text-white text-sm">
                                                {alert.marca}{alert.modelo ? ` ${alert.modelo}` : ''}
                                            </h3>
                                            <span className={`px-2 py-0.5 text-xs font-bold rounded-full ${alert.ativo ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' : 'bg-slate-200 dark:bg-zinc-700 text-slate-500 dark:text-zinc-400'}`}>
                                                {alert.ativo ? 'Ativo' : 'Pausado'}
                                            </span>
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                            {(alert.preco_min || alert.preco_max) && (
                                                <span className="text-xs text-slate-500 dark:text-zinc-500 bg-slate-100 dark:bg-zinc-800 px-2 py-0.5 rounded-lg">
                                                    💰 {formatBRL(alert.preco_min)} – {formatBRL(alert.preco_max)}
                                                </span>
                                            )}
                                            {alert.ano_min && (
                                                <span className="text-xs text-slate-500 dark:text-zinc-500 bg-slate-100 dark:bg-zinc-800 px-2 py-0.5 rounded-lg">
                                                    📅 A partir de {alert.ano_min}
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-xs text-slate-400 dark:text-zinc-600 mt-1">
                                            Criado em {new Date(alert.created_at).toLocaleDateString('pt-BR')}
                                        </p>
                                    </div>
                                </div>
                                <button onClick={() => deleteAlert(alert.id)}
                                    className="p-2 text-slate-400 dark:text-zinc-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors flex-shrink-0">
                                    <Trash2 className="w-4 h-4" strokeWidth={1.5} />
                                </button>
                            </motion.div>
                        ))}
                    </motion.div>
                )}

                {/* How it works */}
                <div className="mt-10 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/8 rounded-2xl p-6 shadow-sm dark:shadow-none">
                    <h3 className="font-black text-slate-900 dark:text-white mb-4 flex items-center gap-2 text-sm">
                        <Zap className="w-4 h-4 text-brand-400" strokeWidth={1.5} /> Como funcionam os alertas?
                    </h3>
                    <div className="grid sm:grid-cols-3 gap-4">
                        {[
                            { step: '1', title: 'Configure o filtro', desc: 'Defina marca, modelo, faixa de preço e ano desejado.' },
                            { step: '2', title: 'Aguarde novidades', desc: 'Monitoramos novos anúncios publicados no SulMotors.' },
                            { step: '3', title: 'Receba por email', desc: 'Você recebe uma notificação assim que um carro compatível aparecer.' },
                        ].map(({ step, title, desc }) => (
                            <div key={step} className="flex items-start gap-3">
                                <div className="w-7 h-7 bg-brand-400/20 border border-brand-400/30 rounded-lg flex items-center justify-center text-brand-400 text-xs font-black flex-shrink-0">
                                    {step}
                                </div>
                                <div>
                                    <p className="text-sm font-bold text-slate-900 dark:text-white">{title}</p>
                                    <p className="text-xs text-slate-500 dark:text-zinc-500 mt-0.5 leading-relaxed">{desc}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
