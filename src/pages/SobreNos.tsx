import { motion } from 'framer-motion';
import { Target, Eye, Heart, MapPin, Phone, Mail, Shield, Zap, Users, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function SobreNos() {
    const values = [
        { icon: Heart, title: 'Confiança', desc: 'Construímos relacionamentos duradouros baseados em transparência e integridade total.', color: 'text-red-500 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/20' },
        { icon: Zap, title: 'Inovação', desc: 'Investimos continuamente em tecnologia para oferecer a melhor experiência do mercado.', color: 'text-brand-500 dark:text-brand-400', bg: 'bg-brand-50 dark:bg-brand-400/10 border-brand-200 dark:border-brand-400/20' },
        { icon: Eye, title: 'Transparência', desc: 'Todas as informações são apresentadas de forma clara e honesta aos nossos usuários.', color: 'text-purple-500 dark:text-purple-400', bg: 'bg-purple-50 dark:bg-purple-500/10 border-purple-200 dark:border-purple-500/20' },
    ];

    const team = [
        { stat: '8+', label: 'Anos no mercado' },
        { stat: '150k+', label: 'Negócios realizados' },
        { stat: '98%', label: 'Satisfação do cliente' },
        { stat: '2.4k+', label: 'Veículos ativos' },
    ];

    return (
        <div className="bg-slate-50 dark:bg-zinc-950 transition-colors duration-300">
            {/* Hero – always dark (photo bg) */}
            <section className="relative min-h-[60vh] flex items-center overflow-hidden">
                <img src="https://images.unsplash.com/photo-1449965408869-eaa3f722e40d?w=1400&q=70" alt="" className="absolute inset-0 w-full h-full object-cover" />
                <div className="absolute inset-0 bg-zinc-950/80" />
                <div className="absolute inset-0 bg-gradient-to-r from-zinc-950 via-zinc-950/70 to-zinc-950/30" />
                <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'linear-gradient(rgba(0,212,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(0,212,255,0.05) 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
                <div className="absolute top-1/2 left-1/4 -translate-y-1/2 w-96 h-96 bg-brand-400/8 rounded-full blur-[100px]" />
                <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 py-24">
                    <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }}>
                        <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-brand-400/10 border border-brand-400/30 rounded-full mb-6">
                            <div className="w-1.5 h-1.5 rounded-full bg-brand-400 animate-pulse" />
                            <span className="text-xs font-bold text-brand-400 uppercase tracking-widest">Sobre nós</span>
                        </div>
                        <h1 className="text-5xl md:text-7xl font-black text-white leading-none mb-6 tracking-tight">
                            Reinventando o<br />
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-400 to-brand-300">mercado automotivo</span>
                        </h1>
                        <p className="text-lg text-zinc-300 max-w-xl leading-relaxed">Conectamos compradores e vendedores com tecnologia de ponta, segurança e a melhor experiência do Brasil.</p>
                    </motion.div>
                </div>
            </section>

            {/* Stats bar */}
            <section className="border-y border-slate-200 dark:border-white/5 bg-white dark:bg-zinc-900/50 transition-colors">
                <div className="max-w-5xl mx-auto px-4">
                    <div className="grid grid-cols-2 md:grid-cols-4">
                        {team.map(({ stat, label }, i) => (
                            <motion.div key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}
                                className={`px-8 py-8 text-center ${i < team.length - 1 ? 'border-r border-slate-200 dark:border-white/5' : ''}`}>
                                <p className="text-3xl font-black text-brand-500 dark:text-brand-400 mb-1">{stat}</p>
                                <p className="text-xs text-slate-500 dark:text-zinc-600 font-medium uppercase tracking-wider">{label}</p>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Who we are */}
            <section className="max-w-5xl mx-auto px-4 sm:px-6 py-20">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-16 items-center">
                    <motion.div initial={{ opacity: 0, x: -30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}>
                        <div className="flex items-center gap-2 mb-4">
                            <Users className="w-4 h-4 text-brand-500 dark:text-brand-400" />
                            <span className="text-xs font-bold text-brand-500 dark:text-brand-400 uppercase tracking-widest">Quem somos</span>
                        </div>
                        <h2 className="text-3xl md:text-4xl font-black text-slate-900 dark:text-white mb-6 tracking-tight">
                            Uma empresa que<span className="text-brand-500 dark:text-brand-400"> transforma</span> o mercado
                        </h2>
                        <p className="text-slate-600 dark:text-zinc-400 leading-relaxed mb-4 text-sm">
                            A SulMotors nasceu com a missão de transformar o mercado de veículos seminovos no Brasil. Somos um marketplace digital que conecta compradores e vendedores, oferecendo uma experiência moderna, segura e transparente.
                        </p>
                        <p className="text-slate-600 dark:text-zinc-400 leading-relaxed text-sm">
                            Utilizamos tecnologia de ponta, incluindo inteligência artificial para aprimoramento de fotos e ferramentas de precificação inteligente, tornando o processo de compra e venda mais eficiente e acessível para todos.
                        </p>
                    </motion.div>
                    <motion.div initial={{ opacity: 0, x: 30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} className="relative">
                        <div className="relative rounded-2xl overflow-hidden shadow-xl dark:shadow-none">
                            <img src="https://images.unsplash.com/photo-1560958089-b8a1929cea89?w=600&q=80" alt="Equipe SulMotors" className="w-full h-80 object-cover" />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                        </div>
                        <div className="absolute -bottom-4 -left-4 w-24 h-24 bg-brand-400/10 border border-brand-400/20 rounded-2xl -z-10" />
                        <div className="absolute -top-4 -right-4 w-16 h-16 bg-purple-500/10 border border-purple-500/20 rounded-xl -z-10" />
                    </motion.div>
                </div>
            </section>

            {/* Mission & Vision */}
            <section className="bg-white dark:bg-zinc-900/50 border-y border-slate-200 dark:border-white/5 py-20 transition-colors">
                <div className="max-w-5xl mx-auto px-4 sm:px-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {[
                            { icon: Target, title: 'Missão', desc: 'Facilitar a compra e venda de veículos no Brasil, democratizando o acesso a boas ofertas e proporcionando uma experiência segura e transparente para todos os envolvidos.', color: 'text-brand-500 dark:text-brand-400', bg: 'border-brand-300 dark:border-brand-400/20', glow: 'from-brand-400/5 to-transparent' },
                            { icon: Eye, title: 'Visão', desc: 'Ser referência nacional em marketplace automotivo, reconhecida pela inovação tecnológica, excelência no atendimento e compromisso com a transparência nas negociações.', color: 'text-purple-500 dark:text-purple-400', bg: 'border-purple-300 dark:border-purple-500/20', glow: 'from-purple-500/5 to-transparent' },
                        ].map(({ icon: Icon, title, desc, color, bg, glow }) => (
                            <motion.div key={title} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
                                className={`relative p-8 bg-white dark:bg-zinc-900 rounded-2xl border ${bg} overflow-hidden shadow-sm dark:shadow-none`}>
                                <div className={`absolute top-0 left-0 right-0 h-1/2 bg-gradient-to-b ${glow}`} />
                                <div className="relative">
                                    <div className="w-12 h-12 bg-slate-100 dark:bg-white/5 rounded-xl flex items-center justify-center mb-5">
                                        <Icon className={`w-6 h-6 ${color}`} />
                                    </div>
                                    <h3 className="text-xl font-black text-slate-900 dark:text-white mb-3">{title}</h3>
                                    <p className="text-slate-600 dark:text-zinc-400 leading-relaxed text-sm">{desc}</p>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Values */}
            <section className="max-w-5xl mx-auto px-4 sm:px-6 py-20">
                <div className="text-center mb-12">
                    <h2 className="text-3xl md:text-4xl font-black text-slate-900 dark:text-white tracking-tight">Nossos valores</h2>
                    <p className="text-slate-500 dark:text-zinc-500 mt-3 text-sm">O que guia cada decisão que tomamos</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {values.map(({ icon: Icon, title, desc, color, bg }, i) => (
                        <motion.div key={title} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}
                            className="text-center p-8 bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-white/5 hover:border-slate-300 dark:hover:border-white/10 transition-all shadow-sm dark:shadow-none">
                            <div className={`w-14 h-14 ${bg} rounded-2xl flex items-center justify-center mx-auto mb-5 border`}>
                                <Icon className={`w-7 h-7 ${color}`} />
                            </div>
                            <h3 className="text-lg font-black text-slate-900 dark:text-white mb-2">{title}</h3>
                            <p className="text-slate-500 dark:text-zinc-500 text-sm leading-relaxed">{desc}</p>
                        </motion.div>
                    ))}
                </div>
            </section>

            {/* Contact CTA */}
            <section className="relative py-20 overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-brand-950/80 to-zinc-950" />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[200px] bg-brand-400/10 blur-[80px] rounded-full" />
                <div className="relative z-10 max-w-3xl mx-auto px-4 text-center">
                    <div className="flex items-center justify-center gap-2 mb-4">
                        <Shield className="w-4 h-4 text-brand-400" />
                        <span className="text-xs font-bold text-brand-400 uppercase tracking-widest">Fale conosco</span>
                    </div>
                    <h2 className="text-3xl md:text-4xl font-black text-white mb-6 tracking-tight">Entre em contato</h2>
                    <p className="text-zinc-400 mb-10 text-sm">Estamos prontos para ajudar você em qualquer etapa</p>
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-6 mb-10">
                        {[{ icon: MapPin, text: 'Porto Alegre, RS' }, { icon: Phone, text: '(51) 99999-9999' }, { icon: Mail, text: 'contato@sulmotors.com.br' }].map(({ icon: Icon, text }) => (
                            <div key={text} className="flex items-center gap-2.5 text-zinc-300 text-sm">
                                <div className="w-8 h-8 bg-brand-400/10 border border-brand-400/20 rounded-lg flex items-center justify-center">
                                    <Icon className="w-4 h-4 text-brand-400" />
                                </div>
                                {text}
                            </div>
                        ))}
                    </div>
                    <Link to="/anunciar" className="inline-flex items-center gap-2.5 px-8 py-4 bg-brand-400 hover:bg-brand-300 text-zinc-950 font-black rounded-xl transition-all hover:shadow-glow">
                        Começar agora <ArrowRight className="w-5 h-5" />
                    </Link>
                </div>
            </section>
        </div>
    );
}
