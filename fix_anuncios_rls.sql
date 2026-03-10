-- ============================================================
-- FIX: anuncios SELECT policy — all rows public to everyone
-- ============================================================
-- The current RLS policy for SELECT on `anuncios` is filtering
-- authenticated users to only their own rows, causing Estoque
-- to show only the logged-in user's cars instead of all cars.
--
-- Run this in Supabase Dashboard → SQL Editor to fix it:
-- ============================================================

-- Drop the broken policy (try both possible names)
DROP POLICY IF EXISTS "Adverts are viewable by everyone." ON anuncios;
DROP POLICY IF EXISTS "anuncios_select_public"            ON anuncios;
DROP POLICY IF EXISTS "Users can view all adverts."       ON anuncios;
DROP POLICY IF EXISTS "Public adverts are viewable."      ON anuncios;

-- Re-create the correct open SELECT policy
CREATE POLICY "Adverts are viewable by everyone."
  ON anuncios
  FOR SELECT
  USING (true);

-- Verify
SELECT policyname, cmd, qual
FROM   pg_policies
WHERE  tablename = 'anuncios'
ORDER  BY cmd;
