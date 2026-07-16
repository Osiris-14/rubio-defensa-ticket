-- =====================================================================
-- FIX silver.extraer_vehiculo()
--   FIX 1: normaliza el espaciado NV ("NV 200" -> "NV200", "NV 350" -> "NV350")
--          en el texto de búsqueda, y se elimina 'NV 350' de la lista de dos
--          palabras (ya no hace falta: ambas grafías colapsan a NV200/NV350).
--   FIX 2: si ningún vehículo de la lista coincide -> RETURN NULL
--          (antes devolvía la descripcion del item, p.ej. "PUERTA TRASERA...").
--          Un nombre de vehículo equivocado es peor que ninguno.
-- Solo cambia la función; la vista la usa por nombre, no hay que recrearla.
-- =====================================================================
CREATE OR REPLACE FUNCTION silver.extraer_vehiculo(p_factura_alegra_id TEXT)
RETURNS TEXT AS $$
DECLARE
  v_lista TEXT[] := ARRAY[
    'TOWN ACE','LAND CRUISER','PICK UP','ISUZU DMAX','RENAULT MASTER',
    'ISUZU','RENAULT','NISSAN','NV200','NV350','KIA','TOYOTA','DAIHATSU','HIJET',
    'MIRA','K2700','MITSUBISHI','L300','HYUNDAI','FORD','CHEVROLET','JAC','HINO',
    'JEEP','SUZUKI','MAHINDRA','FUSO','CANTER','CAMION','CAMIONETA'
  ];
  v_excluidos TEXT[] := ARRAY['MATERIALES','BOLA DE JALON','DESINSTALACION','INSTALACION','SENSORES','ARANDELAS','MODIFICACION'];
  v_primario TEXT;
  v_todos TEXT;
  v_cand TEXT;
BEGIN
  -- Texto del item primario (primero cuyo nombre no tiene palabras excluidas),
  -- con espaciado NV normalizado: "NV 200" -> "NV200".
  SELECT regexp_replace(
           upper(coalesce(i.nombre,'') || ' ' || coalesce(i.descripcion,'')),
           '\mNV\s+(\d{3})\M', 'NV\1', 'g')
    INTO v_primario
  FROM silver.facturas_venta_items i
  WHERE i.factura_alegra_id = p_factura_alegra_id
    AND NOT EXISTS (SELECT 1 FROM unnest(v_excluidos) e WHERE upper(coalesce(i.nombre,'')) LIKE '%'||e||'%')
  ORDER BY i.linea LIMIT 1;

  -- Todos los items concatenados, misma normalización NV.
  SELECT regexp_replace(
           upper(string_agg(coalesce(i.nombre,'') || ' ' || coalesce(i.descripcion,''), ' ' ORDER BY i.linea)),
           '\mNV\s+(\d{3})\M', 'NV\1', 'g')
    INTO v_todos
  FROM silver.facturas_venta_items i
  WHERE i.factura_alegra_id = p_factura_alegra_id;

  -- 1) buscar en el item primario (dos palabras antes que una: orden del array)
  FOREACH v_cand IN ARRAY v_lista LOOP
    IF v_primario IS NOT NULL AND v_primario ~ ('\m' || v_cand || '\M') THEN RETURN v_cand; END IF;
  END LOOP;

  -- 2) buscar en todos los items como respaldo
  FOREACH v_cand IN ARRAY v_lista LOOP
    IF v_todos IS NOT NULL AND v_todos ~ ('\m' || v_cand || '\M') THEN RETURN v_cand; END IF;
  END LOOP;

  -- FIX 2: sin coincidencia -> NULL (no devolver descripcion basura ni '—')
  RETURN NULL;
END;
$$ LANGUAGE plpgsql STABLE;
