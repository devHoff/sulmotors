/**
 * Toast Demo Page — /toast-demo
 * Allows QA testing of all toast variants, stacking, grouping, and sound.
 * This page will be removed or hidden in production.
 */

import { useState } from 'react';
import { useToast } from '../contexts/ToastContext';
import { smToast } from '../utils/toast';
import { Bell, Volume2, VolumeX, Zap, CheckCircle2, XCircle, AlertTriangle, Info } from 'lucide-react';

export default function ToastDemo() {
    const { success, error, warning, info, dismissAll, soundEnabled, setSoundEnabled } = useToast();
    const [count, setCount] = useState(0);

    const fireMultiple = () => {
        success('Anúncio criado com sucesso', 'Honda Civic 2022 enviado para revisão.');
        setTimeout(() => info('Nova mensagem recebida', 'João Silva enviou uma mensagem.'), 300);
        setTimeout(() => warning('Limite diário atingido', 'Você pode publicar até 3 anúncios por dia.'), 600);
        setTimeout(() => error('Erro ao publicar anúncio', 'Verifique os campos e tente novamente.'), 900);
        setCount(c => c + 4);
    };

    const tests = [
        {
            label: 'Success', icon: CheckCircle2, color: '#4ade80',
            fn: () => { success('Perfil atualizado', 'Suas informações foram salvas com sucesso.'); setCount(c => c + 1); }
        },
        {
            label: 'Error', icon: XCircle, color: '#f87171',
            fn: () => { error('Erro ao publicar anúncio', 'Campos obrigatórios não preenchidos.'); setCount(c => c + 1); }
        },
        {
            label: 'Warning', icon: AlertTriangle, color: '#fbbf24',
            fn: () => { warning('Perfil incompleto', 'Complete seu perfil antes de publicar veículos.'); setCount(c => c + 1); }
        },
        {
            label: 'Info', icon: Info, color: '#60a5fa',
            fn: () => { info('Novo carro encontrado nos seus alertas', 'Fiat Argo 2023 — R$ 72.000'); setCount(c => c + 1); }
        },
    ];

    const semanticTests = [
        { label: 'profileSaved',     fn: () => smToast.profileSaved() },
        { label: 'listingCreated',   fn: () => smToast.listingCreated('Toyota Corolla 2024') },
        { label: 'listingApproved',  fn: () => smToast.listingApproved('Honda Civic EXL') },
        { label: 'listingRejected',  fn: () => smToast.listingRejected() },
        { label: 'listingError',     fn: () => smToast.listingError() },
        { label: 'dailyLimitReached',fn: () => smToast.dailyLimitReached() },
        { label: 'newMessage',       fn: () => smToast.newMessage('Maria Souza') },
        { label: 'messageFlagged',   fn: () => smToast.messageFlagged() },
        { label: 'favoriteAdded',    fn: () => smToast.favoriteAdded('BMW X5 2022') },
        { label: 'favoriteRemoved',  fn: () => smToast.favoriteRemoved('BMW X5 2022') },
        { label: 'priceAlert',       fn: () => smToast.priceAlert('Fiat Argo 1.3', 45000) },
        { label: 'alertCreated',     fn: () => smToast.alertCreated() },
        { label: 'loginSuccess',     fn: () => smToast.loginSuccess() },
        { label: 'signupSuccess',    fn: () => smToast.signupSuccess() },
        { label: 'authRequired',     fn: () => smToast.authRequired() },
        { label: 'networkError',     fn: () => smToast.networkError() },
        { label: 'copied',           fn: () => smToast.copied() },
        { label: 'verifiedBadge',    fn: () => smToast.verifiedBadgeGranted() },
    ];

    return (
        <div className="min-h-screen bg-[#0b0f14] py-16 px-6">
            <div className="max-w-2xl mx-auto">
                <div className="mb-10">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="w-9 h-9 bg-brand-400/15 border border-brand-400/20 rounded-xl flex items-center justify-center">
                            <Bell className="w-4 h-4 text-brand-400" strokeWidth={1.5} />
                        </div>
                        <span className="text-xs font-bold text-brand-400 uppercase tracking-widest">Enterprise Notifications</span>
                    </div>
                    <h1 className="text-4xl font-black text-white mb-2 tracking-tight">Toast System Demo</h1>
                    <p className="text-[#9ca3af] text-sm">SulMotors · Linear-style enterprise notification system</p>
                </div>

                {/* Controls */}
                <div className="flex items-center gap-3 mb-8 flex-wrap">
                    <button
                        onClick={() => setSoundEnabled(!soundEnabled)}
                        className="flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-semibold transition-all"
                        style={{
                            background: soundEnabled ? '#111827' : '#0f1f17',
                            borderColor: soundEnabled ? '#1f2937' : '#22c55e44',
                            color: soundEnabled ? '#9ca3af' : '#4ade80',
                        }}
                    >
                        {soundEnabled ? <Volume2 className="w-4 h-4" strokeWidth={1.5} /> : <VolumeX className="w-4 h-4" strokeWidth={1.5} />}
                        Som {soundEnabled ? 'ativado' : 'desativado'}
                    </button>

                    <button
                        onClick={dismissAll}
                        className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[#1f2937] bg-[#111827] text-[#9ca3af] text-sm font-semibold hover:text-white hover:border-[#374151] transition-colors"
                    >
                        Limpar todas
                    </button>

                    <button
                        onClick={fireMultiple}
                        className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-brand-400 hover:bg-brand-300 text-zinc-950 text-sm font-black transition-all"
                    >
                        <Zap className="w-4 h-4" strokeWidth={2} /> Disparar 4 notificações
                    </button>
                </div>

                {/* Type tests */}
                <div className="mb-8">
                    <p className="text-xs font-bold text-[#4b5563] uppercase tracking-widest mb-4">Tipos básicos</p>
                    <div className="grid grid-cols-2 gap-3">
                        {tests.map(({ label, icon: Icon, color, fn }) => (
                            <button
                                key={label}
                                onClick={fn}
                                className="flex items-center gap-3 px-4 py-3.5 rounded-xl border border-[#1f2937] bg-[#111827] hover:border-[#374151] text-left transition-all group"
                            >
                                <Icon style={{ width: 16, height: 16, color, flexShrink: 0 }} strokeWidth={2} />
                                <span className="text-sm font-semibold text-[#d1d5db] group-hover:text-white transition-colors">{label}</span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Semantic tests */}
                <div>
                    <p className="text-xs font-bold text-[#4b5563] uppercase tracking-widest mb-4">Eventos da plataforma (smToast)</p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {semanticTests.map(({ label, fn }) => (
                            <button
                                key={label}
                                onClick={fn}
                                className="px-3 py-2.5 rounded-lg border border-[#1f2937] bg-[#0d1117] hover:border-[#374151] hover:bg-[#111827] text-xs font-mono text-[#6b7280] hover:text-[#9ca3af] text-left transition-all"
                            >
                                {label}()
                            </button>
                        ))}
                    </div>
                </div>

                {/* Stats */}
                <div className="mt-10 p-4 rounded-xl border border-[#1f2937] bg-[#111827]">
                    <p className="text-xs text-[#4b5563]">
                        Toasts disparados nesta sessão: <span className="font-black text-[#9ca3af]">{count}</span>
                    </p>
                </div>
            </div>
        </div>
    );
}
