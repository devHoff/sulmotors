import { Link } from 'react-router-dom';
import { Instagram, Twitter, Youtube, Mail, Phone, MapPin, ArrowUpRight } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';

export default function Footer() {
    const { isDark } = useTheme();
    return (
        <footer className="bg-slate-100 dark:bg-zinc-950 border-t border-slate-200 dark:border-white/5 transition-colors duration-300">
            <div className="h-px bg-gradient-to-r from-transparent via-brand-400/40 to-transparent" />

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-8">
                <div className="grid grid-cols-1 md:grid-cols-12 gap-10 mb-16">
                    {/* Brand */}
                    <div className="md:col-span-4">
                        <Link to="/" className="flex items-center mb-5">
                            <img
                                src={isDark ? '/logo-dark.png' : '/logo-light.png'}
                                alt="SulMotors"
                                className="h-9 w-auto object-contain transition-opacity duration-300 hover:opacity-85"
                            />
                        </Link>
                        <p className="text-sm text-slate-500 dark:text-zinc-500 leading-relaxed max-w-xs">
                            O marketplace automotivo mais moderno do Brasil. Compre e venda veículos com segurança, tecnologia e confiança.
                        </p>
                        <div className="flex gap-3 mt-6">
                            {[
                                { icon: Instagram, label: 'Instagram' },
                                { icon: Twitter, label: 'Twitter' },
                                { icon: Youtube, label: 'Youtube' },
                            ].map(({ icon: Icon, label }) => (
                                <a key={label} href="#" aria-label={label}
                                    className="w-10 h-10 bg-slate-200 dark:bg-white/5 hover:bg-brand-400/20 border border-slate-300 dark:border-white/10 hover:border-brand-400/40 rounded-xl flex items-center justify-center text-slate-500 dark:text-zinc-500 hover:text-brand-400 transition-all">
                                    <Icon className="w-4 h-4" />
                                </a>
                            ))}
                        </div>
                    </div>

                    {/* Links */}
                    <div className="md:col-span-2">
                        <h4 className="text-slate-900 dark:text-white font-bold text-sm uppercase tracking-wider mb-5">Estoque</h4>
                        <ul className="space-y-3">
                            {[
                                { to: '/estoque', label: 'Todos os Carros' },
                                { to: '/estoque?tipo=seminovos', label: 'Seminovos' },
                                { to: '/estoque?tipo=novos', label: '0 KM' },
                                { to: '/estoque?tipo=suv', label: 'SUVs' },
                            ].map(({ to, label }) => (
                                <li key={to}>
                                    <Link to={to} className="text-sm text-slate-500 dark:text-zinc-500 hover:text-brand-400 transition-colors flex items-center gap-1 group">
                                        {label}
                                        <ArrowUpRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </div>

                    <div className="md:col-span-2">
                        <h4 className="text-slate-900 dark:text-white font-bold text-sm uppercase tracking-wider mb-5">Empresa</h4>
                        <ul className="space-y-3">
                            {[
                                { to: '/sobre-nos', label: 'Sobre Nós' },
                                { to: '/anunciar', label: 'Anunciar' },
                                { to: '/login', label: 'Entrar' },
                            ].map(({ to, label }) => (
                                <li key={to}>
                                    <Link to={to} className="text-sm text-slate-500 dark:text-zinc-500 hover:text-brand-400 transition-colors flex items-center gap-1 group">
                                        {label}
                                        <ArrowUpRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* Contact */}
                    <div className="md:col-span-4">
                        <h4 className="text-slate-900 dark:text-white font-bold text-sm uppercase tracking-wider mb-5">Contato</h4>
                        <ul className="space-y-4">
                            {[
                                { icon: MapPin, text: 'Porto Alegre, RS' },
                                { icon: Phone, text: '(51) 99999-9999' },
                                { icon: Mail, text: 'contato@sulmotors.com.br' },
                            ].map(({ icon: Icon, text }) => (
                                <li key={text} className="flex items-center gap-3">
                                    <div className="w-8 h-8 bg-brand-400/10 rounded-lg flex items-center justify-center flex-shrink-0">
                                        <Icon className="w-4 h-4 text-brand-400" />
                                    </div>
                                    <span className="text-sm text-slate-600 dark:text-zinc-400">{text}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>

                <div className="border-t border-slate-200 dark:border-white/5 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <p className="text-xs text-slate-400 dark:text-zinc-600">© 2026 SulMotors. Todos os direitos reservados.</p>
                    <div className="flex items-center gap-1">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        <span className="text-xs text-slate-400 dark:text-zinc-600">Sistema operacional</span>
                    </div>
                </div>
            </div>
        </footer>
    );
}
