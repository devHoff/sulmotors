-- ─────────────────────────────────────────────────────────────────────────────
-- SulMotor – Migration 003: Payment Architecture
-- Creates: users, listings, orders, listing_boosts
-- Plus SQL functions for boost expiration and order expiration (cron jobs)
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. users ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  email       text        UNIQUE NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE users IS 'Registered SulMotor users (mirrors auth.users)';

-- ── 2. listings ──────────────────────────────────────────────────────────────
-- NOTE: anuncios is the primary listing table; this is a normalised mirror
-- used by the payment/boost system.
CREATE TABLE IF NOT EXISTS listings (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title        text        NOT NULL DEFAULT '',
  price        numeric(12,2) NOT NULL DEFAULT 0,
  brand        text        NOT NULL DEFAULT '',
  model        text        NOT NULL DEFAULT '',
  year         int         NOT NULL DEFAULT 0,
  city         text        NOT NULL DEFAULT '',
  state        text        NOT NULL DEFAULT '',
  boost_active boolean     NOT NULL DEFAULT false,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS listings_user_id_idx       ON listings(user_id);
CREATE INDEX IF NOT EXISTS listings_boost_active_idx  ON listings(boost_active) WHERE boost_active = true;
CREATE INDEX IF NOT EXISTS listings_created_at_idx    ON listings(created_at DESC);

COMMENT ON TABLE listings IS 'Normalised listing mirror used by the payments/boost system';

-- Row Level Security
ALTER TABLE listings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "listings: public read" ON listings
  FOR SELECT USING (true);

CREATE POLICY "listings: owner write" ON listings
  FOR ALL USING (auth.uid() = user_id);

-- ── 3. orders ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS orders (
  id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                 uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  listing_id              uuid        REFERENCES anuncios(id) ON DELETE SET NULL,
  amount                  numeric(10,2) NOT NULL,
  status                  text        NOT NULL DEFAULT 'pending'
                          CHECK (status IN ('pending','waiting_payment','paid','expired','cancelled','failed')),
  payment_method          text        NOT NULL DEFAULT 'pix'
                          CHECK (payment_method IN ('pix','credit_card','boleto')),
  mercadopago_order_id    text,
  mercadopago_payment_id  text,
  plan_type               text        NOT NULL DEFAULT 'basic'
                          CHECK (plan_type IN ('basic','premium','ultra')),
  external_reference      text,
  metadata                jsonb       NOT NULL DEFAULT '{}'::jsonb,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS orders_user_id_idx        ON orders(user_id);
CREATE INDEX IF NOT EXISTS orders_listing_id_idx     ON orders(listing_id);
CREATE INDEX IF NOT EXISTS orders_status_idx         ON orders(status);
CREATE INDEX IF NOT EXISTS orders_mp_order_id_idx    ON orders(mercadopago_order_id) WHERE mercadopago_order_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS orders_mp_payment_id_idx  ON orders(mercadopago_payment_id) WHERE mercadopago_payment_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS orders_created_at_idx     ON orders(created_at DESC);

COMMENT ON TABLE  orders IS 'Payment orders for boost purchases';
COMMENT ON COLUMN orders.status IS 'pending=created, waiting_payment=MP order sent, paid=confirmed, expired=timed-out, cancelled=user/MP cancelled, failed=error';

-- Trigger: keep updated_at current
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_orders_updated_at ON orders;
CREATE TRIGGER trg_orders_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Row Level Security
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "orders: owner read" ON orders
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "orders: service write" ON orders
  FOR ALL USING (auth.role() = 'service_role');

-- ── 4. listing_boosts ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS listing_boosts (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id  uuid        NOT NULL REFERENCES anuncios(id) ON DELETE CASCADE,
  order_id    uuid        NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  boost_type  text        NOT NULL DEFAULT 'basic'
              CHECK (boost_type IN ('basic','premium','ultra')),
  boost_start timestamptz NOT NULL DEFAULT now(),
  boost_end   timestamptz NOT NULL,
  is_active   boolean     NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS listing_boosts_listing_id_idx  ON listing_boosts(listing_id);
CREATE INDEX IF NOT EXISTS listing_boosts_order_id_idx    ON listing_boosts(order_id);
CREATE INDEX IF NOT EXISTS listing_boosts_is_active_idx   ON listing_boosts(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS listing_boosts_boost_end_idx   ON listing_boosts(boost_end);

COMMENT ON TABLE  listing_boosts IS 'Active and historical boost records for listings';
COMMENT ON COLUMN listing_boosts.boost_type IS 'basic=7d, premium=15d, ultra=30d';

-- Row Level Security
ALTER TABLE listing_boosts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "listing_boosts: public read" ON listing_boosts
  FOR SELECT USING (true);

CREATE POLICY "listing_boosts: service write" ON listing_boosts
  FOR ALL USING (auth.role() = 'service_role');

-- ── 5. SQL cron functions ─────────────────────────────────────────────────────

-- expire_boosts(): deactivate boosts whose boost_end has passed
CREATE OR REPLACE FUNCTION expire_boosts()
RETURNS int LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  expired_count int;
BEGIN
  -- Deactivate expired boost records
  WITH deactivated AS (
    UPDATE listing_boosts
    SET    is_active = false
    WHERE  is_active = true
      AND  boost_end < now()
    RETURNING listing_id
  ),
  -- Turn off boost_active flag on each affected listing
  updated_anuncios AS (
    UPDATE anuncios
    SET    impulsionado    = false,
           destaque        = false,
           data_expiracao  = NULL,
           prioridade      = 0
    WHERE  id IN (
      SELECT DISTINCT listing_id FROM deactivated
    )
    -- Only if no other active boost still exists for this listing
    AND id NOT IN (
      SELECT DISTINCT listing_id FROM listing_boosts
      WHERE is_active = true AND boost_end >= now()
    )
    RETURNING id
  )
  SELECT COUNT(*) INTO expired_count FROM deactivated;

  RETURN expired_count;
END;
$$;

COMMENT ON FUNCTION expire_boosts IS 'Called every 10 min: deactivates expired listing_boosts rows and clears boost flags on anuncios';

-- expire_pending_orders(): cancel orders waiting > 24h
CREATE OR REPLACE FUNCTION expire_pending_orders()
RETURNS int LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  expired_count int;
BEGIN
  UPDATE orders
  SET    status     = 'expired',
         updated_at = now()
  WHERE  status = 'waiting_payment'
    AND  created_at < now() - INTERVAL '24 hours';

  GET DIAGNOSTICS expired_count = ROW_COUNT;
  RETURN expired_count;
END;
$$;

COMMENT ON FUNCTION expire_pending_orders IS 'Called every 30 min: expires orders stuck in waiting_payment for >24h';

-- activate_boost(): called by webhook on payment confirmation
CREATE OR REPLACE FUNCTION activate_boost(
  p_order_id    uuid,
  p_listing_id  uuid,
  p_boost_type  text,
  p_duration    interval
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

  -- Activate boost flags on anuncios
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

COMMENT ON FUNCTION activate_boost IS 'Atomically activates a boost: inserts listing_boosts row, updates order status to paid, sets boost flags on anuncios';

-- Unique constraint on listing_boosts(order_id) to support upsert in activate_boost
ALTER TABLE listing_boosts
  DROP CONSTRAINT IF EXISTS listing_boosts_order_id_unique;
ALTER TABLE listing_boosts
  ADD  CONSTRAINT listing_boosts_order_id_unique UNIQUE (order_id);

-- ── 6. Boost plan durations helper ───────────────────────────────────────────
CREATE OR REPLACE FUNCTION boost_duration(p_type text)
RETURNS interval LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE p_type
    WHEN 'ultra'   THEN INTERVAL '30 days'
    WHEN 'premium' THEN INTERVAL '15 days'
    ELSE                INTERVAL '7 days'
  END;
$$;

COMMENT ON FUNCTION boost_duration IS 'Returns the boost duration interval for a given plan type';
