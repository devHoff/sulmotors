/**
 * LojaPublica.tsx — Página pública de uma loja parceira
 *
 * URL: /loja/:storeKey  (e.g. /loja/alexmegamotors)
 *
 * Exibe:
 *  - Banner + logo da loja
 *  - Estatísticas (total de veículos, em destaque)
 *  - Grid de todos os anúncios da loja com CarCard
 *  - Botão "Entrar em contato" via WhatsApp
 */

import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
    Phone, MapPin, Star, Car as CarIcon,
    MessageCircle, ChevronRight, BadgeCheck, Zap
} from 'lucide-react';
import CarCard from '../components/CarCard';
import { supabasePublic } from '../lib/supabase';
import { STORE_PROFILES, buildWhatsAppLink, type StoreProfile } from '../lib/storeProfiles';
import type { Car as CarType } from '../data/mockCars';

// ── helper ─────────────────────────────────────────────────────────────────────
function fmtBRL(n: number) {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0 }).format(n);
}

export default function LojaPublica() {
    const { storeKey = '' } = useParams<{ storeKey: string }>();
    const profile: StoreProfile | undefined = STORE_PROFILES[storeKey.toLowerCase()];

    const [cars, setCars]       = useState<CarType[]>([]);
    const [loading, setLoading] = useState(true);

    // ── fetch all ads from this store (by user_id) ────────────────────────────
    useEffect(() => {
        if (!profile) return;
        const fetch = async () => {
            setLoading(true);
            try {
                const { data, error } = await supabasePublic
                    .from('anuncios')
                    .select('*')
                    .eq('user_id', profile.userId)
                    .order('prioridade', { ascending: false })
                    .order('created_at',  { ascending: false });

                if (!error && data) {
                    setCars(data.map((d: any): CarType => ({
                        id: d.id, marca: d.marca, modelo: d.modelo,
                        ano: Number(d.ano), preco: Number(d.preco),
                        quilometragem: d.quilometragem,
                        telefone: d.telefone, descricao: d.descricao || '',
                        combustivel: d.combustivel, cambio: d.cambio,
                        cor: d.cor, cidade: d.cidade,
                        aceitaTroca: d.aceita_troca ?? false,
                        imagens: d.imagens || [],
                        destaque: d.destaque ?? false,
                        impulsionado: d.impulsionado ?? false,
                        impulsionado_ate: d.impulsionado_ate,
                        prioridade: Number(d.prioridade ?? 0),
                        modelo_3d: false,
                        created_at: d.created_at,
                        user_id: d.user_id,
                        loja: profile.name,
                        slug: d.slug,
                    })));
                }
            } finally {
                setLoading(false);
            }
        };
        fetch();
    }, [profile]);

    // ── 404 state ─────────────────────────────────────────────────────────────
    if (!profile) {
        return (
            <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
                <div className="text-center">
                    <p className="text-zinc-400 text-lg mb-4">Loja não encontrada.</p>
                    <Link to="/estoque" className="text-brand-400 hover:underline">← Voltar ao estoque</Link>
                </div>
            </div>
        );
    }

    const totalAds      = cars.length;
    const destaquesCount = cars.filter(c => c.destaque).length;
    const totalValue     = cars.reduce((s, c) => s + c.preco, 0);
    const waLink = buildWhatsAppLink({ whatsappNumber: profile.whatsappNumber, vehicleName: `veículos da ${profile.name}` });

    return (
        <div className="min-h-screen bg-zinc-950 text-white">

            {/* ── Hero Banner ─────────────────────────────────────────────── */}
            <div className="relative overflow-hidden bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-900 border-b border-white/10">
                {/* Background glow */}
                <div className="absolute inset-0 pointer-events-none">
                    <div className="absolute top-0 left-1/4 w-96 h-96 bg-brand-500/10 rounded-full blur-3xl" />
                    <div className="absolute bottom-0 right-1/4 w-64 h-64 bg-brand-400/5 rounded-full blur-2xl" />
                </div>

                <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                    <div className="flex flex-col md:flex-row items-center gap-8">

                        {/* Logo — centered vertically with content */}
                        <motion.div
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="flex-shrink-0 w-32 h-32 md:w-40 md:h-40 rounded-2xl bg-black shadow-2xl border-2 border-white/15 self-center flex items-center justify-center overflow-hidden"
                        >
                            <img src={profile.logo} alt={profile.name}
                                className="w-full h-full object-contain"
                            />
                        </motion.div>

                        {/* Info — centered text on all screen sizes */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="flex-1 text-center"
                        >
                            <div className="flex items-center justify-center gap-2 mb-1">
                                <span className="text-xs font-bold text-brand-400 uppercase tracking-widest">Loja Parceira</span>
                                <BadgeCheck className="w-4 h-4 text-brand-400" />
                            </div>
                            <h1 className="text-4xl md:text-5xl font-black tracking-tight mb-2">{profile.name}</h1>
                            {profile.tagline && (
                                <p className="text-zinc-400 text-base mb-4">{profile.tagline}</p>
                            )}

                            {/* Location + phone */}
                            <div className="flex flex-wrap items-center justify-center gap-4 text-sm text-zinc-400 mb-6">
                                {profile.cidade && (
                                    <span className="flex items-center gap-1.5">
                                        <MapPin className="w-4 h-4 text-brand-400" />
                                        {profile.cidade}
                                    </span>
                                )}
                                <span className="flex items-center gap-1.5">
                                    <Phone className="w-4 h-4 text-brand-400" />
                                    {profile.phoneDisplay}
                                </span>
                            </div>

                            {/* Stats */}
                            <div className="flex flex-wrap gap-4 justify-center mb-6">
                                <div className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 flex items-center gap-2">
                                    <CarIcon className="w-4 h-4 text-brand-400" />
                                    <span className="text-sm font-bold">{totalAds}</span>
                                    <span className="text-xs text-zinc-400">veículos</span>
                                </div>
                                {destaquesCount > 0 && (
                                    <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl px-4 py-2 flex items-center gap-2">
                                        <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                                        <span className="text-sm font-bold text-yellow-400">{destaquesCount}</span>
                                        <span className="text-xs text-zinc-400">em destaque</span>
                                    </div>
                                )}
                                <div className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 flex items-center gap-2">
                                    <Zap className="w-4 h-4 text-brand-400" />
                                    <span className="text-sm font-bold">{fmtBRL(totalValue)}</span>
                                    <span className="text-xs text-zinc-400">em portfólio</span>
                                </div>
                            </div>

                            {/* CTA */}
                            <a
                                href={waLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-2 px-6 py-3 bg-green-500 hover:bg-green-400 text-white font-bold rounded-xl transition-all duration-200 shadow-lg shadow-green-500/20 hover:shadow-green-400/30 hover:scale-105"
                            >
                                <MessageCircle className="w-5 h-5" />
                                Entrar em contato
                            </a>
                        </motion.div>
                    </div>
                </div>
            </div>

            {/* ── Listings ───────────────────────────────────────────────────── */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">

                {/* Section header */}
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h2 className="text-2xl font-black text-white">Veículos disponíveis</h2>
                        <p className="text-zinc-500 text-sm mt-0.5">
                            {loading ? 'Carregando...' : `${totalAds} veículo${totalAds !== 1 ? 's' : ''} listado${totalAds !== 1 ? 's' : ''}`}
                        </p>
                    </div>
                    <Link
                        to={`/estoque?loja=${storeKey}`}
                        className="text-brand-400 hover:text-brand-300 text-sm font-semibold flex items-center gap-1 transition-colors"
                    >
                        Ver no estoque <ChevronRight className="w-4 h-4" />
                    </Link>
                </div>

                {/* Loading */}
                {loading && (
                    <div className="flex items-center justify-center py-20">
                        <div className="w-10 h-10 border-2 border-brand-400 border-t-transparent rounded-full animate-spin" />
                    </div>
                )}

                {/* Empty */}
                {!loading && cars.length === 0 && (
                    <div className="text-center py-20">
                        <CarIcon className="w-16 h-16 text-zinc-700 mx-auto mb-4" />
                        <p className="text-zinc-400 text-lg font-semibold">Nenhum veículo disponível no momento.</p>
                        <p className="text-zinc-600 text-sm mt-1">Entre em contato diretamente com a loja.</p>
                        <a
                            href={waLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 mt-6 px-6 py-3 bg-green-600 hover:bg-green-500 text-white font-bold rounded-xl transition-all"
                        >
                            <MessageCircle className="w-5 h-5" />
                            Falar com a loja
                        </a>
                    </div>
                )}

                {/* Grid */}
                {!loading && cars.length > 0 && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
                    >
                        {cars.map((car, i) => (
                            <motion.div
                                key={car.id}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: i * 0.05 }}
                            >
                                <CarCard car={car} />
                            </motion.div>
                        ))}
                    </motion.div>
                )}
            </div>
        </div>
    );
}
