/**
 * src/lib/seoService.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * SEO service for SulMotor.
 *
 * Provides:
 *   • Slug generation: /carros/mercedes-amg-g63-2025-sao-paulo
 *   • Meta title + description generation
 *   • JSON-LD structured data (Vehicle / Product / Offer schema)
 *   • Open Graph tags
 *   • Dynamic <head> injection via DOM helpers
 *   • Sitemap XML generation (static list of key routes)
 *
 * No UI components here — pure logic / data helpers only.
 */

// ── Car interface (minimal subset needed for SEO) ─────────────────────────────
export interface SeoCarData {
    id:            string;
    marca:         string;
    modelo:        string;
    ano:           number;
    preco:         number;
    quilometragem: number;
    cidade:        string;
    slug?:         string;   // DB-stored slug (preferred) — generated client-side as fallback
    descricao?:    string;
    imagens?:      string[];
    combustivel?:  string;
    cambio?:       string;
    cor?:          string;
    created_at?:   string;
    updated_at?:   string;
}

export interface SeoMetadata {
    title:           string;
    description:     string;
    canonical:       string;
    slug:            string;
    ogImage:         string | null;
    ogType:          string;
    jsonLd:          VehicleJsonLd;
    keywords:        string[];
    robots:          string;
    /** ISO date for lastmod in sitemap */
    lastmod?:        string;
}

export interface VehicleJsonLd {
    '@context':              string;
    '@type':                 string;
    name:                    string;
    brand:                   { '@type': string; name: string };
    model:                   string;
    vehicleModelDate:        string;
    fuelType?:               string;
    vehicleTransmission?:    string;
    color?:                  string;
    mileageFromOdometer:     { '@type': string; value: number; unitCode: string };
    offers:                  { '@type': string; price: number; priceCurrency: string; availability: string; url: string };
    image?:                  string;
    description?:            string;
    url:                     string;
}

// ── Constants ─────────────────────────────────────────────────────────────────
const SITE_URL   = 'https://sulmotor.com';
const SITE_NAME  = 'SulMotor';
const DEFAULT_OG = `${SITE_URL}/og-default.jpg`;

// ── Slug generation ───────────────────────────────────────────────────────────

/** Remove diacritics and normalize text for slug */
function slugify(text: string): string {
    return text
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')  // strip diacritics
        .replace(/[^\w\s-]/g, '')          // remove special chars
        .replace(/[\s_]+/g, '-')           // spaces/underscores → dash
        .replace(/-+/g, '-')               // collapse multiple dashes
        .replace(/^-|-$/g, '');            // trim leading/trailing dash
}

/**
 * Build the URL-safe slug for a listing from its attributes.
 * Uses the DB-stored slug when available (guaranteed unique by the DB trigger);
 * otherwise derives it client-side as a fallback.
 *
 * Pattern: {marca}-{modelo}-{ano}-{cidade}
 * Example: ford-territory-titanium-2021-porto-alegre
 */
export function buildCarSlug(car: SeoCarData): string {
    // Prefer the slug stored in the DB (guaranteed unique, set by the trigger)
    if (car.slug && car.slug.length > 0) return car.slug;
    // Client-side fallback (used before migration is run)
    const city = car.cidade.split(',')[0].trim();
    return slugify([car.marca, car.modelo, String(car.ano), city].join(' '));
}

/** @deprecated use buildCarSlug instead */
export function generateSlug(car: SeoCarData): string {
    return buildCarSlug(car);
}

/**
 * Full canonical URL for a listing — uses the friendly slug path.
 * Example: https://sulmotor.com/carro/ford-territory-titanium-2021-porto-alegre
 *
 * If only the UUID is available (before migration), falls back to UUID URL.
 * Old UUID URLs redirect 301 → slug URL via .htaccess RewriteRule.
 */
export function getListingCanonical(car: SeoCarData | string): string {
    // Called with a full car object → use slug
    if (typeof car === 'object') {
        return `${SITE_URL}/carro/${buildCarSlug(car)}`;
    }
    // Called with just an ID string → legacy fallback (will be redirected)
    return `${SITE_URL}/carro/${car}`;
}

/**
 * Slug-based SEO URL (for structured data and sitemap).
 * Example: https://sulmotor.com/carro/ford-territory-titanium-2021-porto-alegre
 */
export function getSlugUrl(car: SeoCarData): string {
    return `${SITE_URL}/carro/${buildCarSlug(car)}`;
}

// ── Meta title generation ─────────────────────────────────────────────────────

export function generateMetaTitle(car: SeoCarData): string {
    const city = car.cidade.split(',')[0].trim();
    const raw  = `${car.marca} ${car.modelo} ${car.ano} à venda em ${city} | ${SITE_NAME}`;
    return raw.length > 70 ? raw.substring(0, 67) + '...' : raw;
}

// ── Meta description generation ───────────────────────────────────────────────

export function generateMetaDescription(car: SeoCarData): string {
    const city  = car.cidade.split(',')[0].trim();
    const price = new Intl.NumberFormat('pt-BR', {
        style: 'currency', currency: 'BRL', minimumFractionDigits: 0,
    }).format(car.preco);
    const km = new Intl.NumberFormat('pt-BR').format(car.quilometragem);

    let desc = `${car.marca} ${car.modelo} ${car.ano}, ${km} km, ${price}. À venda em ${city}.`;

    if (car.descricao) {
        const extra = ` ${car.descricao.substring(0, 80)}`;
        const combined = desc + extra;
        desc = combined.length <= 160 ? combined : desc;
    }

    if (desc.length > 160) desc = desc.substring(0, 157) + '...';
    return desc;
}

// ── Keywords generation ───────────────────────────────────────────────────────

export function generateKeywords(car: SeoCarData): string[] {
    const city  = car.cidade.split(',')[0].trim();
    const state = car.cidade.includes(',') ? car.cidade.split(',').pop()?.trim() : '';

    const keywords = [
        `${car.marca} ${car.modelo}`,
        `${car.marca} ${car.modelo} ${car.ano}`,
        `${car.marca} ${car.modelo} à venda`,
        `${car.marca} ${car.modelo} ${city}`,
        `carros usados ${city}`,
        `comprar ${car.marca} ${car.modelo}`,
        `${car.marca} ${car.modelo} ${car.ano} preço`,
        'carros usados',
        'carros semi novos',
        'SulMotor',
        'marketplace de carros',
    ];

    if (state) {
        keywords.push(`carros usados ${state}`);
        keywords.push(`${car.marca} ${state}`);
    }
    if (car.combustivel) keywords.push(`${car.marca} ${car.modelo} ${car.combustivel}`);

    return keywords.filter(Boolean);
}

// ── JSON-LD structured data ───────────────────────────────────────────────────

export function generateJsonLd(car: SeoCarData): VehicleJsonLd {
    const canonical = getListingCanonical(car);
    return {
        '@context':        'https://schema.org',
        '@type':           'Vehicle',
        name:              `${car.marca} ${car.modelo} ${car.ano}`,
        brand:             { '@type': 'Brand', name: car.marca },
        model:             car.modelo,
        vehicleModelDate:  String(car.ano),
        fuelType:          car.combustivel,
        vehicleTransmission: car.cambio,
        color:             car.cor,
        mileageFromOdometer: {
            '@type':   'QuantitativeValue',
            value:     car.quilometragem,
            unitCode:  'KMT',
        },
        offers: {
            '@type':        'Offer',
            price:          car.preco,
            priceCurrency:  'BRL',
            availability:   'https://schema.org/InStock',
            url:            canonical,
        },
        image:       car.imagens?.[0] ?? undefined,
        description: car.descricao ? car.descricao.substring(0, 500) : undefined,
        url:         canonical,
    };
}

// ── Full SEO metadata object ──────────────────────────────────────────────────

export function generateSeoMetadata(car: SeoCarData): SeoMetadata {
    const slug = buildCarSlug(car);
    return {
        title:       generateMetaTitle(car),
        description: generateMetaDescription(car),
        canonical:   `${SITE_URL}/carro/${slug}`,
        slug,        // the friendly slug string itself
        ogImage:     car.imagens?.[0] ?? DEFAULT_OG,
        ogType:      'product',
        jsonLd:      generateJsonLd(car),
        keywords:    generateKeywords(car),
        robots:      'index, follow',
        lastmod:     car.updated_at ?? car.created_at,
    };
}

// ── DOM head tag injection ────────────────────────────────────────────────────
/**
 * Dynamically sets page <head> meta tags for a listing.
 * Called from DetalheCarro.tsx useEffect after loading car data.
 * Idempotent — safe to call on navigation, removes old tags first.
 */
export function injectSeoTags(meta: SeoMetadata): () => void {
    const added: HTMLElement[] = [];

    function setMeta(attrs: Record<string, string>) {
        // Use property/name as key for idempotency
        const key   = attrs.property ?? attrs.name ?? '';
        const sel   = attrs.property
            ? `meta[property="${attrs.property}"]`
            : `meta[name="${attrs.name}"]`;
        const existing = document.querySelector(sel);
        if (existing) existing.remove();

        if (!key) return;
        const el = document.createElement('meta');
        Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
        document.head.appendChild(el);
        added.push(el);
    }

    // Title
    const oldTitle = document.title;
    document.title = meta.title;

    // Basic meta
    setMeta({ name: 'description',        content: meta.description });
    setMeta({ name: 'keywords',           content: meta.keywords.join(', ') });
    setMeta({ name: 'robots',             content: meta.robots });

    // Canonical
    let canonicalEl = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    const oldCanonical = canonicalEl?.href;
    if (!canonicalEl) {
        canonicalEl = document.createElement('link');
        canonicalEl.rel = 'canonical';
        document.head.appendChild(canonicalEl);
        added.push(canonicalEl);
    }
    canonicalEl.href = meta.canonical;

    // Open Graph
    setMeta({ property: 'og:title',        content: meta.title });
    setMeta({ property: 'og:description',  content: meta.description });
    setMeta({ property: 'og:type',         content: meta.ogType });
    setMeta({ property: 'og:url',          content: meta.canonical });
    if (meta.ogImage) setMeta({ property: 'og:image', content: meta.ogImage });
    setMeta({ property: 'og:site_name',    content: SITE_NAME });

    // Twitter Card
    setMeta({ name: 'twitter:card',        content: 'summary_large_image' });
    setMeta({ name: 'twitter:title',       content: meta.title });
    setMeta({ name: 'twitter:description', content: meta.description });
    if (meta.ogImage) setMeta({ name: 'twitter:image', content: meta.ogImage });

    // JSON-LD script
    const existingJsonLd = document.querySelector('script[type="application/ld+json"][data-sulmotors]');
    if (existingJsonLd) existingJsonLd.remove();
    const scriptEl = document.createElement('script');
    scriptEl.type = 'application/ld+json';
    scriptEl.setAttribute('data-sulmotors', 'vehicle');
    scriptEl.textContent = JSON.stringify(meta.jsonLd, null, 0);
    document.head.appendChild(scriptEl);
    added.push(scriptEl);

    // Cleanup function (call on unmount)
    return () => {
        added.forEach(el => el?.remove());
        document.title = oldTitle;
        if (canonicalEl && oldCanonical) canonicalEl.href = oldCanonical;
        else canonicalEl?.remove();
    };
}

// ── Sitemap generation ────────────────────────────────────────────────────────

export interface SitemapEntry {
    loc:        string;
    lastmod?:   string;
    changefreq: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never';
    priority:   number;
}

/** Generate sitemap XML entries for static pages */
export function getStaticSitemapEntries(): SitemapEntry[] {
    const today = new Date().toISOString().split('T')[0];
    return [
        { loc: `${SITE_URL}/`,             lastmod: today, changefreq: 'daily',   priority: 1.00 },
        { loc: `${SITE_URL}/estoque`,      lastmod: today, changefreq: 'hourly',  priority: 0.90 },
        { loc: `${SITE_URL}/sobre-nos`,    lastmod: today, changefreq: 'monthly', priority: 0.40 },
        { loc: `${SITE_URL}/termos`,       lastmod: today, changefreq: 'yearly',  priority: 0.20 },
        { loc: `${SITE_URL}/privacidade`,  lastmod: today, changefreq: 'yearly',  priority: 0.20 },
    ];
}

/** Generate sitemap XML entry for a single car listing */
export function carToSitemapEntry(car: SeoCarData): SitemapEntry {
    return {
        loc:        getListingCanonical(car),  // slug-based URL
        lastmod:    (car.updated_at ?? car.created_at ?? new Date().toISOString()).split('T')[0],
        changefreq: 'daily',
        priority:   0.80,
    };
}

/** Render a list of SitemapEntry objects as XML string */
export function renderSitemapXml(entries: SitemapEntry[]): string {
    const items = entries.map(e => `  <url>
    <loc>${e.loc}</loc>${e.lastmod ? `\n    <lastmod>${e.lastmod}</lastmod>` : ''}
    <changefreq>${e.changefreq}</changefreq>
    <priority>${e.priority.toFixed(2)}</priority>
  </url>`).join('\n');

    return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${items}
</urlset>`;
}

// ── Default page meta (home, estoque, etc.) ───────────────────────────────────
export const PAGE_META: Record<string, { title: string; description: string }> = {
    home: {
        title:       `SulMotor — Compre e Venda Carros com Segurança`,
        description: `O maior marketplace de carros usados e seminovos do Sul do Brasil. Encontre seu próximo carro com facilidade e segurança.`,
    },
    estoque: {
        title:       `Carros à Venda — Estoque | SulMotor`,
        description: `Navegue por centenas de carros usados e seminovos. Filtre por marca, modelo, preço, ano e cidade.`,
    },
    anunciar: {
        title:       `Anuncie Seu Carro | SulMotor`,
        description: `Venda seu carro rápido e seguro. Crie seu anúncio grátis no SulMotor e alcance milhares de compradores.`,
    },
    login: {
        title:       `Entrar | SulMotor`,
        description: `Acesse sua conta SulMotor para gerenciar seus anúncios e favoritos.`,
    },
};
