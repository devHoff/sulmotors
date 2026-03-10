import { motion } from 'framer-motion';
import { UserCheck, ArrowLeft, Mail } from 'lucide-react';
import { Link } from 'react-router-dom';

const rights = [
    {
        id: '01',
        title: 'Confirmação e acesso (Art. 18, I e II)',
        desc: 'Você pode solicitar a confirmação de que tratamos seus dados e obter uma cópia completa de todos os dados pessoais que mantemos sobre você, em formato legível.',
        action: 'Como exercer: envie e-mail para bandasleonardo@gmail.com com o assunto "Acesso aos meus dados". Responderemos em até 15 dias úteis.',
    },
    {
        id: '02',
        title: 'Correção (Art. 18, III)',
        desc: 'Você tem o direito de solicitar a correção de dados pessoais incompletos, inexatos ou desatualizados.',
        action: 'Como exercer: acesse as configurações do seu perfil para atualizar seus dados diretamente, ou entre em contato pelo e-mail bandasleonardo@gmail.com.',
    },
    {
        id: '03',
        title: 'Anonimização, bloqueio ou eliminação (Art. 18, IV)',
        desc: 'Você pode solicitar a anonimização, bloqueio ou eliminação de dados desnecessários, excessivos ou tratados em desconformidade com a LGPD.',
        action: 'Como exercer: envie e-mail para bandasleonardo@gmail.com com o assunto "Eliminação de dados". Processaremos sua solicitação em até 15 dias úteis, salvo obrigação legal de retenção.',
    },
    {
        id: '04',
        title: 'Portabilidade (Art. 18, V)',
        desc: 'Você pode solicitar a portabilidade dos seus dados pessoais para outro fornecedor de serviço ou produto, mediante requisição expressa, em formato interoperável.',
        action: 'Como exercer: envie e-mail para bandasleonardo@gmail.com com o assunto "Portabilidade de dados". Forneceremos os dados em formato JSON ou CSV.',
    },
    {
        id: '05',
        title: 'Eliminação dos dados tratados com consentimento (Art. 18, VI)',
        desc: 'Quando o tratamento dos seus dados for baseado em consentimento, você pode solicitar a eliminação desses dados a qualquer momento.',
        action: 'Como exercer: envie e-mail para bandasleonardo@gmail.com com o assunto "Revogar consentimento e excluir dados". Processaremos em até 15 dias úteis.',
    },
    {
        id: '06',
        title: 'Informação sobre compartilhamento (Art. 18, VII)',
        desc: 'Você tem o direito de saber com quais entidades públicas e privadas o SulMotor compartilha seus dados pessoais.',
        action: 'Essa informação está disponível na seção 6 da nossa Política de Privacidade. Para detalhes adicionais, escreva para bandasleonardo@gmail.com.',
    },
    {
        id: '07',
        title: 'Revogação do consentimento (Art. 18, IX)',
        desc: 'Nos casos em que o tratamento é baseado em consentimento, você pode revogá-lo a qualquer momento, sem prejudicar a licitude do tratamento realizado anteriormente.',
        action: 'Como exercer: envie e-mail para bandasleonardo@gmail.com com o assunto "Revogar consentimento" ou ajuste suas preferências nas configurações da conta.',
    },
    {
        id: '08',
        title: 'Oposição ao tratamento (Art. 18, § 2º)',
        desc: 'Você pode se opor ao tratamento realizado com fundamento em uma das hipóteses de dispensa de consentimento, em caso de descumprimento da LGPD.',
        action: 'Como exercer: envie e-mail para bandasleonardo@gmail.com com o assunto "Oposição ao tratamento de dados", descrevendo os dados e o motivo da oposição.',
    },
    {
        id: '09',
        title: 'Peticionar à ANPD (Art. 18, § 1º)',
        desc: 'Você tem o direito de peticionar a respeito dos seus dados à Autoridade Nacional de Proteção de Dados (ANPD) e aos órgãos de defesa do consumidor.',
        action: 'ANPD: www.gov.br/anpd — Consumidor.gov.br: www.consumidor.gov.br — Procon RS: procon.rs.gov.br',
    },
];

export default function SeusDireitos() {
    return (
        <div className="bg-slate-50 dark:bg-zinc-950 min-h-screen transition-colors duration-300">
            {/* Hero */}
            <section className="relative py-20 overflow-hidden border-b border-slate-200 dark:border-white/5">
                <div className="absolute inset-0 opacity-20 pointer-events-none"
                    style={{ backgroundImage: 'linear-gradient(rgba(0,212,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(0,212,255,0.04) 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
                <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center relative z-10">
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                        <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-brand-400/10 border border-brand-400/30 rounded-full mb-5">
                            <UserCheck className="w-3.5 h-3.5 text-brand-400" strokeWidth={1.5} />
                            <span className="text-xs font-bold text-brand-400 uppercase tracking-widest">LGPD — Art. 18</span>
                        </div>
                        <h1 className="text-4xl md:text-5xl font-black text-slate-900 dark:text-white tracking-tight mb-4">
                            Seus Direitos de Privacidade
                        </h1>
                        <p className="text-slate-500 dark:text-zinc-400 text-sm leading-relaxed max-w-xl mx-auto">
                            A Lei Geral de Proteção de Dados (Lei nº 13.709/2018) garante a você os seguintes direitos sobre seus dados pessoais.
                        </p>
                    </motion.div>
                </div>
            </section>

            {/* Rights cards */}
            <div className="max-w-3xl mx-auto px-4 sm:px-6 py-16">
                <div className="space-y-5">
                    {rights.map((r, i) => (
                        <motion.div
                            key={r.id}
                            initial={{ opacity: 0, x: -16 }}
                            whileInView={{ opacity: 1, x: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: i * 0.05 }}
                            className="p-6 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/8 rounded-2xl shadow-sm dark:shadow-none hover:border-brand-400/30 transition-colors"
                        >
                            <div className="flex items-start gap-4">
                                <div className="w-10 h-10 bg-brand-400/10 border border-brand-400/20 rounded-xl flex items-center justify-center flex-shrink-0">
                                    <span className="text-xs font-black text-brand-400">{r.id}</span>
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h2 className="text-base font-black text-slate-900 dark:text-white mb-2">{r.title}</h2>
                                    <p className="text-slate-600 dark:text-zinc-400 text-sm leading-relaxed mb-3">{r.desc}</p>
                                    <div className="p-3 bg-brand-400/5 border border-brand-400/15 rounded-xl">
                                        <p className="text-xs text-brand-500 dark:text-brand-400 font-medium leading-relaxed">{r.action}</p>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    ))}
                </div>

                {/* CTA contact block */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    className="mt-12 p-8 bg-zinc-900 dark:bg-zinc-900 border border-white/8 rounded-2xl text-center"
                >
                    <div className="w-14 h-14 bg-brand-400/10 border border-brand-400/20 rounded-2xl flex items-center justify-center mx-auto mb-5">
                        <Mail className="w-7 h-7 text-brand-400" strokeWidth={1.5} />
                    </div>
                    <h3 className="text-xl font-black text-white mb-2">Exercer um direito?</h3>
                    <p className="text-zinc-400 text-sm mb-6 leading-relaxed">
                        Envie sua solicitação para nosso encarregado de proteção de dados.<br />
                        Respondemos em até <strong className="text-white">15 dias úteis</strong>, conforme a LGPD.
                    </p>
                    <a
                        href="mailto:bandasleonardo@gmail.com?subject=Exercer%20direito%20LGPD"
                        className="inline-flex items-center gap-2.5 px-8 py-4 bg-brand-400 hover:bg-brand-300 text-zinc-950 font-black rounded-xl transition-all hover:shadow-glow"
                    >
                        <Mail className="w-4 h-4" strokeWidth={1.5} />
                        bandasleonardo@gmail.com
                    </a>
                    <p className="text-zinc-600 text-xs mt-4">Você também pode peticionar à ANPD: gov.br/anpd</p>
                </motion.div>

                {/* Bottom nav */}
                <div className="mt-12 pt-8 border-t border-slate-200 dark:border-white/5 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <Link to="/" className="inline-flex items-center gap-1.5 text-slate-500 dark:text-zinc-500 hover:text-brand-400 text-sm transition-colors">
                        <ArrowLeft className="w-4 h-4" strokeWidth={1.5} />
                        Voltar ao início
                    </Link>
                    <div className="flex items-center gap-4 text-xs text-slate-400 dark:text-zinc-600">
                        <Link to="/termos" className="hover:text-brand-400 transition-colors">Termos de Uso</Link>
                        <span>|</span>
                        <Link to="/privacidade" className="hover:text-brand-400 transition-colors">Política de Privacidade</Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
