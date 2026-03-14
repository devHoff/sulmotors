-- ============================================================
-- SulMotor Production Architecture — Migration 002
-- Run AFTER migration 001_monetization.sql
-- ============================================================
-- Adds: listing_views, favorites, user_sessions, listing_scores,
--       seo_metadata, search_cache, notifications, rate_limits,
--       fraud_prevention, and all supporting functions/indexes.
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- 1. listing_views — track every unique page view
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.listing_views (
    id          bigserial    PRIMARY KEY,
    listing_id  uuid         NOT NULL REFERENCES public.anuncios(id) ON DELETE CASCADE,
    user_id     uuid         REFERENCES auth.users(id) ON DELETE SET NULL,
    ip_hash     text,                         -- SHA-256 of IP, never raw IP
    user_agent  text,
    referrer    text,
    session_id  text,
    created_at  timestamptz  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_listing_views_listing   ON public.listing_views (listing_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_listing_views_user      ON public.listing_views (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_listing_views_ip        ON public.listing_views (ip_hash, listing_id, created_at DESC);

-- RLS: insert public, no direct read
ALTER TABLE public.listing_views ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "listing_views_public_insert" ON public.listing_views;
CREATE POLICY "listing_views_public_insert" ON public.listing_views
    FOR INSERT WITH CHECK (true);
-- Owners can see their own listing's views
DROP POLICY IF EXISTS "listing_views_owner_read" ON public.listing_views;
CREATE POLICY "listing_views_owner_read" ON public.listing_views
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.anuncios a
            WHERE a.id = listing_id AND a.user_id = auth.uid()
        )
    );

-- ─────────────────────────────────────────────────────────────
-- 2. favorites (alias for curtidas — unified table)
-- ─────────────────────────────────────────────────────────────
-- The existing "curtidas" table serves as favorites.
-- Add views_count and favorites_count denormalized columns to anuncios.
ALTER TABLE public.anuncios
    ADD COLUMN IF NOT EXISTS views_count      integer NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS favorites_count  integer NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS ranking_score    numeric(10,4) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS status           text NOT NULL DEFAULT 'active'
        CHECK (status IN ('active','inactive','sold','pending'));

CREATE INDEX IF NOT EXISTS idx_anuncios_ranking ON public.anuncios (ranking_score DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_anuncios_status  ON public.anuncios (status);
CREATE INDEX IF NOT EXISTS idx_anuncios_boost   ON public.anuncios (impulsionado, prioridade DESC);

-- ─────────────────────────────────────────────────────────────
-- 3. seo_metadata — per-listing SEO data
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.seo_metadata (
    listing_id        uuid PRIMARY KEY REFERENCES public.anuncios(id) ON DELETE CASCADE,
    slug              text NOT NULL UNIQUE,
    meta_title        text,
    meta_description  text,
    og_image          text,
    json_ld           jsonb DEFAULT '{}',
    canonical_url     text,
    sitemap_priority  numeric(3,2) DEFAULT 0.80,
    sitemap_changefreq text DEFAULT 'daily',
    indexed_at        timestamptz,
    created_at        timestamptz NOT NULL DEFAULT now(),
    updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_seo_metadata_slug    ON public.seo_metadata (slug);
CREATE INDEX IF NOT EXISTS idx_seo_metadata_indexed ON public.seo_metadata (indexed_at DESC);

ALTER TABLE public.seo_metadata ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "seo_public_read" ON public.seo_metadata;
CREATE POLICY "seo_public_read" ON public.seo_metadata FOR SELECT USING (true);
DROP POLICY IF EXISTS "seo_service_write" ON public.seo_metadata;
CREATE POLICY "seo_service_write" ON public.seo_metadata FOR ALL USING (true) WITH CHECK (true);

-- Auto-update updated_at
DROP TRIGGER IF EXISTS seo_metadata_updated_at ON public.seo_metadata;
CREATE TRIGGER seo_metadata_updated_at
    BEFORE UPDATE ON public.seo_metadata
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─────────────────────────────────────────────────────────────
-- 4. user_sessions — JWT refresh token store
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.user_sessions (
    id          uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     uuid         NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    token_hash  text         NOT NULL UNIQUE,      -- SHA-256 of refresh token
    user_agent  text,
    ip_hash     text,
    expires_at  timestamptz  NOT NULL,
    revoked     boolean      NOT NULL DEFAULT false,
    created_at  timestamptz  NOT NULL DEFAULT now(),
    last_used_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_sessions_user   ON public.user_sessions (user_id, expires_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_sessions_token  ON public.user_sessions (token_hash);
CREATE INDEX IF NOT EXISTS idx_user_sessions_expiry ON public.user_sessions (expires_at) WHERE revoked = false;

ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "sessions_user_read" ON public.user_sessions;
CREATE POLICY "sessions_user_read" ON public.user_sessions
    FOR SELECT USING (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────
-- 5. notifications — in-app notification store
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.notifications (
    id          bigserial    PRIMARY KEY,
    user_id     uuid         NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    type        text         NOT NULL,   -- 'boost_activated' | 'boost_expiring' | 'payment_failed' | 'new_view'
    title       text         NOT NULL,
    body        text,
    action_url  text,
    read        boolean      NOT NULL DEFAULT false,
    metadata    jsonb        DEFAULT '{}',
    created_at  timestamptz  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
    ON public.notifications (user_id, created_at DESC) WHERE read = false;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "notifications_user_read" ON public.notifications;
CREATE POLICY "notifications_user_read" ON public.notifications
    FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "notifications_user_update" ON public.notifications;
CREATE POLICY "notifications_user_update" ON public.notifications
    FOR UPDATE USING (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────
-- 6. rate_limits — server-side rate limiting store
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.rate_limits (
    key         text         NOT NULL,   -- e.g. "login:ip:1.2.3.4" | "payment:uid:xxx"
    action      text         NOT NULL,   -- 'login' | 'payment' | 'listing_create'
    count       integer      NOT NULL DEFAULT 1,
    window_start timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (key, action)
);

CREATE INDEX IF NOT EXISTS idx_rate_limits_window ON public.rate_limits (window_start);

ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;
-- Service role only
CREATE POLICY "rate_limits_service_only" ON public.rate_limits FOR ALL USING (false);

-- ─────────────────────────────────────────────────────────────
-- 7. search_cache — server-side search result cache
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.search_cache (
    cache_key   text         PRIMARY KEY,
    result_ids  uuid[]       NOT NULL,
    filter_hash text         NOT NULL,
    total_count integer      NOT NULL DEFAULT 0,
    created_at  timestamptz  NOT NULL DEFAULT now(),
    expires_at  timestamptz  NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_search_cache_expires ON public.search_cache (expires_at);

ALTER TABLE public.search_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "search_cache_public_read" ON public.search_cache FOR SELECT USING (true);

-- ─────────────────────────────────────────────────────────────
-- 8. pending_orders expiration view
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW public.expired_pending_orders AS
SELECT id, user_id, listing_id, amount, status, created_at
FROM public.orders
WHERE status = 'pending'
  AND created_at < now() - INTERVAL '24 hours';

-- ─────────────────────────────────────────────────────────────
-- 9. FUNCTION: calculate_listing_score(listing_id)
--    Implements the ranking algorithm:
--    score = (boost_active * 100) + recency + (views * 0.5) + (favorites * 1.5)
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.calculate_listing_score(p_listing_id uuid)
RETURNS numeric LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_boost_active    boolean;
    v_boost_priority  integer;
    v_days_since_post numeric;
    v_views           integer;
    v_favorites       integer;
    v_recency_score   numeric;
    v_boost_score     numeric;
    v_score           numeric;
BEGIN
    -- Fetch listing base data
    SELECT
        COALESCE(impulsionado, false),
        COALESCE(prioridade, 0),
        EXTRACT(EPOCH FROM (now() - created_at)) / 86400.0,
        COALESCE(views_count, 0),
        COALESCE(favorites_count, 0)
    INTO
        v_boost_active, v_boost_priority, v_days_since_post, v_views, v_favorites
    FROM public.anuncios
    WHERE id = p_listing_id;

    IF NOT FOUND THEN RETURN 0; END IF;

    -- Check for active listing_boost (more precise than impulsionado flag)
    SELECT EXISTS (
        SELECT 1 FROM public.listing_boosts lb
        WHERE lb.listing_id = p_listing_id
          AND lb.active = true
          AND lb.end_date > now()
    ) INTO v_boost_active;

    -- Boost score: priority_level * 100 (ultra=300, premium=200, basic=100)
    -- Falls back to prioridade*10 for legacy boosts
    v_boost_score := CASE WHEN v_boost_active THEN
        COALESCE((
            SELECT MAX(priority_level) * 100
            FROM public.listing_boosts
            WHERE listing_id = p_listing_id AND active = true AND end_date > now()
        ), v_boost_priority * 10)
    ELSE 0 END;

    -- Recency score: max 30, decays linearly over 30 days
    v_recency_score := GREATEST(0, 30 - v_days_since_post);

    -- Composite score
    v_score :=
        v_boost_score
        + v_recency_score
        + (v_views    * 0.5)
        + (v_favorites * 1.5);

    RETURN ROUND(v_score, 4);
END;
$$;

-- ─────────────────────────────────────────────────────────────
-- 10. FUNCTION: update_all_listing_scores()
--     Called by the hourly cron job
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.update_all_listing_scores()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    updated_count integer;
BEGIN
    UPDATE public.anuncios
    SET ranking_score = public.calculate_listing_score(id)
    WHERE status = 'active';

    GET DIAGNOSTICS updated_count = ROW_COUNT;
    RETURN updated_count;
END;
$$;

-- ─────────────────────────────────────────────────────────────
-- 11. FUNCTION: expire_pending_orders()
--     Run every 30 minutes
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.expire_pending_orders()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    expired_count integer;
BEGIN
    UPDATE public.orders
    SET status     = 'expired',
        updated_at = now()
    WHERE status = 'pending'
      AND created_at < now() - INTERVAL '24 hours';

    GET DIAGNOSTICS expired_count = ROW_COUNT;
    RETURN expired_count;
END;
$$;

-- ─────────────────────────────────────────────────────────────
-- 12. FUNCTION: clean_expired_cache()
--     Remove stale search cache entries
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.clean_expired_cache()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    deleted_count integer;
BEGIN
    DELETE FROM public.search_cache WHERE expires_at < now();
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$;

-- ─────────────────────────────────────────────────────────────
-- 13. FUNCTION: record_listing_view(listing_id, user_id, ip_hash, ...)
--     Deduplicates: same ip_hash + listing_id within 1 hour counts once
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.record_listing_view(
    p_listing_id  uuid,
    p_user_id     uuid DEFAULT NULL,
    p_ip_hash     text DEFAULT NULL,
    p_user_agent  text DEFAULT NULL,
    p_referrer    text DEFAULT NULL,
    p_session_id  text DEFAULT NULL
)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_duplicate boolean := false;
BEGIN
    -- Dedup check: same IP + listing within last 1 hour
    IF p_ip_hash IS NOT NULL THEN
        SELECT EXISTS (
            SELECT 1 FROM public.listing_views
            WHERE listing_id = p_listing_id
              AND ip_hash     = p_ip_hash
              AND created_at  > now() - INTERVAL '1 hour'
        ) INTO v_duplicate;
    END IF;

    -- Dedup check: same logged-in user within last 1 hour
    IF NOT v_duplicate AND p_user_id IS NOT NULL THEN
        SELECT EXISTS (
            SELECT 1 FROM public.listing_views
            WHERE listing_id = p_listing_id
              AND user_id     = p_user_id
              AND created_at  > now() - INTERVAL '1 hour'
        ) INTO v_duplicate;
    END IF;

    IF v_duplicate THEN RETURN false; END IF;

    -- Insert view
    INSERT INTO public.listing_views (listing_id, user_id, ip_hash, user_agent, referrer, session_id)
    VALUES (p_listing_id, p_user_id, p_ip_hash, p_user_agent, p_referrer, p_session_id);

    -- Increment denormalized counter
    UPDATE public.anuncios
    SET views_count = views_count + 1
    WHERE id = p_listing_id;

    RETURN true;
END;
$$;

-- ─────────────────────────────────────────────────────────────
-- 14. FUNCTION: generate_seo_slug(marca, modelo, ano, cidade)
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.generate_seo_slug(
    p_marca  text,
    p_modelo text,
    p_ano    integer,
    p_cidade text,
    p_id     uuid
)
RETURNS text LANGUAGE plpgsql AS $$
DECLARE
    base_slug  text;
    final_slug text;
    counter    integer := 0;
BEGIN
    -- Build base slug: lowercase, remove accents, replace spaces/special chars with -
    base_slug := lower(
        regexp_replace(
            regexp_replace(
                unaccent(p_marca || ' ' || p_modelo || ' ' || p_ano || ' ' || split_part(p_cidade, ',', 1)),
                '[^a-z0-9\s-]', '', 'g'
            ),
            '\s+', '-', 'g'
        )
    );
    base_slug := regexp_replace(base_slug, '-{2,}', '-', 'g');
    base_slug := trim(both '-' from base_slug);

    -- Ensure uniqueness
    final_slug := base_slug;
    LOOP
        EXIT WHEN NOT EXISTS (
            SELECT 1 FROM public.seo_metadata
            WHERE slug = final_slug AND listing_id != p_id
        );
        counter    := counter + 1;
        final_slug := base_slug || '-' || counter;
    END LOOP;

    RETURN final_slug;
END;
$$;

-- ─────────────────────────────────────────────────────────────
-- 15. FUNCTION: upsert_seo_metadata(listing_id)
--     Creates or updates SEO metadata for a listing
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.upsert_seo_metadata(p_listing_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_listing  public.anuncios%ROWTYPE;
    v_slug     text;
    v_title    text;
    v_desc     text;
    v_city     text;
    v_price    text;
    v_json_ld  jsonb;
    v_canon    text := 'https://sulmotor.com.br';
BEGIN
    SELECT * INTO v_listing FROM public.anuncios WHERE id = p_listing_id;
    IF NOT FOUND THEN RETURN; END IF;

    v_city  := split_part(v_listing.cidade, ',', 1);
    v_price := to_char(v_listing.preco, 'FM9,999,999');
    v_slug  := public.generate_seo_slug(
                    v_listing.marca, v_listing.modelo,
                    v_listing.ano, v_listing.cidade, p_listing_id);

    v_title := v_listing.marca || ' ' || v_listing.modelo || ' ' || v_listing.ano
               || ' à venda em ' || v_city || ' | SulMotor';

    v_desc  := 'Confira este ' || v_listing.marca || ' ' || v_listing.modelo || ' '
               || v_listing.ano || ' à venda em ' || v_city
               || ' por R$' || v_price || ' no SulMotor. '
               || COALESCE(LEFT(v_listing.descricao, 120), '');

    -- JSON-LD structured data (Product + Vehicle + Offer)
    v_json_ld := jsonb_build_object(
        '@context', 'https://schema.org',
        '@type', 'Vehicle',
        'name', v_listing.marca || ' ' || v_listing.modelo || ' ' || v_listing.ano,
        'brand', jsonb_build_object('@type', 'Brand', 'name', v_listing.marca),
        'model', v_listing.modelo,
        'vehicleModelDate', v_listing.ano::text,
        'fuelType', v_listing.combustivel,
        'vehicleTransmission', v_listing.cambio,
        'color', v_listing.cor,
        'mileageFromOdometer', jsonb_build_object(
            '@type', 'QuantitativeValue',
            'value', v_listing.quilometragem,
            'unitCode', 'KMT'
        ),
        'offers', jsonb_build_object(
            '@type', 'Offer',
            'price', v_listing.preco,
            'priceCurrency', 'BRL',
            'availability', 'https://schema.org/InStock',
            'url', v_canon || '/carro/' || p_listing_id
        ),
        'image', CASE
            WHEN array_length(v_listing.imagens, 1) > 0
            THEN to_jsonb(v_listing.imagens[1])
            ELSE 'null'::jsonb
        END,
        'description', LEFT(COALESCE(v_listing.descricao, ''), 500)
    );

    INSERT INTO public.seo_metadata (
        listing_id, slug, meta_title, meta_description,
        og_image, json_ld, canonical_url, indexed_at
    ) VALUES (
        p_listing_id,
        v_slug,
        LEFT(v_title, 70),
        LEFT(v_desc, 160),
        CASE WHEN array_length(v_listing.imagens, 1) > 0 THEN v_listing.imagens[1] ELSE NULL END,
        v_json_ld,
        v_canon || '/carros/' || v_slug,
        NULL
    )
    ON CONFLICT (listing_id) DO UPDATE SET
        slug              = EXCLUDED.slug,
        meta_title        = EXCLUDED.meta_title,
        meta_description  = EXCLUDED.meta_description,
        og_image          = EXCLUDED.og_image,
        json_ld           = EXCLUDED.json_ld,
        canonical_url     = EXCLUDED.canonical_url,
        updated_at        = now();
END;
$$;

-- ─────────────────────────────────────────────────────────────
-- 16. TRIGGER: auto-generate SEO metadata when listing is inserted/updated
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.trigger_upsert_seo()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    PERFORM public.upsert_seo_metadata(NEW.id);
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS anuncios_seo_upsert ON public.anuncios;
CREATE TRIGGER anuncios_seo_upsert
    AFTER INSERT OR UPDATE OF marca, modelo, ano, preco, cidade, descricao, imagens
    ON public.anuncios
    FOR EACH ROW
    EXECUTE FUNCTION public.trigger_upsert_seo();

-- ─────────────────────────────────────────────────────────────
-- 17. TRIGGER: update favorites_count when curtidas changes
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.update_favorites_count()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE public.anuncios
        SET favorites_count = favorites_count + 1
        WHERE id = NEW.anuncio_id;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE public.anuncios
        SET favorites_count = GREATEST(0, favorites_count - 1)
        WHERE id = OLD.anuncio_id;
    END IF;
    RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS curtidas_count_update ON public.curtidas;
CREATE TRIGGER curtidas_count_update
    AFTER INSERT OR DELETE ON public.curtidas
    FOR EACH ROW EXECUTE FUNCTION public.update_favorites_count();

-- ─────────────────────────────────────────────────────────────
-- 18. FUNCTION: get_listings_ranked(filters + pagination)
--     Returns listings sorted by ranking_score DESC with optional filters.
--     Used by the search/estoque API endpoint.
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_listings_ranked(
    p_marca     text    DEFAULT NULL,
    p_modelo    text    DEFAULT NULL,
    p_year_min  integer DEFAULT NULL,
    p_year_max  integer DEFAULT NULL,
    p_price_min numeric DEFAULT NULL,
    p_price_max numeric DEFAULT NULL,
    p_cidade    text    DEFAULT NULL,
    p_query     text    DEFAULT NULL,
    p_limit     integer DEFAULT 50,
    p_offset    integer DEFAULT 0
)
RETURNS TABLE (
    id             uuid,
    marca          text,
    modelo         text,
    ano            integer,
    preco          numeric,
    quilometragem  integer,
    cidade         text,
    imagens        text[],
    destaque       boolean,
    impulsionado   boolean,
    ranking_score  numeric,
    views_count    integer,
    favorites_count integer,
    created_at     timestamptz,
    seo_slug       text
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    RETURN QUERY
    SELECT
        a.id, a.marca, a.modelo, a.ano, a.preco, a.quilometragem,
        a.cidade, a.imagens, a.destaque, a.impulsionado,
        a.ranking_score, a.views_count, a.favorites_count, a.created_at,
        sm.slug
    FROM public.anuncios a
    LEFT JOIN public.seo_metadata sm ON sm.listing_id = a.id
    WHERE a.status = 'active'
      AND (p_marca    IS NULL OR lower(a.marca)   = lower(p_marca))
      AND (p_modelo   IS NULL OR lower(a.modelo)  ILIKE '%' || lower(p_modelo) || '%')
      AND (p_year_min IS NULL OR a.ano >= p_year_min)
      AND (p_year_max IS NULL OR a.ano <= p_year_max)
      AND (p_price_min IS NULL OR a.preco >= p_price_min)
      AND (p_price_max IS NULL OR a.preco <= p_price_max)
      AND (p_cidade    IS NULL OR lower(a.cidade) ILIKE '%' || lower(p_cidade) || '%')
      AND (p_query     IS NULL OR
           lower(a.marca || ' ' || a.modelo || ' ' || a.descricao)
               ILIKE '%' || lower(p_query) || '%')
    ORDER BY a.ranking_score DESC, a.created_at DESC
    LIMIT  p_limit
    OFFSET p_offset;
END;
$$;

-- ─────────────────────────────────────────────────────────────
-- 19. FUNCTION: get_home_featured()
--     Optimized for homepage — boosted + recent listings
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_home_featured(p_limit integer DEFAULT 8)
RETURNS SETOF public.anuncios LANGUAGE sql SECURITY DEFINER AS $$
    SELECT a.* FROM public.anuncios a
    WHERE a.status = 'active'
      AND (a.impulsionado = true OR a.destaque = true OR a.ranking_score > 50)
    ORDER BY a.ranking_score DESC, a.created_at DESC
    LIMIT p_limit;
$$;

-- ─────────────────────────────────────────────────────────────
-- 20. Backfill: generate SEO metadata for all existing listings
-- ─────────────────────────────────────────────────────────────
DO $$
DECLARE
    r public.anuncios%ROWTYPE;
BEGIN
    FOR r IN SELECT * FROM public.anuncios LOOP
        BEGIN
            PERFORM public.upsert_seo_metadata(r.id);
        EXCEPTION WHEN OTHERS THEN
            -- unaccent extension may not be installed; skip silently
            NULL;
        END;
    END LOOP;
END;
$$;

-- ─────────────────────────────────────────────────────────────
-- 21. Backfill: calculate initial ranking scores
-- ─────────────────────────────────────────────────────────────
UPDATE public.anuncios
SET ranking_score = public.calculate_listing_score(id)
WHERE status = 'active';

-- ─────────────────────────────────────────────────────────────
-- 22. unaccent extension (run if not already enabled)
-- ─────────────────────────────────────────────────────────────
-- CREATE EXTENSION IF NOT EXISTS unaccent;  -- Uncomment if not enabled

-- ─────────────────────────────────────────────────────────────
-- DONE
-- ─────────────────────────────────────────────────────────────
COMMENT ON TABLE public.listing_views    IS 'Tracks unique page views per listing with dedup (1h window)';
COMMENT ON TABLE public.seo_metadata     IS 'Auto-generated SEO metadata per listing (slug, JSON-LD, meta tags)';
COMMENT ON TABLE public.user_sessions    IS 'JWT refresh token store for session management';
COMMENT ON TABLE public.notifications    IS 'In-app notifications (boost activated, expiring, payment failed)';
COMMENT ON TABLE public.search_cache     IS 'Server-side search result cache (TTL 60s)';
COMMENT ON TABLE public.rate_limits      IS 'Server-side rate limiting counters (login, payment, listing_create)';
