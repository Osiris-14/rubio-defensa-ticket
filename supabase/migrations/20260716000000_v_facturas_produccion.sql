-- =====================================================================
-- MIGRATION: silver.v_facturas_produccion
-- Vista de facturas de producción + función extraer_vehiculo
-- + auto-reparación contra borrados del sync de Alegra.
--
-- Idempotente: se puede correr cuantas veces se quiera.
-- Self-healing: un job de pg_cron recrea la vista cada 5 min si el
-- sync de Alegra la borra (DROP SCHEMA silver CASCADE, etc.).
--
-- REQUISITO: pg_cron debe estar habilitado.
--   Dashboard Supabase -> Database -> Extensions -> "pg_cron" -> Enable.
--   Si ya está habilitado, el CREATE EXTENSION de abajo es no-op.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) Función extraer_vehiculo  (lógica exacta de ordenes.ts)
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
-- 2) Vista silver.v_facturas_produccion
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
-- 3) Grants
-- ---------------------------------------------------------------------
GRANT USAGE ON SCHEMA silver TO anon, authenticated;
GRANT SELECT ON silver.v_facturas_produccion TO anon, authenticated;
GRANT SELECT ON silver.facturas_venta, silver.facturas_venta_items, silver.contactos TO anon, authenticated;

-- ---------------------------------------------------------------------
-- 4) Exponer el schema silver a PostgREST de forma persistente
--    (setting a nivel rol authenticator; sobrevive reinicios y resets).
-- ---------------------------------------------------------------------
ALTER ROLE authenticator SET pgrst.db_schemas = 'public, storage, graphql_public, silver';
NOTIFY pgrst, 'reload config';
NOTIFY pgrst, 'reload schema';

-- ---------------------------------------------------------------------
-- 5) Auto-reparación
--    La función rebuild vive en public (sobrevive a DROP SCHEMA silver).
--    El job pg_cron la ejecuta cada 5 min: si la vista falta y las tablas
--    base ya existen, la recrea. Si todo está bien, no hace nada.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rebuild_v_facturas_produccion()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, silver, alegra
AS $rebuild$
BEGIN
  -- Si la vista existe, no hay nada que hacer.
  IF to_regclass('silver.v_facturas_produccion') IS NOT NULL THEN
    RETURN;
  END IF;

  -- Esperar a que las tablas base existan (el sync puede estar a mitad).
  IF to_regclass('silver.facturas_venta')         IS NULL
     OR to_regclass('silver.facturas_venta_items') IS NULL
     OR to_regclass('silver.contactos')           IS NULL
     OR to_regclass('alegra.facturas_venta')      IS NULL THEN
    RETURN;
  END IF;

  -- Recrear la función extraer_vehiculo.
  EXECUTE $f$
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
$$ LANGUAGE plpgsql STABLE
  $f$;

  -- Recrear la vista.
  EXECUTE $v$
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
  AND upper(coalesce(s.estado,'')) NOT IN ('VOID','ANULADA')
  $v$;

  -- Grants de nuevo.
  GRANT USAGE ON SCHEMA silver TO anon, authenticated;
  GRANT SELECT ON silver.v_facturas_produccion TO anon, authenticated;
  GRANT SELECT ON silver.facturas_venta, silver.facturas_venta_items, silver.contactos TO anon, authenticated;

  -- Avisar a PostgREST que recargue el cache de schema.
  NOTIFY pgrst, 'reload schema';
END;
$rebuild$;

-- pg_cron: job cada 1 minuto que auto-recrea la vista si falta.
-- (La app ademas llama al RPC on-demand al recibir PGRST205, asi que
-- la ventana de error es ~0 incluso entre ticks del cron.)
CREATE EXTENSION IF NOT EXISTS pg_cron;

DO $do$
BEGIN
  -- Quitar job previo con el mismo nombre (idempotente).
  PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'rebuild-v-facturas';
  -- Crear job fresh.
  PERFORM cron.schedule(
    'rebuild-v-facturas',
    '* * * * *',
    'SELECT public.rebuild_v_facturas_produccion();'
  );
END
$do$;
