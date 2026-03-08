import { Search, SlidersHorizontal, X } from 'lucide-react';
import { useState } from 'react';
import { brands } from '../data/mockCars';

export interface Filters {
    search: string;
    marca: string;
    anoMin: string;
    anoMax: string;
    precoMin: string;
    precoMax: string;
}

interface CarFiltersProps {
    filters: Filters;
    onChange: (filters: Filters) => void;
    totalResults: number;
}

export default function CarFilters({ filters, onChange, totalResults }: CarFiltersProps) {
    const [expanded, setExpanded] = useState(false);

    const update = (key: keyof Filters, value: string) => {
        onChange({ ...filters, [key]: value });
    };

    const clear = () => {
        onChange({ search: '', marca: '', anoMin: '', anoMax: '', precoMin: '', precoMax: '' });
    };

    const currentYear = new Date().getFullYear();
    const years = Array.from({ length: 30 }, (_, i) => currentYear - i);

    const hasActiveFilters = filters.marca || filters.anoMin || filters.anoMax || filters.precoMin || filters.precoMax;

    return (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 mb-8">
            {/* Search row */}
            <div className="flex gap-3">
                <div className="relative flex-1">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" strokeWidth={1.5} />
                    <input
                        type="text"
                        value={filters.search}
                        onChange={(e) => update('search', e.target.value)}
                        placeholder="Digite aqui marca ou modelo"
                        className="w-full pl-12 pr-4 py-3 bg-slate-50 rounded-xl text-sm border border-slate-200 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none transition-all"
                    />
                </div>
                <button
                    onClick={() => setExpanded(!expanded)}
                    className={`flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-medium transition-all ${expanded || hasActiveFilters
                            ? 'bg-brand-600 text-white'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                >
                    <SlidersHorizontal className="w-4 h-4" strokeWidth={1.5} />
                    Filtros
                </button>
            </div>

            {/* Expanded filters */}
            {expanded && (
                <div className="mt-4 pt-4 border-t border-slate-100">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                        <div>
                            <label className="block text-xs font-semibold text-slate-500 mb-1.5">Marca</label>
                            <select
                                value={filters.marca}
                                onChange={(e) => update('marca', e.target.value)}
                                className="w-full px-3 py-2.5 bg-slate-50 rounded-xl text-sm border border-slate-200 focus:border-brand-500 outline-none"
                            >
                                <option value="">Todas</option>
                                {brands.map((b) => (
                                    <option key={b} value={b}>{b}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-slate-500 mb-1.5">Ano mínimo</label>
                            <select
                                value={filters.anoMin}
                                onChange={(e) => update('anoMin', e.target.value)}
                                className="w-full px-3 py-2.5 bg-slate-50 rounded-xl text-sm border border-slate-200 focus:border-brand-500 outline-none"
                            >
                                <option value="">Qualquer</option>
                                {years.map((y) => (
                                    <option key={y} value={y}>{y}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-slate-500 mb-1.5">Ano máximo</label>
                            <select
                                value={filters.anoMax}
                                onChange={(e) => update('anoMax', e.target.value)}
                                className="w-full px-3 py-2.5 bg-slate-50 rounded-xl text-sm border border-slate-200 focus:border-brand-500 outline-none"
                            >
                                <option value="">Qualquer</option>
                                {years.map((y) => (
                                    <option key={y} value={y}>{y}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-slate-500 mb-1.5">Preço mínimo</label>
                            <input
                                type="number"
                                value={filters.precoMin}
                                onChange={(e) => update('precoMin', e.target.value)}
                                placeholder="R$ 0"
                                className="w-full px-3 py-2.5 bg-slate-50 rounded-xl text-sm border border-slate-200 focus:border-brand-500 outline-none"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-slate-500 mb-1.5">Preço máximo</label>
                            <input
                                type="number"
                                value={filters.precoMax}
                                onChange={(e) => update('precoMax', e.target.value)}
                                placeholder="R$ 999.999"
                                className="w-full px-3 py-2.5 bg-slate-50 rounded-xl text-sm border border-slate-200 focus:border-brand-500 outline-none"
                            />
                        </div>
                    </div>
                    {hasActiveFilters && (
                        <button
                            onClick={clear}
                            className="mt-4 flex items-center gap-1 text-sm text-red-500 hover:text-red-600 font-medium"
                        >
                            <X className="w-4 h-4" strokeWidth={1.5} />
                            Limpar filtros
                        </button>
                    )}
                </div>
            )}

            {/* Results count */}
            <div className="mt-4 text-sm text-slate-500">
                <span className="font-semibold text-slate-700">{totalResults}</span> veículo{totalResults !== 1 ? 's' : ''} encontrado{totalResults !== 1 ? 's' : ''}
            </div>
        </div>
    );
}
