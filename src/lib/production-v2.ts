// =====================================================================
// Módulo de Producción — capa de lectura/escritura (cliente).
//
// v4: pipeline de 5 etapas físicas impulsado por las facturas de
// Alegra — Órdenes → Corte → Fabricación → Soldadura → Pulido →
// Completada. Cada pieza deja rastro histórico: se inserta una fila
// nueva por cada paso de Fabricación→Soldadura y Soldadura→Pulido; la
// transición final Pulido→Completada es un UPDATE en la misma fila.
// La fila de etapa 'corte' es a nivel de ORDEN (sin pieza).
//
// Se conservan las lecturas que siguen alimentando el Dashboard
// "Resumen" (presupuesto/cobros por responsable, calculados sobre
// production_tickets × tarifario — ver piezasVigentes() más abajo para
// cómo se evita contar la misma pieza varias veces).
// =====================================================================
import { supabase } from './supabase'

// ─────────────────────────────────────────────────────────
// Tipos — catálogo de precios (usado por Presupuesto/Cobros del
// Dashboard, calculado sobre el calendario de Google — no por Producción).
// ─────────────────────────────────────────────────────────

export interface PriceCatalogRow {
  id: string
  piece_name: string
  ferre_price: number
  paint_price: number
  decoration_price: number
  fabrication_price_other_bent: number
  fabrication_price_self_bent: number
  welding_price: number
  active: boolean
  created_at: string
  updated_at: string
}

// ─────────────────────────────────────────────────────────
// Piezas del tarifario — lista fija para el formulario "Abrir ticket".
// No tiene relación con production_price_catalog (eso es para el
// cálculo de presupuesto del calendario); esto es solo el catálogo de
// nombres de pieza que puede producir el taller.
// ─────────────────────────────────────────────────────────
export const PIEZAS_TARIFARIO: string[] = [
  'Juego Completo',
  'Frente Camión / Grande',
  'Frente Normal',
  'Trasero',
  'Estribos',
  'Estribos con Tubito',
  'Porta Escalera',
  'Parrilla',
  'Juego Grande (Coaster)',
  'Trasero Grande',
  'Juego Protector Tanque',
  'Mini Cachucha isuzu/fuso',
  'Cachucha KIA',
  'Varillero',
  'Filos de Cama',
  'Espaldal Cama Camión',
  'Mini Escalera',
  'Canasto',
  'Tubo Cabina',
  'Maletero',
  'Canasto NV350',
  'Porta Pies',
  'Protector de Batería',
]

// ─────────────────────────────────────────────────────────
// Tipos — tickets de producción (v4: pipeline por etapas)
// ─────────────────────────────────────────────────────────

export type EstadoTicket = 'pendiente' | 'en_proceso' | 'completado'
export type EtapaPipeline = 'corte' | 'fabricacion' | 'soldadura' | 'pulido' | 'completada'

export const ETAPAS_PIPELINE: EtapaPipeline[] = ['corte', 'fabricacion', 'soldadura', 'pulido', 'completada']

export interface ProductionTicketV3 {
  id: string
  numero_orden: string | null
  factura: string | null
  alegra_id: string | null
  /** null en la fila de etapa 'corte' (es a nivel de orden, no de pieza). */
  pieza: string | null
  responsable: string | null
  etapa: EtapaPipeline
  /** null hasta que se confirma en Corte (se define una sola vez, para todas las piezas de esa confirmación). */
  doblo_david: boolean | null
  estado: EstadoTicket
  completado_en: string | null
  user_id: string | null
  user_name: string | null
  created_at: string
}

const SELECT_TICKET_V3 = 'id, numero_orden, factura, alegra_id, pieza, responsable, etapa, doblo_david, estado, completado_en, user_id, user_name, created_at'

// Producto de una factura de Alegra (columna jsonb `productos` de la vista silver).
export interface ProductoFactura {
  nombre: string | null
  descripcion: string | null
  cantidad: number | null
}

// Orden proveniente de Alegra (vista silver) aún sin ticket abierto.
// Mismo shape que FacturaProduccion (se define más abajo) — es la
// misma vista, solo cambia el filtro con el que se consulta.
export type OrdenParaTicket = FacturaProduccion

// ─────────────────────────────────────────────────────────
// Self-heal para la vista silver (el sync de Alegra puede borrarla)
// ─────────────────────────────────────────────────────────
const VIEW_MISSING = /could not find.*v_facturas_produccion|v_facturas_produccion.*schema cache/i

async function rebuildSilverView (): Promise<void> {
  const { error } = await supabase.rpc('rebuild_v_facturas_produccion')
  if (error) throw new Error(`rebuild_v_facturas_produccion: ${error.message}`)
}

async function withSelfHeal<T> (fn: () => Promise<T>): Promise<T> {
  try {
    return await fn()
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    if (!VIEW_MISSING.test(msg)) throw e
    await rebuildSilverView()
    return fn()
  }
}

// ─────────────────────────────────────────────────────────
// Lecturas — catálogo de precios (Presupuesto/Cobros del Dashboard)
// ─────────────────────────────────────────────────────────

export async function fetchPriceCatalog (): Promise<PriceCatalogRow[]> {
  const { data, error } = await supabase
    .from('production_price_catalog')
    .select('*')
    .order('piece_name', { ascending: true })
  if (error) throw new Error(error.message)
  return (data ?? []).map(normalizeCatalogRow)
}

function normalizeCatalogRow (r: Record<string, unknown>): PriceCatalogRow {
  return {
    id: String(r.id ?? ''),
    piece_name: String(r.piece_name ?? ''),
    ferre_price: Number(r.ferre_price ?? 0),
    paint_price: Number(r.paint_price ?? 0),
    decoration_price: Number(r.decoration_price ?? 0),
    fabrication_price_other_bent: Number(r.fabrication_price_other_bent ?? 0),
    fabrication_price_self_bent: Number(r.fabrication_price_self_bent ?? 0),
    welding_price: Number(r.welding_price ?? 0),
    active: Boolean(r.active),
    created_at: String(r.created_at ?? ''),
    updated_at: String(r.updated_at ?? ''),
  }
}

// ─────────────────────────────────────────────────────────
// Lecturas — órdenes de Alegra listas para abrir ticket
// (tab "Órdenes"). Desde el 13 de agosto de 2026 en adelante, sin
// tope superior. Excluye órdenes que ya tienen al menos un ticket
// (pendiente o completado) en production_tickets.
// ─────────────────────────────────────────────────────────

const FECHA_DESDE_ORDENES = '2026-08-13'

export async function fetchOrdenesParaTicket (): Promise<OrdenParaTicket[]> {
  const [facturas, existentes] = await Promise.all([
    fetchFacturasProduccion(),
    supabase.from('production_tickets').select('alegra_id'),
  ])
  if (existentes.error) throw new Error(existentes.error.message)
  const conTicket = new Set((existentes.data ?? []).map(r => r.alegra_id).filter(Boolean) as string[])

  return facturas.filter(f => f.fecha >= FECHA_DESDE_ORDENES && !conTicket.has(f.alegra_id))
}

// ─────────────────────────────────────────────────────────
// Lecturas — tickets de producción (v4, pipeline por etapas)
// ─────────────────────────────────────────────────────────

// Filas de una etapa del pipeline. soloActivas=true (default) excluye
// las que ya se marcaron 'completado' en esa etapa (para que, p. ej.,
// una orden ya confirmada en Corte no se quede pegada en el tab Corte).
export async function fetchProductionTicketsPorEtapa (etapa: EtapaPipeline, soloActivas = true): Promise<ProductionTicketV3[]> {
  let q = supabase.from('production_tickets').select(SELECT_TICKET_V3).eq('etapa', etapa)
  if (soloActivas) q = q.neq('estado', 'completado')
  q = q.order('created_at', { ascending: false })
  const { data, error } = await q
  if (error) throw new Error(error.message)
  return (data ?? []) as unknown as ProductionTicketV3[]
}

// Todas las filas de production_tickets, sin filtrar — para
// deduplicar con piezasVigentes() (Presupuesto/Cobros del Dashboard).
export async function fetchAllProductionTickets (): Promise<ProductionTicketV3[]> {
  const { data, error } = await supabase
    .from('production_tickets')
    .select(SELECT_TICKET_V3)
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []) as unknown as ProductionTicketV3[]
}

// Órdenes cuyas piezas ya llegaron a 'completada' (tab "Órdenes Completadas").
export async function fetchOrdenesCompletadasPipeline (): Promise<Map<string, ProductionTicketV3[]>> {
  const rows = await fetchProductionTicketsPorEtapa('completada', false)
  const porOrden = new Map<string, ProductionTicketV3[]>()
  for (const t of rows) {
    const key = t.alegra_id ?? t.numero_orden ?? t.id
    const arr = porOrden.get(key) ?? []
    arr.push(t)
    porOrden.set(key, arr)
  }
  return porOrden
}

// Una pieza física deja varias filas en su vida (una por etapa por la
// que pasó — Fabricación, Soldadura, y la que termina en Pulido/
// Completada). Para Presupuesto/Cobros del Dashboard, que cuentan cada
// pieza UNA sola vez, esto se queda con la fila más reciente
// (created_at) por (orden, pieza, responsable) y descarta las filas de
// etapa 'corte' (son a nivel de orden, sin pieza).
export function piezasVigentes (tickets: ProductionTicketV3[]): ProductionTicketV3[] {
  const porPieza = new Map<string, ProductionTicketV3>()
  for (const t of tickets) {
    if (!t.pieza) continue
    const key = `${t.alegra_id ?? t.numero_orden ?? t.id}${t.pieza}${t.responsable ?? ''}`
    const actual = porPieza.get(key)
    if (!actual || t.created_at > actual.created_at) porPieza.set(key, t)
  }
  return [...porPieza.values()]
}

// ─────────────────────────────────────────────────────────
// Tipos — Facturas con las columnas de dinero (Dashboard: Cobrado,
// Pendiente cobrar; y cruce con cliente/factura en las tarjetas de
// tickets de Producción).
// ─────────────────────────────────────────────────────────
export interface FacturaProduccion {
  alegra_id: string
  factura: string
  talonario: string | null
  cliente: string | null
  vehiculo: string | null
  fecha: string
  /** "Fecha 0" en la UI. */
  fecha_vencimiento: string | null
  total: number
  total_pagado: number
  saldo: number
  productos: ProductoFactura[]
}

const SELECT_FACTURA = 'alegra_id, factura, talonario, cliente, vehiculo, fecha, fecha_vencimiento, total, total_pagado, saldo, productos'

export async function fetchFacturasProduccion (): Promise<FacturaProduccion[]> {
  return withSelfHeal(async () => {
    const { data, error } = await supabase
      .schema('silver')
      .from('v_facturas_produccion')
      .select(SELECT_FACTURA)
      .order('fecha', { ascending: false })
    if (error) throw new Error(error.message)
    return (data ?? []).map(r => {
      const row = r as Record<string, unknown>
      const productosRaw = Array.isArray(row.productos) ? row.productos as Record<string, unknown>[] : []
      return {
        alegra_id: String(row.alegra_id ?? ''),
        factura: String(row.factura ?? ''),
        talonario: (row.talonario as string | null) ?? null,
        cliente: (row.cliente as string | null) ?? null,
        vehiculo: (row.vehiculo as string | null) ?? null,
        fecha: String(row.fecha ?? ''),
        fecha_vencimiento: (row.fecha_vencimiento as string | null) ?? null,
        productos: productosRaw.map(p => ({
          nombre: (p.nombre as string | null) ?? null,
          descripcion: (p.descripcion as string | null) ?? null,
          cantidad: p.cantidad != null ? Number(p.cantidad) : null,
        })),
        total: Number(row.total ?? 0),
        total_pagado: Number(row.total_pagado ?? 0),
        saldo: Number(row.saldo ?? 0),
      }
    })
  })
}

// Info de Alegra (cliente, fechas, productos, dinero) indexada por
// alegra_id — usada por Corte/Fabricación/Soldadura/Pulido/Completadas
// para cruzar cada ticket con su orden de origen.
export async function fetchOrdenInfoMap (): Promise<Map<string, FacturaProduccion>> {
  const facturas = await fetchFacturasProduccion()
  return new Map(facturas.map(f => [f.alegra_id, f]))
}

// ─────────────────────────────────────────────────────────
// Sprint 1: puesto_capacidad + orden_movimientos
// Sistema alimentado por el sync de Google Calendar (separado de
// Producción/production_tickets). Sigue usándose en el Dashboard
// "Resumen" (estancadas, capacidad por área) — no se toca.
// ─────────────────────────────────────────────────────────

export interface PuestoCapacidad {
  id: string
  puesto: string
  limite_diario: number | null
  activo: boolean
  created_at: string
  updated_at: string
}

export interface OrdenMovimiento {
  id: string
  numero_orden: string
  calendar_event_id: string | null
  calendar_name: string | null
  pieza: string | null
  vehiculo: string | null
  cliente: string | null
  desde_puesto: string | null
  hacia_puesto: string
  tipo: 'ENTRADA' | 'CAMBIO_PUESTO' | 'SALIDA' | 'ESTANCADA' | string
  detalle: string | null
  dias_estancada: number
  confirmada: boolean
  ocurrido_en: string
  created_at: string
}

export async function fetchPuestosCapacidad (): Promise<PuestoCapacidad[]> {
  const { data, error } = await supabase
    .from('puesto_capacidad')
    .select('*')
    .eq('activo', true)
    .order('puesto', { ascending: true })
  if (error) throw new Error(error.message)
  return (data ?? []) as PuestoCapacidad[]
}

export async function fetchMovimientos (limit = 200): Promise<OrdenMovimiento[]> {
  const { data, error } = await supabase
    .from('orden_movimientos')
    .select('*')
    .order('ocurrido_en', { ascending: false })
    .limit(limit)
  if (error) throw new Error(error.message)
  return (data ?? []) as OrdenMovimiento[]
}
