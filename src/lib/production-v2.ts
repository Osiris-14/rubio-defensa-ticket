// =====================================================================
// Módulo de Producción — capa de lectura/escritura (cliente).
//
// v3: flujo de tickets por PIEZA impulsado por las facturas de Alegra.
// Sin calendarios, sin pasarela Corte→Doblado→Armado→Soldadura, sin
// precios. Un ticket = una pieza de una orden, con un responsable y un
// estado pendiente/completado.
//
// Se conservan las lecturas que siguen alimentando el Dashboard
// "Resumen" (presupuesto/cobros por puesto, calculados sobre el
// calendario de Google — sistema aparte que no se toca).
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
]

// ─────────────────────────────────────────────────────────
// Tipos — tickets de producción (v3: una fila por pieza)
// ─────────────────────────────────────────────────────────

export type EstadoTicket = 'pendiente' | 'completado'

export interface ProductionTicketV3 {
  id: string
  numero_orden: string | null
  factura: string | null
  alegra_id: string | null
  pieza: string
  responsable: string
  estado: EstadoTicket
  completado_en: string | null
  user_id: string | null
  user_name: string | null
  created_at: string
}

const SELECT_TICKET_V3 = 'id, numero_orden, factura, alegra_id, pieza, responsable, estado, completado_en, user_id, user_name, created_at'

// Producto de una factura de Alegra (columna jsonb `productos` de la vista silver).
export interface ProductoFactura {
  nombre: string | null
  descripcion: string | null
  cantidad: number | null
}

// Orden proveniente de Alegra (vista silver) aún sin ticket abierto.
export interface OrdenParaTicket {
  alegra_id: string
  factura: string
  cliente: string | null
  talonario: string | null
  fecha: string
  total: number
  total_pagado: number
  saldo: number
  productos: ProductoFactura[]
}

export interface ProductionKpisV3 {
  ordenes_activas: number
  tickets_pendientes: number
  tickets_completados: number
}

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
  return withSelfHeal(async () => {
    const { data: facturas, error } = await supabase
      .schema('silver')
      .from('v_facturas_produccion')
      .select('alegra_id, factura, cliente, talonario, fecha, total, total_pagado, saldo, productos')
      .gte('fecha', FECHA_DESDE_ORDENES)
      .order('fecha', { ascending: false })
    if (error) throw new Error(error.message)
    const raw = (facturas ?? []) as Record<string, unknown>[]

    const { data: existentes, error: existentesError } = await supabase
      .from('production_tickets')
      .select('alegra_id')
    if (existentesError) throw new Error(existentesError.message)
    const conTicket = new Set((existentes ?? []).map(r => r.alegra_id).filter(Boolean) as string[])

    return raw
      .filter(f => !conTicket.has(String(f.alegra_id)))
      .map(normalizeOrdenParaTicket)
  })
}

function normalizeOrdenParaTicket (r: Record<string, unknown>): OrdenParaTicket {
  const productosRaw = Array.isArray(r.productos) ? r.productos as Record<string, unknown>[] : []
  return {
    alegra_id: String(r.alegra_id ?? ''),
    factura: String(r.factura ?? ''),
    cliente: (r.cliente as string | null) ?? null,
    talonario: (r.talonario as string | null) ?? null,
    fecha: String(r.fecha ?? ''),
    total: Number(r.total ?? 0),
    total_pagado: Number(r.total_pagado ?? 0),
    saldo: Number(r.saldo ?? 0),
    productos: productosRaw.map(p => ({
      nombre: (p.nombre as string | null) ?? null,
      descripcion: (p.descripcion as string | null) ?? null,
      cantidad: p.cantidad != null ? Number(p.cantidad) : null,
    })),
  }
}

// ─────────────────────────────────────────────────────────
// Lecturas — tickets de producción (v3, por pieza)
// ─────────────────────────────────────────────────────────

export async function fetchProductionTicketsV3 (estado?: EstadoTicket): Promise<ProductionTicketV3[]> {
  let q = supabase.from('production_tickets').select(SELECT_TICKET_V3)
  if (estado) q = q.eq('estado', estado)
  q = q.order('created_at', { ascending: false })
  const { data, error } = await q
  if (error) throw new Error(error.message)
  return (data ?? []) as unknown as ProductionTicketV3[]
}

// Todos los tickets agrupados por alegra_id — para detectar qué
// órdenes están 100% completadas (tab "Órdenes Completadas").
export async function fetchOrdenesCompletadas (): Promise<Map<string, ProductionTicketV3[]>> {
  const { data, error } = await supabase
    .from('production_tickets')
    .select(SELECT_TICKET_V3)
    .order('created_at', { ascending: true })
  if (error) throw new Error(error.message)
  const rows = (data ?? []) as unknown as ProductionTicketV3[]

  const porOrden = new Map<string, ProductionTicketV3[]>()
  for (const t of rows) {
    const key = t.alegra_id ?? t.id
    const arr = porOrden.get(key) ?? []
    arr.push(t)
    porOrden.set(key, arr)
  }
  for (const [key, piezas] of porOrden) {
    if (!piezas.every(p => p.estado === 'completado')) porOrden.delete(key)
  }
  return porOrden
}

export async function fetchProductionKpisV3 (): Promise<ProductionKpisV3> {
  const { data, error } = await supabase
    .from('production_tickets')
    .select('numero_orden, alegra_id, estado')
  if (error) throw new Error(error.message)
  const rows = (data ?? []) as { numero_orden: string | null; alegra_id: string | null; estado: EstadoTicket }[]
  const pendientes = rows.filter(r => r.estado === 'pendiente')
  const ordenesActivas = new Set(pendientes.map(r => r.alegra_id ?? r.numero_orden))
  return {
    ordenes_activas: ordenesActivas.size,
    tickets_pendientes: pendientes.length,
    tickets_completados: rows.length - pendientes.length,
  }
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
  total: number
  total_pagado: number
  saldo: number
}

const SELECT_FACTURA = 'alegra_id, factura, talonario, cliente, vehiculo, fecha, total, total_pagado, saldo'

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
      return {
        alegra_id: String(row.alegra_id ?? ''),
        factura: String(row.factura ?? ''),
        talonario: (row.talonario as string | null) ?? null,
        cliente: (row.cliente as string | null) ?? null,
        vehiculo: (row.vehiculo as string | null) ?? null,
        fecha: String(row.fecha ?? ''),
        total: Number(row.total ?? 0),
        total_pagado: Number(row.total_pagado ?? 0),
        saldo: Number(row.saldo ?? 0),
      }
    })
  })
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
