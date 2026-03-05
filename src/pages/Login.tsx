import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Mail, Lock, Loader2, User, Phone, Car, ArrowRight, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';

export default function Login() {
    const navigate = useNavigate();
    const { signInWithEmail, signUp } = useAuth();
    const [isLogin, setIsLogin] = useState(true);
    const [loading, setLoading] = useState(false);
    const [showPass, setShowPass] = useState(false);
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
                if (!form.nome.trim()) { toast.error('Por favor, informe seu nome.'); setLoading(false); return; }
                await signUp(form.email, form.password, { full_name: form.nome, phone: form.telefone });
                toast.success('Conta criada! Verifique seu email.');
                navigate('/');
            }
        } catch (error: any) {
            toast.error(error.message || 'Ocorreu um erro.');
        } finally { setLoading(false); }
    };

    const iClass = "w-full pl-10 pr-4 py-3.5 bg-slate-100 dark:bg-zinc-900 border border-slate-200 dark:border-white/10 focus:border-brand-400/60 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-zinc-600 text-sm outline-none transition-all";
    const lClass = "block text-xs font-bold text-slate-500 dark:text-zinc-500 uppercase tracking-wider mb-2";
    const iconClass = "absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-zinc-600";

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 flex transition-colors duration-300">
            {/* Left panel */}
            <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden">
                <img src="https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=1000&q=80" alt="Car" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-r from-zinc-950/80 via-zinc-950/40 to-zinc-950/10" />
                <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-transparent to-zinc-950/40" />
                <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'linear-gradient(rgba(0,212,255,0.07) 1px, transparent 1px), linear-gradient(90deg, rgba(0,212,255,0.07) 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
                <div className="absolute bottom-12 left-12 right-12">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-10 h-10 bg-gradient-to-br from-brand-400 to-brand-600 rounded-xl flex items-center justify-center">
                            <Car className="w-5 h-5 text-zinc-950" />
                        </div>
                        <span className="text-2xl font-black tracking-tight">
                            <span className="text-brand-400">Sul</span><span className="text-white">Motors</span>
                        </span>
                    </div>
                    <h2 className="text-3xl font-black text-white leading-tight mb-3">
                        O marketplace automotivo<span className="text-brand-400"> mais moderno</span> do Brasil.
                    </h2>
                    <p className="text-zinc-400 text-sm leading-relaxed">Compre e venda veículos com segurança, transparência e a melhor tecnologia.</p>
                </div>
            </div>

            {/* Right panel */}
            <div className="w-full lg:w-1/2 flex items-center justify-center px-6 py-12">
                <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.4 }} className="w-full max-w-md">
                    <Link to="/" className="flex items-center gap-2.5 mb-10 lg:hidden">
                        <div className="w-9 h-9 bg-gradient-to-br from-brand-400 to-brand-600 rounded-xl flex items-center justify-center">
                            <Car className="w-5 h-5 text-zinc-950" />
                        </div>
                        <span className="text-xl font-black tracking-tight">
                            <span className="text-brand-400">Sul</span><span className="text-slate-900 dark:text-white">Motors</span>
                        </span>
                    </Link>

                    {/* Toggle */}
                    <div className="flex items-center gap-2 p-1 bg-slate-100 dark:bg-zinc-900 border border-slate-200 dark:border-white/8 rounded-xl mb-8">
                        {[{ label: 'Entrar', val: true }, { label: 'Cadastrar', val: false }].map(({ label, val }) => (
                            <button key={label} onClick={() => setIsLogin(val)}
                                className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-all ${isLogin === val ? 'bg-brand-400 text-zinc-950 shadow-lg' : 'text-slate-500 dark:text-zinc-500 hover:text-slate-900 dark:hover:text-white'}`}>
                                {label}
                            </button>
                        ))}
                    </div>

                    <div className="mb-8">
                        <h1 className="text-3xl font-black text-slate-900 dark:text-white mb-2">
                            {isLogin ? 'Bem-vindo de volta' : 'Crie sua conta'}
                        </h1>
                        <p className="text-slate-500 dark:text-zinc-500 text-sm">
                            {isLogin ? 'Entre para gerenciar seus anúncios e favoritos' : 'Comece a anunciar seus veículos gratuitamente'}
                        </p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        {!isLogin && (
                            <>
                                <div>
                                    <label className={lClass}>Nome completo *</label>
                                    <div className="relative">
                                        <User className={iconClass} />
                                        <input type="text" required value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} className={iClass} placeholder="Seu nome completo" />
                                    </div>
                                </div>
                                <div>
                                    <label className={lClass}>Telefone</label>
                                    <div className="relative">
                                        <Phone className={iconClass} />
                                        <input type="tel" value={form.telefone} onChange={e => setForm({ ...form, telefone: e.target.value })} className={iClass} placeholder="(00) 00000-0000" />
                                    </div>
                                </div>
                            </>
                        )}
                        <div>
                            <label className={lClass}>Email *</label>
                            <div className="relative">
                                <Mail className={iconClass} />
                                <input type="email" required value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className={iClass} placeholder="seu@email.com" />
                            </div>
                        </div>
                        <div>
                            <label className={lClass}>Senha *</label>
                            <div className="relative">
                                <Lock className={iconClass} />
                                <input type={showPass ? 'text' : 'password'} required value={form.password} onChange={e => setForm({ ...form, password: e.target.value })}
                                    className="w-full pl-10 pr-12 py-3.5 bg-slate-100 dark:bg-zinc-900 border border-slate-200 dark:border-white/10 focus:border-brand-400/60 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-zinc-600 text-sm outline-none transition-all"
                                    placeholder="••••••••" minLength={6} />
                                <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-zinc-600 hover:text-slate-700 dark:hover:text-zinc-400 transition-colors">
                                    {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                            </div>
                        </div>
                        <button type="submit" disabled={loading}
                            className="w-full flex items-center justify-center gap-2.5 py-4 bg-brand-400 hover:bg-brand-300 text-zinc-950 font-black rounded-xl transition-all hover:shadow-glow disabled:opacity-60 mt-2">
                            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <>{isLogin ? 'Entrar na conta' : 'Criar conta grátis'}<ArrowRight className="w-5 h-5" /></>}
                        </button>
                    </form>

                    <p className="mt-6 text-center text-sm text-slate-500 dark:text-zinc-600">
                        {isLogin ? 'Não tem uma conta?' : 'Já tem uma conta?'}{' '}
                        <button onClick={() => setIsLogin(!isLogin)} className="text-brand-500 dark:text-brand-400 font-bold hover:text-brand-600 dark:hover:text-brand-300 transition-colors">
                            {isLogin ? 'Cadastre-se grátis' : 'Fazer login'}
                        </button>
                    </p>
                </motion.div>
            </div>
        </div>
    );
}
