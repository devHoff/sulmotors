import { useState, useEffect } from 'react';

interface IBGEMunicipio {
    id: number;
    nome: string;
    microrregiao: {
        mesorregiao: {
            UF: {
                sigla: string;
            };
        };
    };
}

let cachedCities: string[] | null = null;
let fetchPromise: Promise<string[]> | null = null;

async function fetchAllBrazilianCities(): Promise<string[]> {
    if (cachedCities) return cachedCities;
    if (fetchPromise) return fetchPromise;

    fetchPromise = fetch(
        'https://servicodados.ibge.gov.br/api/v1/localidades/municipios?orderBy=nome',
        { cache: 'force-cache' }
    )
        .then(res => res.json())
        .then((data: IBGEMunicipio[]) => {
            const list = data.map(m => `${m.nome} - ${m.microrregiao.mesorregiao.UF.sigla}`);
            cachedCities = list;
            return list;
        })
        .catch(() => {
            fetchPromise = null;
            return [];
        });

    return fetchPromise;
}

export function useBrazilianCities() {
    const [cities, setCities] = useState<string[]>(cachedCities ?? []);
    const [loading, setLoading] = useState(!cachedCities);

    useEffect(() => {
        if (cachedCities) {
            setCities(cachedCities);
            setLoading(false);
            return;
        }
        setLoading(true);
        fetchAllBrazilianCities().then(list => {
            setCities(list);
            setLoading(false);
        });
    }, []);

    return { cities, loading };
}
