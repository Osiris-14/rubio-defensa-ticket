-- =============================================================
-- Migration: orden_movimientos + puesto_capacidad
-- Sprint 1: Centro de Control de Producción
-- =============================================================

-- ──────────────────────────────────────────────────────────
-- 1. orden_movimientos — immutable append-only movement log
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.orden_movimientos (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  numero_orden      TEXT        NOT NULL,
  calendar_event_id TEXT,
  calendar_name     TEXT,
  pieza             TEXT,
  vehiculo          TEXT,
  cliente           TEXT,
  desde_puesto      TEXT,
  hacia_puesto      TEXT        NOT NULL,
  tipo              TEXT        NOT NULL DEFAULT 'movimiento',
  -- tipo values: 'ENTRADA' | 'CAMBIO_PUESTO' | 'SALIDA' | 'ESTANCADA'
  detalle           TEXT,
  dias_estancada    INTEGER     NOT NULL DEFAULT 0,
  confirmada        BOOLEAN     NOT NULL DEFAULT false,
  ocurrido_en       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.orden_movimientos DISABLE ROW LEVEL SECURITY;
ALTER PUBLICATION supabase_realtime ADD TABLE public.orden_movimientos;

CREATE INDEX IF NOT EXISTS idx_om_orden_ts   ON public.orden_movimientos (numero_orden, ocurrido_en DESC);
CREATE INDEX IF NOT EXISTS idx_om_ts         ON public.orden_movimientos (ocurrido_en DESC);
CREATE INDEX IF NOT EXISTS idx_om_hacia      ON public.orden_movimientos (hacia_puesto, ocurrido_en DESC);

-- ──────────────────────────────────────────────────────────
-- 2. puesto_capacidad — editable per-puesto daily limits
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.puesto_capacidad (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  puesto         TEXT        UNIQUE NOT NULL,
  limite_diario  INT,        -- NULL = not yet defined by owner
  activo         BOOLEAN     NOT NULL DEFAULT true,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.puesto_capacidad DISABLE ROW LEVEL SECURITY;
ALTER PUBLICATION supabase_realtime ADD TABLE public.puesto_capacidad;

-- ──────────────────────────────────────────────────────────
-- 3. Seeds — exact calendario string values from CSV (4 distinct)
--    Note: 'EVENNOT  PUESTO 4  5PM-9PM' keeps the double spaces
--    that appear in the CSV column. límite_diario = NULL — owner
--    will set real values later.
-- ──────────────────────────────────────────────────────────
INSERT INTO public.puesto_capacidad (puesto, limite_diario) VALUES
  ('PUESTO 2 ARMADOR',         NULL),
  ('EVENNOT  PUESTO 4  5PM-9PM', NULL),
  ('PUESTO 4 DE 8AM 4PM',      NULL),
  ('puesto 5 oscar',           NULL)
ON CONFLICT (puesto) DO NOTHING;
