-- =============================================================
-- Migration: puestos de Doblado y Puesto 3 en puesto_capacidad
--
-- Complementa 20260801000000_orden_movimientos_puesto_capacidad.sql.
-- Ese archivo ya crea ambas tablas, desactiva RLS y las agrega a la
-- publicación supabase_realtime; aquí solo se añaden los puestos que
-- faltaban para el dashboard del dueño.
--
-- LLAVE: `puesto` guarda el string EXACTO del calendario, porque el
-- conteo de carga diaria hace join contra la columna `calendario` de
-- los CSV. La etiqueta bonita ("David · Doblador") se resuelve en la
-- UI con labelPuesto() — ver src/lib/puestos.ts.
--
-- ⚠ Los dos puestos de abajo todavía NO tienen calendario exportado:
--    - 'PUESTO 3 FELIPE TRASER' se toma del fragmento configurado en
--      scripts/calendarios_armadores/exportar_calendarios_armadores.py
--    - 'DAVID P-13' es provisional: no hay calendario de David en el
--      script de exportación.
--   Cuando esos calendarios se agreguen a la exportación, verificar que
--   el summary real coincida con estos valores; si no, actualizarlos
--   con el UPDATE del final de este archivo (comentado).
-- =============================================================

INSERT INTO public.puesto_capacidad (puesto, limite_diario, activo) VALUES
  ('DAVID P-13',             NULL, true),
  ('PUESTO 3 FELIPE TRASER', NULL, true)
ON CONFLICT (puesto) DO NOTHING;

-- Cuando se conozca el summary real del calendario de David:
-- UPDATE public.puesto_capacidad
--    SET puesto = '<summary exacto del calendario>'
--  WHERE puesto = 'DAVID P-13';
