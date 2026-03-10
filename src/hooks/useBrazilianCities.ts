import { useState, useEffect } from 'react';
import ALL_BRAZILIAN_CITIES from '../data/allBrazilianCities';

// ── In-memory cache for runtime-fetched list (progressive enhancement) ────────
let runtimeCache: string[] | null = null;
let fetchStarted = false;

/**
 * Returns the complete list of Brazilian municipalities.
 *
 * • Immediately returns the static list (~5,571 cities) so the autocomplete
 *   is usable right away.
 * • Silently fetches from BrasilAPI in the background for the most up-to-date
 *   data; once received the hook re-renders with the fresh list.
 * • Results are cached in-memory so the API is only called once per session.
 */
export function useBrazilianCities() {
    // Start with static list so autocomplete is immediately usable
    const [cities, setCities] = useState<string[]>(
        runtimeCache ?? ALL_BRAZILIAN_CITIES
    );
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        // If we already have a runtime cache, use it immediately
        if (runtimeCache) {
            setCities(runtimeCache);
            return;
        }

        // Only start the fetch once across all component instances
        if (fetchStarted) return;
        fetchStarted = true;

        const states = [
            'AC','AL','AP','AM','BA','CE','DF','ES','GO','MA',
            'MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN',
            'RS','RO','RR','SC','SP','SE','TO',
        ];

        setLoading(true);

        // Fetch all states in parallel from BrasilAPI
        Promise.all(
            states.map(uf =>
                fetch(`https://brasilapi.com.br/api/ibge/municipios/v1/${uf}`)
                    .then(r => r.ok ? r.json() : [])
                    .then((data: Array<{ nome: string }>) =>
                        data.map(m => {
                            // Title-case the name (BrasilAPI returns ALL CAPS)
                            const name = m.nome.replace(/\w\S*/g, (w) =>
                                w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
                            );
                            return `${name} - ${uf}`;
                        })
                    )
                    .catch(() => [] as string[])
            )
        )
            .then(arrays => {
                const all = arrays.flat().sort((a, b) =>
                    a.localeCompare(b, 'pt-BR', { sensitivity: 'base' })
                );
                if (all.length > 100) {
                    // Only replace if we got a meaningful result
                    runtimeCache = all;
                    setCities(all);
                }
            })
            .catch(() => {
                // Keep static list on error – no-op
            })
            .finally(() => setLoading(false));
    }, []);

    return { cities, loading };
}
