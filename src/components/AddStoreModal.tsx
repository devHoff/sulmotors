import { motion, AnimatePresence } from 'framer-motion';
import { X, Mail, Store } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

interface AddStoreModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const EMAIL_ADDRESS = 'bandasleonardo@gmail.com';

export default function AddStoreModal({ isOpen, onClose }: AddStoreModalProps) {
    const { t } = useLanguage();

    const handleEmail = () => {
        window.location.href = `mailto:${EMAIL_ADDRESS}?subject=Quero adicionar minha loja na SulMotor`;
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
                                        <Store className="w-6 h-6 text-brand-500 dark:text-brand-400" strokeWidth={1.5} />
                                    </div>
                                    <button
                                        onClick={onClose}
                                        className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 dark:text-zinc-500 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 transition-all"
                                    >
                                        <X className="w-4 h-4" strokeWidth={1.5} />
                                    </button>
                                </div>

                                <h2 className="text-xl font-black text-slate-900 dark:text-white mb-3">
                                    {t('stores_add_title')}
                                </h2>
                                <p className="text-sm text-slate-500 dark:text-zinc-400 leading-relaxed mb-7">
                                    {t('stores_add_body')}
                                </p>

                                {/* Contact info */}
                                <div className="flex items-center gap-2 mb-5 px-4 py-3 bg-brand-400/8 border border-brand-400/20 rounded-xl">
                                    <Mail className="w-4 h-4 text-brand-500 dark:text-brand-400 flex-shrink-0" strokeWidth={1.5} />
                                    <span className="text-sm text-brand-600 dark:text-brand-400 font-bold">{EMAIL_ADDRESS}</span>
                                </div>

                                {/* CTA buttons */}
                                <div className="flex flex-col sm:flex-row gap-3">
                                    <button
                                        onClick={handleEmail}
                                        className="flex-1 flex items-center justify-center gap-2.5 py-3.5 bg-brand-400 hover:bg-brand-300 text-zinc-950 font-bold rounded-xl transition-all hover:shadow-lg hover:shadow-brand-400/25"
                                    >
                                        <Mail className="w-5 h-5" strokeWidth={1.5} />
                                        {t('stores_contact')}
                                    </button>
                                </div>

                                {/* Close link */}
                                <button
                                    onClick={onClose}
                                    className="w-full mt-4 text-center text-sm text-slate-400 dark:text-zinc-600 hover:text-slate-600 dark:hover:text-zinc-400 transition-colors"
                                >
                                    {t('stores_close')}
                                </button>
                            </div>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
