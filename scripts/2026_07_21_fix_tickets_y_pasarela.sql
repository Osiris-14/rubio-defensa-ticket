-- =====================================================================
-- FIX 2026-07-21 — Errores al llenar tickets y pasarela
-- El Rubio Defensa Ticket
--
-- 1) tickets_ferre.user_id era UUID → la app envía ids de texto ('1', '7')
--    Error: invalid input syntax for type uuid: "1"
-- 2) production_tickets sin tipo_trabajo/grado_reparacion/re_trabajo y
--    RPC create_production_ticket vieja (7 params) →
--    Error: Could not find the function ... in the schema cache
--
-- Idempotente: se puede ejecutar varias veces sin problema.
-- =====================================================================

-- ─────────────────────────────────────────────────────────
-- 1) Ferré: user_id como TEXT (igual que las demás tablas de área)
-- ─────────────────────────────────────────────────────────
ALTER TABLE public.tickets_ferre
  ALTER COLUMN user_id TYPE TEXT USING user_id::TEXT,
  ALTER COLUMN user_id DROP NOT NULL;

-- Por si la columna quedó con default de uuid:
ALTER TABLE public.tickets_ferre
  ALTER COLUMN user_id DROP DEFAULT;

-- ─────────────────────────────────────────────────────────
-- 2) Producción: columnas de tipo de trabajo + RPC actualizada
--    (igual que la migración 20260720010000_production_tipo_trabajo.sql)
-- ─────────────────────────────────────────────────────────
ALTER TABLE public.production_tickets
  ADD COLUMN IF NOT EXISTS tipo_trabajo TEXT DEFAULT 'Fabricacion'
    CHECK (tipo_trabajo IN ('Fabricacion','Reparacion','Modificacion'));

ALTER TABLE public.production_tickets
  ADD COLUMN IF NOT EXISTS grado_reparacion TEXT
    CHECK (grado_reparacion IS NULL OR grado_reparacion IN ('Grado A','Grado B','Grado C'));

ALTER TABLE public.production_tickets
  ADD COLUMN IF NOT EXISTS re_trabajo TEXT DEFAULT 'No'
    CHECK (re_trabajo IN ('Si','No'));

CREATE OR REPLACE FUNCTION public.create_production_ticket(
  p_alegra_id    TEXT,
  p_factura      TEXT,
  p_orden        TEXT,
  p_cliente      TEXT,
  p_vehiculo     TEXT,
  p_pieces       JSON,
  p_created_by   TEXT DEFAULT NULL,
  p_tipo_trabajo TEXT DEFAULT 'Fabricacion',
  p_grado_reparacion TEXT DEFAULT NULL,
  p_re_trabajo   TEXT DEFAULT 'No'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ticket_id UUID;
  p JSON;
  v_tipo TEXT := COALESCE(p_tipo_trabajo, 'Fabricacion');
  v_grado TEXT := p_grado_reparacion;
  v_re TEXT := COALESCE(p_re_trabajo, 'No');
BEGIN
  IF v_tipo = 'Reparacion' THEN
    v_re := 'Si';
  ELSE
    v_grado := NULL;
    v_re := 'No';
  END IF;

  IF p_alegra_id IS NOT NULL THEN
    SELECT id INTO v_ticket_id FROM public.production_tickets WHERE alegra_id = p_alegra_id;
    IF v_ticket_id IS NOT NULL THEN
      RAISE EXCEPTION 'Ya existe un ticket de producción para esta orden (alegra_id=%)', p_alegra_id;
    END IF;
  END IF;

  INSERT INTO public.production_tickets (
    alegra_id, factura, orden, cliente, vehiculo, created_by,
    tipo_trabajo, grado_reparacion, re_trabajo
  )
  VALUES (
    p_alegra_id, p_factura, p_orden, p_cliente, p_vehiculo, p_created_by,
    v_tipo, v_grado, v_re
  )
  RETURNING id INTO v_ticket_id;

  FOR p IN SELECT json_array_elements(p_pieces)
  LOOP
    INSERT INTO public.production_ticket_pieces (ticket_id, piece_name, quantity)
    VALUES (v_ticket_id, p->>'piece_name', COALESCE((p->>'quantity')::INT, 1));
  END LOOP;

  RETURN v_ticket_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_production_ticket(
  TEXT, TEXT, TEXT, TEXT, TEXT, JSON, TEXT, TEXT, TEXT, TEXT
) TO anon, authenticated;

-- Refrescar la caché del esquema de PostgREST para que tome los cambios
NOTIFY pgrst, 'reload schema';

-- ─────────────────────────────────────────────────────────
-- Verificación rápida (debe devolver filas sin error)
-- ─────────────────────────────────────────────────────────
SELECT 'tickets_ferre.user_id' AS fix, data_type FROM information_schema.columns
  WHERE table_name = 'tickets_ferre' AND column_name = 'user_id';
SELECT 'production_tickets' AS fix, column_name FROM information_schema.columns
  WHERE table_name = 'production_tickets'
    AND column_name IN ('tipo_trabajo','grado_reparacion','re_trabajo');
