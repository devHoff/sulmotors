-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: add versao, placa, blindado columns to anuncios
-- Run this in Supabase Dashboard → SQL Editor
-- ─────────────────────────────────────────────────────────────────────────────

-- Versão/acabamento do veículo (ex: "EXL", "Trekking", "Sport")
ALTER TABLE public.anuncios
  ADD COLUMN IF NOT EXISTS versao TEXT DEFAULT NULL;

-- Placa do veículo (armazenada internamente, nunca exibida publicamente)
-- Formato: ABC1234 (antigo) ou ABC1D23 (Mercosul) — 7 chars sem hífen
ALTER TABLE public.anuncios
  ADD COLUMN IF NOT EXISTS placa TEXT DEFAULT NULL;

-- Flag de veículo blindado
ALTER TABLE public.anuncios
  ADD COLUMN IF NOT EXISTS blindado BOOLEAN NOT NULL DEFAULT FALSE;

-- Confirmar
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'anuncios'
ORDER BY ordinal_position;
