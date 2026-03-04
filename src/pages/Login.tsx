import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Mail, Lock, Loader2, User, Phone } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

export default function Login() {
    const navigate = useNavigate();
    const { signInWithEmail, signUp } = useAuth();
    const [isLogin, setIsLogin] = useState(true);
    const [loading, setLoading] = useState(false);
    const [form, setForm] = useState({ email: '', password: '', nome: '', telefone: '' });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            if (isLogin) {
                await signInWithEmail(form.email, form.password);
                toast.success('Login realizado com sucesso!');
                navigate('/');
            } else {
                if (!form.nome.trim()) {
                    toast.error('Por favor, informe seu nome.');
                    setLoading(false);
                    return;
                }
                await signUp(form.email, form.password, {
                    full_name: form.nome,
                    phone: form.telefone,
                });

                toast.success('Conta criada com sucesso! Verifique seu email para confirmar.');
                navigate('/');
            }
        } catch (error: any) {
            console.error(error);
            toast.error(error.message || 'Ocorreu um erro.');
        } finally {
            setLoading(false);
        }
    };

    const inputClass = "w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none text-sm";

    return (
        <div className="min-h-[80vh] flex items-center justify-center px-4">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-100 p-8"
            >
                <div className="text-center mb-8">
                    <h1 className="text-2xl font-bold text-slate-900">
                        {isLogin ? 'Bem-vindo de volta' : 'Crie sua conta'}
                    </h1>
                    <p className="text-slate-500 mt-2">
                        {isLogin ? 'Entre para gerenciar seus anúncios' : 'Comece a anunciar seus veículos hoje'}
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* Name & Phone — only on sign-up */}
                    {!isLogin && (
                        <>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Nome completo *</label>
                                <div className="relative">
                                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                                    <input
                                        type="text"
                                        required
                                        value={form.nome}
                                        onChange={e => setForm({ ...form, nome: e.target.value })}
                                        className={inputClass}
                                        placeholder="Seu nome completo"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Telefone</label>
                                <div className="relative">
                                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                                    <input
                                        type="tel"
                                        value={form.telefone}
                                        onChange={e => setForm({ ...form, telefone: e.target.value })}
                                        className={inputClass}
                                        placeholder="(00) 00000-0000"
                                    />
                                </div>
                            </div>
                        </>
                    )}

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Email *</label>
                        <div className="relative">
                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                            <input
                                type="email"
                                required
                                value={form.email}
                                onChange={e => setForm({ ...form, email: e.target.value })}
                                className={inputClass}
                                placeholder="seu@email.com"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Senha *</label>
                        <div className="relative">
                            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                            <input
                                type="password"
                                required
                                value={form.password}
                                onChange={e => setForm({ ...form, password: e.target.value })}
                                className={inputClass}
                                placeholder="••••••••"
                                minLength={6}
                            />
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-3 bg-brand-600 text-white font-bold rounded-xl hover:bg-brand-700 transition-all hover:shadow-lg disabled:opacity-70 flex items-center justify-center gap-2"
                    >
                        {loading && <Loader2 className="w-5 h-5 animate-spin" />}
                        {isLogin ? 'Entrar' : 'Criar Conta'}
                    </button>
                </form>

                <div className="mt-6 text-center text-sm text-slate-600">
                    <button
                        onClick={() => setIsLogin(!isLogin)}
                        className="text-brand-600 font-semibold hover:underline"
                    >
                        {isLogin ? 'Não tem uma conta? Cadastre-se' : 'Já tem uma conta? Entre'}
                    </button>
                </div>
            </motion.div>
        </div>
    );
}
