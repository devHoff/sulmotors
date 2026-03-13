import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Mail, Lock, Loader2, User, Phone, ArrowRight,
    Eye, EyeOff, Shield, CheckCircle2, AlertTriangle,
    ShieldCheck, X, ChevronRight, KeyRound, Car,
} from 'lucide-react';
import { toast } from '../utils/toast';
import { useAuth } from '../contexts/AuthContext';
import { smToast } from '../utils/toast';
import { useLanguage } from '../contexts/LanguageContext';

// Providers enabled in this project's Supabase Dashboard.
// Add 'apple' | 'facebook' here only after configuring them in the Dashboard.
const ENABLED_SOCIAL_PROVIDERS = ['google'] as const;
type EnabledProvider = typeof ENABLED_SOCIAL_PROVIDERS[number];

// ── Step types for registration flow ─────────────────────────────────────────
type RegStep = 'form' | 'legal' | 'otp';

// Simulated OTP code (in production this comes from Supabase email)
const DEMO_OTP = '483921';

// ── Translate Supabase auth errors to user-friendly messages ─────────────────
function mapAuthError(error: any, t: (k: string) => string): string {
    const msg: string = (error?.message || '').toLowerCase();
    if (msg.includes('invalid login') || msg.includes('invalid credentials') || msg.includes('wrong password')) {
        return t('login_error_invalid');
    }
    if (msg.includes('user not found') || msg.includes('no user') || msg.includes('email not confirmed')) {
        return t('login_error_not_found');
    }
    if (msg.includes('too many') || msg.includes('rate limit')) {
        return t('login_error_too_many');
    }
    // Supabase 400 – provider not enabled in the Dashboard
    if (msg.includes('unsupported provider') || msg.includes('provider is not enabled') || msg.includes('validation failed')) {
        return 'Este método de login ainda não está disponível. Use e-mail e senha ou entre com Google.';
    }
    return error?.message || t('common_error');
}

// ── Google SVG icon ───────────────────────────────────────────────────────────
const GoogleIcon = () => (
    <svg viewBox="0 0 24 24" className="w-5 h-5" aria-hidden="true">
        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
);

// ── Apple SVG icon ────────────────────────────────────────────────────────────
const AppleIcon = () => (
    <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current" aria-hidden="true">
        <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
    </svg>
);

// ── Facebook SVG icon ─────────────────────────────────────────────────────────
const FacebookIcon = () => (
    <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current" aria-hidden="true">
        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
    </svg>
);

export default function Login() {
    const navigate = useNavigate();
    const { signInWithEmail, signInWithGoogle, resetPassword, signUp } = useAuth();
    const { t } = useLanguage();

    const [isLogin, setIsLogin] = useState(true);
    const [loading, setLoading] = useState(false);
    const [socialLoading, setSocialLoading] = useState<EnabledProvider | null>(null);
    const [showPass, setShowPass] = useState(false);
    const [loginError, setLoginError] = useState('');
    const [forgotMode, setForgotMode] = useState(false);
    const [forgotEmail, setForgotEmail] = useState('');
    const [forgotLoading, setForgotLoading] = useState(false);

    // Registration multi-step
    const [regStep, setRegStep] = useState<RegStep>('form');
    const [otpValue, setOtpValue] = useState('');
    const [otpError, setOtpError] = useState(false);
    const [legalAccepted, setLegalAccepted] = useState(false);
    const [legalError, setLegalError] = useState(false);

    const [form, setForm] = useState({ email: '', password: '', nome: '', telefone: '' });

    const iClass = "w-full pl-10 pr-4 py-3.5 bg-slate-100 dark:bg-zinc-900 border border-slate-200 dark:border-white/10 focus:border-brand-400/60 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-zinc-600 text-sm outline-none transition-all";
    const lClass = "block text-xs font-bold text-slate-500 dark:text-zinc-500 uppercase tracking-wider mb-2";
    const iconClass = "absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-zinc-600";

    // Button hover helpers
    const btnEnter = (e: React.MouseEvent<HTMLButtonElement>) => { (e.currentTarget).style.transform = 'scale(1.02)'; };
    const btnLeave = (e: React.MouseEvent<HTMLButtonElement>) => { (e.currentTarget).style.transform = 'scale(1)'; };

    // ── Login submit ─────────────────────────────────────────────────────────
    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        if (loading) return;
        setLoginError('');
        setLoading(true);
        try {
            await signInWithEmail(form.email, form.password);
            smToast.loginSuccess();
            navigate('/');
        } catch (error: any) {
            setLoginError(mapAuthError(error, t));
        } finally {
            setLoading(false);
        }
    };

    // ── Social login (only Google is enabled) ───────────────────────────────
    const handleSocialLogin = async (provider: EnabledProvider) => {
        setSocialLoading(provider);
        try {
            if (provider === 'google') await signInWithGoogle();
        } catch (error: any) {
            toast.error(mapAuthError(error, t));
        } finally {
            setSocialLoading(null);
        }
    };

    // ── Forgot password ──────────────────────────────────────────────────────
    const handleForgotPassword = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!forgotEmail.trim()) return;
        setForgotLoading(true);
        try {
            await resetPassword(forgotEmail);
            toast.success(t('login_forgot_sent'));
            setForgotMode(false);
        } catch {
            toast.error(t('login_forgot_error'));
        } finally {
            setForgotLoading(false);
        }
    };

    // ── Registration step 1 ──────────────────────────────────────────────────
    const handleSignupFormNext = (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.nome.trim()) { toast.error(t('login_name_error')); return; }
        if (!form.email.trim()) { toast.error(t('login_email_error')); return; }
        if (form.password.length < 6) { toast.error(t('login_pass_error')); return; }
        setRegStep('legal');
    };

    // ── Registration step 2 ──────────────────────────────────────────────────
    const handleLegalNext = () => {
        if (!legalAccepted) { setLegalError(true); return; }
        setLegalError(false);
        setRegStep('otp');
    };

    // ── Registration step 3 ──────────────────────────────────────────────────
    const handleOtpVerify = async () => {
        if (otpValue !== DEMO_OTP) {
            setOtpError(true);
            toast.error(t('login_otp_error'));
            return;
        }
        setOtpError(false);
        setLoading(true);
        try {
            await signUp(form.email, form.password, {
                full_name: form.nome,
                phone: form.telefone,
            });
            smToast.signupSuccess();
            navigate('/meu-perfil');
        } catch (error: any) {
            toast.error(error.message || t('common_error'));
        } finally {
            setLoading(false);
        }
    };

    const resetReg = () => {
        setRegStep('form');
        setOtpValue('');
        setOtpError(false);
        setLegalAccepted(false);
        setLegalError(false);
    };

    const stats = [t('login_stat_vehicles'), t('login_stat_users'), t('login_stat_sales')];

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 flex transition-colors duration-300">

            {/* ── Left panel ──────────────────────────────────────────────── */}
            <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden">
                <img
                    src="https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=1000&q=80"
                    alt="Carro moderno"
                    className="w-full h-full object-cover"
                />
                {/* Dark overlay rgba(0,0,0,0.45) as requested */}
                <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.45)' }} />
                <div className="absolute inset-0 bg-gradient-to-t from-zinc-950/80 via-transparent to-zinc-950/30" />
                <div
                    className="absolute inset-0 opacity-10"
                    style={{
                        backgroundImage: 'linear-gradient(rgba(0,212,255,0.07) 1px, transparent 1px), linear-gradient(90deg, rgba(0,212,255,0.07) 1px, transparent 1px)',
                        backgroundSize: '40px 40px',
                    }}
                />
                <div className="absolute bottom-12 left-12 right-12">
                    {/* Logo */}
                    <div className="flex items-center gap-3 mb-8">
                        <div className="w-10 h-10 bg-gradient-to-br from-brand-400 to-brand-600 rounded-xl flex items-center justify-center">
                            <Car className="w-5 h-5 text-zinc-950" strokeWidth={1.5} />
                        </div>
                        <span className="text-2xl font-black tracking-tight">
                            <span className="text-brand-400">Sul</span>
                            <span className="text-white">Motor</span>
                        </span>
                    </div>
                    {/* Hero headline */}
                    <h2 className="text-4xl font-black text-white leading-tight mb-3">
                        {t('login_hero_headline')}
                    </h2>
                    <p className="text-zinc-300 text-base leading-relaxed mb-8">
                        {t('login_hero_sub')}
                    </p>
                    {/* Trust stats */}
                    <div className="flex flex-col gap-3 mb-8">
                        {stats.map((stat) => (
                            <div key={stat} className="flex items-center gap-3">
                                <CheckCircle2 className="w-4 h-4 text-brand-400 flex-shrink-0" strokeWidth={2} />
                                <span className="text-sm text-white/90 font-semibold">{stat}</span>
                            </div>
                        ))}
                    </div>
                    {/* Trust badges */}
                    <div className="flex flex-wrap gap-3">
                        {[
                            { icon: ShieldCheck, label: t('home_security_title') },
                            { icon: Shield,      label: t('home_support_title')  },
                        ].map(({ icon: Icon, label }) => (
                            <div key={label} className="flex items-center gap-2 px-3 py-1.5 bg-white/10 rounded-lg backdrop-blur-sm">
                                <Icon className="w-3.5 h-3.5 text-brand-400" strokeWidth={1.5} />
                                <span className="text-xs text-white/80 font-medium">{label}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* ── Right panel ─────────────────────────────────────────────── */}
            <div className="w-full lg:w-1/2 flex items-center justify-center px-6 py-12 overflow-y-auto">
                <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.4 }}
                    className="w-full max-w-md"
                >
                    {/* Mobile logo */}
                    <Link to="/" className="flex items-center gap-2.5 mb-10 lg:hidden" aria-label="SulMotor – Página inicial">
                        <div className="w-9 h-9 bg-gradient-to-br from-brand-400 to-brand-600 rounded-xl flex items-center justify-center">
                            <Car className="w-5 h-5 text-zinc-950" strokeWidth={1.5} />
                        </div>
                        <span className="text-xl font-black tracking-tight">
                            <span className="text-brand-400">Sul</span>
                            <span className="text-slate-900 dark:text-white">Motor</span>
                        </span>
                    </Link>

                    {/* Mode toggle */}
                    {(isLogin || regStep === 'form') && !forgotMode && (
                        <div className="flex items-center gap-2 p-1 bg-slate-100 dark:bg-zinc-900 border border-slate-200 dark:border-white/8 rounded-xl mb-8" role="tablist" aria-label="Modo de acesso">
                            {[
                                { label: t('login_enter'),    val: true  },
                                { label: t('login_register'), val: false },
                            ].map(({ label, val }) => (
                                <button
                                    key={label}
                                    role="tab"
                                    aria-selected={isLogin === val}
                                    onClick={() => { setIsLogin(val); resetReg(); setLoginError(''); }}
                                    className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-all ${isLogin === val ? 'bg-brand-400 text-zinc-950 shadow-lg' : 'text-slate-500 dark:text-zinc-500 hover:text-slate-900 dark:hover:text-white'}`}
                                >
                                    {label}
                                </button>
                            ))}
                        </div>
                    )}

                    <AnimatePresence mode="wait">

                        {/* ── FORGOT PASSWORD ──────────────────────────────── */}
                        {isLogin && forgotMode && (
                            <motion.div key="forgot" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}>
                                <div className="mb-8">
                                    <h1 className="text-3xl font-black text-slate-900 dark:text-white mb-2">{t('login_forgot_password')}</h1>
                                    <p className="text-slate-500 dark:text-zinc-500 text-sm">Digite seu email para receber o link de recuperação.</p>
                                </div>
                                <form onSubmit={handleForgotPassword} className="space-y-4">
                                    <div>
                                        <label htmlFor="forgot-email" className={lClass}>{t('login_email')} *</label>
                                        <div className="relative">
                                            <Mail className={iconClass} strokeWidth={1.5} aria-hidden="true" />
                                            <input id="forgot-email" type="email" required autoComplete="email" value={forgotEmail} onChange={e => setForgotEmail(e.target.value)} className={iClass} placeholder="seu@email.com" />
                                        </div>
                                    </div>
                                    <button type="submit" disabled={forgotLoading}
                                        className="w-full flex items-center justify-center gap-2.5 py-4 bg-brand-400 hover:bg-brand-300 text-zinc-950 font-black rounded-xl transition-colors disabled:opacity-60 mt-2"
                                        style={{ transition: 'transform 0.15s ease, background-color 0.2s' }}
                                        onMouseEnter={btnEnter} onMouseLeave={btnLeave}>
                                        {forgotLoading ? <Loader2 className="w-5 h-5 animate-spin" strokeWidth={1.5} /> : <><Mail className="w-5 h-5" strokeWidth={1.5} /> Enviar link</>}
                                    </button>
                                </form>
                                <button type="button" onClick={() => setForgotMode(false)}
                                    className="mt-4 w-full text-sm text-slate-500 dark:text-zinc-500 hover:text-brand-400 transition-colors font-medium">
                                    ← Voltar ao login
                                </button>
                            </motion.div>
                        )}

                        {/* ── LOGIN FORM ───────────────────────────────────── */}
                        {isLogin && !forgotMode && (
                            <motion.div key="login" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}>
                                <div className="mb-8">
                                    <h1 className="text-3xl font-black text-slate-900 dark:text-white mb-2">{t('login_welcome')}</h1>
                                    <p className="text-slate-500 dark:text-zinc-500 text-sm">{t('login_login_sub')}</p>
                                </div>

                                {/* Social login — only Google is enabled */}
                                <div className="mb-6">
                                    <button
                                        type="button"
                                        onClick={() => handleSocialLogin('google')}
                                        disabled={!!socialLoading}
                                        aria-label="Continuar com Google"
                                        className="w-full flex items-center justify-center gap-3 py-3 px-4 bg-white dark:bg-zinc-800 border border-slate-200 dark:border-white/10 rounded-xl text-slate-700 dark:text-zinc-200 text-sm font-semibold hover:bg-slate-50 dark:hover:bg-zinc-700 transition-all disabled:opacity-60"
                                        style={{ transition: 'transform 0.15s ease, background-color 0.2s' }}
                                        onMouseEnter={btnEnter} onMouseLeave={btnLeave}
                                    >
                                        {socialLoading === 'google'
                                            ? <Loader2 className="w-5 h-5 animate-spin" />
                                            : <GoogleIcon />}
                                        Continuar com Google
                                    </button>
                                </div>

                                {/* Divider */}
                                <div className="relative flex items-center gap-3 mb-6" role="separator" aria-hidden="true">
                                    <div className="flex-1 h-px bg-slate-200 dark:bg-white/10" />
                                    <span className="text-xs text-slate-400 dark:text-zinc-600 font-medium whitespace-nowrap">{t('login_social_or')}</span>
                                    <div className="flex-1 h-px bg-slate-200 dark:bg-white/10" />
                                </div>

                                <form onSubmit={handleLogin} className="space-y-4" noValidate>
                                    {/* Email */}
                                    <div>
                                        <label htmlFor="login-email" className={lClass}>{t('login_email')} *</label>
                                        <div className="relative">
                                            <Mail className={iconClass} strokeWidth={1.5} aria-hidden="true" />
                                            <input id="login-email" type="email" required autoComplete="email"
                                                value={form.email}
                                                onChange={e => { setForm({ ...form, email: e.target.value }); setLoginError(''); }}
                                                className={iClass}
                                                placeholder="seu@email.com"
                                                aria-describedby={loginError ? 'login-error' : undefined}
                                            />
                                        </div>
                                    </div>

                                    {/* Password */}
                                    <div>
                                        <div className="flex items-center justify-between mb-2">
                                            <label htmlFor="login-password" className="block text-xs font-bold text-slate-500 dark:text-zinc-500 uppercase tracking-wider">{t('login_password')} *</label>
                                            <button type="button" onClick={() => setForgotMode(true)}
                                                className="text-xs text-brand-500 dark:text-brand-400 font-semibold hover:text-brand-600 dark:hover:text-brand-300 transition-colors">
                                                {t('login_forgot_password')}
                                            </button>
                                        </div>
                                        <div className="relative">
                                            <Lock className={iconClass} strokeWidth={1.5} aria-hidden="true" />
                                            <input
                                                id="login-password"
                                                type={showPass ? 'text' : 'password'}
                                                required
                                                autoComplete="current-password"
                                                value={form.password}
                                                onChange={e => { setForm({ ...form, password: e.target.value }); setLoginError(''); }}
                                                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleLogin(e as any); } }}
                                                className="w-full pl-10 pr-12 py-3.5 bg-slate-100 dark:bg-zinc-900 border border-slate-200 dark:border-white/10 focus:border-brand-400/60 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-zinc-600 text-sm outline-none transition-all"
                                                placeholder="••••••••"
                                                minLength={6}
                                                aria-describedby={loginError ? 'login-error' : undefined}
                                            />
                                            <button type="button" onClick={() => setShowPass(v => !v)}
                                                aria-label={showPass ? 'Ocultar senha' : 'Mostrar senha'}
                                                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-zinc-600 hover:text-slate-700 dark:hover:text-zinc-400 transition-colors">
                                                {showPass ? <EyeOff className="w-4 h-4" strokeWidth={1.5} /> : <Eye className="w-4 h-4" strokeWidth={1.5} />}
                                            </button>
                                        </div>
                                    </div>

                                    {/* Inline error */}
                                    {loginError && (
                                        <motion.div id="login-error" role="alert" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
                                            className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-400/30 rounded-xl">
                                            <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0" strokeWidth={2} aria-hidden="true" />
                                            <p className="text-sm text-red-600 dark:text-red-400 font-medium">{loginError}</p>
                                        </motion.div>
                                    )}

                                    {/* Submit with loading state + hover scale */}
                                    <button type="submit" disabled={loading} aria-busy={loading}
                                        className="w-full flex items-center justify-center gap-2.5 py-4 bg-brand-400 hover:bg-brand-300 text-zinc-950 font-black rounded-xl transition-colors hover:shadow-glow disabled:opacity-60 mt-2"
                                        style={{ transition: 'transform 0.15s ease, background-color 0.2s, box-shadow 0.2s' }}
                                        onMouseEnter={e => { if (!loading) btnEnter(e); }}
                                        onMouseLeave={btnLeave}>
                                        {loading
                                            ? <><Loader2 className="w-5 h-5 animate-spin" strokeWidth={1.5} /> {t('login_entering')}</>
                                            : <>{t('login_login_btn')} <ArrowRight className="w-5 h-5" strokeWidth={1.5} /></>}
                                    </button>
                                </form>

                                {/* Trust message */}
                                <div className="mt-4 flex items-center justify-center gap-1.5 text-xs text-slate-400 dark:text-zinc-600">
                                    <Shield className="w-3.5 h-3.5 text-brand-400" strokeWidth={1.5} aria-hidden="true" />
                                    <span>🔒 {t('login_ssl_trust')}</span>
                                </div>

                                <p className="mt-5 text-center text-sm text-slate-500 dark:text-zinc-600">
                                    {t('login_no_account')}{' '}
                                    <button onClick={() => { setIsLogin(false); resetReg(); setLoginError(''); }}
                                        className="text-brand-500 dark:text-brand-400 font-bold hover:text-brand-600 dark:hover:text-brand-300 transition-colors">
                                        {t('login_free_signup')}
                                    </button>
                                </p>
                            </motion.div>
                        )}

                        {/* ── REGISTRATION: STEP 1 — Form ───────────────────── */}
                        {!isLogin && regStep === 'form' && (
                            <motion.div key="reg-form" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}>
                                <div className="mb-8">
                                    <div className="flex items-center gap-2 mb-3" role="progressbar" aria-valuenow={1} aria-valuemin={1} aria-valuemax={3} aria-label="Passo 1 de 3">
                                        {[1, 2, 3].map(s => (
                                            <div key={s} className={`h-1.5 flex-1 rounded-full transition-all ${s === 1 ? 'bg-brand-400' : 'bg-slate-200 dark:bg-zinc-700'}`} />
                                        ))}
                                    </div>
                                    <h1 className="text-3xl font-black text-slate-900 dark:text-white mb-2">{t('login_create')}</h1>
                                    <p className="text-slate-500 dark:text-zinc-500 text-sm">{t('login_signup_sub')}</p>
                                </div>
                                <form onSubmit={handleSignupFormNext} className="space-y-4">
                                    <div>
                                        <label htmlFor="reg-name" className={lClass}>{t('login_full_name')}</label>
                                        <div className="relative">
                                            <User className={iconClass} strokeWidth={1.5} aria-hidden="true" />
                                            <input id="reg-name" type="text" required autoComplete="name" value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} className={iClass} placeholder="Seu nome completo" />
                                        </div>
                                    </div>
                                    <div>
                                        <label htmlFor="reg-phone" className={lClass}>{t('login_phone')}</label>
                                        <div className="relative">
                                            <Phone className={iconClass} strokeWidth={1.5} aria-hidden="true" />
                                            <input id="reg-phone" type="tel" autoComplete="tel" value={form.telefone} onChange={e => setForm({ ...form, telefone: e.target.value })} className={iClass} placeholder="(51) 99999-9999" />
                                        </div>
                                    </div>
                                    <div>
                                        <label htmlFor="reg-email" className={lClass}>{t('login_email')}</label>
                                        <div className="relative">
                                            <Mail className={iconClass} strokeWidth={1.5} aria-hidden="true" />
                                            <input id="reg-email" type="email" required autoComplete="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className={iClass} placeholder="seu@email.com" />
                                        </div>
                                    </div>
                                    <div>
                                        <label htmlFor="reg-password" className={lClass}>{t('login_password')}</label>
                                        <div className="relative">
                                            <Lock className={iconClass} strokeWidth={1.5} aria-hidden="true" />
                                            <input id="reg-password" type={showPass ? 'text' : 'password'} required autoComplete="new-password"
                                                value={form.password} onChange={e => setForm({ ...form, password: e.target.value })}
                                                className="w-full pl-10 pr-12 py-3.5 bg-slate-100 dark:bg-zinc-900 border border-slate-200 dark:border-white/10 focus:border-brand-400/60 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-zinc-600 text-sm outline-none transition-all"
                                                placeholder="Min. 6 caracteres" minLength={6} />
                                            <button type="button" onClick={() => setShowPass(v => !v)}
                                                aria-label={showPass ? 'Ocultar senha' : 'Mostrar senha'}
                                                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-zinc-600 hover:text-slate-700 dark:hover:text-zinc-400 transition-colors">
                                                {showPass ? <EyeOff className="w-4 h-4" strokeWidth={1.5} /> : <Eye className="w-4 h-4" strokeWidth={1.5} />}
                                            </button>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2.5 p-3 bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-white/8 rounded-xl">
                                        <Shield className="w-4 h-4 text-brand-400 flex-shrink-0" strokeWidth={1.5} aria-hidden="true" />
                                        <p className="text-xs text-slate-500 dark:text-zinc-500 leading-relaxed">{t('home_security_desc')}</p>
                                    </div>
                                    <button type="submit"
                                        className="w-full flex items-center justify-center gap-2.5 py-4 bg-brand-400 hover:bg-brand-300 text-zinc-950 font-black rounded-xl transition-all hover:shadow-glow mt-2"
                                        style={{ transition: 'transform 0.15s ease, background-color 0.2s' }}
                                        onMouseEnter={btnEnter} onMouseLeave={btnLeave}>
                                        {t('login_legal_continue')} <ChevronRight className="w-5 h-5" strokeWidth={1.5} />
                                    </button>
                                </form>
                                <p className="mt-6 text-center text-sm text-slate-500 dark:text-zinc-600">
                                    {t('login_has_account')}{' '}
                                    <button onClick={() => setIsLogin(true)} className="text-brand-500 dark:text-brand-400 font-bold hover:text-brand-600 dark:hover:text-brand-300 transition-colors">
                                        {t('login_do_login')}
                                    </button>
                                </p>
                            </motion.div>
                        )}

                        {/* ── REGISTRATION: STEP 2 — Legal Consent ─────────── */}
                        {!isLogin && regStep === 'legal' && (
                            <motion.div key="reg-legal" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}>
                                <div className="mb-8">
                                    <div className="flex items-center gap-2 mb-3" role="progressbar" aria-valuenow={2} aria-valuemin={1} aria-valuemax={3} aria-label="Passo 2 de 3">
                                        {[1, 2, 3].map(s => (
                                            <div key={s} className={`h-1.5 flex-1 rounded-full transition-all ${s <= 2 ? 'bg-brand-400' : 'bg-slate-200 dark:bg-zinc-700'}`} />
                                        ))}
                                    </div>
                                    <h1 className="text-3xl font-black text-slate-900 dark:text-white mb-2">{t('login_legal_title')}</h1>
                                    <p className="text-slate-500 dark:text-zinc-500 text-sm">{t('login_signup_sub')}</p>
                                </div>
                                <div className="space-y-3 mb-6">
                                    <div className="p-4 bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-white/8 rounded-2xl max-h-48 overflow-y-auto text-xs text-slate-600 dark:text-zinc-400 leading-relaxed space-y-2">
                                        <p className="font-black text-slate-900 dark:text-white text-sm mb-2">{t('footer_terms')}</p>
                                        <p>{t('footer_legal')}</p>
                                    </div>
                                    <div className="space-y-2">
                                        {[
                                            { to: '/termos',      label: t('footer_terms')  },
                                            { to: '/privacidade', label: t('footer_privacy') },
                                            { to: '/cookies',     label: t('footer_cookies') },
                                        ].map(({ to, label }) => (
                                            <Link key={to} to={to} target="_blank" rel="noopener noreferrer"
                                                className="flex items-center justify-between p-3 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/8 rounded-xl text-xs text-slate-600 dark:text-zinc-400 hover:border-brand-400/30 hover:text-brand-500 transition-colors">
                                                <span>{label}</span>
                                                <ChevronRight className="w-3.5 h-3.5 flex-shrink-0" strokeWidth={2} />
                                            </Link>
                                        ))}
                                    </div>
                                    <label className={`flex items-start gap-3 p-4 border-2 rounded-2xl cursor-pointer transition-all ${legalAccepted ? 'border-brand-400/60 bg-brand-400/5' : legalError ? 'border-red-400/60 bg-red-500/5' : 'border-slate-200 dark:border-white/10'}`}>
                                        <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-all ${legalAccepted ? 'bg-brand-400 border-brand-400' : legalError ? 'border-red-400' : 'border-slate-300 dark:border-zinc-600'}`}>
                                            {legalAccepted && <CheckCircle2 className="w-3 h-3 text-zinc-950" strokeWidth={3} />}
                                        </div>
                                        <input type="checkbox" checked={legalAccepted} onChange={e => { setLegalAccepted(e.target.checked); setLegalError(false); }} className="sr-only" aria-label={t('login_legal_accept')} />
                                        <span className="text-sm text-slate-700 dark:text-zinc-300 leading-relaxed">
                                            {t('login_legal_accept')}{' '}
                                            <Link to="/termos" target="_blank" className="text-brand-500 font-semibold hover:underline">{t('footer_terms')}</Link>{', '}
                                            <Link to="/privacidade" target="_blank" className="text-brand-500 font-semibold hover:underline">{t('footer_privacy')}</Link>{' '}
                                            {t('login_legal_and')}{' '}
                                            <Link to="/cookies" target="_blank" className="text-brand-500 font-semibold hover:underline">{t('footer_cookies')}</Link>.
                                        </span>
                                    </label>
                                    {legalError && (
                                        <p role="alert" className="text-xs text-red-500 font-semibold flex items-center gap-1">
                                            <AlertTriangle className="w-3.5 h-3.5" strokeWidth={2} aria-hidden="true" />
                                            {t('login_legal_error')}
                                        </p>
                                    )}
                                </div>
                                <div className="flex gap-3">
                                    <button type="button" onClick={() => setRegStep('form')}
                                        className="flex-shrink-0 px-5 py-4 bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-zinc-300 font-bold rounded-xl hover:bg-slate-200 dark:hover:bg-zinc-700 transition-colors">
                                        {t('login_back')}
                                    </button>
                                    <button type="button" onClick={handleLegalNext}
                                        className="flex-1 flex items-center justify-center gap-2.5 py-4 bg-brand-400 hover:bg-brand-300 text-zinc-950 font-black rounded-xl transition-all hover:shadow-glow"
                                        style={{ transition: 'transform 0.15s ease, background-color 0.2s' }}
                                        onMouseEnter={btnEnter} onMouseLeave={btnLeave}>
                                        {t('login_legal_continue')} <ChevronRight className="w-5 h-5" strokeWidth={1.5} />
                                    </button>
                                </div>
                            </motion.div>
                        )}

                        {/* ── REGISTRATION: STEP 3 — OTP Verification ─────── */}
                        {!isLogin && regStep === 'otp' && (
                            <motion.div key="reg-otp" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}>
                                <div className="mb-8">
                                    <div className="flex items-center gap-2 mb-3" role="progressbar" aria-valuenow={3} aria-valuemin={1} aria-valuemax={3} aria-label="Passo 3 de 3">
                                        {[1, 2, 3].map(s => (
                                            <div key={s} className="h-1.5 flex-1 rounded-full bg-brand-400" />
                                        ))}
                                    </div>
                                    <h1 className="text-3xl font-black text-slate-900 dark:text-white mb-2">{t('login_otp_title')}</h1>
                                    <p className="text-slate-500 dark:text-zinc-500 text-sm">{t('login_otp_sub')} <strong>{form.email}</strong></p>
                                </div>
                                <div className="mb-6 p-5 bg-blue-500/8 border border-blue-500/20 rounded-2xl">
                                    <div className="flex items-center gap-3 mb-2">
                                        <Mail className="w-5 h-5 text-blue-400 flex-shrink-0" strokeWidth={1.5} aria-hidden="true" />
                                        <p className="text-sm font-black text-blue-600 dark:text-blue-400">{t('notif_email_verified')}</p>
                                    </div>
                                    <p className="text-xs text-blue-600/80 dark:text-blue-400/70 leading-relaxed">
                                        {t('login_otp_sub')} <strong>{form.email}</strong>.
                                    </p>
                                    <p className="text-xs text-blue-400/60 dark:text-blue-500/50 mt-2 font-mono">
                                        Demo: <strong className="text-brand-400">483921</strong>
                                    </p>
                                </div>
                                <div className="mb-6">
                                    <label htmlFor="otp-input" className={lClass}>{t('login_otp_title')}</label>
                                    <div className="relative">
                                        <KeyRound className={iconClass} strokeWidth={1.5} aria-hidden="true" />
                                        <input id="otp-input" type="text"
                                            value={otpValue}
                                            onChange={e => { setOtpValue(e.target.value.replace(/\D/g, '').slice(0, 6)); setOtpError(false); }}
                                            className={`${iClass} text-center text-2xl font-black tracking-[0.5em] ${otpError ? 'border-red-400/60' : ''}`}
                                            placeholder="000000" maxLength={6} inputMode="numeric" autoComplete="one-time-code"
                                            aria-describedby={otpError ? 'otp-error' : undefined}
                                        />
                                    </div>
                                    {otpError && (
                                        <p id="otp-error" role="alert" className="text-xs text-red-500 font-semibold mt-1.5 flex items-center gap-1">
                                            <X className="w-3.5 h-3.5" strokeWidth={2} aria-hidden="true" />
                                            {t('login_otp_wrong')}
                                        </p>
                                    )}
                                </div>
                                <div className="flex gap-3">
                                    <button type="button" onClick={() => setRegStep('legal')}
                                        className="flex-shrink-0 px-5 py-4 bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-zinc-300 font-bold rounded-xl hover:bg-slate-200 dark:hover:bg-zinc-700 transition-colors">
                                        {t('login_back')}
                                    </button>
                                    <button type="button" disabled={otpValue.length !== 6 || loading} onClick={handleOtpVerify} aria-busy={loading}
                                        className="flex-1 flex items-center justify-center gap-2.5 py-4 bg-brand-400 hover:bg-brand-300 text-zinc-950 font-black rounded-xl transition-all hover:shadow-glow disabled:opacity-50"
                                        style={{ transition: 'transform 0.15s ease, background-color 0.2s' }}
                                        onMouseEnter={e => { if (!loading && otpValue.length === 6) btnEnter(e); }}
                                        onMouseLeave={btnLeave}>
                                        {loading
                                            ? <Loader2 className="w-5 h-5 animate-spin" strokeWidth={1.5} />
                                            : <><CheckCircle2 className="w-5 h-5" strokeWidth={1.5} /> {t('login_otp_verify')}</>}
                                    </button>
                                </div>
                                <button type="button"
                                    className="mt-4 w-full text-xs text-slate-400 dark:text-zinc-600 hover:text-brand-400 transition-colors"
                                    onClick={() => toast.info(t('login_otp_resend'))}>
                                    {t('login_otp_resend')}
                                </button>
                            </motion.div>
                        )}

                    </AnimatePresence>
                </motion.div>
            </div>
        </div>
    );
}
