import { useState, useEffect, useRef } from 'react';
import { User, Mail, Phone, Camera, Save, Loader2, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import CropModal from '../components/CropModal';
import { AnimatePresence } from 'framer-motion';


export default function MeuPerfil() {
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [profile, setProfile] = useState({
        full_name: '',
        email: '',
        phone: '',
        avatar_url: ''
    });

    const [selectedImage, setSelectedImage] = useState<string | null>(null);
    const [showCropModal, setShowCropModal] = useState(false);

    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (user) {
            fetchProfile();
        }
    }, [user]);

    const fetchProfile = async () => {
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', user?.id)
                .single();

            if (error && error.code !== 'PGRST116') throw error; // Allow 406 (no rows)

            if (data) {
                setProfile({
                    full_name: data.full_name || '',
                    email: user?.email || '',
                    phone: data.phone || '',
                    avatar_url: data.avatar_url || ''
                });
            } else {
                // If no profile exists yet, use auth data
                setProfile({
                    full_name: user?.user_metadata?.full_name || '',
                    email: user?.email || '',
                    phone: user?.user_metadata?.phone || '',
                    avatar_url: ''
                });
            }
        } catch (error: any) {
            console.error('Erro ao buscar perfil:', error);
            toast.error('Erro ao carregar perfil.');
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);

        const newProfile = {
            id: user?.id,
            full_name: profile.full_name,
            phone: profile.phone,
            updated_at: new Date(),
        };

        try {
            // 1. Update Profile Table
            const { error: profileError } = await supabase
                .from('profiles')
                .upsert(newProfile);

            if (profileError) throw profileError;

            // 2. Sync with Auth Metadata
            const { error: authError } = await supabase.auth.updateUser({
                data: {
                    full_name: profile.full_name,
                    phone: profile.phone
                }
            });

            if (authError) throw authError;

            toast.success('Perfil atualizado com sucesso!');
        } catch (error: any) {
            console.error('Erro ao salvar:', error);
            toast.error('Erro ao atualizar perfil.');
        } finally {
            setSaving(false);
        }
    };

    const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || e.target.files.length === 0) return;

        const file = e.target.files[0];
        const reader = new FileReader();
        reader.addEventListener('load', () => {
            setSelectedImage(reader.result as string);
            setShowCropModal(true);
        });
        reader.readAsDataURL(file);
    };

    const handleCropComplete = async (croppedImageBlob: Blob) => {
        setShowCropModal(false);
        const fileExt = 'jpg';
        const fileName = `${user?.id}-${Math.floor(Math.random() * 1000000)}.${fileExt}`;
        const filePath = `${fileName}`;
        const loadingToast = toast.loading('Enviando foto...');

        try {
            const { error: uploadError } = await supabase.storage
                .from('avatars')
                .upload(filePath, croppedImageBlob, {
                    contentType: 'image/jpeg',
                    upsert: true
                });

            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage
                .from('avatars')
                .getPublicUrl(filePath);

            const { error: updateError } = await supabase
                .from('profiles')
                .upsert({
                    id: user?.id,
                    avatar_url: publicUrl,
                    updated_at: new Date(),
                });

            if (updateError) throw updateError;

            // Sync avatar to auth metadata
            await supabase.auth.updateUser({
                data: { avatar_url: publicUrl }
            });

            setProfile(prev => ({ ...prev, avatar_url: publicUrl }));
            toast.success('Foto de perfil atualizada!');
        } catch (error: any) {
            console.error('Erro ao enviar avatar:', error);
            toast.error(`Erro ao enviar foto: ${error.message || 'Erro inesperado.'}`);
        } finally {
            toast.dismiss(loadingToast);
            setSelectedImage(null);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-brand-600" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col">

            <main className="flex-grow max-w-4xl w-full mx-auto px-4 py-12">
                <div className="mb-8">
                    <Link to="/" className="inline-flex items-center gap-2 text-slate-500 hover:text-brand-600 mb-4 transition-colors">
                        <ArrowLeft className="w-4 h-4" />
                        Voltar para o início
                    </Link>
                    <h1 className="text-3xl font-bold text-slate-900">Meu Perfil</h1>
                    <p className="text-slate-500 mt-2">Gerencie suas informações pessoais</p>
                </div>

                <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                    <form onSubmit={handleSave} className="p-8 space-y-8">

                        {/* Avatar Section */}
                        <div className="flex flex-col items-center">
                            <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                                <div className="w-32 h-32 rounded-full border-4 border-slate-100 overflow-hidden bg-slate-100 flex items-center justify-center relative">
                                    {profile.avatar_url ? (
                                        <img src={profile.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                                    ) : (
                                        <User className="w-12 h-12 text-slate-300" />
                                    )}
                                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                        <Camera className="w-8 h-8 text-white" />
                                    </div>
                                </div>
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    className="hidden"
                                    accept="image/*"
                                    onChange={handleAvatarChange}
                                />
                                <button
                                    type="button"
                                    onClick={() => fileInputRef.current?.click()}
                                    className="mt-3 text-sm font-semibold text-brand-600 hover:text-brand-700"
                                >
                                    Alterar foto
                                </button>
                            </div>
                        </div>

                        <div className="grid md:grid-cols-2 gap-6">
                            <div className="md:col-span-2">
                                <label className="block text-sm font-medium text-slate-700 mb-1">Nome Completo</label>
                                <div className="relative">
                                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                                    <input
                                        type="text"
                                        value={profile.full_name}
                                        onChange={e => setProfile({ ...profile, full_name: e.target.value })}
                                        className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none text-sm"
                                        placeholder="Seu nome"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Telefone</label>
                                <div className="relative">
                                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                                    <input
                                        type="tel"
                                        value={profile.phone}
                                        onChange={e => setProfile({ ...profile, phone: e.target.value })}
                                        className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none text-sm"
                                        placeholder="(00) 00000-0000"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Email <span className="text-xs font-normal text-slate-400">(Não editável)</span></label>
                                <div className="relative">
                                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                                    <input
                                        type="email"
                                        value={profile.email}
                                        disabled
                                        className="w-full pl-10 pr-4 py-3 bg-slate-100 border border-slate-200 rounded-xl text-slate-500 text-sm cursor-not-allowed"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-end pt-6 border-t border-slate-100">
                            <button
                                type="submit"
                                disabled={saving}
                                className="px-6 py-3 bg-brand-600 text-white font-bold rounded-xl hover:bg-brand-700 transition-all hover:shadow-lg disabled:opacity-70 flex items-center gap-2"
                            >
                                {saving ? (
                                    <>
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                        Salvando...
                                    </>
                                ) : (
                                    <>
                                        <Save className="w-5 h-5" />
                                        Salvar Alterações
                                    </>
                                )}
                            </button>
                        </div>

                    </form>
                </div>
            </main>

            <AnimatePresence>
                {showCropModal && selectedImage && (
                    <CropModal
                        image={selectedImage}
                        onCropComplete={handleCropComplete}
                        onCancel={() => {
                            setShowCropModal(false);
                            setSelectedImage(null);
                        }}
                    />
                )}
            </AnimatePresence>
        </div>
    );
}
