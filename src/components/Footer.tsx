import { Link } from 'react-router-dom';
import { Instagram, Mail, Phone, MapPin, ArrowUpRight, ShieldCheck } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';

export default function Footer() {
    const { isDark } = useTheme();
    const { t } = useLanguage();

    const inventoryLinks = [
        { to: '/estoque',               label: t('footer_all_cars') },
        { to: '/estoque?tipo=seminovo', label: t('footer_used')     },
        { to: '/estoque?tipo=0km',      label: t('footer_new')      },
        { to: '/estoque?categoria=suv', label: t('footer_suvs')     },
    ];

    const companyLinks = [
        { to: '/sobre-nos', label: t('footer_about')     },
        { to: '/anunciar',  label: t('footer_advertise') },
        { to: '/login',     label: t('footer_enter')     },
    ];

    const socials = [
        {
            label: 'Instagram',
            href: 'https://instagram.com/sulmotors',
            icon: (
                <Instagram className="w-4 h-4" strokeWidth={1.5} />
            ),
        },
        {
            label: 'Email',
            href: 'mailto:contato@sulmotor.com.br',
            icon: <Mail className="w-4 h-4" strokeWidth={1.5} />,
        },
    ];

    return (
        <footer className="bg-slate-100 dark:bg-zinc-950 border-t border-slate-200 dark:border-white/5 transition-colors duration-300">
            <div className="h-px bg-gradient-to-r from-transparent via-brand-400/40 to-transparent" />

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-8">
                <div className="grid grid-cols-1 md:grid-cols-12 gap-10 mb-16">

                    {/* ── Col 1: Brand ── */}
                    <div className="md:col-span-4">
                        <Link to="/" className="flex items-center mb-5">
                            <img
                                src={isDark ? '/logo-light.png' : '/logo-dark.png'}
                                alt="SulMotor"
                                className="h-9 w-auto object-contain transition-opacity duration-300 hover:opacity-85"
                            />
                        </Link>
                        <p className="text-sm text-slate-500 dark:text-zinc-500 leading-relaxed max-w-xs mb-6">
                            {t('footer_desc')}
                        </p>

                        <div className="flex gap-3">
                            {socials.map(({ label, href, icon }) => (
                                <a
                                    key={label}
                                    href={href}
                                    aria-label={label}
                                    target={href.startsWith('http') ? '_blank' : undefined}
                                    rel={href.startsWith('http') ? 'noopener noreferrer' : undefined}
                                    className="w-10 h-10 bg-slate-200 dark:bg-white/5 hover:bg-brand-400/20 border border-slate-300 dark:border-white/10 hover:border-brand-400/40 rounded-xl flex items-center justify-center text-slate-500 dark:text-zinc-500 hover:text-brand-400 transition-all"
                                >
                                    {icon}
                                </a>
                            ))}
                        </div>
                    </div>

                    {/* ── Col 2: Estoque ── */}
                    <div className="md:col-span-2">
                        <h4 className="text-slate-900 dark:text-white font-bold text-sm uppercase tracking-wider mb-5">
                            {t('footer_section_inventory')}
                        </h4>
                        <ul className="space-y-3">
                            {inventoryLinks.map(({ to, label }) => (
                                <li key={to}>
                                    <Link
                                        to={to}
                                        className="text-sm text-slate-500 dark:text-zinc-500 hover:text-brand-400 transition-colors flex items-center gap-1 group"
                                    >
                                        {label}
                                        <ArrowUpRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" strokeWidth={1.5} />
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* ── Col 3: Empresa ── */}
                    <div className="md:col-span-2">
                        <h4 className="text-slate-900 dark:text-white font-bold text-sm uppercase tracking-wider mb-5">
                            {t('footer_section_company')}
                        </h4>
                        <ul className="space-y-3">
                            {companyLinks.map(({ to, label }) => (
                                <li key={to}>
                                    <Link
                                        to={to}
                                        className="text-sm text-slate-500 dark:text-zinc-500 hover:text-brand-400 transition-colors flex items-center gap-1 group"
                                    >
                                        {label}
                                        <ArrowUpRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" strokeWidth={1.5} />
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* ── Col 4: Contato ── */}
                    <div className="md:col-span-4">
                        <h4 className="text-slate-900 dark:text-white font-bold text-sm uppercase tracking-wider mb-5">
                            {t('footer_section_contact')}
                        </h4>
                        <ul className="space-y-4">
                            <li className="flex items-center gap-3">
                                <div className="w-8 h-8 bg-brand-400/10 rounded-lg flex items-center justify-center flex-shrink-0">
                                    <MapPin className="w-4 h-4 text-brand-400" strokeWidth={1.5} />
                                </div>
                                <span className="text-sm text-slate-600 dark:text-zinc-400">{t('footer_city')}</span>
                            </li>
                            <li className="flex items-center gap-3">
                                <div className="w-8 h-8 bg-brand-400/10 rounded-lg flex items-center justify-center flex-shrink-0">
                                    <Phone className="w-4 h-4 text-brand-400" strokeWidth={1.5} />
                                </div>
                                <a
                                    href={`tel:+55${t('footer_phone').replace(/\D/g, '')}`}
                                    className="text-sm text-slate-600 dark:text-zinc-400 hover:text-brand-400 transition-colors"
                                >
                                    {t('footer_phone')}
                                </a>
                            </li>
                            <li className="flex items-center gap-3">
                                <div className="w-8 h-8 bg-brand-400/10 rounded-lg flex items-center justify-center flex-shrink-0">
                                    <Mail className="w-4 h-4 text-brand-400" strokeWidth={1.5} />
                                </div>
                                <a
                                    href="mailto:contato@sulmotor.com.br"
                                    className="text-sm text-slate-600 dark:text-zinc-400 hover:text-brand-400 transition-colors"
                                >
                                    contato@sulmotor.com.br
                                </a>
                            </li>
                        </ul>
                    </div>
                </div>

                {/* ── Bottom bar ── */}
                <div className="border-t border-slate-200 dark:border-white/5 pt-8">
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                        <p className="text-xs text-slate-400 dark:text-zinc-600 text-center sm:text-left">
                            {t('footer_copyright')}
                        </p>

                        {/* Legal links */}
                        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
                            <Link to="/termos"         className="text-xs text-slate-400 dark:text-zinc-600 hover:text-brand-400 transition-colors">{t('footer_terms')}</Link>
                            <span className="text-slate-300 dark:text-zinc-700 text-xs">|</span>
                            <Link to="/privacidade"    className="text-xs text-slate-400 dark:text-zinc-600 hover:text-brand-400 transition-colors">{t('footer_privacy')}</Link>
                            <span className="text-slate-300 dark:text-zinc-700 text-xs">|</span>
                            <Link to="/seus-direitos"  className="text-xs text-slate-400 dark:text-zinc-600 hover:text-brand-400 transition-colors">{t('footer_rights')}</Link>
                            <span className="text-slate-300 dark:text-zinc-700 text-xs">|</span>
                            <Link to="/cookies"        className="text-xs text-slate-400 dark:text-zinc-600 hover:text-brand-400 transition-colors">{t('footer_cookies')}</Link>
                        </div>

                        {/* Legal disclaimer */}
                        <div className="mt-3 flex items-start gap-2 w-full">
                            <ShieldCheck className="w-3.5 h-3.5 text-slate-400 dark:text-zinc-600 flex-shrink-0 mt-0.5" strokeWidth={1.5} />
                            <p className="text-xs text-slate-400 dark:text-zinc-600 leading-relaxed">
                                {t('footer_legal')}
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </footer>
    );
}
