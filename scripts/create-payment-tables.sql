-- ═══════════════════════════════════════════════════════════════════════════════
-- SulMotor – Payment System Tables
-- Run this in: https://supabase.com/dashboard/project/imkzkvlktrixaxougqie/sql/new
-- ═══════════════════════════════════════════════════════════════════════════════
-- Creates: orders, listing_boosts, boost_plans tables
-- Plus SQL functions: expire_boosts(), expire_pending_orders(), activate_boost()
-- Safe to run multiple times (idempotent)
-- ═══════════════════════════════════════════════════════════════════════════════

-- ── orders ────────────────────────────────────────────────────────────────────
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

-- Trigger: auto-update updated_at
CREATE OR REPLACE FUNCTION orders_set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_orders_updated_at ON orders;
CREATE TRIGGER trg_orders_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION orders_set_updated_at();

-- RLS
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='orders' AND policyname='orders: owner read') THEN
    CREATE POLICY "orders: owner read" ON orders FOR SELECT USING (auth.uid() = user_id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='orders' AND policyname='orders: service write') THEN
    CREATE POLICY "orders: service write" ON orders FOR ALL USING (auth.role() = 'service_role');
  END IF;
END $$;

-- ── listing_boosts ────────────────────────────────────────────────────────────
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

-- Unique constraint on order_id for safe upsert
ALTER TABLE listing_boosts DROP CONSTRAINT IF EXISTS listing_boosts_order_id_unique;
ALTER TABLE listing_boosts ADD  CONSTRAINT listing_boosts_order_id_unique UNIQUE (order_id);

-- RLS
ALTER TABLE listing_boosts ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='listing_boosts' AND policyname='listing_boosts: public read') THEN
    CREATE POLICY "listing_boosts: public read" ON listing_boosts FOR SELECT USING (true);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='listing_boosts' AND policyname='listing_boosts: service write') THEN
    CREATE POLICY "listing_boosts: service write" ON listing_boosts FOR ALL USING (auth.role() = 'service_role');
  END IF;
END $$;

-- ── boost_plans ───────────────────────────────────────────────────────────────
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

-- Seed plans
INSERT INTO boost_plans (name, type, price, days, duration_days, priority_level, description, features)
SELECT 'Impulso Básico','basic',29.90,7,7,1,'Destaque seu anúncio por 7 dias',
       '["7 dias de destaque","Posição prioritária","Mais visualizações"]'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM boost_plans WHERE type='basic');

INSERT INTO boost_plans (name, type, price, days, duration_days, priority_level, description, features)
SELECT 'Impulso Premium','premium',59.90,15,15,2,'Destaque seu anúncio por 15 dias',
       '["15 dias de destaque","Posição premium","Badge exclusivo","3× mais visualizações"]'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM boost_plans WHERE type='premium');

INSERT INTO boost_plans (name, type, price, days, duration_days, priority_level, description, features)
SELECT 'Impulso Ultra','ultra',99.90,30,30,3,'Destaque máximo por 30 dias',
       '["30 dias de destaque","Posição máxima","Badge ultra","5× mais visualizações","Suporte prioritário"]'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM boost_plans WHERE type='ultra');

-- ── SQL Functions for cron jobs ───────────────────────────────────────────────

-- expire_boosts(): deactivate expired boosts
CREATE OR REPLACE FUNCTION expire_boosts()
RETURNS int LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  expired_count int;
BEGIN
  WITH deactivated AS (
    UPDATE listing_boosts SET is_active = false
    WHERE  is_active = true AND boost_end < now()
    RETURNING listing_id
  ),
  updated_anuncios AS (
    UPDATE anuncios
    SET impulsionado=false, destaque=false, data_expiracao=NULL, prioridade=0
    WHERE id IN (SELECT DISTINCT listing_id FROM deactivated)
      AND id NOT IN (
        SELECT DISTINCT listing_id FROM listing_boosts
        WHERE is_active=true AND boost_end>=now()
      )
    RETURNING id
  )
  SELECT COUNT(*) INTO expired_count FROM deactivated;
  RETURN expired_count;
END;
$$;

-- expire_pending_orders(): cancel orders waiting > 24h
CREATE OR REPLACE FUNCTION expire_pending_orders()
RETURNS int LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE expired_count int;
BEGIN
  UPDATE orders SET status='expired', updated_at=now()
  WHERE status='waiting_payment' AND created_at < now() - INTERVAL '24 hours';
  GET DIAGNOSTICS expired_count = ROW_COUNT;
  RETURN expired_count;
END;
$$;

-- activate_boost(): called by webhook on payment confirmation
CREATE OR REPLACE FUNCTION activate_boost(
  p_order_id   uuid,
  p_listing_id uuid,
  p_boost_type text,
  p_duration   interval
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_boost_end timestamptz := now() + p_duration;
BEGIN
  INSERT INTO listing_boosts (listing_id, order_id, boost_type, boost_start, boost_end)
  VALUES (p_listing_id, p_order_id, p_boost_type, now(), v_boost_end)
  ON CONFLICT (order_id) DO UPDATE
    SET boost_end=EXCLUDED.boost_end, is_active=true, boost_type=EXCLUDED.boost_type;

  UPDATE orders SET status='paid', updated_at=now() WHERE id=p_order_id;

  UPDATE anuncios
  SET impulsionado=true, destaque=true, data_expiracao=v_boost_end,
      prioridade=CASE p_boost_type WHEN 'ultra' THEN 30 WHEN 'premium' THEN 20 ELSE 10 END
  WHERE id=p_listing_id;
END;
$$;

-- boost_duration(): returns interval for plan type
CREATE OR REPLACE FUNCTION boost_duration(p_type text)
RETURNS interval LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE p_type WHEN 'ultra' THEN INTERVAL '30 days'
                     WHEN 'premium' THEN INTERVAL '15 days'
                     ELSE INTERVAL '7 days' END;
$$;

-- ── Verify tables were created ────────────────────────────────────────────────
SELECT 'orders'        AS table_name, COUNT(*) AS rows FROM orders
UNION ALL
SELECT 'listing_boosts', COUNT(*) FROM listing_boosts
UNION ALL
SELECT 'boost_plans',    COUNT(*) FROM boost_plans;
