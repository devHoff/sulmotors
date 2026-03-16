import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Search, SlidersHorizontal, X, Car, ArrowUpDown, ChevronDown, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import CarCard from '../components/CarCard';
import { brands, type Car as CarType } from '../data/mockCars';
import { supabasePublic } from '../lib/supabase';
import { useLanguage } from '../contexts/LanguageContext';
import { computeScore } from '../lib/rankingService';
import { STORE_PROFILES } from '../lib/storeProfiles';



export default function Estoque() {
    const { t } = useLanguage();
    const [searchParams] = useSearchParams();
    const initialQuery   = searchParams.get('q')    || '';
    const selectedLoja   = searchParams.get('loja') || '';

    // Resolve store profile from ?loja= param
    const activeStoreProfile = selectedLoja ? STORE_PROFILES[selectedLoja.toLowerCase()] : undefined;

    const [loading, setLoading]           = useState(true);
    const [supabaseCars, setSupabaseCars] = useState<CarType[]>([]);
    const [search, setSearch]             = useState(initialQuery);

    // ── Brand filter: search-box + multi-tag ─────────────────────────────────
    const [selectedBrands, setSelectedBrands] = useState<string[]>([]);
    const [brandSearch, setBrandSearch]       = useState('');
    const [brandDropOpen, setBrandDropOpen]   = useState(false);
    const brandRef = useRef<HTMLDivElement>(null);

    // ── Price filter: dual input + slider + quick buttons ────────────────────
    const [minPriceInDB, setMinPriceInDB] = useState(0);
    const [maxPriceInDB, setMaxPriceInDB] = useState(1000000);
    const [priceMin, setPriceMin]         = useState(0);
    const [priceMax, setPriceMax]         = useState(1000000);
    const [priceMinInput, setPriceMinInput] = useState('');
    const [priceMaxInput, setPriceMaxInput] = useState('');
    const [priceFilterEnabled, setPriceFilterEnabled] = useState(false);
    const sliderTrackRef = useRef<HTMLDivElement>(null);
    const draggingThumb  = useRef<'min' | 'max' | null>(null);

    // ── Year filter ───────────────────────────────────────────────────────────
    const currentYear = new Date().getFullYear();
    const [yearMin, setYearMin] = useState(2000);

    // ── Sort & misc ───────────────────────────────────────────────────────────
    const [showFilters, setShowFilters] = useState(false);
    const [sortOrder, setSortOrder]     = useState<'default' | 'asc' | 'desc'>('default');
    const [sortOpen, setSortOpen]       = useState(false);
    const sortRef = useRef<HTMLDivElement>(null);

    // Close dropdowns on outside click
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (sortRef.current  && !sortRef.current.contains(e.target as Node))  setSortOpen(false);
            if (brandRef.current && !brandRef.current.contains(e.target as Node)) setBrandDropOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    // Fetch cars from Supabase
    useEffect(() => {
        const fetchCars = async () => {
            setLoading(true);

            // Helper: map raw DB row → CarType
            const mapRow = (d: any): CarType => ({
                id: d.id, marca: d.marca, modelo: d.modelo, ano: Number(d.ano),
                preco: Number(d.preco), quilometragem: d.quilometragem,
                telefone: d.telefone, descricao: d.descricao || '',
                combustivel: d.combustivel, cambio: d.cambio, cor: d.cor,
                cidade: d.cidade, aceitaTroca: d.aceita_troca ?? false,
                imagens: d.imagens || [], destaque: d.destaque ?? false,
                impulsionado: d.impulsionado ?? false,
                impulsionado_ate: d.impulsionado_ate || undefined,
                prioridade: Number(d.prioridade ?? 0), modelo_3d: false,
                created_at: d.created_at, user_id: d.user_id, loja: d.user_id,
                slug: d.slug,
            });

            try {
                const { data, error } = await supabasePublic
                    .from('anuncios')
                    .select('*')
                    .order('prioridade', { ascending: false })
                    .order('created_at',  { ascending: false });

                if (error) {
                    console.error('[Estoque] fetch error:', error.message);
                    setLoading(false);
                    return;
                }

                const mapped = (data || []).map(mapRow);
                setSupabaseCars(mapped);

                if (mapped.length > 0) {
                    const prices = mapped.map((c: CarType) => c.preco);
                    const dbMin = Math.floor(Math.min(...prices));
                    const dbMax = Math.ceil(Math.max(...prices));
                    setMinPriceInDB(dbMin); setMaxPriceInDB(dbMax);
                    setPriceMin(dbMin); setPriceMax(dbMax);
                    setPriceMinInput(String(dbMin)); setPriceMaxInput(String(dbMax));
                }
            } catch (err) {
                console.error('[Estoque] unexpected error:', err);
            } finally {
                setLoading(false);
            }
        };
        fetchCars();
    }, []);

    // ── Slider drag logic ──────────────────────────────────────────────────────
    const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

    const xToPrice = useCallback((clientX: number) => {
        const track = sliderTrackRef.current;
        if (!track) return 0;
        const { left, width } = track.getBoundingClientRect();
        const ratio = clamp((clientX - left) / width, 0, 1);
        return Math.round(minPriceInDB + ratio * (maxPriceInDB - minPriceInDB));
    }, [minPriceInDB, maxPriceInDB]);

    useEffect(() => {
        const onMove = (e: PointerEvent) => {
            if (!draggingThumb.current) return;
            const price = xToPrice(e.clientX);
            if (draggingThumb.current === 'min') {
                const v = clamp(price, minPriceInDB, priceMax - 1);
                setPriceMin(v);
                setPriceMinInput(String(v));
            } else {
                const v = clamp(price, priceMin + 1, maxPriceInDB);
                setPriceMax(v);
                setPriceMaxInput(String(v));
            }
        };
        const onUp = () => { draggingThumb.current = null; };
        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup',   onUp);
        return () => {
            window.removeEventListener('pointermove', onMove);
            window.removeEventListener('pointerup',   onUp);
        };
    }, [xToPrice, minPriceInDB, maxPriceInDB, priceMin, priceMax]);

    const pct = (v: number) =>
        maxPriceInDB === minPriceInDB ? 0
        : ((v - minPriceInDB) / (maxPriceInDB - minPriceInDB)) * 100;

    // ── Price input helpers ────────────────────────────────────────────────────
    const applyMinInput = (raw: string) => {
        const n = parseInt(raw.replace(/\D/g, ''), 10);
        if (!isNaN(n)) {
            const v = clamp(n, minPriceInDB, priceMax - 1);
            setPriceMin(v);
            setPriceMinInput(String(v));
        }
    };
    const applyMaxInput = (raw: string) => {
        const n = parseInt(raw.replace(/\D/g, ''), 10);
        if (!isNaN(n)) {
            const v = clamp(n, priceMin + 1, maxPriceInDB);
            setPriceMax(v);
            setPriceMaxInput(String(v));
        }
    };

    // Quick price presets
    const quickPresets = [30000, 50000, 80000, 100000];

    // ── Brand multi-select helpers ─────────────────────────────────────────────
    const toggleBrand = (brand: string) =>
        setSelectedBrands(prev =>
            prev.includes(brand) ? prev.filter(b => b !== brand) : [...prev, brand]);

    const filteredBrandSuggestions = brands.filter(
        b => b.toLowerCase().includes(brandSearch.toLowerCase()) && !selectedBrands.includes(b)
    );

    const activeFilters =
        selectedBrands.length > 0 ||
        (priceFilterEnabled && (priceMin > minPriceInDB || priceMax < maxPriceInDB)) ||
        yearMin > 2000 ||
        sortOrder !== 'default';

    const clearFilters = () => {
        setSelectedBrands([]);
        setBrandSearch('');
        setPriceFilterEnabled(false);
        setPriceMin(minPriceInDB);
        setPriceMax(maxPriceInDB);
        setPriceMinInput(String(minPriceInDB));
        setPriceMaxInput(String(maxPriceInDB));
        setYearMin(2000);
        setSearch('');
        setSortOrder('default');
    };

    const filteredCars = useMemo(() => {
        return supabaseCars.filter(car => {
            const q = search.toLowerCase();
            const matchesSearch  = q === '' || `${car.marca} ${car.modelo}`.toLowerCase().includes(q);
            const matchesBrand   = selectedBrands.length === 0 || selectedBrands.includes(car.marca);
            const matchesPrice   = !priceFilterEnabled || (car.preco >= priceMin && car.preco <= priceMax);
            const matchesYear    = car.ano >= yearMin;
            // Match by user_id when filtering by store (no loja column in DB)
            const matchesLoja    = !activeStoreProfile || car.user_id === activeStoreProfile.userId;
            return matchesSearch && matchesBrand && matchesPrice && matchesYear && matchesLoja;
        }).sort((a, b) => {
            if (sortOrder === 'asc')  return a.preco - b.preco;
            if (sortOrder === 'desc') return b.preco - a.preco;
            // Default: sort by ranking score (boost + recency + views + favorites)
            const scoreA = computeScore(a as unknown as Parameters<typeof computeScore>[0]);
            const scoreB = computeScore(b as unknown as Parameters<typeof computeScore>[0]);
            if (scoreB !== scoreA) return scoreB - scoreA;
            return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        });
    }, [search, selectedBrands, priceFilterEnabled, priceMin, priceMax, yearMin, supabaseCars, activeStoreProfile, sortOrder]);

    // ── Formatting helper ──────────────────────────────────────────────────────
    const fmtBRL = (n: number) =>
        new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0 }).format(n);

    const inputCls = "w-full px-3 py-2 bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-white/10 focus:border-brand-400/60 rounded-lg text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-zinc-500 outline-none transition-all";

    return (
        <div className="bg-slate-50 dark:bg-zinc-950 min-h-screen transition-colors duration-300">

            {/* ── Page Header ─────────────────────────────────────────────────── */}
            <div className="relative z-10 border-b border-slate-200 dark:border-white/5 bg-white dark:bg-zinc-900/50 backdrop-blur-sm transition-colors">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                        <div>
                            <p className="text-xs font-bold text-brand-500 dark:text-brand-400 uppercase tracking-widest mb-2">
                                {filteredCars.length} veículos encontrados
                            </p>
                            {activeStoreProfile && (
                                <div className="flex items-center gap-3 mb-2">
                                    <img src={activeStoreProfile.logo} alt={activeStoreProfile.name}
                                        className="w-10 h-10 object-contain rounded-lg bg-zinc-800 p-1"
                                    />
                                    <Link to={`/loja/${selectedLoja}`}
                                        className="text-xs font-bold text-brand-400 uppercase tracking-widest hover:text-brand-300 transition-colors">
                                        Ver perfil da loja →
                                    </Link>
                                </div>
                            )}
                            <h1 className="text-3xl md:text-4xl font-black text-slate-900 dark:text-white tracking-tight">
                                {activeStoreProfile ? activeStoreProfile.name : 'Estoque completo'}
                            </h1>
                            <p className="text-slate-500 dark:text-zinc-500 mt-1 text-sm">
                                {activeStoreProfile
                                    ? `Todos os veículos da ${activeStoreProfile.name}${activeStoreProfile.tagline ? ' · ' + activeStoreProfile.tagline : ''}`
                                    : 'Encontre o carro ideal para você'}
                            </p>
                        </div>
                        <div className="flex gap-3 flex-wrap">
                            {/* Sort Dropdown */}
                            <div className="relative" ref={sortRef}>
                                <button
                                    onClick={() => setSortOpen(o => !o)}
                                    className={`flex items-center gap-2 pl-3 pr-3 py-3 rounded-xl border text-sm font-bold transition-all whitespace-nowrap
                                        ${sortOrder !== 'default'
                                            ? 'bg-brand-400/15 border-brand-400/40 text-brand-500 dark:text-brand-400'
                                            : 'bg-slate-100 dark:bg-zinc-900 border-slate-200 dark:border-white/10 text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'}`}>
                                    <ArrowUpDown className="w-3.5 h-3.5 flex-shrink-0" strokeWidth={1.5} />
                                    <span>{sortOrder === 'asc' ? 'Menor preço' : sortOrder === 'desc' ? 'Maior preço' : 'Ordenar por'}</span>
                                    <ChevronDown className={`w-3.5 h-3.5 flex-shrink-0 transition-transform ${sortOpen ? 'rotate-180' : ''}`} strokeWidth={1.5} />
                                </button>
                                <AnimatePresence>
                                    {sortOpen && (
                                        <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.13 }}
                                            className="absolute left-0 top-full mt-1 z-[999] min-w-[160px] rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-zinc-900 shadow-lg overflow-hidden">
                                            {(['default', 'asc', 'desc'] as const).map(val => (
                                                <button key={val} onClick={() => { setSortOrder(val); setSortOpen(false); }}
                                                    className={`w-full text-left px-4 py-2.5 text-sm font-medium transition-colors
                                                        ${sortOrder === val ? 'bg-brand-400/10 text-brand-500 dark:text-brand-400' : 'text-slate-700 dark:text-zinc-200 hover:bg-slate-100 dark:hover:bg-white/8'}`}>
                                                    {val === 'default' ? t('estoque_sort_default') : val === 'asc' ? t('estoque_sort_asc') : t('estoque_sort_desc')}
                                                </button>
                                            ))}
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>

                            {/* Search bar */}
                            <div className="relative flex-1 md:w-80">
                                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-zinc-500" strokeWidth={1.5} />
                                <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                                    placeholder={t('estoque_search_placeholder')}
                                    className="w-full pl-10 pr-4 py-3 bg-slate-100 dark:bg-zinc-900 border border-slate-200 dark:border-white/10 focus:border-brand-400/60 rounded-xl text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-zinc-500 outline-none transition-all" />
                            </div>

                            {/* Mobile filters toggle */}
                            <button onClick={() => setShowFilters(!showFilters)}
                                className={`md:hidden flex items-center gap-2 px-4 py-3 rounded-xl border text-sm font-bold transition-all
                                    ${showFilters ? 'bg-brand-400/15 border-brand-400/40 text-brand-500 dark:text-brand-400'
                                                  : 'bg-slate-100 dark:bg-zinc-900 border-slate-200 dark:border-white/10 text-slate-600 dark:text-zinc-400'}`}>
                                <SlidersHorizontal className="w-4 h-4" strokeWidth={1.5} /> {t('estoque_filters')}
                                {activeFilters && <span className="w-1.5 h-1.5 bg-brand-400 rounded-full" />}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="flex flex-col md:flex-row gap-8">

                    {/* ── Sidebar Filters ─────────────────────────────────────── */}
                    <div className={`md:w-72 flex-shrink-0 ${showFilters ? 'block' : 'hidden md:block'}`}>
                        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-white/8 p-6 sticky top-24 shadow-sm dark:shadow-none space-y-6">

                            {/* Header */}
                            <div className="flex items-center justify-between">
                                <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                    <SlidersHorizontal className="w-4 h-4 text-brand-500 dark:text-brand-400" strokeWidth={1.5} /> {t('estoque_filters')}
                                </h3>
                                {activeFilters && (
                                    <button onClick={clearFilters} className="text-xs font-bold text-red-500 hover:text-red-400 flex items-center gap-1 transition-colors">
                                        <X className="w-3 h-3" strokeWidth={1.5} /> {t('estoque_clear')}
                                    </button>
                                )}
                            </div>

                            {/* ── Brand search + tags ─────────────────────────── */}
                            <div>
                                <h4 className="text-xs font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider mb-2">{t('estoque_filter_brand')}</h4>
                                {selectedBrands.length > 0 && (
                                    <div className="flex flex-wrap gap-1.5 mb-2">
                                        {selectedBrands.map(b => (
                                            <span key={b} className="inline-flex items-center gap-1 px-2 py-1 bg-brand-400/15 border border-brand-400/30 text-brand-500 dark:text-brand-400 text-xs font-bold rounded-lg">
                                                {b}
                                                <button onClick={() => toggleBrand(b)} className="hover:text-red-400 transition-colors">
                                                    <X className="w-2.5 h-2.5" strokeWidth={2} />
                                                </button>
                                            </span>
                                        ))}
                                    </div>
                                )}
                                <div className="relative" ref={brandRef}>
                                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 dark:text-zinc-500 pointer-events-none" strokeWidth={1.5} />
                                    <input
                                        type="text"
                                        value={brandSearch}
                                        onChange={e => { setBrandSearch(e.target.value); setBrandDropOpen(true); }}
                                        onFocus={() => setBrandDropOpen(true)}
                                        placeholder={t('estoque_brand_search')}
                                        className="w-full pl-8 pr-3 py-2 bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-white/10 focus:border-brand-400/60 rounded-lg text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-zinc-500 outline-none transition-all"
                                    />
                                    <AnimatePresence>
                                        {brandDropOpen && filteredBrandSuggestions.length > 0 && (
                                            <motion.ul
                                                initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
                                                transition={{ duration: 0.1 }}
                                                className="absolute left-0 right-0 top-full mt-1 z-50 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-zinc-900 shadow-lg overflow-hidden max-h-52 overflow-y-auto">
                                                {filteredBrandSuggestions.map(b => (
                                                    <li key={b}>
                                                        <button
                                                            type="button"
                                                            onMouseDown={e => { e.preventDefault(); toggleBrand(b); setBrandSearch(''); setBrandDropOpen(false); }}
                                                            className="w-full text-left px-3 py-2 text-xs font-medium text-slate-700 dark:text-zinc-200 hover:bg-brand-400/10 hover:text-brand-500 dark:hover:text-brand-400 transition-colors">
                                                            {b}
                                                        </button>
                                                    </li>
                                                ))}
                                            </motion.ul>
                                        )}
                                    </AnimatePresence>
                                </div>
                                {selectedBrands.length === 0 && !brandSearch && (
                                    <p className="text-xs text-slate-400 dark:text-zinc-600 mt-1.5 italic">Todas as marcas</p>
                                )}
                            </div>

                            {/* ── Price range filter ──────────────────────────── */}
                            <div>
                                <div className="flex items-center justify-between mb-3">
                                    <h4 className="text-xs font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider">Preço</h4>
                                    <button
                                        onClick={() => setPriceFilterEnabled(v => !v)}
                                        className={`w-8 h-4 rounded-full transition-colors flex items-center px-0.5 ${priceFilterEnabled ? 'bg-brand-400' : 'bg-slate-300 dark:bg-zinc-600'}`}>
                                        <div className={`w-3 h-3 rounded-full bg-white shadow transition-transform ${priceFilterEnabled ? 'translate-x-4' : ''}`} />
                                    </button>
                                </div>

                                {priceFilterEnabled ? (
                                    <div className="space-y-4">
                                        {/* Dual inputs */}
                                        <div className="grid grid-cols-2 gap-2">
                                            <div>
                                                <label className="text-xs text-slate-400 dark:text-zinc-500 mb-1 block">Mínimo</label>
                                                <div className="relative">
                                                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 pointer-events-none">R$</span>
                                                    <input
                                                        type="text"
                                                        inputMode="numeric"
                                                        value={priceMinInput}
                                                        onChange={e => setPriceMinInput(e.target.value)}
                                                        onBlur={e => applyMinInput(e.target.value)}
                                                        onKeyDown={e => e.key === 'Enter' && applyMinInput(priceMinInput)}
                                                        className="w-full pl-7 pr-2 py-2 bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-white/10 focus:border-brand-400/60 rounded-lg text-xs text-slate-900 dark:text-white outline-none transition-all"
                                                    />
                                                </div>
                                            </div>
                                            <div>
                                                <label className="text-xs text-slate-400 dark:text-zinc-500 mb-1 block">Máximo</label>
                                                <div className="relative">
                                                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 pointer-events-none">R$</span>
                                                    <input
                                                        type="text"
                                                        inputMode="numeric"
                                                        value={priceMaxInput}
                                                        onChange={e => setPriceMaxInput(e.target.value)}
                                                        onBlur={e => applyMaxInput(e.target.value)}
                                                        onKeyDown={e => e.key === 'Enter' && applyMaxInput(priceMaxInput)}
                                                        className="w-full pl-7 pr-2 py-2 bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-white/10 focus:border-brand-400/60 rounded-lg text-xs text-slate-900 dark:text-white outline-none transition-all"
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        {/* Dual-thumb slider */}
                                        <div className="pt-1 pb-3 px-1">
                                            <div
                                                ref={sliderTrackRef}
                                                className="relative h-1.5 bg-slate-200 dark:bg-zinc-700 rounded-full cursor-pointer select-none"
                                            >
                                                {/* Fill */}
                                                <div
                                                    className="absolute h-full bg-brand-400 rounded-full"
                                                    style={{ left: `${pct(priceMin)}%`, right: `${100 - pct(priceMax)}%` }}
                                                />
                                                {/* Min thumb */}
                                                <div
                                                    className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-4 h-4 bg-white border-2 border-brand-400 rounded-full shadow cursor-grab active:cursor-grabbing z-10 hover:scale-125 transition-transform"
                                                    style={{ left: `${pct(priceMin)}%` }}
                                                    onPointerDown={e => { e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId); draggingThumb.current = 'min'; }}
                                                />
                                                {/* Max thumb */}
                                                <div
                                                    className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-4 h-4 bg-white border-2 border-brand-400 rounded-full shadow cursor-grab active:cursor-grabbing z-10 hover:scale-125 transition-transform"
                                                    style={{ left: `${pct(priceMax)}%` }}
                                                    onPointerDown={e => { e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId); draggingThumb.current = 'max'; }}
                                                />
                                            </div>
                                            <div className="flex justify-between mt-2">
                                                <span className="text-xs text-brand-500 dark:text-brand-400 font-semibold">{fmtBRL(priceMin)}</span>
                                                <span className="text-xs text-brand-500 dark:text-brand-400 font-semibold">{fmtBRL(priceMax)}</span>
                                            </div>
                                        </div>

                                        {/* Quick preset buttons */}
                                        <div>
                                            <p className="text-xs text-slate-400 dark:text-zinc-500 mb-2">{t('estoque_price_range')}:</p>
                                            <div className="flex flex-wrap gap-1.5">
                                                {quickPresets.map(p => (
                                                    <button
                                                        key={p}
                                                        onClick={() => {
                                                            const v = clamp(p, priceMin + 1, maxPriceInDB);
                                                            setPriceMax(v);
                                                            setPriceMaxInput(String(v));
                                                        }}
                                                        className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition-all
                                                            ${priceMax === p
                                                                ? 'bg-brand-400/20 border-brand-400/50 text-brand-500 dark:text-brand-400'
                                                                : 'bg-slate-100 dark:bg-zinc-800 border-slate-200 dark:border-white/10 text-slate-600 dark:text-zinc-400 hover:border-brand-400/40 hover:text-brand-500'}`}>
                                                        Até {p >= 1000 ? `${p / 1000}k` : p}
                                                    </button>
                                                ))}
                                                <button
                                                    onClick={() => {
                                                        setPriceMax(maxPriceInDB);
                                                        setPriceMaxInput(String(maxPriceInDB));
                                                    }}
                                                    className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition-all
                                                        ${priceMax === maxPriceInDB
                                                            ? 'bg-brand-400/20 border-brand-400/50 text-brand-500 dark:text-brand-400'
                                                            : 'bg-slate-100 dark:bg-zinc-800 border-slate-200 dark:border-white/10 text-slate-600 dark:text-zinc-400 hover:border-brand-400/40 hover:text-brand-500'}`}>
                                                    Qualquer
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <p className="text-xs text-slate-400 dark:text-zinc-600 italic">Sem limite de preço</p>
                                )}
                            </div>

                            {/* ── Year min input ──────────────────────────────── */}
                            <div>
                                <h4 className="text-xs font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider mb-2">Ano mínimo</h4>
                                <input
                                    type="number"
                                    min="1950"
                                    max={currentYear + 1}
                                    value={yearMin === 2000 ? '' : yearMin}
                                    onChange={e => {
                                        const v = parseInt(e.target.value);
                                        setYearMin(isNaN(v) ? 2000 : v);
                                    }}
                                    placeholder={`Ex: ${currentYear - 5}`}
                                    className={inputCls}
                                />
                                {yearMin > 2000 && (
                                    <p className="text-xs text-brand-500 dark:text-brand-400 mt-1 font-semibold">
                                        A partir de {yearMin}
                                    </p>
                                )}
                            </div>

                            {/* ── Contact CTA ──────────────────────────────────── */}
                            <a
                                href="mailto:contato@sulmotor.com?subject=Ajuda para encontrar veículo"
                                className="flex items-center gap-2 w-full px-3 py-2.5 bg-brand-400/10 border border-brand-400/30 text-brand-500 dark:text-brand-400 rounded-xl text-xs font-bold hover:bg-brand-400/20 transition-colors">
                                <Zap className="w-3.5 h-3.5" strokeWidth={1.5} />
                                {t('estoque_contact_btn')}
                            </a>
                        </div>
                    </div>

                    {/* ── Car Grid ─────────────────────────────────────────────── */}
                    <div className="flex-1">

                        {/* Active filter chips */}
                        {activeFilters && (
                            <div className="flex flex-wrap items-center gap-2 mb-6">
                                {selectedBrands.map(brand => (
                                    <span key={brand} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-brand-400/10 border border-brand-400/20 text-brand-500 dark:text-brand-400 text-xs font-bold rounded-lg">
                                        {brand}
                                        <button onClick={() => toggleBrand(brand)}><X className="w-3 h-3" strokeWidth={1.5} /></button>
                                    </span>
                                ))}
                                {priceFilterEnabled && (priceMin > minPriceInDB || priceMax < maxPriceInDB) && (
                                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-brand-400/10 border border-brand-400/20 text-brand-500 dark:text-brand-400 text-xs font-bold rounded-lg">
                                        {fmtBRL(priceMin)} – {fmtBRL(priceMax)}
                                        <button onClick={() => { setPriceMin(minPriceInDB); setPriceMax(maxPriceInDB); setPriceMinInput(String(minPriceInDB)); setPriceMaxInput(String(maxPriceInDB)); }}>
                                            <X className="w-3 h-3" strokeWidth={1.5} />
                                        </button>
                                    </span>
                                )}
                                {yearMin > 2000 && (
                                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-brand-400/10 border border-brand-400/20 text-brand-500 dark:text-brand-400 text-xs font-bold rounded-lg">
                                        A partir de {yearMin}
                                        <button onClick={() => setYearMin(2000)}><X className="w-3 h-3" strokeWidth={1.5} /></button>
                                    </span>
                                )}
                                {sortOrder !== 'default' && (
                                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-brand-400/10 border border-brand-400/20 text-brand-500 dark:text-brand-400 text-xs font-bold rounded-lg">
                                        {sortOrder === 'asc' ? 'Menor preço' : 'Maior preço'}
                                        <button onClick={() => setSortOrder('default')}><X className="w-3 h-3" strokeWidth={1.5} /></button>
                                    </span>
                                )}
                            </div>
                        )}

                        {loading ? (
                            <div className="flex flex-col items-center justify-center py-32">
                                <div className="w-12 h-12 rounded-full border-2 border-brand-400/20 border-t-brand-400 animate-spin mb-4" />
                                <p className="text-slate-500 dark:text-zinc-500 text-sm">Carregando veículos...</p>
                            </div>
                        ) : (
                            <AnimatePresence mode="popLayout">
                                {filteredCars.length > 0 ? (
                                    <motion.div layout className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                                        {filteredCars.map(car => (
                                            <motion.div key={car.id} layout initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} transition={{ duration: 0.2 }}>
                                                <CarCard car={car} />
                                            </motion.div>
                                        ))}
                                    </motion.div>
                                ) : (
                                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                                        className="flex flex-col items-center justify-center py-32 bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-white/5">
                                        <Car className="w-16 h-16 text-slate-300 dark:text-zinc-700 mb-4" strokeWidth={1.5} />
                                        <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Nenhum veículo encontrado</h3>
                                        <p className="text-slate-500 dark:text-zinc-500 text-sm mb-6">Tente ajustar seus filtros de busca.</p>
                                        <button onClick={clearFilters}
                                            className="px-6 py-2.5 bg-brand-400/10 border border-brand-400/20 text-brand-500 dark:text-brand-400 font-bold rounded-xl hover:bg-brand-400/20 transition-colors text-sm">
                                            {t('estoque_clear_filters')}
                                        </button>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
