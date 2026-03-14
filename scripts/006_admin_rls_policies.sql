-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 006: Admin RLS policies for the anuncios table
--
-- Problem: Admin actions (toggleDestaque, approveCar, deleteCar) fail for
-- listings owned by other users because the existing UPDATE/DELETE RLS policy
-- only allows "user_id = auth.uid()" — i.e., owners can only edit their own rows.
-- Admins (contato@sulmotor.com, mvp.hoffmann@gmail.com) need to update ANY row.
--
-- Solution: Add a helper function is_admin() that checks the authenticated
-- user's email against the admin list, then add permissive policies that
-- allow admins to UPDATE and DELETE any row in anuncios.
--
-- Run in: Supabase Dashboard → SQL Editor → New Query → Run
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Helper: returns true if the currently authenticated user is an admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT COALESCE(
    auth.email() IN (
      'contato@sulmotor.com',
      'mvp.hoffmann@gmail.com'
    ),
    false
  );
$$;

-- Grant execute to authenticated role so the RLS policies can call it
GRANT EXECUTE ON FUNCTION is_admin() TO authenticated;

-- 2. Admin UPDATE policy — allows admins to update any listing
--    (includes toggling destaque, aprovado, impulsionado, etc.)
DROP POLICY IF EXISTS "admin_update_anuncios" ON public.anuncios;
CREATE POLICY "admin_update_anuncios"
  ON public.anuncios
  FOR UPDATE
  TO authenticated
  USING     (is_admin())   -- admin can see (and therefore UPDATE) any row
  WITH CHECK (is_admin()); -- admin can write any value

-- 3. Admin DELETE policy — allows admins to delete any listing
DROP POLICY IF EXISTS "admin_delete_anuncios" ON public.anuncios;
CREATE POLICY "admin_delete_anuncios"
  ON public.anuncios
  FOR DELETE
  TO authenticated
  USING (is_admin());

-- 4. (Safety check) Make sure RLS is enabled on the table
ALTER TABLE public.anuncios ENABLE ROW LEVEL SECURITY;

-- Done. Verify:
SELECT policyname, cmd, roles, qual
FROM pg_policies
WHERE tablename = 'anuncios'
ORDER BY policyname;
