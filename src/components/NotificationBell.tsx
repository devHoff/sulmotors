/**
 * NotificationBell — Navbar bell icon with unread badge + history dropdown.
 *
 * Layout spec (from design requirements):
 *  Panel:        padding 16px, width 380px, max-height 500px
 *  Card:         padding 12px 14px, border-radius 10px, gap 10px between cards
 *  Card layout:  flex row — icon (32px circle) | text column | action buttons
 *  Header:       padding 14px 16px, border-bottom
 *  Filter tabs:  padding 8px 16px, border-bottom
 *  List:         padding 16px, gap 10px, overflow-y scroll
 *  Footer:       padding 10px 16px, border-top
 *
 * Color palette (dark):
 *  Panel bg:     #0b0f14
 *  Card bg:      type-specific dark tint
 *  Borders:      #1f2937
 *  Primary text: #f3f4f6
 *  Secondary:    #9ca3af
 *
 * i18n: ALL UI strings via useLanguage() t() helper.
 * Responsive: panel collapses to full-width on ≤480px via .sm-notif-panel CSS class.
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
import {
    useNotifications,
    _registerNotifPush,
    type Notification,
    type NotifType,
} from '../contexts/NotificationContext';
import { useLanguage } from '../contexts/LanguageContext';
import { Link } from 'react-router-dom';

// ── Design tokens ─────────────────────────────────────────────────────────────

const PANEL_W    = 380;
const PANEL_MAXH = 500;

const PANEL_BG     = '#0b0f14';
const BORDER_COLOR = '#1f2937';
const INNER_BORDER = '#151b27';
const TEXT_PRIMARY = '#f3f4f6';
const TEXT_MUTED   = '#9ca3af';
const TEXT_DIM     = '#4b5563';
const TEXT_FAINT   = '#374151';

// ── Type config ───────────────────────────────────────────────────────────────

interface TypeCfg {
    icon:        React.ElementType;
    iconColor:   string;
    accentColor: string;
    bgColor:     string;
}

const TYPE_CFG: Record<NotifType, TypeCfg> = {
    success: {
        icon:        CheckCircle2,
        iconColor:   '#4ade80',
        accentColor: '#22c55e',
        bgColor:     '#0a1a10',
    },
    error: {
        icon:        XCircle,
        iconColor:   '#f87171',
        accentColor: '#ef4444',
        bgColor:     '#180a0a',
    },
    warning: {
        icon:        AlertTriangle,
        iconColor:   '#fbbf24',
        accentColor: '#f59e0b',
        bgColor:     '#1a140a',
    },
    info: {
        icon:        Info,
        iconColor:   '#60a5fa',
        accentColor: '#3b82f6',
        bgColor:     '#0a1020',
    },
    message: {
        icon:        MessageSquare,
        iconColor:   '#a78bfa',
        accentColor: '#8b5cf6',
        bgColor:     '#100a1a',
    },
};

// ── Relative time helper (i18n-aware) ─────────────────────────────────────────

function useRelativeTime() {
    const { t, language } = useLanguage();
    return useCallback((ts: number): string => {
        const diff = Date.now() - ts;
        const s = Math.floor(diff / 1000);
        if (s < 60) return t('notif_time_now');
        const m = Math.floor(s / 60);
        if (m < 60) return `${m}min`;
        const h = Math.floor(m / 60);
        if (h < 24) return `${h}h`;
        const d = Math.floor(h / 24);
        if (d < 7) return `${d}d`;
        return new Date(ts).toLocaleDateString(
            language === 'en' ? 'en-US' : 'pt-BR',
            { day: '2-digit', month: 'short' }
        );
    }, [t, language]);
}

// ── Notification card (spec-compliant) ────────────────────────────────────────

function NotifCard({
    notif,
    onRead,
    onRemove,
    relTime,
}: {
    notif:    Notification;
    onRead:   (id: string) => void;
    onRemove: (id: string) => void;
    relTime:  (ts: number) => string;
}) {
    const { t } = useLanguage();
    const cfg    = TYPE_CFG[notif.type];
    const Icon   = cfg.icon;
    const isRead = notif.isRead;

    return (
        <motion.div
            layout
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 14, transition: { duration: 0.15 } }}
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            onClick={() => { if (!isRead) onRead(notif.id); }}
            style={{
                /* Card spec: padding 12px 14px, border-radius 10px */
                padding:         '12px 14px',
                borderRadius:    10,
                background:      isRead ? 'transparent' : cfg.bgColor,
                border:         `1px solid ${isRead ? INNER_BORDER : cfg.accentColor + '33'}`,
                borderLeft:     `3px solid ${isRead ? BORDER_COLOR : cfg.accentColor}`,
                cursor:          notif.href ? 'pointer' : isRead ? 'default' : 'pointer',
                transition:     'background 0.2s, border-color 0.2s',
                /* Flex layout: icon | text column | actions */
                display:        'flex',
                alignItems:     'flex-start',
                gap:             10,
            }}
        >
            {/* ── Icon ─────────────────────────────────────── */}
            <div style={{
                flexShrink:     0,
                width:          32,
                height:         32,
                borderRadius:   '50%',
                background:    `${cfg.accentColor}1a`,
                border:        `1px solid ${cfg.accentColor}33`,
                display:       'flex',
                alignItems:    'center',
                justifyContent:'center',
                marginTop:      1,
            }}>
                <Icon style={{
                    width:  15,
                    height: 15,
                    color:  isRead ? TEXT_FAINT : cfg.iconColor,
                }} strokeWidth={2} />
            </div>

            {/* ── Text column ──────────────────────────────── */}
            <div style={{ flex: 1, minWidth: 0 }}>
                {/* Title */}
                {notif.href ? (
                    <Link to={notif.href} onClick={e => e.stopPropagation()} style={{ textDecoration: 'none' }}>
                        <p style={{
                            fontSize:      14,
                            fontWeight:    isRead ? 400 : 600,
                            color:         isRead ? TEXT_DIM : TEXT_PRIMARY,
                            lineHeight:    1.35,
                            marginBottom:  notif.description ? 3 : 0,
                            letterSpacing: '-0.01em',
                        }}>
                            {notif.title}
                        </p>
                    </Link>
                ) : (
                    <p style={{
                        fontSize:      14,
                        fontWeight:    isRead ? 400 : 600,
                        color:         isRead ? TEXT_DIM : TEXT_PRIMARY,
                        lineHeight:    1.35,
                        marginBottom:  notif.description ? 3 : 0,
                        letterSpacing: '-0.01em',
                    }}>
                        {notif.title}
                    </p>
                )}

                {/* Description */}
                {notif.description && (
                    <p style={{
                        fontSize:     13,
                        color:        isRead ? TEXT_FAINT : TEXT_MUTED,
                        lineHeight:   1.4,
                        marginBottom: 5,
                        overflow:     'hidden',
                        display:      '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical' as const,
                    }}>
                        {notif.description}
                    </p>
                )}

                {/* Timestamp row */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Clock style={{ width: 10, height: 10, color: TEXT_FAINT, flexShrink: 0 }} strokeWidth={2} />
                    <span style={{ fontSize: 11, color: TEXT_FAINT }}>
                        {relTime(notif.timestamp)}
                    </span>
                    {/* Unread dot */}
                    {!isRead && (
                        <span style={{
                            width:        5,
                            height:       5,
                            borderRadius: '50%',
                            background:   cfg.accentColor,
                            marginLeft:   4,
                            flexShrink:   0,
                            display:      'inline-block',
                        }} />
                    )}
                </div>
            </div>

            {/* ── Action buttons ───────────────────────────── */}
            <div style={{
                flexShrink:    0,
                display:       'flex',
                flexDirection: 'column',
                alignItems:    'center',
                gap:            4,
                paddingTop:     1,
            }}>
                {!isRead && (
                    <ActionBtn
                        title={t('notif_mark_read')}
                        hoverColor="#4ade80"
                        onClick={e => { e.stopPropagation(); onRead(notif.id); }}
                    >
                        <Check style={{ width: 11, height: 11 }} strokeWidth={2.5} />
                    </ActionBtn>
                )}
                <ActionBtn
                    title={t('notif_remove')}
                    hoverColor="#f87171"
                    onClick={e => { e.stopPropagation(); onRemove(notif.id); }}
                >
                    <X style={{ width: 11, height: 11 }} strokeWidth={2.5} />
                </ActionBtn>
            </div>
        </motion.div>
    );
}

// ── Small reusable icon button ────────────────────────────────────────────────

function ActionBtn({
    title,
    hoverColor,
    onClick,
    children,
}: {
    title:      string;
    hoverColor: string;
    onClick:    (e: React.MouseEvent) => void;
    children:   React.ReactNode;
}) {
    return (
        <button
            type="button"
            title={title}
            onClick={onClick}
            style={{
                width:          22,
                height:         22,
                display:       'flex',
                alignItems:    'center',
                justifyContent:'center',
                background:    'transparent',
                border:        'none',
                borderRadius:   6,
                cursor:        'pointer',
                color:          TEXT_FAINT,
                padding:        0,
                transition:    'color 0.15s',
                flexShrink:     0,
            }}
            onMouseEnter={e => (e.currentTarget.style.color = hoverColor)}
            onMouseLeave={e => (e.currentTarget.style.color = TEXT_FAINT)}
        >
            {children}
        </button>
    );
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyState() {
    const { t } = useLanguage();
    return (
        <div style={{
            display:        'flex',
            flexDirection:  'column',
            alignItems:     'center',
            justifyContent: 'center',
            padding:        '48px 24px',
            gap:             14,
        }}>
            <div style={{
                width:          52,
                height:         52,
                borderRadius:   '50%',
                background:     '#111827',
                border:        `1px solid ${BORDER_COLOR}`,
                display:       'flex',
                alignItems:    'center',
                justifyContent:'center',
            }}>
                <BellOff style={{ width: 22, height: 22, color: TEXT_FAINT }} strokeWidth={1.5} />
            </div>
            <div style={{ textAlign: 'center' }}>
                <p style={{ fontSize: 14, fontWeight: 600, color: TEXT_DIM, marginBottom: 4 }}>
                    {t('notif_panel_empty_title')}
                </p>
                <p style={{ fontSize: 12, color: TEXT_FAINT, lineHeight: 1.5 }}>
                    {t('notif_panel_empty_sub')}
                </p>
            </div>
        </div>
    );
}

// ── Header action button ──────────────────────────────────────────────────────

function HeaderBtn({
    label,
    icon: Icon,
    iconColor,
    bgColor,
    borderColor,
    hoverBg,
    onClick,
}: {
    label:       string;
    icon:        React.ElementType;
    iconColor:   string;
    bgColor:     string;
    borderColor: string;
    hoverBg:     string;
    onClick:     () => void;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            style={{
                display:     'flex',
                alignItems:  'center',
                gap:          4,
                padding:     '5px 10px',
                background:   bgColor,
                border:      `1px solid ${borderColor}`,
                borderRadius: 8,
                fontSize:     11,
                fontWeight:   600,
                color:        iconColor,
                cursor:       'pointer',
                transition:  'background 0.15s',
                whiteSpace:  'nowrap',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = hoverBg)}
            onMouseLeave={e => (e.currentTarget.style.background = bgColor)}
        >
            <Icon style={{ width: 11, height: 11 }} strokeWidth={2.5} />
            {label}
        </button>
    );
}

// ── Filter Tab ────────────────────────────────────────────────────────────────

function FilterTab({
    active,
    onClick,
    children,
}: {
    active:   boolean;
    onClick:  () => void;
    children: React.ReactNode;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            style={{
                padding:      '5px 10px',
                fontSize:      12,
                fontWeight:    active ? 700 : 500,
                color:         active ? '#60a5fa' : TEXT_MUTED,
                background:    active ? 'rgba(59,130,246,0.08)' : 'transparent',
                border:       `1px solid ${active ? 'rgba(96,165,250,0.25)' : 'transparent'}`,
                borderRadius:  7,
                cursor:       'pointer',
                whiteSpace:   'nowrap',
                transition:   'all 0.12s',
                flexShrink:    0,
            }}
            onMouseEnter={e => {
                if (!active) e.currentTarget.style.color = '#93c5fd';
            }}
            onMouseLeave={e => {
                if (!active) e.currentTarget.style.color = TEXT_MUTED;
            }}
        >
            {children}
        </button>
    );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function NotificationBell() {
    const [open, setOpen] = useState(false);
    const [filter, setFilter] = useState<NotifType | 'all'>('all');
    const panelRef = useRef<HTMLDivElement>(null);
    const btnRef   = useRef<HTMLButtonElement>(null);
    const { t }    = useLanguage();
    const relTime  = useRelativeTime();

    const {
        notifications,
        unreadCount,
        push,
        markRead,
        markAllRead,
        remove,
        clearAll,
    } = useNotifications();

    // Register notification bridge
    useEffect(() => { _registerNotifPush(push); }, [push]);

    // Close on outside click
    const handleOutside = useCallback((e: MouseEvent) => {
        if (
            panelRef.current && !panelRef.current.contains(e.target as Node) &&
            btnRef.current   && !btnRef.current.contains(e.target as Node)
        ) setOpen(false);
    }, []);

    useEffect(() => {
        if (!open) return;
        document.addEventListener('mousedown', handleOutside);
        return () => document.removeEventListener('mousedown', handleOutside);
    }, [open, handleOutside]);

    // Close on Escape
    useEffect(() => {
        if (!open) return;
        const fn = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
        document.addEventListener('keydown', fn);
        return () => document.removeEventListener('keydown', fn);
    }, [open]);

    // Reset filter when closed
    useEffect(() => { if (!open) setFilter('all'); }, [open]);

    const filtered = filter === 'all'
        ? notifications
        : notifications.filter(n => n.type === filter);

    const unreadLabel = unreadCount > 9 ? '9+' : String(unreadCount);

    type FilterKey = NotifType | 'all';
    const TABS: Array<{ key: FilterKey; label: string }> = [
        { key: 'all',     label: t('notif_tab_all')      },
        { key: 'message', label: t('notif_tab_chat')     },
        { key: 'info',    label: t('notif_tab_alerts')   },
        { key: 'success', label: t('notif_tab_approved') },
        { key: 'error',   label: t('notif_tab_errors')   },
        { key: 'warning', label: t('notif_tab_warning')  },
    ];

    const unreadText = unreadCount === 1
        ? t('notif_panel_unread_one').replace('{n}', '1')
        : t('notif_panel_unread_many').replace('{n}', String(unreadCount));

    return (
        <div style={{ position: 'relative' }}>

            {/* ── Bell trigger button ────────────────────────────────── */}
            <button
                ref={btnRef}
                type="button"
                onClick={() => setOpen(v => !v)}
                aria-label={`${t('notif_bell_label')}${unreadCount > 0 ? ` (${unreadCount})` : ''}`}
                style={{
                    position:       'relative',
                    width:           36,
                    height:          36,
                    display:        'flex',
                    alignItems:     'center',
                    justifyContent: 'center',
                    borderRadius:    12,
                    border:         `1px solid ${open ? 'rgba(96,165,250,0.4)' : 'rgba(255,255,255,0.1)'}`,
                    background:      open ? 'rgba(59,130,246,0.08)' : 'rgba(255,255,255,0.05)',
                    cursor:         'pointer',
                    transition:     'all 0.15s',
                    color:           open ? '#60a5fa' : TEXT_MUTED,
                    flexShrink:      0,
                    outline:        'none',
                }}
                onMouseEnter={e => {
                    if (!open) {
                        e.currentTarget.style.borderColor = 'rgba(96,165,250,0.35)';
                        e.currentTarget.style.color = '#93c5fd';
                    }
                }}
                onMouseLeave={e => {
                    if (!open) {
                        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)';
                        e.currentTarget.style.color = TEXT_MUTED;
                    }
                }}
            >
                <Bell
                    style={{
                        width:  16,
                        height: 16,
                        animation: unreadCount > 0 ? 'sm-bell-ring 3s ease-in-out infinite' : 'none',
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
                                position:       'absolute',
                                top:            -5,
                                right:          -5,
                                minWidth:        17,
                                height:          17,
                                borderRadius:    9,
                                background:     '#ef4444',
                                border:         '2px solid #0b0f14',
                                fontSize:        10,
                                fontWeight:      700,
                                color:          '#fff',
                                display:        'flex',
                                alignItems:     'center',
                                justifyContent: 'center',
                                padding:        '0 3px',
                                lineHeight:      1,
                                pointerEvents:  'none',
                            }}
                        >
                            {unreadLabel}
                        </motion.span>
                    )}
                </AnimatePresence>
            </button>

            {/* ── Dropdown panel ────────────────────────────────────── */}
            <AnimatePresence>
                {open && (
                    <motion.div
                        ref={panelRef}
                        key="notif-panel"
                        className="sm-notif-panel"
                        initial={{ opacity: 0, y: -8, scale: 0.97 }}
                        animate={{ opacity: 1, y: 0,  scale: 1    }}
                        exit={{ opacity: 0,   y: -8, scale: 0.97 }}
                        transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                        style={{
                            position:      'absolute',
                            top:           'calc(100% + 10px)',
                            right:          0,
                            width:          PANEL_W,
                            maxHeight:      PANEL_MAXH,
                            background:     PANEL_BG,
                            border:        `1px solid ${BORDER_COLOR}`,
                            borderRadius:   14,
                            boxShadow:     '0 20px 60px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.03)',
                            display:       'flex',
                            flexDirection: 'column',
                            overflow:      'hidden',
                            zIndex:         9999,
                        }}
                    >
                        {/* ════ SECTION 1: Panel Header ════════════════════ */}
                        <div style={{
                            padding:        '14px 16px',
                            borderBottom:  `1px solid ${BORDER_COLOR}`,
                            display:       'flex',
                            alignItems:    'center',
                            justifyContent:'space-between',
                            flexShrink:     0,
                            gap:            8,
                        }}>
                            {/* Left: title + unread badge */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                                <Bell style={{ width: 15, height: 15, color: '#60a5fa', flexShrink: 0 }} strokeWidth={2} />
                                <span style={{
                                    fontSize:      14,
                                    fontWeight:    700,
                                    color:         TEXT_PRIMARY,
                                    letterSpacing: '-0.02em',
                                }}>
                                    {t('notif_panel_title')}
                                </span>
                                <AnimatePresence>
                                    {unreadCount > 0 && (
                                        <motion.span
                                            key="hdr-badge"
                                            initial={{ scale: 0.8, opacity: 0 }}
                                            animate={{ scale: 1,   opacity: 1 }}
                                            exit={{ scale: 0.8, opacity: 0 }}
                                            style={{
                                                padding:      '1px 8px',
                                                background:   '#1e3a5f',
                                                border:       '1px solid #2563eb44',
                                                borderRadius:  9,
                                                fontSize:      11,
                                                fontWeight:    700,
                                                color:        '#60a5fa',
                                                whiteSpace:   'nowrap',
                                            }}
                                        >
                                            {unreadText}
                                        </motion.span>
                                    )}
                                </AnimatePresence>
                            </div>

                            {/* Right: action buttons + close */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                                {unreadCount > 0 && (
                                    <HeaderBtn
                                        label={t('notif_panel_read_all')}
                                        icon={CheckCheck}
                                        iconColor="#4ade80"
                                        bgColor="#0a1a10"
                                        borderColor="#22c55e22"
                                        hoverBg="#0d2414"
                                        onClick={markAllRead}
                                    />
                                )}
                                {notifications.length > 0 && (
                                    <HeaderBtn
                                        label={t('notif_panel_clear')}
                                        icon={Trash2}
                                        iconColor="#f87171"
                                        bgColor="#180a0a"
                                        borderColor="#ef444422"
                                        hoverBg="#1f0d0d"
                                        onClick={clearAll}
                                    />
                                )}
                                <button
                                    type="button"
                                    onClick={() => setOpen(false)}
                                    title={t('common_close')}
                                    style={{
                                        width:          26,
                                        height:         26,
                                        display:       'flex',
                                        alignItems:    'center',
                                        justifyContent:'center',
                                        background:    'transparent',
                                        border:        'none',
                                        borderRadius:   6,
                                        cursor:        'pointer',
                                        color:          TEXT_FAINT,
                                        padding:        0,
                                        transition:    'color 0.12s',
                                    }}
                                    onMouseEnter={e => (e.currentTarget.style.color = TEXT_MUTED)}
                                    onMouseLeave={e => (e.currentTarget.style.color = TEXT_FAINT)}
                                >
                                    <X style={{ width: 14, height: 14 }} strokeWidth={2} />
                                </button>
                            </div>
                        </div>

                        {/* ════ SECTION 2: Filter Tabs ═════════════════════ */}
                        <div style={{
                            padding:        '8px 16px',
                            borderBottom:  `1px solid ${BORDER_COLOR}`,
                            display:       'flex',
                            alignItems:    'center',
                            gap:            4,
                            flexShrink:     0,
                            overflowX:     'auto',
                            scrollbarWidth:'none',
                        }}>
                            {TABS.map(tab => (
                                <FilterTab
                                    key={tab.key}
                                    active={filter === tab.key}
                                    onClick={() => setFilter(tab.key)}
                                >
                                    {tab.label}
                                </FilterTab>
                            ))}
                        </div>

                        {/* ════ SECTION 3: Notification List ══════════════ */}
                        <div
                            className="notif-scroll"
                            style={{
                                flex:       1,
                                overflowY: 'auto',
                                overflowX: 'hidden',
                                padding:   '16px',
                                display:   'flex',
                                flexDirection: 'column',
                                gap:        10,
                            }}
                        >
                            <AnimatePresence initial={false}>
                                {filtered.length === 0 ? (
                                    <EmptyState key="empty" />
                                ) : (
                                    filtered.map(notif => (
                                        <NotifCard
                                            key={notif.id}
                                            notif={notif}
                                            onRead={markRead}
                                            onRemove={remove}
                                            relTime={relTime}
                                        />
                                    ))
                                )}
                            </AnimatePresence>
                        </div>

                        {/* ════ SECTION 4: Footer ════════════════════════ */}
                        <div style={{
                            padding:      '10px 16px',
                            borderTop:   `1px solid ${BORDER_COLOR}`,
                            flexShrink:   0,
                            display:     'flex',
                            alignItems:  'center',
                            justifyContent: 'center',
                        }}>
                            <p style={{ fontSize: 11, color: TEXT_FAINT, textAlign: 'center' }}>
                                {notifications.length > 0
                                    ? `${notifications.length} ${notifications.length === 1 ? 'notificação' : 'notificações'} • ${unreadCount} ${unreadCount === 1 ? 'não lida' : 'não lidas'}`
                                    : t('notif_panel_empty_title')
                                }
                            </p>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
