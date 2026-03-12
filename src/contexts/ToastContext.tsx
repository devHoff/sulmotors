/**
 * SulMotor Enterprise Toast System
 * ─────────────────────────────────────────────────────────────────────────────
 * Context-based toast engine — replaces Sonner entirely.
 *
 * Features:
 *  • 4 types: success | error | warning | info
 *  • Max 3 visible toasts; overflow groups automatically
 *  • Hover-pause auto-dismiss (3500ms default)
 *  • Optional subtle sound (Web Audio API synth tones)
 *  • Progress-bar per toast
 *  • Stack: newest on top, smooth reflow animations
 *  • Sound preference persisted in localStorage
 */

import {
    createContext,
    useContext,
    useState,
    useCallback,
    useRef,
    useEffect,
    type ReactNode,
} from 'react';

// ── Types ─────────────────────────────────────────────────────────────────────

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastItem {
    id: string;
    type: ToastType;
    title: string;
    description?: string;
    duration: number;       // ms
    sound?: boolean;        // trigger sound?
    createdAt: number;
}

interface ToastContextValue {
    toasts: ToastItem[];
    push: (opts: Omit<ToastItem, 'id' | 'createdAt'>) => string;
    dismiss: (id: string) => void;
    dismissAll: () => void;
    soundEnabled: boolean;
    setSoundEnabled: (v: boolean) => void;

    // Semantic helpers
    success: (title: string, description?: string, opts?: Partial<ToastItem>) => string;
    error:   (title: string, description?: string, opts?: Partial<ToastItem>) => string;
    warning: (title: string, description?: string, opts?: Partial<ToastItem>) => string;
    info:    (title: string, description?: string, opts?: Partial<ToastItem>) => string;
}

// ── Context ───────────────────────────────────────────────────────────────────

const ToastContext = createContext<ToastContextValue | null>(null);

const SOUND_PREF_KEY = 'sm_toast_sound';
const DEFAULT_DURATION = 3500;
let idCounter = 0;
const uid = () => `t-${Date.now()}-${++idCounter}`;

// ── Sound engine (Web Audio API) ──────────────────────────────────────────────

let audioCtx: AudioContext | null = null;

function getAudioCtx(): AudioContext {
    if (!audioCtx) audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    return audioCtx;
}

/**
 * Plays a subtle 2-note chime using OscillatorNode.
 * type='success' → ascending perfect fifth (C5→G5)
 * type='error'   → single low tone (A3)
 * type='warning' → single mid tone (E4)
 * type='info'    → single pure tone (C5)
 */
function playSoundForType(type: ToastType) {
    try {
        const ctx = getAudioCtx();
        const master = ctx.createGain();
        master.gain.setValueAtTime(0.06, ctx.currentTime); // very quiet
        master.connect(ctx.destination);

        const freqs: Record<ToastType, number[]> = {
            success: [523.25, 783.99], // C5 → G5
            error:   [220],            // A3
            warning: [329.63],         // E4
            info:    [523.25],         // C5
        };

        const notes = freqs[type];
        notes.forEach((freq, i) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.type = type === 'success' ? 'sine' : 'sine';
            osc.frequency.setValueAtTime(freq, ctx.currentTime);

            const start = ctx.currentTime + i * 0.12;
            const end   = start + 0.12;

            gain.gain.setValueAtTime(0, start);
            gain.gain.linearRampToValueAtTime(0.06, start + 0.02);
            gain.gain.linearRampToValueAtTime(0, end);

            osc.connect(gain);
            gain.connect(master);
            osc.start(start);
            osc.stop(end + 0.02);
        });
    } catch {
        // Web Audio unavailable — silently ignore
    }
}

// ── Provider ──────────────────────────────────────────────────────────────────

export function ToastProvider({ children }: { children: ReactNode }) {
    const [toasts, setToasts] = useState<ToastItem[]>([]);
    const [soundEnabled, setSoundEnabledState] = useState<boolean>(() => {
        try { return localStorage.getItem(SOUND_PREF_KEY) !== 'false'; }
        catch { return true; }
    });

    const setSoundEnabled = useCallback((v: boolean) => {
        setSoundEnabledState(v);
        try { localStorage.setItem(SOUND_PREF_KEY, String(v)); } catch {}
    }, []);

    const dismiss = useCallback((id: string) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    }, []);

    const dismissAll = useCallback(() => setToasts([]), []);

    const push = useCallback((opts: Omit<ToastItem, 'id' | 'createdAt'>): string => {
        const id = uid();
        const item: ToastItem = { ...opts, id, createdAt: Date.now() };
        setToasts(prev => [item, ...prev]); // newest first
        if (soundEnabled && opts.sound !== false &&
            (opts.type === 'success' || opts.type === 'error' || opts.sound === true)) {
            playSoundForType(opts.type);
        }
        return id;
    }, [soundEnabled]);

    // Convenience wrappers
    const success = useCallback((title: string, description?: string, opts?: Partial<ToastItem>) =>
        push({ type: 'success', title, description, duration: DEFAULT_DURATION, ...opts }),
    [push]);

    const error = useCallback((title: string, description?: string, opts?: Partial<ToastItem>) =>
        push({ type: 'error', title, description, duration: DEFAULT_DURATION, ...opts }),
    [push]);

    const warning = useCallback((title: string, description?: string, opts?: Partial<ToastItem>) =>
        push({ type: 'warning', title, description, duration: DEFAULT_DURATION + 500, ...opts }),
    [push]);

    const info = useCallback((title: string, description?: string, opts?: Partial<ToastItem>) =>
        push({ type: 'info', title, description, duration: DEFAULT_DURATION, ...opts }),
    [push]);

    const value: ToastContextValue = {
        toasts, push, dismiss, dismissAll,
        soundEnabled, setSoundEnabled,
        success, error, warning, info,
    };

    return (
        <ToastContext.Provider value={value}>
            {children}
        </ToastContext.Provider>
    );
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useToast(): ToastContextValue {
    const ctx = useContext(ToastContext);
    if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
    return ctx;
}

// ── Singleton bridge (for use outside React tree, e.g. utils/toast.ts) ───────

type PushFn = ToastContextValue['push'];
let _push: PushFn | null = null;

export function _registerPush(fn: PushFn) { _push = fn; }

export function toastBridge(opts: Omit<ToastItem, 'id' | 'createdAt'>): string {
    if (!_push) {
        // Fallback: log to console if called before provider mounts
        console.warn('[smToast] ToastProvider not yet mounted:', opts.title);
        return '';
    }
    return _push(opts);
}
