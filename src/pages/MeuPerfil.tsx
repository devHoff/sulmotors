import { useState, useEffect, useRef } from 'react';
import { User, Mail, Phone, Camera, Save, Loader2, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import CropModal from '../components/CropModal';
import { AnimatePresence, motion } from 'framer-motion';

export default function MeuPerfil() {
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [profile, setProfile] = useState({ full_name: '', email: '', phone: '', avatar_url: '' });
    const [selectedImage, setSelectedImage] = useState<string | null>(null);
    const [showCropModal, setShowCropModal] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => { if (user) fetchProfile(); }, [user]);

    const fetchProfile = async () => {
        try {
            const { data } = await supabase.from('profiles').select('*').eq('id', user?.id).single();
            setProfile({
                full_name: data?.full_name || user?.user_metadata?.full_name || '',
                email: user?.email || '',
                phone: data?.phone || user?.user_metadata?.phone || '',
                avatar_url: data?.avatar_url || '',
            });
        } catch { } finally { setLoading(false); }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            await supabase.from('profiles').upsert({ id: user?.id, full_name: profile.full_name, phone: profile.phone, updated_at: new Date() });
            await supabase.auth.updateUser({ data: { full_name: profile.full_name, phone: profile.phone } });
            toast.success('Perfil atualizado com sucesso!');
        } catch { toast.error('Erro ao atualizar perfil.'); } finally { setSaving(false); }
    };

    const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files?.length) return;
        const reader = new FileReader();
        reader.addEventListener('load', () => { setSelectedImage(reader.result as string); setShowCropModal(true); });
        reader.readAsDataURL(e.target.files[0]);
    };

    const handleCropComplete = async (blob: Blob) => {
        setShowCropModal(false);
        const fileName = `${user?.id}-${Math.random()}.jpg`;
        const loadingToast = toast.loading('Enviando foto...');
        try {
            const { error } = await supabase.storage.from('avatars').upload(fileName, blob, { contentType: 'image/jpeg', upsert: true });
            if (error) throw error;
            const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(fileName);
            await supabase.from('profiles').upsert({ id: user?.id, avatar_url: publicUrl, updated_at: new Date() });
            await supabase.auth.updateUser({ data: { avatar_url: publicUrl } });
            setProfile(p => ({ ...p, avatar_url: publicUrl }));
            toast.success('Foto atualizada!');
        } catch (e: any) { toast.error(`Erro: ${e.message}`); } finally { toast.dismiss(loadingToast); setSelectedImage(null); }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
                <div className="w-12 h-12 rounded-full border-2 border-brand-400/20 border-t-brand-400 animate-spin" />
            </div>
        );
    }

    const inputClass = "w-full pl-10 pr-4 py-3.5 bg-zinc-800 border border-white/10 hover:border-white/20 focus:border-brand-400/60 rounded-xl text-sm text-white placeholder-zinc-500 outline-none transition-all";

    return (
        <div className="bg-zinc-950 min-h-screen py-12">
            <div className="max-w-2xl mx-auto px-4 sm:px-6">
                <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
                    <Link to="/" className="inline-flex items-center gap-2 text-zinc-500 hover:text-brand-400 mb-8 transition-colors text-sm">
                        <ArrowLeft className="w-4 h-4" />
                        Voltar para o início
                    </Link>
                    <h1 className="text-4xl font-black text-white tracking-tight mb-1">Meu Perfil</h1>
                    <p className="text-zinc-500 text-sm mb-10">Gerencie suas informações pessoais</p>
                </motion.div>

                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
                    className="bg-zinc-900 border border-white/8 rounded-2xl overflow-hidden">
                    <form onSubmit={handleSave} className="p-8 space-y-8">
                        {/* Avatar */}
                        <div className="flex flex-col items-center">
                            <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                                <div className="w-28 h-28 rounded-full border-4 border-slate-200 dark:border-zinc-700 overflow-hidden bg-slate-100 dark:bg-zinc-800 flex items-center justify-center">
                                    {profile.avatar_url
                                        ? <img src={profile.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                                        : <User className="w-12 h-12 text-slate-300 dark:text-zinc-600" />
                                    }
                                    <div className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                        <Camera className="w-7 h-7 text-white" />
                                    </div>
                                </div>
                                <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleAvatarChange} />
                            </div>
                            <button type="button" onClick={() => fileInputRef.current?.click()} className="mt-3 text-sm font-bold text-brand-400 hover:text-brand-300 transition-colors">
                                Alterar foto
                            </button>
                        </div>

                        {/* Fields */}
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider mb-2">Nome Completo</label>
                                <div className="relative">
                                    <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-zinc-600" />
                                    <input type="text" value={profile.full_name} onChange={e => setProfile({ ...profile, full_name: e.target.value })} className={inputClass} placeholder="Seu nome" />
                                </div>
                            </div>
                            <div className="grid md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider mb-2">Telefone</label>
                                    <div className="relative">
                                        <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-zinc-600" />
                                        <input type="tel" value={profile.phone} onChange={e => setProfile({ ...profile, phone: e.target.value })} className={inputClass} placeholder="(00) 00000-0000" />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider mb-2">Email <span className="text-slate-300 dark:text-zinc-700 normal-case font-normal">(não editável)</span></label>
                                    <div className="relative">
                                        <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300 dark:text-zinc-700" />
                                        <input type="email" value={profile.email} disabled className="w-full pl-10 pr-4 py-3.5 bg-slate-100 dark:bg-zinc-800/50 border border-slate-200 dark:border-white/5 rounded-xl text-sm text-slate-400 dark:text-zinc-600 outline-none cursor-not-allowed" />
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-end pt-4 border-t border-slate-100 dark:border-white/5">
                            <button type="submit" disabled={saving}
                                className="flex items-center gap-2.5 px-6 py-3 bg-brand-400 hover:bg-brand-300 text-zinc-950 font-black rounded-xl transition-all hover:shadow-glow disabled:opacity-50">
                                {saving ? <><Loader2 className="w-5 h-5 animate-spin" />Salvando...</> : <><Save className="w-5 h-5" />Salvar Alterações</>}
                            </button>
                        </div>
                    </form>
                </motion.div>
            </div>

            <AnimatePresence>
                {showCropModal && selectedImage && (
                    <CropModal image={selectedImage} onCropComplete={handleCropComplete}
                        onCancel={() => { setShowCropModal(false); setSelectedImage(null); }} />
                )}
            </AnimatePresence>
        </div>
    );
}
