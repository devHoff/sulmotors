import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CheckCircle2, Clock, XCircle, Rocket, ArrowLeft, RefreshCw } from 'lucide-react';
import { supabase } from '../lib/supabase';

type PayStatus = 'checking' | 'approved' | 'pending' | 'rejected' | 'unknown';

export default function ImpulsionarSucesso() {
    const [params] = useSearchParams();
    const pagamentoId = params.get('pagamento_id');
    const anuncioId   = params.get('anuncio_id');
    const statusParam = params.get('status'); // 'pendente' when coming from back_url pending

    const [status, setStatus] = useState<PayStatus>('checking');
    const [checking, setChecking] = useState(false);

    const checkStatus = async () => {
        if (!pagamentoId) { setStatus('unknown'); return; }
        setChecking(true);
        try {
            const { data } = await supabase
                .from('pagamentos')
                .select('status')
                .eq('id', pagamentoId)
                .single();

            const s = data?.status as string | undefined;
            if (s === 'approved')   setStatus('approved');
            else if (s === 'rejected' || s === 'cancelled') setStatus('rejected');
            else if (s === 'pendente' || s === 'pending' || s === 'in_process') setStatus('pending');
            else setStatus('unknown');
        } catch {
            setStatus('unknown');
        } finally {
            setChecking(false);
        }
    };

    useEffect(() => {
        // If MP redirected to pending URL, default to pending view
        if (statusParam === 'pendente') {
            setStatus('pending');
            return;
        }
        checkStatus();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pagamentoId]);

    const config = {
        approved: {
            icon: CheckCircle2,
            color: 'text-emerald-400',
            bg: 'bg-emerald-500/10 border-emerald-500/20',
            title: 'Pagamento aprovado!',
            sub: 'Seu anúncio já está sendo impulsionado. Ele aparecerá no topo das buscas imediatamente.',
            badge: 'Boost ativo',
            badgeColor: 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400',
        },
        pending: {
            icon: Clock,
            color: 'text-yellow-400',
            bg: 'bg-yellow-500/10 border-yellow-500/20',
            title: 'Pagamento em processamento',
            sub: 'Seu pagamento está sendo confirmado. Se pagou via PIX, a ativação é automática em poucos segundos após a confirmação.',
            badge: 'Aguardando confirmação',
            badgeColor: 'bg-yellow-500/15 border-yellow-500/30 text-yellow-400',
        },
        rejected: {
            icon: XCircle,
            color: 'text-red-400',
            bg: 'bg-red-500/10 border-red-500/20',
            title: 'Pagamento não aprovado',
            sub: 'Seu pagamento foi recusado ou cancelado. Tente novamente com outro método de pagamento.',
            badge: 'Pagamento recusado',
            badgeColor: 'bg-red-500/15 border-red-500/30 text-red-400',
        },
        unknown: {
            icon: Clock,
            color: 'text-zinc-400',
            bg: 'bg-zinc-800 border-zinc-700',
            title: 'Verificando pagamento...',
            sub: 'Aguarde enquanto verificamos o status do seu pagamento.',
            badge: 'Verificando',
            badgeColor: 'bg-zinc-800 border-zinc-700 text-zinc-400',
        },
        checking: {
            icon: Clock,
            color: 'text-brand-400',
            bg: 'bg-brand-400/10 border-brand-400/20',
            title: 'Verificando pagamento...',
            sub: 'Aguarde enquanto buscamos o status do seu pagamento.',
            badge: 'Verificando',
            badgeColor: 'bg-brand-400/10 border-brand-400/30 text-brand-400',
        },
    }[status];

    const Icon = config.icon;

    return (
        <div className="min-h-screen bg-zinc-950 flex items-center justify-center px-4 py-16">
            <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ type: 'spring', stiffness: 280, damping: 28 }}
                className="w-full max-w-md"
            >
                {/* Icon */}
                <motion.div
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.15, type: 'spring', stiffness: 300, damping: 22 }}
                    className={`w-20 h-20 ${config.bg} border rounded-3xl flex items-center justify-center mx-auto mb-6`}
                >
                    <Icon className={`w-10 h-10 ${config.color}`} strokeWidth={1.5} />
                </motion.div>

                {/* Badge */}
                <div className="flex justify-center mb-4">
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 border rounded-full text-xs font-bold ${config.badgeColor}`}>
                        <Rocket className="w-3 h-3" strokeWidth={1.5} />
                        {config.badge}
                    </span>
                </div>

                {/* Title & sub */}
                <h1 className="text-2xl md:text-3xl font-black text-white text-center mb-3 tracking-tight">
                    {config.title}
                </h1>
                <p className="text-zinc-400 text-sm text-center leading-relaxed mb-8">
                    {config.sub}
                </p>

                {/* Actions */}
                <div className="space-y-3">
                    {/* Check again (for pending) */}
                    {(status === 'pending' || status === 'unknown') && (
                        <button
                            onClick={checkStatus}
                            disabled={checking}
                            className="w-full flex items-center justify-center gap-2 py-3 bg-zinc-800 hover:bg-zinc-700 border border-white/8 text-white font-bold rounded-xl transition-all text-sm disabled:opacity-50"
                        >
                            <RefreshCw className={`w-4 h-4 ${checking ? 'animate-spin' : ''}`} strokeWidth={1.5} />
                            {checking ? 'Verificando...' : 'Verificar status novamente'}
                        </button>
                    )}

                    {/* Back to my ads */}
                    <Link
                        to="/meus-anuncios"
                        className="w-full flex items-center justify-center gap-2.5 py-4 bg-brand-400 hover:bg-brand-300 text-zinc-950 font-black rounded-xl transition-all hover:shadow-glow text-sm"
                    >
                        <Rocket className="w-4 h-4" strokeWidth={1.5} />
                        Ver Meus Anúncios
                    </Link>

                    {/* Retry if rejected */}
                    {(status === 'rejected') && anuncioId && (
                        <Link
                            to={`/impulsionar/${anuncioId}`}
                            className="w-full flex items-center justify-center gap-2 py-3 text-zinc-400 hover:text-white text-sm font-medium transition-colors"
                        >
                            <RefreshCw className="w-4 h-4" strokeWidth={1.5} />
                            Tentar novamente
                        </Link>
                    )}

                    <Link
                        to="/"
                        className="w-full flex items-center justify-center gap-1.5 py-2 text-zinc-600 hover:text-zinc-400 text-xs transition-colors"
                    >
                        <ArrowLeft className="w-3.5 h-3.5" strokeWidth={1.5} />
                        Voltar para o início
                    </Link>
                </div>

                {/* Note */}
                {status === 'approved' && (
                    <motion.p
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.4 }}
                        className="text-xs text-zinc-600 text-center mt-8"
                    >
                        O boost será desativado automaticamente ao final do período contratado.
                    </motion.p>
                )}
            </motion.div>
        </div>
    );
}
