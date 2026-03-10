import { useState, useMemo, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, SlidersHorizontal, Loader2, X, Car, ArrowUpDown, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import CarCard from '../components/CarCard';
import { brands, type Car as CarType } from '../data/mockCars';
import { supabasePublic } from '../lib/supabase';

export default function Estoque() {
    const [searchParams] = useSearchParams();
    const initialQuery = searchParams.get('q') || '';
    const selectedLoja = searchParams.get('loja') || '';

    const [loading, setLoading] = useState(true);
    const [supabaseCars, setSupabaseCars] = useState<CarType[]>([]);
    const [search, setSearch] = useState(initialQuery);
    const [selectedBrands, setSelectedBrands] = useState<string[]>([]);
    const [priceRange, setPriceRange] = useState<[number, number]>([0, 500000]);
    const [yearRange, setYearRange] = useState<[number, number]>([2010, 2025]);
    const [showFilters, setShowFilters] = useState(false);
    const [sortOrder, setSortOrder] = useState<'default' | 'asc' | 'desc'>('default');
    const [sortOpen, setSortOpen] = useState(false);
    const sortRef = useRef<HTMLDivElement>(null);

    // Close sort dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (sortRef.current && !sortRef.current.contains(e.target as Node)) {
                setSortOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        const fetchCars = async () => {
            setLoading(true);
            const { data, error } = await supabasePublic.from('anuncios').select('*');
            if (!error && data) {
                setSupabaseCars(data.map((d: any) => ({
                    id: d.id, marca: d.marca, modelo: d.modelo, ano: d.ano,
                    preco: Number(d.preco), quilometragem: d.quilometragem,
                    telefone: d.telefone, descricao: d.descricao || '',
                    combustivel: d.combustivel, cambio: d.cambio, cor: d.cor,
                    cidade: d.cidade, aceitaTroca: d.aceita_troca ?? false,
                    imagens: d.imagens || [], destaque: d.destaque ?? false,
                    impulsionado: d.impulsionado ?? false,
                    impulsionado_ate: d.impulsionado_ate || undefined,
                    prioridade: d.prioridade ?? 0, modelo_3d: false,
                    created_at: d.created_at, user_id: d.user_id, loja: d.loja,
                })));
            }
            setLoading(false);
        };
        fetchCars();
    }, []);

    const filteredCars = useMemo(() => {
        return supabaseCars.filter(car => {
            const matchesSearch = search === '' || `${car.marca} ${car.modelo}`.toLowerCase().includes(search.toLowerCase());
            const matchesBrand = selectedBrands.length === 0 || selectedBrands.includes(car.marca);
            const matchesPrice = car.preco >= priceRange[0] && car.preco <= priceRange[1];
            const matchesYear = car.ano >= yearRange[0] && car.ano <= yearRange[1];
            const matchesLoja = selectedLoja === '' || car.loja === selectedLoja;
            return matchesSearch && matchesBrand && matchesPrice && matchesYear && matchesLoja;
        }).sort((a, b) => {
            if (sortOrder === 'asc') return a.preco - b.preco;
            if (sortOrder === 'desc') return b.preco - a.preco;
            return b.prioridade - a.prioridade || new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        });
    }, [search, selectedBrands, priceRange, yearRange, supabaseCars, selectedLoja, sortOrder]);

    const activeFilters = (selectedBrands.length > 0) || (priceRange[0] > 0 || priceRange[1] < 500000) || (yearRange[0] > 2010 || yearRange[1] < 2025) || sortOrder !== 'default';

    const clearFilters = () => { setSelectedBrands([]); setPriceRange([0, 500000]); setYearRange([2010, 2025]); setSearch(''); setSortOrder('default'); };
    const toggleBrand = (brand: string) => setSelectedBrands(prev => prev.includes(brand) ? prev.filter(b => b !== brand) : [...prev, brand]);

    return (
        <div className="bg-slate-50 dark:bg-zinc-950 min-h-screen transition-colors duration-300">
            {/* Header */}
            <div className="relative z-10 border-b border-slate-200 dark:border-white/5 bg-white dark:bg-zinc-900/50 backdrop-blur-sm transition-colors">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                        <div>
                            <p className="text-xs font-bold text-brand-500 dark:text-brand-400 uppercase tracking-widest mb-2">
                                {filteredCars.length} veículos encontrados
                            </p>
                            <h1 className="text-3xl md:text-4xl font-black text-slate-900 dark:text-white tracking-tight">
                                {selectedLoja ? selectedLoja : 'Estoque completo'}
                            </h1>
                            <p className="text-slate-500 dark:text-zinc-500 mt-1 text-sm">
                                {selectedLoja ? `Todos os veículos da ${selectedLoja}` : 'Encontre o carro ideal para você'}
                            </p>
                        </div>
                        <div className="flex gap-3 flex-wrap">
                            {/* Sort Dropdown – fully custom for theme compatibility */}
                            <div className="relative" ref={sortRef}>
                                <button
                                    onClick={() => setSortOpen(o => !o)}
                                    className={`flex items-center gap-2 pl-3 pr-3 py-3 rounded-xl border text-sm font-bold transition-all whitespace-nowrap
                                        ${sortOrder !== 'default'
                                            ? 'bg-brand-400/15 border-brand-400/40 text-brand-500 dark:text-brand-400'
                                            : 'bg-slate-100 dark:bg-zinc-900 border-slate-200 dark:border-white/10 text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'}`}>
                                    <ArrowUpDown className="w-3.5 h-3.5 flex-shrink-0" strokeWidth={1.5} />
                                    <span>
                                        {sortOrder === 'asc' ? 'Menor preço' : sortOrder === 'desc' ? 'Maior preço' : 'Ordenar por'}
                                    </span>
                                    <ChevronDown className={`w-3.5 h-3.5 flex-shrink-0 transition-transform duration-200 ${sortOpen ? 'rotate-180' : ''}`} strokeWidth={1.5} />
                                </button>

                                <AnimatePresence>
                                    {sortOpen && (
                                        <motion.div
                                            initial={{ opacity: 0, y: -6, scale: 0.97 }}
                                            animate={{ opacity: 1, y: 0, scale: 1 }}
                                            exit={{ opacity: 0, y: -6, scale: 0.97 }}
                                            transition={{ duration: 0.15 }}
                                            className="absolute left-0 top-full mt-1 z-[999] min-w-[160px] rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-zinc-900 shadow-lg dark:shadow-black/40 overflow-hidden">
                                            {(['default', 'asc', 'desc'] as const).map((val) => (
                                                <button
                                                    key={val}
                                                    onClick={() => { setSortOrder(val); setSortOpen(false); }}
                                                    className={`w-full text-left px-4 py-2.5 text-sm font-medium transition-colors
                                                        ${ sortOrder === val
                                                            ? 'bg-brand-400/10 text-brand-500 dark:text-brand-400'
                                                            : 'text-slate-700 dark:text-zinc-200 hover:bg-slate-100 dark:hover:bg-white/8'}`}>
                                                    {val === 'default' ? 'Ordenar por' : val === 'asc' ? 'Menor preço' : 'Maior preço'}
                                                </button>
                                            ))}
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                            <div className="relative flex-1 md:w-80">
                                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-zinc-500" strokeWidth={1.5} />
                                <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
                                    placeholder="Buscar marca ou modelo..."
                                    className="w-full pl-10 pr-4 py-3 bg-slate-100 dark:bg-zinc-900 border border-slate-200 dark:border-white/10 focus:border-brand-400/60 rounded-xl text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-zinc-500 outline-none transition-all" />
                            </div>
                            <button onClick={() => setShowFilters(!showFilters)}
                                className={`md:hidden flex items-center gap-2 px-4 py-3 rounded-xl border text-sm font-bold transition-all ${showFilters
                                    ? 'bg-brand-400/15 border-brand-400/40 text-brand-500 dark:text-brand-400'
                                    : 'bg-slate-100 dark:bg-zinc-900 border-slate-200 dark:border-white/10 text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'}`}>
                                <SlidersHorizontal className="w-4 h-4" strokeWidth={1.5} /> Filtros
                                {activeFilters && <span className="w-1.5 h-1.5 bg-brand-400 rounded-full" />}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="flex flex-col md:flex-row gap-8">
                    {/* Sidebar */}
                    <div className={`md:w-64 flex-shrink-0 ${showFilters ? 'block' : 'hidden md:block'}`}>
                        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-white/8 p-6 sticky top-24 shadow-sm dark:shadow-none">
                            <div className="flex items-center justify-between mb-6">
                                <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                    <SlidersHorizontal className="w-4 h-4 text-brand-500 dark:text-brand-400" strokeWidth={1.5} /> Filtros
                                </h3>
                                {activeFilters && (
                                    <button onClick={clearFilters} className="text-xs font-bold text-red-500 dark:text-red-400 hover:text-red-600 dark:hover:text-red-300 flex items-center gap-1 transition-colors">
                                        <X className="w-3 h-3" strokeWidth={1.5} /> Limpar
                                    </button>
                                )}
                            </div>

                            {/* Brand Filter */}
                            <div className="mb-6">
                                <h4 className="text-xs font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider mb-3">Marca</h4>
                                <div className="space-y-1">
                                    <label className="flex items-center gap-3 p-2 rounded-lg cursor-pointer hover:bg-slate-50 dark:hover:bg-white/5 transition-colors group" onClick={() => setSelectedBrands([])}>
                                        <div className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-all ${selectedBrands.length === 0 ? 'bg-brand-400 border-brand-400' : 'border-slate-300 dark:border-zinc-600 group-hover:border-slate-400 dark:group-hover:border-zinc-400'}`}>
                                            {selectedBrands.length === 0 && <div className="w-1.5 h-1.5 bg-zinc-950 rounded-[1px]" />}
                                        </div>
                                        <span className={`text-sm ${selectedBrands.length === 0 ? 'text-slate-900 dark:text-white font-semibold' : 'text-slate-500 dark:text-zinc-400'}`}>Todas</span>
                                    </label>
                                    {brands.map((brand) => (
                                        <label key={brand} className="flex items-center gap-3 p-2 rounded-lg cursor-pointer hover:bg-slate-50 dark:hover:bg-white/5 transition-colors group" onClick={() => toggleBrand(brand)}>
                                            <div className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-all ${selectedBrands.includes(brand) ? 'bg-brand-400 border-brand-400' : 'border-slate-300 dark:border-zinc-600 group-hover:border-slate-400 dark:group-hover:border-zinc-400'}`}>
                                                {selectedBrands.includes(brand) && <div className="w-1.5 h-1.5 bg-zinc-950 rounded-[1px]" />}
                                            </div>
                                            <span className={`text-sm ${selectedBrands.includes(brand) ? 'text-slate-900 dark:text-white font-semibold' : 'text-slate-500 dark:text-zinc-400'}`}>{brand}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>

                            {/* Price Range */}
                            <div className="mb-6">
                                <h4 className="text-xs font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider mb-3">Preço máximo</h4>
                                <input type="range" min="0" max="500000" step="10000" value={priceRange[1]}
                                    onChange={(e) => setPriceRange([priceRange[0], Number(e.target.value)])} className="w-full mb-3" />
                                <div className="flex justify-between">
                                    <span className="text-xs text-slate-400 dark:text-zinc-600">R$ 0</span>
                                    <span className="text-xs font-bold text-brand-500 dark:text-brand-400">R$ {priceRange[1].toLocaleString()}</span>
                                </div>
                            </div>

                            {/* Year Range */}
                            <div>
                                <h4 className="text-xs font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider mb-3">Ano mínimo</h4>
                                <input type="range" min="2010" max="2025" step="1" value={yearRange[0]}
                                    onChange={(e) => setYearRange([Number(e.target.value), yearRange[1]])} className="w-full mb-3" />
                                <div className="flex justify-between">
                                    <span className="text-xs font-bold text-brand-500 dark:text-brand-400">{yearRange[0]}</span>
                                    <span className="text-xs text-slate-400 dark:text-zinc-600">2025</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Car Grid */}
                    <div className="flex-1">
                        {activeFilters && (
                            <div className="flex flex-wrap items-center gap-2 mb-6">
                                {selectedBrands.map(brand => (
                                    <span key={brand} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-brand-400/10 border border-brand-400/20 text-brand-500 dark:text-brand-400 text-xs font-bold rounded-lg">
                                        {brand} <button onClick={() => toggleBrand(brand)}><X className="w-3 h-3" strokeWidth={1.5} /></button>
                                    </span>
                                ))}
                                {priceRange[1] < 500000 && (
                                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-brand-400/10 border border-brand-400/20 text-brand-500 dark:text-brand-400 text-xs font-bold rounded-lg">
                                        Até R$ {priceRange[1].toLocaleString()} <button onClick={() => setPriceRange([0, 500000])}><X className="w-3 h-3" strokeWidth={1.5} /></button>
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
                                        {filteredCars.map((car) => (
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
                                            Limpar filtros
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
