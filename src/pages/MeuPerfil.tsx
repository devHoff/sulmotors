import { useState, useEffect, useRef } from 'react';
import { User, Mail, Phone, Camera, Save, Loader2, ArrowLeft } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from '../utils/toast';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { supabase } from '../lib/supabase';
import CropModal from '../components/CropModal';
import { motion } from 'framer-motion';

/* ── Masks ──────────────────────────────────────────────── */
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
function dateMask(v: string): string {
    const d = v.replace(/\D/g, '').slice(0, 8);
    if (d.length <= 2) return d;
    if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`;
    return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
}
function isoToDMY(iso: string): string {
    if (!iso) return '';
    const [y, m, d] = iso.split('-');
    if (!y || !m || !d) return iso;
    return `${d}/${m}/${y}`;
}
function dmyToISO(dmy: string): string {
    const parts = dmy.split('/');
    if (parts.length !== 3 || parts[2].length !== 4) return '';
    const [dd, mm, yyyy] = parts;
    return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
}
function isAtLeast18(dateStr: string): boolean {
    const parts = dateStr.split('/');
    if (parts.length !== 3 || parts[2].length !== 4) return false;
    const [dd, mm, yyyy] = parts.map(Number);
    if (!dd || !mm || !yyyy) return false;
    const dob = new Date(yyyy, mm - 1, dd);
    const today = new Date();
    return today >= new Date(dob.getFullYear() + 18, dob.getMonth(), dob.getDate());
}
function validateCPF(cpf: string) {
    const n = cpf.replace(/\D/g, '');
    if (n.length !== 11 || /^(\d)\1{10}$/.test(n)) return false;
    let s = 0;
    for (let i = 0; i < 9; i++) s += parseInt(n[i]) * (10 - i);
    let d1 = (s * 10) % 11; if (d1 === 10 || d1 === 11) d1 = 0;
    if (d1 !== parseInt(n[9])) return false;
    s = 0;
    for (let i = 0; i < 10; i++) s += parseInt(n[i]) * (11 - i);
    let d2 = (s * 10) % 11; if (d2 === 10 || d2 === 11) d2 = 0;
    return d2 === parseInt(n[10]);
}

const GENDER_OPTIONS = [
    { value: '',        label: 'common_select'     },
    { value: 'M',       label: 'profile_male'      },
    { value: 'F',       label: 'profile_female'    },
    { value: 'NB',      label: 'profile_nonbinary' },
    { value: 'other',   label: 'profile_other'     },
    { value: 'prefer_not', label: 'profile_prefer_not' },
];

/* ── Field component ────────────────────────────────────── */
function Field({
    label, icon: Icon, children, hint
}: {
    label: string; icon: React.ElementType; children: React.ReactNode; hint?: string;
}) {
    return (
        <div className="space-y-1.5">
            <label className="flex items-center gap-1.5 text-xs font-bold text-slate-500 dark:text-zinc-500 uppercase tracking-wider">
                <Icon className="w-3.5 h-3.5" strokeWidth={1.5} />
                {label}
            </label>
            {children}
            {hint && <p className="text-xs text-slate-400 dark:text-zinc-600">{hint}</p>}
        </div>
    );
}

const inputCls = "w-full px-4 py-3 bg-slate-50 dark:bg-zinc-800/50 border border-slate-200 dark:border-white/8 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-zinc-600 focus:outline-none focus:border-brand-400/60 focus:ring-2 focus:ring-brand-400/15 transition-all text-sm";
const inputDisabledCls = "w-full px-4 py-3 bg-slate-100 dark:bg-zinc-900/60 border border-slate-200 dark:border-white/5 rounded-xl text-slate-400 dark:text-zinc-600 text-sm cursor-not-allowed";

export default function MeuPerfil() {
    const { user } = useAuth();
    const { t } = useLanguage();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving]   = useState(false);

    const [profile, setProfile] = useState({
        full_name:                  '',
        email:                      '',
        phone:                      '',
        cpf:                        '',
        data_nascimento_display:    '',
        genero:                     '',
        avatar_url:                 '',
    });

    const [cpfError, setCpfError]         = useState('');
    const [ageError, setAgeError]         = useState('');
    const [extendedCols, setExtendedCols] = useState(true); // false = cpf/data_nascimento/genero columns don't exist yet
    const [cropSrc, setCropSrc]           = useState<string | null>(null);
    const [showCropModal, setShowCropModal] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    /* ── Load profile ── */
    useEffect(() => {
        if (!user) { navigate('/login'); return; }
        (async () => {
            // Try to fetch extended columns; if they don't exist yet, fetch base columns only
            const extSelect = await supabase
                .from('profiles')
                .select('full_name,phone,cpf,data_nascimento,genero,avatar_url')
                .eq('id', user.id)
                .single();

            // Fallback: if extended columns are missing (PGRST204 / error), fetch base
            const hasExtended = !extSelect.error;
            setExtendedCols(hasExtended);
            const { data } = hasExtended
                ? extSelect as any
                : await supabase.from('profiles').select('full_name,phone,avatar_url').eq('id', user.id).single() as any;
            if (data) {
                setProfile({
                    full_name:               data.full_name   || '',
                    email:                   user.email       || '',
                    phone:                   phoneMask(data.phone || ''),
                    cpf:                     cpfMask(data.cpf || ''),
                    data_nascimento_display: isoToDMY(data.data_nascimento || ''),
                    genero:                  data.genero      || '',
                    avatar_url:              data.avatar_url  || '',
                });
            } else {
                setProfile(p => ({ ...p, email: user.email || '' }));
            }
            setLoading(false);
        })();
    }, [user, navigate]);

    /* ── Save ── */
    const handleSave = async () => {
        if (!user) return;
        if (profile.cpf && !validateCPF(profile.cpf)) {
            setCpfError(t('profile_cpf_invalid'));
            return;
        }
        if (profile.data_nascimento_display && !isAtLeast18(profile.data_nascimento_display)) {
            setAgeError(t('profile_age_error'));
            return;
        }
        setSaving(true);
        try {
            // Full payload (requires cpf, data_nascimento, genero columns)
            const fullPayload = {
                id:              user.id,
                full_name:       profile.full_name.trim(),
                phone:           profile.phone.replace(/\D/g, ''),
                cpf:             profile.cpf.replace(/\D/g, '') || null,
                data_nascimento: dmyToISO(profile.data_nascimento_display) || null,
                genero:          profile.genero || null,
                avatar_url:      profile.avatar_url,
                updated_at:      new Date().toISOString(),
            };
            // Base payload — only columns confirmed to exist
            const basePayload = {
                id:         user.id,
                full_name:  profile.full_name.trim(),
                phone:      profile.phone.replace(/\D/g, ''),
                avatar_url: profile.avatar_url,
                updated_at: new Date().toISOString(),
            };

            let result = await supabase.from('profiles').upsert(fullPayload, { onConflict: 'id' });

            // If full payload fails because extra columns don't exist yet, save base fields
            if (result.error?.code === 'PGRST204' || result.error?.message?.includes('cpf') || result.error?.message?.includes('schema cache')) {
                console.warn('[MeuPerfil] extended columns missing, saving base fields only');
                result = await supabase.from('profiles').upsert(basePayload, { onConflict: 'id' });
            }

            if (result.error) {
                console.error('[MeuPerfil] save error:', result.error);
                toast.error(t('notif_profile_error'));
            } else {
                toast.success(t('notif_profile_saved'));
            }
        } catch (err) {
            console.error('[MeuPerfil] unexpected save error:', err);
            toast.error(t('notif_profile_error'));
        } finally {
            setSaving(false);
        }
    };

    /* ── Avatar upload ── */
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => { setCropSrc(reader.result as string); setShowCropModal(true); };
        reader.readAsDataURL(file);
    };
    const handleCropDone = async (croppedBlob: Blob) => {
        setShowCropModal(false);
        if (!user) return;
        const ext  = 'jpg';
        const path = `avatars/${user.id}.${ext}`;
        await supabase.storage.from('avatars').upload(path, croppedBlob, { upsert: true, contentType: 'image/jpeg' });
        const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path);
        const url = urlData.publicUrl + `?t=${Date.now()}`;
        setProfile(p => ({ ...p, avatar_url: url }));
    };

    /* ── Guard ── */
    if (!user) return null;

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-zinc-950">
                <Loader2 className="w-8 h-8 animate-spin text-brand-400" strokeWidth={1.5} />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 transition-colors duration-300">
            <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 sm:py-12">

                {/* Header */}
                <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
                    <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-slate-500 dark:text-zinc-500 hover:text-brand-400 mb-4 transition-colors">
                        <ArrowLeft className="w-4 h-4" strokeWidth={1.5} />
                        {t('common_back')}
                    </Link>
                    <h1 className="text-2xl font-black text-slate-900 dark:text-white">{t('profile_title')}</h1>
                    <p className="text-sm text-slate-500 dark:text-zinc-500 mt-1">{t('profile_subtitle')}</p>
                </motion.div>

                <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
                    className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/8 rounded-2xl shadow-sm overflow-hidden"
                >
                    {/* Avatar section */}
                    <div className="flex items-center gap-5 p-6 border-b border-slate-100 dark:border-white/5">
                        <div className="relative flex-shrink-0">
                            <div className="w-20 h-20 rounded-2xl overflow-hidden bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center">
                                {profile.avatar_url ? (
                                    <img src={profile.avatar_url} alt={profile.full_name} className="w-full h-full object-cover" />
                                ) : (
                                    <User className="w-8 h-8 text-zinc-950" strokeWidth={1.5} />
                                )}
                            </div>
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                className="absolute -bottom-1 -right-1 w-7 h-7 bg-brand-400 hover:bg-brand-300 rounded-full flex items-center justify-center shadow-lg transition-colors"
                                title={t('profile_change_photo')}
                            >
                                <Camera className="w-3.5 h-3.5 text-zinc-950" strokeWidth={2} />
                            </button>
                            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
                        </div>
                        <div>
                            <p className="font-bold text-slate-900 dark:text-white">{profile.full_name || t('profile_no_name')}</p>
                            <p className="text-sm text-slate-500 dark:text-zinc-500">{profile.email}</p>
                        </div>
                    </div>

                    {/* Form fields */}
                    <div className="p-6 space-y-5">
                        {/* Full name */}
                        <Field label={t('profile_name')} icon={User}>
                            <input
                                type="text"
                                value={profile.full_name}
                                onChange={e => setProfile(p => ({ ...p, full_name: e.target.value }))}
                                placeholder={t('profile_name_placeholder')}
                                className={inputCls}
                            />
                        </Field>

                        {/* Email (read-only) */}
                        <Field label={t('profile_email')} icon={Mail} hint={t('profile_email_hint')}>
                            <input type="email" value={profile.email} disabled className={inputDisabledCls} />
                        </Field>

                        {/* Phone */}
                        <Field label={t('profile_phone')} icon={Phone}>
                            <input
                                type="tel"
                                value={profile.phone}
                                onChange={e => setProfile(p => ({ ...p, phone: phoneMask(e.target.value) }))}
                                placeholder="(51) 99999-9999"
                                className={inputCls}
                            />
                        </Field>

                        {/* CPF */}
                        <Field label={t('profile_cpf')} icon={User}>
                            <input
                                type="text"
                                value={profile.cpf}
                                onChange={e => { setProfile(p => ({ ...p, cpf: cpfMask(e.target.value) })); setCpfError(''); }}
                                placeholder={extendedCols ? '000.000.000-00' : 'Aguardando migração...'}
                                disabled={!extendedCols}
                                className={`${extendedCols ? inputCls : inputDisabledCls} ${cpfError ? 'border-red-500/60 focus:border-red-500/60' : ''}`}
                            />
                            {cpfError && <p className="text-xs text-red-500 mt-1">{cpfError}</p>}
                        </Field>

                        {/* Date of birth */}
                        <Field label={t('profile_dob')} icon={User}>
                            <input
                                type="text"
                                value={profile.data_nascimento_display}
                                onChange={e => { setProfile(p => ({ ...p, data_nascimento_display: dateMask(e.target.value) })); setAgeError(''); }}
                                placeholder={extendedCols ? 'DD/MM/AAAA' : 'Aguardando migração...'}
                                disabled={!extendedCols}
                                className={`${extendedCols ? inputCls : inputDisabledCls} ${ageError ? 'border-red-500/60 focus:border-red-500/60' : ''}`}
                            />
                            {ageError && <p className="text-xs text-red-500 mt-1">{ageError}</p>}
                        </Field>

                        {/* Gender */}
                        <Field label={t('profile_gender')} icon={User}>
                            <select
                                value={profile.genero}
                                onChange={e => setProfile(p => ({ ...p, genero: e.target.value }))}
                                disabled={!extendedCols}
                                className={extendedCols ? inputCls : inputDisabledCls}
                            >
                                {GENDER_OPTIONS.map(o => (
                                    <option key={o.value} value={o.value}>{t(o.label)}</option>
                                ))}
                            </select>
                        </Field>

                        {/* Migration pending notice */}
                        {!extendedCols && (
                            <p className="text-xs text-amber-400/80 bg-amber-500/10 border border-amber-500/20 rounded-xl px-3 py-2 flex items-start gap-2">
                                <span className="mt-0.5">⚠️</span>
                                <span>Os campos CPF, data de nascimento e gênero estão aguardando uma migração no banco de dados. Entre em contato com o administrador do site para executar o script <code className="text-amber-300">009_profiles_extended_columns.sql</code>.</span>
                            </p>
                        )}

                        {/* Save button */}
                        <div className="pt-2">
                            <button
                                onClick={handleSave}
                                disabled={saving}
                                className="w-full flex items-center justify-center gap-2 py-3.5 bg-brand-400 hover:bg-brand-300 disabled:opacity-60 text-zinc-950 font-black rounded-xl transition-colors text-sm"
                            >
                                {saving ? (
                                    <Loader2 className="w-4 h-4 animate-spin" strokeWidth={2} />
                                ) : (
                                    <Save className="w-4 h-4" strokeWidth={2} />
                                )}
                                {saving ? t('common_saving') : t('common_save')}
                            </button>
                        </div>
                    </div>
                </motion.div>
            </div>

            {/* Crop modal */}
            {showCropModal && cropSrc && (
                <CropModal
                    image={cropSrc}
                    onCropComplete={handleCropDone}
                    onCancel={() => setShowCropModal(false)}
                />
            )}
        </div>
    );
}
