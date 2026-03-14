import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    LayoutDashboard, Car, Users, CreditCard, BarChart2, Settings,
    Shield, CheckCircle2, XCircle, AlertTriangle, Eye, Trash2,
    TrendingUp, Search, RefreshCw, Ban, MessageSquare,
    Flag, Activity, FileText, Bell, LogOut, ChevronRight,
    ChevronDown, Star, Zap, DollarSign, Database,
    AlertOctagon, UserCheck, Package, Hash, Clock,
    ArrowUpRight, ArrowDownRight, MoreVertical, Filter,
    CheckCheck, X, Info, Cpu, Globe, Mail, Phone, Calendar,
    Lock, Unlock, UserX, Edit3, ExternalLink, Download,
    PieChart, TrendingDown, Wifi, WifiOff, Terminal
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import {
    AreaChart, Area, BarChart, Bar, LineChart, Line,
    XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    PieChart as RePieChart, Pie, Cell
} from 'recharts';
import { toast } from '../utils/toast';
import { useAuth } from '../contexts/AuthContext';
import { supabase, supabasePublic } from '../lib/supabase';

// ─── Constants ────────────────────────────────────────────────────────────────
// All emails in this list have admin access (case-insensitive match)
const ADMIN_EMAILS = [
    'contato@sulmotor.com',
    'mvp.hoffmann@gmail.com',
];
const ADMIN_2FA_CODE = '834221';

type AdminSection =
    | 'dashboard' | 'users' | 'vehicles' | 'listings'
    | 'messages' | 'reports' | 'financial' | 'analytics'
    | 'performance' | 'logs' | 'settings' | 'antifraud';

// ─── Helpers ──────────────────────────────────────────────────────────────────
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
function fmtDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString('pt-BR');
}

// ─── Mock data for charts & extended UI ───────────────────────────────────────
const userGrowthData = [
    { day: 'Seg', users: 12 }, { day: 'Ter', users: 19 }, { day: 'Qua', users: 8 },
    { day: 'Qui', users: 24 }, { day: 'Sex', users: 31 }, { day: 'Sáb', users: 22 },
    { day: 'Dom', users: 14 },
];
const listingActivityData = [
    { day: 'Seg', created: 8, approved: 6, removed: 1 },
    { day: 'Ter', created: 15, approved: 12, removed: 2 },
    { day: 'Qua', created: 7, approved: 7, removed: 0 },
    { day: 'Qui', created: 18, approved: 14, removed: 3 },
    { day: 'Sex', created: 22, approved: 19, removed: 1 },
    { day: 'Sáb', created: 11, approved: 10, removed: 0 },
    { day: 'Dom', created: 6, approved: 5, removed: 1 },
];
const engagementData = [
    { day: 'Seg', messages: 145, views: 1200, favorites: 34 },
    { day: 'Ter', messages: 189, views: 1580, favorites: 52 },
    { day: 'Qua', messages: 112, views: 980, favorites: 28 },
    { day: 'Qui', messages: 234, views: 2100, favorites: 71 },
    { day: 'Sex', messages: 312, views: 2800, favorites: 89 },
    { day: 'Sáb', messages: 198, views: 1920, favorites: 63 },
    { day: 'Dom', messages: 167, views: 1430, favorites: 45 },
];
const brandData = [
    { name: 'BMW', value: 18 }, { name: 'Toyota', value: 15 },
    { name: 'Honda', value: 13 }, { name: 'Audi', value: 11 },
    { name: 'Outros', value: 43 },
];
const PIE_COLORS = ['#22d3ee', '#3b82f6', '#8b5cf6', '#f59e0b', '#6b7280'];

const mockLogs = [
    { id: 1, action: 'USER_CREATE', detail: 'Novo usuário criado: joao@email.com', level: 'info', ts: new Date(Date.now() - 300000).toISOString() },
    { id: 2, action: 'ADMIN_DELETE', detail: 'Admin removeu anúncio #1482 (Spam)', level: 'warn', ts: new Date(Date.now() - 900000).toISOString() },
    { id: 3, action: 'API_ERROR', detail: 'Supabase timeout na rota /anuncios (520ms)', level: 'error', ts: new Date(Date.now() - 1800000).toISOString() },
    { id: 4, action: 'USER_BANNED', detail: 'Usuário maria@email.com banido por fraude', level: 'warn', ts: new Date(Date.now() - 3600000).toISOString() },
    { id: 5, action: 'LISTING_APPROVED', detail: 'Anúncio #1491 (BMW X5) aprovado', level: 'info', ts: new Date(Date.now() - 5400000).toISOString() },
    { id: 6, action: 'DB_QUERY_SLOW', detail: 'Query lenta detectada: 890ms em profiles', level: 'warn', ts: new Date(Date.now() - 7200000).toISOString() },
    { id: 7, action: 'REPORT_RESOLVED', detail: 'Denúncia #34 resolvida — anúncio removido', level: 'info', ts: new Date(Date.now() - 10800000).toISOString() },
    { id: 8, action: 'AUTH_FAIL', detail: 'Tentativa de login inválida (IP: 192.168.1.42)', level: 'error', ts: new Date(Date.now() - 14400000).toISOString() },
];

const mockReports = [
    { id: 1, carTitle: 'BMW 320i 2020', reason: 'Preço suspeito', reporter: 'carlos@email.com', date: '2025-03-09', status: 'pending' },
    { id: 2, carTitle: 'Toyota Corolla 2019', reason: 'Veículo inexistente', reporter: 'ana@email.com', date: '2025-03-08', status: 'investigating' },
    { id: 3, carTitle: 'Honda Civic EX', reason: 'Fraude / golpe', reporter: 'pedro@email.com', date: '2025-03-07', status: 'resolved' },
    { id: 4, carTitle: 'Audi A3 Sport 2022', reason: 'Spam', reporter: 'julia@email.com', date: '2025-03-06', status: 'pending' },
    { id: 5, carTitle: 'VW Golf GTI', reason: 'Informações falsas', reporter: 'marcos@email.com', date: '2025-03-05', status: 'pending' },
];

const mockMessages = [
    { id: 1, user: 'João Silva', message: 'Aceito pix de 15 mil, urgente!', flagged: true, ts: new Date(Date.now() - 1800000).toISOString() },
    { id: 2, user: 'Ana Souza', message: 'Qual o valor mínimo aceitável?', flagged: false, ts: new Date(Date.now() - 3600000).toISOString() },
    { id: 3, user: 'Carlos Mendes', message: 'Aceita transferência bancária? Urgente!', flagged: true, ts: new Date(Date.now() - 5400000).toISOString() },
    { id: 4, user: 'Maria Lima', message: 'Gostaria de agendar uma visita', flagged: false, ts: new Date(Date.now() - 7200000).toISOString() },
    { id: 5, user: 'Roberto Costa', message: 'Preciso que faça depósito antes da vistoria', flagged: true, ts: new Date(Date.now() - 10800000).toISOString() },
];

const FLAG_KEYWORDS = ['pix', 'transferência', 'depósito', 'urgente'];

const mockFraud = [
    { id: 1, user: 'suspeito@mail.com', type: 'Preço irreal', count: 3, lastSeen: '2025-03-09', risk: 'high' },
    { id: 2, user: 'vendedor99@mail.com', type: 'Múltiplas denúncias', count: 5, lastSeen: '2025-03-08', risk: 'high' },
    { id: 3, user: 'anon_seller@mail.com', type: 'Chat suspeito', count: 2, lastSeen: '2025-03-07', risk: 'medium' },
    { id: 4, user: 'rapid_cars@mail.com', type: 'Spam de anúncios', count: 8, lastSeen: '2025-03-06', risk: 'high' },
];

const subscriptionPlans = [
    { plan: 'Pro', price: 29, subscribers: 48, mrr: 1392 },
    { plan: 'Business', price: 79, subscribers: 12, mrr: 948 },
    { plan: 'Enterprise', price: 199, subscribers: 3, mrr: 597 },
];

// ─── 2FA Login Gate ────────────────────────────────────────────────────────────
function TwoFactorGate({ onVerified }: { onVerified: () => void }) {
    const [code, setCode] = useState('');
    const [error, setError] = useState(false);
    const [loading, setLoading] = useState(false);

    const verify = async () => {
        setLoading(true);
        await new Promise(r => setTimeout(r, 800));
        if (code === ADMIN_2FA_CODE) {
            onVerified();
        } else {
            setError(true);
            setCode('');
        }
        setLoading(false);
    };

    return (
        <div className="min-h-screen bg-[#080c10] flex items-center justify-center p-4">
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="w-full max-w-sm"
            >
                <div className="bg-[#0d1117] border border-white/10 rounded-2xl p-8 shadow-2xl">
                    <div className="flex items-center justify-center w-14 h-14 bg-cyan-500/10 border border-cyan-500/20 rounded-2xl mx-auto mb-6">
                        <Lock className="w-7 h-7 text-cyan-400" strokeWidth={1.5} />
                    </div>
                    <h2 className="text-xl font-black text-white text-center mb-1">Verificação em 2 etapas</h2>
                    <p className="text-sm text-zinc-500 text-center mb-6">
                        Insira o código de 6 dígitos enviado ao seu e-mail administrativo.
                    </p>
                    <div className="mb-1">
                        <input
                            type="text"
                            value={code}
                            onChange={e => { setCode(e.target.value.replace(/\D/g, '').slice(0, 6)); setError(false); }}
                            onKeyDown={e => e.key === 'Enter' && code.length === 6 && verify()}
                            placeholder="000000"
                            maxLength={6}
                            className={`w-full text-center text-3xl font-black tracking-[0.4em] py-4 bg-[#0a0e14] border rounded-xl text-white placeholder-zinc-700 outline-none transition-all ${
                                error ? 'border-red-500/60 text-red-400' : 'border-white/10 focus:border-cyan-500/60'
                            }`}
                        />
                    </div>
                    {error && (
                        <p className="text-xs text-red-400 text-center mb-4 mt-2">Código inválido. Tente novamente.</p>
                    )}
                    <button
                        onClick={verify}
                        disabled={code.length !== 6 || loading}
                        className="mt-4 w-full py-3.5 bg-cyan-500 hover:bg-cyan-400 disabled:bg-cyan-500/30 disabled:text-cyan-800 text-zinc-950 font-black rounded-xl transition-all text-sm"
                    >
                        {loading ? (
                            <span className="flex items-center justify-center gap-2">
                                <RefreshCw className="w-4 h-4 animate-spin" />
                                Verificando…
                            </span>
                        ) : 'Verificar código'}
                    </button>
                    <p className="text-xs text-zinc-600 text-center mt-4">
                        Código demo: <span className="text-zinc-400 font-mono font-bold">{ADMIN_2FA_CODE}</span>
                    </p>
                </div>
            </motion.div>
        </div>
    );
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────
const sidebarItems: { id: AdminSection; label: string; icon: React.ElementType; badge?: number }[] = [
    { id: 'dashboard',  label: 'Dashboard',        icon: LayoutDashboard },
    { id: 'users',      label: 'Usuários',          icon: Users           },
    { id: 'vehicles',   label: 'Veículos',          icon: Car             },
    { id: 'listings',   label: 'Anúncios',          icon: Package         },
    { id: 'messages',   label: 'Mensagens',         icon: MessageSquare,  badge: 3 },
    { id: 'reports',    label: 'Denúncias',         icon: Flag,           badge: 5 },
    { id: 'financial',  label: 'Financeiro',        icon: DollarSign      },
    { id: 'analytics',  label: 'Analytics',         icon: BarChart2       },
    { id: 'performance',label: 'Performance',       icon: Activity        },
    { id: 'logs',       label: 'Logs do Sistema',   icon: Terminal        },
    { id: 'antifraud',  label: 'Anti-Fraude',       icon: AlertOctagon,   badge: 4 },
    { id: 'settings',   label: 'Configurações',     icon: Settings        },
];

// ─── Stat Card ────────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, icon: Icon, color, trend }: {
    label: string; value: string | number; sub?: string;
    icon: React.ElementType; color: string; trend?: 'up' | 'down' | 'neutral';
}) {
    return (
        <div className="bg-[#0d1117] border border-white/8 rounded-2xl p-5 hover:border-white/15 transition-colors">
            <div className="flex items-start justify-between mb-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}>
                    <Icon className="w-5 h-5" strokeWidth={1.5} />
                </div>
                {trend && (
                    <span className={`flex items-center gap-1 text-xs font-bold ${
                        trend === 'up' ? 'text-emerald-400' : trend === 'down' ? 'text-red-400' : 'text-zinc-500'
                    }`}>
                        {trend === 'up' ? <ArrowUpRight className="w-3.5 h-3.5" /> : trend === 'down' ? <ArrowDownRight className="w-3.5 h-3.5" /> : null}
                        {sub}
                    </span>
                )}
            </div>
            <p className="text-2xl font-black text-white">{value}</p>
            <p className="text-xs text-zinc-500 mt-1">{label}</p>
        </div>
    );
}

// ─── Section Wrappers ─────────────────────────────────────────────────────────
function SectionWrap({ children }: { children: React.ReactNode }) {
    return (
        <motion.div
            key="section"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="space-y-6"
        >
            {children}
        </motion.div>
    );
}

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
    return (
        <div className={`bg-[#0d1117] border border-white/8 rounded-2xl overflow-hidden ${className}`}>
            {children}
        </div>
    );
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
export default function Admin() {
    const { user, signOut } = useAuth();
    const navigate = useNavigate();

    const isAdmin = ADMIN_EMAILS.includes((user?.email ?? '').toLowerCase());
    const [tfaVerified, setTfaVerified] = useState(() => {
        return sessionStorage.getItem('admin_2fa') === '1';
    });
    const [section, setSection] = useState<AdminSection>('dashboard');
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

    // Data
    const [cars, setCars] = useState<any[]>([]);
    const [users, setUsers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [carSearch, setCarSearch] = useState('');
    const [userSearch, setUserSearch] = useState('');
    const [userFilter, setUserFilter] = useState<'all' | 'verified' | 'suspended' | 'suspicious'>('all');
    const [carStatusFilter, setCarStatusFilter] = useState<'all' | 'active' | 'pending' | 'reported' | 'removed'>('all');
    const [bellOpen, setBellOpen] = useState(false);
    const bellRef = useRef<HTMLDivElement>(null);

    const [alertsList, setAlertsList] = useState<{ id: number; msg: string; level: 'warn' | 'error'; ts: string }[]>([
        { id: 1, msg: 'API lenta detectada (>500ms) na rota /anuncios', level: 'warn', ts: new Date(Date.now() - 600000).toISOString() },
        { id: 2, msg: 'Múltiplos anúncios suspeitos de baixo preço detectados', level: 'error', ts: new Date(Date.now() - 1200000).toISOString() },
        { id: 3, msg: 'Tentativas de login inválidas repetidas (5x) — IP bloqueado', level: 'error', ts: new Date(Date.now() - 3600000).toISOString() },
    ]);

    // Settings state
    const [settings, setSettings] = useState({
        maxListingsPerUser: 5,
        messageLimitPerDay: 50,
        requireVerification: true,
        maintenanceMode: false,
        autoApproveListings: false,
    });

    const handleTfaVerified = () => {
        sessionStorage.setItem('admin_2fa', '1');
        setTfaVerified(true);
    };

    const loadData = useCallback(async () => {
        setRefreshing(true);
        try {
            const [{ data: carsData }, { data: profilesData }] = await Promise.all([
                supabasePublic.from('anuncios').select('*').order('created_at', { ascending: false }),
                supabasePublic.from('profiles').select('*'),
            ]);
            setCars(carsData || []);
            setUsers(profilesData || []);
        } catch { } finally { setLoading(false); setRefreshing(false); }
    }, []);

    useEffect(() => {
        if (isAdmin && tfaVerified) loadData();
        else setLoading(false);
    }, [isAdmin, tfaVerified, loadData]);

    // Action handlers
    const deleteCar = async (id: string) => {
        if (!confirm('Excluir este anúncio permanentemente?')) return;
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

    const approveCar = async (id: string) => {
        try {
            await supabase.from('anuncios').update({ aprovado: true }).eq('id', id);
            setCars(c => c.map(x => x.id === id ? { ...x, aprovado: true } : x));
            toast.success('Anúncio aprovado.');
        } catch { toast.error('Erro.'); }
    };

    const handleSignOut = async () => {
        sessionStorage.removeItem('admin_2fa');
        await signOut();
        navigate('/login');
    };

    const dismissAlert = (id: number) => setAlertsList(a => a.filter(x => x.id !== id));

    // Close bell dropdown on outside click
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (bellRef.current && !bellRef.current.contains(e.target as Node)) {
                setBellOpen(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    // Derived
    const stats = {
        totalUsers: users.length,
        totalCars: cars.length,
        activeCars: cars.filter(c => !c.deleted_at && c.aprovado).length,
        pendingCars: cars.filter(c => !c.aprovado && !c.deleted_at).length,
        featuredCars: cars.filter(c => c.destaque).length,
        messages: 9420,
        todayUsers: 120,
        todayCars: 34,
    };

    const filteredCars = cars.filter(c => {
        const matchSearch = `${c.marca} ${c.modelo} ${c.cidade}`.toLowerCase().includes(carSearch.toLowerCase());
        const matchStatus = carStatusFilter === 'all' ? true
            : carStatusFilter === 'active' ? (c.aprovado && !c.deleted_at)
            : carStatusFilter === 'pending' ? !c.aprovado
            : carStatusFilter === 'removed' ? !!c.deleted_at
            : true;
        return matchSearch && matchStatus;
    });

    const filteredUsers = users.filter(u => {
        const matchSearch = `${u.full_name || ''} ${u.email || ''}`.toLowerCase().includes(userSearch.toLowerCase());
        return matchSearch;
    });

    // ── Guard: not admin ───────────────────────────────────────────────────────
    if (!user || !isAdmin) {
        return (
            <div className="min-h-screen bg-[#080c10] flex flex-col items-center justify-center gap-4 p-4">
                <div className="w-16 h-16 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center justify-center mb-2">
                    <Shield className="w-8 h-8 text-red-400" strokeWidth={1.5} />
                </div>
                <h2 className="text-2xl font-black text-white">Acesso restrito</h2>
                <p className="text-zinc-500 text-sm">Você não tem permissão para acessar esta área.</p>
                <Link to="/" className="mt-2 px-6 py-2.5 bg-cyan-500 text-zinc-950 font-black rounded-xl hover:bg-cyan-400 transition-colors text-sm">
                    Voltar ao início
                </Link>
            </div>
        );
    }

    // ── Guard: 2FA ─────────────────────────────────────────────────────────────
    if (!tfaVerified) {
        return <TwoFactorGate onVerified={handleTfaVerified} />;
    }

    // ─────────────────────────────────────────────────────────────────────────
    return (
        <div className="flex h-screen bg-[#080c10] overflow-hidden">

            {/* ── SIDEBAR ── */}
            <aside className={`flex-shrink-0 flex flex-col bg-[#0a0e14] border-r border-white/8 transition-all duration-300 ${sidebarCollapsed ? 'w-16' : 'w-60'}`}>
                {/* Logo */}
                <div className="flex items-center gap-3 px-4 py-5 border-b border-white/8">
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden">
                        <img src="/sulmotor-logo-64.png" alt="SulMotor" className="w-8 h-8 object-contain" />
                    </div>
                    {!sidebarCollapsed && (
                        <div>
                            <span className="text-sm font-black text-white leading-none block">SulMotor</span>
                            <span className="text-[10px] text-cyan-400 font-bold uppercase tracking-widest">Admin</span>
                        </div>
                    )}
                    <button
                        onClick={() => setSidebarCollapsed(v => !v)}
                        className="ml-auto text-zinc-600 hover:text-zinc-300 transition-colors"
                    >
                        <ChevronRight className={`w-4 h-4 transition-transform ${sidebarCollapsed ? '' : 'rotate-180'}`} />
                    </button>
                </div>

                {/* Nav */}
                <nav className="flex-1 overflow-y-auto py-3 space-y-0.5 px-2">
                    {sidebarItems.map(({ id, label, icon: Icon, badge }) => (
                        <button
                            key={id}
                            onClick={() => setSection(id)}
                            title={sidebarCollapsed ? label : undefined}
                            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all relative ${
                                section === id
                                    ? 'bg-cyan-500/10 border border-cyan-500/20 text-cyan-400'
                                    : 'border border-transparent text-zinc-500 hover:bg-white/5 hover:text-zinc-200'
                            }`}
                        >
                            <Icon className="w-4 h-4 flex-shrink-0" strokeWidth={1.5} />
                            {!sidebarCollapsed && <span className="truncate">{label}</span>}
                            {badge && !sidebarCollapsed && (
                                <span className="ml-auto bg-red-500 text-white text-[10px] font-black rounded-full w-4 h-4 flex items-center justify-center flex-shrink-0">
                                    {badge}
                                </span>
                            )}
                            {badge && sidebarCollapsed && (
                                <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[9px] font-black rounded-full w-3.5 h-3.5 flex items-center justify-center">
                                    {badge}
                                </span>
                            )}
                        </button>
                    ))}
                </nav>

                {/* Bottom */}
                <div className="border-t border-white/8 p-3 space-y-1">
                    <Link to="/" className={`flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold text-zinc-500 hover:text-zinc-200 hover:bg-white/5 transition-all ${sidebarCollapsed ? 'justify-center' : ''}`} title={sidebarCollapsed ? 'Ver site' : undefined}>
                        <ExternalLink className="w-4 h-4 flex-shrink-0" strokeWidth={1.5} />
                        {!sidebarCollapsed && 'Ver site'}
                    </Link>
                    <button onClick={handleSignOut} className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-all ${sidebarCollapsed ? 'justify-center' : ''}`} title={sidebarCollapsed ? 'Sair' : undefined}>
                        <LogOut className="w-4 h-4 flex-shrink-0" strokeWidth={1.5} />
                        {!sidebarCollapsed && 'Sair'}
                    </button>
                </div>
            </aside>

            {/* ── MAIN ── */}
            <div className="flex-1 flex flex-col overflow-hidden">

                {/* ── TOPBAR ── */}
                <header className="flex-shrink-0 flex items-center gap-4 px-6 py-4 bg-[#0a0e14] border-b border-white/8">
                    {/* Search */}
                    <div className="flex-1 relative max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" strokeWidth={1.5} />
                        <input
                            type="text"
                            placeholder="Buscar usuários, anúncios…"
                            className="w-full pl-9 pr-4 py-2 bg-[#0d1117] border border-white/8 focus:border-cyan-500/40 rounded-xl text-sm text-white placeholder-zinc-600 outline-none transition-all"
                        />
                    </div>

                    {/* Alerts bell */}
                    <div className="relative" ref={bellRef}>
                        <button
                            onClick={() => setBellOpen(v => !v)}
                            className={`relative w-9 h-9 flex items-center justify-center bg-[#0d1117] border rounded-xl transition-all ${
                                bellOpen
                                    ? 'border-cyan-500/40 text-cyan-400'
                                    : 'border-white/8 text-zinc-500 hover:text-white hover:border-white/20'
                            }`}
                        >
                            <Bell className="w-4 h-4" strokeWidth={1.5} />
                            {alertsList.length > 0 && (
                                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-black rounded-full w-4 h-4 flex items-center justify-center">
                                    {alertsList.length}
                                </span>
                            )}
                        </button>

                        {/* Notification dropdown */}
                        <AnimatePresence>
                            {bellOpen && (
                                <motion.div
                                    initial={{ opacity: 0, y: -8, scale: 0.96 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    exit={{ opacity: 0, y: -8, scale: 0.96 }}
                                    transition={{ duration: 0.15 }}
                                    className="absolute right-0 top-full mt-2 w-80 z-50 bg-[#0d1117] border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
                                >
                                    {/* Header */}
                                    <div className="flex items-center justify-between px-4 py-3 border-b border-white/8">
                                        <div className="flex items-center gap-2">
                                            <Bell className="w-4 h-4 text-amber-400" strokeWidth={1.5} />
                                            <span className="text-sm font-black text-white">Alertas</span>
                                            {alertsList.length > 0 && (
                                                <span className="bg-red-500/20 text-red-400 text-[10px] font-black rounded-full px-1.5 py-0.5">
                                                    {alertsList.length}
                                                </span>
                                            )}
                                        </div>
                                        <button
                                            onClick={() => { setBellOpen(false); setSection('logs'); }}
                                            className="text-[10px] text-cyan-400 font-bold hover:text-cyan-300 transition-colors"
                                        >
                                            Ver todos
                                        </button>
                                    </div>

                                    {/* Alert list */}
                                    <div className="max-h-72 overflow-y-auto divide-y divide-white/5">
                                        {alertsList.length === 0 ? (
                                            <div className="flex flex-col items-center justify-center py-8 gap-2">
                                                <CheckCheck className="w-6 h-6 text-emerald-500" strokeWidth={1.5} />
                                                <p className="text-xs text-zinc-500">Nenhum alerta ativo</p>
                                            </div>
                                        ) : alertsList.map(al => (
                                            <div
                                                key={al.id}
                                                className={`flex items-start gap-3 px-4 py-3 hover:bg-white/3 transition-colors border-l-2 ${
                                                    al.level === 'error' ? 'border-red-500/50' : 'border-amber-500/50'
                                                }`}
                                            >
                                                <AlertTriangle
                                                    className={`w-4 h-4 flex-shrink-0 mt-0.5 ${
                                                        al.level === 'error' ? 'text-red-400' : 'text-amber-400'
                                                    }`}
                                                    strokeWidth={1.5}
                                                />
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-xs text-zinc-300 leading-relaxed">{al.msg}</p>
                                                    <p className="text-[10px] text-zinc-600 mt-0.5">{timeAgo(al.ts)}</p>
                                                </div>
                                                <button
                                                    onClick={() => dismissAlert(al.id)}
                                                    className="text-zinc-700 hover:text-zinc-400 transition-colors flex-shrink-0 mt-0.5"
                                                >
                                                    <X className="w-3.5 h-3.5" strokeWidth={2} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Footer */}
                                    {alertsList.length > 0 && (
                                        <div className="px-4 py-3 border-t border-white/8">
                                            <button
                                                onClick={() => { setAlertsList([]); setBellOpen(false); }}
                                                className="w-full text-xs text-zinc-500 hover:text-zinc-300 font-semibold transition-colors text-center"
                                            >
                                                Limpar todos os alertas
                                            </button>
                                        </div>
                                    )}
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    {/* Refresh */}
                    <button onClick={loadData} disabled={refreshing} className="w-9 h-9 flex items-center justify-center bg-[#0d1117] border border-white/8 rounded-xl text-zinc-500 hover:text-white hover:border-white/20 transition-all">
                        <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} strokeWidth={1.5} />
                    </button>

                    {/* Admin badge */}
                    <div className="flex items-center gap-2.5 pl-2 border-l border-white/8">
                        <div className="w-8 h-8 bg-cyan-500/15 border border-cyan-500/20 rounded-full flex items-center justify-center">
                            <span className="text-xs font-black text-cyan-400">A</span>
                        </div>
                        <div className="hidden sm:block">
                            <p className="text-xs font-black text-white leading-none">Admin</p>
                            <p className="text-[10px] text-zinc-600 truncate max-w-[140px]">{user.email}</p>
                        </div>
                    </div>
                </header>

                {/* ── ALERT BANNER ── */}
                {alertsList.length > 0 && (
                    <div className="flex-shrink-0 px-6 py-3 bg-red-950/30 border-b border-red-500/20 flex items-center gap-3">
                        <AlertOctagon className="w-4 h-4 text-red-400 flex-shrink-0" strokeWidth={1.5} />
                        <p className="text-xs text-red-300 flex-1 truncate">{alertsList[0].msg}</p>
                        <button onClick={() => setSection('logs')} className="text-xs text-red-400 font-bold hover:text-red-300 flex-shrink-0">Ver logs</button>
                        <button onClick={() => dismissAlert(alertsList[0].id)} className="text-zinc-600 hover:text-zinc-300">
                            <X className="w-3.5 h-3.5" strokeWidth={2} />
                        </button>
                    </div>
                )}

                {/* ── CONTENT ── */}
                <main className="flex-1 overflow-y-auto p-6">
                    <AnimatePresence mode="wait">

                        {/* ════════════════════ DASHBOARD ════════════════════ */}
                        {section === 'dashboard' && (
                            <SectionWrap key="dashboard">
                                <div className="flex items-center justify-between mb-2">
                                    <div>
                                        <h1 className="text-xl font-black text-white">Dashboard</h1>
                                        <p className="text-xs text-zinc-500">Visão geral do sistema — {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
                                    </div>
                                </div>

                                {/* KPI Cards */}
                                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                                    <StatCard label="Usuários cadastrados" value={loading ? '—' : `${stats.totalUsers.toLocaleString('pt-BR')}`} sub={`+${stats.todayUsers} hoje`} icon={Users} color="bg-blue-500/10 text-blue-400" trend="up" />
                                    <StatCard label="Anúncios ativos" value={loading ? '—' : stats.activeCars} sub={`+${stats.todayCars} hoje`} icon={Car} color="bg-cyan-500/10 text-cyan-400" trend="up" />
                                    <StatCard label="Publicados hoje" value={loading ? '—' : stats.todayCars} sub="veículos" icon={Package} color="bg-violet-500/10 text-violet-400" trend="neutral" />
                                    <StatCard label="Mensagens trocadas" value="9.420" sub="+312 hoje" icon={MessageSquare} color="bg-emerald-500/10 text-emerald-400" trend="up" />
                                </div>
                                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                                    <StatCard label="Pendentes de aprovação" value={loading ? '—' : stats.pendingCars} sub="requerem ação" icon={AlertTriangle} color="bg-amber-500/10 text-amber-400" trend="neutral" />
                                    <StatCard label="Em destaque" value={loading ? '—' : stats.featuredCars} sub="anúncios" icon={Star} color="bg-yellow-500/10 text-yellow-400" trend="neutral" />
                                    <StatCard label="Denúncias abertas" value="5" sub="pendentes" icon={Flag} color="bg-red-500/10 text-red-400" trend="down" />
                                    <StatCard label="Receita MRR" value="R$ 2.937" sub="+8.4% vs último mês" icon={DollarSign} color="bg-green-500/10 text-green-400" trend="up" />
                                </div>

                                {/* Charts row */}
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                    {/* User growth */}
                                    <Card>
                                        <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between">
                                            <h3 className="text-sm font-black text-white">Crescimento de usuários</h3>
                                            <span className="text-xs text-zinc-600">7 dias</span>
                                        </div>
                                        <div className="p-4">
                                            <ResponsiveContainer width="100%" height={180}>
                                                <AreaChart data={userGrowthData}>
                                                    <defs>
                                                        <linearGradient id="colorUsers" x1="0" y1="0" x2="0" y2="1">
                                                            <stop offset="5%" stopColor="#22d3ee" stopOpacity={0.3} />
                                                            <stop offset="95%" stopColor="#22d3ee" stopOpacity={0} />
                                                        </linearGradient>
                                                    </defs>
                                                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" />
                                                    <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#52525b' }} axisLine={false} tickLine={false} />
                                                    <YAxis tick={{ fontSize: 11, fill: '#52525b' }} axisLine={false} tickLine={false} width={28} />
                                                    <Tooltip contentStyle={{ background: '#0d1117', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, fontSize: 12 }} labelStyle={{ color: '#a1a1aa' }} itemStyle={{ color: '#22d3ee' }} />
                                                    <Area type="monotone" dataKey="users" stroke="#22d3ee" strokeWidth={2} fill="url(#colorUsers)" />
                                                </AreaChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </Card>

                                    {/* Listing activity */}
                                    <Card>
                                        <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between">
                                            <h3 className="text-sm font-black text-white">Atividade de anúncios</h3>
                                            <span className="text-xs text-zinc-600">7 dias</span>
                                        </div>
                                        <div className="p-4">
                                            <ResponsiveContainer width="100%" height={180}>
                                                <BarChart data={listingActivityData} barGap={2}>
                                                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" />
                                                    <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#52525b' }} axisLine={false} tickLine={false} />
                                                    <YAxis tick={{ fontSize: 11, fill: '#52525b' }} axisLine={false} tickLine={false} width={28} />
                                                    <Tooltip contentStyle={{ background: '#0d1117', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, fontSize: 12 }} labelStyle={{ color: '#a1a1aa' }} />
                                                    <Bar dataKey="created" name="Criados" fill="#22d3ee" radius={[3, 3, 0, 0]} />
                                                    <Bar dataKey="approved" name="Aprovados" fill="#3b82f6" radius={[3, 3, 0, 0]} />
                                                    <Bar dataKey="removed" name="Removidos" fill="#ef4444" radius={[3, 3, 0, 0]} />
                                                </BarChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </Card>
                                </div>

                                {/* Engagement + Brand pie */}
                                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                    <Card className="lg:col-span-2">
                                        <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between">
                                            <h3 className="text-sm font-black text-white">Engajamento</h3>
                                            <span className="text-xs text-zinc-600">mensagens · visualizações · favoritos</span>
                                        </div>
                                        <div className="p-4">
                                            <ResponsiveContainer width="100%" height={180}>
                                                <LineChart data={engagementData}>
                                                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" />
                                                    <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#52525b' }} axisLine={false} tickLine={false} />
                                                    <YAxis tick={{ fontSize: 11, fill: '#52525b' }} axisLine={false} tickLine={false} width={32} />
                                                    <Tooltip contentStyle={{ background: '#0d1117', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, fontSize: 12 }} labelStyle={{ color: '#a1a1aa' }} />
                                                    <Line type="monotone" dataKey="messages" name="Mensagens" stroke="#22d3ee" strokeWidth={2} dot={false} />
                                                    <Line type="monotone" dataKey="views" name="Visualizações" stroke="#8b5cf6" strokeWidth={2} dot={false} />
                                                    <Line type="monotone" dataKey="favorites" name="Favoritos" stroke="#f59e0b" strokeWidth={2} dot={false} />
                                                </LineChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </Card>

                                    {/* Top brands */}
                                    <Card>
                                        <div className="px-5 py-4 border-b border-white/5">
                                            <h3 className="text-sm font-black text-white">Marcas mais buscadas</h3>
                                        </div>
                                        <div className="p-4 flex flex-col items-center">
                                            <ResponsiveContainer width="100%" height={140}>
                                                <RePieChart>
                                                    <Pie data={brandData} cx="50%" cy="50%" innerRadius={40} outerRadius={60} paddingAngle={2} dataKey="value">
                                                        {brandData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                                                    </Pie>
                                                    <Tooltip contentStyle={{ background: '#0d1117', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, fontSize: 12 }} />
                                                </RePieChart>
                                            </ResponsiveContainer>
                                            <div className="w-full space-y-1.5 mt-2">
                                                {brandData.map((b, i) => (
                                                    <div key={b.name} className="flex items-center justify-between">
                                                        <div className="flex items-center gap-2">
                                                            <div className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: PIE_COLORS[i] }} />
                                                            <span className="text-xs text-zinc-400">{b.name}</span>
                                                        </div>
                                                        <span className="text-xs font-bold text-white">{b.value}%</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </Card>
                                </div>

                                {/* Recent listings */}
                                <Card>
                                    <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between">
                                        <h3 className="text-sm font-black text-white">Últimos anúncios</h3>
                                        <button onClick={() => setSection('listings')} className="text-xs text-cyan-400 font-bold hover:text-cyan-300">Ver todos</button>
                                    </div>
                                    <div className="divide-y divide-white/5">
                                        {loading ? (
                                            <p className="p-6 text-sm text-zinc-600 text-center">Carregando…</p>
                                        ) : cars.slice(0, 6).map(car => (
                                            <div key={car.id} className="flex items-center gap-4 px-5 py-3 hover:bg-white/3 transition-colors">
                                                <div className="w-12 h-9 rounded-lg overflow-hidden bg-zinc-800 flex-shrink-0">
                                                    {car.imagens?.[0]
                                                        ? <img src={car.imagens[0]} alt="" className="w-full h-full object-cover" />
                                                        : <div className="w-full h-full flex items-center justify-center"><Car className="w-4 h-4 text-zinc-600" strokeWidth={1.5} /></div>
                                                    }
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-bold text-white truncate">{car.marca} {car.modelo} {car.ano}</p>
                                                    <p className="text-xs text-zinc-600">{car.cidade} · {timeAgo(car.created_at)}</p>
                                                </div>
                                                <div className="text-right flex-shrink-0">
                                                    <p className="text-sm font-black text-cyan-400">{formatBRL(car.preco)}</p>
                                                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${
                                                        car.aprovado ? 'bg-emerald-500/15 text-emerald-400' : 'bg-amber-500/15 text-amber-400'
                                                    }`}>{car.aprovado ? 'Ativo' : 'Pendente'}</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </Card>
                            </SectionWrap>
                        )}

                        {/* ════════════════════ USERS ════════════════════ */}
                        {section === 'users' && (
                            <SectionWrap key="users">
                                <div className="flex items-center justify-between">
                                    <h1 className="text-xl font-black text-white">Usuários</h1>
                                    <span className="text-sm text-zinc-600">{filteredUsers.length} registros</span>
                                </div>

                                {/* Filters */}
                                <div className="flex flex-wrap gap-2 items-center">
                                    <div className="relative flex-1 max-w-sm">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" strokeWidth={1.5} />
                                        <input type="text" value={userSearch} onChange={e => setUserSearch(e.target.value)}
                                            placeholder="Buscar nome ou e-mail…"
                                            className="w-full pl-9 pr-4 py-2.5 bg-[#0d1117] border border-white/8 focus:border-cyan-500/40 rounded-xl text-sm text-white placeholder-zinc-600 outline-none" />
                                    </div>
                                    {(['all', 'verified', 'suspended', 'suspicious'] as const).map(f => (
                                        <button key={f} onClick={() => setUserFilter(f)}
                                            className={`px-3 py-2 rounded-xl text-xs font-bold transition-all border ${
                                                userFilter === f ? 'bg-cyan-500/10 border-cyan-500/20 text-cyan-400' : 'border-white/8 text-zinc-500 hover:text-zinc-200 hover:bg-white/5'
                                            }`}>
                                            {{ all: 'Todos', verified: 'Verificados', suspended: 'Suspensos', suspicious: 'Suspeitos' }[f]}
                                        </button>
                                    ))}
                                </div>

                                <Card>
                                    <div className="overflow-x-auto">
                                        <table className="w-full">
                                            <thead>
                                                <tr className="border-b border-white/5">
                                                    <th className="px-5 py-3 text-left text-xs font-bold text-zinc-500 uppercase tracking-wider">Usuário</th>
                                                    <th className="px-4 py-3 text-left text-xs font-bold text-zinc-500 uppercase tracking-wider hidden sm:table-cell">Cadastro</th>
                                                    <th className="px-4 py-3 text-left text-xs font-bold text-zinc-500 uppercase tracking-wider hidden md:table-cell">Anúncios</th>
                                                    <th className="px-4 py-3 text-left text-xs font-bold text-zinc-500 uppercase tracking-wider hidden lg:table-cell">Status</th>
                                                    <th className="px-4 py-3 text-right text-xs font-bold text-zinc-500 uppercase tracking-wider">Ações</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-white/5">
                                                {loading ? (
                                                    <tr><td colSpan={5} className="px-5 py-8 text-sm text-zinc-600 text-center">Carregando…</td></tr>
                                                ) : filteredUsers.length === 0 ? (
                                                    <tr><td colSpan={5} className="px-5 py-8 text-sm text-zinc-600 text-center">Nenhum usuário encontrado.</td></tr>
                                                ) : filteredUsers.map((u: any) => {
                                                    const userCars = cars.filter(c => c.user_id === u.id).length;
                                                    return (
                                                        <tr key={u.id} className="hover:bg-white/3 transition-colors">
                                                            <td className="px-5 py-3">
                                                                <div className="flex items-center gap-3">
                                                                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center text-zinc-950 text-xs font-black flex-shrink-0 overflow-hidden">
                                                                        {u.avatar_url ? <img src={u.avatar_url} alt="" className="w-full h-full object-cover" /> : (u.full_name?.[0] || '?')}
                                                                    </div>
                                                                    <div>
                                                                        <p className="text-sm font-bold text-white">{u.full_name || 'Sem nome'}</p>
                                                                        <p className="text-xs text-zinc-600 truncate max-w-[180px]">{u.phone || u.email || '—'}</p>
                                                                    </div>
                                                                </div>
                                                            </td>
                                                            <td className="px-4 py-3 hidden sm:table-cell">
                                                                <span className="text-xs text-zinc-500">{u.created_at ? fmtDate(u.created_at) : '—'}</span>
                                                            </td>
                                                            <td className="px-4 py-3 hidden md:table-cell">
                                                                <span className="text-sm font-bold text-zinc-300">{userCars}</span>
                                                            </td>
                                                            <td className="px-4 py-3 hidden lg:table-cell">
                                                                <span className="px-2 py-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold rounded-lg">
                                                                    Ativo
                                                                </span>
                                                            </td>
                                                            <td className="px-4 py-3">
                                                                <div className="flex items-center justify-end gap-1">
                                                                    <button title="Ver perfil" className="w-7 h-7 flex items-center justify-center text-zinc-600 hover:text-cyan-400 hover:bg-cyan-500/10 rounded-lg transition-all">
                                                                        <Eye className="w-3.5 h-3.5" strokeWidth={1.5} />
                                                                    </button>
                                                                    <button title="Verificar conta" className="w-7 h-7 flex items-center justify-center text-zinc-600 hover:text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition-all">
                                                                        <UserCheck className="w-3.5 h-3.5" strokeWidth={1.5} />
                                                                    </button>
                                                                    <button title="Suspender" className="w-7 h-7 flex items-center justify-center text-zinc-600 hover:text-amber-400 hover:bg-amber-500/10 rounded-lg transition-all">
                                                                        <Lock className="w-3.5 h-3.5" strokeWidth={1.5} />
                                                                    </button>
                                                                    <button title="Banir usuário" className="w-7 h-7 flex items-center justify-center text-zinc-600 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all">
                                                                        <Ban className="w-3.5 h-3.5" strokeWidth={1.5} />
                                                                    </button>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                </Card>

                                {/* User verification section */}
                                <Card>
                                    <div className="px-5 py-4 border-b border-white/5">
                                        <h3 className="text-sm font-black text-white">Verificação de contas</h3>
                                        <p className="text-xs text-zinc-600 mt-0.5">Aprovação de documentos, selfie e CPF para badge ✔ Conta Verificada</p>
                                    </div>
                                    <div className="p-5 grid grid-cols-1 md:grid-cols-3 gap-4">
                                        {[
                                            { label: 'Pendentes de revisão', val: 3, color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20' },
                                            { label: 'Aprovadas hoje', val: 7, color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' },
                                            { label: 'Total verificados', val: 142, color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20' },
                                        ].map(x => (
                                            <div key={x.label} className={`border rounded-xl p-4 ${x.bg}`}>
                                                <p className={`text-2xl font-black ${x.color}`}>{x.val}</p>
                                                <p className="text-xs text-zinc-500 mt-1">{x.label}</p>
                                            </div>
                                        ))}
                                    </div>
                                </Card>
                            </SectionWrap>
                        )}

                        {/* ════════════════════ VEHICLES ════════════════════ */}
                        {section === 'vehicles' && (
                            <SectionWrap key="vehicles">
                                <h1 className="text-xl font-black text-white">Veículos</h1>

                                {/* Marketplace analytics */}
                                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                                    <StatCard label="Preço médio" value="R$ 68.400" icon={TrendingUp} color="bg-cyan-500/10 text-cyan-400" />
                                    <StatCard label="Mais vistos" value="BMW 3 Series" icon={Eye} color="bg-blue-500/10 text-blue-400" />
                                    <StatCard label="Taxa de contato" value="12.4%" icon={MessageSquare} color="bg-violet-500/10 text-violet-400" />
                                    <StatCard label="Tempo médio ativo" value="18 dias" icon={Clock} color="bg-amber-500/10 text-amber-400" />
                                </div>

                                <Card>
                                    <div className="px-5 py-4 border-b border-white/5">
                                        <h3 className="text-sm font-black text-white">Marcas mais buscadas</h3>
                                    </div>
                                    <div className="p-5 space-y-3">
                                        {[
                                            { brand: 'BMW', searches: 4280, pct: 18 },
                                            { brand: 'Toyota', searches: 3950, pct: 15 },
                                            { brand: 'Honda', searches: 3410, pct: 13 },
                                            { brand: 'Audi', searches: 2890, pct: 11 },
                                            { brand: 'Volkswagen', searches: 2200, pct: 9 },
                                        ].map(b => (
                                            <div key={b.brand} className="flex items-center gap-3">
                                                <span className="text-sm font-bold text-zinc-300 w-24">{b.brand}</span>
                                                <div className="flex-1 h-2 bg-white/5 rounded-full overflow-hidden">
                                                    <div className="h-full bg-cyan-500 rounded-full" style={{ width: `${b.pct * 5}%` }} />
                                                </div>
                                                <span className="text-xs text-zinc-500 w-16 text-right">{b.searches.toLocaleString('pt-BR')}</span>
                                                <span className="text-xs font-bold text-cyan-400 w-8 text-right">{b.pct}%</span>
                                            </div>
                                        ))}
                                    </div>
                                </Card>
                            </SectionWrap>
                        )}

                        {/* ════════════════════ LISTINGS ════════════════════ */}
                        {section === 'listings' && (
                            <SectionWrap key="listings">
                                <div className="flex items-center justify-between">
                                    <h1 className="text-xl font-black text-white">Anúncios</h1>
                                    <span className="text-sm text-zinc-600">{filteredCars.length} resultados</span>
                                </div>

                                <div className="flex flex-wrap gap-2 items-center">
                                    <div className="relative flex-1 max-w-sm">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" strokeWidth={1.5} />
                                        <input type="text" value={carSearch} onChange={e => setCarSearch(e.target.value)}
                                            placeholder="Marca, modelo, cidade…"
                                            className="w-full pl-9 pr-4 py-2.5 bg-[#0d1117] border border-white/8 focus:border-cyan-500/40 rounded-xl text-sm text-white placeholder-zinc-600 outline-none" />
                                    </div>
                                    {(['all', 'active', 'pending', 'reported', 'removed'] as const).map(f => (
                                        <button key={f} onClick={() => setCarStatusFilter(f)}
                                            className={`px-3 py-2 rounded-xl text-xs font-bold transition-all border ${
                                                carStatusFilter === f ? 'bg-cyan-500/10 border-cyan-500/20 text-cyan-400' : 'border-white/8 text-zinc-500 hover:text-zinc-200 hover:bg-white/5'
                                            }`}>
                                            {{ all: 'Todos', active: 'Ativos', pending: 'Pendentes', reported: 'Denunciados', removed: 'Removidos' }[f]}
                                        </button>
                                    ))}
                                </div>

                                <Card>
                                    <div className="overflow-x-auto">
                                        <table className="w-full">
                                            <thead>
                                                <tr className="border-b border-white/5">
                                                    <th className="px-5 py-3 text-left text-xs font-bold text-zinc-500 uppercase tracking-wider">Veículo</th>
                                                    <th className="px-4 py-3 text-left text-xs font-bold text-zinc-500 uppercase tracking-wider hidden sm:table-cell">Preço</th>
                                                    <th className="px-4 py-3 text-left text-xs font-bold text-zinc-500 uppercase tracking-wider hidden md:table-cell">Data</th>
                                                    <th className="px-4 py-3 text-left text-xs font-bold text-zinc-500 uppercase tracking-wider hidden lg:table-cell">Status</th>
                                                    <th className="px-4 py-3 text-right text-xs font-bold text-zinc-500 uppercase tracking-wider">Ações</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-white/5">
                                                {loading ? (
                                                    <tr><td colSpan={5} className="px-5 py-8 text-sm text-zinc-600 text-center">Carregando…</td></tr>
                                                ) : filteredCars.length === 0 ? (
                                                    <tr><td colSpan={5} className="px-5 py-8 text-sm text-zinc-600 text-center">Nenhum anúncio encontrado.</td></tr>
                                                ) : filteredCars.map(car => (
                                                    <tr key={car.id} className="hover:bg-white/3 transition-colors">
                                                        <td className="px-5 py-3">
                                                            <div className="flex items-center gap-3">
                                                                <div className="w-12 h-9 rounded-lg overflow-hidden bg-zinc-800 flex-shrink-0">
                                                                    {car.imagens?.[0]
                                                                        ? <img src={car.imagens[0]} alt="" className="w-full h-full object-cover" />
                                                                        : <div className="w-full h-full flex items-center justify-center"><Car className="w-4 h-4 text-zinc-600" strokeWidth={1.5} /></div>
                                                                    }
                                                                </div>
                                                                <div>
                                                                    <p className="text-sm font-bold text-white">{car.marca} {car.modelo} {car.ano}</p>
                                                                    <p className="text-xs text-zinc-600">{car.cidade}</p>
                                                                </div>
                                                                {car.destaque && <span className="px-1.5 py-0.5 bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[10px] font-bold rounded">★</span>}
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-3 hidden sm:table-cell">
                                                            <span className="text-sm font-bold text-cyan-400">{formatBRL(car.preco)}</span>
                                                        </td>
                                                        <td className="px-4 py-3 hidden md:table-cell">
                                                            <span className="text-xs text-zinc-500">{timeAgo(car.created_at)}</span>
                                                        </td>
                                                        <td className="px-4 py-3 hidden lg:table-cell">
                                                            <span className={`px-2 py-1 text-xs font-bold rounded-lg border ${
                                                                car.aprovado ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                                                                    : 'bg-amber-500/10 border-amber-500/20 text-amber-400'
                                                            }`}>
                                                                {car.aprovado ? 'Ativo' : 'Pendente'}
                                                            </span>
                                                        </td>
                                                        <td className="px-4 py-3">
                                                            <div className="flex items-center justify-end gap-1">
                                                                <Link to={`/carro/${car.slug || car.id}`} title="Visualizar" className="w-7 h-7 flex items-center justify-center text-zinc-600 hover:text-cyan-400 hover:bg-cyan-500/10 rounded-lg transition-all">
                                                                    <Eye className="w-3.5 h-3.5" strokeWidth={1.5} />
                                                                </Link>
                                                                {!car.aprovado && (
                                                                    <button onClick={() => approveCar(car.id)} title="Aprovar" className="w-7 h-7 flex items-center justify-center text-zinc-600 hover:text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition-all">
                                                                        <CheckCheck className="w-3.5 h-3.5" strokeWidth={1.5} />
                                                                    </button>
                                                                )}
                                                                <button onClick={() => toggleDestaque(car.id, car.destaque)} title={car.destaque ? 'Remover destaque' : 'Destacar'} className={`w-7 h-7 flex items-center justify-center rounded-lg transition-all ${car.destaque ? 'text-amber-400 bg-amber-500/10' : 'text-zinc-600 hover:text-amber-400 hover:bg-amber-500/10'}`}>
                                                                    <Star className="w-3.5 h-3.5" strokeWidth={1.5} />
                                                                </button>
                                                                <button onClick={() => deleteCar(car.id)} title="Remover" className="w-7 h-7 flex items-center justify-center text-zinc-600 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all">
                                                                    <Trash2 className="w-3.5 h-3.5" strokeWidth={1.5} />
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </Card>
                            </SectionWrap>
                        )}

                        {/* ════════════════════ MESSAGES ════════════════════ */}
                        {section === 'messages' && (
                            <SectionWrap key="messages">
                                <h1 className="text-xl font-black text-white">Monitoramento de mensagens</h1>

                                <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                                    <StatCard label="Mensagens hoje" value="312" icon={MessageSquare} color="bg-cyan-500/10 text-cyan-400" sub="+12%" trend="up" />
                                    <StatCard label="Conversas abertas" value="48" icon={Hash} color="bg-blue-500/10 text-blue-400" />
                                    <StatCard label="Mensagens sinalizadas" value="3" icon={Flag} color="bg-red-500/10 text-red-400" sub="revisar" trend="neutral" />
                                </div>

                                <Card>
                                    <div className="px-5 py-4 border-b border-white/5 flex items-center gap-2">
                                        <AlertTriangle className="w-4 h-4 text-amber-400" strokeWidth={1.5} />
                                        <h3 className="text-sm font-black text-white">Mensagens sinalizadas</h3>
                                        <span className="ml-auto text-xs text-zinc-600">palavras-chave: {FLAG_KEYWORDS.join(', ')}</span>
                                    </div>
                                    <div className="divide-y divide-white/5">
                                        {mockMessages.map(msg => (
                                            <div key={msg.id} className={`flex items-start gap-4 px-5 py-4 hover:bg-white/3 transition-colors ${msg.flagged ? 'border-l-2 border-amber-500/40' : ''}`}>
                                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black flex-shrink-0 ${msg.flagged ? 'bg-amber-500/15 text-amber-400' : 'bg-zinc-800 text-zinc-400'}`}>
                                                    {msg.user[0]}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2 mb-0.5">
                                                        <span className="text-sm font-bold text-white">{msg.user}</span>
                                                        {msg.flagged && <span className="px-1.5 py-0.5 bg-amber-500/15 border border-amber-500/20 text-amber-400 text-[10px] font-bold rounded">⚠ Suspeito</span>}
                                                        <span className="ml-auto text-xs text-zinc-600">{timeAgo(msg.ts)}</span>
                                                    </div>
                                                    <p className="text-sm text-zinc-400">{msg.message}</p>
                                                </div>
                                                {msg.flagged && (
                                                    <div className="flex gap-1 flex-shrink-0">
                                                        <button className="px-2.5 py-1.5 bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-bold rounded-lg hover:bg-red-500/20 transition-all">Banir</button>
                                                        <button className="px-2.5 py-1.5 bg-white/5 border border-white/10 text-zinc-400 text-xs font-bold rounded-lg hover:bg-white/10 transition-all">Ignorar</button>
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </Card>
                            </SectionWrap>
                        )}

                        {/* ════════════════════ REPORTS ════════════════════ */}
                        {section === 'reports' && (
                            <SectionWrap key="reports">
                                <h1 className="text-xl font-black text-white">Denúncias</h1>

                                <Card>
                                    <div className="px-5 py-4 border-b border-white/5">
                                        <h3 className="text-sm font-black text-white">Denúncias abertas</h3>
                                    </div>
                                    <div className="divide-y divide-white/5">
                                        {mockReports.map(r => (
                                            <div key={r.id} className="flex items-start gap-4 px-5 py-4 hover:bg-white/3 transition-colors">
                                                <div className={`mt-0.5 w-2 h-2 rounded-full flex-shrink-0 ${
                                                    r.status === 'pending' ? 'bg-amber-400' : r.status === 'investigating' ? 'bg-blue-400' : 'bg-emerald-400'
                                                }`} />
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <p className="text-sm font-bold text-white">{r.carTitle}</p>
                                                        <span className={`px-2 py-0.5 text-[10px] font-bold rounded-md border ${
                                                            r.status === 'pending' ? 'bg-amber-500/10 border-amber-500/20 text-amber-400'
                                                                : r.status === 'investigating' ? 'bg-blue-500/10 border-blue-500/20 text-blue-400'
                                                                : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                                                        }`}>
                                                            {{ pending: 'Pendente', investigating: 'Em análise', resolved: 'Resolvido' }[r.status]}
                                                        </span>
                                                    </div>
                                                    <p className="text-xs text-zinc-500 mt-0.5">
                                                        <span className="text-red-400 font-bold">{r.reason}</span> · Reportado por {r.reporter} · {fmtDate(r.date)}
                                                    </p>
                                                </div>
                                                <div className="flex gap-1 flex-shrink-0">
                                                    <button className="px-2.5 py-1.5 bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-bold rounded-lg hover:bg-blue-500/20 transition-all">Investigar</button>
                                                    <button className="px-2.5 py-1.5 bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-bold rounded-lg hover:bg-red-500/20 transition-all">Remover</button>
                                                    <button className="px-2.5 py-1.5 bg-white/5 border border-white/10 text-zinc-500 text-xs font-bold rounded-lg hover:bg-white/10 transition-all">Banir</button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </Card>
                            </SectionWrap>
                        )}

                        {/* ════════════════════ FINANCIAL ════════════════════ */}
                        {section === 'financial' && (
                            <SectionWrap key="financial">
                                <h1 className="text-xl font-black text-white">Financeiro</h1>

                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                    <StatCard label="MRR total" value="R$ 2.937" sub="+8.4% vs mês anterior" icon={DollarSign} color="bg-emerald-500/10 text-emerald-400" trend="up" />
                                    <StatCard label="Assinantes ativos" value="63" sub="planos combinados" icon={Users} color="bg-blue-500/10 text-blue-400" trend="up" />
                                    <StatCard label="Churn rate" value="3.2%" sub="-0.4pp vs mês anterior" icon={TrendingDown} color="bg-violet-500/10 text-violet-400" trend="up" />
                                </div>

                                <Card>
                                    <div className="px-5 py-4 border-b border-white/5">
                                        <h3 className="text-sm font-black text-white">Planos de assinatura</h3>
                                    </div>
                                    <div className="overflow-x-auto">
                                        <table className="w-full">
                                            <thead>
                                                <tr className="border-b border-white/5">
                                                    <th className="px-5 py-3 text-left text-xs font-bold text-zinc-500 uppercase tracking-wider">Plano</th>
                                                    <th className="px-4 py-3 text-left text-xs font-bold text-zinc-500 uppercase tracking-wider">Preço</th>
                                                    <th className="px-4 py-3 text-left text-xs font-bold text-zinc-500 uppercase tracking-wider">Assinantes</th>
                                                    <th className="px-4 py-3 text-left text-xs font-bold text-zinc-500 uppercase tracking-wider">MRR</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-white/5">
                                                {subscriptionPlans.map(p => (
                                                    <tr key={p.plan} className="hover:bg-white/3 transition-colors">
                                                        <td className="px-5 py-3">
                                                            <div className="flex items-center gap-2">
                                                                <Zap className="w-4 h-4 text-cyan-400" strokeWidth={1.5} />
                                                                <span className="text-sm font-bold text-white">{p.plan}</span>
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-3"><span className="text-sm text-zinc-300">R$ {p.price}/mês</span></td>
                                                        <td className="px-4 py-3"><span className="text-sm font-bold text-white">{p.subscribers}</span></td>
                                                        <td className="px-4 py-3"><span className="text-sm font-bold text-emerald-400">{formatBRL(p.mrr)}</span></td>
                                                    </tr>
                                                ))}
                                                <tr className="bg-white/3">
                                                    <td colSpan={3} className="px-5 py-3 text-sm font-black text-zinc-300 text-right">Total MRR</td>
                                                    <td className="px-4 py-3"><span className="text-sm font-black text-emerald-400">{formatBRL(subscriptionPlans.reduce((s, p) => s + p.mrr, 0))}</span></td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </div>
                                </Card>
                            </SectionWrap>
                        )}

                        {/* ════════════════════ ANALYTICS ════════════════════ */}
                        {section === 'analytics' && (
                            <SectionWrap key="analytics">
                                <h1 className="text-xl font-black text-white">Analytics</h1>

                                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                                    <StatCard label="Veículos mais vistos" value="BMW X5" icon={Eye} color="bg-cyan-500/10 text-cyan-400" />
                                    <StatCard label="Preço médio anúncio" value="R$ 68.400" icon={DollarSign} color="bg-emerald-500/10 text-emerald-400" />
                                    <StatCard label="Taxa de contato" value="12.4%" icon={MessageSquare} color="bg-violet-500/10 text-violet-400" />
                                    <StatCard label="Tempo médio visita" value="4min 32s" icon={Clock} color="bg-amber-500/10 text-amber-400" />
                                </div>

                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                    <Card>
                                        <div className="px-5 py-4 border-b border-white/5">
                                            <h3 className="text-sm font-black text-white">Engajamento semanal</h3>
                                        </div>
                                        <div className="p-4">
                                            <ResponsiveContainer width="100%" height={220}>
                                                <LineChart data={engagementData}>
                                                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" />
                                                    <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#52525b' }} axisLine={false} tickLine={false} />
                                                    <YAxis tick={{ fontSize: 11, fill: '#52525b' }} axisLine={false} tickLine={false} width={36} />
                                                    <Tooltip contentStyle={{ background: '#0d1117', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, fontSize: 12 }} labelStyle={{ color: '#a1a1aa' }} />
                                                    <Line type="monotone" dataKey="messages" name="Mensagens" stroke="#22d3ee" strokeWidth={2} dot={false} />
                                                    <Line type="monotone" dataKey="views" name="Visualizações" stroke="#8b5cf6" strokeWidth={2} dot={false} />
                                                    <Line type="monotone" dataKey="favorites" name="Favoritos" stroke="#f59e0b" strokeWidth={2} dot={false} />
                                                </LineChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </Card>
                                    <Card>
                                        <div className="px-5 py-4 border-b border-white/5">
                                            <h3 className="text-sm font-black text-white">Distribuição por marca</h3>
                                        </div>
                                        <div className="p-4 flex flex-col items-center">
                                            <ResponsiveContainer width="100%" height={180}>
                                                <RePieChart>
                                                    <Pie data={brandData} cx="50%" cy="50%" outerRadius={75} paddingAngle={2} dataKey="value" label={({ name, value }) => `${name} ${value}%`} labelLine={false}>
                                                        {brandData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i]} />)}
                                                    </Pie>
                                                    <Tooltip contentStyle={{ background: '#0d1117', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, fontSize: 12 }} />
                                                </RePieChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </Card>
                                </div>
                            </SectionWrap>
                        )}

                        {/* ════════════════════ PERFORMANCE ════════════════════ */}
                        {section === 'performance' && (
                            <SectionWrap key="performance">
                                <h1 className="text-xl font-black text-white">Performance do Sistema</h1>

                                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                                    <StatCard label="Tempo de carregamento" value="1.3s" sub="Bom" icon={Activity} color="bg-emerald-500/10 text-emerald-400" trend="up" />
                                    <StatCard label="Erros JS (24h)" value="3" sub="-67% vs ontem" icon={AlertOctagon} color="bg-red-500/10 text-red-400" trend="up" />
                                    <StatCard label="Tempo médio API" value="210ms" sub="< 300ms meta" icon={Zap} color="bg-cyan-500/10 text-cyan-400" trend="up" />
                                    <StatCard label="Uso de DB queries" value="94%" sub="da cota diária" icon={Database} color="bg-amber-500/10 text-amber-400" trend="down" />
                                </div>

                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                    <Card>
                                        <div className="px-5 py-4 border-b border-white/5">
                                            <h3 className="text-sm font-black text-white">Core Web Vitals</h3>
                                        </div>
                                        <div className="p-5 space-y-4">
                                            {[
                                                { metric: 'LCP (Largest Contentful Paint)', value: '1.3s', status: 'good', target: '< 2.5s' },
                                                { metric: 'FID (First Input Delay)', value: '18ms', status: 'good', target: '< 100ms' },
                                                { metric: 'CLS (Cumulative Layout Shift)', value: '0.08', status: 'good', target: '< 0.1' },
                                                { metric: 'TTFB (Time to First Byte)', value: '210ms', status: 'good', target: '< 600ms' },
                                                { metric: 'FCP (First Contentful Paint)', value: '0.9s', status: 'good', target: '< 1.8s' },
                                            ].map(v => (
                                                <div key={v.metric} className="flex items-center gap-3">
                                                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${v.status === 'good' ? 'bg-emerald-400' : v.status === 'warn' ? 'bg-amber-400' : 'bg-red-400'}`} />
                                                    <span className="text-xs text-zinc-400 flex-1">{v.metric}</span>
                                                    <span className="text-sm font-black text-white">{v.value}</span>
                                                    <span className="text-xs text-zinc-600">{v.target}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </Card>
                                    <Card>
                                        <div className="px-5 py-4 border-b border-white/5">
                                            <h3 className="text-sm font-black text-white">Tempo de resposta API</h3>
                                        </div>
                                        <div className="p-4">
                                            <ResponsiveContainer width="100%" height={180}>
                                                <AreaChart data={[
                                                    { t: '00h', ms: 180 }, { t: '04h', ms: 140 }, { t: '08h', ms: 210 },
                                                    { t: '12h', ms: 310 }, { t: '16h', ms: 280 }, { t: '20h', ms: 195 }, { t: '24h', ms: 165 }
                                                ]}>
                                                    <defs>
                                                        <linearGradient id="apiGrad" x1="0" y1="0" x2="0" y2="1">
                                                            <stop offset="5%" stopColor="#22d3ee" stopOpacity={0.3} />
                                                            <stop offset="95%" stopColor="#22d3ee" stopOpacity={0} />
                                                        </linearGradient>
                                                    </defs>
                                                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" />
                                                    <XAxis dataKey="t" tick={{ fontSize: 11, fill: '#52525b' }} axisLine={false} tickLine={false} />
                                                    <YAxis tick={{ fontSize: 11, fill: '#52525b' }} axisLine={false} tickLine={false} width={32} />
                                                    <Tooltip contentStyle={{ background: '#0d1117', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, fontSize: 12 }} labelStyle={{ color: '#a1a1aa' }} formatter={(v: any) => [`${v}ms`, 'API']} />
                                                    <Area type="monotone" dataKey="ms" stroke="#22d3ee" strokeWidth={2} fill="url(#apiGrad)" />
                                                </AreaChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </Card>
                                </div>
                            </SectionWrap>
                        )}

                        {/* ════════════════════ LOGS ════════════════════ */}
                        {section === 'logs' && (
                            <SectionWrap key="logs">
                                <div className="flex items-center justify-between">
                                    <h1 className="text-xl font-black text-white">Logs do Sistema</h1>
                                    <button className="flex items-center gap-2 px-3 py-2 bg-[#0d1117] border border-white/8 rounded-xl text-xs font-bold text-zinc-500 hover:text-zinc-200 hover:border-white/20 transition-all">
                                        <Download className="w-3.5 h-3.5" strokeWidth={1.5} />
                                        Exportar
                                    </button>
                                </div>

                                <Card>
                                    <div className="divide-y divide-white/5">
                                        {mockLogs.map(log => (
                                            <div key={log.id} className="flex items-start gap-4 px-5 py-3.5 hover:bg-white/3 transition-colors font-mono">
                                                <span className={`flex-shrink-0 mt-0.5 text-[10px] font-bold px-2 py-0.5 rounded-md border ${
                                                    log.level === 'error' ? 'bg-red-500/10 border-red-500/20 text-red-400'
                                                        : log.level === 'warn' ? 'bg-amber-500/10 border-amber-500/20 text-amber-400'
                                                        : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                                                }`}>
                                                    {log.level.toUpperCase()}
                                                </span>
                                                <span className="text-xs text-cyan-400 flex-shrink-0 mt-0.5">{log.action}</span>
                                                <span className="text-xs text-zinc-400 flex-1">{log.detail}</span>
                                                <span className="text-xs text-zinc-600 flex-shrink-0">{timeAgo(log.ts)}</span>
                                            </div>
                                        ))}
                                    </div>
                                </Card>

                                {/* Alert system */}
                                <Card>
                                    <div className="px-5 py-4 border-b border-white/5 flex items-center gap-2">
                                        <Bell className="w-4 h-4 text-amber-400" strokeWidth={1.5} />
                                        <h3 className="text-sm font-black text-white">Alertas do sistema</h3>
                                    </div>
                                    <div className="divide-y divide-white/5">
                                        {alertsList.length === 0 ? (
                                            <p className="px-5 py-6 text-sm text-zinc-600 text-center">Nenhum alerta ativo.</p>
                                        ) : alertsList.map(al => (
                                            <div key={al.id} className={`flex items-start gap-3 px-5 py-3.5 hover:bg-white/3 transition-colors border-l-2 ${al.level === 'error' ? 'border-red-500/40' : 'border-amber-500/40'}`}>
                                                <AlertTriangle className={`w-4 h-4 flex-shrink-0 mt-0.5 ${al.level === 'error' ? 'text-red-400' : 'text-amber-400'}`} strokeWidth={1.5} />
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm text-zinc-300">{al.msg}</p>
                                                    <p className="text-xs text-zinc-600 mt-0.5">{timeAgo(al.ts)}</p>
                                                </div>
                                                <button onClick={() => dismissAlert(al.id)} className="text-zinc-700 hover:text-zinc-400 transition-colors flex-shrink-0">
                                                    <X className="w-3.5 h-3.5" strokeWidth={2} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </Card>
                            </SectionWrap>
                        )}

                        {/* ════════════════════ ANTI-FRAUD ════════════════════ */}
                        {section === 'antifraud' && (
                            <SectionWrap key="antifraud">
                                <h1 className="text-xl font-black text-white">Anti-Fraude</h1>

                                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                                    <StatCard label="Usuários suspeitos" value="4" sub="requerem revisão" icon={AlertOctagon} color="bg-red-500/10 text-red-400" trend="down" />
                                    <StatCard label="Chats flagged" value="3" icon={MessageSquare} color="bg-amber-500/10 text-amber-400" />
                                    <StatCard label="Preços suspeitos" value="7" icon={DollarSign} color="bg-orange-500/10 text-orange-400" />
                                    <StatCard label="Usuários banidos (30d)" value="2" icon={UserX} color="bg-zinc-500/10 text-zinc-400" />
                                </div>

                                <Card>
                                    <div className="px-5 py-4 border-b border-white/5 flex items-center gap-2">
                                        <AlertOctagon className="w-4 h-4 text-red-400" strokeWidth={1.5} />
                                        <h3 className="text-sm font-black text-white">Usuários de alto risco</h3>
                                    </div>
                                    <div className="divide-y divide-white/5">
                                        {mockFraud.map(f => (
                                            <div key={f.id} className="flex items-center gap-4 px-5 py-4 hover:bg-white/3 transition-colors">
                                                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${f.risk === 'high' ? 'bg-red-500' : 'bg-amber-400'}`} />
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-bold text-white">{f.user}</p>
                                                    <p className="text-xs text-zinc-500">{f.type} · {f.count} ocorrências · último: {fmtDate(f.lastSeen)}</p>
                                                </div>
                                                <span className={`px-2.5 py-1 text-xs font-bold rounded-lg border ${
                                                    f.risk === 'high' ? 'bg-red-500/10 border-red-500/20 text-red-400' : 'bg-amber-500/10 border-amber-500/20 text-amber-400'
                                                }`}>
                                                    {f.risk === 'high' ? '🔴 Alto risco' : '🟡 Médio risco'}
                                                </span>
                                                <div className="flex gap-1">
                                                    <button className="px-2.5 py-1.5 bg-white/5 border border-white/10 text-zinc-400 text-xs font-bold rounded-lg hover:bg-white/10 transition-all">Investigar</button>
                                                    <button className="px-2.5 py-1.5 bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-bold rounded-lg hover:bg-red-500/20 transition-all">Banir</button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </Card>

                                <Card>
                                    <div className="px-5 py-4 border-b border-white/5">
                                        <h3 className="text-sm font-black text-white">Regras de detecção automática</h3>
                                    </div>
                                    <div className="p-5 space-y-3">
                                        {[
                                            { rule: 'Preço abaixo de 30% do mercado', active: true },
                                            { rule: 'Mais de 3 denúncias em 7 dias', active: true },
                                            { rule: 'Palavras suspeitas no chat (pix, depósito, urgente)', active: true },
                                            { rule: 'Mais de 10 anúncios em 24h', active: true },
                                            { rule: 'Múltiplas tentativas de login falhas', active: false },
                                        ].map((r, i) => (
                                            <div key={i} className="flex items-center justify-between p-3 bg-white/3 border border-white/5 rounded-xl">
                                                <div className="flex items-center gap-3">
                                                    <div className={`w-2 h-2 rounded-full ${r.active ? 'bg-emerald-400' : 'bg-zinc-600'}`} />
                                                    <span className="text-sm text-zinc-300">{r.rule}</span>
                                                </div>
                                                <span className={`text-xs font-bold ${r.active ? 'text-emerald-400' : 'text-zinc-600'}`}>
                                                    {r.active ? 'Ativo' : 'Inativo'}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </Card>
                            </SectionWrap>
                        )}

                        {/* ════════════════════ SETTINGS ════════════════════ */}
                        {section === 'settings' && (
                            <SectionWrap key="settings">
                                <h1 className="text-xl font-black text-white">Configurações</h1>

                                <Card>
                                    <div className="px-5 py-4 border-b border-white/5">
                                        <h3 className="text-sm font-black text-white">Limites do marketplace</h3>
                                    </div>
                                    <div className="p-5 space-y-5">
                                        {[
                                            { label: 'Máximo de anúncios por usuário', key: 'maxListingsPerUser' as const, min: 1, max: 20 },
                                            { label: 'Limite de mensagens por dia', key: 'messageLimitPerDay' as const, min: 10, max: 200 },
                                        ].map(f => (
                                            <div key={f.key}>
                                                <div className="flex items-center justify-between mb-2">
                                                    <label className="text-sm font-bold text-zinc-300">{f.label}</label>
                                                    <span className="text-sm font-black text-cyan-400">{settings[f.key]}</span>
                                                </div>
                                                <input type="range" min={f.min} max={f.max} value={settings[f.key]}
                                                    onChange={e => setSettings(s => ({ ...s, [f.key]: Number(e.target.value) }))}
                                                    className="w-full accent-cyan-400" />
                                                <div className="flex justify-between text-xs text-zinc-600 mt-1">
                                                    <span>{f.min}</span><span>{f.max}</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </Card>

                                <Card>
                                    <div className="px-5 py-4 border-b border-white/5">
                                        <h3 className="text-sm font-black text-white">Flags do sistema</h3>
                                    </div>
                                    <div className="p-5 space-y-3">
                                        {[
                                            { key: 'requireVerification' as const, label: 'Verificação obrigatória de conta', desc: 'Usuários precisam verificar CPF e selfie para anunciar' },
                                            { key: 'autoApproveListings' as const, label: 'Auto-aprovar anúncios', desc: 'Anúncios são publicados sem revisão manual' },
                                            { key: 'maintenanceMode' as const, label: 'Modo de manutenção', desc: 'Desativa o site para visitantes durante manutenção' },
                                        ].map(f => (
                                            <div key={f.key} className="flex items-start justify-between p-4 bg-white/3 border border-white/5 rounded-xl gap-4">
                                                <div>
                                                    <p className="text-sm font-bold text-white">{f.label}</p>
                                                    <p className="text-xs text-zinc-600 mt-0.5">{f.desc}</p>
                                                </div>
                                                <button
                                                    onClick={() => setSettings(s => ({ ...s, [f.key]: !s[f.key] }))}
                                                    className={`flex-shrink-0 w-11 h-6 rounded-full transition-all relative ${settings[f.key] ? 'bg-cyan-500' : 'bg-zinc-700'}`}
                                                >
                                                    <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${settings[f.key] ? 'left-6' : 'left-1'}`} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </Card>

                                <Card>
                                    <div className="px-5 py-4 border-b border-white/5">
                                        <h3 className="text-sm font-black text-white">Banco de dados — utilitários</h3>
                                    </div>
                                    <div className="p-5 space-y-3">
                                        <div className="p-4 bg-amber-500/5 border border-amber-500/20 rounded-xl">
                                            <p className="text-xs font-bold text-amber-400 mb-1">Reset de destaque indevido</p>
                                            <p className="text-xs text-zinc-600 mb-2">Execute no Supabase SQL Editor para corrigir destaques sem impulsionamento ativo:</p>
                                            <code className="block text-xs bg-black/40 p-3 rounded-lg text-cyan-300 font-mono select-all">
                                                UPDATE anuncios SET destaque = false WHERE impulsionado = false;
                                            </code>
                                        </div>
                                        <div className="p-4 bg-red-500/5 border border-red-500/20 rounded-xl">
                                            <p className="text-xs font-bold text-red-400 mb-1">Zona de perigo</p>
                                            <p className="text-xs text-zinc-600 mb-3">Operações irreversíveis. Confirme antes de executar.</p>
                                            <div className="flex gap-2 flex-wrap">
                                                <button className="px-3 py-1.5 bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-bold rounded-lg hover:bg-red-500/20 transition-all" onClick={() => toast.error('Operação cancelada — ambiente de produção.')}>
                                                    Limpar anúncios expirados
                                                </button>
                                                <button className="px-3 py-1.5 bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-bold rounded-lg hover:bg-red-500/20 transition-all" onClick={() => toast.error('Operação cancelada — ambiente de produção.')}>
                                                    Resetar logs do sistema
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </Card>
                            </SectionWrap>
                        )}

                    </AnimatePresence>
                </main>
            </div>
        </div>
    );
}
