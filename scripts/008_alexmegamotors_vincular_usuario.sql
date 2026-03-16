-- ============================================================
-- Migration 008: AlexMegamotors — vincular bandasleonardo@gmail.com
-- Execute no Supabase SQL Editor (projeto: imkzkvlktrixaxougqie)
-- ============================================================

-- 1. Garantir que colunas de loja existam (idempotente com migration 007)
ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS store_name   TEXT,
    ADD COLUMN IF NOT EXISTS store_phone  TEXT,
    ADD COLUMN IF NOT EXISTS store_logo   TEXT,
    ADD COLUMN IF NOT EXISTS is_store     BOOLEAN DEFAULT FALSE;

-- 2. Vincular o perfil do usuário bandasleonardo@gmail.com à loja AlexMegamotors
--    Substitua <USER_UUID> pelo UUID real do usuário (veja em Authentication > Users)
--
--    PASSO A PASSO:
--    a) Abra o Supabase Dashboard → Authentication → Users
--    b) Localize o email: bandasleonardo@gmail.com
--    c) Copie o UUID (coluna "UID")
--    d) Cole o UUID abaixo no lugar de <USER_UUID>
--    e) Execute o script

-- Se o usuário JÁ existe em public.profiles:
-- UPDATE public.profiles
-- SET
--     store_name  = 'AlexMegamotors',
--     store_phone = '5551980446474',
--     store_logo  = '/alex-megamotors-logo.png',
--     is_store    = TRUE,
--     full_name   = 'AlexMegamotors',
--     phone       = '5551980446474'
-- WHERE id = '<USER_UUID>';

-- Se o usuário NÃO existe em public.profiles (use este):
-- INSERT INTO public.profiles (id, store_name, store_phone, store_logo, is_store, full_name, phone)
-- VALUES (
--     '<USER_UUID>',
--     'AlexMegamotors',
--     '5551980446474',
--     '/alex-megamotors-logo.png',
--     TRUE,
--     'AlexMegamotors',
--     '5551980446474'
-- )
-- ON CONFLICT (id) DO UPDATE SET
--     store_name  = 'AlexMegamotors',
--     store_phone = '5551980446474',
--     store_logo  = '/alex-megamotors-logo.png',
--     is_store    = TRUE;

-- 3. Atualizar anúncios existentes do usuário para incluir o campo loja
--    (opcional — vincula automaticamente anúncios já publicados à loja)
-- UPDATE public.anuncios
-- SET loja = 'AlexMegamotors'
-- WHERE user_id = '<USER_UUID>' AND (loja IS NULL OR loja = '');

-- 4. Verificação final
SELECT
    p.id,
    p.full_name,
    p.store_name,
    p.store_phone,
    p.is_store,
    u.email,
    COUNT(a.id) AS total_anuncios
FROM public.profiles p
LEFT JOIN auth.users u ON u.id = p.id
LEFT JOIN public.anuncios a ON a.user_id = p.id
WHERE p.is_store = TRUE
GROUP BY p.id, p.full_name, p.store_name, p.store_phone, p.is_store, u.email
ORDER BY p.store_name;

-- ============================================================
-- NOTA SOBRE SENHA:
-- A senha "bandasleo125!" NÃO é armazenada em texto puro.
-- Para criar/resetar a senha:
--   1. Vá em Authentication > Users no Supabase Dashboard
--   2. Crie o usuário com email: bandasleonardo@gmail.com
--      e senha: bandasleo125!
--   OU use "Send password reset" se a conta já existir.
-- ============================================================
