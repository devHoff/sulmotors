import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Mail, Lock, Loader2, User, Phone, Car, ArrowRight,
    Eye, EyeOff, Shield, CheckCircle2, AlertTriangle,
    ShieldCheck, X, ChevronRight, KeyRound,
} from 'lucide-react';
import { toast } from '../utils/toast';
import { useAuth } from '../contexts/AuthContext';
import { smToast } from '../utils/toast';
import { useLanguage } from '../contexts/LanguageContext';

// ── Step types for registration flow ─────────────────────────────────────────
type RegStep = 'form' | 'legal' | 'otp' | 'profile';

// Simulated OTP code (in production this comes from Supabase email)
const DEMO_OTP = '483921';

export default function Login() {
    const navigate = useNavigate();
    const { signInWithEmail, signUp } = useAuth();
    const { t } = useLanguage();

    const [isLogin, setIsLogin] = useState(true);
    const [loading, setLoading]   = useState(false);
    const [showPass, setShowPass] = useState(false);

    // Registration multi-step
    const [regStep, setRegStep] = useState<RegStep>('form');
    const [otpValue, setOtpValue] = useState('');
    const [otpError, setOtpError] = useState(false);
    const [legalAccepted, setLegalAccepted] = useState(false);
    const [legalError, setLegalError] = useState(false);

    const [form, setForm] = useState({
        email: '', password: '', nome: '', telefone: '',
    });

    const iClass = "w-full pl-10 pr-4 py-3.5 bg-slate-100 dark:bg-zinc-900 border border-slate-200 dark:border-white/10 focus:border-brand-400/60 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-zinc-600 text-sm outline-none transition-all";
    const lClass = "block text-xs font-bold text-slate-500 dark:text-zinc-500 uppercase tracking-wider mb-2";
    const iconClass = "absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-zinc-600";

    // ── Login submit ─────────────────────────────────────────────────────────
    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            await signInWithEmail(form.email, form.password);
            smToast.loginSuccess();
            navigate('/');
        } catch (error: any) {
            toast.error(error.message || t('common_error'));
        } finally {
            setLoading(false);
        }
    };

    // ── Registration step 1: validate form → go to legal ────────────────────
    const handleSignupFormNext = (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.nome.trim()) { toast.error(t('login_name_error')); return; }
        if (!form.email.trim()) { toast.error(t('login_email_error')); return; }
        if (form.password.length < 6) { toast.error(t('login_pass_error')); return; }
        setRegStep('legal');
    };

    // ── Registration step 2: accept legal → go to OTP ───────────────────────
    const handleLegalNext = () => {
        if (!legalAccepted) { setLegalError(true); return; }
        setLegalError(false);
        setRegStep('otp');
    };

    // ── Registration step 3: verify OTP → create account ────────────────────
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

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 flex transition-colors duration-300">
            {/* Left panel */}
            <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden">
                <img
                    src="https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=1000&q=80"
                    alt="Car"
                    className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-r from-zinc-950/80 via-zinc-950/40 to-zinc-950/10" />
                <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-transparent to-zinc-950/40" />
                <div
                    className="absolute inset-0 opacity-20"
                    style={{
                        backgroundImage: 'linear-gradient(rgba(0,212,255,0.07) 1px, transparent 1px), linear-gradient(90deg, rgba(0,212,255,0.07) 1px, transparent 1px)',
                        backgroundSize: '40px 40px',
                    }}
                />
                <div className="absolute bottom-12 left-12 right-12">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-10 h-10 bg-gradient-to-br from-brand-400 to-brand-600 rounded-xl flex items-center justify-center">
                            <Car className="w-5 h-5 text-zinc-950" strokeWidth={1.5} />
                        </div>
                        <span className="text-2xl font-black tracking-tight">
                            <span className="text-brand-400">Sul</span><span className="text-white">Motor</span>
                        </span>
                    </div>
                    <h2 className="text-3xl font-black text-white leading-tight mb-3">
                        {t('home_cta_title')}{' '}
                        <span className="text-brand-400">{t('home_why_accent')}</span>
                    </h2>
                    <p className="text-zinc-400 text-sm leading-relaxed">
                        {t('home_hero_sub')}
                    </p>
                    {/* Trust indicators */}
                    <div className="mt-6 flex flex-wrap gap-3">
                        {[
                            { icon: ShieldCheck, label: t('home_security_title') },
                            { icon: Shield,      label: t('home_support_title')  },
                            { icon: CheckCircle2, label: t('home_price_title')   },
                        ].map(({ icon: Icon, label }) => (
                            <div key={label} className="flex items-center gap-2 px-3 py-1.5 bg-white/10 rounded-lg backdrop-blur-sm">
                                <Icon className="w-3.5 h-3.5 text-brand-400" strokeWidth={1.5} />
                                <span className="text-xs text-white/80 font-medium">{label}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Right panel */}
            <div className="w-full lg:w-1/2 flex items-center justify-center px-6 py-12">
                <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.4 }}
                    className="w-full max-w-md"
                >
                    {/* Mobile logo */}
                    <Link to="/" className="flex items-center gap-2.5 mb-10 lg:hidden">
                        <div className="w-9 h-9 bg-gradient-to-br from-brand-400 to-brand-600 rounded-xl flex items-center justify-center">
                            <Car className="w-5 h-5 text-zinc-950" strokeWidth={1.5} />
                        </div>
                        <span className="text-xl font-black tracking-tight">
                            <span className="text-brand-400">Sul</span>
                            <span className="text-slate-900 dark:text-white">Motor</span>
                        </span>
                    </Link>

                    {/* Mode toggle (only when not mid-registration) */}
                    {(isLogin || regStep === 'form') && (
                        <div className="flex items-center gap-2 p-1 bg-slate-100 dark:bg-zinc-900 border border-slate-200 dark:border-white/8 rounded-xl mb-8">
                            {[
                                { label: t('login_enter'),    val: true  },
                                { label: t('login_register'), val: false },
                            ].map(({ label, val }) => (
                                <button
                                    key={label}
                                    onClick={() => { setIsLogin(val); resetReg(); }}
                                    className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-all ${isLogin === val ? 'bg-brand-400 text-zinc-950 shadow-lg' : 'text-slate-500 dark:text-zinc-500 hover:text-slate-900 dark:hover:text-white'}`}
                                >
                                    {label}
                                </button>
                            ))}
                        </div>
                    )}

                    {/* ── LOGIN FORM ──────────────────────────────────────── */}
                    <AnimatePresence mode="wait">
                        {isLogin && (
                            <motion.div
                                key="login"
                                initial={{ opacity: 0, y: 12 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -12 }}
                            >
                                <div className="mb-8">
                                    <h1 className="text-3xl font-black text-slate-900 dark:text-white mb-2">{t('login_welcome')}</h1>
                                    <p className="text-slate-500 dark:text-zinc-500 text-sm">{t('login_login_sub')}</p>
                                </div>
                                <form onSubmit={handleLogin} className="space-y-4">
                                    <div>
                                        <label className={lClass}>{t('login_email')} *</label>
                                        <div className="relative">
                                            <Mail className={iconClass} strokeWidth={1.5} />
                                            <input type="email" required value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className={iClass} placeholder="seu@email.com" />
                                        </div>
                                    </div>
                                    <div>
                                        <label className={lClass}>{t('login_password')} *</label>
                                        <div className="relative">
                                            <Lock className={iconClass} strokeWidth={1.5} />
                                            <input
                                                type={showPass ? 'text' : 'password'}
                                                required
                                                autoComplete="current-password"
                                                value={form.password}
                                                onChange={e => setForm({ ...form, password: e.target.value })}
                                                className="w-full pl-10 pr-12 py-3.5 bg-slate-100 dark:bg-zinc-900 border border-slate-200 dark:border-white/10 focus:border-brand-400/60 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-zinc-600 text-sm outline-none transition-all"
                                                placeholder="••••••••"
                                                minLength={6}
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowPass(!showPass)}
                                                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-zinc-600 hover:text-slate-700 dark:hover:text-zinc-400 transition-colors"
                                            >
                                                {showPass ? <EyeOff className="w-4 h-4" strokeWidth={1.5} /> : <Eye className="w-4 h-4" strokeWidth={1.5} />}
                                            </button>
                                        </div>
                                    </div>
                                    <button
                                        type="submit"
                                        disabled={loading}
                                        className="w-full flex items-center justify-center gap-2.5 py-4 bg-brand-400 hover:bg-brand-300 text-zinc-950 font-black rounded-xl transition-all hover:shadow-glow disabled:opacity-60 mt-2"
                                    >
                                        {loading
                                            ? <Loader2 className="w-5 h-5 animate-spin" strokeWidth={1.5} />
                                            : <>{t('login_login_btn')} <ArrowRight className="w-5 h-5" strokeWidth={1.5} /></>}
                                    </button>
                                </form>
                                <p className="mt-6 text-center text-sm text-slate-500 dark:text-zinc-600">
                                    {t('login_no_account')}{' '}
                                    <button onClick={() => { setIsLogin(false); resetReg(); }} className="text-brand-500 dark:text-brand-400 font-bold hover:text-brand-600 dark:hover:text-brand-300 transition-colors">
                                        {t('login_free_signup')}
                                    </button>
                                </p>
                            </motion.div>
                        )}

                        {/* ── REGISTRATION: STEP 1 — Form ───────────────── */}
                        {!isLogin && regStep === 'form' && (
                            <motion.div
                                key="reg-form"
                                initial={{ opacity: 0, y: 12 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -12 }}
                            >
                                <div className="mb-8">
                                    <div className="flex items-center gap-2 mb-3">
                                        {[1, 2, 3].map(s => (
                                            <div key={s} className={`h-1.5 flex-1 rounded-full transition-all ${s === 1 ? 'bg-brand-400' : 'bg-slate-200 dark:bg-zinc-700'}`} />
                                        ))}
                                    </div>
                                    <h1 className="text-3xl font-black text-slate-900 dark:text-white mb-2">{t('login_create')}</h1>
                                    <p className="text-slate-500 dark:text-zinc-500 text-sm">{t('login_signup_sub')}</p>
                                </div>
                                <form onSubmit={handleSignupFormNext} className="space-y-4">
                                    <div>
                                        <label className={lClass}>{t('login_full_name')}</label>
                                        <div className="relative">
                                            <User className={iconClass} strokeWidth={1.5} />
                                            <input type="text" required value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} className={iClass} placeholder="Seu nome completo" />
                                        </div>
                                    </div>
                                    <div>
                                        <label className={lClass}>{t('login_phone')}</label>
                                        <div className="relative">
                                            <Phone className={iconClass} strokeWidth={1.5} />
                                            <input type="tel" value={form.telefone} onChange={e => setForm({ ...form, telefone: e.target.value })} className={iClass} placeholder="(51) 99999-9999" />
                                        </div>
                                    </div>
                                    <div>
                                        <label className={lClass}>{t('login_email')}</label>
                                        <div className="relative">
                                            <Mail className={iconClass} strokeWidth={1.5} />
                                            <input type="email" required value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className={iClass} placeholder="seu@email.com" />
                                        </div>
                                    </div>
                                    <div>
                                        <label className={lClass}>{t('login_password')}</label>
                                        <div className="relative">
                                            <Lock className={iconClass} strokeWidth={1.5} />
                                            <input
                                                type={showPass ? 'text' : 'password'}
                                                required
                                                autoComplete="new-password"
                                                value={form.password}
                                                onChange={e => setForm({ ...form, password: e.target.value })}
                                                className="w-full pl-10 pr-12 py-3.5 bg-slate-100 dark:bg-zinc-900 border border-slate-200 dark:border-white/10 focus:border-brand-400/60 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-zinc-600 text-sm outline-none transition-all"
                                                placeholder="Min. 6 caracteres"
                                                minLength={6}
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowPass(!showPass)}
                                                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-zinc-600"
                                            >
                                                {showPass ? <EyeOff className="w-4 h-4" strokeWidth={1.5} /> : <Eye className="w-4 h-4" strokeWidth={1.5} />}
                                            </button>
                                        </div>
                                    </div>

                                    {/* reCAPTCHA notice */}
                                    <div className="flex items-center gap-2.5 p-3 bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-white/8 rounded-xl">
                                        <Shield className="w-4 h-4 text-brand-400 flex-shrink-0" strokeWidth={1.5} />
                                        <p className="text-xs text-slate-500 dark:text-zinc-500 leading-relaxed">
                                            {t('home_security_desc')}
                                        </p>
                                    </div>

                                    <button
                                        type="submit"
                                        className="w-full flex items-center justify-center gap-2.5 py-4 bg-brand-400 hover:bg-brand-300 text-zinc-950 font-black rounded-xl transition-all hover:shadow-glow mt-2"
                                    >
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

                        {/* ── REGISTRATION: STEP 2 — Legal Consent ──────── */}
                        {!isLogin && regStep === 'legal' && (
                            <motion.div
                                key="reg-legal"
                                initial={{ opacity: 0, y: 12 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -12 }}
                            >
                                <div className="mb-8">
                                    <div className="flex items-center gap-2 mb-3">
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
                                            { to: '/termos',      label: t('footer_terms')   },
                                            { to: '/privacidade', label: t('footer_privacy')  },
                                            { to: '/cookies',     label: t('footer_cookies')  },
                                        ].map(({ to, label }) => (
                                            <Link
                                                key={to}
                                                to={to}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="flex items-center justify-between p-3 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/8 rounded-xl text-xs text-slate-600 dark:text-zinc-400 hover:border-brand-400/30 hover:text-brand-500 transition-colors"
                                            >
                                                <span>{label}</span>
                                                <ChevronRight className="w-3.5 h-3.5 flex-shrink-0" strokeWidth={2} />
                                            </Link>
                                        ))}
                                    </div>

                                    {/* Consent checkbox */}
                                    <label className={`flex items-start gap-3 p-4 border-2 rounded-2xl cursor-pointer transition-all ${legalAccepted ? 'border-brand-400/60 bg-brand-400/5' : legalError ? 'border-red-400/60 bg-red-500/5' : 'border-slate-200 dark:border-white/10'}`}>
                                        <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-all ${legalAccepted ? 'bg-brand-400 border-brand-400' : legalError ? 'border-red-400' : 'border-slate-300 dark:border-zinc-600'}`}>
                                            {legalAccepted && <CheckCircle2 className="w-3 h-3 text-zinc-950" strokeWidth={3} />}
                                        </div>
                                        <input
                                            type="checkbox"
                                            checked={legalAccepted}
                                            onChange={e => { setLegalAccepted(e.target.checked); setLegalError(false); }}
                                            className="sr-only"
                                        />
                                        <span className="text-sm text-slate-700 dark:text-zinc-300 leading-relaxed">
                                            {t('login_legal_accept')}{' '}
                                            <Link to="/termos" target="_blank" className="text-brand-500 font-semibold hover:underline">{t('footer_terms')}</Link>{', '}
                                            <Link to="/privacidade" target="_blank" className="text-brand-500 font-semibold hover:underline">{t('footer_privacy')}</Link>{' '}
                                            {t('login_legal_and')}{' '}
                                            <Link to="/cookies" target="_blank" className="text-brand-500 font-semibold hover:underline">{t('footer_cookies')}</Link>.
                                        </span>
                                    </label>
                                    {legalError && (
                                        <p className="text-xs text-red-500 font-semibold flex items-center gap-1">
                                            <AlertTriangle className="w-3.5 h-3.5" strokeWidth={2} />
                                            {t('login_legal_error')}
                                        </p>
                                    )}
                                </div>

                                <div className="flex gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setRegStep('form')}
                                        className="flex-shrink-0 px-5 py-4 bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-zinc-300 font-bold rounded-xl hover:bg-slate-200 dark:hover:bg-zinc-700 transition-colors"
                                    >
                                        {t('login_back')}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleLegalNext}
                                        className="flex-1 flex items-center justify-center gap-2.5 py-4 bg-brand-400 hover:bg-brand-300 text-zinc-950 font-black rounded-xl transition-all hover:shadow-glow"
                                    >
                                        {t('login_legal_continue')} <ChevronRight className="w-5 h-5" strokeWidth={1.5} />
                                    </button>
                                </div>
                            </motion.div>
                        )}

                        {/* ── REGISTRATION: STEP 3 — OTP Verification ───── */}
                        {!isLogin && regStep === 'otp' && (
                            <motion.div
                                key="reg-otp"
                                initial={{ opacity: 0, y: 12 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -12 }}
                            >
                                <div className="mb-8">
                                    <div className="flex items-center gap-2 mb-3">
                                        {[1, 2, 3].map(s => (
                                            <div key={s} className="h-1.5 flex-1 rounded-full bg-brand-400" />
                                        ))}
                                    </div>
                                    <h1 className="text-3xl font-black text-slate-900 dark:text-white mb-2">{t('login_otp_title')}</h1>
                                    <p className="text-slate-500 dark:text-zinc-500 text-sm">{t('login_otp_sub')} <strong>{form.email}</strong></p>
                                </div>

                                <div className="mb-6 p-5 bg-blue-500/8 border border-blue-500/20 rounded-2xl">
                                    <div className="flex items-center gap-3 mb-2">
                                        <Mail className="w-5 h-5 text-blue-400 flex-shrink-0" strokeWidth={1.5} />
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
                                    <label className={lClass}>{t('login_otp_title')}</label>
                                    <div className="relative">
                                        <KeyRound className={iconClass} strokeWidth={1.5} />
                                        <input
                                            type="text"
                                            value={otpValue}
                                            onChange={e => {
                                                setOtpValue(e.target.value.replace(/\D/g, '').slice(0, 6));
                                                setOtpError(false);
                                            }}
                                            className={`${iClass} text-center text-2xl font-black tracking-[0.5em] ${otpError ? 'border-red-400/60' : ''}`}
                                            placeholder="000000"
                                            maxLength={6}
                                            inputMode="numeric"
                                        />
                                    </div>
                                    {otpError && (
                                        <p className="text-xs text-red-500 font-semibold mt-1.5 flex items-center gap-1">
                                            <X className="w-3.5 h-3.5" strokeWidth={2} />
                                            {t('login_otp_wrong')}
                                        </p>
                                    )}
                                </div>

                                <div className="flex gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setRegStep('legal')}
                                        className="flex-shrink-0 px-5 py-4 bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-zinc-300 font-bold rounded-xl hover:bg-slate-200 dark:hover:bg-zinc-700 transition-colors"
                                    >
                                        {t('login_back')}
                                    </button>
                                    <button
                                        type="button"
                                        disabled={otpValue.length !== 6 || loading}
                                        onClick={handleOtpVerify}
                                        className="flex-1 flex items-center justify-center gap-2.5 py-4 bg-brand-400 hover:bg-brand-300 text-zinc-950 font-black rounded-xl transition-all hover:shadow-glow disabled:opacity-50"
                                    >
                                        {loading
                                            ? <Loader2 className="w-5 h-5 animate-spin" strokeWidth={1.5} />
                                            : <><CheckCircle2 className="w-5 h-5" strokeWidth={1.5} /> {t('login_otp_verify')}</>}
                                    </button>
                                </div>

                                <button
                                    type="button"
                                    className="mt-4 w-full text-xs text-slate-400 dark:text-zinc-600 hover:text-brand-400 transition-colors"
                                    onClick={() => toast.info(t('login_otp_resend'))}
                                >
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
