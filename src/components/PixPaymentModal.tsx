import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { QRCodeSVG } from 'qrcode.react';
import {
    X, QrCode, Copy, Check, RefreshCw,
    Clock, CheckCircle2, XCircle, Loader2,
    ExternalLink, ShieldCheck, AlertTriangle,
} from 'lucide-react';

// ── Props ──────────────────────────────────────────────────────────────────────
interface PixPaymentModalProps {
    open:              boolean;
    onClose:           () => void;
    onApproved:        (paymentId: string) => void;
    amount:            number;
    description:       string;
    payerEmail:        string;
    payerName?:        string;
    externalReference?: string;
}

// ── PIX QR Code renderer ───────────────────────────────────────────────────────
function QRImage({ base64, code }: { base64?: string | null; code?: string | null }) {
    if (base64) {
        return (
            <img
                src={`data:image/png;base64,${base64}`}
                alt="PIX QR Code"
                className="w-52 h-52 rounded-xl"
            />
        );
    }
    if (code) {
        return (
            <QRCodeSVG
                value={code}
                size={208}
                bgColor="#ffffff"
                fgColor="#18181b"
                level="M"
                className="rounded-xl"
            />
        );
    }
    return (
        <div className="w-52 h-52 bg-white rounded-xl flex items-center justify-center">
            <QrCode className="w-24 h-24 text-zinc-300" strokeWidth={1} />
        </div>
    );
}

// ── Countdown timer ────────────────────────────────────────────────────────────
function Countdown({ expiresAt }: { expiresAt: string | null }) {
    const [secs, setSecs] = useState<number | null>(null);

    useEffect(() => {
        if (!expiresAt) return;
        const tick = () => {
            const diff = Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000);
            setSecs(Math.max(0, diff));
        };
        tick();
        const id = setInterval(tick, 1000);
        return () => clearInterval(id);
    }, [expiresAt]);

    if (secs === null) return null;

    const mins  = Math.floor(secs / 60);
    const s     = secs % 60;
    const color = secs < 120 ? 'text-red-400' : secs < 300 ? 'text-yellow-400' : 'text-emerald-400';

    return (
        <div className={`flex items-center gap-1.5 text-xs font-mono font-bold ${color}`}>
            <Clock className="w-3.5 h-3.5" strokeWidth={1.5} />
            {String(mins).padStart(2, '0')}:{String(s).padStart(2, '0')}
        </div>
    );
}

// ── Format BRL ────────────────────────────────────────────────────────────────
const fmt = (p: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(p);

// ── Main component ─────────────────────────────────────────────────────────────
export default function PixPaymentModal({
    open, onClose, onApproved,
    amount, description, payerEmail, payerName = '', externalReference = '',
}: PixPaymentModalProps) {

    type Status = 'idle' | 'creating' | 'waiting' | 'approved' | 'expired' | 'error';

    const [status,       setStatus]       = useState<Status>('idle');
    const [paymentId,    setPaymentId]    = useState<string | null>(null);
    const [qrBase64,     setQrBase64]     = useState<string | null>(null);
    const [qrCode,       setQrCode]       = useState<string | null>(null);
    const [ticketUrl,    setTicketUrl]    = useState<string | null>(null);
    const [expiresAt,    setExpiresAt]    = useState<string | null>(null);
    const [copied,       setCopied]       = useState(false);
    const [errorMsg,     setErrorMsg]     = useState('');

    const pollRef  = useRef<ReturnType<typeof setInterval> | null>(null);
    const createdRef = useRef(false);

    // ── Cleanup on unmount ────────────────────────────────────────────────────
    useEffect(() => {
        return () => {
            if (pollRef.current) clearInterval(pollRef.current);
        };
    }, []);

    // ── Auto-create PIX when modal opens ─────────────────────────────────────
    useEffect(() => {
        if (!open) return;
        if (createdRef.current) return; // prevent double-call in React 18 Strict Mode
        createdRef.current = true;
        createPix();

        return () => {
            // cleanup on close
            if (pollRef.current) clearInterval(pollRef.current);
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    // ── Reset when closed ─────────────────────────────────────────────────────
    useEffect(() => {
        if (!open) {
            if (pollRef.current) clearInterval(pollRef.current);
            createdRef.current = false;
            setStatus('idle');
            setPaymentId(null);
            setQrBase64(null);
            setQrCode(null);
            setTicketUrl(null);
            setExpiresAt(null);
            setCopied(false);
            setErrorMsg('');
        }
    }, [open]);

    // ── Create PIX payment via Express backend ────────────────────────────────
    const createPix = useCallback(async () => {
        setStatus('creating');
        setErrorMsg('');
        try {
            // In dev: Vite proxies /api → http://localhost:3001
            // In prod: VITE_PAYMENT_API_URL points to the real server
            const base = (import.meta.env.VITE_PAYMENT_API_URL as string) || '';
            const res = await fetch(`${base}/api/create-payment`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    transaction_amount: amount,
                    description,
                    payer_email:        payerEmail,
                    payer_name:         payerName,
                    payment_method_id:  'pix',
                    external_reference: externalReference
                        ? `${externalReference}:${Math.round(amount)}`
                        : String(Math.round(amount)),
                }),
            });

            const data = await res.json().catch(() => ({}));

            if (!res.ok || data?.error) {
                throw new Error(data?.error ?? `Erro ${res.status}`);
            }

            setPaymentId(data.payment_id);
            setQrBase64(data.qr_code_base64 ?? null);
            setQrCode(data.qr_code ?? null);
            setTicketUrl(data.ticket_url ?? null);
            setExpiresAt(data.pix_expiration ?? null);
            setStatus('waiting');

            // Start polling for status
            startPolling(data.payment_id);

        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Erro ao gerar PIX.';
            setErrorMsg(msg);
            setStatus('error');
        }
    }, [amount, description, payerEmail, payerName, externalReference]);

    // ── Poll payment status every 4s ──────────────────────────────────────────
    const startPolling = (mpPaymentId: string) => {
        if (pollRef.current) clearInterval(pollRef.current);

        pollRef.current = setInterval(async () => {
            try {
                const base = (import.meta.env.VITE_PAYMENT_API_URL as string) || '';
                const r    = await fetch(`${base}/api/payment-status/${mpPaymentId}`);
                const data = await r.json().catch(() => ({}));

                if (data.status === 'approved') {
                    clearInterval(pollRef.current!);
                    setStatus('approved');
                    setTimeout(() => onApproved(mpPaymentId), 1200);
                } else if (data.status === 'rejected' || data.status === 'cancelled') {
                    clearInterval(pollRef.current!);
                    setStatus('error');
                    setErrorMsg('Pagamento recusado ou cancelado.');
                }
            } catch {
                // Network blip — keep polling silently
            }
        }, 4000);
    };

    // ── Copy to clipboard ─────────────────────────────────────────────────────
    const copyPixCode = async () => {
        const text = qrCode ?? ticketUrl ?? '';
        if (!text) return;
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
    };

    // Don't render when closed
    if (!open) return null;

    const pixCodeToShow = qrCode ?? ticketUrl ?? null;

    return (
        <AnimatePresence>
            {open && (
                <motion.div
                    key="pix-modal-backdrop"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-[1000] flex items-end sm:items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
                    onClick={(e) => {
                        if (e.target === e.currentTarget && status !== 'creating') {
                            onClose();
                        }
                    }}
                >
                    <motion.div
                        key="pix-modal-panel"
                        initial={{ opacity: 0, y: 60, scale: 0.96 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 40, scale: 0.96 }}
                        transition={{ type: 'spring', stiffness: 320, damping: 30 }}
                        className="w-full max-w-sm bg-zinc-900 border border-white/10 rounded-3xl overflow-hidden shadow-2xl"
                    >

                        {/* ── Header ──────────────────────────────────────────── */}
                        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-white/8">
                            <div>
                                <h2 className="text-lg font-black text-white">Pagar com PIX</h2>
                                <p className="text-zinc-500 text-xs mt-0.5">
                                    {fmt(amount)}
                                    {expiresAt && status === 'waiting' && (
                                        <> · Expira em <Countdown expiresAt={expiresAt} /></>
                                    )}
                                </p>
                            </div>
                            {status !== 'creating' && (
                                <button
                                    onClick={onClose}
                                    aria-label="Fechar"
                                    className="w-8 h-8 flex items-center justify-center rounded-full bg-zinc-800 hover:bg-zinc-700 transition-colors"
                                >
                                    <X className="w-4 h-4 text-zinc-400" strokeWidth={1.5} />
                                </button>
                            )}
                        </div>

                        {/* ── CREATING ────────────────────────────────────────── */}
                        {status === 'creating' && (
                            <div className="flex flex-col items-center gap-4 py-12 px-6">
                                <div className="w-16 h-16 rounded-full border-2 border-emerald-400/20 border-t-emerald-400 animate-spin" />
                                <p className="text-white font-bold text-sm">Gerando QR Code PIX…</p>
                                <p className="text-zinc-500 text-xs text-center">Conectando ao Mercado Pago</p>
                            </div>
                        )}

                        {/* ── WAITING (QR shown) ────────────────────────────── */}
                        {status === 'waiting' && (
                            <div className="flex flex-col items-center gap-5 px-6 py-6">
                                {/* Status badge */}
                                <div className="flex items-center gap-2 px-3 py-1.5 bg-yellow-500/15 border border-yellow-500/30 rounded-full">
                                    <RefreshCw className="w-3.5 h-3.5 text-yellow-400 animate-spin" strokeWidth={1.5} />
                                    <span className="text-xs text-yellow-400 font-bold">Aguardando pagamento…</span>
                                </div>

                                {/* QR Code */}
                                <div className="bg-white p-3 rounded-2xl shadow-lg">
                                    <QRImage base64={qrBase64} code={qrCode} />
                                </div>

                                {/* Instructions */}
                                <ol className="text-xs text-zinc-400 space-y-1 self-start w-full list-decimal list-inside">
                                    <li>Abra o app do seu banco</li>
                                    <li>Escolha pagar com PIX → <strong className="text-white">QR Code</strong></li>
                                    <li>Escaneie o código acima</li>
                                    <li>Confirme o pagamento de <strong className="text-brand-400">{fmt(amount)}</strong></li>
                                </ol>

                                {/* Copia e cola */}
                                {pixCodeToShow && (
                                    <div className="w-full space-y-2">
                                        <p className="text-xs text-zinc-500 font-medium text-center">PIX copia e cola:</p>
                                        <div className="flex gap-2 items-stretch">
                                            <div className="flex-1 min-w-0 bg-zinc-800 border border-white/8 rounded-xl px-3 py-2.5">
                                                <p className="text-zinc-300 text-[11px] font-mono break-all leading-relaxed line-clamp-3">
                                                    {pixCodeToShow}
                                                </p>
                                            </div>
                                            <button
                                                onClick={copyPixCode}
                                                aria-label="Copiar código PIX"
                                                className={`flex-shrink-0 flex flex-col items-center justify-center gap-1 px-3 rounded-xl text-[11px] font-bold transition-all border
                                                    ${copied
                                                        ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
                                                        : 'bg-zinc-800 border-white/10 text-zinc-300 hover:text-white hover:border-brand-400/40'
                                                    }`}
                                            >
                                                {copied
                                                    ? <><Check className="w-4 h-4" strokeWidth={1.5} /><span>Copiado</span></>
                                                    : <><Copy className="w-4 h-4" strokeWidth={1.5} /><span>Copiar</span></>
                                                }
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {/* Open in MP app */}
                                {ticketUrl && (
                                    <a
                                        href={ticketUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="w-full flex items-center justify-center gap-2 py-3 bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-bold rounded-xl hover:bg-emerald-500/25 transition-all text-sm"
                                    >
                                        <ExternalLink className="w-4 h-4" strokeWidth={1.5} />
                                        Abrir no app Mercado Pago
                                    </a>
                                )}

                                <p className="text-zinc-600 text-xs text-center">
                                    Esta tela atualiza automaticamente. Não feche o modal.
                                </p>

                                {/* Security badge */}
                                <div className="flex items-center gap-1.5 text-zinc-600">
                                    <ShieldCheck className="w-3.5 h-3.5" strokeWidth={1.5} />
                                    <span className="text-[11px]">Pagamento seguro · Mercado Pago</span>
                                </div>
                            </div>
                        )}

                        {/* ── APPROVED ────────────────────────────────────────── */}
                        {status === 'approved' && (
                            <div className="flex flex-col items-center gap-4 px-6 py-8 text-center">
                                <motion.div
                                    initial={{ scale: 0.5, opacity: 0 }}
                                    animate={{ scale: 1, opacity: 1 }}
                                    transition={{ type: 'spring', stiffness: 300, damping: 18 }}
                                    className="w-20 h-20 bg-emerald-500/15 border border-emerald-500/30 rounded-3xl flex items-center justify-center"
                                >
                                    <CheckCircle2 className="w-10 h-10 text-emerald-400" strokeWidth={1.5} />
                                </motion.div>
                                <h3 className="text-2xl font-black text-white">Pagamento confirmado!</h3>
                                <p className="text-zinc-400 text-sm">
                                    Seu pagamento PIX foi aprovado. O boost será ativado automaticamente.
                                </p>
                                <div className="flex items-center gap-2 px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-full">
                                    <Loader2 className="w-3.5 h-3.5 text-emerald-400 animate-spin" strokeWidth={1.5} />
                                    <span className="text-emerald-400 text-xs font-bold">Ativando boost…</span>
                                </div>
                            </div>
                        )}

                        {/* ── ERROR ────────────────────────────────────────────── */}
                        {status === 'error' && (
                            <div className="flex flex-col items-center gap-4 px-6 py-8 text-center">
                                <div className="w-16 h-16 bg-red-500/15 border border-red-500/30 rounded-2xl flex items-center justify-center">
                                    <XCircle className="w-8 h-8 text-red-400" strokeWidth={1.5} />
                                </div>
                                <h3 className="text-xl font-black text-white">Erro ao gerar PIX</h3>
                                {errorMsg && (
                                    <div className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-400/30 rounded-xl w-full text-left">
                                        <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" strokeWidth={1.5} />
                                        <p className="text-red-400 text-xs">{errorMsg}</p>
                                    </div>
                                )}
                                <button
                                    onClick={() => {
                                        createdRef.current = false;
                                        createPix();
                                    }}
                                    className="w-full flex items-center justify-center gap-2 py-3 bg-zinc-800 hover:bg-zinc-700 border border-white/8 text-white font-bold rounded-xl transition-all text-sm"
                                >
                                    <RefreshCw className="w-4 h-4" strokeWidth={1.5} />
                                    Tentar novamente
                                </button>
                                <button
                                    onClick={onClose}
                                    className="text-zinc-500 hover:text-zinc-300 text-sm transition-colors"
                                >
                                    Cancelar
                                </button>
                            </div>
                        )}

                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
