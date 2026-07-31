-- =====================================================================
-- MIGRATION: ordenes_fecha_compromiso
-- Guarda la fecha de compromiso de armado de una orden cuando el
-- calendario del armador NO la trae (la edita el usuario en la web).
--
-- Idempotente. Consistente con el módulo de producción (RLS off, grants
-- a anon/authenticated, updated_at automático).
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS public.ordenes_fecha_compromiso (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  orden       TEXT NOT NULL UNIQUE,
  fecha       DATE NOT NULL,
  created_by  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ordenes_compromiso_orden
  ON public.ordenes_fecha_compromiso (orden);

-- updated_at automático (la función ya existe desde el módulo de producción;
-- se re-declara por idempotencia/seguridad).
CREATE OR REPLACE FUNCTION public.fn_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_ordenes_compromiso_updated ON public.ordenes_fecha_compromiso;
CREATE TRIGGER trg_ordenes_compromiso_updated
  BEFORE UPDATE ON public.ordenes_fecha_compromiso
  FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();

ALTER TABLE public.ordenes_fecha_compromiso DISABLE ROW LEVEL SECURITY;

GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
