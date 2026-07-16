-- 3) sample de 20 pendientes con sus items
SELECT factura, vehiculo,
       (SELECT string_agg(i.nombre, ' | ' ORDER BY i.linea)
          FROM silver.facturas_venta_items i
         WHERE i.factura_alegra_id = v.alegra_id) AS items
FROM silver.v_facturas_produccion v
WHERE pendiente_produccion
ORDER BY fecha DESC
LIMIT 20;

-- 4) cobertura
SELECT
  count(*) FILTER (WHERE vehiculo IS NOT NULL) AS con_vehiculo,
  count(*) FILTER (WHERE vehiculo IS NULL)     AS sin_vehiculo,
  count(*) AS total
FROM silver.v_facturas_produccion
WHERE pendiente_produccion;

-- 5) items de los que quedan NULL -> qué modelos faltan en la lista
SELECT v.factura,
       (SELECT string_agg(i.nombre, ' | ' ORDER BY i.linea)
          FROM silver.facturas_venta_items i
         WHERE i.factura_alegra_id = v.alegra_id) AS items
FROM silver.v_facturas_produccion v
WHERE v.pendiente_produccion AND v.vehiculo IS NULL
LIMIT 25;
