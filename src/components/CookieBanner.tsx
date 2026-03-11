import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Cookie, X, ChevronDown, ChevronUp, Shield, BarChart2, Settings, Megaphone, Check } from 'lucide-react';
import { Link } from 'react-router-dom';

const CONSENT_KEY = 'sm_cookie_consent';
const CONSENT_VERSION = '1.0';

interface CookiePrefs {
    essential: boolean;   // always true
    performance: boolean;
    functional: boolean;
    marketing: boolean;
    version: string;
    timestamp: number;
}

function loadConsent(): CookiePrefs | null {
    try {
        const raw = localStorage.getItem(CONSENT_KEY);
        if (!raw) return null;
        const parsed: CookiePrefs = JSON.parse(raw);
        if (parsed.version !== CONSENT_VERSION) return null;
        return parsed;
    } catch {
        return null;
    }
}

function saveConsent(prefs: Omit<CookiePrefs, 'version' | 'timestamp' | 'essential'>) {
    const full: CookiePrefs = {
        ...prefs,
        essential: true,
        version: CONSENT_VERSION,
        timestamp: Date.now(),
    };
    localStorage.setItem(CONSENT_KEY, JSON.stringify(full));
    // Fire a custom event so other parts of the app can react
    window.dispatchEvent(new CustomEvent('cookieConsentChanged', { detail: full }));
}

export default function CookieBanner() {
    const [visible, setVisible]       = useState(false);
    const [expanded, setExpanded]     = useState(false);
    const [closing, setClosing]       = useState(false);
    const [prefs, setPrefs] = useState({
        performance: true,
        functional:  true,
        marketing:   false,
    });

    useEffect(() => {
        // Show banner if no consent stored
        const consent = loadConsent();
        if (!consent) {
            // Small delay so it doesn't flash on first render
            const t = setTimeout(() => setVisible(true), 800);
            return () => clearTimeout(t);
        }
    }, []);

    const dismiss = () => {
        setClosing(true);
        setTimeout(() => setVisible(false), 350);
    };

    const acceptAll = () => {
        saveConsent({ performance: true, functional: true, marketing: true });
        dismiss();
    };

    const acceptSelected = () => {
        saveConsent(prefs);
        dismiss();
    };

    const rejectAll = () => {
        saveConsent({ performance: false, functional: false, marketing: false });
        dismiss();
    };

    const cookieTypes = [
        {
            key: 'performance' as const,
            label: 'Desempenho',
            icon: BarChart2,
            desc: 'Análise de uso e métricas de tráfego para melhorar a plataforma.',
            required: false,
        },
        {
            key: 'functional' as const,
            label: 'Funcional',
            icon: Settings,
            desc: 'Filtros salvos, preferências de idioma e tema.',
            required: false,
        },
        {
            key: 'marketing' as const,
            label: 'Marketing',
            icon: Megaphone,
            desc: 'Anúncios personalizados com base nos seus interesses.',
            required: false,
        },
    ];

    if (!visible) return null;

    return (
        <AnimatePresence>
            {!closing && (
                <motion.div
                    initial={{ y: 120, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: 120, opacity: 0 }}
                    transition={{ type: 'spring', stiffness: 280, damping: 30 }}
                    className="fixed bottom-4 left-4 right-4 md:left-auto md:right-6 md:bottom-6 md:max-w-md z-[9999]"
                    role="dialog"
                    aria-label="Aviso de cookies"
                    aria-live="polite"
                >
                    <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/12 rounded-2xl shadow-2xl overflow-hidden">

                        {/* Header */}
                        <div className="flex items-start justify-between p-5 pb-4 border-b border-slate-100 dark:border-white/5">
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 bg-brand-400/15 border border-brand-400/25 rounded-xl flex items-center justify-center flex-shrink-0">
                                    <Cookie className="w-4 h-4 text-brand-400" strokeWidth={1.5} />
                                </div>
                                <div>
                                    <p className="text-sm font-black text-slate-900 dark:text-white">Cookies & Privacidade</p>
                                    <p className="text-xs text-slate-400 dark:text-zinc-500">Conforme a LGPD</p>
                                </div>
                            </div>
                            <button
                                onClick={rejectAll}
                                aria-label="Recusar todos e fechar"
                                className="p-1.5 text-slate-400 dark:text-zinc-500 hover:text-slate-700 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-white/8 rounded-lg transition-colors"
                            >
                                <X className="w-4 h-4" strokeWidth={1.5} />
                            </button>
                        </div>

                        {/* Body */}
                        <div className="p-5 pt-4">
                            <p className="text-sm text-slate-600 dark:text-zinc-400 leading-relaxed mb-4">
                                Este site utiliza cookies para melhorar sua experiência no SulMotors, personalizar conteúdo
                                e analisar o tráfego.{' '}
                                <Link to="/cookies" className="text-brand-500 dark:text-brand-400 font-semibold hover:underline" onClick={() => dismiss()}>
                                    Saiba mais
                                </Link>
                            </p>

                            {/* Expandable preferences */}
                            <AnimatePresence>
                                {expanded && (
                                    <motion.div
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: 'auto', opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        transition={{ duration: 0.22 }}
                                        className="overflow-hidden"
                                    >
                                        <div className="space-y-2 mb-4">
                                            {/* Essential — always on */}
                                            <div className="flex items-start justify-between p-3 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-white/8 rounded-xl">
                                                <div className="flex items-center gap-2.5">
                                                    <Shield className="w-4 h-4 text-emerald-500 flex-shrink-0" strokeWidth={1.5} />
                                                    <div>
                                                        <p className="text-xs font-bold text-slate-900 dark:text-white">Essencial</p>
                                                        <p className="text-xs text-slate-400 dark:text-zinc-500">Login, segurança e sessão.</p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-1.5 flex-shrink-0">
                                                    <Check className="w-3.5 h-3.5 text-emerald-500" strokeWidth={2} />
                                                    <span className="text-xs text-emerald-600 dark:text-emerald-400 font-bold">Sempre ativo</span>
                                                </div>
                                            </div>

                                            {cookieTypes.map(({ key, label, icon: Icon, desc }) => (
                                                <div key={key} className="flex items-start justify-between p-3 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-white/8 rounded-xl">
                                                    <div className="flex items-center gap-2.5">
                                                        <Icon className="w-4 h-4 text-brand-400 flex-shrink-0" strokeWidth={1.5} />
                                                        <div>
                                                            <p className="text-xs font-bold text-slate-900 dark:text-white">{label}</p>
                                                            <p className="text-xs text-slate-400 dark:text-zinc-500">{desc}</p>
                                                        </div>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        role="switch"
                                                        aria-checked={prefs[key]}
                                                        onClick={() => setPrefs(p => ({ ...p, [key]: !p[key] }))}
                                                        className={`relative w-9 h-5 rounded-full transition-all duration-300 flex-shrink-0 ml-3 ${prefs[key] ? 'bg-brand-400' : 'bg-slate-300 dark:bg-zinc-600'}`}
                                                    >
                                                        <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-transform duration-300 ${prefs[key] ? 'translate-x-4' : ''}`} />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            {/* Toggle preferences */}
                            <button
                                onClick={() => setExpanded(v => !v)}
                                className="flex items-center gap-1.5 text-xs text-slate-400 dark:text-zinc-500 hover:text-brand-400 transition-colors mb-4 font-medium"
                            >
                                {expanded ? <ChevronUp className="w-3.5 h-3.5" strokeWidth={2} /> : <ChevronDown className="w-3.5 h-3.5" strokeWidth={2} />}
                                {expanded ? 'Ocultar configurações' : 'Configurar preferências'}
                            </button>

                            {/* Action buttons */}
                            <div className="flex gap-2">
                                <button
                                    onClick={acceptAll}
                                    className="flex-1 py-2.5 bg-brand-400 hover:bg-brand-300 text-zinc-950 text-sm font-black rounded-xl transition-all hover:shadow-glow"
                                >
                                    Aceitar todos
                                </button>
                                {expanded ? (
                                    <button
                                        onClick={acceptSelected}
                                        className="flex-1 py-2.5 bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-zinc-200 text-sm font-bold rounded-xl hover:bg-slate-200 dark:hover:bg-zinc-700 transition-colors"
                                    >
                                        Salvar seleção
                                    </button>
                                ) : (
                                    <button
                                        onClick={rejectAll}
                                        className="flex-1 py-2.5 bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-zinc-200 text-sm font-bold rounded-xl hover:bg-slate-200 dark:hover:bg-zinc-700 transition-colors"
                                    >
                                        Apenas essenciais
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}

/** Utility: read stored consent preferences */
export function getCookieConsent(): CookiePrefs | null {
    return loadConsent();
}
