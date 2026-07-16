-- STEP 1: ¿en qué campo de datos_originales vive la nota impresa?
SELECT
  numero,
  datos_originales->'numberTemplate'->>'text'  AS f1_numbertemplate,
  datos_originales->>'anotation'               AS f2_anotation,
  datos_originales->>'annotation'              AS f3_annotation,
  datos_originales->>'observations'            AS f4_observations
FROM alegra.facturas_venta
ORDER BY fecha DESC
LIMIT 15;

-- Confirmar columnas/tipos de contactos y del join
SELECT table_schema, table_name, column_name, data_type
FROM information_schema.columns
WHERE (table_schema, table_name) IN (('silver','contactos'), ('silver','facturas_venta'), ('alegra','facturas_venta'))
  AND column_name IN ('alegra_id','id','nombre','cliente_alegra_id','numero','ncf','datos_originales')
ORDER BY table_schema, table_name, column_name;
