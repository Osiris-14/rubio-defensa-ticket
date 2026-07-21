-- =====================================================================
-- MIGRATION: Planificador de Producción
--   - Capacidades diarias por área y por empleado (configurables)
--   - Fecha programada de fabricación en production_tickets
--   - Historial de cambios de programación (auditable, nunca se borra)
--   - Empleado asignado por etapa al momento de crear el ticket
--   - Vistas: ocupación diaria por área, por empleado, capacidad dashboard
--   - RPCs: set_area_capacity, set_employee_capacity,
--           set_ticket_schedule, move_ticket_schedule, assign_step_employee
--
-- Idempotente. No rompe nada existente.
-- Requiere: 20260720000000_production_module.sql ya ejecutada.
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================================
-- 1) Capacidades por área
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.production_area_capacities (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  step            TEXT NOT NULL UNIQUE
                    CHECK (step IN ('fabricacion','soldadura','ferre','pintura','decoracion')),
  daily_capacity  INTEGER NOT NULL DEFAULT 10 CHECK (daily_capacity > 0),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by      TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_area_cap_step
  ON public.production_area_capacities (step);

-- Seed con las capacidades del prompt
INSERT INTO public.production_area_capacities (step, daily_capacity)
VALUES
  ('fabricacion', 10),
  ('soldadura',   15),
  ('ferre',       12),
  ('pintura',     20),
  ('decoracion',  15)
ON CONFLICT (step) DO NOTHING;

-- =====================================================================
-- 2) Capacidades por empleado (por etapa, configurable)
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.production_employee_capacities (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id     UUID NOT NULL REFERENCES public.production_employees(id) ON DELETE CASCADE,
  step            TEXT NOT NULL
                    CHECK (step IN ('fabricacion','soldadura','ferre','pintura','decoracion')),
  daily_capacity  INTEGER NOT NULL DEFAULT 5 CHECK (daily_capacity >= 0),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by      TEXT,
  UNIQUE (employee_id, step)
);

CREATE INDEX IF NOT EXISTS idx_emp_cap_employee
  ON public.production_employee_capacities (employee_id);

-- =====================================================================
-- 3) Fecha programada de fabricación + empleado asignado por etapa
--    en production_tickets.
--    fecha_programada representa el INICIO de la producción (fabricación +
--    doblado). Las demás etapas registran su fecha real al confirmarse
--    (ya viven en production_ticket_steps.completed_at).
-- =====================================================================
ALTER TABLE public.production_tickets
  ADD COLUMN IF NOT EXISTS fecha_programada DATE;

ALTER TABLE public.production_tickets
  ADD COLUMN IF NOT EXISTS prioridad TEXT DEFAULT 'normal'
    CHECK (prioridad IN ('baja','normal','alta','critica'));

ALTER TABLE public.production_tickets
  ADD COLUMN IF NOT EXISTS fabricador_id UUID REFERENCES public.production_employees(id) ON DELETE SET NULL;

ALTER TABLE public.production_tickets
  ADD COLUMN IF NOT EXISTS fabricador_name TEXT;

CREATE INDEX IF NOT EXISTS idx_prod_tickets_fecha_prog
  ON public.production_tickets (fecha_programada);
CREATE INDEX IF NOT EXISTS idx_prod_tickets_fabricador
  ON public.production_tickets (fabricador_id);

-- =====================================================================
-- 4) Historial de cambios de programación (auditable, nunca se borra)
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.production_schedule_audit (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ticket_id       UUID NOT NULL REFERENCES public.production_tickets(id) ON DELETE CASCADE,
  field           TEXT NOT NULL,
  old_value       TEXT,
  new_value       TEXT,
  changed_by      TEXT,
  reason          TEXT,
  changed_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sched_audit_ticket
  ON public.production_schedule_audit (ticket_id);
CREATE INDEX IF NOT EXISTS idx_sched_audit_changed
  ON public.production_schedule_audit (changed_at DESC);

-- =====================================================================
-- 5) updated_at automático para tablas de capacidad
-- =====================================================================
DROP TRIGGER IF EXISTS trg_area_cap_updated ON public.production_area_capacities;
CREATE TRIGGER trg_area_cap_updated
  BEFORE UPDATE ON public.production_area_capacities
  FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();

DROP TRIGGER IF EXISTS trg_emp_cap_updated ON public.production_employee_capacities;
CREATE TRIGGER trg_emp_cap_updated
  BEFORE UPDATE ON public.production_employee_capacities
  FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();

-- =====================================================================
-- 6) RLS off + grants (igual que las demás tablas del módulo)
-- =====================================================================
ALTER TABLE public.production_area_capacities       DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.production_employee_capacities   DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.production_schedule_audit        DISABLE ROW LEVEL SECURITY;

GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;

-- =====================================================================
-- 7) Vistas
-- =====================================================================

-- 7.1  Ocupación diaria por área: para cada (fecha, step) cuenta
--      cuántos tickets tienen fecha_programada = fecha Y aún no han
--      completado esa etapa. Capacidad viene de production_area_capacities.
--      Nota: solo la etapa 'fabricacion' usa fecha_programada para planificar;
--      las demás etapas solo cuentan trabajo REAL (completed_at) por día
--      para fines de carga histórica del dashboard.
CREATE OR REPLACE VIEW public.vw_area_daily_load AS
SELECT
  fechas.fecha                                       AS fecha,
  s.step                                             AS step,
  -- Para fabricación: tickets programados ese día sin completar
  -- Para otras etapas: pasos completados ese día
  CASE
    WHEN s.step = 'fabricacion' THEN
      COUNT(*) FILTER (
        WHERE t.fecha_programada = fechas.fecha
          AND t.status = 'pendiente'
          AND NOT EXISTS (
            SELECT 1 FROM public.production_ticket_steps st
            WHERE st.ticket_id = t.id AND st.step = 'fabricacion' AND st.completed_at IS NOT NULL
          )
      )
    ELSE
      COUNT(st.id) FILTER (WHERE st.step = s.step AND DATE(st.completed_at) = fechas.fecha)
  END                                                AS tickets_count,
  COALESCE(c.daily_capacity, 10)                     AS daily_capacity
FROM (SELECT DISTINCT fecha_programada AS fecha FROM public.production_tickets
      WHERE fecha_programada IS NOT NULL
      UNION SELECT DISTINCT DATE(completed_at) AS fecha FROM public.production_ticket_steps
      WHERE completed_at IS NOT NULL) fechas
CROSS JOIN (VALUES ('fabricacion'),('soldadura'),('ferre'),('pintura'),('decoracion')) AS s(step)
LEFT JOIN public.production_area_capacities c ON c.step = s.step
LEFT JOIN public.production_tickets t
  ON t.fecha_programada = fechas.fecha AND t.status = 'pendiente'
LEFT JOIN public.production_ticket_steps st
  ON DATE(st.completed_at) = fechas.fecha AND st.step = s.step
GROUP BY fechas.fecha, s.step, c.daily_capacity;

-- 7.2  Ocupación diaria por empleado × etapa: cuenta los steps confirmados
--      ese día para ese empleado (trabajo real) y los tickets programados
--      para ese empleado ese día (carga planificada de fabricación).
CREATE OR REPLACE VIEW public.vw_employee_daily_load AS
SELECT
  d.fecha                                            AS fecha,
  e.id                                               AS employee_id,
  e.name                                             AS employee_name,
  s.step                                             AS step,
  -- Trabajo ya realizado ese día por el empleado en esa etapa
  COUNT(st.id)                                       AS done_count,
  -- Tickets de fabricación programados para ese empleado ese día
  COUNT(t.id) FILTER (WHERE s.step = 'fabricacion')  AS scheduled_count,
  COALESCE(ec.daily_capacity, 5)                     AS daily_capacity
FROM public.production_employees e
CROSS JOIN (SELECT DISTINCT fecha_programada AS fecha FROM public.production_tickets
            WHERE fecha_programada IS NOT NULL) d
CROSS JOIN (VALUES ('fabricacion'),('soldadura'),('ferre'),('pintura'),('decoracion')) AS s(step)
LEFT JOIN public.production_ticket_steps st
  ON st.employee_id = e.id
  AND st.step = s.step
  AND DATE(st.completed_at) = d.fecha
LEFT JOIN public.production_tickets t
  ON t.fabricador_id = e.id
  AND t.fecha_programada = d.fecha
  AND t.status = 'pendiente'
  AND s.step = 'fabricacion'
LEFT JOIN public.production_employee_capacities ec
  ON ec.employee_id = e.id AND ec.step = s.step
GROUP BY d.fecha, e.id, e.name, s.step, ec.daily_capacity;

-- 7.3  Dashboard de capacidad (una fila con KPIs del día / semana / mes)
CREATE OR REPLACE VIEW public.vw_capacity_dashboard AS
SELECT
  -- Capacidad utilizada hoy (tickets programados hoy / capacidad total fabricación)
  COUNT(*) FILTER (WHERE t.fecha_programada = CURRENT_DATE
                    AND t.status = 'pendiente')                              AS tickets_hoy,
  (SELECT COALESCE(SUM(daily_capacity),0) FROM public.production_area_capacities
    WHERE step = 'fabricacion')                                              AS cap_hoy,
  COUNT(*) FILTER (WHERE t.fecha_programada >= date_trunc('week', CURRENT_DATE)::date
                    AND t.fecha_programada <  date_trunc('week', CURRENT_DATE + INTERVAL '7 days')::date
                    AND t.status = 'pendiente')                              AS tickets_semana,
  COUNT(*) FILTER (WHERE t.fecha_programada >= date_trunc('month', CURRENT_DATE)::date
                    AND t.fecha_programada <  date_trunc('month', CURRENT_DATE + INTERVAL '1 month')::date
                    AND t.status = 'pendiente')                              AS tickets_mes,
  -- Tickets retrasados: fecha_programada < hoy y sigue pendiente
  COUNT(*) FILTER (WHERE t.fecha_programada < CURRENT_DATE
                    AND t.status = 'pendiente')                              AS retrasados,
  -- Próximos a iniciar: programados entre hoy y dentro de 3 días
  COUNT(*) FILTER (WHERE t.fecha_programada >= CURRENT_DATE
                    AND t.fecha_programada <= CURRENT_DATE + INTERVAL '3 days'
                    AND t.status = 'pendiente')                              AS proximos,
  -- Vencidos: programados en el pasado y no completados
  COUNT(*) FILTER (WHERE t.fecha_programada < CURRENT_DATE
                    AND t.status = 'pendiente')                              AS vencidos
FROM public.production_tickets t;

-- 7.4  Auditoría legible (join con ticket)
CREATE OR REPLACE VIEW public.vw_schedule_audit AS
SELECT
  a.id,
  a.ticket_id,
  t.orden,
  t.vehiculo,
  a.field,
  a.old_value,
  a.new_value,
  a.changed_by,
  a.reason,
  a.changed_at
FROM public.production_schedule_audit a
LEFT JOIN public.production_tickets t ON t.id = a.ticket_id
ORDER BY a.changed_at DESC;

GRANT SELECT ON public.vw_area_daily_load        TO anon, authenticated;
GRANT SELECT ON public.vw_employee_daily_load    TO anon, authenticated;
GRANT SELECT ON public.vw_capacity_dashboard     TO anon, authenticated;
GRANT SELECT ON public.vw_schedule_audit         TO anon, authenticated;

-- =====================================================================
-- 8) RPCs
-- =====================================================================

-- 8.1  set_area_capacity: upsert capacidad diaria de un área
CREATE OR REPLACE FUNCTION public.set_area_capacity(
  p_step            TEXT,
  p_daily_capacity  INTEGER,
  p_updated_by      TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_daily_capacity <= 0 THEN
    RAISE EXCEPTION 'La capacidad diaria debe ser mayor a 0';
  END IF;
  INSERT INTO public.production_area_capacities (step, daily_capacity, updated_by)
  VALUES (p_step, p_daily_capacity, p_updated_by)
  ON CONFLICT (step) DO UPDATE
    SET daily_capacity = EXCLUDED.daily_capacity,
        updated_by     = EXCLUDED.updated_by,
        updated_at     = NOW();
END;
$$;

-- 8.2  set_employee_capacity: upsert capacidad diaria de un empleado por etapa
CREATE OR REPLACE FUNCTION public.set_employee_capacity(
  p_employee_id     UUID,
  p_step            TEXT,
  p_daily_capacity  INTEGER,
  p_updated_by      TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_daily_capacity < 0 THEN
    RAISE EXCEPTION 'La capacidad diaria no puede ser negativa';
  END IF;
  INSERT INTO public.production_employee_capacities (employee_id, step, daily_capacity, updated_by)
  VALUES (p_employee_id, p_step, p_daily_capacity, p_updated_by)
  ON CONFLICT (employee_id, step) DO UPDATE
    SET daily_capacity = EXCLUDED.daily_capacity,
        updated_by     = EXCLUDED.updated_by,
        updated_at     = NOW();
END;
$$;

-- 8.3  set_ticket_schedule: fija fecha programada + fabricador al crear ticket
CREATE OR REPLACE FUNCTION public.set_ticket_schedule(
  p_ticket_id        UUID,
  p_fecha_programada DATE,
  p_fabricador_id    UUID DEFAULT NULL,
  p_fabricador_name  TEXT DEFAULT NULL,
  p_prioridad        TEXT DEFAULT 'normal',
  p_changed_by       TEXT DEFAULT NULL,
  p_reason           TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old_fecha DATE;
  v_old_fab_id UUID;
  v_old_fab_name TEXT;
BEGIN
  SELECT fecha_programada, fabricador_id, fabricador_name
    INTO v_old_fecha, v_old_fab_id, v_old_fab_name
  FROM public.production_tickets WHERE id = p_ticket_id;

  UPDATE public.production_tickets
    SET fecha_programada = p_fecha_programada,
        fabricador_id    = p_fabricador_id,
        fabricador_name  = p_fabricador_name,
        prioridad        = p_prioridad
    WHERE id = p_ticket_id;

  -- Auditoría solo si cambió la fecha
  IF v_old_fecha IS DISTINCT FROM p_fecha_programada THEN
    INSERT INTO public.production_schedule_audit (ticket_id, field, old_value, new_value, changed_by, reason)
    VALUES (p_ticket_id, 'fecha_programada',
            v_old_fecha::TEXT, p_fecha_programada::TEXT, p_changed_by, p_reason);
  END IF;

  IF v_old_fab_id IS DISTINCT FROM p_fabricador_id THEN
    INSERT INTO public.production_schedule_audit (ticket_id, field, old_value, new_value, changed_by, reason)
    VALUES (p_ticket_id, 'fabricador',
            v_old_fab_name, p_fabricador_name, p_changed_by, p_reason);
  END IF;
END;
$$;

-- 8.4  move_ticket_schedule: drag & drop. Cambia la fecha programada
--      (y opcionalmente el fabricador) y registra auditoría.
CREATE OR REPLACE FUNCTION public.move_ticket_schedule(
  p_ticket_id        UUID,
  p_new_fecha        DATE,
  p_new_fabricador_id UUID DEFAULT NULL,
  p_new_fabricador_name TEXT DEFAULT NULL,
  p_changed_by       TEXT DEFAULT NULL,
  p_reason           TEXT DEFAULT NULL
)
RETURNS TABLE(
  ticket_id UUID,
  old_fecha TEXT,
  new_fecha TEXT,
  fabricador_name TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old_fecha DATE;
  v_old_fab_name TEXT;
  v_status TEXT;
BEGIN
  SELECT fecha_programada, fabricador_name, status
    INTO v_old_fecha, v_old_fab_name, v_status
  FROM public.production_tickets WHERE id = p_ticket_id;

  IF v_status IS NULL THEN
    RAISE EXCEPTION 'Ticket no encontrado';
  END IF;
  IF v_status = 'completado' THEN
    RAISE EXCEPTION 'No se puede reprogramar un ticket completado';
  END IF;

  UPDATE public.production_tickets
    SET fecha_programada = p_new_fecha,
        fabricador_id    = COALESCE(p_new_fabricador_id, fabricador_id),
        fabricador_name  = COALESCE(p_new_fabricador_name, fabricador_name)
    WHERE id = p_ticket_id;

  -- Auditoría de cambio de fecha
  IF v_old_fecha IS DISTINCT FROM p_new_fecha THEN
    INSERT INTO public.production_schedule_audit (ticket_id, field, old_value, new_value, changed_by, reason)
    VALUES (p_ticket_id, 'fecha_programada',
            v_old_fecha::TEXT, p_new_fecha::TEXT, p_changed_by, p_reason);
  END IF;

  -- Auditoría de cambio de fabricador
  IF p_new_fabricador_id IS NOT NULL AND v_old_fab_name IS DISTINCT FROM p_new_fabricador_name THEN
    INSERT INTO public.production_schedule_audit (ticket_id, field, old_value, new_value, changed_by, reason)
    VALUES (p_ticket_id, 'fabricador',
            v_old_fab_name, p_new_fabricador_name, p_changed_by, p_reason);
  END IF;

  RETURN QUERY SELECT p_ticket_id, v_old_fecha::TEXT, p_new_fecha::TEXT, COALESCE(p_new_fabricador_name, v_old_fab_name);
END;
$$;

-- 8.5  assign_step_employee: reasigna el empleado de una etapa ya confirmada.
--      Útil para el drag & drop entre empleados en el calendario.
CREATE OR REPLACE FUNCTION public.assign_step_employee(
  p_step_id      UUID,
  p_employee_id  UUID,
  p_employee_name TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old_name TEXT;
  v_ticket_id UUID;
  v_piece TEXT;
  v_step TEXT;
BEGIN
  SELECT employee_name, ticket_id, piece_name, step
    INTO v_old_name, v_ticket_id, v_piece, v_step
  FROM public.production_ticket_steps WHERE id = p_step_id;

  IF v_ticket_id IS NULL THEN
    RAISE EXCEPTION 'Etapa no encontrada';
  END IF;

  UPDATE public.production_ticket_steps
    SET employee_id = p_employee_id, employee_name = p_employee_name
    WHERE id = p_step_id;

  INSERT INTO public.production_schedule_audit (ticket_id, field, old_value, new_value, changed_by, reason)
  VALUES (v_ticket_id, 'empleado_' || v_step || '_' || v_piece,
          v_old_name, p_employee_name, NULL, 'Reasignación desde calendario');
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_area_capacity(TEXT,INTEGER,TEXT)            TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_employee_capacity(UUID,TEXT,INTEGER,TEXT)   TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_ticket_schedule(UUID,DATE,UUID,TEXT,TEXT,TEXT,TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.move_ticket_schedule(UUID,DATE,UUID,TEXT,TEXT,TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.assign_step_employee(UUID,UUID,TEXT)            TO anon, authenticated;

-- =====================================================================
-- FIN
-- =====================================================================
