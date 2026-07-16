-- 1) las 4 facturas
SELECT factura, vehiculo,
       (SELECT string_agg(i.nombre, ' | ' ORDER BY i.linea)
          FROM silver.facturas_venta_items i
         WHERE i.factura_alegra_id = v.alegra_id) AS items
FROM silver.v_facturas_produccion v
WHERE v.factura IN ('B0200003469','B0200003523','B0200003509','B0200003531')
ORDER BY v.factura;

-- 2) cobertura
SELECT
  count(*) FILTER (WHERE vehiculo IS NOT NULL) AS con_vehiculo,
  count(*) FILTER (WHERE vehiculo IS NULL)     AS sin_vehiculo,
  count(*) AS total
FROM silver.v_facturas_produccion
WHERE pendiente_produccion;

-- 3) regresión: 20 filas
SELECT factura, vehiculo FROM silver.v_facturas_produccion
WHERE pendiente_produccion ORDER BY fecha DESC LIMIT 20;
