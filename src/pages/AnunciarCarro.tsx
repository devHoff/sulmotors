import { useState, useRef, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, X, Loader2, Zap, Car, CheckCircle2, AlertTriangle, ShieldAlert, Shield } from 'lucide-react';
import { toast } from 'sonner';
import { brands, fuels, transmissions } from '../data/mockCars';
import { useBrazilianCities } from '../hooks/useBrazilianCities';
import CropModal from '../components/CropModal';
import AutocompleteInput from '../components/AutocompleteInput';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { supabase } from '../lib/supabase';
import {
    validatePlate,
    validateListing,
    checkScamKeywords,
    canPostToday,
    incrementDailyListingCount,
    remainingListingsToday,
    type ListingValidationResult,
} from '../utils/antiFraud';
import { smToast } from '../utils/toast';

interface FormData {
    marca: string;
    modelo: string;
    versao: string;
    ano: string;
    preco: string;
    quilometragem: string;
    telefone: string;
    descricao: string;
    combustivel: string;
    cambio: string;
    cor: string;
    cidade: string;
    placa: string;
    blindado: boolean;
    aceitaTroca: boolean;
}

const initialForm: FormData = {
    marca: '', modelo: '', versao: '', ano: '', preco: '', quilometragem: '',
    telefone: '', descricao: '', combustivel: '', cambio: '',
    cor: '', cidade: '', placa: '', blindado: false, aceitaTroca: false,
};

const inputClass = "w-full px-4 py-3 bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20 focus:border-brand-400/60 focus:bg-white dark:focus:bg-zinc-800 rounded-xl text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-zinc-500 outline-none transition-all";
const selectClass = "w-full px-4 py-3 bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20 focus:border-brand-400/60 rounded-xl text-sm text-slate-900 dark:text-white outline-none transition-all appearance-none cursor-pointer";
const labelClass = "block text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider mb-2";

// ── Score colour helper ──────────────────────────────────────────────────────
function scoreColor(score: number) {
    if (score >= 80) return { bar: 'bg-emerald-500', text: 'text-emerald-500', label: 'Excelente' };
    if (score >= 60) return { bar: 'bg-brand-400',   text: 'text-brand-400',   label: 'Bom' };
    if (score >= 40) return { bar: 'bg-amber-400',   text: 'text-amber-400',   label: 'Regular' };
    return            { bar: 'bg-red-500',            text: 'text-red-500',     label: 'Fraco' };
}

export default function AnunciarCarro() {
    const navigate = useNavigate();
    const { user } = useAuth();
    const { t } = useLanguage();
    const { cities: brazilianCities } = useBrazilianCities();
    const [form, setForm] = useState<FormData>(initialForm);
    const [images, setImages] = useState<string[]>([]);
    const [uploading, setUploading] = useState(false);
    const [loading, setLoading] = useState(false);
    const [cropModalOpen, setCropModalOpen] = useState(false);
    const [pendingFile, setPendingFile] = useState<File | null>(null);
    const [pendingDataUrl, setPendingDataUrl] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Plate validation state
    const [plateValid, setPlateValid] = useState<boolean | null>(null);

    // Live listing validation
    const [validation, setValidation] = useState<ListingValidationResult | null>(null);

    // Scam keyword check on description
    const [scamWarning, setScamWarning] = useState<string | null>(null);

    // Daily limit info
    const remaining = remainingListingsToday();

    const currentYear = new Date().getFullYear();
    const years = Array.from({ length: 30 }, (_, i) => currentYear - i);

    const update = (key: keyof FormData, value: string | boolean) =>
        setForm((f) => ({ ...f, [key]: value }));

    // Re-run live validation whenever key fields change
    useEffect(() => {
        const price = parseFloat(form.preco) || 0;
        const km    = parseInt(form.quilometragem) || 0;
        const yr    = parseInt(form.ano) || currentYear;
        if (!form.marca || !form.modelo || !price || !form.placa) {
            setValidation(null);
            return;
        }
        const result = validateListing({
            marca: form.marca,
            modelo: form.modelo,
            ano: yr,
            preco: price,
            quilometragem: km,
            descricao: form.descricao,
            imagens: images,
            placa: form.placa,
            combustivel: form.combustivel,
        });
        setValidation(result);
    }, [form.marca, form.modelo, form.ano, form.preco, form.quilometragem, form.descricao, form.placa, images]);

    // Scam keyword check in description
    useEffect(() => {
        if (!form.descricao) { setScamWarning(null); return; }
        const result = checkScamKeywords(form.descricao);
        if (result.flagged) {
            setScamWarning(`⚠️ Atenção: a descrição contém termos suspeitos — "${result.matches.slice(0, 2).join('", "')}". Remova-os para evitar rejeição.`);
        } else {
            setScamWarning(null);
        }
    }, [form.descricao]);

    // Plate validation on change
    const handlePlateChange = (value: string) => {
        const clean = value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 7);
        update('placa', clean);
        if (clean.length === 7) {
            setPlateValid(validatePlate(clean));
        } else {
            setPlateValid(null);
        }
    };

    const handleImageUploadClick = () => {
        if (images.length >= 6) { toast.error('Máximo de 6 fotos atingido.'); return; }
        fileInputRef.current?.click();
    };

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;
        if (!user) { toast.error('Você precisa estar logado para fazer upload.'); return; }
        if (fileInputRef.current) fileInputRef.current.value = '';
        const reader = new FileReader();
        reader.onload = () => {
            setPendingFile(file);
            setPendingDataUrl(reader.result as string);
            setCropModalOpen(true);
        };
        reader.readAsDataURL(file);
    };

    const uploadBlob = useCallback(async (blob: Blob, ext: string, mime: string) => {
        if (!user) return;
        try {
            setUploading(true);
            const fileName = `${user.id}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
            const { error: uploadError } = await supabase.storage
                .from('car-images')
                .upload(fileName, blob, { contentType: mime, upsert: false });
            if (uploadError) throw uploadError;
            const { data } = supabase.storage.from('car-images').getPublicUrl(fileName);
            setImages((imgs) => [...imgs, data.publicUrl]);
            toast.success('Foto enviada com sucesso!');
        } catch {
            toast.error('Erro ao enviar imagem. Tente novamente.');
        } finally {
            setUploading(false);
            setPendingFile(null);
            setPendingDataUrl(null);
            setCropModalOpen(false);
        }
    }, [user]);

    const handleCropComplete = useCallback(async (croppedBlob: Blob) => {
        await uploadBlob(croppedBlob, 'jpg', 'image/jpeg');
    }, [uploadBlob]);

    const handleSkipCrop = useCallback(async () => {
        if (!pendingFile) return;
        const ext = pendingFile.name.split('.').pop()?.toLowerCase() || 'jpg';
        const mime = pendingFile.type || 'image/jpeg';
        await uploadBlob(pendingFile, ext, mime);
    }, [pendingFile, uploadBlob]);

    const handleCropCancel = () => {
        setCropModalOpen(false);
        setPendingFile(null);
        setPendingDataUrl(null);
    };

    const removeImage = (index: number) => setImages((imgs) => imgs.filter((_, i) => i !== index));

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // Daily limit check
        if (!canPostToday()) {
            smToast.dailyLimitReached();
            return;
        }

        if (!form.marca || !form.modelo || !form.ano || !form.preco || !form.telefone) {
            toast.error('Preencha todos os campos obrigatórios.');
            return;
        }
        if (!form.placa.trim()) {
            toast.error('A placa do veículo é obrigatória para segurança.');
            return;
        }
        if (!validatePlate(form.placa)) {
            toast.error('Placa inválida. Use o formato ABC1234 (antigo) ou ABC1D23 (Mercosul).');
            return;
        }
        if (form.descricao.trim().length < 50) {
            toast.error('A descrição deve ter no mínimo 50 caracteres.');
            return;
        }
        if (scamWarning) {
            toast.error('Remova os termos suspeitos da descrição antes de publicar.');
            return;
        }
        if (!user) { toast.error('Você precisa estar logado para anunciar.'); return; }

        try {
            setLoading(true);
            const { error } = await supabase.from('anuncios').insert({
                user_id: user.id, marca: form.marca, modelo: form.modelo,
                ano: parseInt(form.ano), preco: parseFloat(form.preco),
                quilometragem: parseInt(form.quilometragem) || 0,
                telefone: form.telefone, descricao: form.descricao,
                combustivel: form.combustivel, cambio: form.cambio,
                cor: form.cor, cidade: form.cidade,
                versao: form.versao || null,
                placa: form.placa.toUpperCase().replace(/[^A-Z0-9]/g, ''),
                blindado: form.blindado,
                aceita_troca: form.aceitaTroca, imagens: images,
                destaque: false, impulsionado: false,
            });
            if (error) throw error;
            incrementDailyListingCount();
            smToast.listingCreated(`${form.marca} ${form.modelo} ${form.ano}`);
            setTimeout(() => navigate('/meus-anuncios'), 1200);
        } catch {
            toast.error('Erro ao criar anúncio. Tente novamente.');
        } finally {
            setLoading(false);
        }
    };

    const sc = validation ? scoreColor(validation.score) : null;

    return (
        <div className="bg-slate-50 dark:bg-zinc-950 min-h-screen py-12 transition-colors duration-300">
            <div className="max-w-3xl mx-auto px-4 sm:px-6">

                {/* Header */}
                <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="mb-10">
                    <div className="flex items-center gap-2 mb-3">
                        <Car className="w-4 h-4 text-brand-500 dark:text-brand-400" strokeWidth={1.5} />
                        <span className="text-xs font-bold text-brand-500 dark:text-brand-400 uppercase tracking-widest">Novo anúncio</span>
                    </div>
                    <h1 className="text-4xl font-black text-slate-900 dark:text-white tracking-tight mb-2">{t.form_anunciar_title}</h1>
                    <p className="text-slate-500 dark:text-zinc-500 text-sm">{t.form_anunciar_sub}</p>

                    {/* Daily limit indicator */}
                    <div className={`mt-4 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold border ${remaining > 1 ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-600 dark:text-emerald-400' : remaining === 1 ? 'bg-amber-500/10 border-amber-500/25 text-amber-600 dark:text-amber-400' : 'bg-red-500/10 border-red-500/25 text-red-600 dark:text-red-400'}`}>
                        <Shield className="w-3.5 h-3.5" strokeWidth={1.5} />
                        {remaining > 0
                            ? `${remaining} anúncio${remaining > 1 ? 's' : ''} disponível${remaining > 1 ? 'is' : ''} hoje`
                            : 'Limite diário atingido (3/3)'}
                    </div>
                </motion.div>

                <motion.form
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    onSubmit={handleSubmit}
                    className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/8 rounded-2xl overflow-hidden shadow-sm dark:shadow-none"
                >
                    {/* Section: Dados do veículo */}
                    <div className="p-6 md:p-8 border-b border-slate-100 dark:border-white/5">
                        <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-6 flex items-center gap-2">
                            <span className="w-5 h-5 bg-brand-400/20 border border-brand-400/30 rounded-md flex items-center justify-center text-brand-400 text-xs font-black">1</span>
                            {t.form_vehicle_data}
                        </h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                            <div>
                                <label className={labelClass}>{t.form_brand} *</label>
                                <AutocompleteInput
                                    value={form.marca}
                                    onChange={(v) => update('marca', v)}
                                    suggestions={brands}
                                    placeholder={t.form_select_brand}
                                    className={inputClass}
                                    allowCustom={true}
                                    addNewLabel={(v) => `Usar "${v}" como marca`}
                                />
                            </div>
                            <div>
                                <label className={labelClass}>{t.form_model} *</label>
                                <input type="text" value={form.modelo} onChange={(e) => update('modelo', e.target.value)} placeholder="Ex: Civic" className={inputClass} />
                            </div>
                            <div>
                                <label className={labelClass}>Versão / Acabamento</label>
                                <input type="text" value={form.versao} onChange={(e) => update('versao', e.target.value)} placeholder="Ex: EXL, Trekking, Sport" className={inputClass} />
                            </div>
                            <div>
                                <label className={labelClass}>{t.form_year} *</label>
                                <div className="relative">
                                    <select value={form.ano} onChange={(e) => update('ano', e.target.value)} className={selectClass}>
                                        <option value="" className="bg-white dark:bg-zinc-800 text-slate-400 dark:text-zinc-400">{t.form_select_year}</option>
                                        {years.map((y) => <option key={y} value={y} className="bg-white dark:bg-zinc-800 text-slate-900 dark:text-white">{y}</option>)}
                                    </select>
                                    <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500">
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                                    </div>
                                </div>
                            </div>
                            <div>
                                <label className={labelClass}>{t.form_price} *</label>
                                <input type="number" value={form.preco} onChange={(e) => update('preco', e.target.value)} placeholder="Ex: 85000" className={inputClass} />
                            </div>
                            <div>
                                <label className={labelClass}>{t.form_km}</label>
                                <input type="number" value={form.quilometragem} onChange={(e) => update('quilometragem', e.target.value)} placeholder="Ex: 45000" className={inputClass} />
                            </div>
                            <div>
                                <label className={labelClass}>{t.form_phone} *</label>
                                <input type="text" value={form.telefone} onChange={(e) => update('telefone', e.target.value)} placeholder="(11) 99999-9999" className={inputClass} />
                            </div>

                            {/* ── Plate field with live validation ─────────────── */}
                            <div>
                                <label className={labelClass}>
                                    Placa * <span className="text-xs text-slate-400 dark:text-zinc-500 normal-case font-normal">(obrigatório p/ segurança)</span>
                                </label>
                                <div className="relative">
                                    <input
                                        type="text"
                                        value={form.placa}
                                        onChange={(e) => handlePlateChange(e.target.value)}
                                        placeholder="Ex: ABC1D23"
                                        maxLength={7}
                                        className={`${inputClass} pr-10 ${plateValid === false ? 'border-red-400/60' : plateValid === true ? 'border-emerald-400/60' : ''}`}
                                    />
                                    {plateValid === true && (
                                        <CheckCircle2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-500 pointer-events-none" strokeWidth={2} />
                                    )}
                                    {plateValid === false && (
                                        <AlertTriangle className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-red-500 pointer-events-none" strokeWidth={2} />
                                    )}
                                </div>
                                <p className={`text-xs mt-1 ${plateValid === false ? 'text-red-500' : plateValid === true ? 'text-emerald-500' : 'text-slate-400 dark:text-zinc-600'}`}>
                                    {plateValid === false
                                        ? 'Formato inválido. Use ABC1234 (antigo) ou ABC1D23 (Mercosul)'
                                        : plateValid === true
                                            ? '✓ Placa válida'
                                            : 'A placa não será exibida publicamente — usada apenas para verificação.'}
                                </p>
                            </div>
                        </div>

                        {/* Blindado toggle */}
                        <div className="flex items-center justify-between mt-5 p-4 bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-white/8 rounded-xl hover:border-slate-300 dark:hover:border-white/15 transition-colors">
                            <div>
                                <p className="text-sm font-bold text-slate-900 dark:text-white">Veículo Blindado</p>
                                <p className="text-xs text-slate-500 dark:text-zinc-500 mt-0.5">Marque se o veículo possui blindagem</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => update('blindado', !form.blindado)}
                                className={`relative w-12 h-6 rounded-full transition-all duration-300 flex-shrink-0 ${form.blindado ? 'bg-brand-400' : 'bg-zinc-600'}`}
                            >
                                <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-md transition-transform duration-300 ${form.blindado ? 'translate-x-6' : ''}`} />
                            </button>
                        </div>
                    </div>

                    {/* Section: Detalhes técnicos */}
                    <div className="p-6 md:p-8 border-b border-slate-100 dark:border-white/5">
                        <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-6 flex items-center gap-2">
                            <span className="w-5 h-5 bg-brand-400/20 border border-brand-400/30 rounded-md flex items-center justify-center text-brand-400 text-xs font-black">2</span>
                            {t.form_details}
                        </h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                            <div>
                                <label className={labelClass}>{t.form_fuel}</label>
                                <div className="relative">
                                    <select value={form.combustivel} onChange={(e) => update('combustivel', e.target.value)} className={selectClass}>
                                        <option value="" className="bg-white dark:bg-zinc-800 text-slate-400 dark:text-zinc-400">{t.form_select}</option>
                                        {fuels.map((f) => <option key={f} value={f} className="bg-white dark:bg-zinc-800 text-slate-900 dark:text-white">{f}</option>)}
                                    </select>
                                    <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500">
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                                    </div>
                                </div>
                            </div>
                            <div>
                                <label className={labelClass}>{t.form_gearbox}</label>
                                <div className="relative">
                                    <select value={form.cambio} onChange={(e) => update('cambio', e.target.value)} className={selectClass}>
                                        <option value="" className="bg-white dark:bg-zinc-800 text-slate-400 dark:text-zinc-400">{t.form_select}</option>
                                        {transmissions.map((tr) => <option key={tr} value={tr} className="bg-white dark:bg-zinc-800 text-slate-900 dark:text-white">{tr}</option>)}
                                    </select>
                                    <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500">
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                                    </div>
                                </div>
                            </div>
                            <div>
                                <label className={labelClass}>{t.form_color}</label>
                                <input type="text" value={form.cor} onChange={(e) => update('cor', e.target.value)} placeholder="Ex: Prata" className={inputClass} />
                            </div>
                            <div>
                                <label className={labelClass}>{t.form_city}</label>
                                <AutocompleteInput
                                    value={form.cidade}
                                    onChange={(v) => update('cidade', v)}
                                    suggestions={brazilianCities}
                                    placeholder="Ex: Porto Alegre - RS"
                                    className={inputClass}
                                    allowCustom={true}
                                    minChars={2}
                                    addNewLabel={(v) => `Usar "${v}"`}
                                />
                            </div>
                        </div>

                        {/* Aceita troca */}
                        <div className="flex items-center justify-between mt-5 p-4 bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-white/8 rounded-xl hover:border-slate-300 dark:hover:border-white/15 transition-colors">
                            <div>
                                <p className="text-sm font-bold text-slate-900 dark:text-white">{t.form_trade}</p>
                                <p className="text-xs text-slate-500 dark:text-zinc-500 mt-0.5">Aceito receber outro veículo como parte do pagamento</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => update('aceitaTroca', !form.aceitaTroca)}
                                className={`relative w-12 h-6 rounded-full transition-all duration-300 flex-shrink-0 ${form.aceitaTroca ? 'bg-brand-400' : 'bg-zinc-600'}`}
                            >
                                <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-md transition-transform duration-300 ${form.aceitaTroca ? 'translate-x-6' : ''}`} />
                            </button>
                        </div>
                    </div>

                    {/* Section: Descrição */}
                    <div className="p-6 md:p-8 border-b border-slate-100 dark:border-white/5">
                        <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-6 flex items-center gap-2">
                            <span className="w-5 h-5 bg-brand-400/20 border border-brand-400/30 rounded-md flex items-center justify-center text-brand-400 text-xs font-black">3</span>
                            {t.form_description}
                        </h2>
                        <textarea
                            value={form.descricao}
                            onChange={(e) => update('descricao', e.target.value)}
                            rows={5}
                            placeholder="Descreva os detalhes do veículo, opcionais, revisões realizadas, estado de conservação, motivo da venda... (mínimo 50 caracteres)"
                            className={`w-full px-4 py-3 bg-slate-100 dark:bg-zinc-800 border ${scamWarning ? 'border-red-400/60' : form.descricao.length > 0 && form.descricao.length < 50 ? 'border-amber-400/60' : 'border-slate-200 dark:border-white/10'} hover:border-slate-300 dark:hover:border-white/20 focus:border-brand-400/60 rounded-xl text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-zinc-500 outline-none transition-all resize-none`}
                        />
                        <div className="flex items-center justify-between mt-1.5">
                            <div>
                                {scamWarning && (
                                    <p className="text-xs text-red-500 font-semibold flex items-center gap-1">
                                        <ShieldAlert className="w-3.5 h-3.5" strokeWidth={2} />{scamWarning}
                                    </p>
                                )}
                                {!scamWarning && form.descricao.length > 0 && form.descricao.length < 50 && (
                                    <p className="text-xs text-amber-500 font-semibold">Mínimo 50 caracteres ({50 - form.descricao.length} restantes)</p>
                                )}
                                {!scamWarning && form.descricao.length >= 50 && (
                                    <p className="text-xs text-emerald-500 font-semibold">✓ Descrição adequada</p>
                                )}
                            </div>
                            <span className={`text-xs font-medium ${form.descricao.length >= 50 ? 'text-emerald-500' : form.descricao.length > 0 ? 'text-amber-500' : 'text-slate-400 dark:text-zinc-500'}`}>
                                {form.descricao.length}/50+
                            </span>
                        </div>
                    </div>

                    {/* Section: Fotos */}
                    <div className="p-6 md:p-8 border-b border-slate-100 dark:border-white/5">
                        <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-2 flex items-center gap-2">
                            <span className="w-5 h-5 bg-brand-400/20 border border-brand-400/30 rounded-md flex items-center justify-center text-brand-400 text-xs font-black">4</span>
                            {t.form_photos}
                        </h2>
                        <p className="text-xs text-slate-400 dark:text-zinc-500 mb-5">{images.length}/6 fotos adicionadas. Anúncios com 3+ fotos recebem 3× mais contatos.</p>
                        <input type="file" ref={fileInputRef} accept="image/*" onChange={handleFileChange} className="hidden" />
                        <div className="flex flex-wrap gap-3">
                            {images.map((url, i) => (
                                <div key={i} className="relative w-28 h-28 rounded-xl overflow-hidden group border border-slate-200 dark:border-white/10">
                                    <img src={url} alt="" className="w-full h-full object-cover" />
                                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/50 transition-all flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
                                        <button type="button" onClick={() => removeImage(i)}
                                            className="w-8 h-8 bg-red-500 rounded-full flex items-center justify-center hover:bg-red-400 transition-colors">
                                            <X className="w-4 h-4 text-white" strokeWidth={1.5} />
                                        </button>
                                    </div>
                                    <div className="absolute top-1.5 left-1.5 w-5 h-5 bg-black/60 rounded-md flex items-center justify-center text-xs font-bold text-white">{i + 1}</div>
                                </div>
                            ))}
                            {images.length < 6 && (
                                <button type="button" onClick={handleImageUploadClick} disabled={uploading}
                                    className="w-28 h-28 border-2 border-dashed border-slate-300 dark:border-white/15 hover:border-brand-400/50 rounded-xl flex flex-col items-center justify-center text-slate-400 dark:text-zinc-500 hover:text-brand-400 transition-all disabled:opacity-40 group">
                                    {uploading ? (
                                        <Loader2 className="w-6 h-6 animate-spin" strokeWidth={1.5} />
                                    ) : (
                                        <>
                                            <Upload className="w-6 h-6 mb-1.5 group-hover:scale-110 transition-transform" strokeWidth={1.5} />
                                            <span className="text-xs font-bold">{t.form_add_photo}</span>
                                        </>
                                    )}
                                </button>
                            )}
                        </div>
                    </div>

                    {/* ── Live Listing Trust Score Panel ───────────────────── */}
                    <AnimatePresence>
                        {validation && sc && (
                            <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                className="overflow-hidden"
                            >
                                <div className="p-6 md:p-8 border-b border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-zinc-800/30">
                                    <div className="flex items-center justify-between mb-4">
                                        <div className="flex items-center gap-2">
                                            <Shield className="w-4 h-4 text-brand-400" strokeWidth={1.5} />
                                            <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">Qualidade do anúncio</h3>
                                        </div>
                                        <span className={`text-lg font-black ${sc.text}`}>{validation.score}/100 — {sc.label}</span>
                                    </div>

                                    {/* Progress bar */}
                                    <div className="w-full h-2 bg-slate-200 dark:bg-zinc-700 rounded-full overflow-hidden mb-5">
                                        <motion.div
                                            className={`h-full rounded-full ${sc.bar}`}
                                            initial={{ width: 0 }}
                                            animate={{ width: `${validation.score}%` }}
                                            transition={{ duration: 0.6, ease: 'easeOut' }}
                                        />
                                    </div>

                                    {/* Issues */}
                                    {validation.issues.length > 0 && (
                                        <div className="space-y-2">
                                            {validation.issues.map((issue) => (
                                                <div key={issue.code} className={`flex items-start gap-2.5 p-3 rounded-xl text-xs ${issue.severity === 'error' ? 'bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400' : 'bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400'}`}>
                                                    {issue.severity === 'error'
                                                        ? <ShieldAlert className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" strokeWidth={2} />
                                                        : <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" strokeWidth={2} />}
                                                    <span className="leading-relaxed">{issue.message}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {validation.issues.length === 0 && (
                                        <div className="flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-400 font-semibold">
                                            <CheckCircle2 className="w-4 h-4" strokeWidth={2} />
                                            Anúncio excelente! Nenhum problema detectado.
                                        </div>
                                    )}

                                    {validation.requiresReview && (
                                        <div className="mt-3 flex items-center gap-2 p-3 bg-orange-500/10 border border-orange-500/20 rounded-xl text-xs text-orange-600 dark:text-orange-400 font-semibold">
                                            <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" strokeWidth={2} />
                                            Este anúncio será enviado para revisão manual antes de ser publicado.
                                        </div>
                                    )}
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Anti-scam reminder */}
                    <div className="mx-6 md:mx-8 my-4 flex items-start gap-2.5 p-3.5 bg-amber-500/8 border border-amber-500/20 rounded-xl">
                        <ShieldAlert className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" strokeWidth={1.5} />
                        <p className="text-xs text-amber-700 dark:text-amber-400/90 leading-relaxed">
                            <strong>Nunca solicite pagamentos antecipados.</strong> O SulMotors não intermedia pagamentos e não se responsabiliza por transações entre compradores e vendedores.
                        </p>
                    </div>

                    {/* Submit */}
                    <div className="p-6 md:p-8 pt-2">
                        <button
                            type="submit"
                            disabled={loading || uploading || remaining === 0}
                            className="w-full flex items-center justify-center gap-3 py-4 bg-brand-400 hover:bg-brand-300 text-zinc-950 font-black text-sm rounded-xl transition-all hover:shadow-glow active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="w-5 h-5 animate-spin" strokeWidth={1.5} />
                                    {t.form_publishing}
                                </>
                            ) : (
                                <>
                                    <Zap className="w-5 h-5" strokeWidth={1.5} />
                                    {t.form_publish}
                                </>
                            )}
                        </button>
                        <p className="text-center text-xs text-slate-400 dark:text-zinc-600 mt-3">{t.form_disclaimer}</p>
                    </div>
                </motion.form>
            </div>

            <AnimatePresence>
                {cropModalOpen && pendingDataUrl && (
                    <CropModal
                        image={pendingDataUrl}
                        onCropComplete={handleCropComplete}
                        onSkip={handleSkipCrop}
                        onCancel={handleCropCancel}
                    />
                )}
            </AnimatePresence>
        </div>
    );
}
