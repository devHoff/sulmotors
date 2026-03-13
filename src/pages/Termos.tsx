import { motion } from 'framer-motion';
import { Scale, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

const sections = [
    {
        title: '1. Aceitação dos Termos',
        content: `Ao acessar ou usar o SulMotor ("Plataforma"), você concorda em cumprir e estar vinculado a estes Termos de Uso. Se você não concordar com qualquer parte destes termos, não poderá utilizar nossos serviços. A SulMotor reserva-se o direito de alterar estes termos a qualquer momento, sendo que as alterações entrarão em vigor imediatamente após a publicação na Plataforma.`,
    },
    {
        title: '2. Descrição do Serviço',
        content: `O SulMotor é um marketplace digital que conecta vendedores e compradores de veículos automotores no Brasil. A Plataforma oferece ferramentas para criação de anúncios, busca de veículos, comunicação entre usuários e serviços de destaque de anúncios. O SulMotor atua como intermediário tecnológico e não é parte nas negociações entre compradores e vendedores.`,
    },
    {
        title: '3. Cadastro e Conta do Usuário',
        content: `Para utilizar determinadas funcionalidades da Plataforma, é necessário criar uma conta. Você é responsável por: (a) manter a confidencialidade de suas credenciais de acesso; (b) todas as atividades realizadas com sua conta; (c) notificar imediatamente o SulMotor sobre qualquer uso não autorizado. Você deve ter pelo menos 18 anos de idade para criar uma conta e publicar anúncios.`,
    },
    {
        title: '4. Regras do Marketplace',
        content: `Ao utilizar o SulMotor, você concorda em: (a) fornecer informações verdadeiras, precisas e completas em seus anúncios; (b) não publicar anúncios fraudulentos, enganosos ou ilegais; (c) não utilizar a Plataforma para fins ilegais ou que violem direitos de terceiros; (d) não realizar atividades que perturbem o funcionamento da Plataforma; (e) não criar múltiplas contas para burlar restrições; (f) respeitar as normas do Código de Defesa do Consumidor (Lei nº 8.078/1990).`,
    },
    {
        title: '5. Responsabilidade pelos Anúncios',
        content: `O usuário que publica um anúncio é o único responsável pelo conteúdo, pela veracidade das informações e pela legalidade da venda do veículo anunciado. O SulMotor não verifica previamente os anúncios e não se responsabiliza por: (a) a veracidade das informações fornecidas pelos usuários; (b) a qualidade ou estado dos veículos anunciados; (c) o cumprimento das obrigações entre compradores e vendedores; (d) perdas financeiras decorrentes de negociações realizadas pela Plataforma.`,
    },
    {
        title: '6. Propriedade Intelectual',
        content: `Todo o conteúdo da Plataforma, incluindo mas não limitado a logotipos, marcas, textos, imagens, layout e código-fonte, é de propriedade exclusiva do SulMotor ou de seus licenciantes e está protegido pelas leis de propriedade intelectual brasileiras (Lei nº 9.279/1996 e Lei nº 9.610/1998). O usuário concede ao SulMotor uma licença não exclusiva, mundial, gratuita e sublicenciável para usar, reproduzir e exibir os conteúdos que publica na Plataforma, exclusivamente para fins operacionais do serviço.`,
    },
    {
        title: '7. Serviços Pagos — Impulsionar Anúncio',
        content: `O SulMotor oferece serviços pagos de destaque de anúncios ("Impulsionar"). Ao contratar este serviço: (a) o pagamento é processado pelo Mercado Pago; (b) o período de destaque começa imediatamente após a confirmação do pagamento; (c) não há reembolso após a ativação do serviço, salvo em casos de falha técnica comprovada do SulMotor; (d) o serviço expira automaticamente ao final do período contratado; (e) o SulMotor pode alterar os preços, sendo que as alterações não afetarão serviços já contratados e pagos.`,
    },
    {
        title: '8. Limitações de Responsabilidade',
        content: `O SulMotor não será responsável por danos diretos, indiretos, incidentais, especiais ou consequenciais decorrentes do uso ou da impossibilidade de uso da Plataforma, incluindo perda de dados, lucros cessantes ou danos à reputação. A responsabilidade total do SulMotor por qualquer reclamação relacionada ao uso da Plataforma não excederá o valor pago pelo usuário nos 12 meses anteriores à ocorrência do dano. Esta limitação aplica-se na extensão máxima permitida pelo ordenamento jurídico brasileiro.`,
    },
    {
        title: '9. Conduta Proibida',
        content: `É expressamente proibido: (a) realizar engenharia reversa, descompilar ou desmontar qualquer parte da Plataforma; (b) utilizar robôs, spiders ou outras ferramentas automatizadas para acessar a Plataforma sem autorização; (c) interferir na segurança ou integridade da Plataforma; (d) publicar conteúdo que viole direitos de terceiros, seja difamatório, obsceno ou ilegal; (e) tentar acessar áreas restritas da Plataforma sem autorização.`,
    },
    {
        title: '10. Rescisão',
        content: `O SulMotor reserva-se o direito de suspender ou encerrar sua conta a qualquer momento, com ou sem aviso prévio, caso haja violação destes Termos de Uso ou comportamento que prejudique outros usuários ou a integridade da Plataforma. Você pode encerrar sua conta a qualquer momento através das configurações do seu perfil ou solicitando ao suporte em contato@sulmotor.com.`,
    },
    {
        title: '11. Lei Aplicável e Foro',
        content: `Estes Termos de Uso são regidos e interpretados de acordo com as leis da República Federativa do Brasil. Qualquer disputa decorrente destes termos será submetida ao foro da comarca de Porto Alegre, Rio Grande do Sul, com renúncia expressa a qualquer outro, por mais privilegiado que seja.`,
    },
    {
        title: '12. Contato',
        content: `Para dúvidas sobre estes Termos de Uso, entre em contato: contato@sulmotor.com — SulMotor — Porto Alegre, RS, Brasil.`,
    },
];

export default function Termos() {
    return (
        <div className="bg-slate-50 dark:bg-zinc-950 min-h-screen transition-colors duration-300">
            {/* Hero */}
            <section className="relative py-20 overflow-hidden border-b border-slate-200 dark:border-white/5">
                <div className="absolute inset-0 opacity-20 pointer-events-none"
                    style={{ backgroundImage: 'linear-gradient(rgba(0,212,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(0,212,255,0.04) 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
                <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center relative z-10">
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                        <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-brand-400/10 border border-brand-400/30 rounded-full mb-5">
                            <Scale className="w-3.5 h-3.5 text-brand-400" strokeWidth={1.5} />
                            <span className="text-xs font-bold text-brand-400 uppercase tracking-widest">Documento legal</span>
                        </div>
                        <h1 className="text-4xl md:text-5xl font-black text-slate-900 dark:text-white tracking-tight mb-4">
                            Termos de Uso
                        </h1>
                        <p className="text-slate-500 dark:text-zinc-400 text-sm leading-relaxed max-w-xl mx-auto">
                            Última atualização: março de 2026. Por favor, leia atentamente antes de usar a Plataforma.
                        </p>
                    </motion.div>
                </div>
            </section>

            {/* Content */}
            <div className="max-w-3xl mx-auto px-4 sm:px-6 py-16">
                <div className="space-y-10">
                    {sections.map((s, i) => (
                        <motion.section
                            key={i}
                            initial={{ opacity: 0, y: 16 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: i * 0.04 }}
                        >
                            <h2 className="text-lg font-black text-slate-900 dark:text-white mb-3">{s.title}</h2>
                            <p className="text-slate-600 dark:text-zinc-400 leading-relaxed text-sm">{s.content}</p>
                        </motion.section>
                    ))}
                </div>

                {/* Bottom nav */}
                <div className="mt-16 pt-8 border-t border-slate-200 dark:border-white/5 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <Link to="/" className="inline-flex items-center gap-1.5 text-slate-500 dark:text-zinc-500 hover:text-brand-400 text-sm transition-colors">
                        <ArrowLeft className="w-4 h-4" strokeWidth={1.5} />
                        Voltar ao início
                    </Link>
                    <div className="flex items-center gap-4 text-xs text-slate-400 dark:text-zinc-600">
                        <Link to="/privacidade" className="hover:text-brand-400 transition-colors">Política de Privacidade</Link>
                        <span>|</span>
                        <Link to="/seus-direitos" className="hover:text-brand-400 transition-colors">Seus Direitos</Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
