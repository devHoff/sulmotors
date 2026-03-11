/**
 * ToastContainer — Enterprise notification stack.
 *
 * Spec:
 *  • Position: top-right, BELOW header via #sm-toast-root CSS rule
 *  • Max 3 visible notifications stacked vertically (newest on top)
 *  • If count > 3: show a "N novas notificações" group badge at top
 *  • Clicking group badge expands all notifications
 *  • Smooth reflow when items enter/leave (CSS transition on wrapper)
 *  • Registers push fn into toastBridge for external (non-React) calls
 *  • Uses React portal into #sm-toast-root for correct stacking
 */

import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Bell, ChevronDown, ChevronUp, X } from 'lucide-react';
import { useToast, _registerPush } from '../contexts/ToastContext';
import ToastItemCard from './ToastItem';

// Ensure the portal root exists (created once, persistent)
function getOrCreateRoot(): HTMLElement {
    let el = document.getElementById('sm-toast-root');
    if (!el) {
        el = document.createElement('div');
        el.id = 'sm-toast-root';
        document.body.appendChild(el);
    }
    return el;
}

const MAX_VISIBLE = 3;

export default function ToastContainer() {
    const { toasts, dismiss, dismissAll, push } = useToast();
    const [groupExpanded, setGroupExpanded] = useState(false);

    // Register push function into singleton bridge (for utils/toast.ts)
    useEffect(() => {
        _registerPush(push);
    }, [push]);

    // Auto-collapse group if toasts drop to ≤ MAX_VISIBLE
    useEffect(() => {
        if (toasts.length <= MAX_VISIBLE) setGroupExpanded(false);
    }, [toasts.length]);

    // Which toasts to show
    const visible = toasts.slice(0, MAX_VISIBLE);
    const overflow = toasts.length > MAX_VISIBLE ? toasts.length - MAX_VISIBLE : 0;

    // Expanded: show ALL toasts
    const expanded = groupExpanded ? toasts : visible;

    const handleGroupClick = useCallback(() => {
        setGroupExpanded(v => !v);
    }, []);

    if (toasts.length === 0) return null;

    const content = (
        <div
            aria-live="polite"
            aria-label="Notificações"
            style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-end',
                // Smooth height reflows when toasts appear/disappear
                transition: 'all 0.3s cubic-bezier(0.22,1,0.36,1)',
            }}
        >
            {/* ── Overflow group badge ─────────────────────────────────────── */}
            {overflow > 0 && (
                <div
                    style={{
                        width: 320,
                        marginBottom: 10,
                        animation: 'sm-slide-in 0.25s cubic-bezier(0.22,1,0.36,1) both',
                    }}
                >
                    <button
                        type="button"
                        onClick={handleGroupClick}
                        style={{
                            width: '100%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '10px 16px',
                            background: '#111827',
                            border: '1px solid #1f2937',
                            borderLeft: '4px solid #3b82f6',
                            borderRadius: 10,
                            boxShadow: '0 12px 30px rgba(0,0,0,0.35)',
                            cursor: 'pointer',
                            gap: 8,
                        }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <Bell style={{ width: 14, height: 14, color: '#60a5fa', flexShrink: 0 }} strokeWidth={2} />
                            <span style={{ fontSize: 13, fontWeight: 600, color: '#dbeafe' }}>
                                {toasts.length} novas notificações
                            </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ fontSize: 11, color: '#6b7280' }}>
                                {groupExpanded ? 'Recolher' : 'Ver todas'}
                            </span>
                            {groupExpanded
                                ? <ChevronUp style={{ width: 12, height: 12, color: '#6b7280' }} strokeWidth={2} />
                                : <ChevronDown style={{ width: 12, height: 12, color: '#6b7280' }} strokeWidth={2} />}
                        </div>
                    </button>

                    {/* ── Expanded group: summary list of hidden toasts ─── */}
                    {groupExpanded && overflow > 0 && (
                        <div
                            style={{
                                marginTop: 6,
                                background: '#0d1117',
                                border: '1px solid #1f2937',
                                borderRadius: 10,
                                padding: '10px 14px',
                                boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
                                animation: 'sm-fade-in 0.2s ease both',
                            }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                                <span style={{ fontSize: 11, fontWeight: 600, color: '#4b5563', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                                    Notificações agrupadas
                                </span>
                                <button
                                    type="button"
                                    onClick={dismissAll}
                                    style={{
                                        fontSize: 11,
                                        color: '#4b5563',
                                        background: 'none',
                                        border: 'none',
                                        cursor: 'pointer',
                                        padding: 0,
                                    }}
                                    onMouseEnter={e => (e.currentTarget.style.color = '#9ca3af')}
                                    onMouseLeave={e => (e.currentTarget.style.color = '#4b5563')}
                                >
                                    Limpar tudo
                                </button>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                {toasts.slice(MAX_VISIBLE).map(t => (
                                    <GroupedLine key={t.id} toast={t} onDismiss={dismiss} />
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* ── Visible toast stack ──────────────────────────────────────── */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                {expanded.map((t, i) => (
                    <ToastItemCard
                        key={t.id}
                        toast={t}
                        index={i}
                        onDismiss={dismiss}
                    />
                ))}
            </div>
        </div>
    );

    return createPortal(content, getOrCreateRoot());
}

// ── Grouped line (compact row for overflow toasts) ────────────────────────────

import type { ToastItem } from '../contexts/ToastContext';
import { CheckCircle2, XCircle, AlertTriangle, Info } from 'lucide-react';

const ICON_MAP = {
    success: { icon: CheckCircle2, color: '#4ade80' },
    error:   { icon: XCircle,      color: '#f87171' },
    warning: { icon: AlertTriangle, color: '#fbbf24' },
    info:    { icon: Info,          color: '#60a5fa' },
};

function GroupedLine({ toast, onDismiss }: { toast: ToastItem; onDismiss: (id: string) => void }) {
    const cfg = ICON_MAP[toast.type];
    const Icon = cfg.icon;

    return (
        <div
            style={{
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                gap: 8,
                padding: '6px 4px',
                borderBottom: '1px solid #1a2030',
            }}
        >
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, minWidth: 0, flex: 1 }}>
                <Icon style={{ width: 13, height: 13, color: cfg.color, flexShrink: 0, marginTop: 1 }} strokeWidth={2} />
                <div style={{ minWidth: 0 }}>
                    <p style={{ fontSize: 12, fontWeight: 600, color: '#d1d5db', lineHeight: 1.3 }}>{toast.title}</p>
                    {toast.description && (
                        <p style={{ fontSize: 11, color: '#6b7280', marginTop: 1, lineHeight: 1.3 }}>{toast.description}</p>
                    )}
                </div>
            </div>
            <button
                type="button"
                onClick={() => onDismiss(toast.id)}
                style={{
                    flexShrink: 0,
                    width: 16,
                    height: 16,
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: 0,
                    color: '#374151',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                }}
                onMouseEnter={e => (e.currentTarget.style.color = '#9ca3af')}
                onMouseLeave={e => (e.currentTarget.style.color = '#374151')}
            >
                <X style={{ width: 10, height: 10 }} strokeWidth={2.5} />
            </button>
        </div>
    );
}
