-- ==========================================
-- SCRIPT DE CORREÇÃO: ADICIONAR COLUNAS FALTANTES
-- ==========================================

-- 1. Verificar e adicionar a coluna avatar_url se ela não existir
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'profiles' 
        AND column_name = 'avatar_url'
    ) THEN
        ALTER TABLE public.profiles ADD COLUMN avatar_url TEXT;
    END IF;
END $$;

-- 2. Verificar e adicionar a coluna updated_at se ela não existir
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'profiles' 
        AND column_name = 'updated_at'
    ) THEN
        ALTER TABLE public.profiles ADD COLUMN updated_at TIMESTAMPTZ;
    END IF;
END $$;

-- 3. Garantir que o bucket é público
update storage.buckets
set public = true
where id = 'avatars';
