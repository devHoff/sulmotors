import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Loader2, CheckCircle2, XCircle, Lock, Eye, EyeOff, AlertTriangle } from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from '../utils/toast';

/**
 * /auth/callback
 *
 * Handles three Supabase redirect flows:
 *   1. OAuth social login  (Google / Apple / Facebook) → code exchange → home
 *   2. Password reset      → show "new password" form → update → login
 *   3. Email confirmation  → show success → home
 *
 * Supabase sends the tokens in the URL hash (#access_token=... or ?code=...)
 * depending on the PKCE vs implicit flow.
 */

type Stage =
    | 'loading'
    | 'set_password'   // password-recovery flow
    | 'success'
    | 'error';

export default function AuthCallback() {
    const navigate  = useNavigate();
    const [params]  = useSearchParams();

    const [stage,    setStage]    = useState<Stage>('loading');
    const [errorMsg, setErrorMsg] = useState('');

    // Password-set form
    const [newPass,   setNewPass]   = useState('');
    const [confPass,  setConfPass]  = useState('');
    const [showPass,  setShowPass]  = useState(false);
    const [submitting,setSubmitting]= useState(false);

    useEffect(() => {
        const handle = async () => {
            // ── 1. Parse hash tokens (implicit flow) ─────────────────────────
            const hash = window.location.hash.slice(1); // strip leading #
            const hashParams = new URLSearchParams(hash);

            const accessToken  = hashParams.get('access_token');
            const refreshToken = hashParams.get('refresh_token');
            const hashType     = hashParams.get('type');  // 'recovery' | 'signup' | 'magiclink'
            const errorParam   = hashParams.get('error');
            const errorDesc    = hashParams.get('error_description');

            // Also check query params for type (some Supabase flows use query)
            const queryType    = params.get('type');

            // Helper for Portuguese-friendly error messages
            const friendlyMsg = (raw: string): string => {
                const lower = (raw || '').toLowerCase();
                if (lower.includes('expired') || lower.includes('expir'))
                    return 'O link de acesso expirou. Por favor, solicite um novo link de redefinição de senha.';
                if (lower.includes('invalid') || lower.includes('inválido'))
                    return 'Link inválido. Por favor, solicite um novo link de acesso.';
                if (lower.includes('already') || lower.includes('used'))
                    return 'Este link já foi utilizado. Solicite um novo link.';
                return raw;
            };

            // ── Handle hash-encoded errors from Supabase ─────────────────────
            if (errorParam) {
                console.error('[AuthCallback] Hash error:', errorParam, errorDesc);
                setErrorMsg(friendlyMsg(errorDesc ?? errorParam));
                setStage('error');
                return;
            }

            // ── 2. PKCE code exchange (code in query params) ──────────────────
            const code = params.get('code');
            if (code) {
                const { data: sessionData, error } = await supabase.auth.exchangeCodeForSession(code);
                if (error) {
                    console.error('[AuthCallback] Code exchange error:', error.message);
                    setErrorMsg(friendlyMsg(error.message));
                    setStage('error');
                    return;
                }

                // Check if this is a password-recovery flow
                const isRecovery =
                    queryType === 'recovery' ||
                    hashType  === 'recovery' ||
                    (sessionData?.user?.recovery_sent_at != null &&
                     new Date(sessionData.user.recovery_sent_at).getTime() > Date.now() - 3600_000);

                if (isRecovery) {
                    setStage('set_password');
                    return;
                }

                // Successful OAuth login or email confirmation → go home
                setStage('success');
                setTimeout(() => navigate('/', { replace: true }), 1500);
                return;
            }

            // ── 3. Implicit flow with access_token in hash ────────────────────
            if (accessToken && refreshToken) {
                const { error } = await supabase.auth.setSession({
                    access_token:  accessToken,
                    refresh_token: refreshToken,
                });
                if (error) {
                    console.error('[AuthCallback] Set session error:', error.message);
                    setErrorMsg(friendlyMsg(error.message));
                    setStage('error');
                    return;
                }

                const isRecovery = hashType === 'recovery' || queryType === 'recovery';
                if (isRecovery) {
                    // Password-reset flow — show new-password form
                    setStage('set_password');
                    return;
                }

                // Email confirmation or social login — go home
                setStage('success');
                setTimeout(() => navigate('/', { replace: true }), 1500);
                return;
            }

            // ── 4. No tokens — check for existing session ────────────────────
            // Supabase may have auto-set the session from the URL (PKCE implicit)
            const { data: { session } } = await supabase.auth.getSession();
            if (session) {
                setStage('success');
                setTimeout(() => navigate('/', { replace: true }), 1500);
                return;
            }

            // Nothing recognisable — show error
            setErrorMsg('Link inválido ou expirado. Solicite um novo link de redefinição de senha.');
            setStage('error');
        };

        handle();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ── Submit new password ───────────────────────────────────────────────────
    const handleSetPassword = async (e: React.FormEvent) => {
        e.preventDefault();

        if (newPass.length < 8) {
            toast.error('A senha deve ter pelo menos 8 caracteres.');
            return;
        }
        if (newPass !== confPass) {
            toast.error('As senhas não coincidem.');
            return;
        }

        setSubmitting(true);
        try {
            const { error } = await supabase.auth.updateUser({ password: newPass });
            if (error) throw error;
            toast.success('Senha redefinida com sucesso!');
            setStage('success');
            setTimeout(() => navigate('/login', { replace: true }), 2000);
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Erro ao redefinir senha.';
            toast.error(msg);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen bg-zinc-950 flex items-center justify-center px-4">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full max-w-sm bg-zinc-900 border border-white/10 rounded-3xl p-8 shadow-2xl"
            >

                {/* ── LOADING ── */}
                {stage === 'loading' && (
                    <div className="flex flex-col items-center gap-4 text-center py-4">
                        <Loader2 className="w-12 h-12 text-brand-400 animate-spin" strokeWidth={1.5} />
                        <p className="text-white font-bold text-lg">Autenticando…</p>
                        <p className="text-zinc-500 text-sm">Aguarde um instante.</p>
                    </div>
                )}

                {/* ── SET NEW PASSWORD ── */}
                {stage === 'set_password' && (
                    <div>
                        <div className="flex flex-col items-center gap-3 mb-8 text-center">
                            <div className="w-16 h-16 bg-brand-400/15 border border-brand-400/30 rounded-2xl flex items-center justify-center">
                                <Lock className="w-8 h-8 text-brand-400" strokeWidth={1.5} />
                            </div>
                            <h1 className="text-2xl font-black text-white">Nova senha</h1>
                            <p className="text-zinc-500 text-sm">Digite e confirme sua nova senha de acesso.</p>
                        </div>

                        <form onSubmit={handleSetPassword} className="space-y-4">
                            {/* New password */}
                            <div>
                                <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1.5">
                                    Nova senha
                                </label>
                                <div className="relative">
                                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" strokeWidth={1.5} />
                                    <input
                                        type={showPass ? 'text' : 'password'}
                                        required
                                        minLength={8}
                                        placeholder="Min. 8 caracteres"
                                        value={newPass}
                                        onChange={e => setNewPass(e.target.value)}
                                        className="w-full pl-10 pr-12 py-3.5 bg-zinc-800 border border-white/10 rounded-xl text-white text-sm placeholder-zinc-600 focus:outline-none focus:border-brand-400/50 transition-all"
                                        autoComplete="new-password"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPass(v => !v)}
                                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-zinc-400 transition-colors"
                                        aria-label={showPass ? 'Ocultar senha' : 'Mostrar senha'}
                                    >
                                        {showPass
                                            ? <EyeOff className="w-4 h-4" strokeWidth={1.5} />
                                            : <Eye    className="w-4 h-4" strokeWidth={1.5} />}
                                    </button>
                                </div>
                            </div>

                            {/* Confirm password */}
                            <div>
                                <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1.5">
                                    Confirmar senha
                                </label>
                                <div className="relative">
                                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" strokeWidth={1.5} />
                                    <input
                                        type={showPass ? 'text' : 'password'}
                                        required
                                        minLength={8}
                                        placeholder="Repita a nova senha"
                                        value={confPass}
                                        onChange={e => setConfPass(e.target.value)}
                                        className={`w-full pl-10 pr-4 py-3.5 bg-zinc-800 border rounded-xl text-white text-sm placeholder-zinc-600 focus:outline-none transition-all ${
                                            confPass && confPass !== newPass
                                                ? 'border-red-400/50 focus:border-red-400/70'
                                                : confPass && confPass === newPass
                                                ? 'border-emerald-400/50 focus:border-emerald-400/70'
                                                : 'border-white/10 focus:border-brand-400/50'
                                        }`}
                                        autoComplete="new-password"
                                    />
                                </div>
                                {confPass && confPass !== newPass && (
                                    <p className="text-xs text-red-400 mt-1 flex items-center gap-1">
                                        <AlertTriangle className="w-3 h-3" strokeWidth={2} />
                                        As senhas não coincidem
                                    </p>
                                )}
                            </div>

                            {/* Password strength hint */}
                            {newPass.length > 0 && (
                                <div className="flex gap-1.5 items-center">
                                    {[...Array(4)].map((_, i) => {
                                        const score = [
                                            newPass.length >= 8,
                                            /[A-Z]/.test(newPass),
                                            /[0-9]/.test(newPass),
                                            /[^A-Za-z0-9]/.test(newPass),
                                        ].filter(Boolean).length;
                                        const color =
                                            score <= 1 ? 'bg-red-500' :
                                            score === 2 ? 'bg-yellow-500' :
                                            score === 3 ? 'bg-blue-500' : 'bg-emerald-500';
                                        return (
                                            <div key={i}
                                                className={`h-1 flex-1 rounded-full transition-all ${i < score ? color : 'bg-zinc-700'}`}
                                            />
                                        );
                                    })}
                                    <span className="text-[11px] text-zinc-500 ml-1 whitespace-nowrap">
                                        {(() => {
                                            const score = [
                                                newPass.length >= 8,
                                                /[A-Z]/.test(newPass),
                                                /[0-9]/.test(newPass),
                                                /[^A-Za-z0-9]/.test(newPass),
                                            ].filter(Boolean).length;
                                            return ['Muito fraca', 'Fraca', 'Média', 'Forte', 'Muito forte'][score];
                                        })()}
                                    </span>
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={submitting || newPass.length < 8 || newPass !== confPass}
                                className="w-full flex items-center justify-center gap-2.5 py-4 bg-brand-400 hover:bg-brand-300 disabled:opacity-60 disabled:cursor-not-allowed text-zinc-950 font-black rounded-xl transition-all mt-2"
                            >
                                {submitting
                                    ? <Loader2 className="w-5 h-5 animate-spin" strokeWidth={1.5} />
                                    : <><Lock className="w-5 h-5" strokeWidth={1.5} />Redefinir senha</>}
                            </button>
                        </form>
                    </div>
                )}

                {/* ── SUCCESS ── */}
                {stage === 'success' && (
                    <div className="flex flex-col items-center gap-4 text-center py-4">
                        <motion.div
                            initial={{ scale: 0.5, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{ type: 'spring', stiffness: 280, damping: 18 }}
                            className="w-20 h-20 bg-emerald-500/15 border border-emerald-500/30 rounded-3xl flex items-center justify-center"
                        >
                            <CheckCircle2 className="w-10 h-10 text-emerald-400" strokeWidth={1.5} />
                        </motion.div>
                        <h2 className="text-2xl font-black text-white">Tudo certo!</h2>
                        <p className="text-zinc-400 text-sm">Redirecionando…</p>
                    </div>
                )}

                {/* ── ERROR ── */}
                {stage === 'error' && (
                    <div className="flex flex-col items-center gap-4 text-center py-4">
                        <div className="w-20 h-20 bg-red-500/15 border border-red-500/30 rounded-3xl flex items-center justify-center">
                            <XCircle className="w-10 h-10 text-red-400" strokeWidth={1.5} />
                        </div>
                        <h2 className="text-2xl font-black text-white">Link inválido</h2>
                        {errorMsg && (
                            <div className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-400/25 rounded-xl w-full text-left">
                                <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" strokeWidth={1.5} />
                                <p className="text-red-400 text-xs">{errorMsg}</p>
                            </div>
                        )}
                        <p className="text-zinc-500 text-sm">
                            O link pode ter expirado. Solicite um novo link de redefinição de senha.
                        </p>
                        <button
                            onClick={() => navigate('/login', { replace: true })}
                            className="w-full flex items-center justify-center gap-2 py-3.5 bg-brand-400 hover:bg-brand-300 text-zinc-950 font-black rounded-xl transition-all"
                        >
                            Ir para o login
                        </button>
                    </div>
                )}

            </motion.div>
        </div>
    );
}
