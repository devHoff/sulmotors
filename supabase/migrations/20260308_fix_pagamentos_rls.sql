-- ============================================================
-- Migration: fix pagamentos RLS policies
-- The original "Service role full access" policy was missing
-- WITH CHECK (true), causing insert failures from edge functions.
-- Run this in your Supabase SQL Editor.
-- ============================================================

-- Drop and recreate service role policy with proper WITH CHECK clause
DROP POLICY IF EXISTS "Service role full access" ON public.pagamentos;

CREATE POLICY "Service role full access"
    ON public.pagamentos FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Ensure insert policy for authenticated users is also correct
DROP POLICY IF EXISTS "Users can insert own payments" ON public.pagamentos;

CREATE POLICY "Users can insert own payments"
    ON public.pagamentos FOR INSERT
    TO authenticated
    WITH CHECK (user_id = auth.uid());

SELECT 'RLS policies fixed for pagamentos table' AS result;
