-- =====================================================================
-- FIX v2: DROP + CREATE para forzar recarga completa
-- =====================================================================

DROP FUNCTION IF EXISTS public.confirm_production_step(UUID,TEXT,TEXT,UUID,TEXT,BOOLEAN,UUID,TEXT);

CREATE FUNCTION public.confirm_production_step(
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
  SELECT status INTO v_status FROM public.production_tickets WHERE id = p_ticket_id;
  IF v_status IS NULL THEN
    RAISE EXCEPTION 'Ticket no encontrado';
  END IF;
  IF v_status <> 'pendiente' THEN
    RAISE EXCEPTION 'El ticket ya está completado, no se pueden agregar etapas';
  END IF;

  SELECT 1 INTO v_exists FROM public.production_ticket_steps
    WHERE ticket_id = p_ticket_id AND piece_name = p_piece_name AND step = p_step;
  IF v_exists = 1 THEN
    RAISE EXCEPTION 'Esta etapa ya fue confirmada para esta pieza';
  END IF;

  SELECT quantity INTO v_qty FROM public.production_ticket_pieces
    WHERE ticket_id = p_ticket_id AND piece_name = p_piece_name;
  IF v_qty IS NULL THEN
    RAISE EXCEPTION 'La pieza % no pertenece al ticket', p_piece_name;
  END IF;

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
    v_unit_price := 0;
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
  RETURNING production_ticket_steps.id INTO v_new_id;

  RETURN QUERY SELECT v_new_id, v_total, p_step, p_piece_name;
END;
$$;

GRANT EXECUTE ON FUNCTION public.confirm_production_step(UUID,TEXT,TEXT,UUID,TEXT,BOOLEAN,UUID,TEXT) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
