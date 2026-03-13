import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Rocket, ArrowLeft, ShieldCheck, CreditCard, QrCode,
    ExternalLink, Check, Loader2, Star, Zap, Crown, TrendingUp,
} from 'lucide-react';
import CheckoutModal, { CheckoutOrder } from '../components/CheckoutModal';
import { toast } from '../utils/toast';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import type { Car } from '../data/mockCars';

// ── Boost plans (static fallback + API) ───────────────────────────────────────
export interface BoostPlan {
    id:             string;
    name:           string;
    label:          string;
    price:          number;
    duration_days:  number;
    priority_level: number;
}

const STATIC_PLANS: BoostPlan[] = [
    { id: 'basic_boost',   name: 'basic_boost',   label: 'Básico',  price: 19.90,  duration_days: 7,  priority_level: 1 },
    { id: 'premium_boost', name: 'premium_boost', label: 'Premium', price: 39.90,  duration_days: 15, priority_level: 2 },
    { id: 'ultra_boost',   name: 'ultra_boost',   label: 'Ultra',   price: 79.90,  duration_days: 30, priority_level: 3 },
];

const PLAN_META: Record<string, { icon: React.ElementType; color: string; badge: string; desc: string }> = {
    basic_boost:   { icon: Zap,    color: 'brand-400', badge: 'bg-brand-400/15 border-brand-400/30 text-brand-400',   desc: '7 dias em destaque nos resultados' },
    premium_boost: { icon: Star,   color: 'blue-400',  badge: 'bg-blue-500/15 border-blue-500/30 text-blue-400',      desc: '15 dias com prioridade máxima' },
    ultra_boost:   { icon: Crown,  color: 'amber-400', badge: 'bg-amber-500/15 border-amber-500/30 text-amber-400',   desc: '30 dias no topo das buscas' },
};

const fmt = (n: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n);

const API_BASE = import.meta.env.VITE_PAYMENT_API_URL || '';

// ── Analytics helper ─────────────────────────────────────────────────────────
async function trackEvent(
    eventName: string,
    userId: string | undefined,
    listingId: string | undefined,
    orderId: string | undefined,
    props: Record<string, unknown>
) {
    try {
        await supabase.from('analytics_events').insert({
            event_name: eventName,
            user_id:    userId,
            listing_id: listingId,
            order_id:   orderId,
            properties: props,
        });
    } catch { /* non-fatal */ }
}

// ── Main component ────────────────────────────────────────────────────────────
export default function Impulsionar() {
    const { id }    = useParams<{ id: string }>();
    const navigate  = useNavigate();
    const { user }  = useAuth();

    const [car, setCar]               = useState<Car | null>(null);
    const [pageLoading, setPageLoading] = useState(true);
    const [plans, setPlans]           = useState<BoostPlan[]>(STATIC_PLANS);
    const [selectedIdx, setSelectedIdx] = useState(1); // default: Premium
    const [showCheckout, setShowCheckout] = useState(false);
    const [orderId, setOrderId]       = useState<string | null>(null);
    const [orderLoading, setOrderLoading] = useState(false);

    // Slider
    const trackRef   = useRef<HTMLDivElement>(null);
    const isDragging = useRef(false);
    const [dragging, setDragging] = useState(false);

    // ── Load MP SDK ───────────────────────────────────────────────────────────
    useEffect(() => {
        if (window.MercadoPago) return;
        const s = document.createElement('script');
        s.src   = 'https://sdk.mercadopago.com/js/v2';
        s.async = true;
        document.head.appendChild(s);
    }, []);

    // ── Fetch boost plans from API ────────────────────────────────────────────
    useEffect(() => {
        const loadPlans = async () => {
            try {
                const res = await fetch(`${API_BASE}/api/boost-plans`);
                if (!res.ok) return;
                const { plans: data } = await res.json();
                if (Array.isArray(data) && data.length > 0) {
                    setPlans(data);
                }
            } catch { /* use static fallback */ }
        };
        loadPlans();
    }, []);

    // ── Fetch car ─────────────────────────────────────────────────────────────
    useEffect(() => {
        const fetchCar = async () => {
            if (!id) return;
            const { data, error } = await supabase.from('anuncios').select('*').eq('id', id).single();
            if (error || !data) {
                toast.error('Anúncio não encontrado.');
                navigate('/meus-anuncios');
                return;
            }
            if (data.user_id !== user?.id) {
                toast.error('Sem permissão.');
                navigate('/meus-anuncios');
                return;
            }
            setCar({
                ...data,
                aceitaTroca: data.aceita_troca,
                modelo_3d:   false,
                imagens:     data.imagens || [],
            });
            setPageLoading(false);
        };
        if (user) fetchCar();
    }, [id, user, navigate]);

    // ── Slider helpers ────────────────────────────────────────────────────────
    const dotPct   = (i: number) => plans.length <= 1 ? 0 : (i / (plans.length - 1)) * 100;
    const xToSnap  = useCallback((clientX: number) => {
        const track = trackRef.current;
        if (!track) return selectedIdx;
        const rect  = track.getBoundingClientRect();
        const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
        return Math.round(ratio * (plans.length - 1));
    }, [plans.length, selectedIdx]);

    const onPointerDown = useCallback((e: React.PointerEvent) => {
        e.preventDefault(); e.stopPropagation();
        e.currentTarget.setPointerCapture(e.pointerId);
        isDragging.current = true; setDragging(true);
    }, []);
    const onPointerMove = useCallback((e: React.PointerEvent) => {
        if (!isDragging.current) return;
        setSelectedIdx(xToSnap(e.clientX));
    }, [xToSnap]);
    const onPointerUp = useCallback((e: React.PointerEvent) => {
        if (!isDragging.current) return;
        isDragging.current = false; setDragging(false);
        setSelectedIdx(xToSnap(e.clientX));
    }, [xToSnap]);

    // ── Create order, then open checkout ─────────────────────────────────────
    const handleOpenCheckout = async () => {
        if (!user) { toast.error('Faça login para continuar.'); navigate('/login'); return; }
        if (!id)   return;

        const plan = plans[selectedIdx];
        setOrderLoading(true);

        try {
            // Track "started" event
            await trackEvent('boost_purchase_started', user.id, id, undefined, {
                plan_type:      plan.name,
                plan_price:     plan.price,
                duration_days:  plan.duration_days,
            });

            // Create pending order via API
            const token = (await supabase.auth.getSession()).data.session?.access_token;
            const res   = await fetch(`${API_BASE}/api/orders/create`, {
                method:  'POST',
                headers: {
                    'Content-Type':  'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify({ listing_id: id, plan_type: plan.name }),
            });

            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err?.error || 'Erro ao criar pedido.');
            }

            const { order_id, external_reference } = await res.json();
            setOrderId(order_id);

            // Store for checkout
            (window as any).__sm_ext_ref = external_reference;
            setShowCheckout(true);

        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : 'Erro ao iniciar pagamento.';
            toast.error(msg);
        } finally {
            setOrderLoading(false);
        }
    };

    // ── Payment approved callback ─────────────────────────────────────────────
    const handleApproved = async (paymentId: string) => {
        const plan = plans[selectedIdx];
        console.log('[Impulsionar] Payment approved, id=', paymentId, 'orderId=', orderId);

        // Track event
        await trackEvent('boost_payment_approved', user?.id, id, orderId ?? undefined, {
            mp_payment_id:  paymentId,
            plan_type:      plan.name,
            plan_price:     plan.price,
        });

        // Activate boost directly in Supabase (frontend confirmation — webhook is canonical)
        if (id) {
            const endDate = new Date(Date.now() + plan.duration_days * 86400_000).toISOString();
            await supabase.from('anuncios').update({
                destaque:         true,
                impulsionado:     true,
                impulsionado_ate: endDate,
                prioridade:       plan.priority_level * 10,
            }).eq('id', id).then(({ error }) => {
                if (error) console.warn('[Impulsionar] Direct boost update failed:', error.message);
            });
        }

        setShowCheckout(false);
        toast.success(`🚀 Anúncio impulsionado com plano ${plan.label}!`);
        setTimeout(() => navigate('/meus-anuncios'), 1800);
    };

    if (pageLoading || !car) {
        return (
            <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
                <div className="w-12 h-12 rounded-full border-2 border-brand-400/20 border-t-brand-400 animate-spin" />
            </div>
        );
    }

    const plan     = plans[selectedIdx];
    const planMeta = PLAN_META[plan.name] ?? PLAN_META.basic_boost;
    const PlanIcon = planMeta.icon;
    const DOT_D    = 20;
    const DOT_R    = DOT_D / 2;
    const TRACK_H  = 2;
    const WRAP_H   = 28;
    const railTop  = WRAP_H / 2;

    // Build the checkout order — use the order-based external_reference
    const extRef = (window as any).__sm_ext_ref ?? `${orderId ?? ''}:${id}`;
    const checkoutOrder: CheckoutOrder = {
        amount:            plan.price,
        description:       `SulMotor – Impulsionar ${car.marca} ${car.modelo} ${car.ano} – ${plan.label}`,
        periodLabel:       plan.label,
        durationDays:      plan.duration_days,
        perDay:            parseFloat((plan.price / plan.duration_days).toFixed(2)),
        planName:          plan.name,
        externalReference: extRef,
        payerEmail:        user?.email ?? '',
        payerName:         user?.user_metadata?.full_name ?? user?.email?.split('@')[0] ?? 'Cliente',
    };

    return (
        <div className="bg-zinc-950 min-h-screen py-12">
            <div className="max-w-xl mx-auto px-4">

                {/* Header */}
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-10">
                    <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-brand-400/10 border border-brand-400/30 rounded-full mb-4">
                        <Rocket className="w-3.5 h-3.5 text-brand-400" strokeWidth={1.5} />
                        <span className="text-xs font-bold text-brand-400 uppercase tracking-widest">Impulsionar Anúncio</span>
                    </div>
                    <h1 className="text-3xl md:text-4xl font-black text-white mb-3 tracking-tight">
                        Destaque seu veículo
                    </h1>
                    <p className="text-zinc-400 text-sm">
                        Apareça no topo das buscas e receba{' '}
                        <span className="text-brand-400 font-bold">até 10× mais visualizações</span>
                    </p>
                </motion.div>

                {/* Car Preview */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}
                    className="flex items-center gap-4 p-4 bg-zinc-900 border border-white/8 rounded-2xl mb-6"
                >
                    {car.imagens[0] && (
                        <img src={car.imagens[0]} alt=""
                            className="w-20 h-14 object-cover rounded-xl flex-shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                        <h3 className="text-white font-bold truncate">{car.marca} {car.modelo} {car.ano}</h3>
                        <p className="text-brand-400 font-black text-lg">{fmt(car.preco)}</p>
                    </div>
                    <div className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-bold ${planMeta.badge}`}>
                        <PlanIcon className="w-3 h-3" strokeWidth={1.5} />
                        {plan.label}
                    </div>
                </motion.div>

                {/* Plan Selector Cards */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }}
                    className="mb-6"
                >
                    <h3 className="text-white font-black text-lg mb-1 text-center">Escolha seu plano</h3>
                    <p className="text-zinc-500 text-xs mb-5 text-center">Selecione o período de destaque</p>

                    <div className="grid gap-3">
                        {plans.map((p, i) => {
                            const meta  = PLAN_META[p.name] ?? PLAN_META.basic_boost;
                            const Icon  = meta.icon;
                            const sel   = i === selectedIdx;
                            const perDy = parseFloat((p.price / p.duration_days).toFixed(2));
                            return (
                                <button
                                    key={p.name}
                                    onClick={() => setSelectedIdx(i)}
                                    className={`relative w-full text-left p-4 rounded-2xl border-2 transition-all group ${
                                        sel
                                            ? 'border-brand-400/60 bg-brand-400/8 shadow-glow'
                                            : 'border-white/10 bg-zinc-900 hover:border-white/20'
                                    }`}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                                            sel ? 'bg-brand-400/20' : 'bg-zinc-800'
                                        }`}>
                                            <Icon className={`w-5 h-5 ${sel ? 'text-brand-400' : 'text-zinc-500'}`} strokeWidth={1.5} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <span className={`font-black text-sm ${sel ? 'text-white' : 'text-zinc-300'}`}>
                                                    {p.label}
                                                </span>
                                                <span className="text-zinc-500 text-xs">• {p.duration_days} dias</span>
                                                {p.name === 'premium_boost' && (
                                                    <span className="px-2 py-0.5 bg-blue-500/20 text-blue-400 text-[10px] font-bold rounded-full">
                                                        POPULAR
                                                    </span>
                                                )}
                                                {p.name === 'ultra_boost' && (
                                                    <span className="px-2 py-0.5 bg-amber-500/20 text-amber-400 text-[10px] font-bold rounded-full">
                                                        MELHOR VALOR
                                                    </span>
                                                )}
                                            </div>
                                            <p className={`text-xs mt-0.5 ${sel ? 'text-zinc-400' : 'text-zinc-600'}`}>
                                                {meta.desc}
                                            </p>
                                        </div>
                                        <div className="flex-shrink-0 text-right">
                                            <p className={`font-black text-lg ${sel ? 'text-white' : 'text-zinc-400'}`}>
                                                {fmt(p.price)}
                                            </p>
                                            <p className="text-zinc-600 text-[11px]">{fmt(perDy)}/dia</p>
                                        </div>
                                        <div className={`flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                                            sel ? 'border-brand-400 bg-brand-400' : 'border-zinc-700'
                                        }`}>
                                            {sel && <Check className="w-3 h-3 text-zinc-950" strokeWidth={3} />}
                                        </div>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </motion.div>

                {/* Slider (compact) */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.16 }}
                    className="bg-zinc-900 border border-white/8 rounded-2xl p-5 mb-6"
                >
                    {/* Selected plan summary */}
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={plan.name}
                            initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
                            transition={{ duration: 0.15 }}
                            className="mb-5"
                        >
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2">
                                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center bg-brand-400/15`}>
                                        <PlanIcon className="w-4 h-4 text-brand-400" strokeWidth={1.5} />
                                    </div>
                                    <div>
                                        <p className="text-white font-black text-sm">Plano {plan.label}</p>
                                        <p className="text-zinc-500 text-xs">{plan.duration_days} dias de destaque</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="text-3xl font-black text-white">{fmt(plan.price)}</p>
                                    <p className="text-zinc-500 text-xs">{fmt(checkoutOrder.perDay)}/dia</p>
                                </div>
                            </div>

                            {/* Benefits list */}
                            <div className="space-y-1.5">
                                {[
                                    `${plan.duration_days} dias no topo das buscas`,
                                    `Prioridade nível ${plan.priority_level} (${['Básica','Alta','Máxima'][plan.priority_level - 1] ?? 'Alta'})`,
                                    'Selo de destaque no card',
                                    'Mais contatos e visualizações',
                                ].map(b => (
                                    <div key={b} className="flex items-center gap-2 text-xs text-zinc-400">
                                        <Check className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" strokeWidth={2.5} />
                                        {b}
                                    </div>
                                ))}
                            </div>
                        </motion.div>
                    </AnimatePresence>

                    {/* Slider */}
                    <div className="mb-5" style={{ paddingLeft: DOT_R, paddingRight: DOT_R }}>
                        <div
                            ref={trackRef}
                            className="relative select-none cursor-pointer"
                            style={{ height: WRAP_H }}
                            onClick={e => { if (!isDragging.current) setSelectedIdx(xToSnap(e.clientX)); }}
                        >
                            <div className="absolute left-0 right-0 rounded-full bg-zinc-700"
                                style={{ top: railTop - TRACK_H / 2, height: TRACK_H }} />
                            <motion.div className="absolute left-0 rounded-full bg-brand-400 origin-left"
                                style={{ top: railTop - TRACK_H / 2, height: TRACK_H }}
                                animate={{ width: `${dotPct(selectedIdx)}%` }}
                                transition={{ type: 'spring', stiffness: 350, damping: 35 }} />
                            {plans.map((_, i) => (
                                <div key={i} className="absolute w-[2px] rounded-full"
                                    style={{
                                        left: `${dotPct(i)}%`,
                                        top: railTop - 7, height: 14,
                                        transform: 'translateX(-50%)',
                                        background: i <= selectedIdx ? 'rgb(0 212 255)' : 'rgb(82 82 91)',
                                    }} />
                            ))}
                            <motion.div
                                className="absolute rounded-full bg-brand-400 z-10 touch-none"
                                style={{
                                    width: DOT_D, height: DOT_D,
                                    top: railTop - DOT_R,
                                    boxShadow: dragging ? '0 0 18px rgba(0,212,255,0.9)' : '0 0 12px rgba(0,212,255,0.6)',
                                    cursor: dragging ? 'grabbing' : 'grab',
                                    transform: 'translateX(-50%)',
                                }}
                                animate={{ left: `${dotPct(selectedIdx)}%` }}
                                transition={{ type: 'spring', stiffness: 350, damping: 35 }}
                                onPointerDown={onPointerDown}
                                onPointerMove={onPointerMove}
                                onPointerUp={onPointerUp}
                                onPointerCancel={onPointerUp}
                            />
                        </div>
                        <div className="relative mt-3" style={{ height: 20 }}>
                            {plans.map((p, i) => (
                                <button key={i} onClick={() => setSelectedIdx(i)}
                                    className={`absolute text-[11px] font-semibold whitespace-nowrap transition-colors ${
                                        selectedIdx === i ? 'text-brand-400 font-bold' : 'text-zinc-500 hover:text-zinc-300'
                                    }`}
                                    style={{ left: `${dotPct(i)}%`, transform: 'translateX(-50%)' }}>
                                    {p.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Payment badges */}
                    <div className="flex items-center justify-center gap-2 mb-5 flex-wrap">
                        {[
                            { icon: QrCode,      color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20', label: 'PIX' },
                            { icon: CreditCard,  color: 'text-blue-400',    bg: 'bg-blue-500/10 border-blue-500/20',       label: 'Cartão' },
                            { icon: ExternalLink,color: 'text-brand-400',   bg: 'bg-brand-400/10 border-brand-400/20',     label: 'Boleto' },
                        ].map(({ icon: Icon, color, bg, label }) => (
                            <div key={label} className={`flex items-center gap-1.5 px-3 py-1.5 ${bg} border rounded-full`}>
                                <Icon className={`w-3.5 h-3.5 ${color}`} strokeWidth={1.5} />
                                <span className={`text-xs ${color} font-bold`}>{label}</span>
                            </div>
                        ))}
                    </div>

                    {/* CTA */}
                    <button
                        onClick={handleOpenCheckout}
                        disabled={orderLoading}
                        className="w-full flex items-center justify-center gap-2.5 py-4 bg-brand-400 hover:bg-brand-300 disabled:opacity-70 disabled:cursor-not-allowed text-zinc-950 font-black rounded-xl transition-all hover:shadow-glow active:scale-[0.98]"
                    >
                        {orderLoading
                            ? <><Loader2 className="w-5 h-5 animate-spin" strokeWidth={1.5} />Preparando…</>
                            : <><Rocket className="w-5 h-5" strokeWidth={1.5} />Impulsionar por {fmt(plan.price)}</>
                        }
                    </button>

                    <div className="flex items-center justify-center gap-1.5 mt-3">
                        <ShieldCheck className="w-3.5 h-3.5 text-zinc-600" strokeWidth={1.5} />
                        <p className="text-center text-xs text-zinc-600">
                            Checkout transparente · Mercado Pago · SSL 256-bit
                        </p>
                    </div>
                </motion.div>

                {/* Benefits */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
                    className="grid grid-cols-3 gap-3 mb-8"
                >
                    {[
                        { icon: TrendingUp, title: '10× mais views',    desc: 'Exposição máxima' },
                        { icon: Zap,        title: 'Ativação imediata', desc: 'Em segundos' },
                        { icon: ShieldCheck,title: 'Pagamento seguro',  desc: 'Mercado Pago' },
                    ].map(({ icon: Icon, title, desc }) => (
                        <div key={title} className="text-center p-4 bg-zinc-900 border border-brand-400/15 rounded-2xl">
                            <Icon className="w-5 h-5 text-brand-400 mx-auto mb-2" strokeWidth={1.5} />
                            <h4 className="text-white text-xs font-bold">{title}</h4>
                            <p className="text-zinc-500 text-[11px] mt-0.5">{desc}</p>
                        </div>
                    ))}
                </motion.div>

                <div className="text-center">
                    <Link to="/meus-anuncios"
                        className="inline-flex items-center gap-1.5 text-zinc-500 hover:text-white text-sm transition-colors">
                        <ArrowLeft className="w-4 h-4" strokeWidth={1.5} />
                        Voltar para meus anúncios
                    </Link>
                </div>
            </div>

            {/* Checkout Modal */}
            <CheckoutModal
                open={showCheckout}
                order={checkoutOrder}
                onClose={() => { setShowCheckout(false); setOrderId(null); }}
                onApproved={handleApproved}
            />
        </div>
    );
}
