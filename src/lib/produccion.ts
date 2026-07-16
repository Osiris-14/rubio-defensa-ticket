import { supabase } from './supabase'

// ─────────────────────────────────────────────────────────
// Types — columnas de la vista silver.v_facturas_produccion
// y de public.tickets_produccion / silver.facturas_venta_items.
//
// La regla de negocio (estado_cxc, pendiente_produccion) vive
// en Supabase dentro de la vista. El frontend solo filtra por
// pendiente_produccion.
// ─────────────────────────────────────────────────────────

export interface FacturaProduccion {
  alegra_id: string
  factura: string
  cliente: string | null
  talonario: string | null
  vehiculo: string | null
  cliente_alegra_id: string | null
  fecha: string
  fecha_vencimiento: string | null
  total: number
  total_pagado: number
  saldo: number
  observaciones: string | null
  num_items: number
  estado_alegra: string
  estado_cxc: 'Open' | 'Atraso' | 'Cerrado'
  pendiente_produccion: boolean
}

export interface FacturaItem {
  factura_alegra_id: string
  linea: number
  item_id: number | null
  nombre: string | null
  descripcion: string | null
  cantidad: number | null
  total: number | null
}

export interface TicketProduccion {
  id: string
  user_id: string | null
  user_name: string | null
  numero_factura: string
  numero_orden: string
  a_cargo_de: string | null
  fecha_entrega: string | null
  modelo: string
  tipo_modelo: string | null
  re_trabajo: string | null
  piezas: string[] | null
  fecha_compromiso: string | null
  grado_reparacion: string | null
  ordenes: string[] | null
  piezas_custom: string | null
  created_at: string
}

// Ítem de la factura de Alegra (para el modal de detalle en Completados).
export interface ProductoItem {
  nombre: string | null
  descripcion: string | null
  cantidad: number | null
}

// Ticket completado = registro manual de tickets_produccion enriquecido con
// datos vivos de la vista silver.v_facturas_produccion (vehículo, talonario,
// cliente, fecha de factura y la lista de productos para el detalle).
export type CompletadoProduccion = TicketProduccion & {
  vehiculo: string | null
  cliente: string | null
  fecha_factura: string | null
  talonario: string | null
  productos: ProductoItem[] | null
}

// ─────────────────────────────────────────────────────────
// Prioridad
// ─────────────────────────────────────────────────────────

export type Prioridad = 'nueva' | 'espera' | 'urgente' | 'critica'

export interface PrioridadInfo {
  nivel: Prioridad
  label: string
  color: string
  bg: string
  border: string
}

const PRIORIDAD_MAP: Record<Prioridad, PrioridadInfo> = {
  nueva:   { nivel: 'nueva',   label: 'Nueva',     color: '#00a050', bg: 'rgba(0,160,80,0.08)',  border: 'rgba(0,160,80,0.25)' },
  espera:  { nivel: 'espera',  label: 'En espera', color: '#a07800', bg: 'rgba(160,120,0,0.08)', border: 'rgba(160,120,0,0.25)' },
  urgente: { nivel: 'urgente', label: 'Urgente',   color: '#e07b00', bg: 'rgba(224,123,0,0.08)', border: 'rgba(224,123,0,0.25)' },
  critica: { nivel: 'critica', label: 'Crítica',   color: '#E8180A', bg: 'rgba(232,24,10,0.08)',  border: 'rgba(232,24,10,0.25)' },
}

export function calcularPrioridad(fechaCreacion: string, now: number = Date.now()): PrioridadInfo {
  const creacion = new Date(fechaCreacion).getTime()
  const horas = (now - creacion) / 3_600_000
  let nivel: Prioridad
  if (horas < 4) nivel = 'nueva'
  else if (horas < 24) nivel = 'espera'
  else if (horas < 48) nivel = 'urgente'
  else nivel = 'critica'
  return PRIORIDAD_MAP[nivel]
}

export function horasTranscurridas(fechaCreacion: string, now: number = Date.now()): number {
  return (now - new Date(fechaCreacion).getTime()) / 3_600_000
}

// ─────────────────────────────────────────────────────────
// Data access — consulta la vista silver.v_facturas_produccion.
// Toda la lógica de estado_cxc / pendiente_produccion vive
// en Supabase. El frontend solo filtra por pendiente_produccion.
//
// SELF-HEAL: si el sync de Alegra borra la vista, PostgREST
// devuelve PGRST205 ("Could not find the table ... in the schema
// cache"). Antes de fallar, llamamos al RPC rebuild (vive en
// public, sobrevive al borrado) y reintentamos una vez.
// ─────────────────────────────────────────────────────────

const VIEW_MISSING = /could not find.*v_facturas_produccion|v_facturas_produccion.*schema cache/i

async function rebuildView(): Promise<void> {
  const { error } = await supabase.rpc('rebuild_v_facturas_produccion')
  if (error) throw new Error(`rebuild_v_facturas_produccion: ${error.message}`)
}

async function withSelfHeal<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn()
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    if (!VIEW_MISSING.test(msg)) throw e
    await rebuildView()
    return fn()
  }
}

export async function fetchPendientes(): Promise<FacturaProduccion[]> {
  return withSelfHeal(async () => {
    const { data, error } = await supabase
      .schema('silver')
      .from('v_facturas_produccion')
      .select('*')
      .eq('pendiente_produccion', true)
      .order('fecha', { ascending: false })
    if (error) throw new Error(error.message)
    return (data ?? []).map(normalizeRow)
  })
}

export async function fetchCompletados(): Promise<CompletadoProduccion[]> {
  return withSelfHeal(async () => {
    const { data: tickets, error } = await supabase
      .from('tickets_produccion')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) throw new Error(error.message)
    if (!tickets || tickets.length === 0) return []

    const ncfList = tickets.map(t => t.numero_factura)
    const { data: facturas, error: e2 } = await supabase
      .schema('silver')
      .from('v_facturas_produccion')
      .select('*')
      .in('factura', ncfList)
    if (e2) throw new Error(e2.message)
    const facMap = new Map((facturas ?? []).map(f => [f.factura, f]))

    return tickets.map(t => {
      const v = facMap.get(t.numero_factura)
      return {
        ...t,
        vehiculo: v?.vehiculo ?? null,
        cliente: v?.cliente ?? null,
        fecha_factura: v?.fecha ?? null,
        talonario: v?.talonario ?? null,
        productos: (v?.productos as ProductoItem[] | null) ?? null,
      }
    })
  })
}

export async function fetchItems(facturaAlegraId: string): Promise<FacturaItem[]> {
  return withSelfHeal(async () => {
    const { data, error } = await supabase
      .schema('silver')
      .from('facturas_venta_items')
      .select('factura_alegra_id, linea, item_id, nombre, descripcion, cantidad, total')
      .eq('factura_alegra_id', facturaAlegraId)
      .order('linea', { ascending: true })
    if (error) throw new Error(error.message)
    return (data ?? []).map(it => ({
      factura_alegra_id: it.factura_alegra_id,
      linea: it.linea,
      item_id: it.item_id,
      nombre: it.nombre,
      descripcion: it.descripcion,
      cantidad: Number(it.cantidad ?? 0),
      total: Number(it.total ?? 0),
    }))
  })
}

export async function darDeAlta(
  factura: FacturaProduccion,
  datos: {
    a_cargo_de: string
    tipo_modelo: string
    re_trabajo: string
    grado_reparacion: string
    piezas: string[]
    piezas_custom: string
    fecha_compromiso: string
    fecha_entrega: string
    notas: string
  },
  user: { id: string; name: string },
): Promise<void> {
  const row = {
    user_id: user.id,
    user_name: user.name,
    numero_factura: factura.factura,
    numero_orden: factura.talonario ?? '',
    a_cargo_de: datos.a_cargo_de || null,
    fecha_entrega: datos.fecha_entrega || null,
    modelo: factura.vehiculo ?? '',
    tipo_modelo: datos.tipo_modelo || null,
    re_trabajo: datos.re_trabajo || null,
    piezas: datos.piezas,
    fecha_compromiso: datos.fecha_compromiso || null,
    grado_reparacion: datos.grado_reparacion || null,
    piezas_custom: datos.piezas_custom || null,
    notas: datos.notas || null,
  }
  const { error } = await supabase.from('tickets_produccion').insert(row)
  if (error) throw new Error(error.message)
}

// ─────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────

function normalizeRow(r: Record<string, unknown>): FacturaProduccion {
  return {
    alegra_id: String(r.alegra_id ?? ''),
    factura: String(r.factura ?? ''),
    cliente: (r.cliente as string | null) ?? null,
    talonario: (r.talonario as string | null) ?? null,
    vehiculo: (r.vehiculo as string | null) ?? null,
    cliente_alegra_id: (r.cliente_alegra_id as string | null) ?? null,
    fecha: String(r.fecha ?? ''),
    fecha_vencimiento: (r.fecha_vencimiento as string | null) ?? null,
    total: Number(r.total ?? 0),
    total_pagado: Number(r.total_pagado ?? 0),
    saldo: Number(r.saldo ?? 0),
    observaciones: (r.observaciones as string | null) ?? null,
    num_items: Number(r.num_items ?? 0),
    estado_alegra: String(r.estado_alegra ?? ''),
    estado_cxc: (r.estado_cxc as 'Open' | 'Atraso' | 'Cerrado') ?? 'Open',
    pendiente_produccion: Boolean(r.pendiente_produccion),
  }
}

// ─────────────────────────────────────────────────────────
// SQL final — Ejecutar en el SQL Editor de Supabase
// ─────────────────────────────────────────────────────────
//
// CREATE OR REPLACE VIEW silver.v_facturas_produccion AS
// WITH items_data AS (
//   SELECT
//     i.factura_alegra_id,
//     json_agg(
//       json_build_object(
//         'nombre', i.nombre,
//         'cantidad', i.cantidad,
//         'linea', i.linea
//       ) ORDER BY i.linea
//     ) AS productos,
//     (SELECT i2.nombre
//      FROM silver.facturas_venta_items i2
//      WHERE i2.factura_alegra_id = i.factura_alegra_id
//        AND i2.tipo_item = 'product'
//      ORDER BY i2.linea
//      LIMIT 1
//     ) AS vehiculo_nombre
//   FROM silver.facturas_venta_items i
//   GROUP BY i.factura_alegra_id
// )
// SELECT
//   fv.alegra_id,
//   fv.ncf AS factura,
//   c.nombre AS cliente,
//   LEFT(fv.ncf, 3) AS talonario,
//   COALESCE(
//     id.vehiculo_nombre,
//     (SELECT i3.nombre
//      FROM silver.facturas_venta_items i3
//      WHERE i3.factura_alegra_id = fv.alegra_id
//      ORDER BY i3.linea
//      LIMIT 1)
//   ) AS vehiculo,
//   fv.cliente_alegra_id,
//   fv.fecha,
//   fv.fecha_vencimiento,
//   fv.total,
//   fv.total_pagado,
//   fv.saldo,
//   fv.observaciones,
//   fv.num_items,
//   fv.estado AS estado_alegra,
//   CASE
//     WHEN fv.saldo <= 450 THEN 'Cerrado'::text
//     WHEN fv.fecha_vencimiento < CURRENT_DATE THEN 'Atraso'::text
//     ELSE 'Open'::text
//   END AS estado_cxc,
//   CASE
//     WHEN fv.saldo <= 450 THEN false
//     ELSE true
//   END AS pendiente_produccion,
//   COALESCE(id.productos, '[]'::json) AS productos
// FROM silver.facturas_venta fv
// LEFT JOIN silver.contactos c ON c.alegra_id::text = fv.cliente_alegra_id
// LEFT JOIN items_data id ON id.factura_alegra_id = fv.alegra_id
// WHERE fv.fecha >= '2026-01-01'::date;
