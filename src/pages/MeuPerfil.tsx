import { useState, useEffect, useRef } from 'react';
import {
    User, Mail, Phone, Camera, Save, Loader2, ArrowLeft,
    Shield, Star, CheckCircle2, AlertTriangle, Bell, Heart,
    Eye, Car, MapPin, Calendar, CreditCard, Lock, Smartphone,
    ChevronDown, X, BadgeCheck, Settings, Zap
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from '../utils/toast';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import CropModal from '../components/CropModal';
import { AnimatePresence, motion } from 'framer-motion';

type TabId = 'dados' | 'endereco' | 'preferencias' | 'seguranca' | 'atividade' | 'verificacao';

const VEHICLE_TYPES = ['SUV', 'Sedan', 'Hatch', 'Pickup', 'Esportivo', 'Minivan', 'Conversível'];
const BRAND_PREFS = ['Volkswagen', 'Chevrolet', 'Fiat', 'Ford', 'Toyota', 'Honda', 'Hyundai', 'BMW', 'Mercedes-Benz', 'Audi'];
const STATES_BR = [
    'AC','AL','AP','AM','BA','CE','DF','ES','GO','MA',
    'MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN',
    'RS','RO','RR','SC','SP','SE','TO',
];

function cpfMask(v: string) {
    return v.replace(/\D/g, '').slice(0, 11)
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
}
function phoneMask(v: string) {
    return v.replace(/\D/g, '').slice(0, 11)
        .replace(/(\d{2})(\d)/, '($1) $2')
        .replace(/(\d{5})(\d{1,4})$/, '$1-$2');
}
function cepMask(v: string) {
    return v.replace(/\D/g, '').slice(0, 8).replace(/(\d{5})(\d{1,3})$/, '$1-$2');
}

/** Mask dd/mm/aaaa as the user types */
function dateMask(v: string): string {
    const digits = v.replace(/\D/g, '').slice(0, 8);
    if (digits.length <= 2) return digits;
    if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
    return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

/** Returns true when the date string (dd/mm/aaaa) represents age >= 18 */
function isAtLeast18(dateStr: string): boolean {
    const parts = dateStr.split('/');
    if (parts.length !== 3 || parts[2].length !== 4) return false;
    const [dd, mm, yyyy] = parts.map(Number);
    if (!dd || !mm || !yyyy) return false;
    const dob = new Date(yyyy, mm - 1, dd);
    const today = new Date();
    const age18 = new Date(dob.getFullYear() + 18, dob.getMonth(), dob.getDate());
    return today >= age18;
}

/** Convert stored ISO date (yyyy-mm-dd) → display (dd/mm/aaaa) */
function isoToDMY(iso: string): string {
    if (!iso) return '';
    const [y, m, d] = iso.split('-');
    if (!y || !m || !d) return iso; // already masked or empty
    return `${d}/${m}/${y}`;
}

/** Convert display (dd/mm/aaaa) → ISO (yyyy-mm-dd) for storage */
function dmyToISO(dmy: string): string {
    const parts = dmy.split('/');
    if (parts.length !== 3 || parts[2].length !== 4) return '';
    const [dd, mm, yyyy] = parts;
    return `${yyyy}-${mm.padStart(2,'0')}-${dd.padStart(2,'0')}`;
}

function validateCPF(cpf: string) {
    const n = cpf.replace(/\D/g, '');
    if (n.length !== 11 || /^(\d)\1{10}$/.test(n)) return false;
    let sum = 0;
    for (let i = 0; i < 9; i++) sum += parseInt(n[i]) * (10 - i);
    let d1 = (sum * 10) % 11; if (d1 === 10 || d1 === 11) d1 = 0;
    if (d1 !== parseInt(n[9])) return false;
    sum = 0;
    for (let i = 0; i < 10; i++) sum += parseInt(n[i]) * (11 - i);
    let d2 = (sum * 10) % 11; if (d2 === 10 || d2 === 11) d2 = 0;
    return d2 === parseInt(n[10]);
}

export default function MeuPerfil() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState<TabId>('dados');
    const [loading, setLoading]     = useState(true);
    const [saving, setSaving]       = useState(false);

    // Dados pessoais
    const [profile, setProfile] = useState({
        full_name: '', email: '', phone: '', avatar_url: '',
        cpf: '', data_nascimento: '', data_nascimento_display: '', genero: '',
    });

    // Endereço
    const [address, setAddress] = useState({
        cep: '', estado: '', cidade: '', exibir_telefone: false,
    });

    // Preferências
    const [prefs, setPrefs] = useState({
        orcamento_max: '',
        marcas_preferidas: [] as string[],
        tipos_veiculo: [] as string[],
        alertas_email: true,
        alertas_push: false,
        queda_preco: true,
    });

    // Verificação / segurança
    const [cpfValid, setCpfValid] = useState<null | boolean>(null);
    const [isVerified, setIsVerified] = useState(false);
    const [verificationStatus, setVerificationStatus] = useState<'none' | 'pending' | 'approved' | 'rejected'>('none');
    const [docFile, setDocFile] = useState<File | null>(null);
    const [selfieFile, setSelfieFile] = useState<File | null>(null);
    const [docPreview, setDocPreview] = useState<string | null>(null);
    const [selfiePreview, setSelfiePreview] = useState<string | null>(null);
    const [uploadingVerif, setUploadingVerif] = useState(false);
    const docInputRef = useRef<HTMLInputElement>(null);
    const selfieInputRef = useRef<HTMLInputElement>(null);

    // Atividade
    const [activity] = useState({
        views: 12, favorites: 5, proposals: 2,
    });

    // Image crop
    const [selectedImage, setSelectedImage] = useState<string | null>(null);
    const [showCropModal, setShowCropModal]  = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleDocChange = (e: React.ChangeEvent<HTMLInputElement>, type: 'doc' | 'selfie') => {
        const file = e.target.files?.[0];
        if (!file) return;
        const url = URL.createObjectURL(file);
        if (type === 'doc') { setDocFile(file); setDocPreview(url); }
        else { setSelfieFile(file); setSelfiePreview(url); }
    };

    const handleSubmitVerification = async () => {
        if (!docFile || !selfieFile) {
            toast.error('Envie o documento e a selfie para solicitar verificação.');
            return;
        }
        if (!profile.cpf || !validateCPF(profile.cpf)) {
            toast.error('CPF válido é obrigatório para verificação. Vá à aba Meus Dados.');
            return;
        }
        setUploadingVerif(true);
        try {
            const uid = user?.id;
            const docPath = `verifications/${uid}/document_${Date.now()}`;
            const selfiePath = `verifications/${uid}/selfie_${Date.now()}`;
            await supabase.storage.from('verifications').upload(docPath, docFile, { upsert: true });
            await supabase.storage.from('verifications').upload(selfiePath, selfieFile, { upsert: true });
            await supabase.from('profiles').upsert({
                id: uid,
                verification_status: 'pending',
                updated_at: new Date(),
            });
            setVerificationStatus('pending');
            toast.success('Documentos enviados! Sua verificação será analisada em até 24h.');
        } catch {
            toast.error('Erro ao enviar documentos. Tente novamente.');
        } finally {
            setUploadingVerif(false);
        }
    };

    useEffect(() => {
        if (user) fetchProfile();
    }, [user]);

    const fetchProfile = async () => {
        try {
            const { data } = await supabase.from('profiles').select('*').eq('id', user?.id).single();
            setProfile({
                full_name:       data?.full_name        || user?.user_metadata?.full_name || '',
                email:           user?.email            || '',
                phone:           data?.phone            || user?.user_metadata?.phone     || '',
                avatar_url:      data?.avatar_url       || '',
                cpf:             data?.cpf              || '',
                data_nascimento: data?.data_nascimento  || '',
                data_nascimento_display: isoToDMY(data?.data_nascimento || ''),
                genero:          data?.genero           || '',
            });
            setAddress({
                cep:             data?.cep      || '',
                estado:          data?.estado   || '',
                cidade:          data?.cidade   || '',
                exibir_telefone: data?.exibir_telefone ?? false,
            });
            if (data?.marcas_preferidas) setPrefs(p => ({ ...p, marcas_preferidas: data.marcas_preferidas }));
            if (data?.tipos_veiculo)     setPrefs(p => ({ ...p, tipos_veiculo: data.tipos_veiculo }));
            if (data?.orcamento_max)     setPrefs(p => ({ ...p, orcamento_max: String(data.orcamento_max) }));
        } catch { } finally { setLoading(false); }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!profile.full_name.trim()) { toast.error('Nome completo é obrigatório.'); return; }
        if (profile.cpf && !validateCPF(profile.cpf)) { toast.error('CPF inválido.'); return; }
        if (profile.data_nascimento_display && profile.data_nascimento_display.length === 10 && !isAtLeast18(profile.data_nascimento_display)) {
            toast.error('Você precisa ter pelo menos 18 anos para usar a plataforma.');
            return;
        }
        setSaving(true);
        try {
            await supabase.from('profiles').upsert({
                id: user?.id,
                full_name:       profile.full_name,
                phone:           profile.phone,
                cpf:             profile.cpf.replace(/\D/g, ''),
                data_nascimento: dmyToISO(profile.data_nascimento_display) || profile.data_nascimento || null,
                genero:          profile.genero || null,
                cep:             address.cep.replace(/\D/g, ''),
                estado:          address.estado,
                cidade:          address.cidade,
                exibir_telefone: address.exibir_telefone,
                marcas_preferidas: prefs.marcas_preferidas,
                tipos_veiculo:   prefs.tipos_veiculo,
                orcamento_max:   prefs.orcamento_max ? parseFloat(prefs.orcamento_max) : null,
                updated_at:      new Date(),
            });
            await supabase.auth.updateUser({ data: { full_name: profile.full_name, phone: profile.phone } });
            toast.success('Perfil atualizado com sucesso!');
        } catch { toast.error('Erro ao atualizar perfil.'); } finally { setSaving(false); }
    };

    const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files?.length) return;
        const reader = new FileReader();
        reader.addEventListener('load', () => {
            setSelectedImage(reader.result as string);
            setShowCropModal(true);
        });
        reader.readAsDataURL(e.target.files[0]);
    };

    const handleCropComplete = async (blob: Blob) => {
        setShowCropModal(false);
        const fileName = `${user?.id}-${Math.random()}.jpg`;
        try {
            setSaving(true);
            const { error } = await supabase.storage.from('avatars').upload(fileName, blob, { contentType: 'image/jpeg', upsert: true });
            if (error) throw error;
            const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(fileName);
            await supabase.from('profiles').upsert({ id: user?.id, avatar_url: publicUrl, updated_at: new Date() });
            await supabase.auth.updateUser({ data: { avatar_url: publicUrl } });
            setProfile(p => ({ ...p, avatar_url: publicUrl }));
            toast.success('Foto atualizada!');
        } catch (err: any) { toast.error(`Erro: ${err.message}`); } finally { setSaving(false); setSelectedImage(null); }
    };

    const fetchCEP = async (cep: string) => {
        const raw = cep.replace(/\D/g, '');
        if (raw.length !== 8) return;
        try {
            const r = await fetch(`https://viacep.com.br/ws/${raw}/json/`);
            const d = await r.json();
            if (!d.erro) {
                setAddress(a => ({ ...a, cidade: d.localidade || a.cidade, estado: d.uf || a.estado }));
                toast.success('CEP preenchido automaticamente!');
            }
        } catch { }
    };

    const togglePref = (arr: string[], val: string) =>
        arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val];

    const iClass = "w-full px-4 py-3 bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20 focus:border-brand-400/60 rounded-xl text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-zinc-500 outline-none transition-all";
    const lClass = "block text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider mb-2";

    const tabs: { id: TabId; label: string; icon: React.ElementType }[] = [
        { id: 'dados',       label: 'Meus Dados',    icon: User      },
        { id: 'endereco',    label: 'Endereço',       icon: MapPin    },
        { id: 'preferencias',label: 'Preferências',   icon: Heart     },
        { id: 'seguranca',   label: 'Segurança',      icon: Shield    },
        { id: 'verificacao', label: 'Verificação',    icon: BadgeCheck},
        { id: 'atividade',   label: 'Atividade',      icon: Eye       },
    ];

    if (loading) return (
        <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
            <div className="w-12 h-12 rounded-full border-2 border-brand-400/20 border-t-brand-400 animate-spin" />
        </div>
    );

    if (!user) return (
        <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 flex flex-col items-center justify-center gap-4">
            <p className="text-slate-600 dark:text-zinc-400">Você precisa estar logado.</p>
            <Link to="/login" className="px-6 py-2.5 bg-brand-400 text-zinc-950 font-bold rounded-xl">Entrar</Link>
        </div>
    );

    return (
        <div className="bg-slate-50 dark:bg-zinc-950 min-h-screen py-10 transition-colors duration-300">
            <div className="max-w-5xl mx-auto px-4 sm:px-6">

                <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
                    <Link to="/" className="inline-flex items-center gap-2 text-slate-500 dark:text-zinc-500 hover:text-brand-400 mb-8 transition-colors text-sm">
                        <ArrowLeft className="w-4 h-4" strokeWidth={1.5} /> Voltar para o início
                    </Link>

                    {/* Profile Header */}
                    <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/8 rounded-2xl p-6 mb-6 flex flex-col sm:flex-row items-center gap-5 shadow-sm dark:shadow-none">
                        <div className="relative group cursor-pointer flex-shrink-0" onClick={() => fileInputRef.current?.click()}>
                            <div className="w-24 h-24 rounded-full border-4 border-slate-200 dark:border-zinc-700 overflow-hidden bg-slate-100 dark:bg-zinc-800 flex items-center justify-center">
                                {profile.avatar_url
                                    ? <img src={profile.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                                    : <User className="w-10 h-10 text-slate-300 dark:text-zinc-600" strokeWidth={1.5} />}
                                <div className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Camera className="w-6 h-6 text-white" strokeWidth={1.5} />
                                </div>
                            </div>
                            <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleAvatarChange} />
                        </div>
                        <div className="flex-1 text-center sm:text-left">
                            <div className="flex items-center justify-center sm:justify-start gap-2 mb-1">
                                <h1 className="text-2xl font-black text-slate-900 dark:text-white">
                                    {profile.full_name || 'Meu Perfil'}
                                </h1>
                                {isVerified && (
                                    <span className="flex items-center gap-1 px-2 py-0.5 bg-emerald-500/15 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs font-bold rounded-full">
                                        <CheckCircle2 className="w-3 h-3" strokeWidth={2} /> Verificado
                                    </span>
                                )}
                            </div>
                            <p className="text-sm text-slate-500 dark:text-zinc-500">{profile.email}</p>
                            <div className="flex items-center justify-center sm:justify-start gap-3 mt-2">
                                <div className="flex items-center gap-0.5">
                                    {[1,2,3,4,5].map(i => (
                                        <Star key={i} className={`w-3.5 h-3.5 ${i <= 4 ? 'text-amber-400 fill-amber-400' : 'text-slate-300 dark:text-zinc-600'}`} strokeWidth={1.5} />
                                    ))}
                                    <span className="text-xs text-slate-500 dark:text-zinc-500 ml-1">4.0 · Vendedor</span>
                                </div>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <Link to="/meus-anuncios"
                                className="flex items-center gap-1.5 px-4 py-2 bg-brand-400/10 border border-brand-400/20 text-brand-500 dark:text-brand-400 text-sm font-bold rounded-xl hover:bg-brand-400/20 transition-colors">
                                <Car className="w-4 h-4" strokeWidth={1.5} /> Anúncios
                            </Link>
                            <Link to="/alertas"
                                className="flex items-center gap-1.5 px-4 py-2 bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-white/10 text-slate-600 dark:text-zinc-400 text-sm font-bold rounded-xl hover:border-brand-400/30 transition-colors">
                                <Bell className="w-4 h-4" strokeWidth={1.5} /> Alertas
                            </Link>
                        </div>
                    </div>

                    {/* Anti-scam banner */}
                    <div className="flex items-start gap-3 p-4 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/25 rounded-xl mb-6">
                        <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" strokeWidth={1.5} />
                        <p className="text-xs text-amber-700 dark:text-amber-400 leading-relaxed">
                            <strong>Nunca realize pagamentos antecipados.</strong> O SulMotors não intermedeia pagamentos entre compradores e vendedores. Suspeite de preços muito abaixo do mercado.
                        </p>
                    </div>
                </motion.div>

                <div className="flex flex-col lg:flex-row gap-6">

                    {/* Sidebar tabs */}
                    <div className="lg:w-56 flex-shrink-0">
                        <nav className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/8 rounded-2xl p-2 shadow-sm dark:shadow-none space-y-0.5">
                            {tabs.map(({ id, label, icon: Icon }) => (
                                <button
                                    key={id}
                                    onClick={() => setActiveTab(id)}
                                    className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all text-left ${
                                        activeTab === id
                                            ? 'bg-brand-400/10 border border-brand-400/20 text-brand-500 dark:text-brand-400'
                                            : 'text-slate-600 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white border border-transparent'
                                    }`}
                                >
                                    <Icon className="w-4 h-4 flex-shrink-0" strokeWidth={1.5} />
                                    {label}
                                </button>
                            ))}
                        </nav>
                    </div>

                    {/* Main content */}
                    <div className="flex-1">
                        <AnimatePresence mode="wait">
                            <motion.div
                                key={activeTab}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                transition={{ duration: 0.15 }}
                            >
                                <form onSubmit={handleSave}>
                                    <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/8 rounded-2xl overflow-hidden shadow-sm dark:shadow-none">

                                        {/* ─── TAB: Dados Pessoais ───── */}
                                        {activeTab === 'dados' && (
                                            <div className="p-6 space-y-5">
                                                <h2 className="text-lg font-black text-slate-900 dark:text-white mb-4">Meus Dados</h2>
                                                <div>
                                                    <label className={lClass}>Nome Completo *</label>
                                                    <div className="relative">
                                                        <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-zinc-500" strokeWidth={1.5} />
                                                        <input type="text" value={profile.full_name} onChange={e => setProfile(p => ({ ...p, full_name: e.target.value }))}
                                                            className={`${iClass} pl-10`} placeholder="Seu nome completo" required />
                                                    </div>
                                                </div>
                                                <div className="grid sm:grid-cols-2 gap-4">
                                                    <div>
                                                        <label className={lClass}>Telefone *</label>
                                                        <div className="relative">
                                                            <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-zinc-500" strokeWidth={1.5} />
                                                            <input type="tel" value={profile.phone}
                                                                onChange={e => setProfile(p => ({ ...p, phone: phoneMask(e.target.value) }))}
                                                                className={`${iClass} pl-10`} placeholder="(11) 99999-9999" />
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <label className={lClass}>Email <span className="text-slate-300 dark:text-zinc-700 normal-case font-normal">(não editável)</span></label>
                                                        <div className="relative">
                                                            <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300 dark:text-zinc-700" strokeWidth={1.5} />
                                                            <input type="email" value={profile.email} disabled
                                                                className="w-full pl-10 pr-4 py-3 bg-slate-100 dark:bg-zinc-800/50 border border-slate-200 dark:border-white/5 rounded-xl text-sm text-slate-400 dark:text-zinc-600 outline-none cursor-not-allowed" />
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="grid sm:grid-cols-2 gap-4">
                                                    <div>
                                                        <label className={lClass}>CPF *
                                                            {cpfValid === true && <span className="text-emerald-500 ml-1 normal-case font-normal">✓ válido</span>}
                                                            {cpfValid === false && <span className="text-red-500 ml-1 normal-case font-normal">✗ inválido</span>}
                                                        </label>
                                                        <div className="relative">
                                                            <CreditCard className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-zinc-500" strokeWidth={1.5} />
                                                            <input type="text" value={profile.cpf}
                                                                onChange={e => {
                                                                    const v = cpfMask(e.target.value);
                                                                    setProfile(p => ({ ...p, cpf: v }));
                                                                    if (v.replace(/\D/g, '').length === 11) setCpfValid(validateCPF(v));
                                                                    else setCpfValid(null);
                                                                }}
                                                                className={`${iClass} pl-10`} placeholder="000.000.000-00" />
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <label className={lClass}>Data de Nascimento *</label>
                                                        <div className="relative">
                                                            <Calendar className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-zinc-500" strokeWidth={1.5} />
                                                            <input
                                                                type="text"
                                                                value={profile.data_nascimento_display}
                                                                onChange={e => {
                                                                    const masked = dateMask(e.target.value);
                                                                    setProfile(p => ({ ...p, data_nascimento_display: masked }));
                                                                }}
                                                                onBlur={() => {
                                                                    const d = profile.data_nascimento_display;
                                                                    if (d.length === 10 && !isAtLeast18(d)) {
                                                                        toast.error('Você precisa ter pelo menos 18 anos para usar a plataforma.');
                                                                    }
                                                                }}
                                                                className={`${iClass} pl-10`}
                                                                placeholder="dd/mm/aaaa"
                                                                maxLength={10}
                                                                inputMode="numeric"
                                                            />
                                                        </div>
                                                    </div>
                                                </div>
                                                <div>
                                                    <label className={lClass}>Gênero (opcional)</label>
                                                    <div className="relative">
                                                        <select value={profile.genero} onChange={e => setProfile(p => ({ ...p, genero: e.target.value }))}
                                                            className={`${iClass} appearance-none`}>
                                                            <option value="">Prefiro não informar</option>
                                                            <option value="M">Masculino</option>
                                                            <option value="F">Feminino</option>
                                                            <option value="NB">Não-binário</option>
                                                        </select>
                                                        <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" strokeWidth={1.5} />
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {/* ─── TAB: Endereço ─────────── */}
                                        {activeTab === 'endereco' && (
                                            <div className="p-6 space-y-5">
                                                <h2 className="text-lg font-black text-slate-900 dark:text-white mb-4">Endereço</h2>
                                                <div className="grid sm:grid-cols-2 gap-4">
                                                    <div>
                                                        <label className={lClass}>CEP *</label>
                                                        <input type="text" value={address.cep}
                                                            onChange={e => {
                                                                const v = cepMask(e.target.value);
                                                                setAddress(a => ({ ...a, cep: v }));
                                                                if (v.replace(/\D/g, '').length === 8) fetchCEP(v);
                                                            }}
                                                            placeholder="00000-000" className={iClass} />
                                                    </div>
                                                    <div>
                                                        <label className={lClass}>Estado *</label>
                                                        <div className="relative">
                                                            <select value={address.estado} onChange={e => setAddress(a => ({ ...a, estado: e.target.value }))}
                                                                className={`${iClass} appearance-none`}>
                                                                <option value="">Selecione</option>
                                                                {STATES_BR.map(s => <option key={s} value={s}>{s}</option>)}
                                                            </select>
                                                            <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" strokeWidth={1.5} />
                                                        </div>
                                                    </div>
                                                </div>
                                                <div>
                                                    <label className={lClass}>Cidade *</label>
                                                    <div className="relative">
                                                        <MapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-zinc-500" strokeWidth={1.5} />
                                                        <input type="text" value={address.cidade}
                                                            onChange={e => setAddress(a => ({ ...a, cidade: e.target.value }))}
                                                            className={`${iClass} pl-10`} placeholder="Sua cidade" />
                                                    </div>
                                                </div>
                                                <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-white/8 rounded-xl">
                                                    <div>
                                                        <p className="text-sm font-bold text-slate-900 dark:text-white">Exibir telefone nos anúncios</p>
                                                        <p className="text-xs text-slate-500 dark:text-zinc-500 mt-0.5">Compradores poderão ver seu número de contato</p>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => setAddress(a => ({ ...a, exibir_telefone: !a.exibir_telefone }))}
                                                        className={`relative w-12 h-6 rounded-full transition-all duration-300 flex-shrink-0 ${address.exibir_telefone ? 'bg-brand-400' : 'bg-slate-300 dark:bg-zinc-600'}`}
                                                    >
                                                        <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-md transition-transform duration-300 ${address.exibir_telefone ? 'translate-x-6' : ''}`} />
                                                    </button>
                                                </div>
                                            </div>
                                        )}

                                        {/* ─── TAB: Preferências ─────── */}
                                        {activeTab === 'preferencias' && (
                                            <div className="p-6 space-y-6">
                                                <h2 className="text-lg font-black text-slate-900 dark:text-white mb-4">Preferências</h2>
                                                <div>
                                                    <label className={lClass}>Orçamento máximo (R$)</label>
                                                    <input type="number" value={prefs.orcamento_max}
                                                        onChange={e => setPrefs(p => ({ ...p, orcamento_max: e.target.value }))}
                                                        placeholder="Ex: 80000" className={iClass} />
                                                </div>
                                                <div>
                                                    <label className={lClass}>Marcas preferidas</label>
                                                    <div className="flex flex-wrap gap-2">
                                                        {BRAND_PREFS.map(b => (
                                                            <button key={b} type="button"
                                                                onClick={() => setPrefs(p => ({ ...p, marcas_preferidas: togglePref(p.marcas_preferidas, b) }))}
                                                                className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                                                                    prefs.marcas_preferidas.includes(b)
                                                                        ? 'bg-brand-400/20 border-brand-400/40 text-brand-500 dark:text-brand-400'
                                                                        : 'bg-slate-100 dark:bg-zinc-800 border-slate-200 dark:border-white/10 text-slate-600 dark:text-zinc-400 hover:border-brand-400/30'
                                                                }`}>
                                                                {b}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                                <div>
                                                    <label className={lClass}>Tipo de veículo</label>
                                                    <div className="flex flex-wrap gap-2">
                                                        {VEHICLE_TYPES.map(v => (
                                                            <button key={v} type="button"
                                                                onClick={() => setPrefs(p => ({ ...p, tipos_veiculo: togglePref(p.tipos_veiculo, v) }))}
                                                                className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                                                                    prefs.tipos_veiculo.includes(v)
                                                                        ? 'bg-brand-400/20 border-brand-400/40 text-brand-500 dark:text-brand-400'
                                                                        : 'bg-slate-100 dark:bg-zinc-800 border-slate-200 dark:border-white/10 text-slate-600 dark:text-zinc-400 hover:border-brand-400/30'
                                                                }`}>
                                                                {v}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                                <div className="space-y-3">
                                                    <label className={lClass}>Notificações</label>
                                                    {[
                                                        { key: 'alertas_email', label: 'Alertas por e-mail', sub: 'Receba novos anúncios que correspondem às suas buscas' },
                                                        { key: 'alertas_push',  label: 'Notificações push',  sub: 'Receba notificações no navegador' },
                                                        { key: 'queda_preco',   label: 'Queda de preço',     sub: 'Avise-me quando o preço de um favorito cair' },
                                                    ].map(({ key, label, sub }) => (
                                                        <div key={key} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-white/8 rounded-xl">
                                                            <div>
                                                                <p className="text-sm font-bold text-slate-900 dark:text-white">{label}</p>
                                                                <p className="text-xs text-slate-500 dark:text-zinc-500">{sub}</p>
                                                            </div>
                                                            <button type="button"
                                                                onClick={() => setPrefs(p => ({ ...p, [key]: !(p as any)[key] }))}
                                                                className={`relative w-10 h-5 rounded-full transition-all duration-300 flex-shrink-0 ${(prefs as any)[key] ? 'bg-brand-400' : 'bg-slate-300 dark:bg-zinc-600'}`}>
                                                                <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform duration-300 ${(prefs as any)[key] ? 'translate-x-5' : ''}`} />
                                                            </button>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* ─── TAB: Segurança ─────────── */}
                                        {activeTab === 'seguranca' && (
                                            <div className="p-6 space-y-5">
                                                <h2 className="text-lg font-black text-slate-900 dark:text-white mb-4">Segurança</h2>
                                                <div className="space-y-3">
                                                    <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-white/8 rounded-xl">
                                                        <div className="flex items-center gap-3">
                                                            <Lock className="w-5 h-5 text-brand-400" strokeWidth={1.5} />
                                                            <div>
                                                                <p className="text-sm font-bold text-slate-900 dark:text-white">Alterar senha</p>
                                                                <p className="text-xs text-slate-500 dark:text-zinc-500">Troque sua senha atual por uma nova</p>
                                                            </div>
                                                        </div>
                                                        <button type="button"
                                                            onClick={async () => {
                                                                if (!user?.email) return;
                                                                await supabase.auth.resetPasswordForEmail(user.email);
                                                                toast.success('Email de redefinição enviado!');
                                                            }}
                                                            className="px-4 py-2 bg-slate-200 dark:bg-zinc-700 border border-slate-300 dark:border-white/10 text-slate-700 dark:text-zinc-200 text-sm font-bold rounded-xl hover:bg-slate-300 dark:hover:bg-zinc-600 transition-colors">
                                                            Enviar email
                                                        </button>
                                                    </div>
                                                    <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-white/8 rounded-xl">
                                                        <div className="flex items-center gap-3">
                                                            <Smartphone className="w-5 h-5 text-emerald-500" strokeWidth={1.5} />
                                                            <div>
                                                                <p className="text-sm font-bold text-slate-900 dark:text-white">Autenticação 2FA</p>
                                                                <p className="text-xs text-slate-500 dark:text-zinc-500">Adicione uma camada extra de segurança</p>
                                                            </div>
                                                        </div>
                                                        <span className="px-3 py-1 bg-amber-500/15 border border-amber-500/30 text-amber-600 dark:text-amber-400 text-xs font-bold rounded-lg">Em breve</span>
                                                    </div>
                                                    <div className="p-4 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-xl">
                                                        <p className="text-sm font-bold text-red-600 dark:text-red-400 mb-1">Zona de perigo</p>
                                                        <p className="text-xs text-red-500 dark:text-red-400/70 mb-3">Excluir permanentemente sua conta e todos os dados associados.</p>
                                                        <button type="button" className="px-4 py-2 bg-red-500/15 border border-red-500/30 text-red-500 text-sm font-bold rounded-xl hover:bg-red-500/25 transition-colors">
                                                            Excluir conta
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {/* ─── TAB: Verificação ───────── */}
                                        {activeTab === 'verificacao' && (
                                            <div className="p-6 space-y-6">
                                                <div>
                                                    <h2 className="text-lg font-black text-slate-900 dark:text-white mb-1">Verificação de Identidade</h2>
                                                    <p className="text-sm text-slate-500 dark:text-zinc-500">
                                                        Usuários verificados recebem o badge <strong className="text-emerald-500">✔ Verificado</strong> e têm maior visibilidade e credibilidade com compradores.
                                                    </p>
                                                </div>

                                                {/* Status banner */}
                                                {verificationStatus === 'approved' || isVerified ? (
                                                    <div className="flex items-center gap-3 p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl">
                                                        <BadgeCheck className="w-6 h-6 text-emerald-500 flex-shrink-0" strokeWidth={1.5} />
                                                        <div>
                                                            <p className="text-sm font-black text-emerald-600 dark:text-emerald-400">Conta Verificada!</p>
                                                            <p className="text-xs text-emerald-600/80 dark:text-emerald-400/70">Seu badge ✔ Verificado está ativo em todos os seus anúncios.</p>
                                                        </div>
                                                    </div>
                                                ) : verificationStatus === 'pending' ? (
                                                    <div className="flex items-center gap-3 p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl">
                                                        <Loader2 className="w-5 h-5 text-amber-500 animate-spin flex-shrink-0" strokeWidth={1.5} />
                                                        <div>
                                                            <p className="text-sm font-black text-amber-600 dark:text-amber-400">Verificação em análise</p>
                                                            <p className="text-xs text-amber-600/80 dark:text-amber-400/70">Seus documentos foram enviados. Retornaremos em até 24h.</p>
                                                        </div>
                                                    </div>
                                                ) : verificationStatus === 'rejected' ? (
                                                    <div className="flex items-center gap-3 p-4 bg-red-500/10 border border-red-500/30 rounded-2xl">
                                                        <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0" strokeWidth={1.5} />
                                                        <div>
                                                            <p className="text-sm font-black text-red-600 dark:text-red-400">Verificação reprovada</p>
                                                            <p className="text-xs text-red-600/80 dark:text-red-400/70">Os documentos não foram aceitos. Por favor, reenvie fotos nítidas e válidas.</p>
                                                        </div>
                                                    </div>
                                                ) : null}

                                                {/* Steps checklist */}
                                                <div className="space-y-3">
                                                    {[
                                                        {
                                                            step: 1,
                                                            title: 'CPF válido cadastrado',
                                                            desc: profile.cpf && validateCPF(profile.cpf) ? 'CPF informado e válido ✓' : 'Adicione seu CPF na aba Meus Dados',
                                                            done: !!(profile.cpf && validateCPF(profile.cpf)),
                                                        },
                                                        {
                                                            step: 2,
                                                            title: 'E-mail verificado',
                                                            desc: user?.email_confirmed_at ? 'E-mail confirmado ✓' : 'Verifique o link enviado para seu e-mail',
                                                            done: !!user?.email_confirmed_at,
                                                        },
                                                        {
                                                            step: 3,
                                                            title: 'Documento de identidade',
                                                            desc: docFile ? `Arquivo selecionado: ${docFile.name}` : 'Envie foto do RG, CNH ou passaporte',
                                                            done: !!docFile,
                                                        },
                                                        {
                                                            step: 4,
                                                            title: 'Selfie com documento',
                                                            desc: selfieFile ? `Arquivo selecionado: ${selfieFile.name}` : 'Segure o documento ao lado do rosto',
                                                            done: !!selfieFile,
                                                        },
                                                    ].map(({ step, title, desc, done }) => (
                                                        <div key={step} className="flex items-center justify-between p-4 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-white/8 rounded-xl">
                                                            <div className="flex items-center gap-3">
                                                                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${done ? 'bg-emerald-500/20' : 'bg-slate-200 dark:bg-zinc-700'}`}>
                                                                    {done
                                                                        ? <CheckCircle2 className="w-4 h-4 text-emerald-500" strokeWidth={2} />
                                                                        : <span className="text-sm font-bold text-slate-400 dark:text-zinc-500">{step}</span>}
                                                                </div>
                                                                <div>
                                                                    <p className="text-sm font-bold text-slate-900 dark:text-white">{title}</p>
                                                                    <p className="text-xs text-slate-500 dark:text-zinc-500">{desc}</p>
                                                                </div>
                                                            </div>
                                                            {done
                                                                ? <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" strokeWidth={2} />
                                                                : <span className="text-xs text-amber-500 font-bold flex-shrink-0">Pendente</span>}
                                                        </div>
                                                    ))}
                                                </div>

                                                {/* Upload area — only when not verified */}
                                                {!isVerified && verificationStatus !== 'pending' && verificationStatus !== 'approved' && (
                                                    <div className="space-y-4">
                                                        <p className="text-xs font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider">Enviar documentos</p>

                                                        {/* Document upload */}
                                                        <div>
                                                            <label className="block text-xs font-bold text-slate-500 dark:text-zinc-500 uppercase tracking-wider mb-2">
                                                                Documento de Identidade (RG / CNH / Passaporte)
                                                            </label>
                                                            <input
                                                                ref={docInputRef}
                                                                type="file"
                                                                accept="image/*,.pdf"
                                                                className="hidden"
                                                                onChange={e => handleDocChange(e, 'doc')}
                                                            />
                                                            <button
                                                                type="button"
                                                                onClick={() => docInputRef.current?.click()}
                                                                className={`w-full flex flex-col items-center justify-center gap-3 p-6 border-2 border-dashed rounded-2xl transition-colors ${docPreview ? 'border-emerald-500/40 bg-emerald-500/5' : 'border-slate-200 dark:border-white/10 hover:border-brand-400/40 hover:bg-brand-400/5'}`}
                                                            >
                                                                {docPreview ? (
                                                                    <img src={docPreview} alt="Doc preview" className="h-24 object-contain rounded-lg" />
                                                                ) : (
                                                                    <>
                                                                        <CreditCard className="w-8 h-8 text-slate-400 dark:text-zinc-600" strokeWidth={1} />
                                                                        <span className="text-sm text-slate-500 dark:text-zinc-500 font-medium">Clique para selecionar foto do documento</span>
                                                                        <span className="text-xs text-slate-400 dark:text-zinc-600">JPG, PNG ou PDF · Máx. 10 MB</span>
                                                                    </>
                                                                )}
                                                            </button>
                                                        </div>

                                                        {/* Selfie upload */}
                                                        <div>
                                                            <label className="block text-xs font-bold text-slate-500 dark:text-zinc-500 uppercase tracking-wider mb-2">
                                                                Selfie segurando o documento
                                                            </label>
                                                            <input
                                                                ref={selfieInputRef}
                                                                type="file"
                                                                accept="image/*"
                                                                className="hidden"
                                                                onChange={e => handleDocChange(e, 'selfie')}
                                                            />
                                                            <button
                                                                type="button"
                                                                onClick={() => selfieInputRef.current?.click()}
                                                                className={`w-full flex flex-col items-center justify-center gap-3 p-6 border-2 border-dashed rounded-2xl transition-colors ${selfiePreview ? 'border-emerald-500/40 bg-emerald-500/5' : 'border-slate-200 dark:border-white/10 hover:border-brand-400/40 hover:bg-brand-400/5'}`}
                                                            >
                                                                {selfiePreview ? (
                                                                    <img src={selfiePreview} alt="Selfie preview" className="h-24 object-contain rounded-lg" />
                                                                ) : (
                                                                    <>
                                                                        <Camera className="w-8 h-8 text-slate-400 dark:text-zinc-600" strokeWidth={1} />
                                                                        <span className="text-sm text-slate-500 dark:text-zinc-500 font-medium">Clique para tirar ou selecionar selfie</span>
                                                                        <span className="text-xs text-slate-400 dark:text-zinc-600">Rosto e documento visíveis · JPG ou PNG</span>
                                                                    </>
                                                                )}
                                                            </button>
                                                        </div>

                                                        {/* Submit */}
                                                        <button
                                                            type="button"
                                                            disabled={!docFile || !selfieFile || uploadingVerif}
                                                            onClick={handleSubmitVerification}
                                                            className="w-full flex items-center justify-center gap-2 py-3.5 bg-brand-400 hover:bg-brand-300 text-zinc-950 font-black rounded-xl transition-all disabled:opacity-50 hover:shadow-glow"
                                                        >
                                                            {uploadingVerif
                                                                ? <><Loader2 className="w-4 h-4 animate-spin" strokeWidth={1.5} /> Enviando...</>
                                                                : <><BadgeCheck className="w-4 h-4" strokeWidth={1.5} /> Solicitar verificação</>}
                                                        </button>
                                                    </div>
                                                )}

                                                {/* LGPD note */}
                                                <div className="flex items-start gap-2.5 p-3.5 bg-blue-500/8 border border-blue-500/20 rounded-xl">
                                                    <Shield className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" strokeWidth={1.5} />
                                                    <p className="text-xs text-blue-600 dark:text-blue-400/80 leading-relaxed">
                                                        Seus documentos são tratados com sigilo conforme a <strong>LGPD (Lei 13.709/2018)</strong>.
                                                        Usados exclusivamente para verificação de identidade e excluídos após aprovação.
                                                    </p>
                                                </div>
                                            </div>
                                        )}

                                        {/* ─── TAB: Atividade ─────────── */}
                                        {activeTab === 'atividade' && (
                                            <div className="p-6 space-y-5">
                                                <h2 className="text-lg font-black text-slate-900 dark:text-white mb-4">Minha Atividade</h2>
                                                <div className="grid grid-cols-3 gap-4">
                                                    {[
                                                        { icon: Eye,   label: 'Veículos vistos', val: activity.views,     color: 'text-blue-500' },
                                                        { icon: Heart, label: 'Favoritos',        val: activity.favorites, color: 'text-red-500' },
                                                        { icon: Zap,   label: 'Propostas',        val: activity.proposals, color: 'text-brand-400' },
                                                    ].map(({ icon: Icon, label, val, color }) => (
                                                        <div key={label} className="flex flex-col items-center p-4 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-white/8 rounded-2xl">
                                                            <Icon className={`w-6 h-6 mb-2 ${color}`} strokeWidth={1.5} />
                                                            <p className="text-2xl font-black text-slate-900 dark:text-white">{val}</p>
                                                            <p className="text-xs text-slate-500 dark:text-zinc-500 text-center mt-0.5">{label}</p>
                                                        </div>
                                                    ))}
                                                </div>
                                                <div className="p-4 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-white/8 rounded-xl">
                                                    <p className="text-sm font-bold text-slate-700 dark:text-zinc-300 mb-2">Atalhos rápidos</p>
                                                    <div className="flex flex-wrap gap-2">
                                                        <Link to="/favoritos" className="flex items-center gap-1.5 px-3 py-2 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/10 text-slate-600 dark:text-zinc-400 text-xs font-bold rounded-lg hover:border-brand-400/30 hover:text-brand-500 transition-colors">
                                                            <Heart className="w-3.5 h-3.5" strokeWidth={1.5} /> Ver favoritos
                                                        </Link>
                                                        <Link to="/meus-anuncios" className="flex items-center gap-1.5 px-3 py-2 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/10 text-slate-600 dark:text-zinc-400 text-xs font-bold rounded-lg hover:border-brand-400/30 hover:text-brand-500 transition-colors">
                                                            <Car className="w-3.5 h-3.5" strokeWidth={1.5} /> Meus anúncios
                                                        </Link>
                                                        <Link to="/alertas" className="flex items-center gap-1.5 px-3 py-2 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/10 text-slate-600 dark:text-zinc-400 text-xs font-bold rounded-lg hover:border-brand-400/30 hover:text-brand-500 transition-colors">
                                                            <Bell className="w-3.5 h-3.5" strokeWidth={1.5} /> Alertas
                                                        </Link>
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {/* Save button (shown for editable tabs) */}
                                        {['dados', 'endereco', 'preferencias'].includes(activeTab) && (
                                            <div className="flex justify-end px-6 pb-6 pt-2 border-t border-slate-100 dark:border-white/5">
                                                <button type="submit" disabled={saving}
                                                    className="flex items-center gap-2.5 px-6 py-3 bg-brand-400 hover:bg-brand-300 text-zinc-950 font-black rounded-xl transition-all hover:shadow-glow disabled:opacity-50 text-sm">
                                                    {saving ? <><Loader2 className="w-5 h-5 animate-spin" strokeWidth={1.5} />Salvando...</> : <><Save className="w-5 h-5" strokeWidth={1.5} />Salvar Alterações</>}
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </form>
                            </motion.div>
                        </AnimatePresence>
                    </div>
                </div>
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
