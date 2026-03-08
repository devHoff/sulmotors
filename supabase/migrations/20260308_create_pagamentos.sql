-- ============================================================
-- Migration: create pagamentos table for Mercado Pago payments
-- Run this in your Supabase SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS public.pagamentos (
    id             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

    -- Relations
    anuncio_id     UUID         NOT NULL REFERENCES public.anuncios(id) ON DELETE CASCADE,
    user_id        UUID         NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    -- Boost details
    periodo_key    TEXT         NOT NULL,          -- '1_semana', '1_mes', etc.
    dias           INT          NOT NULL,           -- number of boost days
    valor          NUMERIC(10,2) NOT NULL,          -- price in BRL

    -- Mercado Pago
    preference_id  TEXT,                            -- MP preference ID
    mp_payment_id  TEXT,                            -- MP payment ID (from webhook)
    status         TEXT         NOT NULL DEFAULT 'pendente'
                                CHECK (status IN ('pendente', 'approved', 'rejected', 'cancelled', 'in_process', 'refunded'))
);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER pagamentos_updated_at
    BEFORE UPDATE ON public.pagamentos
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- RLS: users can only see their own payments
ALTER TABLE public.pagamentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own payments"
    ON public.pagamentos FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());

CREATE POLICY "Users can insert own payments"
    ON public.pagamentos FOR INSERT
    TO authenticated
    WITH CHECK (user_id = auth.uid());

-- Service role can do everything (for edge functions)
CREATE POLICY "Service role full access"
    ON public.pagamentos FOR ALL
    TO service_role
    USING (true);

-- Index for fast webhook lookup
CREATE INDEX IF NOT EXISTS pagamentos_anuncio_idx ON public.pagamentos(anuncio_id);
CREATE INDEX IF NOT EXISTS pagamentos_user_idx    ON public.pagamentos(user_id);
CREATE INDEX IF NOT EXISTS pagamentos_mp_idx      ON public.pagamentos(mp_payment_id);
