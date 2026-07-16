-- =====================================================================
-- BUILD silver.v_facturas_produccion  (talonario + vehiculo correctos)
-- Ejecutar en el SQL Editor de Supabase (o vía psql con el connection
-- string del pooler). Idempotente: se puede correr varias veces.
--
-- CAMBIOS respecto al SQL que me pasaste (por tipos reales de columnas):
--   * Joins con ::text en ambos lados para evitar
--     "operator does not exist: bigint = text":
--       - alegra.facturas_venta a ON a.id::text = s.alegra_id::text
--       - silver.contactos     c ON c.alegra_id::text = s.cliente_alegra_id::text
--     (confirmado en src/lib/produccion.ts: c.alegra_id::text = fv.cliente_alegra_id)
--   La lógica de talonario, vehículo y notas queda EXACTAMENTE como la diste.
-- =====================================================================

-- ---------------------------------------------------------------------
-- STEP 2: función de extracción de vehículo  (lógica exacta de ordenes.ts)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION silver.extraer_vehiculo(p_factura_alegra_id TEXT)
RETURNS TEXT AS $$
DECLARE
  v_lista TEXT[] := ARRAY[
    'TOWN ACE','LAND CRUISER','PICK UP','ISUZU DMAX','NV 350','RENAULT MASTER',
    'ISUZU','RENAULT','NISSAN','NV200','NV350','KIA','TOYOTA','DAIHATSU','HIJET',
    'MIRA','K2700','MITSUBISHI','L300','HYUNDAI','FORD','CHEVROLET','JAC','HINO',
    'JEEP','SUZUKI','MAHINDRA','FUSO','CANTER','CAMION','CAMIONETA'
  ];
  v_excluidos TEXT[] := ARRAY['MATERIALES','BOLA DE JALON','DESINSTALACION','INSTALACION','SENSORES','ARANDELAS','MODIFICACION'];
  v_primario TEXT;
  v_todos TEXT;
  v_cand TEXT;
  v_ref TEXT;
BEGIN
  SELECT upper(coalesce(i.nombre,'') || ' ' || coalesce(i.descripcion,''))
    INTO v_primario
  FROM silver.facturas_venta_items i
  WHERE i.factura_alegra_id = p_factura_alegra_id
    AND NOT EXISTS (SELECT 1 FROM unnest(v_excluidos) e WHERE upper(coalesce(i.nombre,'')) LIKE '%'||e||'%')
  ORDER BY i.linea LIMIT 1;

  SELECT upper(string_agg(coalesce(i.nombre,'') || ' ' || coalesce(i.descripcion,''), ' ' ORDER BY i.linea))
    INTO v_todos
  FROM silver.facturas_venta_items i
  WHERE i.factura_alegra_id = p_factura_alegra_id;

  FOREACH v_cand IN ARRAY v_lista LOOP
    IF v_primario IS NOT NULL AND v_primario ~ ('\m' || v_cand || '\M') THEN RETURN v_cand; END IF;
  END LOOP;

  FOREACH v_cand IN ARRAY v_lista LOOP
    IF v_todos IS NOT NULL AND v_todos ~ ('\m' || v_cand || '\M') THEN RETURN v_cand; END IF;
  END LOOP;

  SELECT coalesce(nullif(i.descripcion,''), i.nombre) INTO v_ref
  FROM silver.facturas_venta_items i
  WHERE i.factura_alegra_id = p_factura_alegra_id
    AND NOT EXISTS (SELECT 1 FROM unnest(v_excluidos) e WHERE upper(coalesce(i.nombre,'')) LIKE '%'||e||'%')
  ORDER BY i.linea LIMIT 1;

  IF v_ref IS NULL THEN
    SELECT coalesce(nullif(i.descripcion,''), i.nombre) INTO v_ref
    FROM silver.facturas_venta_items i
    WHERE i.factura_alegra_id = p_factura_alegra_id
    ORDER BY i.linea LIMIT 1;
  END IF;

  RETURN coalesce(v_ref, '—');
END;
$$ LANGUAGE plpgsql STABLE;

-- ---------------------------------------------------------------------
-- STEP 3: la vista
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW silver.v_facturas_produccion AS
WITH nota AS (
  SELECT
    s.alegra_id,
    split_part(
      COALESCE(
        NULLIF(a.datos_originales->'numberTemplate'->>'text',''),
        NULLIF(a.datos_originales->>'anotation',''),
        NULLIF(a.datos_originales->>'annotation',''),
        NULLIF(a.datos_originales->>'observations',''),
        NULLIF(s.observaciones,'')
      ), E'\n', 1) AS primera_linea
  FROM silver.facturas_venta s
  LEFT JOIN alegra.facturas_venta a ON a.id::text = s.alegra_id::text
)
SELECT
  s.alegra_id,
  s.ncf                                   AS factura,
  c.nombre                                AS cliente,
  s.fecha,
  s.fecha_vencimiento,
  s.total,
  s.total_pagado,
  s.saldo,
  CASE
    WHEN s.saldo <= 450 THEN 'Cerrado'
    WHEN s.fecha_vencimiento < CURRENT_DATE THEN 'Atraso'
    ELSE 'Open'
  END                                     AS estado_cxc,
  (s.saldo > 450)                         AS pendiente_produccion,
  NULLIF(COALESCE(
    (regexp_match(n.primera_linea, '(?:F[A-Z]*T[;:_ ]*|ORDEN[;: ]*|NO[;:] *)0*(\d{3,4})', 'i'))[1],
    (regexp_match(n.primera_linea, '^0*(\d{3,4})'))[1]
  ), '')::int::text                       AS talonario,
  silver.extraer_vehiculo(s.alegra_id)    AS vehiculo,
  (SELECT jsonb_agg(
            jsonb_build_object('nombre', i.nombre, 'descripcion', i.descripcion, 'cantidad', i.cantidad)
            ORDER BY i.linea)
     FROM silver.facturas_venta_items i
    WHERE i.factura_alegra_id = s.alegra_id) AS productos
FROM silver.facturas_venta s
LEFT JOIN nota n ON n.alegra_id = s.alegra_id
LEFT JOIN silver.contactos c ON c.alegra_id::text = s.cliente_alegra_id::text
WHERE s.fecha >= DATE '2026-01-01'
  AND upper(coalesce(s.estado,'')) NOT IN ('VOID','ANULADA');

-- ---------------------------------------------------------------------
-- STEP 4: grants + exponer schema + recargar PostgREST
-- ---------------------------------------------------------------------
GRANT USAGE ON SCHEMA silver TO anon, authenticated;
GRANT SELECT ON silver.v_facturas_produccion TO anon, authenticated;
GRANT SELECT ON silver.facturas_venta, silver.facturas_venta_items, silver.contactos TO anon, authenticated;

-- Exponer 'silver' a PostgREST de forma persistente (nivel rol authenticator).
-- También puedes hacerlo en Settings -> API -> Exposed schemas del dashboard.
ALTER ROLE authenticator SET pgrst.db_schemas = 'public, storage, graphql_public, silver';
NOTIFY pgrst, 'reload config';

NOTIFY pgrst, 'reload schema';
