/**
 * PainelLoja.tsx — Painel exclusivo para lojas parceiras (ex: AlexMegamotors)
 *
 * Acesso restrito: apenas o email vinculado à loja pode acessar.
 * Funcionalidades:
 *  - Dashboard com estatísticas dos anúncios da loja
 *  - Listagem completa dos anúncios com ações (editar, pausar, excluir)
 *  - Criar novo anúncio com loja vinculada automaticamente
 *  - Visualização de status (ativo, pausado, destaque)
 */

import { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ALEX_MEGAMOTORS_LOGO } from '../assets/alexMegamotorsLogo';
import {
    Plus, Car, Trash2, Edit3, Eye, Star, TrendingUp,
    LogOut, BarChart2, CheckCircle2, XCircle, AlertCircle,
    Phone, MapPin, Image as ImageIcon, RefreshCw, Search,
    ChevronDown, Zap, ShieldCheck, X, Upload, Loader2,
    Database, ClipboardCopy, ChevronUp
} from 'lucide-react';
import { toast } from '../utils/toast';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { getStoreByEmail, getStoreKeyByUserId } from '../lib/storeProfiles';
import { brands, fuels, transmissions } from '../data/mockCars';
import { useBrazilianCities } from '../hooks/useBrazilianCities';
import CropModal from '../components/CropModal';
import AutocompleteInput from '../components/AutocompleteInput';

// ── Loja config ───────────────────────────────────────────────────────────────
// Map of authorized email → store key in STORE_PROFILES
const STORE_EMAIL_MAP: Record<string, string> = {
    'bandasleonardo@gmail.com': 'alexmegamotors',
};

// ── Types ─────────────────────────────────────────────────────────────────────
interface Listing {
    id: string;
    marca: string;
    modelo: string;
    ano: number;
    preco: number;
    quilometragem: number;
    cidade: string;
    imagens: string[];
    destaque: boolean;
    impulsionado: boolean;
    created_at: string;
    loja?: string;
    combustivel: string;
    cambio: string;
    cor: string;
    telefone: string;
    descricao: string;
    aceita_troca: boolean;
    slug?: string;
}

interface FormState {
    marca: string; modelo: string; versao: string; ano: string;
    preco: string; quilometragem: string; telefone: string;
    descricao: string; combustivel: string; cambio: string;
    cor: string; cidade: string; aceitaTroca: boolean;
}

const EMPTY_FORM: FormState = {
    marca: '', modelo: '', versao: '', ano: '', preco: '',
    quilometragem: '', telefone: '+55 51 98044-6474',
    descricao: '', combustivel: '', cambio: '',
    cor: '', cidade: 'Porto Alegre, RS', aceitaTroca: false,
};

const inputCls = "w-full px-4 py-3 bg-zinc-800 border border-white/10 hover:border-white/20 focus:border-brand-400/60 rounded-xl text-sm text-white placeholder-zinc-500 outline-none transition-all";
const selectCls = "w-full px-4 py-3 bg-zinc-800 border border-white/10 hover:border-white/20 focus:border-brand-400/60 rounded-xl text-sm text-white outline-none transition-all appearance-none cursor-pointer";
const labelCls = "block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2";

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatPrice(v: number) {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0 }).format(v);
}
function formatKm(v: number) {
    return v === 0 ? '0 km' : `${new Intl.NumberFormat('pt-BR').format(v)} km`;
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function PainelLoja() {
    const navigate   = useNavigate();
    const { user, signOut } = useAuth();
    const { cities: brazilianCities } = useBrazilianCities();

    // ── Auth guard ────────────────────────────────────────────────────────────
    const store = getStoreByEmail(user?.email);

    // ── State ─────────────────────────────────────────────────────────────────
    const [listings, setListings]           = useState<Listing[]>([]);
    const [loading, setLoading]             = useState(true);
    const [migrationNeeded, setMigrationNeeded] = useState(false);
    const [migrationBannerOpen, setMigrationBannerOpen] = useState(true);
    const [sqlCopied, setSqlCopied]         = useState(false);
    const [search, setSearch]               = useState('');
    const [activeTab, setActiveTab]         = useState<'listings' | 'new' | 'edit'>('listings');
    const [editTarget, setEditTarget]       = useState<Listing | null>(null);

    // Form state (new / edit)
    const [form, setForm]       = useState<FormState>(EMPTY_FORM);
    const [images, setImages]   = useState<string[]>([]);
    const [submitting, setSubmitting] = useState(false);
    const [uploading, setUploading]   = useState(false);

    // Crop modal
    const [cropOpen, setCropOpen]           = useState(false);
    const [pendingFile, setPendingFile]     = useState<File | null>(null);
    const [pendingDataUrl, setPendingDataUrl] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // ── Redirect if not authorized ────────────────────────────────────────────
    useEffect(() => {
        if (!user) { navigate('/login?from=/loja/painel'); return; }
        if (!store) { navigate('/'); return; }
    }, [user, store, navigate]);

    // ── Load listings ─────────────────────────────────────────────────────────
    const loadListings = useCallback(async () => {
        if (!user) return;
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('anuncios')
                .select('*')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false });
            if (error) throw error;
            setListings(data || []);
        } catch {
            toast.error('Erro ao carregar anúncios.');
        } finally {
            setLoading(false);
        }
    }, [user]);

    useEffect(() => { if (user && store) loadListings(); }, [user, store, loadListings]);

    // ── Check if profiles migration is needed ────────────────────────────────
    useEffect(() => {
        (async () => {
            if (!user) return;
            const { error } = await supabase
                .from('profiles')
                .select('cpf')
                .eq('id', user.id)
                .single();
            // PGRST204 = column not found in schema cache → migration needed
            if (error?.code === 'PGRST204' || error?.message?.includes('cpf')) {
                setMigrationNeeded(true);
            }
        })();
    }, [user]);

    const MIGRATION_SQL = `-- Cole este SQL no Supabase Dashboard → SQL Editor e clique em RUN
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS cpf             TEXT,
  ADD COLUMN IF NOT EXISTS data_nascimento DATE,
  ADD COLUMN IF NOT EXISTS genero          TEXT;

CREATE INDEX IF NOT EXISTS idx_profiles_cpf ON public.profiles (cpf)
  WHERE cpf IS NOT NULL;`;

    const copySql = () => {
        navigator.clipboard.writeText(MIGRATION_SQL);
        setSqlCopied(true);
        setTimeout(() => setSqlCopied(false), 2000);
    };

    // ── Image upload ──────────────────────────────────────────────────────────
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        e.target.value = '';
        const reader = new FileReader();
        reader.onload = ev => {
            setPendingFile(file);
            setPendingDataUrl(ev.target?.result as string);
            setCropOpen(true);
        };
        reader.readAsDataURL(file);
    };

    const handleCropDone = async (croppedBlob: Blob) => {
        setUploading(true);
        try {
            const ext  = pendingFile?.name.split('.').pop() || 'jpg';
            const name = `loja/${user!.id}/${Date.now()}.${ext}`;
            const { error: upErr } = await supabase.storage.from('car-images').upload(name, croppedBlob, { contentType: croppedBlob.type, upsert: false });
            if (upErr) throw upErr;
            const { data } = supabase.storage.from('car-images').getPublicUrl(name);
            setImages(imgs => [...imgs, data.publicUrl]);
        } catch {
            toast.error('Erro ao fazer upload da imagem.');
        } finally {
            setUploading(false);
            setCropOpen(false);
            setPendingFile(null);
            setPendingDataUrl(null);
        }
    };

    // ── Submit new listing ────────────────────────────────────────────────────
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.marca || !form.modelo || !form.ano || !form.preco || !form.telefone) {
            toast.error('Preencha todos os campos obrigatórios.');
            return;
        }
        if (form.descricao.trim().length < 30) {
            toast.error('A descrição deve ter no mínimo 30 caracteres.');
            return;
        }
        if (!user || !store) return;
        setSubmitting(true);
        try {
            // Base payload — only confirmed columns in anuncios table
            const basePayload = {
                user_id: user.id,
                marca: form.marca, modelo: form.modelo,
                ano: parseInt(form.ano), preco: parseFloat(form.preco.replace(/\D/g, '') || '0'),
                quilometragem: parseInt(form.quilometragem) || 0,
                telefone: form.telefone, descricao: form.descricao,
                combustivel: form.combustivel, cambio: form.cambio,
                cor: form.cor, cidade: form.cidade,
                aceita_troca: form.aceitaTroca, imagens: images,
                destaque: false, impulsionado: false,
            };
            // Try with loja column (if migration was applied)
            let result = await supabase.from('anuncios').insert({ ...basePayload, loja: store.name });
            if (result.error?.code === 'PGRST204' || result.error?.message?.includes('loja')) {
                result = await supabase.from('anuncios').insert(basePayload);
            }
            if (result.error) throw result.error;
            toast.success(`${form.marca} ${form.modelo} publicado com sucesso!`);
            setForm(EMPTY_FORM);
            setImages([]);
            setActiveTab('listings');
            loadListings();
        } catch (err: any) {
            toast.error('Erro ao publicar: ' + (err.message || 'tente novamente'));
        } finally {
            setSubmitting(false);
        }
    };

    // ── Submit edit ───────────────────────────────────────────────────────────
    const handleEditSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editTarget || !user) return;
        setSubmitting(true);
        try {
            const baseUpdate = {
                marca: form.marca, modelo: form.modelo,
                ano: parseInt(form.ano), preco: parseFloat(form.preco.replace(/\D/g, '') || '0'),
                quilometragem: parseInt(form.quilometragem) || 0,
                telefone: form.telefone, descricao: form.descricao,
                combustivel: form.combustivel, cambio: form.cambio,
                cor: form.cor, cidade: form.cidade,
                aceita_troca: form.aceitaTroca, imagens: images,
            };
            // Try with loja column first, fallback without if column missing
            let result = await supabase.from('anuncios').update({ ...baseUpdate, loja: store?.name })
                .eq('id', editTarget.id).eq('user_id', user.id);
            if (result.error?.code === 'PGRST204' || result.error?.message?.includes('loja')) {
                result = await supabase.from('anuncios').update(baseUpdate)
                    .eq('id', editTarget.id).eq('user_id', user.id);
            }
            if (result.error) throw result.error;
            toast.success('Anúncio atualizado!');
            setActiveTab('listings');
            setEditTarget(null);
            loadListings();
        } catch (err: any) {
            toast.error('Erro ao atualizar: ' + (err.message || 'tente novamente'));
        } finally {
            setSubmitting(false);
        }
    };

    // ── Delete listing ────────────────────────────────────────────────────────
    const handleDelete = async (id: string, name: string) => {
        if (!confirm(`Excluir permanentemente "${name}"?`)) return;
        try {
            const { error } = await supabase.from('anuncios').delete().eq('id', id).eq('user_id', user!.id);
            if (error) throw error;
            setListings(ls => ls.filter(l => l.id !== id));
            toast.success('Anúncio excluído.');
        } catch {
            toast.error('Erro ao excluir.');
        }
    };

    // ── Toggle destaque ───────────────────────────────────────────────────────
    const handleToggleDestaque = async (listing: Listing) => {
        try {
            const { error } = await supabase.from('anuncios')
                .update({ destaque: !listing.destaque })
                .eq('id', listing.id).eq('user_id', user!.id);
            if (error) throw error;
            setListings(ls => ls.map(l => l.id === listing.id ? { ...l, destaque: !l.destaque } : l));
            toast.success(listing.destaque ? 'Removido dos destaques.' : 'Marcado como destaque!');
        } catch {
            toast.error('Erro ao atualizar destaque.');
        }
    };

    // ── Open edit ─────────────────────────────────────────────────────────────
    const openEdit = (l: Listing) => {
        setEditTarget(l);
        setForm({
            marca: l.marca, modelo: l.modelo, versao: '',
            ano: String(l.ano), preco: String(l.preco),
            quilometragem: String(l.quilometragem),
            telefone: l.telefone, descricao: l.descricao,
            combustivel: l.combustivel, cambio: l.cambio,
            cor: l.cor, cidade: l.cidade, aceitaTroca: l.aceita_troca,
        });
        setImages(l.imagens || []);
        setActiveTab('edit');
    };

    // ── Stats ─────────────────────────────────────────────────────────────────
    const total     = listings.length;
    const destaque  = listings.filter(l => l.destaque).length;
    const boost     = listings.filter(l => l.impulsionado).length;
    const totalVal  = listings.reduce((s, l) => s + l.preco, 0);

    // ── Filter ────────────────────────────────────────────────────────────────
    const filtered = listings.filter(l =>
        `${l.marca} ${l.modelo} ${l.ano} ${l.cidade}`.toLowerCase().includes(search.toLowerCase())
    );

    // ── Not authorized ────────────────────────────────────────────────────────
    if (!user || !store) return null;

    // ── Form shared JSX ───────────────────────────────────────────────────────
    const renderForm = (onSubmit: (e: React.FormEvent) => void, title: string) => (
        <form onSubmit={onSubmit} className="space-y-6 max-w-3xl">
            <div className="flex items-center justify-between mb-2">
                <h2 className="text-xl font-black text-white">{title}</h2>
                <button type="button" onClick={() => { setActiveTab('listings'); setEditTarget(null); }}
                    className="flex items-center gap-1.5 text-sm text-zinc-400 hover:text-white transition-colors">
                    <X className="w-4 h-4" /> Cancelar
                </button>
            </div>

            {/* Basic info */}
            <div className="bg-zinc-900 border border-white/8 rounded-2xl p-6 space-y-4">
                <p className="text-xs font-bold text-brand-400 uppercase tracking-widest mb-1">Informações do veículo</p>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className={labelCls}>Marca *</label>
                        <select value={form.marca} onChange={e => setForm(f => ({ ...f, marca: e.target.value, modelo: '' }))} className={selectCls} required>
                            <option value="">Selecione</option>
                            {brands.map(b => <option key={b} value={b}>{b}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className={labelCls}>Modelo *</label>
                        <input value={form.modelo} onChange={e => setForm(f => ({ ...f, modelo: e.target.value }))}
                            placeholder="Ex: Civic EXL" className={inputCls} required />
                    </div>
                    <div>
                        <label className={labelCls}>Versão</label>
                        <input value={form.versao} onChange={e => setForm(f => ({ ...f, versao: e.target.value }))}
                            placeholder="Ex: Sport" className={inputCls} />
                    </div>
                    <div>
                        <label className={labelCls}>Ano *</label>
                        <input type="number" value={form.ano} onChange={e => setForm(f => ({ ...f, ano: e.target.value }))}
                            placeholder="2023" min="1990" max="2026" className={inputCls} required />
                    </div>
                    <div>
                        <label className={labelCls}>Preço (R$) *</label>
                        <input type="number" value={form.preco} onChange={e => setForm(f => ({ ...f, preco: e.target.value }))}
                            placeholder="85000" min="0" className={inputCls} required />
                    </div>
                    <div>
                        <label className={labelCls}>Quilometragem</label>
                        <input type="number" value={form.quilometragem} onChange={e => setForm(f => ({ ...f, quilometragem: e.target.value }))}
                            placeholder="0" min="0" className={inputCls} />
                    </div>
                    <div>
                        <label className={labelCls}>Combustível</label>
                        <select value={form.combustivel} onChange={e => setForm(f => ({ ...f, combustivel: e.target.value }))} className={selectCls}>
                            <option value="">Selecione</option>
                            {fuels.map(f => <option key={f} value={f}>{f}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className={labelCls}>Câmbio</label>
                        <select value={form.cambio} onChange={e => setForm(f => ({ ...f, cambio: e.target.value }))} className={selectCls}>
                            <option value="">Selecione</option>
                            {transmissions.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className={labelCls}>Cor</label>
                        <input value={form.cor} onChange={e => setForm(f => ({ ...f, cor: e.target.value }))}
                            placeholder="Preto" className={inputCls} />
                    </div>
                    <div>
                        <label className={labelCls}>Cidade *</label>
                        <AutocompleteInput
                            value={form.cidade}
                            onChange={v => setForm(f => ({ ...f, cidade: v }))}
                            suggestions={brazilianCities}
                            placeholder="Porto Alegre, RS"
                            className={inputCls}
                        />
                    </div>
                    <div>
                        <label className={labelCls}>Telefone *</label>
                        <input value={form.telefone} onChange={e => setForm(f => ({ ...f, telefone: e.target.value }))}
                            placeholder="+55 51 98044-6474" className={inputCls} required />
                    </div>
                    <div className="flex items-center gap-3 pt-6">
                        <input type="checkbox" id="troca" checked={form.aceitaTroca}
                            onChange={e => setForm(f => ({ ...f, aceitaTroca: e.target.checked }))}
                            className="w-4 h-4 accent-brand-400 cursor-pointer" />
                        <label htmlFor="troca" className="text-sm text-zinc-300 cursor-pointer">Aceita troca</label>
                    </div>
                </div>

                <div>
                    <label className={labelCls}>Descrição *</label>
                    <textarea value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))}
                        rows={4} placeholder="Descreva o veículo com detalhes (mínimo 30 caracteres)..."
                        className={inputCls + ' resize-none'} required />
                    <p className="text-xs text-zinc-600 mt-1">{form.descricao.length} caracteres</p>
                </div>
            </div>

            {/* Images */}
            <div className="bg-zinc-900 border border-white/8 rounded-2xl p-6">
                <p className="text-xs font-bold text-brand-400 uppercase tracking-widest mb-4">Fotos do veículo</p>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                    {images.map((url, i) => (
                        <div key={i} className="relative aspect-[4/3] rounded-xl overflow-hidden bg-zinc-800 group">
                            <img src={url} alt="" className="w-full h-full object-contain" />
                            <button type="button" onClick={() => setImages(imgs => imgs.filter((_, j) => j !== i))}
                                className="absolute top-1 right-1 w-6 h-6 bg-red-600 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                <X className="w-3 h-3 text-white" />
                            </button>
                            {i === 0 && <span className="absolute bottom-1 left-1 px-1.5 py-0.5 bg-brand-500/80 text-zinc-950 text-[10px] font-bold rounded">Capa</span>}
                        </div>
                    ))}
                    {images.length < 20 && (
                        <button type="button" onClick={() => fileInputRef.current?.click()}
                            disabled={uploading}
                            className="aspect-[4/3] rounded-xl border-2 border-dashed border-white/20 hover:border-brand-400/60 flex flex-col items-center justify-center gap-2 text-zinc-500 hover:text-brand-400 transition-all">
                            {uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Upload className="w-5 h-5" />}
                            <span className="text-xs font-bold">{uploading ? 'Enviando...' : 'Adicionar'}</span>
                        </button>
                    )}
                </div>
                <input type="file" ref={fileInputRef} accept="image/*" className="hidden" onChange={handleFileChange} />
                <p className="text-xs text-zinc-600 mt-3">Máximo 20 fotos. A primeira foto é a capa do anúncio.</p>
            </div>

            {/* Submit */}
            <button type="submit" disabled={submitting}
                className="flex items-center justify-center gap-2.5 w-full py-4 bg-gradient-to-r from-brand-500 to-brand-400 hover:from-brand-400 hover:to-brand-300 text-zinc-950 font-black rounded-xl transition-all disabled:opacity-60 text-sm">
                {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
                {submitting ? 'Publicando...' : (activeTab === 'edit' ? 'Salvar alterações' : 'Publicar anúncio')}
            </button>
        </form>
    );

    // ─────────────────────────────────────────────────────────────────────────
    return (
        <div className="min-h-screen bg-zinc-950 text-white">

            {/* ── Top bar ──────────────────────────────────────────────────── */}
            <header className="sticky top-0 z-40 bg-zinc-950/95 backdrop-blur-md border-b border-white/8">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
                    {/* Logo + store name */}
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-black border border-white/15 flex-shrink-0 flex items-center justify-center overflow-hidden">
                            <img src={store.logo || ALEX_MEGAMOTORS_LOGO} alt={store.name} className="w-full h-full object-contain" />
                        </div>
                        <div>
                            <p className="text-xs text-zinc-500 leading-none">Painel</p>
                            <p className="font-black text-white text-sm leading-tight">{store.name}</p>
                        </div>
                    </div>

                    {/* Nav tabs */}
                    <nav className="hidden sm:flex items-center gap-1 bg-zinc-900 border border-white/8 rounded-xl p-1">
                        {([
                            { id: 'listings', label: 'Meus Anúncios', icon: Car },
                            { id: 'new',      label: 'Novo Anúncio',  icon: Plus },
                        ] as const).map(tab => (
                            <button key={tab.id} onClick={() => { setActiveTab(tab.id); setEditTarget(null); }}
                                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === tab.id
                                    ? 'bg-brand-500 text-zinc-950'
                                    : 'text-zinc-400 hover:text-white'}`}>
                                <tab.icon className="w-3.5 h-3.5" strokeWidth={2} />
                                {tab.label}
                            </button>
                        ))}
                    </nav>

                    {/* Right actions */}
                    <div className="flex items-center gap-2">
                        {/* Link to public store page */}
                        {getStoreKeyByUserId(user?.id) && (
                            <Link
                                to={`/loja/${getStoreKeyByUserId(user?.id)}`}
                                target="_blank"
                                className="hidden sm:flex items-center gap-1.5 px-3 py-2 bg-zinc-900 border border-white/10 hover:border-brand-400/40 text-zinc-400 hover:text-white text-xs font-bold rounded-xl transition-all">
                                <Eye className="w-3.5 h-3.5" /> Página da loja
                            </Link>
                        )}
                        <Link to="/estoque" target="_blank"
                            className="hidden sm:flex items-center gap-1.5 px-3 py-2 bg-zinc-900 border border-white/10 hover:border-brand-400/40 text-zinc-400 hover:text-white text-xs font-bold rounded-xl transition-all">
                            <Eye className="w-3.5 h-3.5" /> Ver site
                        </Link>
                        <button onClick={() => { signOut(); navigate('/login'); }}
                            className="flex items-center gap-1.5 px-3 py-2 bg-zinc-900 border border-white/10 hover:border-red-500/40 text-zinc-400 hover:text-red-400 text-xs font-bold rounded-xl transition-all">
                            <LogOut className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">Sair</span>
                        </button>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8">

                {/* ── Migration notice ───────────────────────────────────── */}
                <AnimatePresence>
                {migrationNeeded && migrationBannerOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4"
                    >
                        <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                                <Database className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" strokeWidth={1.5} />
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-bold text-amber-300">Migração de banco de dados pendente</p>
                                    <p className="text-xs text-amber-400/80 mt-0.5">
                                        Para habilitar campos de CPF, data de nascimento e gênero nos perfis, execute o SQL abaixo no
                                        {' '}<a href="https://supabase.com/dashboard/project/imkzkvlktrixaxougqie/sql" target="_blank" rel="noopener noreferrer" className="underline hover:text-amber-300">Supabase Dashboard → SQL Editor</a>.
                                    </p>
                                    <div className="mt-3 relative">
                                        <pre className="text-xs text-zinc-300 bg-zinc-900/80 border border-white/10 rounded-xl p-3 overflow-x-auto whitespace-pre-wrap">{MIGRATION_SQL}</pre>
                                        <button
                                            onClick={copySql}
                                            className="absolute top-2 right-2 flex items-center gap-1.5 px-2 py-1 bg-zinc-800 hover:bg-zinc-700 border border-white/10 rounded-lg text-xs text-zinc-400 hover:text-white transition-all"
                                        >
                                            {sqlCopied ? <CheckCircle2 className="w-3.5 h-3.5 text-green-400" /> : <ClipboardCopy className="w-3.5 h-3.5" />}
                                            {sqlCopied ? 'Copiado!' : 'Copiar SQL'}
                                        </button>
                                    </div>
                                </div>
                            </div>
                            <button onClick={() => setMigrationBannerOpen(false)}
                                className="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-lg text-zinc-500 hover:text-white hover:bg-zinc-800 transition-all">
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    </motion.div>
                )}
                </AnimatePresence>

                {/* ── Stats bar ──────────────────────────────────────────── */}
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                    className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    {[
                        { label: 'Anúncios ativos', value: total,            icon: Car,       color: 'text-brand-400' },
                        { label: 'Em destaque',      value: destaque,         icon: Star,      color: 'text-amber-400' },
                        { label: 'Impulsionados',    value: boost,            icon: Zap,       color: 'text-purple-400' },
                        { label: 'Portfólio total',  value: formatPrice(totalVal), icon: BarChart2, color: 'text-emerald-400', wide: true },
                    ].map((s, i) => (
                        <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.07 }}
                            className="bg-zinc-900 border border-white/8 rounded-2xl p-5">
                            <div className="flex items-center gap-2 mb-2">
                                <s.icon className={`w-4 h-4 ${s.color}`} strokeWidth={1.5} />
                                <p className="text-xs text-zinc-500 font-medium">{s.label}</p>
                            </div>
                            <p className={`text-2xl font-black ${s.color}`}>{s.value}</p>
                        </motion.div>
                    ))}
                </motion.div>

                {/* ── Listings tab ──────────────────────────────────────── */}
                <AnimatePresence mode="wait">
                    {activeTab === 'listings' && (
                        <motion.div key="listings" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>

                            {/* Header row */}
                            <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
                                <div>
                                    <h2 className="text-xl font-black text-white">Seus anúncios</h2>
                                    <p className="text-xs text-zinc-500 mt-0.5">{total} veículo{total !== 1 ? 's' : ''} cadastrado{total !== 1 ? 's' : ''}</p>
                                </div>
                                <div className="flex items-center gap-2 flex-wrap">
                                    {/* Search */}
                                    <div className="relative">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" strokeWidth={1.5} />
                                        <input value={search} onChange={e => setSearch(e.target.value)}
                                            placeholder="Buscar..." className="pl-9 pr-4 py-2.5 bg-zinc-900 border border-white/10 rounded-xl text-sm text-white placeholder-zinc-500 outline-none focus:border-brand-400/50 w-48 transition-all" />
                                    </div>
                                    <button onClick={() => loadListings()} title="Atualizar"
                                        className="w-10 h-10 bg-zinc-900 border border-white/10 rounded-xl flex items-center justify-center text-zinc-400 hover:text-white transition-colors">
                                        <RefreshCw className="w-4 h-4" strokeWidth={1.5} />
                                    </button>
                                    <button onClick={() => setActiveTab('new')}
                                        className="flex items-center gap-2 px-4 py-2.5 bg-brand-500 hover:bg-brand-400 text-zinc-950 text-sm font-black rounded-xl transition-all">
                                        <Plus className="w-4 h-4" strokeWidth={2} /> Novo anúncio
                                    </button>
                                </div>
                            </div>

                            {loading ? (
                                <div className="flex items-center justify-center py-24">
                                    <div className="w-10 h-10 rounded-full border-2 border-brand-400/20 border-t-brand-400 animate-spin" />
                                </div>
                            ) : filtered.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-24 bg-zinc-900 rounded-2xl border border-white/5">
                                    <Car className="w-14 h-14 text-zinc-700 mb-4" strokeWidth={1.5} />
                                    <p className="font-black text-white mb-1">{search ? 'Nenhum resultado' : 'Nenhum anúncio ainda'}</p>
                                    <p className="text-zinc-500 text-sm mb-6">{search ? 'Tente outro termo de busca' : 'Publique seu primeiro veículo'}</p>
                                    {!search && (
                                        <button onClick={() => setActiveTab('new')}
                                            className="flex items-center gap-2 px-5 py-3 bg-brand-500 text-zinc-950 font-black rounded-xl text-sm">
                                            <Plus className="w-4 h-4" /> Publicar agora
                                        </button>
                                    )}
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {filtered.map((l, i) => (
                                        <motion.div key={l.id}
                                            initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: i * 0.04 }}
                                            className="bg-zinc-900 border border-white/8 rounded-2xl p-4 flex items-center gap-4 hover:border-white/15 transition-all group">

                                            {/* Thumbnail */}
                                            <div className="w-20 h-14 rounded-xl overflow-hidden bg-zinc-800 flex-shrink-0">
                                                {l.imagens?.[0]
                                                    ? <img src={l.imagens[0]} alt="" className="w-full h-full object-contain" />
                                                    : <div className="w-full h-full flex items-center justify-center"><ImageIcon className="w-6 h-6 text-zinc-600" /></div>
                                                }
                                            </div>

                                            {/* Info */}
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <p className="font-bold text-white text-sm truncate">
                                                        {l.marca} {l.modelo} {l.ano}
                                                    </p>
                                                    {l.destaque && (
                                                        <span className="px-1.5 py-0.5 bg-amber-500/20 border border-amber-500/30 text-amber-400 text-[10px] font-bold rounded">DESTAQUE</span>
                                                    )}
                                                    {l.impulsionado && (
                                                        <span className="px-1.5 py-0.5 bg-purple-500/20 border border-purple-500/30 text-purple-400 text-[10px] font-bold rounded">IMPULSIONADO</span>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-3 mt-1 flex-wrap">
                                                    <span className="text-brand-400 font-black text-sm">{formatPrice(l.preco)}</span>
                                                    <span className="text-zinc-500 text-xs flex items-center gap-1">
                                                        <MapPin className="w-3 h-3" /> {l.cidade}
                                                    </span>
                                                    <span className="text-zinc-600 text-xs">{formatKm(l.quilometragem)}</span>
                                                </div>
                                            </div>

                                            {/* Actions */}
                                            <div className="flex items-center gap-2 flex-shrink-0">
                                                {/* View */}
                                                <Link to={`/carro/${l.slug || l.id}`} target="_blank"
                                                    className="w-9 h-9 bg-zinc-800 hover:bg-zinc-700 border border-white/10 rounded-xl flex items-center justify-center text-zinc-400 hover:text-white transition-all"
                                                    title="Ver anúncio">
                                                    <Eye className="w-4 h-4" strokeWidth={1.5} />
                                                </Link>
                                                {/* Edit */}
                                                <button onClick={() => openEdit(l)}
                                                    className="w-9 h-9 bg-zinc-800 hover:bg-brand-500/20 border border-white/10 hover:border-brand-500/40 rounded-xl flex items-center justify-center text-zinc-400 hover:text-brand-400 transition-all"
                                                    title="Editar">
                                                    <Edit3 className="w-4 h-4" strokeWidth={1.5} />
                                                </button>
                                                {/* Destaque */}
                                                <button onClick={() => handleToggleDestaque(l)}
                                                    className={`w-9 h-9 border rounded-xl flex items-center justify-center transition-all ${l.destaque
                                                        ? 'bg-amber-500/20 border-amber-500/40 text-amber-400'
                                                        : 'bg-zinc-800 border-white/10 text-zinc-400 hover:text-amber-400 hover:border-amber-500/30'}`}
                                                    title={l.destaque ? 'Remover destaque' : 'Marcar como destaque'}>
                                                    <Star className={`w-4 h-4 ${l.destaque ? 'fill-amber-400' : ''}`} strokeWidth={1.5} />
                                                </button>
                                                {/* Delete */}
                                                <button onClick={() => handleDelete(l.id, `${l.marca} ${l.modelo} ${l.ano}`)}
                                                    className="w-9 h-9 bg-zinc-800 hover:bg-red-500/20 border border-white/10 hover:border-red-500/40 rounded-xl flex items-center justify-center text-zinc-400 hover:text-red-400 transition-all"
                                                    title="Excluir">
                                                    <Trash2 className="w-4 h-4" strokeWidth={1.5} />
                                                </button>
                                            </div>
                                        </motion.div>
                                    ))}
                                </div>
                            )}
                        </motion.div>
                    )}

                    {/* ── New listing tab ─────────────────────────────────── */}
                    {activeTab === 'new' && (
                        <motion.div key="new" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                            {renderForm(handleSubmit, 'Publicar novo veículo')}
                        </motion.div>
                    )}

                    {/* ── Edit listing tab ─────────────────────────────────── */}
                    {activeTab === 'edit' && editTarget && (
                        <motion.div key="edit" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                            {renderForm(handleEditSubmit, `Editar: ${editTarget.marca} ${editTarget.modelo} ${editTarget.ano}`)}
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* ── Mobile bottom nav ──────────────────────────────────── */}
                <div className="sm:hidden fixed bottom-0 left-0 right-0 bg-zinc-950/95 backdrop-blur-md border-t border-white/8 flex">
                    {([
                        { id: 'listings', label: 'Anúncios', icon: Car },
                        { id: 'new',      label: 'Novo',     icon: Plus },
                    ] as const).map(tab => (
                        <button key={tab.id} onClick={() => { setActiveTab(tab.id); setEditTarget(null); }}
                            className={`flex-1 flex flex-col items-center justify-center gap-1 py-3 text-xs font-bold transition-all ${activeTab === tab.id ? 'text-brand-400' : 'text-zinc-500'}`}>
                            <tab.icon className="w-5 h-5" strokeWidth={activeTab === tab.id ? 2 : 1.5} />
                            {tab.label}
                        </button>
                    ))}
                </div>
            </main>

            {/* Crop modal */}
            {cropOpen && pendingDataUrl && (
                <CropModal
                    image={pendingDataUrl}
                    onCropComplete={handleCropDone}
                    onCancel={() => { setCropOpen(false); setPendingFile(null); setPendingDataUrl(null); }}
                />
            )}
        </div>
    );
}
