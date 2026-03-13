import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Rocket, ArrowLeft, CreditCard, Clock, CheckCircle2,
    XCircle, AlertCircle, Loader2, RefreshCw, Calendar,
    Zap, Star, Crown, TrendingUp, ExternalLink, Shield,
    ChevronDown, ChevronUp, Package,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { toast } from '../utils/toast';

// ── Types ─────────────────────────────────────────────────────────────────────
interface Order {
    id:                      string;
    listing_id:              string;
    plan_type:               string;
    amount:                  number;
    currency:                string;
    status:                  'pending' | 'approved' | 'rejected' | 'cancelled' | 'expired';
    mercadopago_payment_id:  string | null;
    external_reference:      string | null;
    created_at:              string;
    updated_at:              string;
    // joined
    anuncio?:                { marca: string; modelo: string; ano: number; imagens: string[] } | null;
    boost?:                  ListingBoost | null;
}

interface ListingBoost {
    id:             string;
    listing_id:     string;
    order_id:       string;
    priority_level: number;
    start_date:     string;
    end_date:       string;
    active:         boolean;
    plan_type:      string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmt = (n: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n);

const fmtDate = (iso: string) =>
    new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(iso));

const fmtDateFull = (iso: string) =>
    new Intl.DateTimeFormat('pt-BR', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
    }).format(new Date(iso));

const PLAN_LABELS: Record<string, string> = {
    basic_boost:   'Básico',
    premium_boost: 'Premium',
    ultra_boost:   'Ultra',
};

const PLAN_ICONS: Record<string, React.ElementType> = {
    basic_boost:   Zap,
    premium_boost: Star,
    ultra_boost:   Crown,
};

const PLAN_COLORS: Record<string, string> = {
    basic_boost:   'text-brand-400 bg-brand-400/15 border-brand-400/30',
    premium_boost: 'text-blue-400 bg-blue-500/15 border-blue-500/30',
    ultra_boost:   'text-amber-400 bg-amber-500/15 border-amber-500/30',
};

const PLAN_DURATIONS: Record<string, number> = {
    basic_boost: 7, premium_boost: 15, ultra_boost: 30,
};

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
    pending:   { label: 'Pendente',   color: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20', icon: Clock },
    approved:  { label: 'Aprovado',   color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20', icon: CheckCircle2 },
    rejected:  { label: 'Recusado',   color: 'text-red-400 bg-red-500/10 border-red-500/20', icon: XCircle },
    cancelled: { label: 'Cancelado',  color: 'text-zinc-400 bg-zinc-500/10 border-zinc-500/20', icon: XCircle },
    expired:   { label: 'Expirado',   color: 'text-orange-400 bg-orange-500/10 border-orange-500/20', icon: AlertCircle },
};

// ── Boost countdown ───────────────────────────────────────────────────────────
function BoostRemaining({ endDate }: { endDate: string }) {
    const end  = new Date(endDate);
    const now  = new Date();
    const ms   = end.getTime() - now.getTime();

    if (ms <= 0) return <span className="text-zinc-500 text-xs">Expirado</span>;

    const days  = Math.floor(ms / 86400_000);
    const hours = Math.floor((ms % 86400_000) / 3600_000);

    if (days > 0) {
        return <span className="text-emerald-400 text-xs font-bold">{days}d {hours}h restantes</span>;
    }
    return <span className="text-yellow-400 text-xs font-bold">{hours}h restantes</span>;
}

// ── Order Card ────────────────────────────────────────────────────────────────
function OrderCard({ order }: { order: Order }) {
    const [expanded, setExpanded] = useState(false);

    const status    = STATUS_CONFIG[order.status] ?? STATUS_CONFIG.pending;
    const StatusIcon = status.icon;
    const planLabel  = PLAN_LABELS[order.plan_type] ?? order.plan_type;
    const PlanIcon   = PLAN_ICONS[order.plan_type] ?? Rocket;
    const planColor  = PLAN_COLORS[order.plan_type] ?? PLAN_COLORS.basic_boost;
    const boost      = order.boost;
    const car        = order.anuncio;

    const isActive = boost?.active && new Date(boost.end_date) > new Date();

    return (
        <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-zinc-900 border border-white/8 rounded-2xl overflow-hidden"
        >
            {/* Main row */}
            <div className="p-4">
                <div className="flex items-start gap-3">
                    {/* Car image or icon */}
                    {car?.imagens?.[0] ? (
                        <img
                            src={car.imagens[0]}
                            alt=""
                            className="w-14 h-10 object-cover rounded-lg flex-shrink-0"
                        />
                    ) : (
                        <div className="w-14 h-10 bg-zinc-800 rounded-lg flex items-center justify-center flex-shrink-0">
                            <Rocket className="w-5 h-5 text-zinc-600" strokeWidth={1.5} />
                        </div>
                    )}

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] font-bold ${planColor}`}>
                                <PlanIcon className="w-3 h-3" strokeWidth={1.5} />
                                {planLabel}
                            </span>
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] font-bold ${status.color}`}>
                                <StatusIcon className="w-3 h-3" strokeWidth={1.5} />
                                {status.label}
                            </span>
                            {isActive && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] font-bold text-emerald-400 bg-emerald-500/10 border-emerald-500/20">
                                    <TrendingUp className="w-3 h-3" strokeWidth={1.5} />
                                    Ativo
                                </span>
                            )}
                        </div>

                        {car ? (
                            <p className="text-white font-bold text-sm mt-1 truncate">
                                {car.marca} {car.modelo} {car.ano}
                            </p>
                        ) : (
                            <p className="text-zinc-400 text-xs mt-1 font-mono truncate">{order.listing_id}</p>
                        )}

                        <div className="flex items-center gap-3 mt-1">
                            <span className="text-zinc-500 text-xs">{fmtDate(order.created_at)}</span>
                            {boost && isActive && (
                                <BoostRemaining endDate={boost.end_date} />
                            )}
                            {boost && !isActive && boost.end_date && (
                                <span className="text-zinc-600 text-xs">
                                    Encerrou {fmtDate(boost.end_date)}
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Amount + expand */}
                    <div className="flex-shrink-0 text-right flex flex-col items-end gap-2">
                        <p className="text-white font-black text-base">{fmt(order.amount)}</p>
                        <button
                            onClick={() => setExpanded(e => !e)}
                            className="w-6 h-6 flex items-center justify-center rounded-md bg-zinc-800 hover:bg-zinc-700 transition-colors"
                        >
                            {expanded
                                ? <ChevronUp className="w-3.5 h-3.5 text-zinc-400" strokeWidth={1.5} />
                                : <ChevronDown className="w-3.5 h-3.5 text-zinc-400" strokeWidth={1.5} />
                            }
                        </button>
                    </div>
                </div>

                {/* Boost progress bar */}
                {boost && order.status === 'approved' && (() => {
                    const total    = new Date(boost.end_date).getTime() - new Date(boost.start_date).getTime();
                    const elapsed  = Date.now() - new Date(boost.start_date).getTime();
                    const pct      = Math.min(100, Math.max(0, (elapsed / total) * 100));
                    const remaining = 100 - pct;
                    return (
                        <div className="mt-3">
                            <div className="flex items-center justify-between text-[11px] mb-1">
                                <span className="text-zinc-500">Destaque</span>
                                <span className="text-zinc-400">{Math.round(remaining)}% restante</span>
                            </div>
                            <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-gradient-to-r from-brand-400 to-brand-300 rounded-full transition-all"
                                    style={{ width: `${remaining}%` }}
                                />
                            </div>
                        </div>
                    );
                })()}
            </div>

            {/* Expanded details */}
            <AnimatePresence>
                {expanded && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                    >
                        <div className="border-t border-white/5 px-4 py-3 space-y-2">
                            <div className="grid grid-cols-2 gap-2 text-xs">
                                <div>
                                    <p className="text-zinc-500 mb-0.5">Pedido ID</p>
                                    <p className="text-zinc-300 font-mono text-[11px] truncate">{order.id}</p>
                                </div>
                                <div>
                                    <p className="text-zinc-500 mb-0.5">Pagamento MP</p>
                                    <p className="text-zinc-300 font-mono text-[11px] truncate">
                                        {order.mercadopago_payment_id ?? '—'}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-zinc-500 mb-0.5">Duração</p>
                                    <p className="text-zinc-300">{PLAN_DURATIONS[order.plan_type] ?? '—'} dias</p>
                                </div>
                                <div>
                                    <p className="text-zinc-500 mb-0.5">Atualizado</p>
                                    <p className="text-zinc-300">{fmtDate(order.updated_at)}</p>
                                </div>
                                {boost && (
                                    <>
                                        <div>
                                            <p className="text-zinc-500 mb-0.5">Início boost</p>
                                            <p className="text-zinc-300">{fmtDate(boost.start_date)}</p>
                                        </div>
                                        <div>
                                            <p className="text-zinc-500 mb-0.5">Fim boost</p>
                                            <p className="text-zinc-300">{fmtDate(boost.end_date)}</p>
                                        </div>
                                        <div>
                                            <p className="text-zinc-500 mb-0.5">Prioridade</p>
                                            <p className="text-zinc-300">Nível {boost.priority_level}</p>
                                        </div>
                                    </>
                                )}
                            </div>

                            {/* Action links */}
                            <div className="flex gap-2 pt-1">
                                {car && (
                                    <Link
                                        to={`/carro/${order.listing_id}`}
                                        className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-xs text-zinc-300 hover:text-white transition-colors"
                                    >
                                        <ExternalLink className="w-3.5 h-3.5" strokeWidth={1.5} />
                                        Ver anúncio
                                    </Link>
                                )}
                                {order.status === 'pending' && (
                                    <Link
                                        to={`/impulsionar/${order.listing_id}`}
                                        className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-400/15 hover:bg-brand-400/25 border border-brand-400/30 rounded-lg text-xs text-brand-400 transition-colors"
                                    >
                                        <Rocket className="w-3.5 h-3.5" strokeWidth={1.5} />
                                        Retomar pagamento
                                    </Link>
                                )}
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
}

// ── Stats Card ────────────────────────────────────────────────────────────────
function StatCard({ icon: Icon, label, value, sub, color = 'text-brand-400', bg = 'bg-brand-400/10' }: {
    icon:  React.ElementType;
    label: string;
    value: string | number;
    sub?:  string;
    color?: string;
    bg?:   string;
}) {
    return (
        <div className="bg-zinc-900 border border-white/8 rounded-2xl p-4 flex items-center gap-3">
            <div className={`w-10 h-10 ${bg} rounded-xl flex items-center justify-center flex-shrink-0`}>
                <Icon className={`w-5 h-5 ${color}`} strokeWidth={1.5} />
            </div>
            <div className="min-w-0">
                <p className="text-zinc-500 text-xs">{label}</p>
                <p className="text-white font-black text-lg leading-tight">{value}</p>
                {sub && <p className="text-zinc-600 text-[11px]">{sub}</p>}
            </div>
        </div>
    );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function DashboardPayments() {
    const { user } = useAuth();
    const navigate = useNavigate();

    const [orders,  setOrders]  = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter,  setFilter]  = useState<'all' | 'approved' | 'pending' | 'rejected'>('all');

    // ── Fetch orders with joined data ─────────────────────────────────────────
    const fetchOrders = async () => {
        if (!user) return;
        setLoading(true);

        try {
            // Fetch orders
            const { data: ordersData, error: ordersErr } = await supabase
                .from('orders')
                .select('*')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false });

            if (ordersErr) throw ordersErr;
            if (!ordersData) { setOrders([]); return; }

            // Fetch listing details for all order listing_ids
            const listingIds = [...new Set(ordersData.map((o: any) => o.listing_id).filter(Boolean))];
            const orderIds   = ordersData.map((o: any) => o.id);

            const [listingsRes, boostsRes] = await Promise.all([
                listingIds.length > 0
                    ? supabase
                        .from('anuncios')
                        .select('id, marca, modelo, ano, imagens')
                        .in('id', listingIds)
                    : Promise.resolve({ data: [], error: null }),
                orderIds.length > 0
                    ? supabase
                        .from('listing_boosts')
                        .select('*')
                        .in('order_id', orderIds)
                    : Promise.resolve({ data: [], error: null }),
            ]);

            const listingMap  = new Map((listingsRes.data ?? []).map((l: any) => [l.id, l]));
            const boostMap    = new Map((boostsRes.data ?? []).map((b: any) => [b.order_id, b]));

            const enriched: Order[] = ordersData.map((o: any) => ({
                ...o,
                anuncio: listingMap.get(o.listing_id) ?? null,
                boost:   boostMap.get(o.id) ?? null,
            }));

            setOrders(enriched);
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Erro ao carregar histórico.';
            console.error('[DashboardPayments]', msg);
            toast.error(msg);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!user) { navigate('/login'); return; }
        fetchOrders();
    }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

    // ── Stats ─────────────────────────────────────────────────────────────────
    const approved   = orders.filter(o => o.status === 'approved');
    const pending    = orders.filter(o => o.status === 'pending');
    const activeBoosts = orders.filter(o =>
        o.boost?.active && new Date(o.boost.end_date) > new Date()
    );
    const totalSpent = approved.reduce((sum, o) => sum + Number(o.amount), 0);

    // ── Filtered list ─────────────────────────────────────────────────────────
    const filtered = filter === 'all'
        ? orders
        : filter === 'rejected'
            ? orders.filter(o => o.status === 'rejected' || o.status === 'cancelled')
            : orders.filter(o => o.status === filter);

    return (
        <div className="bg-zinc-950 min-h-screen py-10">
            <div className="max-w-2xl mx-auto px-4">

                {/* Header */}
                <motion.div
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-8"
                >
                    <Link
                        to="/meus-anuncios"
                        className="inline-flex items-center gap-1.5 text-zinc-500 hover:text-white text-sm transition-colors mb-4"
                    >
                        <ArrowLeft className="w-4 h-4" strokeWidth={1.5} />
                        Meus anúncios
                    </Link>

                    <div className="flex items-start justify-between gap-4">
                        <div>
                            <div className="flex items-center gap-2 mb-1">
                                <CreditCard className="w-5 h-5 text-brand-400" strokeWidth={1.5} />
                                <h1 className="text-2xl font-black text-white">Meus pagamentos</h1>
                            </div>
                            <p className="text-zinc-500 text-sm">
                                Histórico de impulsionamentos e cobranças
                            </p>
                        </div>
                        <button
                            onClick={fetchOrders}
                            disabled={loading}
                            className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 rounded-xl text-sm text-zinc-400 hover:text-white transition-colors"
                        >
                            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} strokeWidth={1.5} />
                            Atualizar
                        </button>
                    </div>
                </motion.div>

                {/* Stats grid */}
                {!loading && orders.length > 0 && (
                    <motion.div
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.05 }}
                        className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6"
                    >
                        <StatCard icon={Package}     label="Total pedidos"  value={orders.length} />
                        <StatCard icon={CheckCircle2} label="Aprovados"      value={approved.length}
                            color="text-emerald-400" bg="bg-emerald-500/10" />
                        <StatCard icon={TrendingUp}   label="Boosts ativos"  value={activeBoosts.length}
                            color="text-brand-400" bg="bg-brand-400/10" />
                        <StatCard icon={CreditCard}   label="Total investido" value={fmt(totalSpent)}
                            color="text-blue-400" bg="bg-blue-500/10" />
                    </motion.div>
                )}

                {/* Filter tabs */}
                {!loading && orders.length > 0 && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.08 }}
                        className="flex gap-2 mb-4 flex-wrap"
                    >
                        {([
                            { id: 'all',      label: 'Todos', count: orders.length },
                            { id: 'approved', label: 'Aprovados', count: approved.length },
                            { id: 'pending',  label: 'Pendentes', count: pending.length },
                            { id: 'rejected', label: 'Recusados', count: orders.filter(o => o.status === 'rejected' || o.status === 'cancelled').length },
                        ] as const).map(({ id, label, count }) => (
                            <button
                                key={id}
                                onClick={() => setFilter(id)}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                                    filter === id
                                        ? 'bg-brand-400/15 border-brand-400/30 text-brand-400'
                                        : 'border-white/8 bg-zinc-900 text-zinc-500 hover:text-white'
                                }`}
                            >
                                {label}
                                <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${
                                    filter === id ? 'bg-brand-400/20 text-brand-300' : 'bg-zinc-800 text-zinc-500'
                                }`}>
                                    {count}
                                </span>
                            </button>
                        ))}
                    </motion.div>
                )}

                {/* Content */}
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-20 gap-3">
                        <Loader2 className="w-8 h-8 text-brand-400 animate-spin" strokeWidth={1.5} />
                        <p className="text-zinc-500 text-sm">Carregando histórico…</p>
                    </div>
                ) : orders.length === 0 ? (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="flex flex-col items-center text-center py-20 gap-4"
                    >
                        <div className="w-16 h-16 bg-zinc-900 border border-white/8 rounded-2xl flex items-center justify-center">
                            <Package className="w-8 h-8 text-zinc-600" strokeWidth={1} />
                        </div>
                        <div>
                            <h3 className="text-white font-bold text-base mb-1">Nenhum pagamento ainda</h3>
                            <p className="text-zinc-500 text-sm">
                                Impulsione seus anúncios para aparecer no topo das buscas
                            </p>
                        </div>
                        <Link
                            to="/meus-anuncios"
                            className="flex items-center gap-2 px-5 py-2.5 bg-brand-400 hover:bg-brand-300 text-zinc-950 font-black rounded-xl text-sm transition-colors"
                        >
                            <Rocket className="w-4 h-4" strokeWidth={1.5} />
                            Impulsionar agora
                        </Link>
                    </motion.div>
                ) : filtered.length === 0 ? (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="text-center py-12"
                    >
                        <p className="text-zinc-500 text-sm">Nenhum pedido com este filtro.</p>
                    </motion.div>
                ) : (
                    <div className="space-y-3">
                        <AnimatePresence mode="popLayout">
                            {filtered.map((order, i) => (
                                <motion.div
                                    key={order.id}
                                    initial={{ opacity: 0, y: 8 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 0.95 }}
                                    transition={{ delay: i * 0.04 }}
                                >
                                    <OrderCard order={order} />
                                </motion.div>
                            ))}
                        </AnimatePresence>
                    </div>
                )}

                {/* Security note */}
                {!loading && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.3 }}
                        className="flex items-center justify-center gap-2 mt-8 pt-4 border-t border-white/5"
                    >
                        <Shield className="w-3.5 h-3.5 text-zinc-600" strokeWidth={1.5} />
                        <p className="text-zinc-600 text-xs text-center">
                            Pagamentos processados com segurança pelo Mercado Pago · SSL 256-bit
                        </p>
                    </motion.div>
                )}

            </div>
        </div>
    );
}
