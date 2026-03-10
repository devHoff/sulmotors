import { useState, useRef, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

interface AutocompleteInputProps {
    value: string;
    onChange: (value: string) => void;
    suggestions: string[];
    placeholder?: string;
    className?: string;
    /** If true, typing a value not in the list is still allowed (free-text fallback) */
    allowCustom?: boolean;
    /** Label shown at the bottom of the dropdown when the typed value is not in the list */
    addNewLabel?: (input: string) => string;
    /**
     * Minimum number of characters before suggestions appear.
     * Defaults to 1. Set to 2 for large lists (e.g. city names) to reduce noise.
     */
    minChars?: number;
}

export default function AutocompleteInput({
    value,
    onChange,
    suggestions,
    placeholder = '',
    className = '',
    allowCustom = true,
    addNewLabel = (v) => `Usar "${v}"`,
    minChars = 1,
}: AutocompleteInputProps) {
    const [open, setOpen] = useState(false);
    const [inputValue, setInputValue] = useState(value);
    const containerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // Keep internal input in sync when parent value changes (e.g. form reset)
    useEffect(() => {
        setInputValue(value);
    }, [value]);

    // Close dropdown on outside click
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setOpen(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    // Only filter when we have enough characters
    const hasEnoughChars = inputValue.trim().length >= minChars;

    const filtered = hasEnoughChars
        ? suggestions
            .filter(s => s.toLowerCase().includes(inputValue.toLowerCase()))
            .slice(0, 10)
        : [];

    const showAddNew = allowCustom &&
        hasEnoughChars &&
        inputValue.trim().length > 0 &&
        !suggestions.some(s => s.toLowerCase() === inputValue.trim().toLowerCase());

    const handleInput = (v: string) => {
        setInputValue(v);
        onChange(v);
        setOpen(true);
    };

    const handleSelect = (s: string) => {
        setInputValue(s);
        onChange(s);
        setOpen(false);
    };

    const handleFocus = () => {
        setOpen(true);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Escape') setOpen(false);
        if (e.key === 'Enter') {
            e.preventDefault();
            if (filtered.length === 1) {
                handleSelect(filtered[0]);
            } else if (showAddNew) {
                handleSelect(inputValue.trim());
            }
        }
    };

    return (
        <div className="relative" ref={containerRef}>
            <input
                ref={inputRef}
                type="text"
                value={inputValue}
                onChange={(e) => handleInput(e.target.value)}
                onFocus={handleFocus}
                onKeyDown={handleKeyDown}
                placeholder={placeholder}
                className={className}
                autoComplete="off"
            />
            <AnimatePresence>
                {open && (filtered.length > 0 || showAddNew) && (
                    <motion.ul
                        initial={{ opacity: 0, y: -4, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -4, scale: 0.98 }}
                        transition={{ duration: 0.12 }}
                        className="absolute z-50 left-0 right-0 top-full mt-1 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-zinc-900 shadow-lg dark:shadow-black/40 overflow-hidden max-h-60 overflow-y-auto"
                    >
                        {filtered.map((s) => (
                            <li key={s}>
                                <button
                                    type="button"
                                    onMouseDown={(e) => { e.preventDefault(); handleSelect(s); }}
                                    className="w-full text-left px-4 py-2.5 text-sm font-medium text-slate-700 dark:text-zinc-200 hover:bg-brand-400/10 hover:text-brand-500 dark:hover:text-brand-400 transition-colors"
                                >
                                    {s}
                                </button>
                            </li>
                        ))}
                        {showAddNew && (
                            <li>
                                <button
                                    type="button"
                                    onMouseDown={(e) => { e.preventDefault(); handleSelect(inputValue.trim()); }}
                                    className="w-full text-left px-4 py-2.5 text-sm font-medium text-brand-500 dark:text-brand-400 hover:bg-brand-400/10 transition-colors border-t border-slate-100 dark:border-white/5 flex items-center gap-2"
                                >
                                    <span className="text-brand-400">+</span>
                                    {addNewLabel(inputValue.trim())}
                                </button>
                            </li>
                        )}
                    </motion.ul>
                )}
            </AnimatePresence>
        </div>
    );
}
