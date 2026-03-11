/**
 * NotificationBell — Navbar bell icon with unread badge + history dropdown.
 *
 * Design spec:
 *  • Bell button: 36×36, rounded-xl, border border-slate-200/dark:border-white/10
 *  • Red badge (top-right of bell): unread count, max "9+" display
 *  • Dropdown panel: 380px wide, max-h 480px scrollable, fixed below bell
 *  • Dark palette: bg #0b0f14, border #1f2937, text #f3f4f6 / #9ca3af
 *  • Per-item left accent border by type
 *  • Actions: mark individual read, mark all read, delete, clear all
 *  • Empty state with SVG illustration
 *  • Animate with framer-motion (slide-down + fade)
 *  • Closes on outside click or Escape key
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Bell,
    BellOff,
    CheckCircle2,
    XCircle,
    AlertTriangle,
    Info,
    MessageSquare,
    Check,
    CheckCheck,
    Trash2,
    X,
    Clock,
} from 'lucide-react';
import { useNotifications, _registerNotifPush, type Notification, type NotifType } from '../contexts/NotificationContext';
import { Link } from 'react-router-dom';

// ── Type config ───────────────────────────────────────────────────────────────

interface TypeCfg {
    icon:        React.ElementType;
    iconColor:   string;
    borderColor: string;
    bgColor:     string;
    label:       string;
}

const TYPE_CFG: Record<NotifType, TypeCfg> = {
    success: {
        icon:        CheckCircle2,
        iconColor:   '#4ade80',
        borderColor: '#22c55e',
        bgColor:     '#0f1f17',
        label:       'Sucesso',
    },
    error: {
        icon:        XCircle,
        iconColor:   '#f87171',
        borderColor: '#ef4444',
        bgColor:     '#1f1111',
        label:       'Erro',
    },
    warning: {
        icon:        AlertTriangle,
        iconColor:   '#fbbf24',
        borderColor: '#f59e0b',
        bgColor:     '#1f1a0f',
        label:       'Atenção',
    },
    info: {
        icon:        Info,
        iconColor:   '#60a5fa',
        borderColor: '#3b82f6',
        bgColor:     '#0f172a',
        label:       'Informação',
    },
    message: {
        icon:        MessageSquare,
        iconColor:   '#a78bfa',
        borderColor: '#8b5cf6',
        bgColor:     '#130f1f',
        label:       'Mensagem',
    },
};

// ── Relative time helper ──────────────────────────────────────────────────────

function relativeTime(ts: number): string {
    const diff = Date.now() - ts;
    const s = Math.floor(diff / 1000);
    if (s < 60)  return 'agora';
    const m = Math.floor(s / 60);
    if (m < 60)  return `${m}min`;
    const h = Math.floor(m / 60);
    if (h < 24)  return `${h}h`;
    const d = Math.floor(h / 24);
    if (d < 7)   return `${d}d`;
    return new Date(ts).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}

// ── Individual notification row ───────────────────────────────────────────────

function NotifRow({
    notif,
    onRead,
    onRemove,
}: {
    notif:    Notification;
    onRead:   (id: string) => void;
    onRemove: (id: string) => void;
}) {
    const cfg  = TYPE_CFG[notif.type];
    const Icon = cfg.icon;

    return (
        <motion.div
            layout
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 16 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            style={{
                display: 'flex',
                gap: 10,
                padding: '11px 14px',
                background: notif.isRead ? 'transparent' : cfg.bgColor,
                borderLeft: `3px solid ${notif.isRead ? '#1f2937' : cfg.borderColor}`,
                borderBottom: '1px solid #1a1f2e',
                transition: 'background 0.25s, border-color 0.25s',
                cursor: notif.href ? 'pointer' : 'default',
                position: 'relative',
            }}
            onClick={() => { if (!notif.isRead) onRead(notif.id); }}
        >
            {/* Icon */}
            <div style={{ flexShrink: 0, paddingTop: 1 }}>
                <Icon style={{ width: 15, height: 15, color: notif.isRead ? '#4b5563' : cfg.iconColor }} strokeWidth={2} />
            </div>

            {/* Content */}
            <div style={{ flex: 1, minWidth: 0 }}>
                {notif.href ? (
                    <Link
                        to={notif.href}
                        style={{ textDecoration: 'none' }}
                        onClick={e => e.stopPropagation()}
                    >
                        <p style={{
                            fontSize: 13,
                            fontWeight: notif.isRead ? 400 : 600,
                            color: notif.isRead ? '#6b7280' : '#f3f4f6',
                            lineHeight: 1.35,
                            marginBottom: notif.description ? 2 : 0,
                        }}>
                            {notif.title}
                        </p>
                    </Link>
                ) : (
                    <p style={{
                        fontSize: 13,
                        fontWeight: notif.isRead ? 400 : 600,
                        color: notif.isRead ? '#6b7280' : '#f3f4f6',
                        lineHeight: 1.35,
                        marginBottom: notif.description ? 2 : 0,
                    }}>
                        {notif.title}
                    </p>
                )}
                {notif.description && (
                    <p style={{
                        fontSize: 12,
                        color: notif.isRead ? '#374151' : '#9ca3af',
                        lineHeight: 1.4,
                    }}>
                        {notif.description}
                    </p>
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
                    <Clock style={{ width: 10, height: 10, color: '#374151' }} strokeWidth={2} />
                    <span style={{ fontSize: 11, color: '#4b5563' }}>{relativeTime(notif.timestamp)}</span>
                    {!notif.isRead && (
                        <span style={{
                            width: 6, height: 6,
                            borderRadius: '50%',
                            background: cfg.borderColor,
                            marginLeft: 4,
                            flexShrink: 0,
                            display: 'inline-block',
                        }} />
                    )}
                </div>
            </div>

            {/* Action buttons (appear on hover via CSS class) */}
            <div
                className="notif-actions"
                style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 4,
                    flexShrink: 0,
                }}
            >
                {!notif.isRead && (
                    <button
                        type="button"
                        title="Marcar como lida"
                        onClick={e => { e.stopPropagation(); onRead(notif.id); }}
                        style={{
                            width: 22, height: 22,
                            background: 'none', border: 'none',
                            borderRadius: 6,
                            cursor: 'pointer',
                            color: '#374151',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            padding: 0,
                            transition: 'color 0.15s',
                        }}
                        onMouseEnter={e => (e.currentTarget.style.color = '#22c55e')}
                        onMouseLeave={e => (e.currentTarget.style.color = '#374151')}
                    >
                        <Check style={{ width: 12, height: 12 }} strokeWidth={2.5} />
                    </button>
                )}
                <button
                    type="button"
                    title="Remover"
                    onClick={e => { e.stopPropagation(); onRemove(notif.id); }}
                    style={{
                        width: 22, height: 22,
                        background: 'none', border: 'none',
                        borderRadius: 6,
                        cursor: 'pointer',
                        color: '#374151',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        padding: 0,
                        transition: 'color 0.15s',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.color = '#f87171')}
                    onMouseLeave={e => (e.currentTarget.style.color = '#374151')}
                >
                    <X style={{ width: 12, height: 12 }} strokeWidth={2.5} />
                </button>
            </div>
        </motion.div>
    );
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyState() {
    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '40px 24px',
            gap: 12,
        }}>
            <div style={{
                width: 52, height: 52,
                borderRadius: '50%',
                background: '#111827',
                border: '1px solid #1f2937',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
                <BellOff style={{ width: 22, height: 22, color: '#374151' }} strokeWidth={1.5} />
            </div>
            <div style={{ textAlign: 'center' }}>
                <p style={{ fontSize: 14, fontWeight: 600, color: '#6b7280', marginBottom: 4 }}>
                    Sem notificações
                </p>
                <p style={{ fontSize: 12, color: '#374151', lineHeight: 1.5 }}>
                    As notificações aparecerão aqui quando houver novidades.
                </p>
            </div>
        </div>
    );
}

// ── Main NotificationBell component ──────────────────────────────────────────

export default function NotificationBell() {
    const [open, setOpen] = useState(false);
    const [filter, setFilter] = useState<NotifType | 'all'>('all');
    const panelRef = useRef<HTMLDivElement>(null);
    const btnRef   = useRef<HTMLButtonElement>(null);

    const {
        notifications,
        unreadCount,
        push,
        markRead,
        markAllRead,
        remove,
        clearAll,
    } = useNotifications();

    // Register bridge so notification pushes work from outside React
    useEffect(() => {
        _registerNotifPush(push);
    }, [push]);

    // Close on outside click
    useEffect(() => {
        if (!open) return;
        const handler = (e: MouseEvent) => {
            if (
                panelRef.current && !panelRef.current.contains(e.target as Node) &&
                btnRef.current   && !btnRef.current.contains(e.target as Node)
            ) {
                setOpen(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [open]);

    // Close on Escape
    useEffect(() => {
        if (!open) return;
        const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
        document.addEventListener('keydown', handler);
        return () => document.removeEventListener('keydown', handler);
    }, [open]);

    const filtered = filter === 'all'
        ? notifications
        : notifications.filter(n => n.type === filter);

    const unreadLabel = unreadCount > 9 ? '9+' : String(unreadCount);

    const FILTER_TABS: Array<{ key: NotifType | 'all'; label: string }> = [
        { key: 'all',     label: 'Todas'     },
        { key: 'message', label: 'Chat'      },
        { key: 'info',    label: 'Alertas'   },
        { key: 'success', label: 'Aprovados' },
        { key: 'error',   label: 'Erros'     },
    ];

    return (
        <div style={{ position: 'relative' }}>
            {/* ── Bell button ────────────────────────────────────────────── */}
            <button
                ref={btnRef}
                type="button"
                onClick={() => setOpen(v => !v)}
                aria-label={`Notificações${unreadCount > 0 ? ` (${unreadCount} não lidas)` : ''}`}
                style={{
                    position:    'relative',
                    width:        36,
                    height:       36,
                    display:      'flex',
                    alignItems:   'center',
                    justifyContent: 'center',
                    borderRadius: 12,
                    border:       '1px solid',
                    borderColor:  open ? 'rgba(96,165,250,0.4)' : 'rgba(255,255,255,0.1)',
                    background:   open ? 'rgba(59,130,246,0.08)' : 'rgba(255,255,255,0.05)',
                    cursor:       'pointer',
                    transition:   'all 0.15s',
                    color:        open ? '#60a5fa' : '#9ca3af',
                    flexShrink:   0,
                }}
                onMouseEnter={e => {
                    if (!open) {
                        (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(96,165,250,0.35)';
                        (e.currentTarget as HTMLButtonElement).style.color = '#93c5fd';
                    }
                }}
                onMouseLeave={e => {
                    if (!open) {
                        (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(255,255,255,0.1)';
                        (e.currentTarget as HTMLButtonElement).style.color = '#9ca3af';
                    }
                }}
            >
                <Bell
                    style={{
                        width:  16,
                        height: 16,
                        // Animate bell when there are unread notifications
                        animation: unreadCount > 0 ? 'sm-bell-ring 2.5s ease-in-out infinite' : 'none',
                    }}
                    strokeWidth={1.75}
                />

                {/* Unread badge */}
                <AnimatePresence>
                    {unreadCount > 0 && (
                        <motion.span
                            key="badge"
                            initial={{ scale: 0, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0, opacity: 0 }}
                            transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                            style={{
                                position:   'absolute',
                                top:         -5,
                                right:       -5,
                                minWidth:    17,
                                height:      17,
                                borderRadius: 9,
                                background:  '#ef4444',
                                border:      '2px solid',
                                // Adapt to light/dark header
                                fontSize:    10,
                                fontWeight:  700,
                                color:       '#fff',
                                display:     'flex',
                                alignItems:  'center',
                                justifyContent: 'center',
                                padding:     '0 3px',
                                lineHeight:  1,
                                pointerEvents: 'none',
                            }}
                        >
                            {unreadLabel}
                        </motion.span>
                    )}
                </AnimatePresence>
            </button>

            {/* ── Dropdown panel ─────────────────────────────────────────── */}
            <AnimatePresence>
                {open && (
                    <motion.div
                        ref={panelRef}
                        key="notif-panel"
                        initial={{ opacity: 0, y: -8, scale: 0.97 }}
                        animate={{ opacity: 1, y: 0,  scale: 1    }}
                        exit={{ opacity: 0,   y: -8, scale: 0.97 }}
                        transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                        style={{
                            position:     'absolute',
                            top:           'calc(100% + 10px)',
                            right:          0,
                            width:          380,
                            maxHeight:      500,
                            background:    '#0b0f14',
                            border:        '1px solid #1f2937',
                            borderRadius:   14,
                            boxShadow:     '0 20px 60px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.03)',
                            display:       'flex',
                            flexDirection: 'column',
                            overflow:      'hidden',
                            zIndex:         9999,
                        }}
                    >
                        {/* ── Header ──────────────────────────────────────── */}
                        <div style={{
                            display:        'flex',
                            alignItems:     'center',
                            justifyContent: 'space-between',
                            padding:        '14px 16px 12px',
                            borderBottom:   '1px solid #1a1f2e',
                            flexShrink:      0,
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <Bell style={{ width: 15, height: 15, color: '#60a5fa' }} strokeWidth={2} />
                                <span style={{ fontSize: 14, fontWeight: 700, color: '#f3f4f6' }}>
                                    Notificações
                                </span>
                                {unreadCount > 0 && (
                                    <span style={{
                                        padding:      '1px 7px',
                                        background:   '#1e3a5f',
                                        border:       '1px solid #2563eb44',
                                        borderRadius:  9,
                                        fontSize:      11,
                                        fontWeight:    700,
                                        color:         '#60a5fa',
                                    }}>
                                        {unreadCount} não lida{unreadCount !== 1 ? 's' : ''}
                                    </span>
                                )}
                            </div>

                            {/* Header actions */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                {unreadCount > 0 && (
                                    <button
                                        type="button"
                                        onClick={markAllRead}
                                        title="Marcar todas como lidas"
                                        style={{
                                            display:       'flex',
                                            alignItems:    'center',
                                            gap:            4,
                                            padding:       '4px 8px',
                                            background:    '#0f1f17',
                                            border:        '1px solid #22c55e22',
                                            borderRadius:   8,
                                            fontSize:       11,
                                            fontWeight:     600,
                                            color:         '#4ade80',
                                            cursor:         'pointer',
                                            transition:    'background 0.15s',
                                        }}
                                        onMouseEnter={e => (e.currentTarget.style.background = '#132813')}
                                        onMouseLeave={e => (e.currentTarget.style.background = '#0f1f17')}
                                    >
                                        <CheckCheck style={{ width: 11, height: 11 }} strokeWidth={2.5} />
                                        Ler todas
                                    </button>
                                )}
                                {notifications.length > 0 && (
                                    <button
                                        type="button"
                                        onClick={clearAll}
                                        title="Limpar todas"
                                        style={{
                                            display:       'flex',
                                            alignItems:    'center',
                                            gap:            4,
                                            padding:       '4px 8px',
                                            background:    '#1f1111',
                                            border:        '1px solid #ef444422',
                                            borderRadius:   8,
                                            fontSize:       11,
                                            fontWeight:     600,
                                            color:         '#f87171',
                                            cursor:         'pointer',
                                            transition:    'background 0.15s',
                                        }}
                                        onMouseEnter={e => (e.currentTarget.style.background = '#2a1212')}
                                        onMouseLeave={e => (e.currentTarget.style.background = '#1f1111')}
                                    >
                                        <Trash2 style={{ width: 11, height: 11 }} strokeWidth={2.5} />
                                        Limpar
                                    </button>
                                )}
                                <button
                                    type="button"
                                    onClick={() => setOpen(false)}
                                    style={{
                                        width: 26, height: 26,
                                        background: 'none',
                                        border: 'none',
                                        borderRadius: 6,
                                        cursor: 'pointer',
                                        color: '#374151',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        padding: 0,
                                    }}
                                    onMouseEnter={e => (e.currentTarget.style.color = '#9ca3af')}
                                    onMouseLeave={e => (e.currentTarget.style.color = '#374151')}
                                >
                                    <X style={{ width: 14, height: 14 }} strokeWidth={2.5} />
                                </button>
                            </div>
                        </div>

                        {/* ── Filter tabs ─────────────────────────────────── */}
                        {notifications.length > 0 && (
                            <div style={{
                                display:      'flex',
                                gap:           4,
                                padding:      '8px 12px',
                                borderBottom: '1px solid #1a1f2e',
                                overflowX:    'auto',
                                flexShrink:    0,
                                scrollbarWidth: 'none',
                            }}>
                                {FILTER_TABS.map(tab => {
                                    const count = tab.key === 'all'
                                        ? notifications.length
                                        : notifications.filter(n => n.type === tab.key).length;
                                    if (tab.key !== 'all' && count === 0) return null;
                                    const active = filter === tab.key;
                                    return (
                                        <button
                                            key={tab.key}
                                            type="button"
                                            onClick={() => setFilter(tab.key)}
                                            style={{
                                                padding:       '4px 10px',
                                                borderRadius:   8,
                                                border:        `1px solid ${active ? '#2563eb44' : '#1f2937'}`,
                                                background:     active ? '#1e3a5f' : 'transparent',
                                                fontSize:       11,
                                                fontWeight:     active ? 700 : 500,
                                                color:          active ? '#60a5fa' : '#4b5563',
                                                cursor:         'pointer',
                                                whiteSpace:    'nowrap',
                                                transition:    'all 0.15s',
                                                flexShrink:     0,
                                            }}
                                        >
                                            {tab.label}
                                            {count > 0 && (
                                                <span style={{
                                                    marginLeft:   5,
                                                    padding:     '1px 5px',
                                                    borderRadius: 6,
                                                    background:   active ? '#2563eb33' : '#1f2937',
                                                    fontSize:     10,
                                                    color:        active ? '#93c5fd' : '#374151',
                                                }}>
                                                    {count}
                                                </span>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        )}

                        {/* ── Notification list ────────────────────────────── */}
                        <div style={{
                            overflowY:  'auto',
                            flex:        1,
                            // Custom scrollbar (dark)
                        }}
                            className="notif-scroll"
                        >
                            {filtered.length === 0 ? (
                                <EmptyState />
                            ) : (
                                <AnimatePresence initial={false}>
                                    {filtered.map(notif => (
                                        <NotifRow
                                            key={notif.id}
                                            notif={notif}
                                            onRead={markRead}
                                            onRemove={remove}
                                        />
                                    ))}
                                </AnimatePresence>
                            )}
                        </div>

                        {/* ── Footer ──────────────────────────────────────── */}
                        {notifications.length > 0 && (
                            <div style={{
                                padding:     '10px 16px',
                                borderTop:   '1px solid #1a1f2e',
                                display:     'flex',
                                alignItems:  'center',
                                justifyContent: 'center',
                                flexShrink:   0,
                            }}>
                                <span style={{ fontSize: 11, color: '#374151' }}>
                                    {notifications.length} notificaç{notifications.length !== 1 ? 'ões' : 'ão'} · {unreadCount} não lida{unreadCount !== 1 ? 's' : ''}
                                </span>
                            </div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
