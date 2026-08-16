-- =====================================================================
-- Rediseño de Producción v3 — flujo de tickets por pieza (sin
-- calendarios, sin pasarela, sin precios).
--
-- IMPORTANTE: esto borra los datos de prueba de production_tickets y
-- cobros_produccion antes de reestructurar. Las columnas viejas de
-- production_tickets (status, orden, vehiculo, etapa_actual, corte_*,
-- doblado_*, fecha_programada, fabricador_*, prioridad, tipo_trabajo,
-- etc.) y las demás tablas del sistema anterior (personal_pasarela,
-- production_ticket_pasarela, production_ticket_pieces,
-- production_ticket_steps, production_payroll_runs,
-- production_payroll_details) se dejan intactas en la base de datos —
-- solo se dejan de usar desde la interfaz. No se borran ni se tocan.
-- =====================================================================

DELETE FROM public.production_tickets;

-- cobros_produccion no existe en todos los entornos (depende de si esa
-- migración vieja llegó a correr) — se borra solo si existe.
DO $$
BEGIN
  IF to_regclass('public.cobros_produccion') IS NOT NULL THEN
    EXECUTE 'DELETE FROM public.cobros_produccion';
  END IF;
END $$;

-- El modelo viejo tenía alegra_id TEXT UNIQUE (un ticket por orden). El
-- nuevo modelo inserta una fila por PIEZA, así que varias filas
-- comparten el mismo alegra_id/numero_orden — hay que soltar esa
-- restricción o los inserts de la segunda pieza en adelante fallarían.
ALTER TABLE public.production_tickets
  DROP CONSTRAINT IF EXISTS production_tickets_alegra_id_key;

ALTER TABLE public.production_tickets
  ADD COLUMN IF NOT EXISTS numero_orden TEXT,
  ADD COLUMN IF NOT EXISTS pieza TEXT,
  ADD COLUMN IF NOT EXISTS responsable TEXT,
  ADD COLUMN IF NOT EXISTS estado TEXT DEFAULT 'pendiente'
    CHECK (estado IN ('pendiente','completado')),
  ADD COLUMN IF NOT EXISTS completado_en TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS user_id TEXT,
  ADD COLUMN IF NOT EXISTS user_name TEXT;

CREATE INDEX IF NOT EXISTS idx_prod_tickets_v3_estado
  ON public.production_tickets (estado);
CREATE INDEX IF NOT EXISTS idx_prod_tickets_v3_orden
  ON public.production_tickets (numero_orden);
CREATE INDEX IF NOT EXISTS idx_prod_tickets_v3_responsable
  ON public.production_tickets (responsable);
CREATE INDEX IF NOT EXISTS idx_prod_tickets_v3_alegra
  ON public.production_tickets (alegra_id);
