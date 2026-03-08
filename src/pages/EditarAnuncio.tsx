import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, X, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { mockCars, brands, fuels, transmissions, type Car } from '../data/mockCars';
import CropModal from '../components/CropModal';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

// Helper interface for the form state
interface FormState {
    marca: string;
    modelo: string;
    ano: string;
    preco: string;
    quilometragem: string;
    telefone: string;
    descricao: string;
    combustivel: string;
    cambio: string;
    cor: string;
    cidade: string;
    aceitaTroca: boolean;
}

export default function EditarAnuncio() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();

    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [uploading, setUploading] = useState(false);

    const [form, setForm] = useState<FormState>({
        marca: '', modelo: '', ano: '', preco: '', quilometragem: '',
        telefone: '', descricao: '', combustivel: '', cambio: '',
        cor: '', cidade: '', aceitaTroca: false,
    });
    const [images, setImages] = useState<string[]>([]);
    const [cropModalOpen, setCropModalOpen] = useState(false);
    const [pendingFile, setPendingFile] = useState<File | null>(null);
    const [pendingDataUrl, setPendingDataUrl] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        async function fetchCar() {
            if (!id) return;

            // 1. Try mock data
            const mockCar = mockCars.find((c) => c.id === id);
            if (mockCar) {
                populateForm(mockCar);
                setLoading(false);
                return;
            }

            // 2. Try Supabase
            try {
                if (!user) {
                    setLoading(false);
                    return;
                }

                const { data, error } = await supabase
                    .from('anuncios')
                    .select('*')
                    .eq('id', id)
                    .single();

                if (error) throw error;

                if (data) {
                    // Check ownership
                    if (data.user_id !== user.id) {
                        toast.error('Você não tem permissão para editar este anúncio.');
                        navigate('/meus-anuncios');
                        return;
                    }

                    const mappedCar: Car = {
                        ...data,
                        aceitaTroca: data.aceita_troca,
                        modelo_3d: data.modelo_3d,
                        imagens: data.imagens || [],
                    };
                    populateForm(mappedCar);
                } else {
                    toast.error('Anúncio não encontrado.');
                    navigate('/meus-anuncios');
                }
            } catch (error) {
                console.error('Error fetching car:', error);
                toast.error('Erro ao carregar anúncio.');
            } finally {
                setLoading(false);
            }
        }

        fetchCar();
    }, [id, user, navigate]);

    const populateForm = (car: Car) => {
        setForm({
            marca: car.marca,
            modelo: car.modelo,
            ano: String(car.ano),
            preco: String(car.preco),
            quilometragem: String(car.quilometragem),
            telefone: car.telefone,
            descricao: car.descricao,
            combustivel: car.combustivel,
            cambio: car.cambio,
            cor: car.cor,
            cidade: car.cidade,
            aceitaTroca: car.aceitaTroca,
        });
        setImages(car.imagens);
    };

    const currentYear = new Date().getFullYear();
    const years = Array.from({ length: 30 }, (_, i) => currentYear - i);

    const update = (key: string, value: string | boolean) => {
        setForm((f) => ({ ...f, [key]: value }));
    };

    const handleImageUploadClick = () => {
        if (images.length >= 6) {
            toast.error('Máximo de 6 fotos atingido.');
            return;
        }
        fileInputRef.current?.click();
    };

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;
        if (!user) { toast.error('Você precisa estar logado.'); return; }
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
            toast.success('Foto enviada!');
        } catch (error) {
            console.error('Error uploading:', error);
            toast.error('Erro ao enviar imagem.');
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

    const removeImage = (index: number) => {
        setImages((imgs) => imgs.filter((_, i) => i !== index));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // Validation
        if (!form.marca || !form.modelo || !form.ano || !form.preco || !form.telefone) {
            toast.error('Preencha os campos obrigatórios.');
            return;
        }

        // If it's a mock car (id <= 8 or whatever), we can't really update it in Supabase
        // But for this implementation, we assume if we are editing, it might be in Supabase
        // If it's not in Supabase, the update will fail or do nothing.
        // We only allow editing real Supabase ads effectively.

        if (!user) {
            toast.error('Você precisa estar logado.');
            return;
        }

        try {
            setSubmitting(true);

            const { error } = await supabase
                .from('anuncios')
                .update({
                    marca: form.marca,
                    modelo: form.modelo,
                    ano: parseInt(form.ano),
                    preco: parseFloat(form.preco),
                    quilometragem: parseInt(form.quilometragem),
                    telefone: form.telefone,
                    descricao: form.descricao,
                    combustivel: form.combustivel,
                    cambio: form.cambio,
                    cor: form.cor,
                    cidade: form.cidade,
                    aceita_troca: form.aceitaTroca,
                    imagens: images,
                })
                .eq('id', id)
                .eq('user_id', user.id); // Security check

            if (error) throw error;

            toast.success('Anúncio atualizado com sucesso!');
            setTimeout(() => navigate('/meus-anuncios'), 1000);
        } catch (error) {
            console.error('Error updating ad:', error);
            toast.error('Erro ao atualizar anúncio.');
        } finally {
            setSubmitting(false);
        }
    };

    const iClass = "w-full px-4 py-3 bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20 focus:border-brand-400/60 rounded-xl text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-zinc-500 outline-none transition-all";
    const sClass = "w-full px-4 py-3 bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20 focus:border-brand-400/60 rounded-xl text-sm text-slate-900 dark:text-white outline-none transition-all appearance-none cursor-pointer";
    const lClass = "block text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider mb-2";
    const chevron = <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg></div>;

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 flex items-center justify-center">
                <div className="w-12 h-12 rounded-full border-2 border-brand-400/20 border-t-brand-400 animate-spin" />
            </div>
        );
    }

    return (
        <>
        <div className="bg-slate-50 dark:bg-zinc-950 min-h-screen py-12 transition-colors duration-300">
            <div className="max-w-3xl mx-auto px-4 sm:px-6">
                <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="mb-10">
                    <h1 className="text-4xl font-black text-slate-900 dark:text-white tracking-tight mb-2">Editar Anúncio</h1>
                    <p className="text-slate-500 dark:text-zinc-500 text-sm">Atualize as informações do seu veículo</p>
                </motion.div>

            <motion.form initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} onSubmit={handleSubmit} className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/8 rounded-2xl overflow-hidden shadow-sm dark:shadow-none">
                <div className="p-6 md:p-8 border-b border-slate-100 dark:border-white/5 space-y-5">
                    <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2"><span className="w-5 h-5 bg-brand-400/20 border border-brand-400/30 rounded-md flex items-center justify-center text-brand-400 text-xs font-black">1</span>Dados do veículo</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div><label className={lClass}>Marca *</label><div className="relative"><select value={form.marca} onChange={(e) => update('marca', e.target.value)} className={sClass}><option value="" className="bg-white dark:bg-zinc-800">Selecione a marca</option>{brands.map((b) => <option key={b} value={b} className="bg-white dark:bg-zinc-800">{b}</option>)}</select>{chevron}</div></div>
                        <div><label className={lClass}>Modelo *</label><input type="text" value={form.modelo} onChange={(e) => update('modelo', e.target.value)} placeholder="Ex: Civic EXL" className={iClass} /></div>
                        <div><label className={lClass}>Ano *</label><div className="relative"><select value={form.ano} onChange={(e) => update('ano', e.target.value)} className={sClass}><option value="" className="bg-white dark:bg-zinc-800">Selecione o ano</option>{years.map((y) => <option key={y} value={y} className="bg-white dark:bg-zinc-800">{y}</option>)}</select>{chevron}</div></div>
                        <div><label className={lClass}>Preço (R$) *</label><input type="number" value={form.preco} onChange={(e) => update('preco', e.target.value)} className={iClass} /></div>
                        <div><label className={lClass}>Quilometragem</label><input type="number" value={form.quilometragem} onChange={(e) => update('quilometragem', e.target.value)} className={iClass} /></div>
                        <div><label className={lClass}>Telefone *</label><input type="text" value={form.telefone} onChange={(e) => update('telefone', e.target.value)} className={iClass} /></div>
                    </div>
                </div>

                <div className="p-6 md:p-8 border-b border-slate-100 dark:border-white/5 space-y-5">
                    <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2"><span className="w-5 h-5 bg-brand-400/20 border border-brand-400/30 rounded-md flex items-center justify-center text-brand-400 text-xs font-black">2</span>Detalhes técnicos</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div><label className={lClass}>Combustível</label><div className="relative"><select value={form.combustivel} onChange={(e) => update('combustivel', e.target.value)} className={sClass}><option value="" className="bg-white dark:bg-zinc-800">Selecione</option>{fuels.map((f) => <option key={f} value={f} className="bg-white dark:bg-zinc-800">{f}</option>)}</select>{chevron}</div></div>
                        <div><label className={lClass}>Câmbio</label><div className="relative"><select value={form.cambio} onChange={(e) => update('cambio', e.target.value)} className={sClass}><option value="" className="bg-white dark:bg-zinc-800">Selecione</option>{transmissions.map((t) => <option key={t} value={t} className="bg-white dark:bg-zinc-800">{t}</option>)}</select>{chevron}</div></div>
                        <div><label className={lClass}>Cor</label><input type="text" value={form.cor} onChange={(e) => update('cor', e.target.value)} className={iClass} /></div>
                        <div><label className={lClass}>Cidade</label><input type="text" value={form.cidade} onChange={(e) => update('cidade', e.target.value)} className={iClass} /></div>
                    </div>
                    <div className="flex items-center justify-between p-4 bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-white/8 rounded-xl">
                        <div><p className="text-sm font-bold text-slate-900 dark:text-white">Aceita troca</p><p className="text-xs text-slate-500 dark:text-zinc-500 mt-0.5">Aceito receber outro veículo como parte do pagamento</p></div>
                        <button type="button" onClick={() => update('aceitaTroca', !form.aceitaTroca)} className={`relative w-12 h-6 rounded-full transition-all duration-300 flex-shrink-0 ${form.aceitaTroca ? 'bg-brand-400' : 'bg-zinc-600'}`}><span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-md transition-transform duration-300 ${form.aceitaTroca ? 'translate-x-6' : ''}`} /></button>
                    </div>
                </div>

                <div className="p-6 md:p-8 border-b border-slate-100 dark:border-white/5">
                    <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2 mb-4"><span className="w-5 h-5 bg-brand-400/20 border border-brand-400/30 rounded-md flex items-center justify-center text-brand-400 text-xs font-black">3</span>Descrição</h2>
                    <textarea value={form.descricao} onChange={(e) => update('descricao', e.target.value)} rows={4} className="w-full px-4 py-3 bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20 focus:border-brand-400/60 rounded-xl text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-zinc-500 outline-none transition-all resize-none" />
                </div>

                <div className="p-6 md:p-8 border-b border-slate-100 dark:border-white/5">
                    <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2 mb-5"><span className="w-5 h-5 bg-brand-400/20 border border-brand-400/30 rounded-md flex items-center justify-center text-brand-400 text-xs font-black">4</span>Fotos</h2>
                    <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/*" />
                    <div className="flex flex-wrap gap-3">
                        {images.map((url, i) => (
                            <div key={i} className="relative w-28 h-28 rounded-xl overflow-hidden group border border-slate-200 dark:border-white/10">
                                <img src={url} alt="" className="w-full h-full object-cover" />
                                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/50 transition-all flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
                                    <button type="button" onClick={() => removeImage(i)} className="w-8 h-8 bg-red-500 rounded-full flex items-center justify-center"><X className="w-4 h-4 text-white" strokeWidth={1.5} /></button>
                                </div>
                            </div>
                        ))}
                        {images.length < 6 && (
                            <button type="button" onClick={handleImageUploadClick} disabled={uploading} className="w-28 h-28 border-2 border-dashed border-slate-300 dark:border-white/15 hover:border-brand-400/50 rounded-xl flex flex-col items-center justify-center text-slate-400 dark:text-zinc-500 hover:text-brand-400 transition-all disabled:opacity-40">
                                {uploading ? <Loader2 className="w-6 h-6 animate-spin" strokeWidth={1.5} /> : <><Upload className="w-6 h-6 mb-1.5" strokeWidth={1.5} /><span className="text-xs font-bold">Adicionar</span></>}
                            </button>
                        )}
                    </div>
                </div>

                <div className="p-6 md:p-8">
                    <button type="submit" disabled={submitting || uploading} className="w-full flex items-center justify-center gap-3 py-4 bg-brand-400 hover:bg-brand-300 text-zinc-950 font-black text-sm rounded-xl transition-all hover:shadow-glow active:scale-[0.98] disabled:opacity-50">
                        {submitting ? <><Loader2 className="w-5 h-5 animate-spin" strokeWidth={1.5} />Salvando...</> : 'Salvar Alterações'}
                    </button>
                </div>
            </motion.form>
            </div>

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
        </>
    );
}
