import { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, Filter, SlidersHorizontal, Loader2, X, Car } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import CarCard from '../components/CarCard';
import { brands, type Car as CarType } from '../data/mockCars';
import { supabase } from '../lib/supabase';

export default function Estoque() {
    const [searchParams] = useSearchParams();
    const initialQuery = searchParams.get('q') || '';
    const selectedLoja = searchParams.get('loja') || '';

    const [loading, setLoading] = useState(true);
    const [supabaseCars, setSupabaseCars] = useState<CarType[]>([]);

    // Filters
    const [search, setSearch] = useState(initialQuery);
    const [selectedBrands, setSelectedBrands] = useState<string[]>([]);
    const [priceRange, setPriceRange] = useState<[number, number]>([0, 500000]);
    const [yearRange, setYearRange] = useState<[number, number]>([2010, 2025]);
    const [showFilters, setShowFilters] = useState(false);

    useEffect(() => {
        const fetchCars = async () => {
            setLoading(true);
            const { data, error } = await supabase.from('anuncios').select('*');

            if (error) {
                console.error('Error fetching cars:', error);
            } else if (data) {
                const mappedCars = data.map((d: any) => ({
                    id: d.id,
                    marca: d.marca,
                    modelo: d.modelo,
                    ano: d.ano,
                    preco: Number(d.preco),
                    quilometragem: d.quilometragem,
                    telefone: d.telefone,
                    descricao: d.descricao || '',
                    combustivel: d.combustivel,
                    cambio: d.cambio,
                    cor: d.cor,
                    cidade: d.cidade,
                    aceitaTroca: d.aceita_troca ?? false,
                    imagens: d.imagens || [],
                    destaque: d.destaque ?? false,
                    impulsionado: d.impulsionado ?? false,
                    impulsionado_ate: d.impulsionado_ate || undefined,
                    prioridade: d.prioridade ?? 0,
                    modelo_3d: false, // Legacy field
                    created_at: d.created_at,
                    user_id: d.user_id,
                    loja: d.loja,
                }));
                setSupabaseCars(mappedCars);
            }
            setLoading(false);
        };
        fetchCars();
    }, []);

    const filteredCars = useMemo(() => {
        return supabaseCars.filter(car => {
            const matchesSearch = search === '' ||
                `${car.marca} ${car.modelo}`.toLowerCase().includes(search.toLowerCase());

            const matchesBrand = selectedBrands.length === 0 || selectedBrands.includes(car.marca);

            const matchesPrice = car.preco >= priceRange[0] && car.preco <= priceRange[1];

            const matchesYear = car.ano >= yearRange[0] && car.ano <= yearRange[1];

            const matchesLoja = selectedLoja === '' || car.loja === selectedLoja;

            return matchesSearch && matchesBrand && matchesPrice && matchesYear && matchesLoja;
        }).sort((a, b) => b.prioridade - a.prioridade || new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }, [search, selectedBrands, priceRange, yearRange, supabaseCars, selectedLoja]);

    const activeFilters = (selectedBrands.length > 0) || (priceRange[0] > 0 || priceRange[1] < 500000) || (yearRange[0] > 2010 || yearRange[1] < 2025);

    const clearFilters = () => {
        setSelectedBrands([]);
        setPriceRange([0, 500000]);
        setYearRange([2010, 2025]);
        setSearch('');
    };

    const toggleBrand = (brand: string) => {
        setSelectedBrands(prev =>
            prev.includes(brand)
                ? prev.filter(b => b !== brand)
                : [...prev, brand]
        );
    };

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900">
                        {selectedLoja ? `Estoque ${selectedLoja}` : 'Nosso Estoque'}
                    </h1>
                    <p className="text-slate-500 mt-1">
                        {selectedLoja ? `Confira os veículos exclusivos da ${selectedLoja}` : 'Encontre o carro ideal para você'}
                    </p>
                </div>

                <div className="flex gap-2">
                    <div className="relative flex-1 md:w-80">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Buscar marca ou modelo..."
                            className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none"
                        />
                    </div>
                    <button
                        onClick={() => setShowFilters(!showFilters)}
                        className={`md:hidden p-2.5 rounded-xl border ${showFilters ? 'bg-brand-50 border-brand-200 text-brand-700' : 'bg-white border-slate-200 text-slate-600'}`}
                    >
                        <SlidersHorizontal className="w-5 h-5" />
                    </button>
                </div>
            </div>

            <div className="flex flex-col md:flex-row gap-8">
                {/* Sidebar Filters */}
                <div className={`md:w-64 flex-shrink-0 space-y-8 ${showFilters ? 'block' : 'hidden md:block'}`}>
                    {/* Brand Filter */}
                    <div>
                        <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
                            <Filter className="w-4 h-4" />
                            Marca
                        </h3>
                        <div className="space-y-2">
                            <label className="flex items-center gap-2 cursor-pointer group">
                                <div className={`w-5 h-5 rounded-md border flex items-center justify-center transition-colors ${selectedBrands.length === 0 ? 'bg-brand-600 border-brand-600' : 'border-slate-300 bg-white'}`}>
                                    {selectedBrands.length === 0 && <div className="w-2.5 h-2.5 bg-white rounded-[2px]" />}
                                </div>
                                <input
                                    type="checkbox"
                                    checked={selectedBrands.length === 0}
                                    onChange={() => setSelectedBrands([])}
                                    className="hidden"
                                />
                                <span className={selectedBrands.length === 0 ? 'text-slate-900 font-medium' : 'text-slate-600 group-hover:text-slate-900'}>
                                    Todas
                                </span>
                            </label>
                            {brands.map((brand) => (
                                <label key={brand} className="flex items-center gap-2 cursor-pointer group">
                                    <div className={`w-5 h-5 rounded-md border flex items-center justify-center transition-colors ${selectedBrands.includes(brand) ? 'bg-brand-600 border-brand-600' : 'border-slate-300 bg-white'}`}>
                                        {selectedBrands.includes(brand) && <div className="w-2.5 h-2.5 bg-white rounded-[2px]" />}
                                    </div>
                                    <input
                                        type="checkbox"
                                        checked={selectedBrands.includes(brand)}
                                        onChange={() => toggleBrand(brand)}
                                        className="hidden"
                                    />
                                    <span className={selectedBrands.includes(brand) ? 'text-slate-900 font-medium' : 'text-slate-600 group-hover:text-slate-900'}>
                                        {brand}
                                    </span>
                                </label>
                            ))}
                        </div>
                    </div>

                    {/* Price Range */}
                    <div>
                        <h3 className="font-bold text-slate-900 mb-4">Preço Até</h3>
                        <input
                            type="range"
                            min="0"
                            max="500000"
                            step="10000"
                            value={priceRange[1]}
                            onChange={(e) => setPriceRange([priceRange[0], Number(e.target.value)])}
                            className="w-full accent-brand-600 mb-2"
                        />
                        <div className="flex justify-between text-sm text-slate-600 font-medium">
                            <span>R$ 0</span>
                            <span>R$ {priceRange[1].toLocaleString()}</span>
                        </div>
                    </div>

                    {/* Clear Filters Mobile */}
                    {activeFilters && (
                        <button
                            onClick={clearFilters}
                            className="w-full py-2.5 text-sm font-semibold text-red-600 bg-red-50 hover:bg-red-100 rounded-xl transition-colors md:hidden"
                        >
                            Limpar Filtros
                        </button>
                    )}
                </div>

                {/* Car Grid */}
                <div className="flex-1">
                    {/* Active Filters Summary */}
                    {activeFilters && (
                        <div className="flex flex-wrap items-center gap-2 mb-6">
                            <span className="text-sm text-slate-500">Filtros ativos:</span>
                            {selectedBrands.map(brand => (
                                <span key={brand} className="inline-flex items-center gap-1 px-3 py-1 bg-brand-50 text-brand-700 text-xs font-bold rounded-full">
                                    {brand}
                                    <button onClick={() => toggleBrand(brand)} className="hover:text-brand-900">
                                        <X className="w-3 h-3" />
                                    </button>
                                </span>
                            ))}
                            {(priceRange[1] < 500000) && (
                                <span className="inline-flex items-center gap-1 px-3 py-1 bg-brand-50 text-brand-700 text-xs font-bold rounded-full">
                                    Até R$ {priceRange[1].toLocaleString()}
                                    <button onClick={() => setPriceRange([0, 500000])} className="hover:text-brand-900">
                                        <X className="w-3 h-3" />
                                    </button>
                                </span>
                            )}
                            <button
                                onClick={clearFilters}
                                className="text-xs font-semibold text-red-500 hover:text-red-700 ml-auto"
                            >
                                Limpar tudo
                            </button>
                        </div>
                    )}

                    {loading ? (
                        <div className="flex justify-center items-center py-20">
                            <Loader2 className="w-8 h-8 animate-spin text-brand-600" />
                        </div>
                    ) : (
                        <AnimatePresence mode='popLayout'>
                            {filteredCars.length > 0 ? (
                                <motion.div
                                    layout
                                    className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6"
                                >
                                    {filteredCars.map((car) => (
                                        <motion.div
                                            key={car.id}
                                            layout
                                            initial={{ opacity: 0, scale: 0.9 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            exit={{ opacity: 0, scale: 0.9 }}
                                            transition={{ duration: 0.2 }}
                                        >
                                            <CarCard car={car} />
                                        </motion.div>
                                    ))}
                                </motion.div>
                            ) : (
                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    className="text-center py-20 bg-slate-50 rounded-3xl border border-slate-100"
                                >
                                    <Car className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                                    <h3 className="text-lg font-bold text-slate-900 mb-2">Nenhum veículo encontrado</h3>
                                    <p className="text-slate-500">Tente ajustar seus filtros de busca.</p>
                                    <button
                                        onClick={clearFilters}
                                        className="mt-6 px-6 py-2.5 bg-white border border-slate-300 text-slate-700 font-semibold rounded-xl hover:bg-slate-50 transition-colors shadow-sm"
                                    >
                                        Limpar Filtros
                                    </button>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    )}
                </div>
            </div>
        </div>
    );
}
