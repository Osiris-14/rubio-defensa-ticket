DROP FUNCTION IF EXISTS public.close_production_ticket(UUID);

CREATE FUNCTION public.close_production_ticket(p_ticket_id UUID)
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

GRANT EXECUTE ON FUNCTION public.close_production_ticket(UUID) TO anon, authenticated;