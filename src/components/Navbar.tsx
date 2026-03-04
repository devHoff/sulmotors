import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X, Car, LogOut, User as UserIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';

export default function Navbar() {
    const [mobileOpen, setMobileOpen] = useState(false);
    const location = useLocation();
    const { user, signOut } = useAuth();
    const [userMenuOpen, setUserMenuOpen] = useState(false);

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
        <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-lg border-b border-slate-200/60 shadow-sm">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between h-16">
                    {/* Logo */}
                    <Link to="/" className="flex items-center gap-2 group">
                        <div className="w-9 h-9 bg-brand-600 rounded-xl flex items-center justify-center group-hover:bg-brand-700 transition-colors">
                            <Car className="w-5 h-5 text-white" />
                        </div>
                        <span className="text-xl font-bold">
                            <span className="text-brand-600">Sul</span>
                            <span className="text-slate-900">Motors</span>
                        </span>
                    </Link>

                    {/* Desktop links */}
                    <div className="hidden md:flex items-center gap-1">
                        {links.map((link) => (
                            <Link
                                key={link.to}
                                to={link.to}
                                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${isActive(link.to)
                                    ? 'text-brand-600 bg-brand-50'
                                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                                    }`}
                            >
                                {link.label}
                            </Link>
                        ))}
                    </div>

                    {/* Desktop right */}
                    <div className="hidden md:flex items-center gap-3">
                        <Link
                            to="/anunciar"
                            className="px-5 py-2.5 bg-brand-600 text-white text-sm font-semibold rounded-xl hover:bg-brand-700 transition-all hover:shadow-lg hover:shadow-brand-600/25 active:scale-95"
                        >
                            Anunciar Carro
                        </Link>

                        {user ? (
                            <div className="relative">
                                <button
                                    onClick={() => setUserMenuOpen(!userMenuOpen)}
                                    className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 rounded-lg transition-colors"
                                >
                                    <div className="w-8 h-8 bg-brand-100 rounded-full flex items-center justify-center text-brand-700 overflow-hidden">
                                        {user.user_metadata?.avatar_url ? (
                                            <img
                                                src={user.user_metadata.avatar_url}
                                                alt="Profile"
                                                className="w-full h-full object-cover"
                                            />
                                        ) : (
                                            <UserIcon className="w-4 h-4" />
                                        )}
                                    </div>
                                    <span className="max-w-[100px] truncate">
                                        {user.user_metadata?.full_name
                                            ? user.user_metadata.full_name.split(' ')[0]
                                            : user.email?.split('@')[0]}
                                    </span>
                                </button>

                                <AnimatePresence>
                                    {userMenuOpen && (
                                        <motion.div
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, y: 10 }}
                                            className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-xl border border-slate-100 py-1"
                                        >
                                            <Link
                                                to="/meu-perfil"
                                                className="block px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                                                onClick={() => setUserMenuOpen(false)}
                                            >
                                                Meu Perfil
                                            </Link>
                                            <Link
                                                to="/favoritos"
                                                className="block px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                                                onClick={() => setUserMenuOpen(false)}
                                            >
                                                Meus Favoritos
                                            </Link>
                                            <Link
                                                to="/meus-anuncios"
                                                className="block px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                                                onClick={() => setUserMenuOpen(false)}
                                            >
                                                Meus Anúncios
                                            </Link>
                                            <button
                                                onClick={handleSignOut}
                                                className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                                            >
                                                <LogOut className="w-4 h-4" />
                                                Sair
                                            </button>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        ) : (
                            <Link
                                to="/login"
                                className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-50 rounded-lg transition-colors"
                            >
                                Entrar
                            </Link>
                        )}
                    </div>

                    {/* Mobile toggle */}
                    <button
                        className="md:hidden p-2 text-slate-600 hover:bg-slate-100 rounded-lg"
                        onClick={() => setMobileOpen(!mobileOpen)}
                    >
                        {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
                    </button>
                </div>
            </div>

            {/* Mobile menu */}
            <AnimatePresence>
                {mobileOpen && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="md:hidden overflow-hidden bg-white border-t border-slate-100"
                    >
                        <div className="px-4 py-4 space-y-1">
                            {links.map((link) => (
                                <Link
                                    key={link.to}
                                    to={link.to}
                                    onClick={() => setMobileOpen(false)}
                                    className={`block px-4 py-3 rounded-xl text-sm font-medium transition-colors ${isActive(link.to)
                                        ? 'text-brand-600 bg-brand-50'
                                        : 'text-slate-600 hover:bg-slate-50'
                                        }`}
                                >
                                    {link.label}
                                </Link>
                            ))}
                            <hr className="my-2 border-slate-100" />
                            <Link
                                to="/anunciar"
                                onClick={() => setMobileOpen(false)}
                                className="block px-4 py-3 text-sm font-semibold text-brand-600"
                            >
                                Anunciar Carro
                            </Link>
                            {user ? (
                                <>
                                    <Link
                                        to="/meu-perfil"
                                        onClick={() => setMobileOpen(false)}
                                        className="block px-4 py-3 text-sm font-medium text-slate-600"
                                    >
                                        Meu Perfil
                                    </Link>
                                    <Link
                                        to="/favoritos"
                                        onClick={() => setMobileOpen(false)}
                                        className="block px-4 py-3 text-sm font-medium text-slate-600"
                                    >
                                        Meus Favoritos
                                    </Link>
                                    <Link
                                        to="/meus-anuncios"
                                        onClick={() => setMobileOpen(false)}
                                        className="block px-4 py-3 text-sm font-medium text-slate-600"
                                    >
                                        Meus Anúncios
                                    </Link>
                                    <button
                                        onClick={() => { handleSignOut(); setMobileOpen(false); }}
                                        className="w-full text-left px-4 py-3 text-sm font-medium text-red-600"
                                    >
                                        Sair
                                    </button>
                                </>
                            ) : (
                                <Link
                                    to="/login"
                                    onClick={() => setMobileOpen(false)}
                                    className="block px-4 py-3 text-sm font-medium text-slate-600"
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
