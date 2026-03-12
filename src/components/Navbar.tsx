import { useState, useRef, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X, LogOut, User as UserIcon, ChevronDown, Sun, Moon, Home, Car, Building2, PlusCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage, type Language } from '../contexts/LanguageContext';

/* ── Flag SVGs ─────────────────────────────────────────── */
function FlagBR() {
    return (
        <svg viewBox="0 0 20 14" width="20" height="14" className="rounded-sm flex-shrink-0">
            <rect width="20" height="14" fill="#009B3A" />
            <polygon points="10,1.5 19,7 10,12.5 1,7" fill="#FEDF00" />
            <circle cx="10" cy="7" r="3.2" fill="#002776" />
            <path d="M7.2 6.5 Q10 5.5 12.8 6.5" stroke="white" strokeWidth="0.6" fill="none" />
        </svg>
    );
}
function FlagUS() {
    return (
        <svg viewBox="0 0 20 14" width="20" height="14" className="rounded-sm flex-shrink-0">
            <rect width="20" height="14" fill="#B22234" />
            <rect y="1.08" width="20" height="1.08" fill="white" />
            <rect y="3.23" width="20" height="1.08" fill="white" />
            <rect y="5.38" width="20" height="1.08" fill="white" />
            <rect y="7.54" width="20" height="1.08" fill="white" />
            <rect y="9.69" width="20" height="1.08" fill="white" />
            <rect y="11.85" width="20" height="1.08" fill="white" />
            <rect width="8" height="7.54" fill="#3C3B6E" />
        </svg>
    );
}
function FlagES() {
    return (
        <svg viewBox="0 0 20 14" width="20" height="14" className="rounded-sm flex-shrink-0">
            <rect width="20" height="14" fill="#AA151B" />
            <rect y="3.5" width="20" height="7" fill="#F1BF00" />
        </svg>
    );
}

const flagMap: Record<Language, { flag: React.ReactNode; label: string }> = {
    'pt-BR': { flag: <FlagBR />, label: 'PT' },
    'en':    { flag: <FlagUS />, label: 'EN' },
    'es':    { flag: <FlagES />, label: 'ES' },
};

const languageOptions: Language[] = ['pt-BR', 'en', 'es'];

export default function Navbar() {
    const [mobileOpen, setMobileOpen] = useState(false);
    const [userMenuOpen, setUserMenuOpen] = useState(false);
    const [langMenuOpen, setLangMenuOpen] = useState(false);
    const location = useLocation();
    const { user, signOut } = useAuth();
    const { toggleTheme, isDark } = useTheme();
    const { language, setLanguage, t } = useLanguage();
    const langRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (langRef.current && !langRef.current.contains(e.target as Node)) {
                setLangMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const links = [
        { to: '/',          label: t('nav_home'),      icon: Home      },
        { to: '/estoque',   label: t('nav_inventory'), icon: Car       },
        { to: '/sobre-nos', label: t('nav_about'),     icon: Building2 },
    ];

    const isActive = (path: string) => location.pathname === path;

    const handleSignOut = async () => {
        await signOut();
        setUserMenuOpen(false);
    };

    return (
        <nav className="sticky top-0 z-50 bg-white/90 dark:bg-zinc-950/80 backdrop-blur-xl border-b border-slate-200 dark:border-white/5 transition-colors duration-300">
            {/* Top accent line */}
            <div className="h-px bg-gradient-to-r from-transparent via-brand-400 to-transparent opacity-60" />

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="relative flex items-center justify-between h-16">

                    {/* ── Logo ── */}
                    <Link to="/" className="flex items-center group flex-shrink-0">
                        <img
                            src={isDark ? '/logo-light.png' : '/logo-dark.png'}
                            alt="SulMotor"
                            className="h-9 w-auto object-contain transition-opacity duration-300 group-hover:opacity-85"
                        />
                    </Link>

                    {/* ── Desktop nav — absolutely centred ── */}
                    <div className="hidden md:flex items-center gap-1 absolute left-1/2 -translate-x-1/2">
                        {links.map((link) => (
                            <Link
                                key={link.to}
                                to={link.to}
                                className={`relative flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                                    isActive(link.to)
                                        ? 'text-brand-400'
                                        : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
                                }`}
                            >
                                {isActive(link.to) && (
                                    <motion.div
                                        layoutId="nav-active"
                                        className="absolute inset-0 bg-brand-400/10 rounded-lg border border-brand-400/20"
                                    />
                                )}
                                <link.icon className="relative w-4 h-4 flex-shrink-0" strokeWidth={1.5} />
                                <span className="relative">{link.label}</span>
                            </Link>
                        ))}
                    </div>

                    {/* ── Desktop right controls ── */}
                    <div className="hidden md:flex items-center gap-2 flex-shrink-0">

                        {/* Language selector */}
                        <div className="relative" ref={langRef}>
                            <button
                                onClick={() => setLangMenuOpen(!langMenuOpen)}
                                className="flex items-center gap-1.5 h-9 px-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-white/5 hover:border-brand-400/40 transition-all"
                                aria-label={t('common_change_language')}
                            >
                                {flagMap[language].flag}
                                <span className="text-xs font-bold text-slate-600 dark:text-zinc-400">{flagMap[language].label}</span>
                                <ChevronDown className={`w-3 h-3 text-slate-400 dark:text-zinc-500 transition-transform ${langMenuOpen ? 'rotate-180' : ''}`} />
                            </button>

                            <AnimatePresence>
                                {langMenuOpen && (
                                    <motion.div
                                        initial={{ opacity: 0, y: 6, scale: 0.96 }}
                                        animate={{ opacity: 1, y: 0, scale: 1 }}
                                        exit={{ opacity: 0, y: 6, scale: 0.96 }}
                                        transition={{ duration: 0.12 }}
                                        className="absolute right-0 mt-2 w-36 bg-white dark:bg-zinc-900 rounded-xl shadow-xl border border-slate-200 dark:border-white/10 py-1.5 overflow-hidden"
                                    >
                                        {languageOptions.map((lang) => (
                                            <button
                                                key={lang}
                                                onClick={() => { setLanguage(lang); setLangMenuOpen(false); }}
                                                className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm font-medium transition-colors ${
                                                    language === lang
                                                        ? 'text-brand-500 dark:text-brand-400 bg-brand-400/5'
                                                        : 'text-slate-600 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-white/5'
                                                }`}
                                            >
                                                {flagMap[lang].flag}
                                                <span>{lang === 'pt-BR' ? 'Português' : lang === 'en' ? 'English' : 'Español'}</span>
                                                {language === lang && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-brand-400" />}
                                            </button>
                                        ))}
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>

                        {/* Theme toggle */}
                        <button
                            onClick={toggleTheme}
                            className="w-9 h-9 flex items-center justify-center rounded-xl border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-zinc-400 hover:text-brand-400 hover:border-brand-400/40 transition-all"
                            aria-label={t('common_toggle_theme')}
                        >
                            {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                        </button>

                        {/* Advertise CTA */}
                        <Link
                            to="/anunciar"
                            className="group relative flex items-center gap-2 px-5 py-2.5 text-sm font-bold rounded-xl overflow-hidden transition-all hover:shadow-glow"
                        >
                            <div className="absolute inset-0 bg-gradient-to-r from-brand-500 to-brand-400 transition-all group-hover:opacity-90" />
                            <PlusCircle className="relative w-4 h-4 text-zinc-950" strokeWidth={1.5} />
                            <span className="relative text-zinc-950">{t('nav_advertise')}</span>
                        </Link>

                        {/* User menu */}
                        {user ? (
                            <div className="relative">
                                <button
                                    onClick={() => setUserMenuOpen(!userMenuOpen)}
                                    className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-700 dark:text-zinc-300 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 rounded-xl transition-all border border-slate-200 dark:border-white/10"
                                >
                                    <div className="w-7 h-7 bg-gradient-to-br from-brand-400 to-brand-600 rounded-full flex items-center justify-center text-zinc-950 overflow-hidden">
                                        {user.user_metadata?.avatar_url ? (
                                            <img src={user.user_metadata.avatar_url} alt={t('nav_profile')} className="w-full h-full object-cover" />
                                        ) : (
                                            <UserIcon className="w-4 h-4" />
                                        )}
                                    </div>
                                    <span className="max-w-[100px] truncate">
                                        {user.user_metadata?.full_name
                                            ? user.user_metadata.full_name.split(' ')[0]
                                            : user.email?.split('@')[0]}
                                    </span>
                                    <ChevronDown className={`w-3.5 h-3.5 transition-transform ${userMenuOpen ? 'rotate-180' : ''}`} />
                                </button>

                                <AnimatePresence>
                                    {userMenuOpen && (
                                        <motion.div
                                            initial={{ opacity: 0, y: 8, scale: 0.96 }}
                                            animate={{ opacity: 1, y: 0, scale: 1 }}
                                            exit={{ opacity: 0, y: 8, scale: 0.96 }}
                                            transition={{ duration: 0.15 }}
                                            className="absolute right-0 mt-2 w-52 bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-white/10 py-2 overflow-hidden"
                                        >
                                            <div className="px-4 py-2 border-b border-slate-100 dark:border-white/5 mb-1">
                                                <p className="text-xs text-slate-400 dark:text-zinc-500">{t('nav_account')}</p>
                                                <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">{user.email}</p>
                                            </div>
                                            {[
                                                { to: '/meu-perfil',    label: t('nav_profile')   },
                                                { to: '/favoritos',     label: t('nav_favorites') },
                                                { to: '/meus-anuncios', label: t('nav_my_ads')    },
                                            ].map((item) => (
                                                <Link
                                                    key={item.to}
                                                    to={item.to}
                                                    className="block px-4 py-2.5 text-sm text-slate-600 dark:text-zinc-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
                                                    onClick={() => setUserMenuOpen(false)}
                                                >
                                                    {item.label}
                                                </Link>
                                            ))}
                                            <div className="border-t border-slate-100 dark:border-white/5 mt-1 pt-1">
                                                <button
                                                    onClick={handleSignOut}
                                                    className="w-full text-left px-4 py-2.5 text-sm text-red-500 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-500/10 flex items-center gap-2 transition-colors"
                                                >
                                                    <LogOut className="w-4 h-4" />
                                                    {t('nav_sign_out')}
                                                </button>
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        ) : (
                            <Link
                                to="/login"
                                className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 rounded-xl transition-all border border-slate-200 dark:border-white/10"
                            >
                                {t('nav_enter')}
                            </Link>
                        )}
                    </div>

                    {/* ── Mobile: language + theme + hamburger ── */}
                    <div className="md:hidden flex items-center gap-1.5">
                        <div className="relative" ref={undefined}>
                            <button
                                onClick={() => setLangMenuOpen(!langMenuOpen)}
                                className="w-9 h-9 flex items-center justify-center rounded-xl border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-white/5 transition-all"
                                aria-label={t('common_change_language')}
                            >
                                {flagMap[language].flag}
                            </button>
                            <AnimatePresence>
                                {langMenuOpen && (
                                    <motion.div
                                        initial={{ opacity: 0, y: 6, scale: 0.96 }}
                                        animate={{ opacity: 1, y: 0, scale: 1 }}
                                        exit={{ opacity: 0, y: 6, scale: 0.96 }}
                                        transition={{ duration: 0.12 }}
                                        className="absolute right-0 mt-2 w-36 bg-white dark:bg-zinc-900 rounded-xl shadow-xl border border-slate-200 dark:border-white/10 py-1.5 overflow-hidden z-50"
                                    >
                                        {languageOptions.map((lang) => (
                                            <button
                                                key={lang}
                                                onClick={() => { setLanguage(lang); setLangMenuOpen(false); }}
                                                className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm font-medium transition-colors ${
                                                    language === lang
                                                        ? 'text-brand-500 dark:text-brand-400 bg-brand-400/5'
                                                        : 'text-slate-600 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-white/5'
                                                }`}
                                            >
                                                {flagMap[lang].flag}
                                                <span>{lang === 'pt-BR' ? 'Português' : lang === 'en' ? 'English' : 'Español'}</span>
                                            </button>
                                        ))}
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>

                        <button
                            onClick={toggleTheme}
                            className="w-9 h-9 flex items-center justify-center rounded-xl border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-zinc-400 hover:text-brand-400 transition-all"
                        >
                            {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                        </button>
                        <button
                            className="p-2 text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 rounded-xl transition-colors"
                            onClick={() => setMobileOpen(!mobileOpen)}
                        >
                            {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
                        </button>
                    </div>
                </div>
            </div>

            {/* ── Mobile menu ── */}
            <AnimatePresence>
                {mobileOpen && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="md:hidden overflow-hidden bg-white dark:bg-zinc-950 border-t border-slate-100 dark:border-white/5"
                    >
                        <div className="px-4 py-4 space-y-1">
                            {links.map((link) => (
                                <Link
                                    key={link.to}
                                    to={link.to}
                                    onClick={() => setMobileOpen(false)}
                                    className={`flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${
                                        isActive(link.to)
                                            ? 'text-brand-400 bg-brand-400/10 border border-brand-400/20'
                                            : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-white/5'
                                    }`}
                                >
                                    <link.icon className="w-4 h-4 flex-shrink-0" strokeWidth={1.5} />
                                    {link.label}
                                </Link>
                            ))}
                            <div className="border-t border-slate-100 dark:border-white/5 my-2 pt-2">
                                <Link
                                    to="/anunciar"
                                    onClick={() => setMobileOpen(false)}
                                    className="flex items-center gap-2 px-4 py-3 text-sm font-bold text-zinc-950 bg-gradient-to-r from-brand-500 to-brand-400 rounded-xl"
                                >
                                    <PlusCircle className="w-4 h-4" strokeWidth={1.5} />
                                    {t('nav_advertise')}
                                </Link>
                            </div>
                            {user ? (
                                <>
                                    {[
                                        { to: '/meu-perfil',    label: t('nav_profile')   },
                                        { to: '/favoritos',     label: t('nav_favorites') },
                                        { to: '/meus-anuncios', label: t('nav_my_ads')    },
                                    ].map((item) => (
                                        <Link
                                            key={item.to}
                                            to={item.to}
                                            onClick={() => setMobileOpen(false)}
                                            className="block px-4 py-3 text-sm font-medium text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white"
                                        >
                                            {item.label}
                                        </Link>
                                    ))}
                                    <button
                                        onClick={() => { handleSignOut(); setMobileOpen(false); }}
                                        className="w-full text-left px-4 py-3 text-sm font-medium text-red-500 dark:text-red-400"
                                    >
                                        {t('nav_sign_out')}
                                    </button>
                                </>
                            ) : (
                                <Link
                                    to="/login"
                                    onClick={() => setMobileOpen(false)}
                                    className="block px-4 py-3 text-sm font-medium text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white"
                                >
                                    {t('nav_enter')}
                                </Link>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </nav>
    );
}
