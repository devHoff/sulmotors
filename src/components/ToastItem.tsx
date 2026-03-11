/**
 * ToastItem — Single enterprise toast notification card.
 *
 * Spec:
 *  • width: 320px, padding: 14px 16px, border-radius: 10px
 *  • background per type + left 4px border accent
 *  • Progress bar animates over `duration` ms, pauses on hover
 *  • Slide-in from right (40px), fade+slide exit
 *  • GPU-accelerated: only transform + opacity animated
 *  • Close button (×) top-right
 *  • Icon per type, soft colors
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { X, CheckCircle2, XCircle, AlertTriangle, Info } from 'lucide-react';
import type { ToastItem as ToastItemType } from '../contexts/ToastContext';

// ── Type config ───────────────────────────────────────────────────────────────

interface TypeStyle {
    bg: string;
    border: string;           // left border color
    icon: React.ElementType;
    iconColor: string;
    titleColor: string;
}

const TYPE_STYLES: Record<ToastItemType['type'], TypeStyle> = {
    success: {
        bg:         'bg-[#0f1f17]',
        border:     'border-l-[#22c55e]',
        icon:       CheckCircle2,
        iconColor:  '#4ade80',
        titleColor: '#d1fae5',
    },
    error: {
        bg:         'bg-[#1f1111]',
        border:     'border-l-[#ef4444]',
        icon:       XCircle,
        iconColor:  '#f87171',
        titleColor: '#fee2e2',
    },
    warning: {
        bg:         'bg-[#1f1a0f]',
        border:     'border-l-[#f59e0b]',
        icon:       AlertTriangle,
        iconColor:  '#fbbf24',
        titleColor: '#fef3c7',
    },
    info: {
        bg:         'bg-[#0f172a]',
        border:     'border-l-[#3b82f6]',
        icon:       Info,
        iconColor:  '#60a5fa',
        titleColor: '#dbeafe',
    },
};

const PROGRESS_COLORS: Record<ToastItemType['type'], string> = {
    success: '#22c55e',
    error:   '#ef4444',
    warning: '#f59e0b',
    info:    '#3b82f6',
};

// ── Component ─────────────────────────────────────────────────────────────────

interface ToastItemProps {
    toast: ToastItemType;
    onDismiss: (id: string) => void;
    index: number;           // position in visible stack (0 = newest/top)
    isGrouped?: boolean;     // inside expanded group?
}

export default function ToastItemCard({ toast, onDismiss, index, isGrouped = false }: ToastItemProps) {
    const { id, type, title, description, duration } = toast;
    const style = TYPE_STYLES[type];
    const Icon = style.icon;

    // Animation state
    const [phase, setPhase] = useState<'enter' | 'visible' | 'exit'>('enter');

    // Progress bar: 0 → 1 (full → empty)
    const [progress, setProgress] = useState(1);
    const elapsed = useRef(0);
    const lastTick = useRef<number | null>(null);
    const rafRef   = useRef<number>(0);
    const paused   = useRef(false);

    // Enter animation
    useEffect(() => {
        const t = requestAnimationFrame(() => setPhase('visible'));
        return () => cancelAnimationFrame(t);
    }, []);

    // Progress animation + auto-dismiss
    const tick = useCallback((now: number) => {
        if (paused.current) {
            lastTick.current = now;
            rafRef.current = requestAnimationFrame(tick);
            return;
        }
        if (lastTick.current !== null) {
            elapsed.current += now - lastTick.current;
        }
        lastTick.current = now;
        const ratio = Math.max(0, 1 - elapsed.current / duration);
        setProgress(ratio);
        if (elapsed.current >= duration) {
            setPhase('exit');
            return;
        }
        rafRef.current = requestAnimationFrame(tick);
    }, [duration]);

    useEffect(() => {
        rafRef.current = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(rafRef.current);
    }, [tick]);

    // When exit phase finishes, actually remove from DOM
    const handleExitEnd = () => {
        if (phase === 'exit') onDismiss(id);
    };

    const handleClose = () => setPhase('exit');

    const onMouseEnter = () => { paused.current = true; };
    const onMouseLeave = () => { paused.current = false; lastTick.current = null; };

    // ── CSS transitions ───────────────────────────────────────────────────────
    const translateX = phase === 'enter' ? '40px' : phase === 'exit' ? '56px' : '0px';
    const opacity    = phase === 'visible' ? '1' : '0';
    const pointerEvents = phase === 'exit' ? 'none' : 'auto';

    return (
        <div
            role="alert"
            aria-live="polite"
            onMouseEnter={onMouseEnter}
            onMouseLeave={onMouseLeave}
            onTransitionEnd={handleExitEnd}
            style={{
                width: '320px',
                transform: `translateX(${translateX})`,
                opacity,
                transition: 'transform 0.25s cubic-bezier(0.22,1,0.36,1), opacity 0.25s cubic-bezier(0.22,1,0.36,1)',
                willChange: 'transform, opacity',
                pointerEvents: pointerEvents as 'none' | 'auto',
                marginBottom: isGrouped ? '0' : '10px',
            }}
        >
            <div
                className={`
                    relative overflow-hidden rounded-[10px]
                    ${style.bg}
                    border border-[#1f2937] border-l-4 ${style.border}
                `}
                style={{
                    boxShadow: '0 12px 30px rgba(0,0,0,0.35)',
                    padding: '14px 16px',
                }}
            >
                {/* ── Main content row ──────────────────────────────────── */}
                <div className="flex items-start gap-3 pr-6">
                    {/* Icon */}
                    <div className="flex-shrink-0 mt-0.5">
                        <Icon
                            style={{ color: style.iconColor, width: 16, height: 16 }}
                            strokeWidth={2}
                        />
                    </div>

                    {/* Text */}
                    <div className="flex-1 min-w-0">
                        <p
                            className="leading-snug truncate"
                            style={{
                                fontSize: 14,
                                fontWeight: 600,
                                color: style.titleColor,
                                letterSpacing: '-0.01em',
                            }}
                        >
                            {title}
                        </p>
                        {description && (
                            <p
                                className="mt-0.5 leading-relaxed"
                                style={{
                                    fontSize: 13,
                                    color: '#9ca3af',
                                    lineHeight: 1.45,
                                }}
                            >
                                {description}
                            </p>
                        )}
                    </div>
                </div>

                {/* ── Close button ──────────────────────────────────────── */}
                <button
                    type="button"
                    onClick={handleClose}
                    aria-label="Fechar notificação"
                    className="absolute top-3 right-3 flex items-center justify-center rounded-md transition-colors"
                    style={{
                        width: 20,
                        height: 20,
                        color: '#4b5563',
                        background: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        padding: 0,
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = '#9ca3af'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = '#4b5563'; }}
                >
                    <X style={{ width: 12, height: 12 }} strokeWidth={2.5} />
                </button>

                {/* ── Progress bar ─────────────────────────────────────── */}
                <div
                    className="absolute bottom-0 left-0 right-0"
                    style={{ height: 2, background: '#1f2937' }}
                >
                    <div
                        style={{
                            height: '100%',
                            width: `${progress * 100}%`,
                            background: PROGRESS_COLORS[type],
                            opacity: 0.6,
                            transition: 'none',   // RAF-driven, no CSS transition
                        }}
                    />
                </div>
            </div>
        </div>
    );
}
