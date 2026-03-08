import { useState, useCallback } from 'react'
import Cropper from 'react-easy-crop'
import { X, Check, Crop } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import getCroppedImg from '../utils/imageUtils'

interface CropModalProps {
    image: string
    onCropComplete: (croppedImage: Blob) => void
    onSkip?: () => void           // upload original as-is
    onCancel: () => void
    aspectRatio?: number          // undefined = free-form
    cropShape?: 'rect' | 'round'
    title?: string
}

export default function CropModal({
    image,
    onCropComplete,
    onSkip,
    onCancel,
    aspectRatio,
    cropShape = 'rect',
    title = 'Adicionar Foto',
}: CropModalProps) {
    const [cropMode, setCropMode] = useState(false)   // false = preview original
    const [crop, setCrop] = useState({ x: 0, y: 0 })
    const [zoom, setZoom] = useState(1)
    const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null)

    const onCropAreaComplete = useCallback((_: any, cap: any) => {
        setCroppedAreaPixels(cap)
    }, [])

    const handleConfirmCrop = async () => {
        try {
            const blob = await getCroppedImg(image, croppedAreaPixels)
            if (blob) onCropComplete(blob)
        } catch (e) {
            console.error(e)
        }
    }

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
            {/* Backdrop */}
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm"
                onClick={onCancel}
            />

            <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="relative bg-white dark:bg-zinc-900 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col"
            >
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-white/10">
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">{title}</h3>
                    <button
                        onClick={onCancel}
                        className="p-2 hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg text-slate-400 transition-colors"
                    >
                        <X className="w-5 h-5" strokeWidth={1.5} />
                    </button>
                </div>

                {/* Image area – switches between plain preview and cropper */}
                <div className="relative h-[360px] w-full bg-slate-100 dark:bg-zinc-800 overflow-hidden">
                    <AnimatePresence mode="wait">
                        {cropMode ? (
                            /* ── Crop mode ── */
                            <motion.div
                                key="cropper"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.15 }}
                                className="absolute inset-0"
                            >
                                <Cropper
                                    image={image}
                                    crop={crop}
                                    zoom={zoom}
                                    aspect={aspectRatio}
                                    cropShape={cropShape}
                                    showGrid={false}
                                    onCropChange={setCrop}
                                    onCropComplete={onCropAreaComplete}
                                    onZoomChange={setZoom}
                                />
                            </motion.div>
                        ) : (
                            /* ── Preview mode: show full original ── */
                            <motion.div
                                key="preview"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.15 }}
                                className="absolute inset-0 flex items-center justify-center"
                            >
                                <img
                                    src={image}
                                    alt="Preview"
                                    className="w-full h-full object-contain"
                                />
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* Controls */}
                <div className="p-5 space-y-4 bg-white dark:bg-zinc-900">

                    {/* Zoom slider – only visible in crop mode */}
                    <AnimatePresence>
                        {cropMode && (
                            <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                transition={{ duration: 0.2 }}
                                className="space-y-1.5 overflow-hidden"
                            >
                                <div className="flex justify-between text-xs font-medium text-slate-500 dark:text-zinc-400">
                                    <span>Zoom</span>
                                    <span>{Math.round(zoom * 100)}%</span>
                                </div>
                                <input
                                    type="range"
                                    value={zoom}
                                    min={1}
                                    max={3}
                                    step={0.05}
                                    onChange={(e) => setZoom(Number(e.target.value))}
                                    className="w-full h-1.5 rounded-full appearance-none cursor-pointer accent-brand-500 bg-slate-200 dark:bg-zinc-700"
                                />
                                <p className="text-[11px] text-slate-400 dark:text-zinc-500 text-center pt-0.5">
                                    Arraste para reposicionar · Role ou ajuste o slider para zoom
                                </p>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Buttons */}
                    <div className="flex gap-2">
                        {/* Always: Cancel */}
                        <button
                            onClick={onCancel}
                            className="px-4 py-2.5 bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 text-sm font-semibold rounded-xl hover:bg-slate-200 dark:hover:bg-zinc-700 transition-colors"
                        >
                            Cancelar
                        </button>

                        {cropMode ? (
                            <>
                                {/* Back to preview */}
                                <button
                                    onClick={() => setCropMode(false)}
                                    className="px-4 py-2.5 bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 text-sm font-semibold rounded-xl hover:bg-slate-200 dark:hover:bg-zinc-700 transition-colors"
                                >
                                    Voltar
                                </button>

                                {/* Confirm crop – primary */}
                                <button
                                    onClick={handleConfirmCrop}
                                    className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-brand-500 hover:bg-brand-400 text-white text-sm font-bold rounded-xl transition-all shadow-sm"
                                >
                                    <Check className="w-4 h-4" strokeWidth={1.5} />
                                    Confirmar recorte
                                </button>
                            </>
                        ) : (
                            <>
                                {/* Enter crop mode */}
                                <button
                                    onClick={() => setCropMode(true)}
                                    className="flex items-center gap-1.5 px-4 py-2.5 bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 text-sm font-semibold rounded-xl hover:bg-slate-200 dark:hover:bg-zinc-700 transition-colors border border-slate-200 dark:border-white/10"
                                >
                                    <Crop className="w-4 h-4" strokeWidth={1.5} />
                                    Recortar
                                </button>

                                {/* Use original – primary */}
                                {onSkip && (
                                    <button
                                        onClick={onSkip}
                                        className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-brand-500 hover:bg-brand-400 text-white text-sm font-bold rounded-xl transition-all shadow-sm"
                                    >
                                        <Check className="w-4 h-4" strokeWidth={1.5} />
                                        Usar foto
                                    </button>
                                )}
                            </>
                        )}
                    </div>
                </div>
            </motion.div>
        </div>
    )
}
