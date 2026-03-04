import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Upload, X, Sparkles, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { mockCars, brands, fuels, transmissions, type Car } from '../data/mockCars';
import AIPhotoModal from '../components/AIPhotoModal';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import CropModal from '../components/CropModal';
import { AnimatePresence } from 'framer-motion';

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
    const [aiModal, setAiModal] = useState<{ open: boolean; url: string }>({ open: false, url: '' });
    const [selectedImage, setSelectedImage] = useState<string | null>(null);
    const [showCropModal, setShowCropModal] = useState(false);
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

    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        if (!user) {
            toast.error('Você precisa estar logado.');
            return;
        }

        const reader = new FileReader();
        reader.onload = () => {
            setSelectedImage(reader.result as string);
            setShowCropModal(true);
        };
        reader.readAsDataURL(file);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleCropComplete = async (croppedBlob: Blob) => {
        setShowCropModal(false);
        if (!user) return;

        try {
            setUploading(true);
            const fileName = `${Math.random()}.jpg`;
            const filePath = `${user.id}/${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from('car-images')
                .upload(filePath, croppedBlob, {
                    contentType: 'image/jpeg'
                });

            if (uploadError) throw uploadError;

            const { data } = supabase.storage
                .from('car-images')
                .getPublicUrl(filePath);

            setImages((imgs) => [...imgs, data.publicUrl]);
            toast.success('Foto enviada!');
        } catch (error) {
            console.error('Error uploading:', error);
            toast.error('Erro ao enviar imagem.');
        } finally {
            setUploading(false);
            setSelectedImage(null);
        }
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

    if (loading) {
        return (
            <div className="flex justify-center items-center h-[60vh]">
                <Loader2 className="w-8 h-8 animate-spin text-brand-600" />
            </div>
        );
    }

    const inputClass = "w-full px-4 py-3 bg-slate-50 rounded-xl text-sm border border-slate-200 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none";

    return (
        <div className="max-w-3xl mx-auto px-4 py-10">
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                <h1 className="text-3xl font-bold text-slate-900 mb-1">Editar Anúncio</h1>
                <p className="text-slate-500 mb-8">Atualize as informações do seu veículo</p>
            </motion.div>

            <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-slate-200 p-6 md:p-8 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1.5">Marca *</label>
                        <select value={form.marca} onChange={(e) => update('marca', e.target.value)} className={inputClass}>
                            <option value="">Selecione a marca</option>
                            {brands.map((b) => <option key={b} value={b}>{b}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1.5">Modelo *</label>
                        <input type="text" value={form.modelo} onChange={(e) => update('modelo', e.target.value)} placeholder="Ex: Civic EXL" className={inputClass} />
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1.5">Ano *</label>
                        <select value={form.ano} onChange={(e) => update('ano', e.target.value)} className={inputClass}>
                            <option value="">Selecione o ano</option>
                            {years.map((y) => <option key={y} value={y}>{y}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1.5">Preço (R$) *</label>
                        <input type="number" value={form.preco} onChange={(e) => update('preco', e.target.value)} className={inputClass} />
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1.5">Quilometragem</label>
                        <input type="number" value={form.quilometragem} onChange={(e) => update('quilometragem', e.target.value)} className={inputClass} />
                    </div>
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1.5">Telefone *</label>
                        <input type="text" value={form.telefone} onChange={(e) => update('telefone', e.target.value)} className={inputClass} />
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1.5">Combustível</label>
                        <select value={form.combustivel} onChange={(e) => update('combustivel', e.target.value)} className={inputClass}>
                            <option value="">Selecione</option>
                            {fuels.map((f) => <option key={f} value={f}>{f}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1.5">Câmbio</label>
                        <select value={form.cambio} onChange={(e) => update('cambio', e.target.value)} className={inputClass}>
                            <option value="">Selecione</option>
                            {transmissions.map((t) => <option key={t} value={t}>{t}</option>)}
                        </select>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1.5">Cor</label>
                        <input type="text" value={form.cor} onChange={(e) => update('cor', e.target.value)} className={inputClass} />
                    </div>
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1.5">Cidade</label>
                        <input type="text" value={form.cidade} onChange={(e) => update('cidade', e.target.value)} className={inputClass} />
                    </div>
                </div>

                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-200">
                    <span className="text-sm font-semibold text-slate-700">Aceita troca</span>
                    <button type="button" onClick={() => update('aceitaTroca', !form.aceitaTroca)}
                        className={`relative w-12 h-7 rounded-full transition-colors ${form.aceitaTroca ? 'bg-brand-600' : 'bg-slate-300'}`}>
                        <span className={`absolute top-0.5 left-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform ${form.aceitaTroca ? 'translate-x-5' : ''}`} />
                    </button>
                </div>

                <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Descrição</label>
                    <textarea value={form.descricao} onChange={(e) => update('descricao', e.target.value)} rows={4}
                        className={`${inputClass} resize-none`} />
                </div>

                <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-3">Fotos</label>
                    <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/*" />
                    <div className="flex flex-wrap gap-4">
                        {images.map((url, i) => (
                            <div key={i} className="relative w-28 h-28 rounded-xl overflow-hidden group">
                                <img src={url} alt="" className="w-full h-full object-cover" />
                                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100">
                                    <button type="button" onClick={() => setAiModal({ open: true, url })} className="w-8 h-8 bg-white rounded-full flex items-center justify-center">
                                        <Sparkles className="w-4 h-4 text-brand-600" />
                                    </button>
                                    <button type="button" onClick={() => removeImage(i)} className="w-8 h-8 bg-white rounded-full flex items-center justify-center">
                                        <X className="w-4 h-4 text-red-500" />
                                    </button>
                                </div>
                            </div>
                        ))}
                        {images.length < 6 && (
                            <button type="button"
                                onClick={handleImageUploadClick}
                                disabled={uploading}
                                className="w-28 h-28 border-2 border-dashed border-slate-300 rounded-xl flex flex-col items-center justify-center text-slate-400 hover:border-brand-400 hover:text-brand-500 transition-colors">
                                {uploading ? <Loader2 className="w-6 h-6 animate-spin" /> : <>
                                    <Upload className="w-6 h-6 mb-1" />
                                    <span className="text-xs font-medium">Adicionar</span>
                                </>}
                            </button>
                        )}
                    </div>
                </div>

                <button type="submit" disabled={submitting || uploading} className="w-full py-4 bg-brand-600 text-white font-bold text-sm rounded-xl hover:bg-brand-700 transition-all hover:shadow-lg hover:shadow-brand-600/25 active:scale-[0.98] disabled:opacity-70">
                    {submitting ? 'Salvando...' : 'Salvar Alterações'}
                </button>
            </form>

            <AIPhotoModal isOpen={aiModal.open} onClose={() => setAiModal({ open: false, url: '' })} imageUrl={aiModal.url} carBrand={form.marca} />

            <AnimatePresence>
                {showCropModal && selectedImage && (
                    <CropModal
                        image={selectedImage}
                        onCropComplete={handleCropComplete}
                        onCancel={() => {
                            setShowCropModal(false);
                            setSelectedImage(null);
                        }}
                        aspectRatio={4 / 3}
                        cropShape="rect"
                    />
                )}
            </AnimatePresence>
        </div>
    );
}
