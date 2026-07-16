SELECT factura, fecha, cliente, saldo, talonario, vehiculo,
       jsonb_array_length(productos) AS n_productos
FROM silver.v_facturas_produccion
WHERE pendiente_produccion
ORDER BY fecha DESC
LIMIT 15;

SELECT
  count(*) FILTER (WHERE talonario IS NOT NULL) AS con_talonario,
  count(*) FILTER (WHERE talonario IS NULL)     AS sin_talonario,
  count(*) FILTER (WHERE vehiculo IS NOT NULL AND vehiculo <> '—') AS con_vehiculo,
  count(*)                                      AS total
FROM silver.v_facturas_produccion;
