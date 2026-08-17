-- =====================================================================
-- Pipeline de Producción v4 — 6 tabs: Órdenes → Corte → Fabricación →
-- Soldadura → Pulido → Órdenes Completadas.
--
-- Cada pieza deja rastro histórico: se inserta una fila nueva al pasar
-- de Fabricación a Soldadura y de Soldadura a Pulido; solo la
-- transición final (Pulido → Completada) es un UPDATE en la misma fila.
-- =====================================================================

DELETE FROM production_tickets;

-- El CHECK viejo de 'estado' (de la migración anterior,
-- 20260816000000) solo permitía 'pendiente'/'completado'. El pipeline
-- nuevo necesita 'en_proceso' (orden enviada a Corte, aún sin
-- confirmar) — hay que soltarlo y reemplazarlo o los inserts con
-- 'en_proceso' fallarían por violar el CHECK constraint.
ALTER TABLE production_tickets
  DROP CONSTRAINT IF EXISTS production_tickets_estado_check;

ALTER TABLE production_tickets
  ADD COLUMN IF NOT EXISTS doblo_david BOOLEAN,
  ADD COLUMN IF NOT EXISTS etapa TEXT CHECK (etapa IN ('corte','fabricacion','soldadura','pulido','completada')),
  ADD COLUMN IF NOT EXISTS alegra_id TEXT,
  ADD COLUMN IF NOT EXISTS estado TEXT DEFAULT 'pendiente';

ALTER TABLE production_tickets
  ADD CONSTRAINT production_tickets_estado_check
  CHECK (estado IN ('pendiente','en_proceso','completado'));

CREATE INDEX IF NOT EXISTS idx_prod_tickets_etapa
  ON production_tickets (etapa);
