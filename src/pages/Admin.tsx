import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
    LayoutDashboard, Car, Users, CreditCard, BarChart2, Settings,
    Shield, CheckCircle2, XCircle, AlertTriangle, Eye, Trash2,
    TrendingUp, ArrowLeft, Search, RefreshCw, Ban, ChevronDown
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from '../utils/toast';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { supabase, supabasePublic } from '../lib/supabase';

type AdminTab = 'dashboard' | 'cars' | 'users' | 'payments' | 'reports' | 'settings';

const ADMIN_EMAILS = ['bandasleonardo@gmail.com']; // TODO: Replace with DB role check

function formatBRL(n: number) {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0 }).format(n);
}

function timeAgo(dateStr: string) {
    const d = new Date(dateStr);
    const now = new Date();
    const diff = Math.floor((now.getTime() - d.getTime()) / 1000);
    if (diff < 60) return 'agora';
    if (diff < 3600) return `${Math.floor(diff / 60)}min atrás`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h atrás`;
    return `${Math.floor(diff / 86400)}d atrás`;
}

export default function Admin() {
    const { user } = useAuth();
    const { t } = useLanguage();
    const [tab, setTab] = useState<AdminTab>('dashboard');
    const [cars, setCars] = useState<any[]>([]);
    const [users, setUsers] = useState<any[]>([]);
    const [stats, setStats] = useState({ totalCars: 0, totalUsers: 0, activeCars: 0, pendingReview: 0 });
    const [loading, setLoading] = useState(true);
    const [carSearch, setCarSearch] = useState('');
    const [refreshing, setRefreshing] = useState(false);

    const isAdmin = user && ADMIN_EMAILS.includes(user.email || '');

    useEffect(() => {
        if (isAdmin) loadData();
        else setLoading(false);
    }, [isAdmin]);

    const loadData = async () => {
        setRefreshing(true);
        try {
            const [{ data: carsData }, { data: profilesData, count: usersCount }] = await Promise.all([
                supabasePublic.from('anuncios').select('*').order('created_at', { ascending: false }),
                supabasePublic.from('profiles').select('*', { count: 'exact' }),
            ]);
            const c = carsData || [];
            setCars(c);
            setUsers(profilesData || []);
            setStats({
                totalCars:    c.length,
                totalUsers:   usersCount || 0,
                activeCars:   c.filter((x: any) => !x.deleted_at).length,
                pendingReview: c.filter((x: any) => !x.aprovado).length,
            });
        } catch { } finally { setLoading(false); setRefreshing(false); }
    };

    const deleteCar = async (id: string) => {
        if (!confirm('Tem certeza que deseja excluir este anúncio?')) return;
        try {
            await supabase.from('anuncios').delete().eq('id', id);
            setCars(c => c.filter(x => x.id !== id));
            toast.success('Anúncio excluído.');
        } catch { toast.error('Erro ao excluir.'); }
    };

    const toggleDestaque = async (id: string, current: boolean) => {
        try {
            await supabase.from('anuncios').update({ destaque: !current }).eq('id', id);
            setCars(c => c.map(x => x.id === id ? { ...x, destaque: !current } : x));
            toast.success(!current ? 'Marcado como destaque.' : 'Destaque removido.');
        } catch { toast.error('Erro.'); }
    };

    const filteredCars = cars.filter(c =>
        `${c.marca} ${c.modelo} ${c.cidade}`.toLowerCase().includes(carSearch.toLowerCase())
    );

    const navItems: { id: AdminTab; label: string; icon: React.ElementType }[] = [
        { id: 'dashboard', label: 'Dashboard',   icon: LayoutDashboard },
        { id: 'cars',      label: 'Anúncios',    icon: Car             },
        { id: 'users',     label: 'Usuários',    icon: Users           },
        { id: 'payments',  label: 'Pagamentos',  icon: CreditCard      },
        { id: 'reports',   label: 'Relatórios',  icon: BarChart2       },
        { id: 'settings',  label: 'Configurações', icon: Settings      },
    ];

    if (!user || !isAdmin) return (
        <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 flex flex-col items-center justify-center gap-4">
            <Shield className="w-16 h-16 text-red-500 mb-2" strokeWidth={1.5} />
            <h2 className="text-2xl font-black text-slate-900 dark:text-white">Acesso restrito</h2>
            <p className="text-slate-500 dark:text-zinc-500 text-sm">Você não tem permissão para acessar esta área.</p>
            <Link to="/" className="px-6 py-2.5 bg-brand-400 text-zinc-950 font-black rounded-xl hover:bg-brand-300 transition-colors">Voltar ao início</Link>
        </div>
    );

    return (
        <div className="bg-slate-50 dark:bg-zinc-950 min-h-screen transition-colors duration-300">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

                {/* Header */}
                <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
                    <Link to="/" className="inline-flex items-center gap-2 text-slate-500 dark:text-zinc-500 hover:text-brand-400 mb-4 transition-colors text-sm">
                        <ArrowLeft className="w-4 h-4" strokeWidth={1.5} /> Voltar ao site
                    </Link>
                    <div className="flex items-center justify-between">
                        <div>
                            <div className="flex items-center gap-2 mb-1">
                                <Shield className="w-5 h-5 text-brand-400" strokeWidth={1.5} />
                                <span className="text-xs font-bold text-brand-400 uppercase tracking-widest">Admin</span>
                            </div>
                            <h1 className="text-3xl font-black text-slate-900 dark:text-white">Painel Administrativo</h1>
                        </div>
                        <button onClick={loadData} disabled={refreshing}
                            className="flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/10 text-slate-600 dark:text-zinc-400 text-sm font-bold rounded-xl hover:border-brand-400/30 transition-colors">
                            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} strokeWidth={1.5} />
                            Atualizar
                        </button>
                    </div>
                </motion.div>

                <div className="flex flex-col lg:flex-row gap-6">
                    {/* Sidebar */}
                    <nav className="lg:w-52 flex-shrink-0">
                        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/8 rounded-2xl p-2 shadow-sm dark:shadow-none space-y-0.5">
                            {navItems.map(({ id, label, icon: Icon }) => (
                                <button key={id} onClick={() => setTab(id)}
                                    className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all text-left border ${
                                        tab === id
                                            ? 'bg-brand-400/10 border-brand-400/20 text-brand-500 dark:text-brand-400'
                                            : 'border-transparent text-slate-600 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white'
                                    }`}>
                                    <Icon className="w-4 h-4 flex-shrink-0" strokeWidth={1.5} />
                                    {label}
                                </button>
                            ))}
                        </div>
                    </nav>

                    {/* Content */}
                    <div className="flex-1 space-y-6">

                        {/* ─── DASHBOARD ─── */}
                        {tab === 'dashboard' && (
                            <motion.div key="dashboard" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
                                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                                    {[
                                        { label: 'Total de anúncios', val: stats.totalCars,    icon: Car,      color: 'text-brand-400'   },
                                        { label: 'Usuários',          val: stats.totalUsers,   icon: Users,    color: 'text-emerald-400' },
                                        { label: 'Anúncios ativos',   val: stats.activeCars,   icon: CheckCircle2, color: 'text-blue-400'  },
                                        { label: 'Sem aprovação',     val: stats.pendingReview, icon: AlertTriangle, color: 'text-amber-400' },
                                    ].map(({ label, val, icon: Icon, color }) => (
                                        <div key={label} className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/8 rounded-2xl p-5 shadow-sm dark:shadow-none">
                                            <Icon className={`w-6 h-6 mb-3 ${color}`} strokeWidth={1.5} />
                                            <p className="text-3xl font-black text-slate-900 dark:text-white">{loading ? '—' : val}</p>
                                            <p className="text-xs text-slate-500 dark:text-zinc-500 mt-1">{label}</p>
                                        </div>
                                    ))}
                                </div>

                                {/* Recent cars */}
                                <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/8 rounded-2xl shadow-sm dark:shadow-none overflow-hidden">
                                    <div className="px-6 py-4 border-b border-slate-100 dark:border-white/5 flex items-center justify-between">
                                        <h3 className="font-black text-slate-900 dark:text-white text-sm">Últimos anúncios</h3>
                                        <button onClick={() => setTab('cars')} className="text-xs text-brand-400 font-bold hover:text-brand-300 transition-colors">Ver todos</button>
                                    </div>
                                    <div className="divide-y divide-slate-100 dark:divide-white/5">
                                        {cars.slice(0, 5).map(car => (
                                            <div key={car.id} className="flex items-center justify-between px-6 py-3">
                                                <div>
                                                    <p className="text-sm font-bold text-slate-900 dark:text-white">{car.marca} {car.modelo} {car.ano}</p>
                                                    <p className="text-xs text-slate-400 dark:text-zinc-500">{car.cidade} · {timeAgo(car.created_at)}</p>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-sm font-bold text-brand-400">{formatBRL(car.preco)}</span>
                                                    {car.destaque && <span className="px-2 py-0.5 bg-amber-500/15 border border-amber-500/30 text-amber-600 dark:text-amber-400 text-xs font-bold rounded-lg">Destaque</span>}
                                                </div>
                                            </div>
                                        ))}
                                        {cars.length === 0 && !loading && (
                                            <p className="px-6 py-8 text-sm text-slate-400 dark:text-zinc-500 text-center">Nenhum anúncio encontrado.</p>
                                        )}
                                    </div>
                                </div>
                            </motion.div>
                        )}

                        {/* ─── ANÚNCIOS ─── */}
                        {tab === 'cars' && (
                            <motion.div key="cars" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                                <div className="relative">
                                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-zinc-500" strokeWidth={1.5} />
                                    <input type="text" value={carSearch} onChange={e => setCarSearch(e.target.value)}
                                        placeholder="Buscar por marca, modelo ou cidade..."
                                        className="w-full pl-10 pr-4 py-3 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/10 focus:border-brand-400/60 rounded-xl text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-zinc-500 outline-none transition-all shadow-sm" />
                                </div>

                                <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/8 rounded-2xl shadow-sm dark:shadow-none overflow-hidden">
                                    <div className="px-5 py-3 border-b border-slate-100 dark:border-white/5">
                                        <p className="text-sm font-bold text-slate-900 dark:text-white">{filteredCars.length} anúncios</p>
                                    </div>
                                    <div className="divide-y divide-slate-100 dark:divide-white/5 max-h-[600px] overflow-y-auto">
                                        {filteredCars.map(car => (
                                            <div key={car.id} className="flex items-start gap-4 px-5 py-4 hover:bg-slate-50 dark:hover:bg-white/3 transition-colors">
                                                {car.imagens?.[0] ? (
                                                    <img src={car.imagens[0]} alt="" className="w-14 h-10 rounded-lg object-cover flex-shrink-0" />
                                                ) : (
                                                    <div className="w-14 h-10 rounded-lg bg-slate-100 dark:bg-zinc-800 flex items-center justify-center flex-shrink-0">
                                                        <Car className="w-5 h-5 text-slate-300 dark:text-zinc-600" strokeWidth={1.5} />
                                                    </div>
                                                )}
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2 mb-0.5">
                                                        <p className="text-sm font-bold text-slate-900 dark:text-white truncate">
                                                            {car.marca} {car.modelo} {car.ano}
                                                        </p>
                                                        {car.destaque && <span className="px-1.5 py-0.5 bg-amber-500/15 text-amber-600 dark:text-amber-400 text-xs font-bold rounded">★ Destaque</span>}
                                                        {car.impulsionado && <span className="px-1.5 py-0.5 bg-brand-400/15 text-brand-500 dark:text-brand-400 text-xs font-bold rounded">⚡ Impulsionado</span>}
                                                    </div>
                                                    <p className="text-xs text-slate-400 dark:text-zinc-500">{car.cidade} · {formatBRL(car.preco)} · {timeAgo(car.created_at)}</p>
                                                </div>
                                                <div className="flex items-center gap-1 flex-shrink-0">
                                                    <Link to={`/carro/${car.id}`}
                                                        className="p-1.5 text-slate-400 dark:text-zinc-500 hover:text-brand-400 hover:bg-brand-400/10 rounded-lg transition-colors">
                                                        <Eye className="w-4 h-4" strokeWidth={1.5} />
                                                    </Link>
                                                    <button onClick={() => toggleDestaque(car.id, car.destaque)}
                                                        className={`p-1.5 rounded-lg transition-colors ${car.destaque ? 'text-amber-500 hover:bg-amber-500/10' : 'text-slate-400 hover:text-amber-500 hover:bg-amber-500/10'}`}
                                                        title={car.destaque ? 'Remover destaque' : 'Adicionar destaque'}>
                                                        <TrendingUp className="w-4 h-4" strokeWidth={1.5} />
                                                    </button>
                                                    <button onClick={() => deleteCar(car.id)}
                                                        className="p-1.5 text-slate-400 dark:text-zinc-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors">
                                                        <Trash2 className="w-4 h-4" strokeWidth={1.5} />
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                        {filteredCars.length === 0 && (
                                            <p className="px-5 py-8 text-sm text-slate-400 dark:text-zinc-500 text-center">Nenhum anúncio encontrado.</p>
                                        )}
                                    </div>
                                </div>
                            </motion.div>
                        )}

                        {/* ─── USUÁRIOS ─── */}
                        {tab === 'users' && (
                            <motion.div key="users" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                                <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/8 rounded-2xl shadow-sm dark:shadow-none overflow-hidden">
                                    <div className="px-5 py-3 border-b border-slate-100 dark:border-white/5">
                                        <p className="text-sm font-bold text-slate-900 dark:text-white">{users.length} usuários cadastrados</p>
                                    </div>
                                    <div className="divide-y divide-slate-100 dark:divide-white/5 max-h-[600px] overflow-y-auto">
                                        {users.map((u: any) => (
                                            <div key={u.id} className="flex items-center gap-4 px-5 py-4 hover:bg-slate-50 dark:hover:bg-white/3 transition-colors">
                                                <div className="w-10 h-10 bg-gradient-to-br from-brand-400 to-brand-600 rounded-full flex items-center justify-center text-zinc-950 text-sm font-black flex-shrink-0 overflow-hidden">
                                                    {u.avatar_url ? <img src={u.avatar_url} alt="" className="w-full h-full object-cover" /> : (u.full_name?.[0] || '?')}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-bold text-slate-900 dark:text-white">{u.full_name || 'Sem nome'}</p>
                                                    <p className="text-xs text-slate-400 dark:text-zinc-500 truncate">{u.phone || 'Sem telefone'} · {u.cidade || 'Sem cidade'}</p>
                                                </div>
                                                <button className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors" title="Bloquear usuário">
                                                    <Ban className="w-4 h-4" strokeWidth={1.5} />
                                                </button>
                                            </div>
                                        ))}
                                        {users.length === 0 && (
                                            <p className="px-5 py-8 text-sm text-slate-400 dark:text-zinc-500 text-center">Nenhum usuário encontrado.</p>
                                        )}
                                    </div>
                                </div>
                            </motion.div>
                        )}

                        {/* ─── PAGAMENTOS ─── */}
                        {tab === 'payments' && (
                            <motion.div key="payments" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                                <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/8 rounded-2xl p-6 shadow-sm dark:shadow-none">
                                    <h3 className="font-black text-slate-900 dark:text-white mb-4">Histórico de pagamentos</h3>
                                    <p className="text-sm text-slate-500 dark:text-zinc-500">Em breve: relatório detalhado de pagamentos de impulsionamento.</p>
                                </div>
                            </motion.div>
                        )}

                        {/* ─── RELATÓRIOS ─── */}
                        {tab === 'reports' && (
                            <motion.div key="reports" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                                <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/8 rounded-2xl p-6 shadow-sm dark:shadow-none">
                                    <h3 className="font-black text-slate-900 dark:text-white mb-4">Relatórios</h3>
                                    <p className="text-sm text-slate-500 dark:text-zinc-500">Em breve: análises de tráfego, conversões e visualizações.</p>
                                </div>
                            </motion.div>
                        )}

                        {/* ─── CONFIGURAÇÕES ─── */}
                        {tab === 'settings' && (
                            <motion.div key="settings" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                                <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/8 rounded-2xl p-6 shadow-sm dark:shadow-none space-y-4">
                                    <h3 className="font-black text-slate-900 dark:text-white mb-2">Configurações do sistema</h3>
                                    <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-white/8 rounded-xl">
                                        <div>
                                            <p className="text-sm font-bold text-slate-900 dark:text-white">Modo de manutenção</p>
                                            <p className="text-xs text-slate-500 dark:text-zinc-500">Desativa temporariamente o site para visitantes</p>
                                        </div>
                                        <span className="px-3 py-1 bg-amber-500/15 border border-amber-500/30 text-amber-600 dark:text-amber-400 text-xs font-bold rounded-lg">Em breve</span>
                                    </div>
                                    <div className="p-4 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/25 rounded-xl">
                                        <p className="text-xs font-bold text-amber-700 dark:text-amber-400 mb-1">Script de reset de destaque</p>
                                        <p className="text-xs text-amber-600 dark:text-amber-400/80 mb-2">
                                            Para resetar veículos com destaque indevido, execute o SQL em Supabase:
                                        </p>
                                        <code className="block text-xs bg-amber-100 dark:bg-amber-500/10 p-2 rounded-lg text-amber-800 dark:text-amber-300 font-mono">
                                            UPDATE anuncios SET destaque = false WHERE impulsionado = false;
                                        </code>
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
