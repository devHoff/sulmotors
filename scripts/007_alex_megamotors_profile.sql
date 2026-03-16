-- ============================================================
-- Migration 007: AlexMegamotors company profile setup
-- Run this in Supabase SQL Editor (project: imkzkvlktrixaxougqie)
-- ============================================================

-- 1. Add store-related columns to profiles if they don't exist
ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS store_name   TEXT,
    ADD COLUMN IF NOT EXISTS store_phone  TEXT,
    ADD COLUMN IF NOT EXISTS store_logo   TEXT,
    ADD COLUMN IF NOT EXISTS is_store     BOOLEAN DEFAULT FALSE;

-- 2. Add index for fast store lookup
CREATE INDEX IF NOT EXISTS idx_profiles_store_name
    ON public.profiles (store_name)
    WHERE is_store = TRUE;

-- 3. Allow anon/authenticated to read store profiles
-- (RLS: profiles table should already allow SELECT for authenticated)
GRANT SELECT ON public.profiles TO anon;

-- ============================================================
-- HOW TO LINK AlexMegamotors TO A SUPABASE AUTH USER:
--
-- Step 1: Find the user's UUID in Supabase > Authentication > Users
--         (look for the email that owns the AlexMegamotors listings)
--
-- Step 2: Run the UPDATE below replacing <USER_UUID> with the actual UUID:
--
--   UPDATE public.profiles
--   SET
--       store_name  = 'AlexMegamotors',
--       store_phone = '5551980446474',
--       store_logo  = '/alex-megamotors-logo.png',
--       is_store    = TRUE,
--       full_name   = 'AlexMegamotors',
--       phone       = '5551980446474'
--   WHERE id = '<USER_UUID>';
--
--   -- If the profile row doesn't exist yet, use INSERT ... ON CONFLICT:
--   INSERT INTO public.profiles (id, store_name, store_phone, store_logo, is_store, full_name, phone)
--   VALUES (
--       '<USER_UUID>',
--       'AlexMegamotors',
--       '5551980446474',
--       '/alex-megamotors-logo.png',
--       TRUE,
--       'AlexMegamotors',
--       '5551980446474'
--   )
--   ON CONFLICT (id) DO UPDATE SET
--       store_name  = EXCLUDED.store_name,
--       store_phone = EXCLUDED.store_phone,
--       store_logo  = EXCLUDED.store_logo,
--       is_store    = EXCLUDED.is_store;
--
-- Step 3: Verify:
--   SELECT id, full_name, store_name, store_phone, is_store
--   FROM public.profiles
--   WHERE store_name = 'AlexMegamotors';
-- ============================================================

-- Verification query
SELECT id, full_name, store_name, store_phone, is_store
FROM public.profiles
WHERE is_store = TRUE
ORDER BY store_name;
