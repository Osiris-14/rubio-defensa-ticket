-- TEST: la factura del bug
SELECT 'B0200002806' AS factura,
       silver.extraer_vehiculo(s.alegra_id) AS vehiculo,
       (SELECT string_agg(i.nombre, ' | ' ORDER BY i.linea)
          FROM silver.facturas_venta_items i
         WHERE i.factura_alegra_id = s.alegra_id) AS items
FROM silver.facturas_venta s
WHERE s.ncf = 'B0200002806';
