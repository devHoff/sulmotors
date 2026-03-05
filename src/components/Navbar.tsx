import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X, Car, LogOut, User as UserIcon, ChevronDown, Zap, Sun, Moon } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';

export default function Navbar() {
    const [mobileOpen, setMobileOpen] = useState(false);
    const location = useLocation();
    const { user, signOut } = useAuth();
    const [userMenuOpen, setUserMenuOpen] = useState(false);
    const { toggleTheme, isDark } = useTheme();

    const links = [
        { to: '/', label: 'Início' },
        { to: '/estoque', label: 'Estoque' },
        { to: '/sobre-nos', label: 'Sobre Nós' },
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
                <div className="flex items-center justify-between h-16">
                    {/* Logo */}
                    <Link to="/" className="flex items-center gap-2.5 group">
                        <div className="relative w-9 h-9">
                            <div className="absolute inset-0 bg-brand-400/20 rounded-xl blur-sm group-hover:bg-brand-400/30 transition-all" />
                            <div className="relative w-9 h-9 bg-gradient-to-br from-brand-400 to-brand-600 rounded-xl flex items-center justify-center shadow-glow">
                                <Car className="w-5 h-5 text-zinc-950" />
                            </div>
                        </div>
                        <span className="text-xl font-black tracking-tight">
                            <span className="text-brand-400">Sul</span>
                            <span className="text-zinc-900 dark:text-white">Motors</span>
                        </span>
                    </Link>

                    {/* Desktop links */}
                    <div className="hidden md:flex items-center gap-1">
                        {links.map((link) => (
                            <Link
                                key={link.to}
                                to={link.to}
                                className={`relative px-4 py-2 rounded-lg text-sm font-medium transition-all ${isActive(link.to)
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
                                <span className="relative">{link.label}</span>
                            </Link>
                        ))}
                    </div>

                    {/* Desktop right */}
                    <div className="hidden md:flex items-center gap-3">
                        {/* Theme toggle */}
                        <button
                            onClick={toggleTheme}
                            className="w-9 h-9 flex items-center justify-center rounded-xl border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-zinc-400 hover:text-brand-400 hover:border-brand-400/40 transition-all"
                            aria-label="Toggle theme"
                        >
                            {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                        </button>

                        <Link
                            to="/anunciar"
                            className="group relative flex items-center gap-2 px-5 py-2.5 text-sm font-bold rounded-xl overflow-hidden transition-all hover:shadow-glow"
                        >
                            <div className="absolute inset-0 bg-gradient-to-r from-brand-500 to-brand-400 transition-all group-hover:opacity-90" />
                            <Zap className="relative w-4 h-4 text-zinc-950" />
                            <span className="relative text-zinc-950">Anunciar Carro</span>
                        </Link>

                        {user ? (
                            <div className="relative">
                                <button
                                    onClick={() => setUserMenuOpen(!userMenuOpen)}
                                    className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-700 dark:text-zinc-300 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 rounded-xl transition-all border border-slate-200 dark:border-white/10"
                                >
                                    <div className="w-7 h-7 bg-gradient-to-br from-brand-400 to-brand-600 rounded-full flex items-center justify-center text-zinc-950 overflow-hidden">
                                        {user.user_metadata?.avatar_url ? (
                                            <img src={user.user_metadata.avatar_url} alt="Profile" className="w-full h-full object-cover" />
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
                                                <p className="text-xs text-slate-400 dark:text-zinc-500">Conta</p>
                                                <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">{user.email}</p>
                                            </div>
                                            {[
                                                { to: '/meu-perfil', label: 'Meu Perfil' },
                                                { to: '/favoritos', label: 'Meus Favoritos' },
                                                { to: '/meus-anuncios', label: 'Meus Anúncios' },
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
                                                    Sair
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
                                Entrar
                            </Link>
                        )}
                    </div>

                    {/* Mobile: theme toggle + hamburger */}
                    <div className="md:hidden flex items-center gap-2">
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

            {/* Mobile menu */}
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
                                    className={`block px-4 py-3 rounded-xl text-sm font-medium transition-colors ${isActive(link.to)
                                        ? 'text-brand-400 bg-brand-400/10 border border-brand-400/20'
                                        : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-white/5'
                                        }`}
                                >
                                    {link.label}
                                </Link>
                            ))}
                            <div className="border-t border-slate-100 dark:border-white/5 my-2 pt-2">
                                <Link
                                    to="/anunciar"
                                    onClick={() => setMobileOpen(false)}
                                    className="flex items-center gap-2 px-4 py-3 text-sm font-bold text-zinc-950 bg-gradient-to-r from-brand-500 to-brand-400 rounded-xl"
                                >
                                    <Zap className="w-4 h-4" />
                                    Anunciar Carro
                                </Link>
                            </div>
                            {user ? (
                                <>
                                    {[
                                        { to: '/meu-perfil', label: 'Meu Perfil' },
                                        { to: '/favoritos', label: 'Meus Favoritos' },
                                        { to: '/meus-anuncios', label: 'Meus Anúncios' },
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
                                        Sair
                                    </button>
                                </>
                            ) : (
                                <Link
                                    to="/login"
                                    onClick={() => setMobileOpen(false)}
                                    className="block px-4 py-3 text-sm font-medium text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white"
                                >
                                    Entrar
                                </Link>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </nav>
    );
}
