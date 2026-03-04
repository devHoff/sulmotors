import { useState } from 'react';
import { X, Sparkles, ImagePlus, Loader2, Check, AlertCircle, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { recreateProfessionalPhoto } from '../lib/aiService';

interface AIPhotoModalProps {
    isOpen: boolean;
    onClose: () => void;
    imageUrl: string;
    carBrand?: string;
}

export default function AIPhotoModal({ isOpen, onClose, imageUrl, carBrand }: AIPhotoModalProps) {
    const [generating, setGenerating] = useState(false);
    const [generatedUrl, setGeneratedUrl] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const handleGenerate = async () => {
        setGenerating(true);
        setError(null);

        try {
            const geminiKey = import.meta.env.VITE_GEMINI_API_KEY;
            if (!geminiKey) {
                throw new Error("Chave da API do Google Gemini (VITE_GEMINI_API_KEY) não encontrada no .env");
            }

            const resultUrl = await recreateProfessionalPhoto(imageUrl, carBrand, geminiKey);
            setGeneratedUrl(resultUrl);
        } catch (err: any) {
            console.error(err);
            setError(err.message || "Falha ao processar imagem.");
        } finally {
            setGenerating(false);
        }
    };

    const handleClose = () => {
        setGeneratedUrl(null);
        setGenerating(false);
        setError(null);
        onClose();
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
                    onClick={handleClose}
                >
                    <motion.div
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.9, opacity: 0 }}
                        onClick={(e) => e.stopPropagation()}
                        className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden"
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
                            <div className="flex items-center gap-2">
                                <Sparkles className="w-5 h-5 text-brand-600" />
                                <h3 className="font-bold text-slate-900">IA — Fotografia Profissional</h3>
                            </div>
                            <button
                                onClick={handleClose}
                                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                            >
                                <X className="w-5 h-5 text-slate-400" />
                            </button>
                        </div>

                        {/* Image preview */}
                        <div className="p-6">
                            <div className="rounded-xl overflow-hidden mb-6 relative group bg-slate-100 min-h-[14rem] flex items-center justify-center">
                                <img
                                    src={generatedUrl || imageUrl}
                                    alt="Preview"
                                    className={`w-full h-56 object-cover transition-all duration-700 ${generatedUrl ? 'contrast-125 brightness-110' : ''}`}
                                />

                                {generatedUrl && (
                                    <div className="absolute top-2 right-2 bg-emerald-500 text-white text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1 shadow-lg">
                                        <Check className="w-3 h-3" />
                                        Recriado (Grátis)
                                    </div>
                                )}
                            </div>

                            {/* Info Card */}
                            {!generatedUrl && (
                                <div className="p-4 bg-brand-50 border border-brand-100 rounded-xl mb-6">
                                    <div className="flex items-center gap-2 mb-2">
                                        <Zap className="w-4 h-4 text-brand-600" />
                                        <p className="text-sm font-bold text-slate-900">Modo de Recriação</p>
                                    </div>
                                    <p className="text-xs text-slate-600 leading-relaxed">
                                        A IA analisa sua foto e gera uma versão "perfeita" do carro em um showroom profissional.
                                        Isso corrige ângulos ruins e garante uma apresentação impecável.
                                    </p>
                                </div>
                            )}

                            {/* Error Message */}
                            {error && (
                                <div className="mb-4 p-3 bg-red-50 text-red-700 text-sm rounded-lg flex items-start gap-2">
                                    <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                                    <div>{error}</div>
                                </div>
                            )}

                            {/* Generate Button */}
                            <button
                                onClick={handleGenerate}
                                disabled={generating}
                                className={`w-full flex items-center justify-center gap-3 px-5 py-4 text-white rounded-xl transition-all group disabled:opacity-70 ${generatedUrl ? 'bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-200' : 'bg-gradient-to-r from-brand-600 to-blue-500 hover:from-brand-700 hover:to-blue-600'}`}
                            >
                                {generating ? (
                                    <>
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                        <span className="font-semibold text-sm">Processando com IA...</span>
                                    </>
                                ) : generatedUrl ? (
                                    <>
                                        <Check className="w-5 h-5" />
                                        <div className="text-left">
                                            <div className="font-semibold text-sm">Pronto! Salvar Imagem</div>
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <ImagePlus className="w-5 h-5 group-hover:scale-110 transition-transform" />
                                        <div className="text-left">
                                            <div className="font-semibold text-sm">Gerar Foto Profissional</div>
                                            <div className="text-xs text-white/70">
                                                Reconhecimento visual + Novo Ângulo
                                            </div>
                                        </div>
                                    </>
                                )}
                            </button>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
