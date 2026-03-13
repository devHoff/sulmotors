-- ============================================================
-- SulMotor Monetization System — Migration 001
-- Run this SQL in Supabase Dashboard → SQL Editor
-- ============================================================

-- ── 1. boost_plans ────────────────────────────────────────────────────────────
-- Static configuration for available boost plans.
-- Seed data inserted at the bottom of this file.
CREATE TABLE IF NOT EXISTS public.boost_plans (
    id             uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
    name           text         NOT NULL UNIQUE,          -- 'basic_boost' | 'premium_boost' | 'ultra_boost'
    label          text         NOT NULL,                  -- Display name: 'Básico' | 'Premium' | 'Ultra'
    price          numeric(10,2) NOT NULL,
    duration_days  integer      NOT NULL,
    priority_level integer      NOT NULL DEFAULT 1,       -- 1=basic, 2=premium, 3=ultra
    active         boolean      NOT NULL DEFAULT true,
    created_at     timestamptz  NOT NULL DEFAULT now()
);

-- ── 2. orders ─────────────────────────────────────────────────────────────────
-- One order per boost purchase attempt.
CREATE TABLE IF NOT EXISTS public.orders (
    id                      uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                 uuid         NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    listing_id              uuid         NOT NULL REFERENCES public.anuncios(id) ON DELETE CASCADE,
    plan_type               text         NOT NULL,       -- matches boost_plans.name
    amount                  numeric(10,2) NOT NULL,
    currency                text         NOT NULL DEFAULT 'BRL',
    status                  text         NOT NULL DEFAULT 'pending'
                                         CHECK (status IN ('pending','approved','rejected','cancelled','expired')),
    mercadopago_payment_id  text,
    external_reference      text         GENERATED ALWAYS AS (id::text || ':' || listing_id::text) STORED,
    metadata                jsonb        DEFAULT '{}',
    created_at              timestamptz  NOT NULL DEFAULT now(),
    updated_at              timestamptz  NOT NULL DEFAULT now()
);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS orders_updated_at ON public.orders;
CREATE TRIGGER orders_updated_at
    BEFORE UPDATE ON public.orders
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── 3. listing_boosts ─────────────────────────────────────────────────────────
-- Active / historical boosts linked to a listing and an approved order.
CREATE TABLE IF NOT EXISTS public.listing_boosts (
    id             uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
    listing_id     uuid         NOT NULL REFERENCES public.anuncios(id) ON DELETE CASCADE,
    order_id       uuid         NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    plan_type      text         NOT NULL,
    priority_level integer      NOT NULL DEFAULT 1,
    start_date     timestamptz  NOT NULL DEFAULT now(),
    end_date       timestamptz  NOT NULL,
    active         boolean      NOT NULL DEFAULT true,
    created_at     timestamptz  NOT NULL DEFAULT now(),
    -- Prevent duplicate active boosts for the same listing+order
    UNIQUE (order_id)
);

CREATE INDEX IF NOT EXISTS idx_listing_boosts_listing_active
    ON public.listing_boosts (listing_id, active, end_date);

CREATE INDEX IF NOT EXISTS idx_listing_boosts_active_end
    ON public.listing_boosts (active, end_date)
    WHERE active = true;

-- ── 4. analytics_events ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.analytics_events (
    id          bigserial    PRIMARY KEY,
    event_name  text         NOT NULL,          -- 'boost_purchase_started' | 'boost_payment_approved' etc.
    user_id     uuid         REFERENCES auth.users(id) ON DELETE SET NULL,
    listing_id  uuid         REFERENCES public.anuncios(id) ON DELETE SET NULL,
    order_id    uuid         REFERENCES public.orders(id) ON DELETE SET NULL,
    properties  jsonb        DEFAULT '{}',
    created_at  timestamptz  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_analytics_events_name_created
    ON public.analytics_events (event_name, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_analytics_events_user
    ON public.analytics_events (user_id, created_at DESC);

-- ── 5. page_errors (for 404 tracking — created if not exists) ─────────────────
CREATE TABLE IF NOT EXISTS public.page_errors (
    id         bigserial    PRIMARY KEY,
    url        text,
    referrer   text,
    timestamp  timestamptz  DEFAULT now(),
    user_agent text
);

-- ── 6. Seed boost_plans ───────────────────────────────────────────────────────
INSERT INTO public.boost_plans (name, label, price, duration_days, priority_level) VALUES
    ('basic_boost',   'Básico',  19.90,  7,  1),
    ('premium_boost', 'Premium', 39.90, 15,  2),
    ('ultra_boost',   'Ultra',   79.90, 30,  3)
ON CONFLICT (name) DO UPDATE SET
    label          = EXCLUDED.label,
    price          = EXCLUDED.price,
    duration_days  = EXCLUDED.duration_days,
    priority_level = EXCLUDED.priority_level;

-- ── 7. RLS Policies ───────────────────────────────────────────────────────────

-- boost_plans: public read
ALTER TABLE public.boost_plans ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "boost_plans_public_read" ON public.boost_plans;
CREATE POLICY "boost_plans_public_read" ON public.boost_plans
    FOR SELECT USING (true);

-- orders: users can read/insert their own orders
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "orders_user_read"   ON public.orders;
DROP POLICY IF EXISTS "orders_user_insert" ON public.orders;
CREATE POLICY "orders_user_read" ON public.orders
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "orders_user_insert" ON public.orders
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- listing_boosts: public read (for priority sorting)
ALTER TABLE public.listing_boosts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "listing_boosts_public_read" ON public.listing_boosts;
CREATE POLICY "listing_boosts_public_read" ON public.listing_boosts
    FOR SELECT USING (true);

-- analytics_events: users can insert their own events
ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "analytics_insert" ON public.analytics_events;
CREATE POLICY "analytics_insert" ON public.analytics_events
    FOR INSERT WITH CHECK (auth.uid() = user_id OR user_id IS NULL);
DROP POLICY IF EXISTS "analytics_user_read" ON public.analytics_events;
CREATE POLICY "analytics_user_read" ON public.analytics_events
    FOR SELECT USING (auth.uid() = user_id);

-- page_errors: public insert, no read for anon
ALTER TABLE public.page_errors ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "page_errors_insert" ON public.page_errors;
CREATE POLICY "page_errors_insert" ON public.page_errors
    FOR INSERT WITH CHECK (true);

-- ── 8. Helper view: active_listing_boosts ────────────────────────────────────
-- Used by Estoque to get max priority_level per listing efficiently.
CREATE OR REPLACE VIEW public.active_listing_boosts AS
SELECT
    listing_id,
    MAX(priority_level) AS max_priority
FROM  public.listing_boosts
WHERE active = true
  AND end_date > now()
GROUP BY listing_id;

-- ── 9. Function: expire_boosts() — called by scheduled job ───────────────────
CREATE OR REPLACE FUNCTION public.expire_boosts()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    expired_count integer;
BEGIN
    -- 1. Deactivate expired listing_boosts
    UPDATE public.listing_boosts
       SET active = false
     WHERE active = true
       AND end_date < now();

    GET DIAGNOSTICS expired_count = ROW_COUNT;

    -- 2. For each listing that no longer has an active boost,
    --    reset the prioridade back to 0 on the anuncio.
    UPDATE public.anuncios a
       SET prioridade     = 0,
           impulsionado   = false,
           destaque       = false
     WHERE NOT EXISTS (
         SELECT 1 FROM public.listing_boosts lb
          WHERE lb.listing_id = a.id
            AND lb.active = true
            AND lb.end_date > now()
     )
     AND (a.impulsionado = true OR a.destaque = true OR a.prioridade > 0);

    RETURN expired_count;
END;
$$;

-- ── 10. Function: activate_boost_from_order() — called by webhook ─────────────
-- Idempotent: safe to call multiple times for the same order.
CREATE OR REPLACE FUNCTION public.activate_boost_from_order(
    p_order_id   uuid,
    p_mp_payment_id text
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_order      public.orders%ROWTYPE;
    v_plan       public.boost_plans%ROWTYPE;
    v_end_date   timestamptz;
BEGIN
    -- Load order
    SELECT * INTO v_order FROM public.orders WHERE id = p_order_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Order % not found', p_order_id;
    END IF;
    IF v_order.status = 'approved' THEN
        RETURN;  -- idempotent: already processed
    END IF;

    -- Load plan
    SELECT * INTO v_plan FROM public.boost_plans WHERE name = v_order.plan_type;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Plan % not found', v_order.plan_type;
    END IF;

    v_end_date := now() + (v_plan.duration_days || ' days')::interval;

    -- Update order status
    UPDATE public.orders
       SET status                 = 'approved',
           mercadopago_payment_id = p_mp_payment_id,
           updated_at             = now()
     WHERE id = p_order_id;

    -- Insert listing_boost (upsert on order_id to stay idempotent)
    INSERT INTO public.listing_boosts
        (listing_id, order_id, plan_type, priority_level, start_date, end_date, active)
    VALUES
        (v_order.listing_id, p_order_id, v_plan.name, v_plan.priority_level, now(), v_end_date, true)
    ON CONFLICT (order_id) DO UPDATE
        SET active     = true,
            end_date   = EXCLUDED.end_date;

    -- Update anuncio prioridade / boost flags
    UPDATE public.anuncios
       SET impulsionado     = true,
           destaque         = true,
           impulsionado_ate = v_end_date,
           prioridade       = GREATEST(prioridade, v_plan.priority_level * 10)
     WHERE id = v_order.listing_id;

END;
$$;
