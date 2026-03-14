-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 004: add `slug` column to `anuncios` and back-fill existing rows
-- Run this once in: Supabase Dashboard → SQL Editor → New Query → Run
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Helper function: convert any text to URL-safe slug
--    "Porto Alegre" → "porto-alegre", "Fiat Argo 2021" → "fiat-argo-2021"
CREATE OR REPLACE FUNCTION slugify(v TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE STRICT
AS $$
DECLARE
  result TEXT;
BEGIN
  -- lowercase
  result := lower(v);
  -- replace accented characters
  result := translate(result,
    'áàãâäéèêëíìîïóòõôöúùûüçñ',
    'aaaaaaeeeeiiiiooooouuuucn');
  -- keep only alphanumeric and spaces/hyphens
  result := regexp_replace(result, '[^a-z0-9\s\-]', '', 'g');
  -- collapse whitespace/underscores to hyphens
  result := regexp_replace(result, '[\s_]+', '-', 'g');
  -- collapse multiple hyphens
  result := regexp_replace(result, '-+', '-', 'g');
  -- trim leading/trailing hyphens
  result := trim(both '-' from result);
  RETURN result;
END;
$$;

-- 2. Add the slug column (nullable at first so the ALTER doesn't fail on rows)
ALTER TABLE public.anuncios
  ADD COLUMN IF NOT EXISTS slug TEXT;

-- 3. Back-fill: generate slug as "marca-modelo-ano-cidade"
--    Example: "ford-territory-titanium-2021-porto-alegre"
UPDATE public.anuncios
SET slug = slugify(
  CONCAT_WS('-',
    marca,
    modelo,
    CAST(ano AS TEXT),
    split_part(cidade, ',', 1)   -- take only the city name, not the state
  )
)
WHERE slug IS NULL OR slug = '';

-- 4. Deduplicate: if two rows produce the same slug, append a short suffix
--    (only needed if you have duplicate brand/model/year/city combos)
WITH ranked AS (
  SELECT id, slug,
         ROW_NUMBER() OVER (PARTITION BY slug ORDER BY created_at) AS rn
  FROM public.anuncios
)
UPDATE public.anuncios a
SET slug = a.slug || '-' || LPAD((r.rn - 1)::TEXT, 2, '0')
FROM ranked r
WHERE r.id = a.id AND r.rn > 1;

-- 5. Make the column NOT NULL with a non-empty default from now on
ALTER TABLE public.anuncios
  ALTER COLUMN slug SET NOT NULL,
  ALTER COLUMN slug SET DEFAULT '';

-- 6. Unique index so lookups are fast and slugs stay unique
CREATE UNIQUE INDEX IF NOT EXISTS anuncios_slug_idx ON public.anuncios (slug);

-- 7. Trigger: auto-generate slug on INSERT when slug is blank
CREATE OR REPLACE FUNCTION anuncios_set_slug()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  base_slug TEXT;
  candidate TEXT;
  counter   INT := 0;
BEGIN
  -- Only auto-generate if slug is empty
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
    -- Ensure uniqueness
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

DROP TRIGGER IF EXISTS trg_anuncios_set_slug ON public.anuncios;
CREATE TRIGGER trg_anuncios_set_slug
  BEFORE INSERT OR UPDATE OF marca, modelo, ano, cidade
  ON public.anuncios
  FOR EACH ROW EXECUTE FUNCTION anuncios_set_slug();

-- 8. Grant read access to the anon role (needed for supabasePublic queries)
GRANT SELECT (slug) ON public.anuncios TO anon;

-- Done. Verify:
SELECT id, marca, modelo, ano, cidade, slug FROM public.anuncios ORDER BY created_at;
