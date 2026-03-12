/**
 * Anti-fraud & vehicle validation utilities for SulMotor.
 * ─────────────────────────────────────────────────────────
 * Includes:
 *   - Spam / scam keyword detection
 *   - Daily listing rate-limit (localStorage)
 *   - Brazilian plate format validation (Mercosul + old)
 *   - Vehicle listing anomaly checks (price, description, images)
 */

// ── 1. SCAM KEYWORD DETECTOR ──────────────────────────────────────────────────

/** Known scam / spam keywords (case-insensitive) */
const SCAM_KEYWORDS: string[] = [
    'pix',
    'transferência',
    'transferencia',
    'depósito antecipado',
    'deposito antecipado',
    'urgente',
    'urgentíssimo',
    'urgentissimo',
    'só hoje',
    'so hoje',
    'promoção relâmpago',
    'promocao relampago',
    'aceito qualquer oferta',
    'preciso vender hoje',
    'whatsapp',
    'whatssap',
    'telegram',
    'clique aqui',
    'link externo',
    'financiamento garantido',
    'sem consulta',
    'nome sujo',
    'negativado',
    'cpf sujo',
    'ganhe',
    'grátis',
    'gratis',
];

export interface ScamCheckResult {
    flagged: boolean;
    matches: string[];
    severity: 'none' | 'low' | 'high';
}

export function checkScamKeywords(text: string): ScamCheckResult {
    const lower = text.toLowerCase();
    const matches = SCAM_KEYWORDS.filter(kw => lower.includes(kw.toLowerCase()));
    const severity: ScamCheckResult['severity'] =
        matches.length === 0 ? 'none' :
        matches.length <= 2 ? 'low' : 'high';
    return { flagged: matches.length > 0, matches, severity };
}

// ── 2. DAILY LISTING RATE LIMIT ───────────────────────────────────────────────

const RATE_LIMIT_KEY = 'sm_daily_listings';
const FREE_DAILY_LIMIT = 3;

interface RateLimitStore {
    date: string;   // 'YYYY-MM-DD'
    count: number;
}

function todayStr(): string {
    return new Date().toISOString().slice(0, 10);
}

export function getDailyListingCount(): number {
    try {
        const raw = localStorage.getItem(RATE_LIMIT_KEY);
        if (!raw) return 0;
        const store: RateLimitStore = JSON.parse(raw);
        if (store.date !== todayStr()) return 0;
        return store.count;
    } catch {
        return 0;
    }
}

export function incrementDailyListingCount(): void {
    const today = todayStr();
    try {
        const raw = localStorage.getItem(RATE_LIMIT_KEY);
        let store: RateLimitStore = raw ? JSON.parse(raw) : { date: today, count: 0 };
        if (store.date !== today) store = { date: today, count: 0 };
        store.count += 1;
        localStorage.setItem(RATE_LIMIT_KEY, JSON.stringify(store));
    } catch {}
}

export function canPostToday(): boolean {
    return getDailyListingCount() < FREE_DAILY_LIMIT;
}

export function remainingListingsToday(): number {
    return Math.max(0, FREE_DAILY_LIMIT - getDailyListingCount());
}

// ── 3. PLATE VALIDATOR ────────────────────────────────────────────────────────

/** Old format: ABC-1234 or ABC1234  |  Mercosul: ABC1D23 */
const OLD_PLATE_RE      = /^[A-Z]{3}[0-9]{4}$/;
const MERCOSUL_PLATE_RE = /^[A-Z]{3}[0-9]{1}[A-Z]{1}[0-9]{2}$/;

export function validatePlate(plate: string): boolean {
    const clean = plate.replace(/[^A-Z0-9]/g, '').toUpperCase();
    return OLD_PLATE_RE.test(clean) || MERCOSUL_PLATE_RE.test(clean);
}

export function formatPlate(plate: string): string {
    const clean = plate.replace(/[^A-Z0-9]/g, '').toUpperCase().slice(0, 7);
    if (clean.length === 7) {
        return `${clean.slice(0, 3)}-${clean.slice(3)}`;
    }
    return clean;
}

export function plateMask(value: string): string {
    // Keep only alphanumeric, uppercase, max 7 chars
    return value.replace(/[^A-Z0-9a-z]/g, '').toUpperCase().slice(0, 7);
}

// ── 4. VEHICLE LISTING VALIDATION ALGORITHM ──────────────────────────────────

export interface ValidationIssue {
    code: string;
    severity: 'warning' | 'error';
    message: string;
}

export interface ListingValidationResult {
    valid: boolean;
    issues: ValidationIssue[];
    score: number;          // 0–100 trust score
    requiresReview: boolean;
}

interface ListingInput {
    marca: string;
    modelo: string;
    ano: number;
    preco: number;
    quilometragem: number;
    descricao: string;
    imagens: string[];
    placa: string;
    combustivel?: string;
}

/** Rough market price bands (BRL) per brand tier */
const PRICE_BANDS: Record<string, { min: number; max: number }> = {
    // Premium
    BMW: { min: 80_000, max: 800_000 },
    'Mercedes-Benz': { min: 90_000, max: 1_000_000 },
    Audi: { min: 80_000, max: 700_000 },
    Porsche: { min: 200_000, max: 2_000_000 },
    Volvo: { min: 120_000, max: 500_000 },
    // Mid
    Toyota: { min: 40_000, max: 350_000 },
    Honda: { min: 40_000, max: 250_000 },
    Volkswagen: { min: 25_000, max: 300_000 },
    Hyundai: { min: 30_000, max: 250_000 },
    Kia: { min: 30_000, max: 200_000 },
    Nissan: { min: 30_000, max: 200_000 },
    // Budget
    Fiat: { min: 20_000, max: 200_000 },
    Chevrolet: { min: 20_000, max: 200_000 },
    Ford: { min: 20_000, max: 200_000 },
    Renault: { min: 20_000, max: 150_000 },
};

const CURRENT_YEAR = new Date().getFullYear();

export function validateListing(input: ListingInput): ListingValidationResult {
    const issues: ValidationIssue[] = [];
    let score = 100;

    // — Description length
    if (!input.descricao || input.descricao.trim().length < 50) {
        issues.push({
            code: 'DESC_TOO_SHORT',
            severity: 'error',
            message: 'A descrição deve ter no mínimo 50 caracteres. Descreva o estado e histórico do veículo.',
        });
        score -= 20;
    }

    // — Image count
    if (input.imagens.length === 0) {
        issues.push({ code: 'NO_IMAGES', severity: 'error', message: 'Adicione pelo menos uma foto do veículo.' });
        score -= 25;
    } else if (input.imagens.length < 3) {
        issues.push({ code: 'FEW_IMAGES', severity: 'warning', message: 'Anúncios com mais de 3 fotos recebem 3× mais contatos.' });
        score -= 8;
    }

    // — Plate format
    if (!input.placa || !validatePlate(input.placa)) {
        issues.push({ code: 'INVALID_PLATE', severity: 'error', message: 'Placa inválida. Use o formato ABC1234 (antigo) ou ABC1D23 (Mercosul).' });
        score -= 20;
    }

    // — Price anomaly
    const band = PRICE_BANDS[input.marca];
    if (band) {
        if (input.preco < band.min * 0.35) {
            issues.push({
                code: 'PRICE_SUSPICIOUSLY_LOW',
                severity: 'warning',
                message: `Preço muito abaixo do esperado para ${input.marca}. Listings com preços irreais são sinalizados para revisão.`,
            });
            score -= 30;
        } else if (input.preco > band.max * 2.0) {
            issues.push({
                code: 'PRICE_SUSPICIOUSLY_HIGH',
                severity: 'warning',
                message: `Preço muito acima do esperado para ${input.marca}. Verifique se o valor está correto.`,
            });
            score -= 10;
        }
    }

    // — Year validity
    if (input.ano < 1950 || input.ano > CURRENT_YEAR + 1) {
        issues.push({ code: 'INVALID_YEAR', severity: 'error', message: 'Ano inválido.' });
        score -= 15;
    }

    // — Mileage vs year anomaly
    const age = CURRENT_YEAR - input.ano;
    if (age > 0 && input.quilometragem === 0) {
        issues.push({ code: 'ZERO_KM_OLD_CAR', severity: 'warning', message: `Veículo de ${input.ano} com 0 km é incomum. Verifique a quilometragem.` });
        score -= 5;
    }
    if (age > 0 && input.quilometragem / age > 60_000) {
        issues.push({ code: 'HIGH_ANNUAL_KM', severity: 'warning', message: 'Quilometragem anual muito alta. Verifique o odômetro.' });
        score -= 5;
    }

    // — Scam keywords in description
    const scam = checkScamKeywords(input.descricao);
    if (scam.severity === 'high') {
        issues.push({
            code: 'SCAM_KEYWORDS_HIGH',
            severity: 'error',
            message: `Descrição contém termos suspeitos: "${scam.matches.slice(0, 3).join('", "')}". Remova referências a pagamentos ou links externos.`,
        });
        score -= 40;
    } else if (scam.severity === 'low') {
        issues.push({
            code: 'SCAM_KEYWORDS_LOW',
            severity: 'warning',
            message: `Atenção: a descrição menciona "${scam.matches[0]}". Evite termos que confundem compradores.`,
        });
        score -= 10;
    }

    score = Math.max(0, Math.min(100, score));
    const valid = !issues.some(i => i.severity === 'error');
    const requiresReview = score < 50 || issues.some(i => i.code === 'PRICE_SUSPICIOUSLY_LOW' || i.code === 'SCAM_KEYWORDS_HIGH');

    return { valid, issues, score, requiresReview };
}

// ── 5. MESSAGE FILTER ─────────────────────────────────────────────────────────

export interface MessageCheckResult {
    safe: boolean;
    matches: string[];
    warningText: string | null;
}

export function checkMessage(message: string): MessageCheckResult {
    const result = checkScamKeywords(message);
    const warningText = result.flagged
        ? `⚠️ Esta mensagem contém termos suspeitos (${result.matches.slice(0, 2).join(', ')}). Nunca faça pagamentos antecipados.`
        : null;
    return { safe: !result.flagged, matches: result.matches, warningText };
}
