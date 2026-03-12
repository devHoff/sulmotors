/**
 * TrustBadge — SulMotor verified-seller badge component.
 *
 * Usage:
 *   <TrustBadge size="sm" />     — small inline badge (e.g. in CarCard)
 *   <TrustBadge size="md" />     — medium (default, used in listings)
 *   <TrustBadge size="lg" />     — large (profile header)
 */

import { BadgeCheck } from 'lucide-react';
import { motion } from 'framer-motion';

interface TrustBadgeProps {
    size?: 'xs' | 'sm' | 'md' | 'lg';
    showLabel?: boolean;
    className?: string;
}

const sizeMap = {
    xs: { icon: 'w-3 h-3', text: 'text-[10px]', gap: 'gap-0.5' },
    sm: { icon: 'w-3.5 h-3.5', text: 'text-xs', gap: 'gap-1' },
    md: { icon: 'w-4 h-4', text: 'text-sm', gap: 'gap-1.5' },
    lg: { icon: 'w-5 h-5', text: 'text-base', gap: 'gap-2' },
};

export default function TrustBadge({
    size = 'md',
    showLabel = true,
    className = '',
}: TrustBadgeProps) {
    const s = sizeMap[size];

    return (
        <motion.span
            initial={{ scale: 0.85, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            title="Conta verificada pelo SulMotor"
            className={`inline-flex items-center ${s.gap} px-2 py-0.5 bg-emerald-500/15 border border-emerald-500/30 rounded-full ${className}`}
        >
            <BadgeCheck className={`${s.icon} text-emerald-500 flex-shrink-0`} strokeWidth={2} />
            {showLabel && (
                <span className={`${s.text} font-bold text-emerald-600 dark:text-emerald-400 leading-none`}>
                    Verificado
                </span>
            )}
        </motion.span>
    );
}
