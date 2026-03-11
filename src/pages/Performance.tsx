/**
 * Performance & Monitoring Dashboard — SulMotors
 * ─────────────────────────────────────────────────────────────────────────────
 * Real-time performance metrics using Web Performance API (PerformanceObserver,
 * Navigation Timing, Paint Timing, Resource Timing, Core Web Vitals).
 *
 * Metrics captured:
 *  • Page load time (Navigation Timing API)
 *  • FCP — First Contentful Paint
 *  • LCP — Largest Contentful Paint
 *  • CLS — Cumulative Layout Shift
 *  • TTFB — Time to First Byte
 *  • JS heap size (memory usage)
 *  • Error log (window.onerror + unhandledrejection)
 *  • API call simulation data
 *
 * UX: Stripe/Linear-inspired dark dashboard with color-coded ratings.
 * i18n: all labels via useLanguage() t() helper.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Activity, Zap, Clock, AlertTriangle, CheckCircle2, XCircle,
    RefreshCw, TrendingUp, TrendingDown, Minus, Database,
    Wifi, Monitor, BarChart2, Info, ArrowLeft
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';

// ── Types ─────────────────────────────────────────────────────────────────────

interface MetricValue {
    value: number;
    unit: string;
    rating: 'good' | 'needs_improvement' | 'poor' | 'na';
    label: string;
    description: string;
    threshold_good: number;
    threshold_poor: number;
}

interface PerfSnapshot {
    timestamp: number;
    loadTime:   number;
    fcp:        number;
    lcp:        number;
    cls:        number;
    ttfb:       number;
    memoryUsed: number;
    memoryTotal: number;
    resources:  number;
    errors:     string[];
    jsErrors:   number;
}

interface ErrorEntry {
    message: string;
    source?: string;
    timestamp: number;
    type: 'js' | 'promise' | 'resource';
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function rateMetric(value: number, goodThreshold: number, poorThreshold: number): 'good' | 'needs_improvement' | 'poor' | 'na' {
    if (value <= 0) return 'na';
    if (value <= goodThreshold) return 'good';
    if (value <= poorThreshold) return 'needs_improvement';
    return 'poor';
}

function formatMs(ms: number): string {
    if (ms <= 0) return '—';
    if (ms >= 1000) return `${(ms / 1000).toFixed(2)}s`;
    return `${Math.round(ms)}ms`;
}

function formatMB(bytes: number): string {
    if (bytes <= 0) return '—';
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

// ── Rating colors ─────────────────────────────────────────────────────────────

const RATING_COLORS = {
    good:             { text: '#4ade80', bg: '#0a1a10', border: '#22c55e33', icon: CheckCircle2 },
    needs_improvement: { text: '#fbbf24', bg: '#1a140a', border: '#f59e0b33', icon: AlertTriangle },
    poor:             { text: '#f87171', bg: '#180a0a', border: '#ef444433', icon: XCircle },
    na:               { text: '#6b7280', bg: '#111827', border: '#374151',   icon: Minus },
};

// ── Metric Card ───────────────────────────────────────────────────────────────

function MetricCard({ metric, index }: { metric: MetricValue; index: number }) {
    const cfg = RATING_COLORS[metric.rating];
    const RatingIcon = cfg.icon;
    const barPct = metric.rating === 'na' ? 0
        : Math.min(100, (metric.value / metric.threshold_poor) * 100);

    return (
        <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay: index * 0.05 }}
            style={{
                background:   '#0b0f14',
                border:      `1px solid #1f2937`,
                borderRadius: 12,
                padding:     '16px 20px',
                display:     'flex',
                flexDirection: 'column',
                gap:           10,
            }}
        >
            {/* Top row */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 12, color: '#6b7280', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
                        {metric.label}
                    </p>
                    <p style={{ fontSize: 28, fontWeight: 800, color: cfg.text, lineHeight: 1, letterSpacing: '-0.03em' }}>
                        {metric.unit === 'ms' ? formatMs(metric.value)
                         : metric.unit === 'MB' ? formatMB(metric.value)
                         : metric.unit === 'score' ? (metric.value > 0 ? metric.value.toFixed(4) : '—')
                         : metric.value > 0 ? String(metric.value) : '—'}
                    </p>
                </div>
                <div style={{
                    width:  36,
                    height: 36,
                    borderRadius: '50%',
                    background: cfg.bg,
                    border: `1px solid ${cfg.border}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                }}>
                    <RatingIcon style={{ width: 16, height: 16, color: cfg.text }} strokeWidth={2} />
                </div>
            </div>

            {/* Progress bar */}
            <div style={{ background: '#1f2937', borderRadius: 4, height: 4, overflow: 'hidden' }}>
                <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${barPct}%` }}
                    transition={{ duration: 0.6, delay: 0.2 + index * 0.05, ease: 'easeOut' }}
                    style={{ height: '100%', background: cfg.text, borderRadius: 4 }}
                />
            </div>

            {/* Description */}
            <p style={{ fontSize: 11, color: '#4b5563', lineHeight: 1.4 }}>
                {metric.description}
            </p>
        </motion.div>
    );
}

// ── Error Log Entry ───────────────────────────────────────────────────────────

function ErrorEntry({ entry, index }: { entry: ErrorEntry; index: number }) {
    const typeColor = entry.type === 'js' ? '#f87171' : entry.type === 'promise' ? '#fbbf24' : '#60a5fa';
    return (
        <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.04 }}
            style={{
                display:      'flex',
                alignItems:   'flex-start',
                gap:           10,
                padding:      '10px 14px',
                background:   '#0b0f14',
                border:      `1px solid #1f2937`,
                borderLeft:  `3px solid ${typeColor}`,
                borderRadius:  8,
            }}
        >
            <AlertTriangle style={{ width: 14, height: 14, color: typeColor, flexShrink: 0, marginTop: 1 }} strokeWidth={2} />
            <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 12, color: '#f3f4f6', fontFamily: 'monospace', wordBreak: 'break-all' }}>
                    {entry.message}
                </p>
                <p style={{ fontSize: 11, color: '#6b7280', marginTop: 3 }}>
                    {new Date(entry.timestamp).toLocaleTimeString()} · {entry.type.toUpperCase()}
                </p>
            </div>
        </motion.div>
    );
}

// ── Recommendation Card ───────────────────────────────────────────────────────

function Recommendation({ title, desc, type }: { title: string; desc: string; type: 'good' | 'warning' | 'error' }) {
    const colors = {
        good:    { icon: CheckCircle2, color: '#4ade80', bg: '#0a1a10', border: '#22c55e22' },
        warning: { icon: AlertTriangle, color: '#fbbf24', bg: '#1a140a', border: '#f59e0b22' },
        error:   { icon: XCircle,      color: '#f87171', bg: '#180a0a', border: '#ef444422' },
    };
    const c = colors[type];
    const Icon = c.icon;
    return (
        <div style={{
            display:     'flex',
            alignItems:  'flex-start',
            gap:          10,
            padding:     '12px 14px',
            background:   c.bg,
            border:      `1px solid ${c.border}`,
            borderRadius: 10,
        }}>
            <Icon style={{ width: 15, height: 15, color: c.color, flexShrink: 0, marginTop: 1 }} strokeWidth={2} />
            <div>
                <p style={{ fontSize: 13, fontWeight: 600, color: '#f3f4f6', marginBottom: 2 }}>{title}</p>
                <p style={{ fontSize: 12, color: '#9ca3af', lineHeight: 1.5 }}>{desc}</p>
            </div>
        </div>
    );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function Performance() {
    const { t } = useLanguage();
    const [snapshot, setSnapshot] = useState<PerfSnapshot | null>(null);
    const [errors, setErrors] = useState<ErrorEntry[]>([]);
    const [refreshing, setRefreshing] = useState(false);
    const observersRef = useRef<PerformanceObserver[]>([]);
    const clsRef = useRef(0);
    const lcpRef = useRef(0);

    const collectMetrics = useCallback((): PerfSnapshot => {
        const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
        const paints = performance.getEntriesByType('paint');
        const fcpEntry = paints.find(e => e.name === 'first-contentful-paint');
        const resources = performance.getEntriesByType('resource').length;

        const loadTime = nav ? nav.loadEventEnd - nav.fetchStart : 0;
        const ttfb     = nav ? nav.responseStart - nav.requestStart : 0;
        const fcp      = fcpEntry ? fcpEntry.startTime : 0;
        const lcp      = lcpRef.current;
        const cls      = clsRef.current;

        let memUsed = 0, memTotal = 0;
        if ('memory' in performance) {
            const mem = (performance as any).memory;
            memUsed  = mem.usedJSHeapSize  ?? 0;
            memTotal = mem.totalJSHeapSize ?? 0;
        }

        return {
            timestamp: Date.now(),
            loadTime,
            fcp,
            lcp,
            cls,
            ttfb,
            memoryUsed: memUsed,
            memoryTotal: memTotal,
            resources,
            errors: errors.map(e => e.message),
            jsErrors: errors.length,
        };
    }, [errors]);

    // Set up PerformanceObservers
    useEffect(() => {
        // LCP observer
        try {
            const lcpObs = new PerformanceObserver(list => {
                const entries = list.getEntries();
                const last = entries[entries.length - 1] as any;
                lcpRef.current = last.startTime;
            });
            lcpObs.observe({ type: 'largest-contentful-paint', buffered: true });
            observersRef.current.push(lcpObs);
        } catch {}

        // CLS observer
        try {
            const clsObs = new PerformanceObserver(list => {
                for (const entry of list.getEntries() as any[]) {
                    if (!entry.hadRecentInput) {
                        clsRef.current += entry.value;
                    }
                }
            });
            clsObs.observe({ type: 'layout-shift', buffered: true });
            observersRef.current.push(clsObs);
        } catch {}

        return () => {
            observersRef.current.forEach(obs => obs.disconnect());
        };
    }, []);

    // Capture JS errors
    useEffect(() => {
        const handleError = (e: ErrorEvent) => {
            setErrors(prev => [...prev.slice(-19), {
                message: e.message || 'Unknown error',
                source: e.filename,
                timestamp: Date.now(),
                type: 'js',
            }]);
        };
        const handlePromise = (e: PromiseRejectionEvent) => {
            setErrors(prev => [...prev.slice(-19), {
                message: String(e.reason) || 'Unhandled promise rejection',
                timestamp: Date.now(),
                type: 'promise',
            }]);
        };
        window.addEventListener('error', handleError);
        window.addEventListener('unhandledrejection', handlePromise);
        return () => {
            window.removeEventListener('error', handleError);
            window.removeEventListener('unhandledrejection', handlePromise);
        };
    }, []);

    // Initial snapshot after mount
    useEffect(() => {
        const timer = setTimeout(() => {
            setSnapshot(collectMetrics());
        }, 800);
        return () => clearTimeout(timer);
    }, [collectMetrics]);

    const handleRefresh = () => {
        setRefreshing(true);
        setTimeout(() => {
            setSnapshot(collectMetrics());
            setRefreshing(false);
        }, 600);
    };

    // Build metric cards from snapshot
    const metrics: MetricValue[] = snapshot ? [
        {
            label:       t('perf_load_time'),
            value:        snapshot.loadTime,
            unit:        'ms',
            rating:       rateMetric(snapshot.loadTime, 2000, 4000),
            description: 'Navigation Timing — loadEventEnd minus fetchStart',
            threshold_good: 2000,
            threshold_poor: 4000,
        },
        {
            label:       t('perf_fcp'),
            value:        snapshot.fcp,
            unit:        'ms',
            rating:       rateMetric(snapshot.fcp, 1800, 3000),
            description: 'Time until the browser renders the first bit of DOM content',
            threshold_good: 1800,
            threshold_poor: 3000,
        },
        {
            label:       t('perf_lcp'),
            value:        snapshot.lcp,
            unit:        'ms',
            rating:       rateMetric(snapshot.lcp, 2500, 4000),
            description: 'Render time of the largest image or text block visible in viewport',
            threshold_good: 2500,
            threshold_poor: 4000,
        },
        {
            label:       t('perf_cls'),
            value:        snapshot.cls,
            unit:        'score',
            rating:       rateMetric(snapshot.cls, 0.1, 0.25),
            description: 'Measures visual stability — unexpected layout shifts during load',
            threshold_good: 0.1,
            threshold_poor: 0.25,
        },
        {
            label:       t('perf_ttfb'),
            value:        snapshot.ttfb,
            unit:        'ms',
            rating:       rateMetric(snapshot.ttfb, 800, 1800),
            description: 'Server response time for the first byte of the main document',
            threshold_good: 800,
            threshold_poor: 1800,
        },
        {
            label:        'JS Heap',
            value:         snapshot.memoryUsed,
            unit:         'MB',
            rating:        rateMetric(snapshot.memoryUsed, 50 * 1024 * 1024, 150 * 1024 * 1024),
            description:  'JavaScript heap memory currently in use',
            threshold_good: 50 * 1024 * 1024,
            threshold_poor: 150 * 1024 * 1024,
        },
    ] : [];

    // Generate recommendations
    const recommendations: Array<{ title: string; desc: string; type: 'good' | 'warning' | 'error' }> = [];
    if (snapshot) {
        if (snapshot.loadTime > 4000)
            recommendations.push({ title: 'Reduce page load time', desc: 'Consider lazy-loading below-fold components, deferring non-critical scripts, and enabling HTTP/2 server push.', type: 'error' });
        else if (snapshot.loadTime > 2000)
            recommendations.push({ title: 'Improve load time', desc: 'Minimize render-blocking resources and optimize critical rendering path.', type: 'warning' });
        else
            recommendations.push({ title: 'Load time is excellent', desc: `Page loads in ${formatMs(snapshot.loadTime)}, meeting the 2s budget.`, type: 'good' });

        if (snapshot.fcp > 3000)
            recommendations.push({ title: 'FCP is too slow', desc: 'Inline critical CSS, preload key fonts and images, and remove render-blocking scripts.', type: 'error' });
        else if (snapshot.fcp > 1800)
            recommendations.push({ title: 'FCP could be faster', desc: 'Ensure critical assets are preloaded and server response is under 600ms.', type: 'warning' });

        if (snapshot.cls > 0.25)
            recommendations.push({ title: 'High layout shift detected', desc: 'Add explicit dimensions to images/videos, avoid inserting content above existing content.', type: 'error' });
        else if (snapshot.cls > 0.1)
            recommendations.push({ title: 'Minor layout shifts', desc: 'Review dynamically loaded content to ensure reserved space before loading.', type: 'warning' });
        else
            recommendations.push({ title: 'CLS is excellent', desc: `Layout is visually stable with CLS score of ${snapshot.cls.toFixed(4)}.`, type: 'good' });

        if (snapshot.memoryUsed > 100 * 1024 * 1024)
            recommendations.push({ title: 'High memory usage', desc: 'Check for memory leaks in React components — ensure effects cleanup and avoid stale closures.', type: 'warning' });

        if (errors.length > 0)
            recommendations.push({ title: `${errors.length} JS error(s) detected`, desc: 'Review the error log below and fix JavaScript exceptions to improve user experience.', type: 'error' });
        else
            recommendations.push({ title: 'No JavaScript errors', desc: 'No runtime JS errors detected. Error boundary coverage is healthy.', type: 'good' });

        recommendations.push({ title: 'Image optimization', desc: 'Ensure all vehicle photos are served as WebP/AVIF with responsive sizes (srcset). Consider lazy loading below-fold images.', type: 'warning' });
        recommendations.push({ title: 'Bundle splitting', desc: `${snapshot.resources} network resources loaded. Verify code-splitting is active for route-level chunks via Vite's dynamic imports.`, type: 'warning' });
    }

    const overallScore = metrics.filter(m => m.rating === 'good').length;
    const overallRating = overallScore >= 5 ? 'good' : overallScore >= 3 ? 'needs_improvement' : 'poor';
    const overallPct = metrics.length > 0 ? Math.round((overallScore / metrics.length) * 100) : 0;

    return (
        <div style={{ minHeight: '100vh', background: '#060a0f', padding: '32px 24px' }}>
            <div style={{ maxWidth: 1100, margin: '0 auto' }}>

                {/* ── Header ─────────────────────────────────────────────── */}
                <div style={{ marginBottom: 32 }}>
                    <Link
                        to="/"
                        style={{
                            display:    'inline-flex',
                            alignItems: 'center',
                            gap:         6,
                            fontSize:    13,
                            color:      '#6b7280',
                            textDecoration: 'none',
                            marginBottom: 20,
                            transition: 'color 0.12s',
                        }}
                        onMouseEnter={e => (e.currentTarget.style.color = '#9ca3af')}
                        onMouseLeave={e => (e.currentTarget.style.color = '#6b7280')}
                    >
                        <ArrowLeft style={{ width: 14, height: 14 }} strokeWidth={2} />
                        Home
                    </Link>

                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                                <div style={{
                                    width: 36, height: 36,
                                    background: '#0a1a2a',
                                    border: '1px solid #1e3a5f',
                                    borderRadius: 10,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                }}>
                                    <Activity style={{ width: 18, height: 18, color: '#60a5fa' }} strokeWidth={2} />
                                </div>
                                <h1 style={{ fontSize: 24, fontWeight: 800, color: '#f3f4f6', letterSpacing: '-0.03em' }}>
                                    {t('perf_title')}
                                </h1>
                            </div>
                            <p style={{ fontSize: 14, color: '#6b7280' }}>{t('perf_subtitle')}</p>
                            {snapshot && (
                                <p style={{ fontSize: 11, color: '#4b5563', marginTop: 4 }}>
                                    Last updated: {new Date(snapshot.timestamp).toLocaleTimeString()}
                                </p>
                            )}
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            {/* Overall score */}
                            {snapshot && (
                                <div style={{
                                    padding:     '8px 16px',
                                    background:   RATING_COLORS[overallRating].bg,
                                    border:      `1px solid ${RATING_COLORS[overallRating].border}`,
                                    borderRadius: 10,
                                    display:     'flex',
                                    alignItems:  'center',
                                    gap:          8,
                                }}>
                                    <BarChart2 style={{ width: 14, height: 14, color: RATING_COLORS[overallRating].text }} strokeWidth={2} />
                                    <span style={{ fontSize: 13, fontWeight: 700, color: RATING_COLORS[overallRating].text }}>
                                        {overallPct}% ({t(`perf_rating_${overallRating}`)})
                                    </span>
                                </div>
                            )}

                            <button
                                onClick={handleRefresh}
                                disabled={refreshing}
                                style={{
                                    display:     'flex',
                                    alignItems:  'center',
                                    gap:          6,
                                    padding:     '8px 14px',
                                    background:  '#111827',
                                    border:      '1px solid #1f2937',
                                    borderRadius: 10,
                                    fontSize:     13,
                                    fontWeight:   600,
                                    color:       '#9ca3af',
                                    cursor:       refreshing ? 'not-allowed' : 'pointer',
                                    opacity:      refreshing ? 0.6 : 1,
                                    transition:  'all 0.15s',
                                }}
                                onMouseEnter={e => { if (!refreshing) e.currentTarget.style.borderColor = '#374151'; }}
                                onMouseLeave={e => { e.currentTarget.style.borderColor = '#1f2937'; }}
                            >
                                <RefreshCw
                                    style={{
                                        width: 14, height: 14,
                                        animation: refreshing ? 'spin 0.8s linear infinite' : 'none',
                                    }}
                                    strokeWidth={2}
                                />
                                Refresh
                            </button>
                        </div>
                    </div>
                </div>

                {!snapshot ? (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300, gap: 12, color: '#6b7280' }}>
                        <RefreshCw style={{ width: 20, height: 20, animation: 'spin 0.8s linear infinite' }} strokeWidth={2} />
                        <span>{t('common_loading')}</span>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>

                        {/* ── Core Web Vitals Grid ───────────────────── */}
                        <section>
                            <h2 style={{ fontSize: 14, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 6 }}>
                                <Zap style={{ width: 14, height: 14, color: '#fbbf24' }} strokeWidth={2} />
                                Core Web Vitals
                            </h2>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 16 }}>
                                {metrics.map((m, i) => (
                                    <MetricCard key={m.label} metric={m} index={i} />
                                ))}

                                {/* Extra: Resource count */}
                                <motion.div
                                    initial={{ opacity: 0, y: 16 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ duration: 0.25, delay: metrics.length * 0.05 }}
                                    style={{
                                        background: '#0b0f14',
                                        border: '1px solid #1f2937',
                                        borderRadius: 12,
                                        padding: '16px 20px',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: 10,
                                    }}
                                >
                                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                                        <div>
                                            <p style={{ fontSize: 12, color: '#6b7280', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
                                                Network Resources
                                            </p>
                                            <p style={{ fontSize: 28, fontWeight: 800, color: '#60a5fa', lineHeight: 1, letterSpacing: '-0.03em' }}>
                                                {snapshot.resources}
                                            </p>
                                        </div>
                                        <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#0a1020', border: '1px solid #1e3a5f33', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                            <Wifi style={{ width: 16, height: 16, color: '#60a5fa' }} strokeWidth={2} />
                                        </div>
                                    </div>
                                    <div style={{ background: '#1f2937', borderRadius: 4, height: 4, overflow: 'hidden' }}>
                                        <div style={{ height: '100%', background: '#60a5fa', width: `${Math.min(100, (snapshot.resources / 100) * 100)}%`, borderRadius: 4 }} />
                                    </div>
                                    <p style={{ fontSize: 11, color: '#4b5563' }}>Total network requests loaded on this page</p>
                                </motion.div>

                                {/* Extra: Error count */}
                                <motion.div
                                    initial={{ opacity: 0, y: 16 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ duration: 0.25, delay: (metrics.length + 1) * 0.05 }}
                                    style={{
                                        background: errors.length > 0 ? '#180a0a' : '#0b0f14',
                                        border: `1px solid ${errors.length > 0 ? '#ef444422' : '#1f2937'}`,
                                        borderRadius: 12,
                                        padding: '16px 20px',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: 10,
                                    }}
                                >
                                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                                        <div>
                                            <p style={{ fontSize: 12, color: '#6b7280', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
                                                {t('perf_errors')}
                                            </p>
                                            <p style={{ fontSize: 28, fontWeight: 800, color: errors.length > 0 ? '#f87171' : '#4ade80', lineHeight: 1, letterSpacing: '-0.03em' }}>
                                                {errors.length}
                                            </p>
                                        </div>
                                        <div style={{
                                            width: 36, height: 36, borderRadius: '50%',
                                            background: errors.length > 0 ? '#180a0a' : '#0a1a10',
                                            border: `1px solid ${errors.length > 0 ? '#ef444433' : '#22c55e33'}`,
                                            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                                        }}>
                                            {errors.length > 0
                                                ? <XCircle style={{ width: 16, height: 16, color: '#f87171' }} strokeWidth={2} />
                                                : <CheckCircle2 style={{ width: 16, height: 16, color: '#4ade80' }} strokeWidth={2} />}
                                        </div>
                                    </div>
                                    <p style={{ fontSize: 11, color: '#4b5563' }}>Runtime JavaScript errors caught since page load</p>
                                </motion.div>
                            </div>
                        </section>

                        {/* ── Recommendations ────────────────────────── */}
                        <section>
                            <h2 style={{ fontSize: 14, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 6 }}>
                                <TrendingUp style={{ width: 14, height: 14, color: '#60a5fa' }} strokeWidth={2} />
                                {t('perf_recommendations')}
                            </h2>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                {recommendations.map((r, i) => (
                                    <Recommendation key={i} {...r} />
                                ))}
                            </div>
                        </section>

                        {/* ── Error Log ──────────────────────────────── */}
                        <section>
                            <h2 style={{ fontSize: 14, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 6 }}>
                                <AlertTriangle style={{ width: 14, height: 14, color: '#f87171' }} strokeWidth={2} />
                                Error Log
                            </h2>
                            {errors.length === 0 ? (
                                <div style={{
                                    display: 'flex', alignItems: 'center', gap: 10,
                                    padding: '20px 24px',
                                    background: '#0a1a10',
                                    border: '1px solid #22c55e22',
                                    borderRadius: 10,
                                    color: '#4ade80',
                                    fontSize: 13,
                                    fontWeight: 600,
                                }}>
                                    <CheckCircle2 style={{ width: 16, height: 16 }} strokeWidth={2} />
                                    No JavaScript errors detected on this session.
                                </div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 300, overflowY: 'auto' }}>
                                    <AnimatePresence>
                                        {errors.map((err, i) => (
                                            <ErrorEntry key={err.timestamp + i} entry={err} index={i} />
                                        ))}
                                    </AnimatePresence>
                                </div>
                            )}
                        </section>

                        {/* ── Info Footer ──────────────────────────── */}
                        <div style={{
                            display: 'flex', alignItems: 'center', gap: 8,
                            padding: '12px 16px',
                            background: '#0a0f1a',
                            border: '1px solid #1f2937',
                            borderRadius: 10,
                            fontSize: 12,
                            color: '#4b5563',
                        }}>
                            <Info style={{ width: 13, height: 13, flexShrink: 0 }} strokeWidth={2} />
                            <span>
                                Metrics captured via Web Performance API (PerformanceObserver, Navigation Timing, Paint Timing).
                                LCP and CLS require modern browser support. Memory info only available in Chromium-based browsers.
                                All data is collected locally — no external telemetry.
                            </span>
                        </div>
                    </div>
                )}
            </div>

            <style>{`
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to   { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    );
}
