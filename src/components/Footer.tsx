import { Link } from 'react-router-dom';
import { Car, Facebook, Instagram, Twitter, Youtube, Mail, Phone } from 'lucide-react';

export default function Footer() {
    return (
        <footer className="bg-slate-900 text-slate-300">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-10">
                    {/* Brand */}
                    <div className="md:col-span-1">
                        <Link to="/" className="flex items-center gap-2 mb-4">
                            <div className="w-9 h-9 bg-brand-600 rounded-xl flex items-center justify-center">
                                <Car className="w-5 h-5 text-white" />
                            </div>
                            <span className="text-xl font-bold">
                                <span className="text-brand-400">Sul</span>
                                <span className="text-white">Motors</span>
                            </span>
                        </Link>
                        <p className="text-sm text-slate-400 leading-relaxed">
                            O melhor marketplace de carros do Brasil. Compre e venda com segurança e confiança.
                        </p>
                    </div>

                    {/* Estoque */}
                    <div>
                        <h4 className="text-white font-semibold mb-4">Estoque</h4>
                        <ul className="space-y-3 text-sm">
                            <li><Link to="/estoque" className="hover:text-white transition-colors">Todos os Carros</Link></li>
                            <li><Link to="/estoque?tipo=seminovos" className="hover:text-white transition-colors">Seminovos</Link></li>
                            <li><Link to="/estoque?tipo=novos" className="hover:text-white transition-colors">0 KM</Link></li>
                            <li><Link to="/estoque?tipo=suv" className="hover:text-white transition-colors">SUVs</Link></li>
                        </ul>
                    </div>

                    {/* Atendimento */}
                    <div>
                        <h4 className="text-white font-semibold mb-4">Atendimento</h4>
                        <ul className="space-y-3 text-sm">
                            <li className="flex items-center gap-2">
                                <Mail className="w-4 h-4 text-brand-400" />
                                contato@sulmotors.com.br
                            </li>
                            <li className="flex items-center gap-2">
                                <Phone className="w-4 h-4 text-brand-400" />
                                (51) 99999-9999
                            </li>
                        </ul>
                    </div>

                    {/* Social */}
                    <div>
                        <h4 className="text-white font-semibold mb-4">Siga-nos</h4>
                        <div className="flex gap-3">
                            {[
                                { icon: Facebook, label: 'Facebook' },
                                { icon: Instagram, label: 'Instagram' },
                                { icon: Twitter, label: 'Twitter' },
                                { icon: Youtube, label: 'Youtube' },
                            ].map(({ icon: Icon, label }) => (
                                <a
                                    key={label}
                                    href="#"
                                    aria-label={label}
                                    className="w-10 h-10 bg-slate-800 hover:bg-brand-600 rounded-xl flex items-center justify-center transition-colors"
                                >
                                    <Icon className="w-5 h-5" />
                                </a>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="mt-12 pt-8 border-t border-slate-800 text-center text-sm text-slate-500">
                    © 2026 SulMotors. Todos os direitos reservados.
                </div>
            </div>
        </footer>
    );
}
