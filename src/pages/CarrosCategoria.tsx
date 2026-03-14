/**
 * src/pages/CarrosCategoria.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Programmatic SEO landing page for vehicle categories.
 *
 * Handles routes:
 *   /carros-usados                       → all used cars
 *   /carros-usados/:cidade               → cars in city
 *   /carros/:marca                       → cars by brand
 *   /carros/:marca/:modelo               → cars by brand+model
 *   /carros-ate-20-mil                   → price range ≤ 20k
 *   /carros-ate-30-mil                   → price range ≤ 30k
 *   /carros-ate-50-mil                   → price range ≤ 50k
 *   /carros-ate-80-mil                   → price range ≤ 80k
 *   /carros-ate-100-mil                  → price range ≤ 100k
 *
 * Each page generates:
 *   • Dynamic meta title / description
 *   • JSON-LD BreadcrumbList + ItemList structured data
 *   • SEO content block describing the category
 *   • Internal links to related pages
 *   • Full vehicle grid with CarCard
 */

import { useState, useEffect } from 'react';
import { Link, useParams, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Car, ChevronRight, Search, MapPin, Tag } from 'lucide-react';
import CarCard from '../components/CarCard';
import { supabasePublic } from '../lib/supabase';
import { injectSeoTags, generateSeoMetadata } from '../lib/seoService';
import type { Car as CarType } from '../data/mockCars';

// ── Price range config ────────────────────────────────────────────────────────
const PRICE_RANGES: Record<string, { label: string; max: number; slug: string }> = {
    'carros-ate-20-mil':  { label: 'até R$ 20.000',  max: 20000,  slug: 'carros-ate-20-mil'  },
    'carros-ate-30-mil':  { label: 'até R$ 30.000',  max: 30000,  slug: 'carros-ate-30-mil'  },
    'carros-ate-50-mil':  { label: 'até R$ 50.000',  max: 50000,  slug: 'carros-ate-50-mil'  },
    'carros-ate-80-mil':  { label: 'até R$ 80.000',  max: 80000,  slug: 'carros-ate-80-mil'  },
    'carros-ate-100-mil': { label: 'até R$ 100.000', max: 100000, slug: 'carros-ate-100-mil' },
};

const SITE_URL = 'https://sulmotor.com';

// ── Slug helpers ──────────────────────────────────────────────────────────────
function slugify(text: string): string {
    return text
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^\w\s-]/g, '')
        .replace(/[\s_]+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
}

function deslugify(slug: string): string {
    return slug
        .split('-')
        .map(w => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');
}

// ── Generate page meta ────────────────────────────────────────────────────────
function buildPageMeta(params: {
    type: 'all' | 'cidade' | 'marca' | 'marca-modelo' | 'preco';
    marca?: string;
    modelo?: string;
    cidade?: string;
    priceLabel?: string;
    count: number;
}) {
    const { type, marca, modelo, cidade, priceLabel, count } = params;
    let title = '';
    let description = '';
    let canonical = `${SITE_URL}/`;
    let h1 = '';
    let breadcrumbs: { name: string; url: string }[] = [
        { name: 'SulMotor', url: SITE_URL },
    ];

    switch (type) {
        case 'all':
            title       = `Carros Usados à Venda | SulMotor`;
            description = `Encontre ${count > 0 ? count : 'centenas de'} carros usados e seminovos à venda no Sul do Brasil. Compare preços, fotos e anuncie seu veículo no SulMotor.`;
            canonical   = `${SITE_URL}/carros-usados`;
            h1          = 'Carros Usados à Venda';
            breadcrumbs.push({ name: 'Carros Usados', url: `${SITE_URL}/carros-usados` });
            break;

        case 'cidade':
            title       = `Carros Usados em ${cidade} | SulMotor`;
            description = `${count > 0 ? count : 'Vários'} carros usados e seminovos à venda em ${cidade}. Encontre o melhor negócio perto de você no SulMotor.`;
            canonical   = `${SITE_URL}/carros-usados/${slugify(cidade || '')}`;
            h1          = `Carros Usados em ${cidade}`;
            breadcrumbs.push(
                { name: 'Carros Usados', url: `${SITE_URL}/carros-usados` },
                { name: cidade || '', url: `${SITE_URL}/carros-usados/${slugify(cidade || '')}` },
            );
            break;

        case 'marca':
            title       = `${marca} Usado à Venda | SulMotor`;
            description = `${count > 0 ? count : 'Vários'} veículos ${marca} usados e seminovos disponíveis. Encontre ${marca} com preço, fotos e contato direto no SulMotor.`;
            canonical   = `${SITE_URL}/carros/${slugify(marca || '')}`;
            h1          = `${marca} Usado à Venda`;
            breadcrumbs.push(
                { name: 'Carros', url: `${SITE_URL}/carros-usados` },
                { name: marca || '', url: `${SITE_URL}/carros/${slugify(marca || '')}` },
            );
            break;

        case 'marca-modelo':
            title       = `${marca} ${modelo} Usado à Venda | SulMotor`;
            description = `${count > 0 ? count : 'Vários'} ${marca} ${modelo} usados disponíveis. Compare preços, quilometragem e encontre o melhor negócio no SulMotor.`;
            canonical   = `${SITE_URL}/carros/${slugify(marca || '')}/${slugify(modelo || '')}`;
            h1          = `${marca} ${modelo} Usado à Venda`;
            breadcrumbs.push(
                { name: 'Carros', url: `${SITE_URL}/carros-usados` },
                { name: marca || '', url: `${SITE_URL}/carros/${slugify(marca || '')}` },
                { name: modelo || '', url: `${SITE_URL}/carros/${slugify(marca || '')}/${slugify(modelo || '')}` },
            );
            break;

        case 'preco':
            title       = `Carros ${priceLabel} | SulMotor`;
            description = `${count > 0 ? count : 'Vários'} carros usados ${priceLabel}. Encontre veículos acessíveis com preço, fotos e contato direto no SulMotor.`;
            canonical   = `${SITE_URL}/carros-ate-${priceLabel?.replace('até R$ ', '').replace('.000', '-mil').replace(',', '')}`;
            h1          = `Carros ${priceLabel}`;
            breadcrumbs.push({ name: h1, url: canonical });
            break;
    }

    return { title, description, canonical, h1, breadcrumbs };
}

// ── SEO content blocks ────────────────────────────────────────────────────────
function SeoContentBlock({ type, marca, modelo, cidade, priceLabel }: {
    type: 'all' | 'cidade' | 'marca' | 'marca-modelo' | 'preco';
    marca?: string; modelo?: string; cidade?: string; priceLabel?: string;
}) {
    const blocks: Record<string, { heading: string; text: string }> = {
        all: {
            heading: 'Compre Carros Usados com Segurança',
            text: `O SulMotor é o marketplace automotivo especializado no Sul do Brasil. 
                   Conectamos compradores e vendedores com transparência e praticidade. 
                   Todos os anúncios são de particulares e revendas verificadas. 
                   Compare modelos, preços e financie direto com o vendedor.`,
        },
        cidade: {
            heading: `Comprar Carros Usados em ${cidade}`,
            text: `Encontre os melhores carros usados em ${cidade} no SulMotor. 
                   Nossa plataforma reúne particulares e revendas locais para facilitar 
                   sua busca. Filtre por marca, preço e quilometragem para achar 
                   o veículo ideal perto de você.`,
        },
        marca: {
            heading: `${marca} Usado: Guia de Compra`,
            text: `Comprar um ${marca} usado no SulMotor é simples e seguro. 
                   Confira nosso estoque de veículos ${marca} com fotos reais, 
                   quilometragem verificada e contato direto com o vendedor. 
                   Compare opções e negocie o melhor preço.`,
        },
        'marca-modelo': {
            heading: `${marca} ${modelo}: Quanto Custa Usado?`,
            text: `O ${marca} ${modelo} é um dos veículos mais buscados no mercado brasileiro. 
                   No SulMotor você encontra ${marca} ${modelo} usados com preços atualizados, 
                   fotos detalhadas e histórico do veículo. 
                   Compare versões e anos para fazer a melhor escolha.`,
        },
        preco: {
            heading: `Carros Usados ${priceLabel}`,
            text: `Encontre ótimas opções de carros usados ${priceLabel} no SulMotor. 
                   Temos veículos acessíveis de diversas marcas e modelos. 
                   Todos os anúncios incluem fotos reais e contato direto com o vendedor. 
                   Realize o sonho do seu carro com o melhor custo-benefício.`,
        },
    };

    const block = blocks[type] || blocks.all;

    return (
        <div className="mt-10 p-6 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/8 rounded-2xl">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-3">{block.heading}</h2>
            <p className="text-sm text-slate-600 dark:text-zinc-400 leading-relaxed">{block.text}</p>
        </div>
    );
}

// ── Related pages internal linking ───────────────────────────────────────────
function RelatedLinks({ cars, currentMarca, currentCidade }: {
    cars: CarType[];
    currentMarca?: string;
    currentCidade?: string;
}) {
    const marcas   = [...new Set(cars.map(c => c.marca))].filter(m => m !== currentMarca).slice(0, 6);
    const cidades  = [...new Set(cars.map(c => c.cidade.split(',')[0].trim()))].filter(c => c !== currentCidade).slice(0, 6);
    const priceLinks = [
        { label: 'Até R$ 20 mil', slug: 'carros-ate-20-mil' },
        { label: 'Até R$ 30 mil', slug: 'carros-ate-30-mil' },
        { label: 'Até R$ 50 mil', slug: 'carros-ate-50-mil' },
        { label: 'Até R$ 100 mil', slug: 'carros-ate-100-mil' },
    ];

    return (
        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
            {marcas.length > 0 && (
                <div className="p-5 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/8 rounded-2xl">
                    <div className="flex items-center gap-2 mb-4">
                        <Tag className="w-4 h-4 text-brand-500 dark:text-brand-400" strokeWidth={1.5} />
                        <h3 className="text-sm font-bold text-slate-900 dark:text-white">Outras marcas</h3>
                    </div>
                    <ul className="space-y-2">
                        {marcas.map(marca => (
                            <li key={marca}>
                                <Link to={`/carros/${slugify(marca)}`}
                                    className="flex items-center gap-2 text-sm text-slate-600 dark:text-zinc-400 hover:text-brand-500 dark:hover:text-brand-400 transition-colors">
                                    <ChevronRight className="w-3.5 h-3.5 flex-shrink-0 text-brand-400/60" strokeWidth={1.5} />
                                    {marca} usados
                                </Link>
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {cidades.length > 0 && (
                <div className="p-5 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/8 rounded-2xl">
                    <div className="flex items-center gap-2 mb-4">
                        <MapPin className="w-4 h-4 text-brand-500 dark:text-brand-400" strokeWidth={1.5} />
                        <h3 className="text-sm font-bold text-slate-900 dark:text-white">Outras cidades</h3>
                    </div>
                    <ul className="space-y-2">
                        {cidades.map(cidade => (
                            <li key={cidade}>
                                <Link to={`/carros-usados/${slugify(cidade)}`}
                                    className="flex items-center gap-2 text-sm text-slate-600 dark:text-zinc-400 hover:text-brand-500 dark:hover:text-brand-400 transition-colors">
                                    <ChevronRight className="w-3.5 h-3.5 flex-shrink-0 text-brand-400/60" strokeWidth={1.5} />
                                    Carros em {cidade}
                                </Link>
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            <div className="p-5 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/8 rounded-2xl">
                <div className="flex items-center gap-2 mb-4">
                    <Search className="w-4 h-4 text-brand-500 dark:text-brand-400" strokeWidth={1.5} />
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">Por faixa de preço</h3>
                </div>
                <ul className="space-y-2">
                    {priceLinks.map(({ label, slug }) => (
                        <li key={slug}>
                            <Link to={`/${slug}`}
                                className="flex items-center gap-2 text-sm text-slate-600 dark:text-zinc-400 hover:text-brand-500 dark:hover:text-brand-400 transition-colors">
                                <ChevronRight className="w-3.5 h-3.5 flex-shrink-0 text-brand-400/60" strokeWidth={1.5} />
                                {label}
                            </Link>
                        </li>
                    ))}
                </ul>
            </div>
        </div>
    );
}

// ── JSON-LD Breadcrumb + ItemList ─────────────────────────────────────────────
function injectCategoryJsonLd(breadcrumbs: { name: string; url: string }[], cars: CarType[]) {
    // Remove old
    document.querySelectorAll('script[data-seo-category]').forEach(el => el.remove());

    const breadcrumbSchema = {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: breadcrumbs.map((b, i) => ({
            '@type': 'ListItem',
            position: i + 1,
            name: b.name,
            item: b.url,
        })),
    };

    const itemListSchema = cars.length > 0 ? {
        '@context': 'https://schema.org',
        '@type': 'ItemList',
        itemListElement: cars.slice(0, 10).map((car, i) => ({
            '@type': 'ListItem',
            position: i + 1,
            url: `${SITE_URL}/carro/${car.id}`,
            name: `${car.marca} ${car.modelo} ${car.ano}`,
        })),
    } : null;

    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.setAttribute('data-seo-category', '1');
    script.textContent = JSON.stringify(
        itemListSchema ? [breadcrumbSchema, itemListSchema] : breadcrumbSchema,
    );
    document.head.appendChild(script);

    return () => { document.querySelectorAll('script[data-seo-category]').forEach(el => el.remove()); };
}

// ── Main component ────────────────────────────────────────────────────────────
export default function CarrosCategoria() {
    const { marca, modelo, cidade } = useParams<{
        marca?: string; modelo?: string; cidade?: string;
    }>();
    const location = useLocation();
    const pathname = location.pathname;

    // Determine page type from route
    const priceRange = PRICE_RANGES[pathname.slice(1)] ?? null;

    let pageType: 'all' | 'cidade' | 'marca' | 'marca-modelo' | 'preco' = 'all';
    if (priceRange)          pageType = 'preco';
    else if (marca && modelo) pageType = 'marca-modelo';
    else if (marca)           pageType = 'marca';
    else if (cidade)          pageType = 'cidade';

    const resolvedMarca  = marca  ? deslugify(marca)  : undefined;
    const resolvedModelo = modelo ? deslugify(modelo) : undefined;
    const resolvedCidade = cidade ? deslugify(cidade) : undefined;

    const [cars, setCars]       = useState<CarType[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchCars = async () => {
            setLoading(true);
            try {
                let query = supabasePublic.from('anuncios').select('*');

                if (priceRange) {
                    query = query.lte('preco', priceRange.max);
                } else if (pageType === 'marca-modelo') {
                    query = query
                        .ilike('marca', `%${resolvedMarca}%`)
                        .ilike('modelo', `%${resolvedModelo}%`);
                } else if (pageType === 'marca') {
                    query = query.ilike('marca', `%${resolvedMarca}%`);
                } else if (pageType === 'cidade') {
                    query = query.ilike('cidade', `%${resolvedCidade}%`);
                }

                query = query
                    .order('prioridade', { ascending: false })
                    .order('created_at', { ascending: false });

                const { data, error } = await query;
                if (!error && data) {
                    setCars(data.map((d: any): CarType => ({
                        id: d.id, marca: d.marca, modelo: d.modelo, ano: Number(d.ano),
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
            } catch (err) {
                console.error('[CarrosCategoria] fetch error:', err);
            }
            setLoading(false);
        };
        fetchCars();
    }, [pathname]);

    // Inject SEO tags
    useEffect(() => {
        const meta = buildPageMeta({
            type: pageType,
            marca: resolvedMarca, modelo: resolvedModelo,
            cidade: resolvedCidade,
            priceLabel: priceRange?.label,
            count: cars.length,
        });

        document.title = meta.title;
        const setMeta = (name: string, content: string, prop = false) => {
            const sel   = prop ? `meta[property="${name}"]` : `meta[name="${name}"]`;
            const existing = document.querySelector(sel);
            if (existing) existing.setAttribute('content', content);
            else {
                const el = document.createElement('meta');
                if (prop) el.setAttribute('property', name); else el.name = name;
                el.setAttribute('content', content);
                document.head.appendChild(el);
            }
        };
        setMeta('description', meta.description);
        setMeta('robots', 'index, follow');
        setMeta('og:title', meta.title, true);
        setMeta('og:description', meta.description, true);
        setMeta('og:url', meta.canonical, true);
        setMeta('og:type', 'website', true);

        let canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
        if (!canonical) {
            canonical = document.createElement('link');
            canonical.rel = 'canonical';
            document.head.appendChild(canonical);
        }
        canonical.href = meta.canonical;

        const cleanup = injectCategoryJsonLd(meta.breadcrumbs, cars);
        return cleanup;
    }, [pageType, resolvedMarca, resolvedModelo, resolvedCidade, priceRange, cars]);

    const meta = buildPageMeta({
        type: pageType,
        marca: resolvedMarca, modelo: resolvedModelo,
        cidade: resolvedCidade,
        priceLabel: priceRange?.label,
        count: cars.length,
    });

    const formatPrice = (price: number) =>
        new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0 }).format(price);

    return (
        <div className="bg-slate-50 dark:bg-zinc-950 min-h-screen transition-colors duration-300">

            {/* ── Breadcrumb ───────────────────────────────────────────────────── */}
            <div className="border-b border-slate-200 dark:border-white/5 bg-white dark:bg-zinc-900/50">
                <div className="max-w-6xl mx-auto px-4 py-3">
                    <nav aria-label="breadcrumb">
                        <ol className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-zinc-500 flex-wrap">
                            {meta.breadcrumbs.map((crumb, i) => (
                                <li key={crumb.url} className="flex items-center gap-1.5">
                                    {i > 0 && <ChevronRight className="w-3 h-3 text-slate-400" strokeWidth={1.5} />}
                                    {i < meta.breadcrumbs.length - 1 ? (
                                        <Link to={crumb.url.replace(SITE_URL, '')}
                                            className="hover:text-brand-500 dark:hover:text-brand-400 transition-colors">
                                            {crumb.name}
                                        </Link>
                                    ) : (
                                        <span className="text-slate-700 dark:text-zinc-300 font-medium">{crumb.name}</span>
                                    )}
                                </li>
                            ))}
                        </ol>
                    </nav>
                </div>
            </div>

            {/* ── Page Header ──────────────────────────────────────────────────── */}
            <div className="bg-white dark:bg-zinc-900/50 border-b border-slate-200 dark:border-white/5 py-8">
                <div className="max-w-6xl mx-auto px-4">
                    <p className="text-xs font-bold text-brand-500 dark:text-brand-400 uppercase tracking-widest mb-2">
                        {loading ? '...' : `${cars.length} veículos encontrados`}
                    </p>
                    <h1 className="text-3xl md:text-4xl font-black text-slate-900 dark:text-white tracking-tight">
                        {meta.h1}
                    </h1>
                    <p className="text-slate-500 dark:text-zinc-500 mt-1 text-sm">
                        {meta.description.length > 120 ? meta.description.slice(0, 120) + '…' : meta.description}
                    </p>

                    {/* Price range quick-links */}
                    <div className="flex flex-wrap gap-2 mt-5">
                        {Object.entries(PRICE_RANGES).map(([slug, { label }]) => (
                            <Link key={slug} to={`/${slug}`}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                                    pathname === `/${slug}`
                                        ? 'bg-brand-400/20 border-brand-400/50 text-brand-500 dark:text-brand-400'
                                        : 'bg-slate-100 dark:bg-zinc-800 border-slate-200 dark:border-white/10 text-slate-600 dark:text-zinc-400 hover:border-brand-400/40 hover:text-brand-500'
                                }`}>
                                {label}
                            </Link>
                        ))}
                        <Link to="/carros-usados"
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                                pathname === '/carros-usados'
                                    ? 'bg-brand-400/20 border-brand-400/50 text-brand-500 dark:text-brand-400'
                                    : 'bg-slate-100 dark:bg-zinc-800 border-slate-200 dark:border-white/10 text-slate-600 dark:text-zinc-400 hover:border-brand-400/40 hover:text-brand-500'
                            }`}>
                            Todos
                        </Link>
                    </div>
                </div>
            </div>

            {/* ── Car Grid ─────────────────────────────────────────────────────── */}
            <div className="max-w-6xl mx-auto px-4 py-8">
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-32">
                        <div className="w-12 h-12 rounded-full border-2 border-brand-400/20 border-t-brand-400 animate-spin mb-4" />
                        <p className="text-slate-500 dark:text-zinc-500 text-sm">Carregando veículos…</p>
                    </div>
                ) : cars.length > 0 ? (
                    <motion.div
                        layout
                        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                        {cars.map((car, i) => (
                            <motion.div
                                key={car.id}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: i * 0.04 }}>
                                <CarCard car={car} />
                            </motion.div>
                        ))}
                    </motion.div>
                ) : (
                    <div className="flex flex-col items-center justify-center py-32 bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-white/5">
                        <Car className="w-16 h-16 text-slate-300 dark:text-zinc-700 mb-4" strokeWidth={1.5} />
                        <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Nenhum veículo encontrado</h2>
                        <p className="text-slate-500 dark:text-zinc-500 text-sm mb-6">
                            Ainda não há veículos cadastrados nesta categoria.
                        </p>
                        <Link to="/estoque"
                            className="px-6 py-2.5 bg-brand-400/10 border border-brand-400/20 text-brand-500 dark:text-brand-400 font-bold rounded-xl hover:bg-brand-400/20 transition-colors text-sm">
                            Ver estoque completo
                        </Link>
                    </div>
                )}

                {/* SEO content block */}
                <SeoContentBlock
                    type={pageType}
                    marca={resolvedMarca}
                    modelo={resolvedModelo}
                    cidade={resolvedCidade}
                    priceLabel={priceRange?.label}
                />

                {/* Internal links to related pages */}
                <RelatedLinks
                    cars={cars}
                    currentMarca={resolvedMarca}
                    currentCidade={resolvedCidade}
                />

                {/* CTA */}
                <div className="mt-10 text-center p-8 bg-brand-400/8 dark:bg-brand-400/5 border border-brand-400/20 rounded-2xl">
                    <h3 className="text-xl font-black text-slate-900 dark:text-white mb-2">
                        Quer anunciar seu veículo?
                    </h3>
                    <p className="text-slate-500 dark:text-zinc-400 text-sm mb-6">
                        Anuncie grátis no SulMotor e alcance milhares de compradores no Sul do Brasil.
                    </p>
                    <Link to="/anunciar"
                        className="inline-flex items-center gap-2 px-8 py-3 bg-brand-400 hover:bg-brand-300 text-zinc-950 font-black rounded-xl transition-all">
                        Anunciar Agora
                    </Link>
                </div>
            </div>
        </div>
    );
}
