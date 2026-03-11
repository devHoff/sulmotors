/**
 * SulMotors Enterprise Toast Utility
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

// ── Semantic helpers ──────────────────────────────────────────────────────────

export const smToast = {

    // ── Profile ───────────────────────────────────────────────────────────────
    profileSaved: () =>
        toastBridge({ type: 'success', title: 'Perfil atualizado', description: 'Suas informações foram salvas com sucesso.', duration: 3500 }),

    profileError: (msg?: string) =>
        toastBridge({ type: 'error', title: 'Erro ao salvar perfil', description: msg ?? 'Verifique os campos e tente novamente.', duration: 3500 }),

    profileIncomplete: () =>
        toastBridge({ type: 'warning', title: 'Perfil incompleto', description: 'Complete seu perfil antes de publicar veículos.', duration: 4000 }),

    // ── Listings ─────────────────────────────────────────────────────────────
    listingCreated: (name?: string) =>
        toastBridge({ type: 'success', title: 'Anúncio criado com sucesso', description: name ? `"${name}" enviado para revisão.` : 'Seu anúncio está em revisão.', duration: 4000, sound: true }),

    listingApproved: (name?: string) =>
        toastBridge({ type: 'success', title: 'Anúncio aprovado!', description: name ? `"${name}" agora está visível para compradores.` : 'Seu anúncio foi aprovado.', duration: 5000, sound: true }),

    listingRejected: (reason?: string) =>
        toastBridge({ type: 'error', title: 'Anúncio reprovado', description: reason ?? 'Verifique as diretrizes e edite seu anúncio.', duration: 5000 }),

    listingDeleted: () =>
        toastBridge({ type: 'success', title: 'Anúncio removido', duration: 3000 }),

    listingUpdated: () =>
        toastBridge({ type: 'success', title: 'Anúncio atualizado', description: 'As alterações foram salvas.', duration: 3500 }),

    listingError: (msg?: string) =>
        toastBridge({ type: 'error', title: 'Erro ao publicar anúncio', description: msg ?? 'Tente novamente em alguns instantes.', duration: 4000 }),

    dailyLimitReached: () =>
        toastBridge({ type: 'warning', title: 'Limite diário atingido', description: 'Você pode publicar até 3 anúncios por dia no plano gratuito.', duration: 5000 }),

    // ── Chat ─────────────────────────────────────────────────────────────────
    newMessage: (senderName?: string) =>
        toastBridge({ type: 'info', title: 'Nova mensagem recebida', description: senderName ? `${senderName} enviou uma mensagem.` : 'Você tem uma nova mensagem.', duration: 4000, sound: true }),

    messageFlagged: () =>
        toastBridge({ type: 'warning', title: 'Mensagem suspeita detectada', description: 'Nunca realize pagamentos antecipados. SulMotors não intermedia pagamentos.', duration: 7000 }),

    // ── Favorites ────────────────────────────────────────────────────────────
    favoriteAdded: (carName?: string) =>
        toastBridge({ type: 'success', title: 'Adicionado aos favoritos', description: carName ? `"${carName}" está nos seus favoritos.` : undefined, duration: 3000 }),

    favoriteRemoved: (carName?: string) =>
        toastBridge({ type: 'info', title: 'Removido dos favoritos', description: carName ? `"${carName}" foi removido.` : undefined, duration: 3000 }),

    // ── Price alerts ─────────────────────────────────────────────────────────
    priceAlert: (carName: string, price: number) =>
        toastBridge({ type: 'info', title: 'Novo carro encontrado nos seus alertas', description: `"${carName}" — R$ ${price.toLocaleString('pt-BR')}`, duration: 7000, sound: true }),

    alertCreated: () =>
        toastBridge({ type: 'success', title: 'Alerta criado', description: 'Você será notificado quando um carro compatível aparecer.', duration: 3500 }),

    alertDeleted: () =>
        toastBridge({ type: 'info', title: 'Alerta removido', duration: 3000 }),

    // ── Auth ─────────────────────────────────────────────────────────────────
    loginSuccess: () =>
        toastBridge({ type: 'success', title: 'Login realizado com sucesso', duration: 3000 }),

    logoutSuccess: () =>
        toastBridge({ type: 'info', title: 'Você saiu da sua conta', duration: 3000 }),

    signupSuccess: () =>
        toastBridge({ type: 'success', title: 'Conta criada com sucesso!', description: 'Verifique seu e-mail para ativar a conta.', duration: 5000, sound: true }),

    emailVerified: () =>
        toastBridge({ type: 'success', title: 'E-mail verificado!', description: 'Sua conta está ativa.', duration: 4000 }),

    // ── Verification ─────────────────────────────────────────────────────────
    verificationSubmitted: () =>
        toastBridge({ type: 'success', title: 'Documentos enviados!', description: 'Sua verificação será analisada em até 24h.', duration: 5000 }),

    verifiedBadgeGranted: () =>
        toastBridge({ type: 'success', title: 'Conta verificada! ✔', description: 'Você agora tem o selo de Vendedor Verificado.', duration: 5000, sound: true }),

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
