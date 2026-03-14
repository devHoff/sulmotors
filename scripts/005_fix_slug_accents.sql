-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 005: Fix slugify() accent mapping bug and re-generate all slugs
-- 
-- The original slugify() in migration 004 had an off-by-one error in the
-- translate() call: the target string had 25 chars (6 a's) while the source
-- had 24, causing accented chars like í → e instead of i.
-- Example: "Tramandaí" was incorrectly slugified to "tramandae" instead of "tramandai".
--
-- Run this in: Supabase Dashboard → SQL Editor → New Query → Run
-- ─────────────────────────────────────────────────────────────────────────────

-- Step 1: Drop the unique index temporarily so we can regenerate slugs freely
DROP INDEX IF EXISTS anuncios_slug_idx;

-- Step 2: Fix the slugify() function (correct 24→24 char mapping)
-- Source (24 chars): á à ã â ä  é è ê ë  í ì î ï  ó ò õ ô ö  ú ù û ü  ç ñ
-- Target (24 chars): a a a a a  e e e e  i i i i  o o o o o  u u u u  c n
CREATE OR REPLACE FUNCTION slugify(v TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE STRICT
AS $$
DECLARE
  result TEXT;
BEGIN
  result := lower(v);
  result := translate(result,
    'áàãâäéèêëíìîïóòõôöúùûüçñ',
    'aaaaaeeeeiiiiooooouuuucn');
  result := regexp_replace(result, '[^a-z0-9\s\-]', '', 'g');
  result := regexp_replace(result, '[\s_]+', '-', 'g');
  result := regexp_replace(result, '-+', '-', 'g');
  result := trim(both '-' from result);
  RETURN result;
END;
$$;

-- Step 3: Re-generate all slugs with the fixed function
-- Reset slug to empty first so the backfill runs cleanly
UPDATE public.anuncios SET slug = '';

UPDATE public.anuncios
SET slug = slugify(
  CONCAT_WS('-',
    marca,
    modelo,
    CAST(ano AS TEXT),
    split_part(cidade, ',', 1)
  )
);

-- Step 4: Deduplicate (same brand/model/year/city combos get a numeric suffix)
WITH ranked AS (
  SELECT id, slug,
         ROW_NUMBER() OVER (PARTITION BY slug ORDER BY created_at) AS rn
  FROM public.anuncios
)
UPDATE public.anuncios a
SET slug = a.slug || '-' || LPAD((r.rn - 1)::TEXT, 2, '0')
FROM ranked r
WHERE r.id = a.id AND r.rn > 1;

-- Step 5: Recreate the unique index
CREATE UNIQUE INDEX anuncios_slug_idx ON public.anuncios (slug);

-- Step 6: Update the trigger function to also use the fixed slugify
CREATE OR REPLACE FUNCTION anuncios_set_slug()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  base_slug TEXT;
  candidate TEXT;
  counter   INT := 0;
BEGIN
  IF NEW.slug IS NULL OR NEW.slug = '' THEN
    base_slug := slugify(
      CONCAT_WS('-',
        NEW.marca,
        NEW.modelo,
        CAST(NEW.ano AS TEXT),
        split_part(NEW.cidade, ',', 1)
      )
    );
    candidate := base_slug;
    LOOP
      EXIT WHEN NOT EXISTS (
        SELECT 1 FROM public.anuncios WHERE slug = candidate AND id <> NEW.id
      );
      counter   := counter + 1;
      candidate := base_slug || '-' || LPAD(counter::TEXT, 2, '0');
    END LOOP;
    NEW.slug := candidate;
  END IF;
  RETURN NEW;
END;
$$;

-- Done. Verify the corrected slugs:
SELECT id, marca, modelo, ano, cidade, slug FROM public.anuncios ORDER BY created_at;
