-- ============================================================
-- Migration: create_mp_preference as a PostgreSQL RPC function
-- Uses the http extension (available in all Supabase projects)
-- to call the Mercado Pago API synchronously from the DB.
--
-- This replaces the Edge Function, requiring no CLI deployment.
--
-- Steps to apply:
-- 1. Enable the http extension (if not already):
--    CREATE EXTENSION IF NOT EXISTS http WITH SCHEMA extensions;
--
-- 2. Create a config table to store the MP token securely:
--    (Already included below)
--
-- 3. Insert your MP access token:
--    INSERT INTO public.app_config (key, value)
--    VALUES ('MERCADOPAGO_ACCESS_TOKEN', 'TEST-your-token-here')
--    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
--
-- 4. Run this entire file in the Supabase SQL Editor.
-- ============================================================

-- Enable http extension
CREATE EXTENSION IF NOT EXISTS http WITH SCHEMA extensions;

-- Config table to store app secrets
CREATE TABLE IF NOT EXISTS public.app_config (
    key    TEXT PRIMARY KEY,
    value  TEXT NOT NULL
);

-- Only service_role and the RPC function can access config
ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;

-- No policies for anon/authenticated - only internal use via SECURITY DEFINER functions
-- Service role can do everything
DROP POLICY IF EXISTS "service_role_config" ON public.app_config;
CREATE POLICY "service_role_config"
    ON public.app_config FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- ── Fix pagamentos RLS (also applied here for completeness) ──────────────────
DROP POLICY IF EXISTS "Service role full access" ON public.pagamentos;
CREATE POLICY "Service role full access"
    ON public.pagamentos FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- ── Main RPC: create_mp_preference ──────────────────────────────────────────
-- Called from the frontend via supabase.rpc('create_mp_preference', {...})
-- SECURITY DEFINER: runs as the function owner (postgres), bypasses RLS
CREATE OR REPLACE FUNCTION public.create_mp_preference(
    p_anuncio_id  UUID,
    p_user_id     UUID,
    p_periodo_key TEXT,
    p_dias        INT,
    p_preco       NUMERIC,
    p_user_email  TEXT DEFAULT 'bandasleonardo@gmail.com',
    p_carro_desc  TEXT DEFAULT 'Veículo'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_mp_token      TEXT;
    v_app_url       TEXT := 'https://sulmotors.com.br';
    v_pagamento_id  UUID;
    v_preference    JSONB;
    v_request_body  JSONB;
    v_response      extensions.http_response;
    v_response_body JSONB;
BEGIN
    -- 1. Get MP token from config table
    SELECT value INTO v_mp_token
    FROM public.app_config
    WHERE key = 'MERCADOPAGO_ACCESS_TOKEN';

    -- Get APP_URL if configured
    SELECT value INTO v_app_url
    FROM public.app_config
    WHERE key = 'APP_URL';

    IF v_app_url IS NULL THEN
        v_app_url := 'https://sulmotors.com.br';
    END IF;

    -- 2. Create pagamentos record (SECURITY DEFINER bypasses RLS)
    INSERT INTO public.pagamentos (anuncio_id, user_id, periodo_key, dias, valor, status)
    VALUES (p_anuncio_id, p_user_id, p_periodo_key, p_dias, p_preco, 'pendente')
    RETURNING id INTO v_pagamento_id;

    -- 3. If no MP token, return mock response (for development)
    IF v_mp_token IS NULL OR v_mp_token = '' THEN
        RETURN jsonb_build_object(
            'preference_id',       'mock-preference-id',
            'init_point',          v_app_url || '/impulsionar/sucesso?pagamento_id=' || v_pagamento_id || '&anuncio_id=' || p_anuncio_id || '&status=pendente',
            'sandbox_init_point',  v_app_url || '/impulsionar/sucesso?pagamento_id=' || v_pagamento_id || '&anuncio_id=' || p_anuncio_id || '&status=pendente',
            'pagamento_id',        v_pagamento_id,
            '_mock',               true
        );
    END IF;

    -- 4. Build preference payload
    v_request_body := jsonb_build_object(
        'items', jsonb_build_array(
            jsonb_build_object(
                'id',          'boost-' || p_anuncio_id,
                'title',       'Impulsionar Anúncio — ' || p_carro_desc || ' (' || replace(p_periodo_key, '_', ' ') || ')',
                'quantity',    1,
                'unit_price',  p_preco,
                'currency_id', 'BRL',
                'category_id', 'services'
            )
        ),
        'payer', jsonb_build_object('email', p_user_email),
        'payment_methods', jsonb_build_object(
            'excluded_payment_types', jsonb_build_array(
                jsonb_build_object('id', 'credit_card'),
                jsonb_build_object('id', 'debit_card'),
                jsonb_build_object('id', 'prepaid_card'),
                jsonb_build_object('id', 'ticket')
            ),
            'installments', 1
        ),
        'back_urls', jsonb_build_object(
            'success', v_app_url || '/impulsionar/sucesso?pagamento_id=' || v_pagamento_id || '&anuncio_id=' || p_anuncio_id,
            'failure', v_app_url || '/impulsionar/' || p_anuncio_id || '?erro=pagamento_falhou',
            'pending', v_app_url || '/impulsionar/sucesso?pagamento_id=' || v_pagamento_id || '&anuncio_id=' || p_anuncio_id || '&status=pendente'
        ),
        'auto_return',         'approved',
        'external_reference',  v_pagamento_id::TEXT,
        'expires',             false
    );

    -- 5. Call Mercado Pago API via http extension
    SELECT * INTO v_response
    FROM extensions.http((
        'POST',
        'https://api.mercadopago.com/checkout/preferences',
        ARRAY[
            extensions.http_header('Authorization', 'Bearer ' || v_mp_token),
            extensions.http_header('Content-Type', 'application/json')
        ],
        'application/json',
        v_request_body::TEXT
    )::extensions.http_request);

    v_response_body := v_response.content::JSONB;

    -- 6. Handle MP API error
    IF v_response.status != 201 THEN
        -- Cleanup the pending record
        DELETE FROM public.pagamentos WHERE id = v_pagamento_id;
        RETURN jsonb_build_object(
            'error',   'Erro ao criar preferência no Mercado Pago.',
            'details', v_response_body,
            'status',  v_response.status
        );
    END IF;

    -- 7. Save preference_id
    UPDATE public.pagamentos
    SET preference_id = v_response_body->>'id'
    WHERE id = v_pagamento_id;

    -- 8. Return success
    RETURN jsonb_build_object(
        'preference_id',      v_response_body->>'id',
        'init_point',         v_response_body->>'init_point',
        'sandbox_init_point', v_response_body->>'sandbox_init_point',
        'pagamento_id',       v_pagamento_id
    );

EXCEPTION WHEN OTHERS THEN
    -- Cleanup on unexpected error
    IF v_pagamento_id IS NOT NULL THEN
        DELETE FROM public.pagamentos WHERE id = v_pagamento_id;
    END IF;
    RETURN jsonb_build_object(
        'error', 'Erro interno: ' || SQLERRM
    );
END;
$$;

-- Grant execute to authenticated users only
REVOKE ALL ON FUNCTION public.create_mp_preference FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_mp_preference TO authenticated;

SELECT 'Migration applied: create_mp_preference RPC ready' AS result;
