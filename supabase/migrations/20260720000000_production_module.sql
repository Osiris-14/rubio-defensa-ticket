-- =====================================================================
-- MIGRATION: Módulo de Producción Rediseñado + Pagos + Nóminas
-- El Rubio Defensa Ticket
--
-- Idempotente: se puede ejecutar cuantas veces se quiera.
-- No toca las tablas legacy (tickets_*, silver.*) existentes.
--
-- Tablas nuevas:
--   public.production_price_catalog      (tarifario desde CSV)
--   public.production_employees          (empleados de producción)
--   public.production_tickets            (tickets de producción)
--   public.production_ticket_pieces      (piezas x ticket con cantidad)
--   public.production_ticket_steps       (historial auditable por etapa)
--   public.production_payroll_runs       (cabecera de nómina)
--   public.production_payroll_details    (detalle de nómina por empleado)
--
-- Vistas:
--   public.vw_employee_production_totals
--   public.vw_employee_pending_payments
--   public.vw_production_kpis
--
-- RPCs:
--   public.import_price_catalog(json)
--   public.create_production_ticket(...)
--   public.confirm_production_step(...)
--   public.close_production_ticket(uuid)
--   public.create_payroll_run(...)
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================================
-- 1) CATÁLOGO DE PRECIOS (tarifario)
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.production_price_catalog (
  id                              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  piece_name                       TEXT NOT NULL UNIQUE,
  ferre_price                      NUMERIC(12,2) NOT NULL DEFAULT 0,
  paint_price                      NUMERIC(12,2) NOT NULL DEFAULT 0,
  decoration_price                 NUMERIC(12,2) NOT NULL DEFAULT 0,
  fabrication_price_other_bent     NUMERIC(12,2) NOT NULL DEFAULT 0,
  fabrication_price_self_bent      NUMERIC(12,2) NOT NULL DEFAULT 0,
  welding_price                    NUMERIC(12,2) NOT NULL DEFAULT 0,
  active                           BOOLEAN NOT NULL DEFAULT TRUE,
  created_at                       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_price_catalog_piece
  ON public.production_price_catalog (piece_name);
CREATE INDEX IF NOT EXISTS idx_price_catalog_active
  ON public.production_price_catalog (active);

-- updated_at automático
DROP TRIGGER IF EXISTS trg_price_catalog_updated ON public.production_price_catalog;
CREATE OR REPLACE FUNCTION public.fn_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_price_catalog_updated ON public.production_price_catalog;
CREATE TRIGGER trg_price_catalog_updated
  BEFORE UPDATE ON public.production_price_catalog
  FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();

-- =====================================================================
-- 2) EMPLEADOS DE PRODUCCIÓN
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.production_employees (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        TEXT NOT NULL,
  active      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_employees_name
  ON public.production_employees (LOWER(name));
CREATE INDEX IF NOT EXISTS idx_employees_active
  ON public.production_employees (active);

-- =====================================================================
-- 3) TICKETS DE PRODUCCIÓN
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.production_tickets (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  alegra_id     TEXT UNIQUE,
  factura       TEXT,
  orden         TEXT,
  cliente       TEXT,
  vehiculo      TEXT,
  status        TEXT NOT NULL DEFAULT 'pendiente'
                  CHECK (status IN ('pendiente','completado')),
  total_cost    NUMERIC(14,2) NOT NULL DEFAULT 0,
  created_by    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at  TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_prod_tickets_status
  ON public.production_tickets (status);
CREATE INDEX IF NOT EXISTS idx_prod_tickets_created
  ON public.production_tickets (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_prod_tickets_completed
  ON public.production_tickets (completed_at DESC);

-- =====================================================================
-- 4) NÓMINAS — cabecera
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.production_payroll_runs (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  period_type   TEXT NOT NULL CHECK (period_type IN ('semanal','quincenal','mensual')),
  period_start  DATE NOT NULL,
  period_end    DATE NOT NULL,
  total_amount  NUMERIC(14,2) NOT NULL DEFAULT 0,
  status        TEXT NOT NULL DEFAULT 'emitida'
                  CHECK (status IN ('emitida','pagada','anulada')),
  created_by    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payroll_runs_period
  ON public.production_payroll_runs (period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_payroll_runs_created
  ON public.production_payroll_runs (created_at DESC);

-- =====================================================================
-- 5) PIEZAS POR TICKET
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.production_ticket_pieces (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ticket_id   UUID NOT NULL REFERENCES public.production_tickets(id) ON DELETE CASCADE,
  piece_name  TEXT NOT NULL,
  quantity    INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (ticket_id, piece_name)
);

CREATE INDEX IF NOT EXISTS idx_ticket_pieces_ticket
  ON public.production_ticket_pieces (ticket_id);

-- =====================================================================
-- 6) HISTORIAL DE ETAPAS (auditable, nunca se sobrescribe)
--    Campos del prompt + doblador (para la etapa de Fabricación) +
--    payroll_run_id para marcar movimientos ya pagados.
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.production_ticket_steps (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ticket_id       UUID NOT NULL REFERENCES public.production_tickets(id) ON DELETE CASCADE,
  piece_name      TEXT NOT NULL,
  step            TEXT NOT NULL CHECK (step IN ('fabricacion','soldadura','ferre','pintura','decoracion')),
  employee_id     UUID REFERENCES public.production_employees(id) ON DELETE SET NULL,
  employee_name   TEXT,
  doblador_id     UUID REFERENCES public.production_employees(id) ON DELETE SET NULL,
  doblador_name   TEXT,
  price           NUMERIC(12,2) NOT NULL DEFAULT 0,
  started_at      TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  payroll_run_id  UUID REFERENCES public.production_payroll_runs(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (ticket_id, piece_name, step)
);

CREATE INDEX IF NOT EXISTS idx_ticket_steps_ticket
  ON public.production_ticket_steps (ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_steps_employee
  ON public.production_ticket_steps (employee_id);
CREATE INDEX IF NOT EXISTS idx_ticket_steps_step
  ON public.production_ticket_steps (step);
CREATE INDEX IF NOT EXISTS idx_ticket_steps_payroll
  ON public.production_ticket_steps (payroll_run_id);
CREATE INDEX IF NOT EXISTS idx_ticket_steps_created
  ON public.production_ticket_steps (created_at DESC);

-- =====================================================================
-- 7) NÓMINAS — detalle
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.production_payroll_details (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  run_id        UUID NOT NULL REFERENCES public.production_payroll_runs(id) ON DELETE CASCADE,
  employee_id   UUID REFERENCES public.production_employees(id) ON DELETE SET NULL,
  employee_name TEXT,
  step          TEXT,
  work_count    INTEGER NOT NULL DEFAULT 0,
  amount        NUMERIC(14,2) NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payroll_details_run
  ON public.production_payroll_details (run_id);
CREATE INDEX IF NOT EXISTS idx_payroll_details_employee
  ON public.production_payroll_details (employee_id);

-- =====================================================================
-- 8) RLS — deshabilitada (consistente con las tablas tickets_* legacy;
--    la app usa anon key sin auth context). Grant total a anon/authenticated.
-- =====================================================================
ALTER TABLE public.production_price_catalog     DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.production_employees          DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.production_tickets            DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.production_ticket_pieces      DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.production_ticket_steps       DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.production_payroll_runs       DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.production_payroll_details    DISABLE ROW LEVEL SECURITY;

GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;

-- =====================================================================
-- 9) VISTAS
-- =====================================================================

-- Empleado × Etapa: cantidad de trabajos + total ganado (histórico total)
CREATE OR REPLACE VIEW public.vw_employee_production_totals AS
SELECT
  e.id                                AS employee_id,
  e.name                              AS employee_name,
  s.step                              AS step,
  COUNT(*)                            AS work_count,
  COALESCE(SUM(s.price), 0)           AS total_earned
FROM public.production_ticket_steps s
JOIN public.production_employees e ON e.id = s.employee_id
GROUP BY e.id, e.name, s.step;

-- Empleado: trabajos pendientes de pago + monto pendiente
CREATE OR REPLACE VIEW public.vw_employee_pending_payments AS
SELECT
  e.id                                                       AS employee_id,
  e.name                                                     AS employee_name,
  COUNT(*) FILTER (WHERE s.payroll_run_id IS NULL)           AS pending_count,
  COALESCE(SUM(s.price) FILTER (WHERE s.payroll_run_id IS NULL), 0) AS pending_amount
FROM public.production_ticket_steps s
JOIN public.production_employees e ON e.id = s.employee_id
GROUP BY e.id, e.name;

-- KPIs de producción (una fila)
CREATE OR REPLACE VIEW public.vw_production_kpis AS
SELECT
  COUNT(*) FILTER (WHERE status = 'pendiente')                          AS tickets_pendientes,
  COUNT(*) FILTER (WHERE status = 'completado')                         AS tickets_completados,
  COALESCE(SUM(total_cost) FILTER (WHERE status = 'completado'
    AND completed_at >= date_trunc('day', NOW())), 0)                   AS costo_hoy,
  COALESCE(SUM(total_cost) FILTER (WHERE status = 'completado'
    AND completed_at >= date_trunc('week', NOW())), 0)                  AS costo_semana,
  COALESCE(SUM(total_cost) FILTER (WHERE status = 'completado'
    AND completed_at >= date_trunc('month', NOW())), 0)                 AS costo_mes
FROM public.production_tickets;

GRANT SELECT ON public.vw_employee_production_totals TO anon, authenticated;
GRANT SELECT ON public.vw_employee_pending_payments  TO anon, authenticated;
GRANT SELECT ON public.vw_production_kpis            TO anon, authenticated;

-- =====================================================================
-- 10) RPCs
-- =====================================================================

-- 10.1  import_price_catalog: upsert desde filas JSON (las trae el importador)
CREATE OR REPLACE FUNCTION public.import_price_catalog(p_rows JSON)
RETURNS TABLE(inserted INT, updated INT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r JSON;
  v_inserted INT := 0;
  v_updated  INT := 0;
  v_was_inserted BOOLEAN;
BEGIN
  FOR r IN SELECT json_array_elements(p_rows)
  LOOP
    INSERT INTO public.production_price_catalog (
      piece_name, ferre_price, paint_price, decoration_price,
      fabrication_price_other_bent, fabrication_price_self_bent, welding_price, active
    )
    VALUES (
      r->>'piece_name',
      COALESCE((r->>'ferre_price')::NUMERIC, 0),
      COALESCE((r->>'paint_price')::NUMERIC, 0),
      COALESCE((r->>'decoration_price')::NUMERIC, 0),
      COALESCE((r->>'fabrication_price_other_bent')::NUMERIC, 0),
      COALESCE((r->>'fabrication_price_self_bent')::NUMERIC, 0),
      COALESCE((r->>'welding_price')::NUMERIC, 0),
      COALESCE((r->>'active')::BOOLEAN, TRUE)
    )
    ON CONFLICT (piece_name) DO UPDATE
      SET ferre_price                      = EXCLUDED.ferre_price,
          paint_price                      = EXCLUDED.paint_price,
          decoration_price                 = EXCLUDED.decoration_price,
          fabrication_price_other_bent     = EXCLUDED.fabrication_price_other_bent,
          fabrication_price_self_bent      = EXCLUDED.fabrication_price_self_bent,
          welding_price                    = EXCLUDED.welding_price,
          active                           = EXCLUDED.active,
          updated_at                       = NOW()
    RETURNING (xmax = 0) INTO v_was_inserted;

    IF v_was_inserted THEN
      v_inserted := v_inserted + 1;
    ELSE
      v_updated := v_updated + 1;
    END IF;
  END LOOP;
  RETURN QUERY SELECT v_inserted, v_updated;
END;
$$;

-- 10.2  create_production_ticket
--       Crea ticket + piezas. p_pieces: [{"piece_name","quantity"}]
CREATE OR REPLACE FUNCTION public.create_production_ticket(
  p_alegra_id    TEXT,
  p_factura      TEXT,
  p_orden        TEXT,
  p_cliente      TEXT,
  p_vehiculo     TEXT,
  p_pieces       JSON,
  p_created_by   TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ticket_id UUID;
  p JSON;
BEGIN
  IF p_alegra_id IS NOT NULL THEN
    SELECT id INTO v_ticket_id FROM public.production_tickets WHERE alegra_id = p_alegra_id;
    IF v_ticket_id IS NOT NULL THEN
      RAISE EXCEPTION 'Ya existe un ticket de producción para esta orden (alegra_id=%)', p_alegra_id;
    END IF;
  END IF;

  INSERT INTO public.production_tickets (alegra_id, factura, orden, cliente, vehiculo, created_by)
  VALUES (p_alegra_id, p_factura, p_orden, p_cliente, p_vehiculo, p_created_by)
  RETURNING id INTO v_ticket_id;

  FOR p IN SELECT json_array_elements(p_pieces)
  LOOP
    INSERT INTO public.production_ticket_pieces (ticket_id, piece_name, quantity)
    VALUES (v_ticket_id, p->>'piece_name', COALESCE((p->>'quantity')::INT, 1));
  END LOOP;

  RETURN v_ticket_id;
END;
$$;

-- 10.3  confirm_production_step
--       Inserta una fila en production_ticket_steps con el precio
--       tomado SIEMPRE del catálogo (nunca del cliente).
--       Para 'fabricacion' decide el precio según p_is_self_bent.
CREATE OR REPLACE FUNCTION public.confirm_production_step(
  p_ticket_id     UUID,
  p_piece_name    TEXT,
  p_step          TEXT,
  p_employee_id   UUID,
  p_employee_name TEXT,
  p_is_self_bent  BOOLEAN DEFAULT NULL,
  p_doblador_id   UUID DEFAULT NULL,
  p_doblador_name TEXT DEFAULT NULL
)
RETURNS TABLE(
  id UUID,
  price NUMERIC,
  step TEXT,
  piece_name TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_qty        INTEGER;
  v_unit_price NUMERIC(12,2);
  v_total      NUMERIC(12,2);
  v_exists     INT;
  v_status     TEXT;
  v_new_id     UUID;
BEGIN
  -- Validar que el ticket exista y esté pendiente
  SELECT status INTO v_status FROM public.production_tickets WHERE id = p_ticket_id;
  IF v_status IS NULL THEN
    RAISE EXCEPTION 'Ticket no encontrado';
  END IF;
  IF v_status <> 'pendiente' THEN
    RAISE EXCEPTION 'El ticket ya está completado, no se pueden agregar etapas';
  END IF;

  -- No sobrescribir: si ya existe la combinación, error
  SELECT 1 INTO v_exists FROM public.production_ticket_steps
    WHERE ticket_id = p_ticket_id AND piece_name = p_piece_name AND step = p_step;
  IF v_exists = 1 THEN
    RAISE EXCEPTION 'Esta etapa ya fue confirmada para esta pieza';
  END IF;

  -- Cantidad de la pieza en el ticket
  SELECT quantity INTO v_qty FROM public.production_ticket_pieces
    WHERE ticket_id = p_ticket_id AND piece_name = p_piece_name;
  IF v_qty IS NULL THEN
    RAISE EXCEPTION 'La pieza % no pertenece al ticket', p_piece_name;
  END IF;

  -- Precio unitario desde el catálogo
  IF p_step = 'fabricacion' THEN
    SELECT CASE
             WHEN COALESCE(p_is_self_bent, FALSE)
               THEN fabrication_price_self_bent
             ELSE fabrication_price_other_bent
           END
      INTO v_unit_price
      FROM public.production_price_catalog
      WHERE piece_name = p_piece_name AND active = TRUE;
  ELSIF p_step = 'soldadura' THEN
    SELECT welding_price    INTO v_unit_price
      FROM public.production_price_catalog WHERE piece_name = p_piece_name AND active = TRUE;
  ELSIF p_step = 'ferre' THEN
    SELECT ferre_price      INTO v_unit_price
      FROM public.production_price_catalog WHERE piece_name = p_piece_name AND active = TRUE;
  ELSIF p_step = 'pintura' THEN
    SELECT paint_price      INTO v_unit_price
      FROM public.production_price_catalog WHERE piece_name = p_piece_name AND active = TRUE;
  ELSIF p_step = 'decoracion' THEN
    SELECT decoration_price INTO v_unit_price
      FROM public.production_price_catalog WHERE piece_name = p_piece_name AND active = TRUE;
  END IF;

  IF v_unit_price IS NULL THEN
    RAISE EXCEPTION 'No hay precio en el catálogo para la pieza %', p_piece_name;
  END IF;

  v_total := v_unit_price * v_qty;

  INSERT INTO public.production_ticket_steps (
    ticket_id, piece_name, step, employee_id, employee_name,
    doblador_id, doblador_name, price, started_at, completed_at
  )
  VALUES (
    p_ticket_id, p_piece_name, p_step, p_employee_id, p_employee_name,
    p_doblador_id, p_doblador_name, v_total, NOW(), NOW()
  )
  RETURNING id INTO v_new_id;

  RETURN QUERY SELECT v_new_id, v_total, p_step, p_piece_name;
END;
$$;

-- 10.4  close_production_ticket
--       Valida que todas las piezas × las 5 etapas estén completas,
--       suma los precios desde production_ticket_steps y marca el
--       ticket como completado. Nunca recalcula manualmente.
CREATE OR REPLACE FUNCTION public.close_production_ticket(p_ticket_id UUID)
RETURNS TABLE(
  id UUID,
  total_cost NUMERIC,
  status TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status       TEXT;
  v_total        NUMERIC(14,2);
  v_missing      INT;
BEGIN
  SELECT t.status INTO v_status FROM public.production_tickets t WHERE t.id = p_ticket_id;
  IF v_status IS NULL THEN
    RAISE EXCEPTION 'Ticket no encontrado';
  END IF;
  IF v_status = 'completado' THEN
    RAISE EXCEPTION 'El ticket ya está completado';
  END IF;

  SELECT COUNT(*) INTO v_missing
  FROM public.production_ticket_pieces p
  CROSS JOIN (VALUES ('fabricacion'),('soldadura'),('ferre'),('pintura'),('decoracion')) AS s(step)
  WHERE p.ticket_id = p_ticket_id
    AND NOT EXISTS (
      SELECT 1 FROM public.production_ticket_steps st
      WHERE st.ticket_id = p_ticket_id
        AND st.piece_name = p.piece_name
        AND st.step = s.step
    );

  IF v_missing > 0 THEN
    RAISE EXCEPTION 'Faltan % etapa(s) por confirmar antes de cerrar', v_missing;
  END IF;

  SELECT COALESCE(SUM(price), 0) INTO v_total
  FROM public.production_ticket_steps WHERE ticket_id = p_ticket_id;

  UPDATE public.production_tickets t
    SET status = 'completado',
        total_cost = v_total,
        completed_at = NOW()
    WHERE t.id = p_ticket_id;

  RETURN QUERY SELECT p_ticket_id, v_total, 'completado'::TEXT;
END;
$$;

-- 10.5  create_payroll_run
--       Marca los movimientos (production_ticket_steps) de los empleados
--       seleccionados como pagados (payroll_run_id) y genera el detalle
--       agrupado por empleado × etapa. Nunca vuelve a pagar lo ya pagado.
CREATE OR REPLACE FUNCTION public.create_payroll_run(
  p_period_type   TEXT,
  p_period_start  DATE,
  p_period_end    DATE,
  p_employee_ids  UUID[],
  p_created_by    TEXT DEFAULT NULL
)
RETURNS TABLE(
  run_id UUID,
  total_amount NUMERIC,
  details_count INT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_run_id    UUID;
  v_total     NUMERIC(14,2) := 0;
  v_count     INT := 0;
  v_emp_id    UUID;
  v_emp_name  TEXT;
  v_step      TEXT;
  v_work_cnt  INT;
  v_amt       NUMERIC(14,2);
BEGIN
  IF p_period_end < p_period_start THEN
    RAISE EXCEPTION 'period_end no puede ser menor que period_start';
  END IF;
  IF array_length(p_employee_ids, 1) IS NULL THEN
    RAISE EXCEPTION 'Se requiere al menos un empleado';
  END IF;

  INSERT INTO public.production_payroll_runs (period_type, period_start, period_end, created_by)
  VALUES (p_period_type, p_period_start, p_period_end, p_created_by)
  RETURNING id INTO v_run_id;

  FOREACH v_emp_id IN ARRAY p_employee_ids
  LOOP
    SELECT name INTO v_emp_name FROM public.production_employees WHERE id = v_emp_id;
    IF v_emp_name IS NULL THEN
      RAISE EXCEPTION 'Empleado % no encontrado', v_emp_id;
    END IF;

    -- Agrupar por etapa los pasos no pagados del empleado en el rango
    FOR v_step, v_work_cnt, v_amt IN
      SELECT s.step, COUNT(*)::INT, COALESCE(SUM(s.price), 0)
      FROM public.production_ticket_steps s
      WHERE s.employee_id = v_emp_id
        AND s.payroll_run_id IS NULL
        AND s.completed_at >= p_period_start
        AND s.completed_at <  (p_period_end + INTERVAL '1 day')
      GROUP BY s.step
    LOOP
      INSERT INTO public.production_payroll_details (run_id, employee_id, employee_name, step, work_count, amount)
      VALUES (v_run_id, v_emp_id, v_emp_name, v_step, v_work_cnt, v_amt);

      -- Marcar esos pasos como pagados
      UPDATE public.production_ticket_steps
        SET payroll_run_id = v_run_id
        WHERE employee_id = v_emp_id
          AND payroll_run_id IS NULL
          AND step = v_step
          AND completed_at >= p_period_start
          AND completed_at < (p_period_end + INTERVAL '1 day');

      v_total := v_total + v_amt;
      v_count := v_count + 1;
    END LOOP;
  END LOOP;

  UPDATE public.production_payroll_runs SET total_amount = v_total WHERE id = v_run_id;

  RETURN QUERY SELECT v_run_id, v_total, v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.import_price_catalog(JSON)             TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_production_ticket(TEXT,TEXT,TEXT,TEXT,TEXT,JSON,TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_production_step(UUID,TEXT,TEXT,UUID,TEXT,BOOLEAN,UUID,TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.close_production_ticket(UUID)           TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_payroll_run(TEXT,DATE,DATE,UUID[],TEXT) TO anon, authenticated;

-- =====================================================================
-- 11) SEED — empleados demo (idempotente)
-- =====================================================================
INSERT INTO public.production_employees (name, active)
SELECT 'Fabricador Demo', TRUE
WHERE NOT EXISTS (SELECT 1 FROM public.production_employees WHERE LOWER(name) = 'fabricador demo');

INSERT INTO public.production_employees (name, active)
SELECT 'Soldador Demo', TRUE
WHERE NOT EXISTS (SELECT 1 FROM public.production_employees WHERE LOWER(name) = 'soldador demo');

INSERT INTO public.production_employees (name, active)
SELECT 'Pintor Demo', TRUE
WHERE NOT EXISTS (SELECT 1 FROM public.production_employees WHERE LOWER(name) = 'pintor demo');

INSERT INTO public.production_employees (name, active)
SELECT 'Ferre Demo', TRUE
WHERE NOT EXISTS (SELECT 1 FROM public.production_employees WHERE LOWER(name) = 'ferre demo');

INSERT INTO public.production_employees (name, active)
SELECT 'Decorador Demo', TRUE
WHERE NOT EXISTS (SELECT 1 FROM public.production_employees WHERE LOWER(name) = 'decorador demo');

-- =====================================================================
-- FIN
-- =====================================================================
