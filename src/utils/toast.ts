/**
 * SulMotors Enterprise Toast + Notification Utility
 * ─────────────────────────────────────────────────────────────────────────────
 * Semantic helper wrappers around the custom ToastContext bridge.
 * Replaces sonner's `toast.*` calls throughout the app.
 *
 * Usage:
 *   import { smToast } from '../utils/toast';
 *   smToast.profileSaved();
 *   smToast.listingCreated('Honda Civic 2022');
 *   smToast.newMessage('João Silva');
 *   smToast.favoriteAdded('Toyota Corolla');
 *   smToast.priceAlert('Fiat Argo', 45000);
 *
 * For legacy `toast.success / toast.error / toast.warning / toast.info` calls
 * that still exist in pages, we also export a `toast` compat shim.
 */

import { toastBridge } from '../contexts/ToastContext';
import { notifyBridge } from '../contexts/NotificationContext';

// ── Semantic helpers ──────────────────────────────────────────────────────────

export const smToast = {

    // ── Profile ───────────────────────────────────────────────────────────────
    profileSaved: () =>
        notifyBridge({ type: 'success', title: 'Perfil atualizado', description: 'Suas informações foram salvas com sucesso.' }),

    profileError: (msg?: string) =>
        notifyBridge({ type: 'error', title: 'Erro ao salvar perfil', description: msg ?? 'Verifique os campos e tente novamente.' }),

    profileIncomplete: () =>
        notifyBridge({ type: 'warning', title: 'Perfil incompleto', description: 'Complete seu perfil antes de publicar veículos.' }),

    // ── Listings ─────────────────────────────────────────────────────────────
    listingCreated: (name?: string) =>
        notifyBridge({ type: 'success', title: 'Anúncio criado com sucesso', description: name ? `"${name}" enviado para revisão.` : 'Seu anúncio está em revisão.', href: '/meus-anuncios' }),

    listingApproved: (name?: string) =>
        notifyBridge({ type: 'success', title: 'Anúncio aprovado!', description: name ? `"${name}" agora está visível para compradores.` : 'Seu anúncio foi aprovado.', href: '/meus-anuncios' }),

    listingRejected: (reason?: string) =>
        notifyBridge({ type: 'error', title: 'Anúncio reprovado', description: reason ?? 'Verifique as diretrizes e edite seu anúncio.', href: '/meus-anuncios' }),

    listingDeleted: () =>
        toastBridge({ type: 'success', title: 'Anúncio removido', duration: 3000 }),

    listingUpdated: () =>
        notifyBridge({ type: 'success', title: 'Anúncio atualizado', description: 'As alterações foram salvas.' }),

    listingError: (msg?: string) =>
        notifyBridge({ type: 'error', title: 'Erro ao publicar anúncio', description: msg ?? 'Tente novamente em alguns instantes.' }),

    dailyLimitReached: () =>
        notifyBridge({ type: 'warning', title: 'Limite diário atingido', description: 'Você pode publicar até 3 anúncios por dia no plano gratuito.' }),

    // ── Chat ─────────────────────────────────────────────────────────────────
    newMessage: (senderName?: string) =>
        notifyBridge({ type: 'message', title: 'Nova mensagem recebida', description: senderName ? `${senderName} enviou uma mensagem.` : 'Você tem uma nova mensagem.' }),

    messageFlagged: () =>
        notifyBridge({ type: 'warning', title: 'Mensagem suspeita detectada', description: 'Nunca realize pagamentos antecipados. SulMotors não intermedia pagamentos.' }),

    // ── Favorites ────────────────────────────────────────────────────────────
    favoriteAdded: (carName?: string) =>
        toastBridge({ type: 'success', title: 'Adicionado aos favoritos', description: carName ? `"${carName}" está nos seus favoritos.` : undefined, duration: 3000 }),

    favoriteRemoved: (carName?: string) =>
        toastBridge({ type: 'info', title: 'Removido dos favoritos', description: carName ? `"${carName}" foi removido.` : undefined, duration: 3000 }),

    // ── Price alerts ─────────────────────────────────────────────────────────
    priceAlert: (carName: string, price: number) =>
        notifyBridge({ type: 'info', title: 'Novo carro encontrado nos seus alertas', description: `"${carName}" — R$ ${price.toLocaleString('pt-BR')}`, href: '/alertas' }),

    alertCreated: () =>
        toastBridge({ type: 'success', title: 'Alerta criado', description: 'Você será notificado quando um carro compatível aparecer.', duration: 3500 }),

    alertDeleted: () =>
        toastBridge({ type: 'info', title: 'Alerta removido', duration: 3000 }),

    // ── Auth ─────────────────────────────────────────────────────────────────
    loginSuccess: () =>
        notifyBridge({ type: 'success', title: 'Login realizado com sucesso', description: 'Bem-vindo de volta ao SulMotors!' }),

    logoutSuccess: () =>
        toastBridge({ type: 'info', title: 'Você saiu da sua conta', duration: 3000 }),

    signupSuccess: () =>
        notifyBridge({ type: 'success', title: 'Conta criada com sucesso!', description: 'Verifique seu e-mail para ativar a conta.' }),

    emailVerified: () =>
        notifyBridge({ type: 'success', title: 'E-mail verificado!', description: 'Sua conta está ativa.' }),

    // ── Verification ─────────────────────────────────────────────────────────
    verificationSubmitted: () =>
        notifyBridge({ type: 'success', title: 'Documentos enviados!', description: 'Sua verificação será analisada em até 24h.' }),

    verifiedBadgeGranted: () =>
        notifyBridge({ type: 'success', title: 'Conta verificada! ✔', description: 'Você agora tem o selo de Vendedor Verificado.' }),

    // ── Generic ──────────────────────────────────────────────────────────────
    copied: () =>
        toastBridge({ type: 'success', title: 'Link copiado!', duration: 2500 }),

    networkError: () =>
        toastBridge({ type: 'error', title: 'Erro de conexão', description: 'Verifique sua internet e tente novamente.', duration: 5000 }),

    authRequired: () =>
        toastBridge({ type: 'warning', title: 'Faça login para continuar', description: 'Crie uma conta gratuita ou entre na sua.', duration: 4500 }),
};

export default smToast;

// ── Compat shim — replaces `import { toast } from 'sonner'` calls ─────────────
//
// Pages still using:  toast.success(title, { description })
//                     toast.error(title, { description })
//                     toast.warning(title)
//                     toast.info(title, { description })
//
// This shim provides the same API shape without requiring Sonner.

type SonnerOpts = { description?: string; duration?: number };

function compat(type: 'success' | 'error' | 'warning' | 'info') {
    return (title: string, opts?: SonnerOpts) =>
        toastBridge({
            type,
            title,
            description: opts?.description,
            duration: opts?.duration ?? 3500,
        });
}

export const toast = {
    success: compat('success'),
    error:   compat('error'),
    warning: compat('warning'),
    info:    compat('info'),
    // passthrough for rare direct calls
    message: (title: string, opts?: SonnerOpts) => compat('info')(title, opts),
};
