import { motion, AnimatePresence } from 'framer-motion';
import { X, MessageCircle, Mail, Store } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

interface AddStoreModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const WHATSAPP_NUMBER = '5551999999999'; // Replace with real number
const EMAIL_ADDRESS = 'parceiros@sulmotors.com.br';

export default function AddStoreModal({ isOpen, onClose }: AddStoreModalProps) {
    const { t } = useLanguage();

    const handleWhatsApp = () => {
        const msg = encodeURIComponent('Olá! Gostaria de adicionar minha loja na SulMotors.');
        window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${msg}`, '_blank');
    };

    const handleEmail = () => {
        window.location.href = `mailto:${EMAIL_ADDRESS}?subject=Quero adicionar minha loja na SulMotors`;
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
                    />

                    {/* Modal */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.92, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.92, y: 20 }}
                        transition={{ type: 'spring', damping: 25, stiffness: 350 }}
                        className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
                    >
                        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/10 rounded-2xl shadow-2xl w-full max-w-md pointer-events-auto overflow-hidden">
                            {/* Header accent */}
                            <div className="h-1 bg-gradient-to-r from-brand-500 via-brand-400 to-brand-300" />

                            {/* Content */}
                            <div className="p-7">
                                {/* Close */}
                                <div className="flex items-start justify-between mb-5">
                                    <div className="w-12 h-12 bg-brand-400/10 border border-brand-400/20 rounded-xl flex items-center justify-center">
                                        <Store className="w-6 h-6 text-brand-500 dark:text-brand-400" />
                                    </div>
                                    <button
                                        onClick={onClose}
                                        className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 dark:text-zinc-500 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 transition-all"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>

                                <h2 className="text-xl font-black text-slate-900 dark:text-white mb-3">
                                    {t.stores_add_title}
                                </h2>
                                <p className="text-sm text-slate-500 dark:text-zinc-400 leading-relaxed mb-7">
                                    {t.stores_add_body}
                                </p>

                                {/* CTA buttons */}
                                <div className="flex flex-col sm:flex-row gap-3">
                                    <button
                                        onClick={handleWhatsApp}
                                        className="flex-1 flex items-center justify-center gap-2.5 py-3.5 bg-emerald-500 hover:bg-emerald-400 text-white font-bold rounded-xl transition-all hover:shadow-lg hover:shadow-emerald-500/25"
                                    >
                                        <MessageCircle className="w-5 h-5" />
                                        {t.stores_whatsapp}
                                    </button>
                                    <button
                                        onClick={handleEmail}
                                        className="flex-1 flex items-center justify-center gap-2.5 py-3.5 bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-white font-bold rounded-xl transition-all"
                                    >
                                        <Mail className="w-5 h-5" />
                                        {t.stores_email}
                                    </button>
                                </div>

                                {/* Close link */}
                                <button
                                    onClick={onClose}
                                    className="w-full mt-4 text-center text-sm text-slate-400 dark:text-zinc-600 hover:text-slate-600 dark:hover:text-zinc-400 transition-colors"
                                >
                                    {t.stores_close}
                                </button>
                            </div>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
