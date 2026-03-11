/**
 * SulMotors Toast Utility
 * ──────────────────────────────────────────────────────────────────────────
 * Wraps `sonner` with semantic helpers for all user-action toasts:
 *   - Profile saved
 *   - Vehicle listing created / approved
 *   - New chat message received
 *   - Favorite added / removed
 *   - Price-alert match
 *
 * Usage:
 *   import { smToast } from '../utils/toast';
 *   smToast.profileSaved();
 *   smToast.listingCreated('Honda Civic 2022');
 *   smToast.newMessage('João Silva');
 *   smToast.favoriteAdded('Toyota Corolla');
 *   smToast.priceAlert('Fiat Argo', 45000);
 */

import { toast } from 'sonner';

// ── Generic helpers ──────────────────────────────────────────────────────────

export const smToast = {

    // Profile
    profileSaved: () =>
        toast.success('Perfil atualizado com sucesso!', {
            description: 'Suas informações foram salvas.',
            duration: 4000,
        }),

    profileError: (msg?: string) =>
        toast.error('Erro ao salvar perfil', {
            description: msg || 'Verifique os campos e tente novamente.',
            duration: 4000,
        }),

    // Listings
    listingCreated: (name?: string) =>
        toast.success('Anúncio publicado!', {
            description: name ? `"${name}" está no ar e aguardando aprovação.` : 'Seu anúncio foi enviado para revisão.',
            duration: 5000,
        }),

    listingApproved: (name?: string) =>
        toast.success('Anúncio aprovado! 🎉', {
            description: name ? `"${name}" agora está visível para compradores.` : 'Seu anúncio foi aprovado.',
            duration: 6000,
        }),

    listingRejected: (reason?: string) =>
        toast.error('Anúncio reprovado', {
            description: reason || 'Verifique as diretrizes e edite seu anúncio.',
            duration: 6000,
        }),

    listingDeleted: () =>
        toast.success('Anúncio removido.', { duration: 3000 }),

    listingUpdated: () =>
        toast.success('Anúncio atualizado com sucesso!', { duration: 4000 }),

    dailyLimitReached: () =>
        toast.warning('Limite diário atingido', {
            description: 'Você pode publicar até 3 anúncios por dia no plano gratuito.',
            duration: 6000,
        }),

    // Chat
    newMessage: (senderName?: string) =>
        toast.info('Nova mensagem recebida', {
            description: senderName ? `${senderName} enviou uma mensagem.` : 'Você tem uma nova mensagem.',
            duration: 5000,
        }),

    messageFlagged: () =>
        toast.warning('Mensagem suspeita detectada', {
            description: 'Nunca realize pagamentos antecipados. SulMotors não intermedia pagamentos.',
            duration: 8000,
        }),

    // Favorites
    favoriteAdded: (carName?: string) =>
        toast.success('Adicionado aos favoritos!', {
            description: carName ? `"${carName}" está nos seus favoritos.` : undefined,
            duration: 3000,
        }),

    favoriteRemoved: (carName?: string) =>
        toast.info('Removido dos favoritos', {
            description: carName ? `"${carName}" foi removido.` : undefined,
            duration: 3000,
        }),

    // Price alerts
    priceAlert: (carName: string, price: number) =>
        toast.success('Alerta de preço! 🔔', {
            description: `"${carName}" agora custa R$ ${price.toLocaleString('pt-BR')} — dentro da sua faixa!`,
            duration: 8000,
        }),

    alertCreated: () =>
        toast.success('Alerta criado!', {
            description: 'Você será notificado quando um carro compatível for adicionado.',
            duration: 4000,
        }),

    alertDeleted: () =>
        toast.info('Alerta removido.', { duration: 3000 }),

    // Auth
    loginSuccess: () =>
        toast.success('Login realizado com sucesso!', { duration: 3000 }),

    logoutSuccess: () =>
        toast.info('Você saiu da sua conta.', { duration: 3000 }),

    signupSuccess: () =>
        toast.success('Conta criada com sucesso!', {
            description: 'Verifique seu e-mail para ativar a conta.',
            duration: 6000,
        }),

    emailVerified: () =>
        toast.success('E-mail verificado!', {
            description: 'Sua conta está ativa.',
            duration: 4000,
        }),

    // Verification
    verificationSubmitted: () =>
        toast.success('Documentos enviados!', {
            description: 'Sua verificação será analisada em até 24h.',
            duration: 6000,
        }),

    verifiedBadgeGranted: () =>
        toast.success('Conta verificada! ✔', {
            description: 'Você agora tem o selo de Vendedor Verificado.',
            duration: 6000,
        }),

    // Generic
    copied: () =>
        toast.success('Link copiado!', { duration: 2500 }),

    networkError: () =>
        toast.error('Erro de conexão', {
            description: 'Verifique sua internet e tente novamente.',
            duration: 5000,
        }),

    authRequired: () =>
        toast.warning('Faça login para continuar', {
            description: 'Crie uma conta gratuita ou entre na sua.',
            duration: 5000,
        }),
};

export default smToast;
