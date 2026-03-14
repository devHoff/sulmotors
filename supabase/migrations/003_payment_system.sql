-- ─────────────────────────────────────────────────────────────────────────────
-- SulMotor – Migration 003: Payment System (Supabase Edge Functions)
-- ─────────────────────────────────────────────────────────────────────────────
-- Tables:
--   users         (id, email, created_at)
--   listings      (id, user_id, title, price, brand, model, year, city, state,
--                  boost_active, created_at)
--   orders        (id, user_id, listing_id, amount, status, payment_method,
--                  mercadopago_order_id, mercadopago_payment_id, created_at,
--                  updated_at)
--                 status: pending | waiting_payment | paid | expired |
--                         cancelled | failed
--   listing_boosts (id, listing_id, order_id, boost_type, boost_start,
--                   boost_end, created_at)
--                  boost_type: basic | premium | ultra
--
-- This file is idempotent (uses IF NOT EXISTS / CREATE OR REPLACE).
-- Safe to run after 003_payment_tables.sql – adds any missing pieces.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. users ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  email      text        UNIQUE NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE users IS 'SulMotor users mirror (supplements auth.users)';

-- ── 2. listings ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS listings (
  id           uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid          NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title        text          NOT NULL DEFAULT '',
  price        numeric(12,2) NOT NULL DEFAULT 0,
  brand        text          NOT NULL DEFAULT '',
  model        text          NOT NULL DEFAULT '',
  year         int           NOT NULL DEFAULT 0,
  city         text          NOT NULL DEFAULT '',
  state        text          NOT NULL DEFAULT '',
  boost_active boolean       NOT NULL DEFAULT false,
  created_at   timestamptz   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS listings_user_id_idx      ON listings(user_id);
CREATE INDEX IF NOT EXISTS listings_boost_active_idx ON listings(boost_active) WHERE boost_active = true;
CREATE INDEX IF NOT EXISTS listings_created_at_idx   ON listings(created_at DESC);

COMMENT ON TABLE listings IS 'Normalised listing mirror used by the payments/boost system';

ALTER TABLE listings ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'listings' AND policyname = 'listings: public read'
  ) THEN
    CREATE POLICY "listings: public read" ON listings FOR SELECT USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'listings' AND policyname = 'listings: owner write'
  ) THEN
    CREATE POLICY "listings: owner write" ON listings FOR ALL USING (auth.uid() = user_id);
  END IF;
END $$;

-- ── 3. orders ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS orders (
  id                     uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                uuid          NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  listing_id             uuid          REFERENCES anuncios(id) ON DELETE SET NULL,
  amount                 numeric(10,2) NOT NULL,
  status                 text          NOT NULL DEFAULT 'pending'
                         CHECK (status IN ('pending','waiting_payment','paid','expired','cancelled','failed')),
  payment_method         text          NOT NULL DEFAULT 'pix'
                         CHECK (payment_method IN ('pix','credit_card','boleto')),
  mercadopago_order_id   text,
  mercadopago_payment_id text,
  plan_type              text          NOT NULL DEFAULT 'basic'
                         CHECK (plan_type IN ('basic','premium','ultra')),
  external_reference     text,
  metadata               jsonb         NOT NULL DEFAULT '{}'::jsonb,
  created_at             timestamptz   NOT NULL DEFAULT now(),
  updated_at             timestamptz   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS orders_user_id_idx       ON orders(user_id);
CREATE INDEX IF NOT EXISTS orders_listing_id_idx    ON orders(listing_id);
CREATE INDEX IF NOT EXISTS orders_status_idx        ON orders(status);
CREATE INDEX IF NOT EXISTS orders_mp_order_id_idx   ON orders(mercadopago_order_id)   WHERE mercadopago_order_id   IS NOT NULL;
CREATE INDEX IF NOT EXISTS orders_mp_payment_id_idx ON orders(mercadopago_payment_id) WHERE mercadopago_payment_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS orders_created_at_idx    ON orders(created_at DESC);

COMMENT ON TABLE  orders IS 'Payment orders for boost purchases';
COMMENT ON COLUMN orders.status IS
  'pending=created, waiting_payment=MP order sent, paid=confirmed, '
  'expired=timed-out, cancelled=user/system cancelled, failed=payment error';

-- Trigger: keep updated_at current
CREATE OR REPLACE FUNCTION orders_set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_orders_updated_at ON orders;
CREATE TRIGGER trg_orders_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION orders_set_updated_at();

ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'orders' AND policyname = 'orders: owner read'
  ) THEN
    CREATE POLICY "orders: owner read" ON orders FOR SELECT USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'orders' AND policyname = 'orders: service write'
  ) THEN
    CREATE POLICY "orders: service write" ON orders FOR ALL USING (auth.role() = 'service_role');
  END IF;
END $$;

-- ── 4. listing_boosts ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS listing_boosts (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id  uuid        NOT NULL REFERENCES anuncios(id) ON DELETE CASCADE,
  order_id    uuid        NOT NULL REFERENCES orders(id)   ON DELETE CASCADE,
  boost_type  text        NOT NULL DEFAULT 'basic'
              CHECK (boost_type IN ('basic','premium','ultra')),
  boost_start timestamptz NOT NULL DEFAULT now(),
  boost_end   timestamptz NOT NULL,
  is_active   boolean     NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS listing_boosts_listing_id_idx ON listing_boosts(listing_id);
CREATE INDEX IF NOT EXISTS listing_boosts_order_id_idx   ON listing_boosts(order_id);
CREATE INDEX IF NOT EXISTS listing_boosts_active_idx     ON listing_boosts(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS listing_boosts_end_idx        ON listing_boosts(boost_end);

COMMENT ON TABLE  listing_boosts IS 'Active and historical boost records per listing';
COMMENT ON COLUMN listing_boosts.boost_type IS 'basic=7d, premium=15d, ultra=30d';

-- Unique constraint on order_id to allow safe upsert
ALTER TABLE listing_boosts DROP CONSTRAINT IF EXISTS listing_boosts_order_id_unique;
ALTER TABLE listing_boosts ADD  CONSTRAINT listing_boosts_order_id_unique UNIQUE (order_id);

ALTER TABLE listing_boosts ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'listing_boosts' AND policyname = 'listing_boosts: public read'
  ) THEN
    CREATE POLICY "listing_boosts: public read" ON listing_boosts FOR SELECT USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'listing_boosts' AND policyname = 'listing_boosts: service write'
  ) THEN
    CREATE POLICY "listing_boosts: service write" ON listing_boosts FOR ALL USING (auth.role() = 'service_role');
  END IF;
END $$;

-- ── 5. boost_plans table (optional, used by boost-plans Edge Function) ────────
CREATE TABLE IF NOT EXISTS boost_plans (
  id             uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  name           text          NOT NULL,
  type           text          NOT NULL CHECK (type IN ('basic','premium','ultra')),
  price          numeric(10,2) NOT NULL,
  days           int           NOT NULL,
  duration_days  int           NOT NULL,
  priority_level int           NOT NULL DEFAULT 1,
  description    text          NOT NULL DEFAULT '',
  features       jsonb         NOT NULL DEFAULT '[]'::jsonb,
  is_active      boolean       NOT NULL DEFAULT true,
  created_at     timestamptz   NOT NULL DEFAULT now()
);

COMMENT ON TABLE boost_plans IS 'Configurable boost plan catalog (read by boost-plans Edge Function)';

-- Seed plans if table is empty
INSERT INTO boost_plans (name, type, price, days, duration_days, priority_level, description, features)
SELECT 'Impulso Básico', 'basic', 29.90, 7, 7, 1,
       'Destaque seu anúncio por 7 dias',
       '["7 dias de destaque","Posição prioritária","Mais visualizações"]'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM boost_plans WHERE type = 'basic');

INSERT INTO boost_plans (name, type, price, days, duration_days, priority_level, description, features)
SELECT 'Impulso Premium', 'premium', 59.90, 15, 15, 2,
       'Destaque seu anúncio por 15 dias',
       '["15 dias de destaque","Posição premium","Badge exclusivo","3× mais visualizações"]'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM boost_plans WHERE type = 'premium');

INSERT INTO boost_plans (name, type, price, days, duration_days, priority_level, description, features)
SELECT 'Impulso Ultra', 'ultra', 99.90, 30, 30, 3,
       'Destaque máximo por 30 dias',
       '["30 dias de destaque","Posição máxima","Badge ultra","5× mais visualizações","Suporte prioritário"]'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM boost_plans WHERE type = 'ultra');

-- ── 6. SQL functions for cron jobs ────────────────────────────────────────────

-- expire_boosts(): deactivate boosts whose boost_end has passed
CREATE OR REPLACE FUNCTION expire_boosts()
RETURNS int LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  expired_count int;
BEGIN
  WITH deactivated AS (
    UPDATE listing_boosts
    SET    is_active = false
    WHERE  is_active = true
      AND  boost_end < now()
    RETURNING listing_id
  ),
  updated_anuncios AS (
    UPDATE anuncios
    SET    impulsionado   = false,
           destaque       = false,
           data_expiracao = NULL,
           prioridade     = 0
    WHERE  id IN (SELECT DISTINCT listing_id FROM deactivated)
      AND  id NOT IN (
        SELECT DISTINCT listing_id FROM listing_boosts
        WHERE is_active = true AND boost_end >= now()
      )
    RETURNING id
  )
  SELECT COUNT(*) INTO expired_count FROM deactivated;

  RETURN expired_count;
END;
$$;

COMMENT ON FUNCTION expire_boosts IS
  'Called every 10 min: deactivates expired listing_boosts rows '
  'and clears boost flags on anuncios';

-- expire_pending_orders(): cancel orders waiting_payment > 24 h
CREATE OR REPLACE FUNCTION expire_pending_orders()
RETURNS int LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  expired_count int;
BEGIN
  UPDATE orders
  SET    status     = 'expired',
         updated_at = now()
  WHERE  status     = 'waiting_payment'
    AND  created_at < now() - INTERVAL '24 hours';

  GET DIAGNOSTICS expired_count = ROW_COUNT;
  RETURN expired_count;
END;
$$;

COMMENT ON FUNCTION expire_pending_orders IS
  'Called every 30 min: expires orders stuck in waiting_payment for >24h';

-- activate_boost(): called by mercadopago-webhook on payment confirmation
CREATE OR REPLACE FUNCTION activate_boost(
  p_order_id   uuid,
  p_listing_id uuid,
  p_boost_type text,
  p_duration   interval
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_boost_end timestamptz := now() + p_duration;
BEGIN
  -- Upsert boost record
  INSERT INTO listing_boosts (listing_id, order_id, boost_type, boost_start, boost_end)
  VALUES (p_listing_id, p_order_id, p_boost_type, now(), v_boost_end)
  ON CONFLICT (order_id) DO UPDATE
    SET boost_end  = EXCLUDED.boost_end,
        is_active  = true,
        boost_type = EXCLUDED.boost_type;

  -- Mark order as paid
  UPDATE orders
  SET    status     = 'paid',
         updated_at = now()
  WHERE  id = p_order_id;

  -- Set boost_active = true on the listing and update anuncios flags
  UPDATE anuncios
  SET    impulsionado   = true,
         destaque       = true,
         data_expiracao = v_boost_end,
         prioridade     = CASE p_boost_type
                            WHEN 'ultra'   THEN 30
                            WHEN 'premium' THEN 20
                            ELSE                10
                          END
  WHERE  id = p_listing_id;
END;
$$;

COMMENT ON FUNCTION activate_boost IS
  'Atomically activates a boost: inserts listing_boosts, '
  'sets order status=paid, sets boost flags on anuncios';

-- boost_duration(): helper to convert plan type to interval
CREATE OR REPLACE FUNCTION boost_duration(p_type text)
RETURNS interval LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE p_type
    WHEN 'ultra'   THEN INTERVAL '30 days'
    WHEN 'premium' THEN INTERVAL '15 days'
    ELSE                INTERVAL '7 days'
  END;
$$;

COMMENT ON FUNCTION boost_duration IS
  'Returns the boost duration interval for a given plan type';

-- ── 7. Supabase cron job registration (pg_cron) ───────────────────────────────
-- Run in Supabase SQL Editor after enabling pg_cron extension:
--
--   SELECT cron.schedule(
--     'expire_boosts',
--     '*/10 * * * *',
--     $$ SELECT expire_boosts(); $$
--   );
--
--   SELECT cron.schedule(
--     'expire_pending_orders',
--     '*/30 * * * *',
--     $$ SELECT expire_pending_orders(); $$
--   );
--
-- These are commented out here because pg_cron.schedule() must be called
-- by a superuser and may not be available in all Supabase tiers.
-- The same jobs run via Supabase Edge Function scheduled invocations.
