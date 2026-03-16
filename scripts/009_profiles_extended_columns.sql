-- ============================================================
-- Migration: 009_profiles_extended_columns.sql
-- Adds cpf, data_nascimento, genero to public.profiles
-- Run once in Supabase Dashboard → SQL Editor
-- ============================================================

-- Add missing columns (safe — IF NOT EXISTS prevents duplication)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS cpf             TEXT,
  ADD COLUMN IF NOT EXISTS data_nascimento DATE,
  ADD COLUMN IF NOT EXISTS genero          TEXT;

-- Optional indexes for common lookups
CREATE INDEX IF NOT EXISTS idx_profiles_cpf    ON public.profiles (cpf)
  WHERE cpf IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_profiles_genero ON public.profiles (genero)
  WHERE genero IS NOT NULL;

-- Verify columns were added
SELECT column_name, data_type, is_nullable
FROM   information_schema.columns
WHERE  table_schema = 'public'
  AND  table_name   = 'profiles'
ORDER  BY ordinal_position;
