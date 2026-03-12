import { Link } from 'react-router-dom';
import { ArrowLeft, Cookie, Shield, BarChart2, Settings, Megaphone, Mail, ChevronRight } from 'lucide-react';
import { motion } from 'framer-motion';

const LAST_UPDATED = '10 de março de 2026';

interface Section {
    id: string;
    icon: React.ElementType;
    title: string;
    content: React.ReactNode;
}

export default function Cookies() {
    const sections: Section[] = [
        {
            id: 'o-que-sao',
            icon: Cookie,
            title: 'O que são cookies?',
            content: (
                <div className="space-y-3 text-sm text-slate-600 dark:text-zinc-400 leading-relaxed">
                    <p>
                        Cookies são pequenos arquivos de texto armazenados no seu navegador quando você visita o SulMotor.
                        Eles permitem que o site funcione corretamente, melhore a experiência do usuário e forneça
                        funcionalidades como sessões de login, preferências do usuário e análise de tráfego.
                    </p>
                    <p>
                        Esses arquivos não causam nenhum dano ao seu dispositivo e não contêm informações pessoais
                        identificáveis por si só — eles armazenam apenas um identificador único que associa sua sessão
                        às informações guardadas nos nossos servidores.
                    </p>
                    <p>
                        O uso de cookies está em conformidade com a <strong className="text-slate-800 dark:text-zinc-200">Lei Geral de Proteção de Dados (LGPD — Lei nº 13.709/2018)</strong>,
                        que exige que informemos você sobre quais dados coletamos e como os utilizamos.
                    </p>
                </div>
            ),
        },
        {
            id: 'tipos',
            icon: Shield,
            title: 'Tipos de cookies utilizados',
            content: (
                <div className="space-y-5">
                    {[
                        {
                            name: 'Cookies Essenciais',
                            badge: 'Sempre ativos',
                            badgeColor: 'bg-emerald-500/15 border-emerald-500/30 text-emerald-600 dark:text-emerald-400',
                            desc: 'Necessários para o funcionamento correto da plataforma. Sem eles, o site não consegue operar de forma adequada.',
                            examples: ['Autenticação de login', 'Segurança e proteção contra CSRF', 'Gerenciamento de sessão', 'Preferências de tema (claro/escuro)'],
                        },
                        {
                            name: 'Cookies de Desempenho',
                            badge: 'Opcional',
                            badgeColor: 'bg-blue-500/15 border-blue-500/30 text-blue-600 dark:text-blue-400',
                            desc: 'Usados para entender como os usuários interagem com a plataforma, a fim de melhorar a usabilidade e o desempenho.',
                            examples: ['Análise de páginas visitadas', 'Tempo de permanência', 'Taxa de cliques', 'Erros de carregamento'],
                        },
                        {
                            name: 'Cookies Funcionais',
                            badge: 'Opcional',
                            badgeColor: 'bg-purple-500/15 border-purple-500/30 text-purple-600 dark:text-purple-400',
                            desc: 'Armazenam preferências do usuário para oferecer uma experiência mais personalizada.',
                            examples: ['Filtros de busca salvos', 'Configurações de idioma', 'Veículos visitados recentemente', 'Preferências de ordenação'],
                        },
                        {
                            name: 'Cookies de Marketing',
                            badge: 'Opcional',
                            badgeColor: 'bg-amber-500/15 border-amber-500/30 text-amber-600 dark:text-amber-400',
                            desc: 'Podem ser usados para apresentar anúncios relevantes com base nos interesses do usuário. Nunca vendemos seus dados a terceiros.',
                            examples: ['Personalização de anúncios', 'Rastreamento de conversões', 'Remarketing', 'Análise de campanhas'],
                        },
                    ].map(({ name, badge, badgeColor, desc, examples }) => (
                        <div key={name} className="p-4 bg-slate-50 dark:bg-zinc-800/60 border border-slate-200 dark:border-white/8 rounded-xl">
                            <div className="flex items-start justify-between gap-2 mb-2">
                                <h4 className="text-sm font-bold text-slate-900 dark:text-white">{name}</h4>
                                <span className={`flex-shrink-0 px-2 py-0.5 text-xs font-bold border rounded-full ${badgeColor}`}>{badge}</span>
                            </div>
                            <p className="text-xs text-slate-500 dark:text-zinc-500 leading-relaxed mb-3">{desc}</p>
                            <ul className="space-y-1">
                                {examples.map(ex => (
                                    <li key={ex} className="flex items-center gap-2 text-xs text-slate-500 dark:text-zinc-500">
                                        <ChevronRight className="w-3 h-3 text-brand-400 flex-shrink-0" strokeWidth={2} />
                                        {ex}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ))}
                </div>
            ),
        },
        {
            id: 'gerenciamento',
            icon: Settings,
            title: 'Gerenciamento de cookies',
            content: (
                <div className="space-y-4 text-sm text-slate-600 dark:text-zinc-400 leading-relaxed">
                    <p>
                        Você tem o direito de controlar quais cookies aceita. Ao visitar o SulMotor pela primeira vez,
                        exibimos um banner de consentimento onde você pode aceitar todos os cookies ou configurá-los
                        individualmente.
                    </p>
                    <p>
                        Você também pode gerenciar cookies diretamente pelo seu navegador. Consulte as instruções:
                    </p>
                    <div className="grid sm:grid-cols-2 gap-3">
                        {[
                            { name: 'Google Chrome', url: 'https://support.google.com/chrome/answer/95647' },
                            { name: 'Mozilla Firefox', url: 'https://support.mozilla.org/kb/enable-and-disable-cookies' },
                            { name: 'Safari (macOS/iOS)', url: 'https://support.apple.com/guide/safari/manage-cookies' },
                            { name: 'Microsoft Edge', url: 'https://support.microsoft.com/windows/delete-and-manage-cookies' },
                        ].map(({ name, url }) => (
                            <a key={name} href={url} target="_blank" rel="noopener noreferrer"
                                className="flex items-center gap-2 p-3 bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-white/10 rounded-lg text-xs font-medium text-slate-700 dark:text-zinc-300 hover:border-brand-400/40 hover:text-brand-500 dark:hover:text-brand-400 transition-colors group">
                                <Settings className="w-3.5 h-3.5 flex-shrink-0" strokeWidth={1.5} />
                                {name}
                                <ChevronRight className="w-3 h-3 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" strokeWidth={2} />
                            </a>
                        ))}
                    </div>
                    <div className="p-4 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/25 rounded-xl">
                        <p className="text-xs text-amber-700 dark:text-amber-400 leading-relaxed">
                            <strong>⚠️ Atenção:</strong> Desativar certos cookies pode afetar o funcionamento de algumas
                            funcionalidades da plataforma, como o login automático, filtros salvos e preferências de idioma.
                        </p>
                    </div>
                </div>
            ),
        },
        {
            id: 'contato',
            icon: Mail,
            title: 'Contato',
            content: (
                <div className="space-y-3 text-sm text-slate-600 dark:text-zinc-400 leading-relaxed">
                    <p>
                        Se você tiver dúvidas sobre esta Política de Cookies ou sobre como tratamos seus dados,
                        entre em contato com nosso time de privacidade:
                    </p>
                    <div className="flex items-center gap-3 p-4 bg-slate-50 dark:bg-zinc-800/60 border border-slate-200 dark:border-white/8 rounded-xl">
                        <div className="w-10 h-10 bg-brand-400/15 border border-brand-400/25 rounded-xl flex items-center justify-center flex-shrink-0">
                            <Mail className="w-5 h-5 text-brand-400" strokeWidth={1.5} />
                        </div>
                        <div>
                            <p className="text-xs text-slate-400 dark:text-zinc-500 mb-0.5">E-mail de privacidade</p>
                            <a href="mailto:bandasleonardo@gmail.com"
                                className="text-sm font-bold text-brand-500 dark:text-brand-400 hover:text-brand-600 dark:hover:text-brand-300 transition-colors">
                                bandasleonardo@gmail.com
                            </a>
                        </div>
                    </div>
                    <p>
                        Você pode também exercer seus direitos de titular de dados (acesso, correção, exclusão, portabilidade)
                        acessando a página <Link to="/seus-direitos" className="text-brand-500 dark:text-brand-400 font-semibold hover:underline">Seus Direitos</Link> ou
                        consultando nossa <Link to="/privacidade" className="text-brand-500 dark:text-brand-400 font-semibold hover:underline">Política de Privacidade</Link>.
                    </p>
                </div>
            ),
        },
    ];

    return (
        <div className="bg-slate-50 dark:bg-zinc-950 min-h-screen transition-colors duration-300">

            {/* Hero */}
            <div className="bg-white dark:bg-zinc-900 border-b border-slate-200 dark:border-white/5">
                <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12">
                    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
                        <Link to="/" className="inline-flex items-center gap-2 text-slate-400 dark:text-zinc-500 hover:text-brand-400 mb-6 transition-colors text-sm">
                            <ArrowLeft className="w-4 h-4" strokeWidth={1.5} /> Voltar ao início
                        </Link>
                        <div className="flex items-center gap-3 mb-3">
                            <div className="w-10 h-10 bg-brand-400/15 border border-brand-400/25 rounded-xl flex items-center justify-center">
                                <Cookie className="w-5 h-5 text-brand-400" strokeWidth={1.5} />
                            </div>
                            <span className="text-xs font-bold text-brand-400 uppercase tracking-widest">LGPD · Privacidade</span>
                        </div>
                        <h1 className="text-4xl font-black text-slate-900 dark:text-white tracking-tight mb-2">
                            Política de Cookies
                        </h1>
                        <p className="text-slate-500 dark:text-zinc-500 text-sm">
                            Última atualização: {LAST_UPDATED}
                        </p>
                    </motion.div>
                </div>
            </div>

            <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12">
                <div className="flex flex-col lg:flex-row gap-8">

                    {/* Table of Contents */}
                    <aside className="lg:w-56 flex-shrink-0">
                        <div className="sticky top-24 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/8 rounded-2xl p-4 shadow-sm dark:shadow-none">
                            <p className="text-xs font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider mb-3">Índice</p>
                            <nav className="space-y-1">
                                {sections.map(({ id, title }) => (
                                    <a key={id} href={`#${id}`}
                                        className="flex items-center gap-2 px-3 py-2 text-xs text-slate-600 dark:text-zinc-400 hover:text-brand-400 hover:bg-brand-400/5 rounded-lg transition-colors">
                                        <ChevronRight className="w-3 h-3 flex-shrink-0" strokeWidth={2} />
                                        {title}
                                    </a>
                                ))}
                            </nav>
                            <div className="mt-4 pt-4 border-t border-slate-100 dark:border-white/5 space-y-1.5">
                                <Link to="/privacidade" className="block text-xs text-slate-400 dark:text-zinc-500 hover:text-brand-400 transition-colors px-3 py-1">
                                    → Política de Privacidade
                                </Link>
                                <Link to="/termos" className="block text-xs text-slate-400 dark:text-zinc-500 hover:text-brand-400 transition-colors px-3 py-1">
                                    → Termos de Uso
                                </Link>
                                <Link to="/seus-direitos" className="block text-xs text-slate-400 dark:text-zinc-500 hover:text-brand-400 transition-colors px-3 py-1">
                                    → Seus Direitos (LGPD)
                                </Link>
                            </div>
                        </div>
                    </aside>

                    {/* Main content */}
                    <div className="flex-1 space-y-8">
                        {sections.map(({ id, icon: Icon, title, content }, i) => (
                            <motion.div
                                key={id}
                                id={id}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: i * 0.07 }}
                                className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/8 rounded-2xl p-6 shadow-sm dark:shadow-none scroll-mt-28"
                            >
                                <div className="flex items-center gap-3 mb-5">
                                    <div className="w-9 h-9 bg-brand-400/15 border border-brand-400/20 rounded-xl flex items-center justify-center flex-shrink-0">
                                        <Icon className="w-4 h-4 text-brand-400" strokeWidth={1.5} />
                                    </div>
                                    <h2 className="text-lg font-black text-slate-900 dark:text-white">{title}</h2>
                                </div>
                                {content}
                            </motion.div>
                        ))}

                        {/* LGPD compliance note */}
                        <div className="flex items-start gap-3 p-5 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 rounded-2xl">
                            <Shield className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" strokeWidth={1.5} />
                            <div>
                                <p className="text-sm font-bold text-emerald-700 dark:text-emerald-400 mb-1">
                                    Conformidade com a LGPD
                                </p>
                                <p className="text-xs text-emerald-600 dark:text-emerald-400/80 leading-relaxed">
                                    O SulMotor está comprometido com a proteção dos seus dados pessoais conforme a
                                    Lei Geral de Proteção de Dados (LGPD — Lei nº 13.709/2018). Nossa política de cookies
                                    é revisada periodicamente para garantir conformidade com as regulamentações vigentes.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
