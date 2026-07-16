-- =====================================================
-- Add missing columns to tickets_produccion
-- The form captures more data than the base schema has.
-- Run once in Supabase SQL Editor.
-- =====================================================

ALTER TABLE public.tickets_produccion
  ADD COLUMN IF NOT EXISTS tipo_modelo      TEXT,
  ADD COLUMN IF NOT EXISTS grado_reparacion TEXT,
  ADD COLUMN IF NOT EXISTS piezas_custom    TEXT,
  ADD COLUMN IF NOT EXISTS notas            TEXT,
  ADD COLUMN IF NOT EXISTS ordenes          TEXT[] DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_produccion_factura
  ON public.tickets_produccion(numero_factura);
