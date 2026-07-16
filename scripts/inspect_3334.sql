SELECT i.linea, i.nombre, i.descripcion,
       -- lo que realmente ve la función tras normalizar:
       regexp_replace(regexp_replace(upper(coalesce(i.nombre,'')||' '||coalesce(i.descripcion,'')),'\mNV\s+(\d{3})\M','NV\1','g'),'CR[- ]V','CRV','g') AS texto_buscado
FROM silver.facturas_venta_items i
JOIN silver.facturas_venta s ON s.alegra_id = i.factura_alegra_id
WHERE s.ncf = 'B0200003334'
ORDER BY i.linea;
