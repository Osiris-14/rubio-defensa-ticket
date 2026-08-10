-- =============================================================
-- Migration: cobros_produccion
--
-- Registro append-only de cada pieza confirmada en Producción, con
-- su precio de tarifario. Es la fuente de verdad para el dashboard
-- "Cobros por puesto": acumula lo confirmado para que el dueño vea
-- cuánto ganó cada armador por semana/mes.
--
-- Se inserta una fila por pieza al hacer clic en "Confirmar salida"
-- (o "Dar de Alta" en Fabricación). Si la pieza no casó con el
-- tarifario, se inserta igual con monto = NULL y
-- columna_tarifa = 'sin_clasificar' — nunca se bloquea la confirmación
-- por falta de precio.
-- =============================================================

CREATE TABLE IF NOT EXISTS public.cobros_produccion (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  numero_orden     TEXT        NOT NULL,
  pieza_calendario TEXT,
  pieza_tarifario  TEXT,
  puesto           TEXT,
  -- columna_tarifa values: 'fab_me_lo_doblaron' | 'fabri_lo_doble_yo' | 'sin_clasificar'
  columna_tarifa   TEXT,
  monto            NUMERIC(12,2),
  confirmado_en    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  user_id          TEXT,
  factura          TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.cobros_produccion DISABLE ROW LEVEL SECURITY;
ALTER PUBLICATION supabase_realtime ADD TABLE public.cobros_produccion;

CREATE INDEX IF NOT EXISTS idx_cobros_produccion_orden      ON public.cobros_produccion (numero_orden);
CREATE INDEX IF NOT EXISTS idx_cobros_produccion_puesto_ts  ON public.cobros_produccion (puesto, confirmado_en DESC);
CREATE INDEX IF NOT EXISTS idx_cobros_produccion_ts         ON public.cobros_produccion (confirmado_en DESC);

GRANT ALL ON public.cobros_produccion TO anon, authenticated;
