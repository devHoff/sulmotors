import { motion } from 'framer-motion';
import { ShieldCheck, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

const sections = [
    {
        title: '1. Quem somos e como nos contatar',
        content: `SulMotors é uma plataforma de marketplace automotivo operada no Brasil. Somos o controlador dos dados pessoais coletados em nossa Plataforma nos termos da Lei Geral de Proteção de Dados (LGPD – Lei nº 13.709/2018). Contato do encarregado (DPO): suporte@sulmotors.com.br — Porto Alegre, RS, Brasil.`,
    },
    {
        title: '2. Quais dados coletamos',
        content: `Coletamos as seguintes categorias de dados pessoais: (a) Dados de cadastro: nome completo, endereço de e-mail, número de telefone; (b) Dados de perfil: foto de perfil (opcional), informações inseridas pelo usuário; (c) Dados de anúncios: informações sobre veículos anunciados, imagens, descrições e preços; (d) Dados de pagamento: processados integralmente pelo Mercado Pago — o SulMotors não armazena dados de cartão de crédito ou chaves PIX; (e) Dados de uso: endereço IP, tipo de navegador, páginas visitadas, tempo de sessão, cliques e interações na Plataforma; (f) Cookies e tecnologias similares: conforme descrito na seção 5 abaixo.`,
    },
    {
        title: '3. Como usamos seus dados',
        content: `Utilizamos seus dados pessoais para: (a) Prestação do serviço: criar e gerenciar sua conta, exibir e gerenciar seus anúncios, processar pagamentos; (b) Comunicação: enviar notificações sobre sua conta, anúncios e transações; (c) Segurança: prevenir fraudes, detectar atividades suspeitas e proteger a integridade da Plataforma; (d) Melhoria do serviço: analisar padrões de uso para melhorar funcionalidades e experiência do usuário; (e) Cumprimento legal: cumprir obrigações legais e regulatórias aplicáveis.`,
    },
    {
        title: '4. Base legal para o tratamento (LGPD)',
        content: `O tratamento de seus dados pessoais é fundamentado nas seguintes bases legais previstas na LGPD: (a) Execução de contrato (Art. 7º, V): necessário para prestar os serviços da Plataforma; (b) Consentimento (Art. 7º, I): para comunicações de marketing e cookies não essenciais, mediante autorização prévia; (c) Legítimo interesse (Art. 7º, IX): para segurança, prevenção de fraudes e melhoria dos serviços; (d) Cumprimento de obrigação legal ou regulatória (Art. 7º, II): quando exigido por lei.`,
    },
    {
        title: '5. Cookies e tecnologias de rastreamento',
        content: `Utilizamos cookies e tecnologias similares para: (a) Cookies essenciais: necessários para o funcionamento básico da Plataforma (autenticação, sessão); (b) Cookies analíticos: coleta de dados agregados e anônimos sobre o uso da Plataforma para melhoria do serviço; (c) Cookies de preferência: armazenamento de suas preferências de idioma e tema. Você pode gerenciar e desativar cookies por meio das configurações do seu navegador, sendo que a desativação de cookies essenciais pode prejudicar o funcionamento da Plataforma.`,
    },
    {
        title: '6. Compartilhamento de dados',
        content: `Seus dados pessoais poderão ser compartilhados com: (a) Mercado Pago: para processamento de pagamentos, sujeito à Política de Privacidade do Mercado Pago; (b) Supabase: provedor de infraestrutura de banco de dados e autenticação, operando como operador de dados; (c) Autoridades competentes: quando exigido por lei, ordem judicial ou regulatória; (d) Compradores ou vendedores: somente as informações necessárias para viabilizar a transação (telefone de contato). Não vendemos, alugamos ou comercializamos seus dados pessoais com terceiros para fins publicitários.`,
    },
    {
        title: '7. Armazenamento e segurança',
        content: `Seus dados são armazenados em servidores seguros providos pela Supabase, com criptografia em trânsito (TLS/SSL) e em repouso. Adotamos medidas técnicas e organizacionais adequadas para proteger seus dados contra acesso não autorizado, alteração, divulgação ou destruição, incluindo: controle de acesso por perfil, autenticação de dois fatores para acesso administrativo, monitoramento de segurança e auditorias periódicas. Em caso de incidente de segurança que possa causar risco ou dano a titulares, notificaremos a Autoridade Nacional de Proteção de Dados (ANPD) e os titulares afetados nos prazos previstos pela LGPD.`,
    },
    {
        title: '8. Retenção dos dados',
        content: `Mantemos seus dados pessoais pelo período necessário para: (a) prestação dos serviços enquanto sua conta estiver ativa; (b) cumprimento de obrigações legais (mínimo de 5 anos para registros fiscais e contratuais); (c) resolução de disputas e exercício de direitos legais. Após o encerramento da conta, os dados são anonimizados ou excluídos em até 90 dias, exceto quando houver obrigação legal de retenção.`,
    },
    {
        title: '9. Transferência internacional de dados',
        content: `Seus dados podem ser transferidos e armazenados fora do Brasil em virtude da utilização de serviços de terceiros (como Supabase, Mercado Pago). Garantimos que estas transferências são realizadas em conformidade com a LGPD, com provedores que oferecem nível adequado de proteção de dados ou mediante cláusulas contratuais específicas.`,
    },
    {
        title: '10. Menores de idade',
        content: `A Plataforma não é destinada a pessoas com menos de 18 anos. Não coletamos intencionalmente dados de menores. Se tomarmos conhecimento de que coletamos dados de um menor sem consentimento dos responsáveis legais, os excluiremos imediatamente.`,
    },
    {
        title: '11. Alterações nesta Política',
        content: `Podemos atualizar esta Política de Privacidade periodicamente. Notificaremos sobre alterações significativas por e-mail ou através de aviso na Plataforma. O uso continuado da Plataforma após a publicação das alterações constitui aceitação das mudanças.`,
    },
    {
        title: '12. Contato e encarregado (DPO)',
        content: `Para exercer seus direitos ou tirar dúvidas sobre o tratamento de seus dados, entre em contato com nosso encarregado de proteção de dados: suporte@sulmotors.com.br. Responderemos em até 15 dias úteis, conforme prazo previsto na LGPD.`,
    },
];

export default function Privacidade() {
    return (
        <div className="bg-slate-50 dark:bg-zinc-950 min-h-screen transition-colors duration-300">
            {/* Hero */}
            <section className="relative py-20 overflow-hidden border-b border-slate-200 dark:border-white/5">
                <div className="absolute inset-0 opacity-20 pointer-events-none"
                    style={{ backgroundImage: 'linear-gradient(rgba(0,212,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(0,212,255,0.04) 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
                <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center relative z-10">
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                        <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-brand-400/10 border border-brand-400/30 rounded-full mb-5">
                            <ShieldCheck className="w-3.5 h-3.5 text-brand-400" strokeWidth={1.5} />
                            <span className="text-xs font-bold text-brand-400 uppercase tracking-widest">LGPD — Lei nº 13.709/2018</span>
                        </div>
                        <h1 className="text-4xl md:text-5xl font-black text-slate-900 dark:text-white tracking-tight mb-4">
                            Política de Privacidade
                        </h1>
                        <p className="text-slate-500 dark:text-zinc-400 text-sm leading-relaxed max-w-xl mx-auto">
                            Última atualização: março de 2026. Saiba como coletamos, usamos e protegemos seus dados pessoais.
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
                        <Link to="/termos" className="hover:text-brand-400 transition-colors">Termos de Uso</Link>
                        <span>|</span>
                        <Link to="/seus-direitos" className="hover:text-brand-400 transition-colors">Seus Direitos</Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
