-- remaining NULLs
SELECT v.factura,
       (SELECT string_agg(i.nombre, ' | ' ORDER BY i.linea)
          FROM silver.facturas_venta_items i
         WHERE i.factura_alegra_id = v.alegra_id) AS items
FROM silver.v_facturas_produccion v
WHERE v.pendiente_produccion AND v.vehiculo IS NULL
ORDER BY v.factura;

-- the 4 previously pure-service invoices: what do they resolve to now?
SELECT v.factura, v.vehiculo,
       (SELECT string_agg(i.nombre, ' | ' ORDER BY i.linea)
          FROM silver.facturas_venta_items i
         WHERE i.factura_alegra_id = v.alegra_id) AS items
FROM silver.v_facturas_produccion v
WHERE v.factura IN ('B0200003334','B0200003399','B0200003466','B0200003513')
ORDER BY v.factura;
