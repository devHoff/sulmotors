import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
    Search, Home, Car, PlusCircle, ArrowRight,
    AlertTriangle, Loader2,
} from 'lucide-react';
import CarCard from '../components/CarCard';
import { supabasePublic } from '../lib/supabase';
import type { Car as CarType } from '../data/mockCars';

// ── Error tracking ────────────────────────────────────────────────────────────
/**
 * Logs 404 events to Supabase for analytics / broken-link debugging.
 * Table: page_errors (id, url, referrer, timestamp, user_agent)
 * Non-fatal — silently catches all errors so the UI is never blocked.
 */
async function track404(url: string, referrer: string) {
    try {
        // Fire-and-forget: we deliberately don't await the result
        const insertPromise = supabasePublic.from('page_errors').insert({
            url,
            referrer: referrer || null,
            timestamp: new Date().toISOString(),
            user_agent: navigator.userAgent.slice(0, 255),
        });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (insertPromise as any).then(() => {}).catch(() => {});
    } catch {
        // silently ignore
    }
}

// ── Suggested categories ──────────────────────────────────────────────────────
const CATEGORIES = [
    { label: 'SUVs',                 query: '/estoque?categoria=suv',         emoji: '🚙' },
    { label: 'Sedans',               query: '/estoque?categoria=sedan',        emoji: '🚗' },
    { label: 'Carros até R$50.000',  query: '/estoque?maxPrice=50000',         emoji: '💰' },
    { label: 'Santa Catarina',       query: '/estoque?q=Santa Catarina',       emoji: '🗺️' },
    { label: 'Hatchbacks',           query: '/estoque?categoria=hatch',        emoji: '🚘' },
    { label: 'Automáticos',          query: '/estoque?cambio=Automático',      emoji: '⚙️' },
] as const;

// ── CTA Actions ───────────────────────────────────────────────────────────────
const ACTIONS = [
    { to: '/',           label: 'Voltar para início',  icon: Home,        primary: true  },
    { to: '/estoque',    label: 'Ver carros à venda',  icon: Car,         primary: false },
    { to: '/anunciar',   label: 'Anunciar carro',      icon: PlusCircle,  primary: false },
] as const;

// ── Component ─────────────────────────────────────────────────────────────────
export default function NotFound() {
    const navigate  = useNavigate();
    const location  = useLocation();
    const [query,   setQuery]   = useState('');
    const [cars,    setCars]    = useState<CarType[]>([]);
    const [loading, setLoading] = useState(true);

    // Track 404 on mount
    useEffect(() => {
        track404(
            window.location.href,
            document.referrer,
        );
    }, []);

    // Load a few featured cars for the "suggested listings" section
    useEffect(() => {
        const fetchSuggested = async () => {
            setLoading(true);
            const { data } = await supabasePublic
                .from('anuncios')
                .select('*')
                .or('impulsionado.eq.true,destaque.eq.true')
                .order('prioridade', { ascending: false })
                .order('created_at', { ascending: false })
                .limit(3);

            if (data && data.length > 0) {
                setCars(data.map((d: any) => ({
                    id: d.id, marca: d.marca, modelo: d.modelo, ano: d.ano,
                    preco: Number(d.preco), quilometragem: d.quilometragem,
                    telefone: d.telefone, descricao: d.descricao || '',
                    combustivel: d.combustivel, cambio: d.cambio, cor: d.cor,
                    cidade: d.cidade, aceitaTroca: d.aceita_troca ?? false,
                    imagens: d.imagens || [], destaque: d.destaque ?? false,
                    impulsionado: d.impulsionado ?? false,
                    impulsionado_ate: d.impulsionado_ate || undefined,
                    prioridade: d.prioridade ?? 0, modelo_3d: false,
                    created_at: d.created_at, user_id: d.user_id,
                })));
            } else {
                // Fall back: show any recent listings
                const { data: fallback } = await supabasePublic
                    .from('anuncios')
                    .select('*')
                    .order('created_at', { ascending: false })
                    .limit(3);
                if (fallback) {
                    setCars(fallback.map((d: any) => ({
                        id: d.id, marca: d.marca, modelo: d.modelo, ano: d.ano,
                        preco: Number(d.preco), quilometragem: d.quilometragem,
                        telefone: d.telefone, descricao: d.descricao || '',
                        combustivel: d.combustivel, cambio: d.cambio, cor: d.cor,
                        cidade: d.cidade, aceitaTroca: d.aceita_troca ?? false,
                        imagens: d.imagens || [], destaque: d.destaque ?? false,
                        impulsionado: d.impulsionado ?? false,
                        prioridade: d.prioridade ?? 0, modelo_3d: false,
                        created_at: d.created_at, user_id: d.user_id,
                    })));
                }
            }
            setLoading(false);
        };
        fetchSuggested();
    }, []);

    const handleSearch = useCallback((e: React.FormEvent) => {
        e.preventDefault();
        if (query.trim()) navigate(`/estoque?q=${encodeURIComponent(query.trim())}`);
    }, [query, navigate]);

    return (
        <div className="bg-zinc-950 min-h-screen">

            {/* ── Hero section ── */}
            <div className="relative overflow-hidden">
                {/* Subtle grid background */}
                <div
                    className="absolute inset-0 opacity-[0.04]"
                    style={{
                        backgroundImage: 'linear-gradient(rgba(0,212,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(0,212,255,1) 1px, transparent 1px)',
                        backgroundSize: '40px 40px',
                    }}
                />
                {/* Radial glow */}
                <div className="absolute inset-0 bg-radial-glow opacity-30" />

                <div className="relative max-w-3xl mx-auto px-4 pt-20 pb-16 text-center">
                    {/* Alert badge */}
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y:   0 }}
                        transition={{ duration: 0.4 }}
                        className="inline-flex items-center gap-2 px-4 py-1.5 bg-red-500/10 border border-red-500/25 rounded-full mb-6"
                    >
                        <AlertTriangle className="w-3.5 h-3.5 text-red-400" strokeWidth={2} />
                        <span className="text-xs font-bold text-red-400 uppercase tracking-widest">Página não encontrada</span>
                    </motion.div>

                    {/* 404 number */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.85 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.5, delay: 0.05 }}
                        className="relative inline-block mb-4"
                    >
                        <span
                            className="text-[9rem] sm:text-[12rem] font-black leading-none select-none"
                            style={{
                                background: 'linear-gradient(135deg, rgba(0,212,255,0.9) 0%, rgba(0,212,255,0.25) 60%, rgba(0,212,255,0.05) 100%)',
                                WebkitBackgroundClip: 'text',
                                WebkitTextFillColor: 'transparent',
                                backgroundClip: 'text',
                            }}
                        >
                            404
                        </span>
                        {/* Tyre skid decoration */}
                        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 w-40 h-2 opacity-20"
                            style={{
                                background: 'repeating-linear-gradient(90deg, #00d4ff 0, #00d4ff 8px, transparent 8px, transparent 16px)',
                                borderRadius: 4,
                            }}
                        />
                    </motion.div>

                    {/* Headline */}
                    <motion.h1
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y:  0 }}
                        transition={{ duration: 0.4, delay: 0.1 }}
                        className="text-2xl sm:text-3xl md:text-4xl font-black text-white mb-3 tracking-tight"
                    >
                        Ops! Esta página saiu da pista.
                    </motion.h1>

                    {/* Subtitle */}
                    <motion.p
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y:  0 }}
                        transition={{ duration: 0.4, delay: 0.15 }}
                        className="text-zinc-400 text-sm sm:text-base leading-relaxed max-w-lg mx-auto mb-8"
                    >
                        O link pode estar quebrado ou o anúncio pode ter sido removido.
                        Mas você ainda pode encontrar milhares de veículos no SulMotor.
                    </motion.p>

                    {/* Search bar */}
                    <motion.form
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y:  0 }}
                        transition={{ duration: 0.4, delay: 0.2 }}
                        onSubmit={handleSearch}
                        className="flex gap-2 max-w-md mx-auto mb-8"
                    >
                        <div className="relative flex-1">
                            <Search
                                className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500"
                                strokeWidth={1.5}
                            />
                            <input
                                type="text"
                                value={query}
                                onChange={e => setQuery(e.target.value)}
                                placeholder="Buscar carros, marcas ou cidades"
                                className="w-full pl-10 pr-4 py-3 bg-zinc-900 border border-white/10 rounded-xl text-white text-sm placeholder-zinc-600 focus:outline-none focus:border-brand-400/50 focus:ring-1 focus:ring-brand-400/20 transition-all"
                                aria-label="Buscar veículos"
                            />
                        </div>
                        <button
                            type="submit"
                            className="flex items-center gap-2 px-5 py-3 bg-brand-400 hover:bg-brand-300 text-zinc-950 font-black rounded-xl transition-all active:scale-[0.97] whitespace-nowrap"
                        >
                            Buscar
                            <ArrowRight className="w-4 h-4" strokeWidth={2} />
                        </button>
                    </motion.form>

                    {/* CTA buttons */}
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y:  0 }}
                        transition={{ duration: 0.4, delay: 0.25 }}
                        className="flex flex-wrap justify-center gap-3"
                    >
                        {ACTIONS.map(({ to, label, icon: Icon, primary }) => (
                            <Link
                                key={to}
                                to={to}
                                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all
                                    ${primary
                                        ? 'bg-brand-400 hover:bg-brand-300 text-zinc-950 shadow-glow'
                                        : 'bg-zinc-800 hover:bg-zinc-700 border border-white/10 text-white'
                                    }`}
                            >
                                <Icon className="w-4 h-4" strokeWidth={1.5} />
                                {label}
                            </Link>
                        ))}
                    </motion.div>
                </div>
            </div>

            {/* ── Suggested categories ── */}
            <div className="max-w-3xl mx-auto px-4 pb-10">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y:  0 }}
                    transition={{ duration: 0.4, delay: 0.3 }}
                >
                    <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest mb-4 text-center">
                        Categorias populares
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {CATEGORIES.map(({ label, query, emoji }) => (
                            <Link
                                key={label}
                                to={query}
                                className="flex items-center gap-2.5 px-4 py-3 bg-zinc-900 hover:bg-zinc-800 border border-white/8 hover:border-brand-400/30 rounded-xl text-sm text-zinc-300 hover:text-white font-medium transition-all group"
                            >
                                <span className="text-lg leading-none">{emoji}</span>
                                <span className="flex-1 truncate">{label}</span>
                                <ArrowRight className="w-3.5 h-3.5 text-zinc-600 group-hover:text-brand-400 transition-colors flex-shrink-0" strokeWidth={2} />
                            </Link>
                        ))}
                    </div>
                </motion.div>
            </div>

            {/* ── Suggested listings ── */}
            <div className="max-w-5xl mx-auto px-4 pb-16">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y:  0 }}
                    transition={{ duration: 0.4, delay: 0.35 }}
                >
                    <div className="flex items-center justify-between mb-5">
                        <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest">
                            Veículos em destaque
                        </p>
                        <Link to="/estoque" className="text-xs text-brand-400 font-bold hover:text-brand-300 transition-colors flex items-center gap-1">
                            Ver todos <ArrowRight className="w-3 h-3" strokeWidth={2} />
                        </Link>
                    </div>

                    {loading ? (
                        <div className="flex items-center justify-center py-12">
                            <Loader2 className="w-8 h-8 text-brand-400 animate-spin" strokeWidth={1.5} />
                        </div>
                    ) : cars.length > 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            {cars.map(car => (
                                <CarCard key={car.id} car={car} />
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-10 text-zinc-600 text-sm">
                            Nenhum veículo em destaque no momento.
                        </div>
                    )}
                </motion.div>
            </div>

        </div>
    );
}
