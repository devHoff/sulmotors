/**
 * SulMotor – LanguageContext v2
 * ─────────────────────────────────────────────────────────────────────────────
 * Full i18n system backed by JSON locale dictionaries.
 *
 * Architecture:
 *  • /src/locales/pt.json  — Portuguese (default)
 *  • /src/locales/en.json  — English
 *  • Easy to add new languages: create /src/locales/<lang>.json + add import
 *
 * Usage (new API):
 *  const { t, language, setLanguage } = useLanguage();
 *  t('nav_home')                         → "Início"  |  "Home"
 *  t('imp_savings', { pct: '30' })       → "Economia de 30% por dia"
 *
 * Backward compat:
 *  The `t` object exposes BOTH call syntax AND dot-notation:
 *    t('nav_home') === t.nav_home
 *  All translation keys are typed as string via index signature.
 *
 * Storage:
 *  localStorage key: 'sm_language'  (e.g. "en" | "pt-BR")
 */

import {
    createContext,
    useContext,
    useState,
    useCallback,
    useMemo,
    type ReactNode,
} from 'react';

import ptDict from '../locales/pt.json';
import enDict from '../locales/en.json';

// ── Types ─────────────────────────────────────────────────────────────────────

export type Language = 'pt-BR' | 'en' | 'es';

type Dict = Record<string, string>;

// Re-export Translations for backward compat (pages import it)
export type Translations = Dict;

// ── Locale registry ───────────────────────────────────────────────────────────

const LOCALES: Record<Language, Dict> = {
    'pt-BR': ptDict as unknown as Dict,
    'en':    enDict as unknown as Dict,
    'es':    ptDict as unknown as Dict,   // fallback to PT until ES dict is available
};

const STORAGE_KEY  = 'sm_language';
const DEFAULT_LANG: Language = 'pt-BR';

function getInitialLang(): Language {
    try {
        const stored = localStorage.getItem(STORAGE_KEY) as Language | null;
        if (stored && stored in LOCALES) return stored;
        const browser = navigator.language;
        if (browser.startsWith('en')) return 'en';
        if (browser.startsWith('es')) return 'es';
    } catch {}
    return DEFAULT_LANG;
}

// ── t() type: callable function WITH string index signature ──────────────────
//
// This ensures t.nav_home is typed as `string` (not the fn union),
// which is the backward-compat dot-notation used throughout the codebase.

export type TFunction = {
    (key: string, vars?: Record<string, string | number>): string;
} & Record<string, string>;

// ── Context ───────────────────────────────────────────────────────────────────

interface LanguageContextValue {
    language:    Language;
    setLanguage: (lang: Language) => void;
    t:           TFunction;
    dict:        Dict;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

// ── Provider ──────────────────────────────────────────────────────────────────

export function LanguageProvider({ children }: { children: ReactNode }) {
    const [language, setLangState] = useState<Language>(getInitialLang);

    const setLanguage = useCallback((lang: Language) => {
        setLangState(lang);
        try { localStorage.setItem(STORAGE_KEY, lang); } catch {}
    }, []);

    const dict = LOCALES[language] ?? LOCALES[DEFAULT_LANG];

    const t = useMemo<TFunction>(() => {
        const fn = (key: string, vars?: Record<string, string | number>): string => {
            let str = dict[key] ?? LOCALES[DEFAULT_LANG][key] ?? key;
            if (vars) {
                Object.entries(vars).forEach(([k, v]) => {
                    str = str.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
                });
            }
            return str;
        };

        // Proxy intercepts property access (t.nav_home) and calls fn('nav_home')
        return new Proxy(fn, {
            get(_target, prop: string) {
                if (typeof prop !== 'string') return undefined;
                return fn(prop);
            },
        }) as TFunction;
    }, [dict]);

    const value: LanguageContextValue = { language, setLanguage, t, dict };

    return (
        <LanguageContext.Provider value={value}>
            {children}
        </LanguageContext.Provider>
    );
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useLanguage(): LanguageContextValue {
    const ctx = useContext(LanguageContext);
    if (!ctx) throw new Error('useLanguage must be used inside <LanguageProvider>');
    return ctx;
}

// ── Singleton accessor (for use outside React, e.g. utils/toast.ts) ──────────

let _tFn: TFunction | null = null;
export function _registerTFn(t: TFunction) { _tFn = t; }

export function getT(): TFunction {
    if (_tFn) return _tFn;
    // Fallback: use PT dict directly
    const ptRaw = ptDict as unknown as Dict;
    const fn = (key: string, vars?: Record<string, string | number>): string => {
        let str = ptRaw[key] ?? key;
        if (vars) Object.entries(vars).forEach(([k, v]) => {
            str = str.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
        });
        return str;
    };
    return new Proxy(fn, {
        get(_t, p: string) { return typeof p === 'string' ? fn(p) : undefined; },
    }) as TFunction;
}
