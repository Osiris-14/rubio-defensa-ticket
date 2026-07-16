-- =====================================================================
-- silver.extraer_vehiculo()  v3
--   + CHANGAN, SUBARU, CRV al bloque de una palabra; H1 al FINAL del array
--     (H1 es corto -> que cualquier modelo más específico gane primero).
--   + Normalización CRV: "CR-V" / "CR V" -> "CRV" (igual que NV).
--   Mantiene: normalización NV, y RETURN NULL si nada coincide.
-- =====================================================================
CREATE OR REPLACE FUNCTION silver.extraer_vehiculo(p_factura_alegra_id TEXT)
RETURNS TEXT AS $$
DECLARE
  v_lista TEXT[] := ARRAY[
    'TOWN ACE','LAND CRUISER','PICK UP','ISUZU DMAX','RENAULT MASTER',
    'ISUZU','RENAULT','NISSAN','NV200','NV350','KIA','TOYOTA','DAIHATSU','HIJET',
    'MIRA','K2700','MITSUBISHI','L300','HYUNDAI','FORD','CHEVROLET','JAC','HINO',
    'JEEP','SUZUKI','MAHINDRA','FUSO','CANTER','CAMION','CAMIONETA',
    'CHANGAN','SUBARU','CRV',
    'H1'  -- SIEMPRE al final: token corto, que gane cualquier match más específico
  ];
  v_excluidos TEXT[] := ARRAY['MATERIALES','BOLA DE JALON','DESINSTALACION','INSTALACION','SENSORES','ARANDELAS','MODIFICACION'];
  v_primario TEXT;
  v_todos TEXT;
  v_cand TEXT;
BEGIN
  -- Item primario, normalizando NV (NV 200 -> NV200) y CRV (CR-V / CR V -> CRV).
  SELECT regexp_replace(
           regexp_replace(
             upper(coalesce(i.nombre,'') || ' ' || coalesce(i.descripcion,'')),
             '\mNV\s+(\d{3})\M', 'NV\1', 'g'),
           'CR[- ]V', 'CRV', 'g')
    INTO v_primario
  FROM silver.facturas_venta_items i
  WHERE i.factura_alegra_id = p_factura_alegra_id
    AND NOT EXISTS (SELECT 1 FROM unnest(v_excluidos) e WHERE upper(coalesce(i.nombre,'')) LIKE '%'||e||'%')
  ORDER BY i.linea LIMIT 1;

  -- Todos los items, misma normalización.
  SELECT regexp_replace(
           regexp_replace(
             upper(string_agg(coalesce(i.nombre,'') || ' ' || coalesce(i.descripcion,''), ' ' ORDER BY i.linea)),
             '\mNV\s+(\d{3})\M', 'NV\1', 'g'),
           'CR[- ]V', 'CRV', 'g')
    INTO v_todos
  FROM silver.facturas_venta_items i
  WHERE i.factura_alegra_id = p_factura_alegra_id;

  -- 1) item primario (dos palabras antes que una: orden del array)
  FOREACH v_cand IN ARRAY v_lista LOOP
    IF v_primario IS NOT NULL AND v_primario ~ ('\m' || v_cand || '\M') THEN RETURN v_cand; END IF;
  END LOOP;

  -- 2) todos los items como respaldo
  FOREACH v_cand IN ARRAY v_lista LOOP
    IF v_todos IS NOT NULL AND v_todos ~ ('\m' || v_cand || '\M') THEN RETURN v_cand; END IF;
  END LOOP;

  -- sin coincidencia -> NULL
  RETURN NULL;
END;
$$ LANGUAGE plpgsql STABLE;
