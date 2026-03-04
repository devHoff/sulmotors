import { motion } from 'framer-motion';
import { Target, Eye, Heart, MapPin, Phone, Mail } from 'lucide-react';

export default function SobreNos() {
    return (
        <div>
            {/* Hero */}
            <section className="relative bg-gradient-to-br from-brand-900 to-slate-900 py-24 overflow-hidden">
                <div className="absolute inset-0 opacity-10">
                    <div className="absolute w-96 h-96 bg-brand-500 rounded-full -top-20 -right-20 blur-3xl" />
                    <div className="absolute w-72 h-72 bg-blue-500 rounded-full -bottom-10 -left-10 blur-3xl" />
                </div>
                <div className="relative max-w-4xl mx-auto px-4 text-center">
                    <motion.h1
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-4xl md:text-5xl font-bold text-white mb-4"
                    >
                        Sobre a SulMotors
                    </motion.h1>
                    <motion.p
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                        className="text-lg text-slate-300 max-w-2xl mx-auto"
                    >
                        Conectamos compradores e vendedores de veículos com tecnologia, segurança e confiança.
                    </motion.p>
                </div>
            </section>

            {/* About */}
            <section className="max-w-5xl mx-auto px-4 py-20">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-16 items-center">
                    <div>
                        <h2 className="text-3xl font-bold text-slate-900 mb-6">Quem Somos</h2>
                        <p className="text-slate-600 leading-relaxed mb-4">
                            A SulMotors nasceu com a missão de transformar o mercado de veículos seminovos no Brasil.
                            Somos um marketplace digital que conecta compradores e vendedores, oferecendo uma experiência
                            moderna, segura e transparente.
                        </p>
                        <p className="text-slate-600 leading-relaxed">
                            Utilizamos tecnologia de ponta, incluindo inteligência artificial para aprimoramento de fotos
                            e ferramentas de precificação inteligente, tornando o processo de compra e venda mais eficiente
                            e acessível para todos.
                        </p>
                    </div>
                    <div className="relative">
                        <img
                            src="https://images.unsplash.com/photo-1560958089-b8a1929cea89?w=600&q=80"
                            alt="Equipe SulMotors"
                            className="rounded-2xl shadow-2xl"
                        />
                        <div className="absolute -bottom-6 -left-6 w-32 h-32 bg-brand-600/20 rounded-2xl -z-10" />
                        <div className="absolute -top-6 -right-6 w-24 h-24 bg-blue-500/20 rounded-2xl -z-10" />
                    </div>
                </div>
            </section>

            {/* Mission + Vision */}
            <section className="bg-slate-50 py-20">
                <div className="max-w-5xl mx-auto px-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            className="p-8 bg-white rounded-2xl border border-slate-200"
                        >
                            <div className="w-14 h-14 bg-brand-100 rounded-2xl flex items-center justify-center mb-5">
                                <Target className="w-7 h-7 text-brand-600" />
                            </div>
                            <h3 className="text-xl font-bold text-slate-900 mb-3">Missão</h3>
                            <p className="text-slate-600 leading-relaxed">
                                Facilitar a compra e venda de veículos no Brasil, democratizando o acesso a boas ofertas
                                e proporcionando uma experiência segura e transparente para todos os envolvidos.
                            </p>
                        </motion.div>
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: 0.1 }}
                            className="p-8 bg-white rounded-2xl border border-slate-200"
                        >
                            <div className="w-14 h-14 bg-purple-100 rounded-2xl flex items-center justify-center mb-5">
                                <Eye className="w-7 h-7 text-purple-600" />
                            </div>
                            <h3 className="text-xl font-bold text-slate-900 mb-3">Visão</h3>
                            <p className="text-slate-600 leading-relaxed">
                                Ser referência nacional em marketplace automotivo, reconhecida pela inovação tecnológica,
                                excelência no atendimento e compromisso com a transparência nas negociações.
                            </p>
                        </motion.div>
                    </div>
                </div>
            </section>

            {/* Values */}
            <section className="max-w-5xl mx-auto px-4 py-20">
                <h2 className="text-3xl font-bold text-slate-900 text-center mb-12">Nossos Valores</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    {[
                        { icon: Heart, title: 'Confiança', desc: 'Construímos relacionamentos baseados em transparência e integridade.' },
                        { icon: Target, title: 'Inovação', desc: 'Investimos em tecnologia para oferecer a melhor experiência.' },
                        { icon: Eye, title: 'Transparência', desc: 'Todas as informações são claramente apresentadas aos nossos usuários.' },
                    ].map(({ icon: Icon, title, desc }) => (
                        <motion.div
                            key={title}
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            className="text-center"
                        >
                            <div className="w-16 h-16 bg-brand-50 rounded-2xl flex items-center justify-center mx-auto mb-5">
                                <Icon className="w-8 h-8 text-brand-600" />
                            </div>
                            <h3 className="text-lg font-bold text-slate-900 mb-2">{title}</h3>
                            <p className="text-slate-500 text-sm leading-relaxed">{desc}</p>
                        </motion.div>
                    ))}
                </div>
            </section>

            {/* Contact */}
            <section className="bg-brand-600 py-16">
                <div className="max-w-4xl mx-auto px-4 text-center">
                    <h2 className="text-3xl font-bold text-white mb-4">Entre em Contato</h2>
                    <p className="text-white/80 mb-8">Estamos prontos para ajudar você</p>
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-6 text-white">
                        <div className="flex items-center gap-2">
                            <MapPin className="w-5 h-5 text-white/60" />
                            Porto Alegre, RS
                        </div>
                        <div className="flex items-center gap-2">
                            <Phone className="w-5 h-5 text-white/60" />
                            (51) 99999-9999
                        </div>
                        <div className="flex items-center gap-2">
                            <Mail className="w-5 h-5 text-white/60" />
                            contato@sulmotors.com.br
                        </div>
                    </div>
                </div>
            </section>
        </div>
    );
}
