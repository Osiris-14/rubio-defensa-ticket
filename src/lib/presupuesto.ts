// ─────────────────────────────────────────────────────────
// Presupuesto / Cobros — calculado ÚNICAMENTE sobre production_tickets
// (el flujo nuevo de tickets por pieza) cruzado con el tarifario. No
// usa el calendario de Google ni puesto_capacidad — esos pertenecen al
// sistema anterior.
// ─────────────────────────────────────────────────────────
import { type ProductionTicketV3, type PriceCatalogRow } from './production-v2'

export interface PiezaPresupuesto {
  key: string
  pieza: string
  responsable: string
  estado: 'pendiente' | 'completado'
  /** YYYY-MM-DD, de created_at — para el filtro de Presupuesto por orden. */
  fechaCreada: string
  /** YYYY-MM-DD, de completado_en — para el filtro de Cobros. null si aún no se completó. */
  fechaCompletada: string | null
  /** Nombre del tarifario con el que casó (siempre == pieza si hay precio), o null si no hay precio activo. */
  tarifaNombre: string | null
  /** null = sin precio en el tarifario (nunca se reporta como RD$0). */
  monto: number | null
}

export interface OrdenPresupuesto {
  orden: string
  alegraId: string | null
  piezas: PiezaPresupuesto[]
  /** Suma de las piezas que sí tienen precio. */
  costo: number
  /** Cuántas piezas quedaron sin precio. */
  sinPrecio: number
}

/**
 * Agrupa los tickets de producción por orden y les pone precio según
 * el tarifario (production_price_catalog). Cada pieza del ticket ya es
 * un nombre exacto del tarifario (se eligió como chip al abrir el
 * ticket), así que el cruce es una igualdad directa, sin heurísticas.
 */
export function construirPresupuestos (
  tickets: ProductionTicketV3[],
  catalogo: PriceCatalogRow[],
): Map<string, OrdenPresupuesto> {
  const out = new Map<string, OrdenPresupuesto>()

  for (const t of tickets) {
    const key = t.alegra_id ?? t.numero_orden ?? t.id
    const fila = catalogo.find(r => r.active && r.piece_name === t.pieza) ?? null
    const montoRaw = fila ? Number(fila.fabrication_price_self_bent ?? 0) : null
    const monto = montoRaw != null && montoRaw > 0 ? montoRaw : null

    const pieza: PiezaPresupuesto = {
      key: t.id,
      pieza: t.pieza,
      responsable: t.responsable || 'Sin asignar',
      estado: t.estado,
      fechaCreada: (t.created_at || '').slice(0, 10),
      fechaCompletada: t.completado_en ? t.completado_en.slice(0, 10) : null,
      tarifaNombre: fila?.piece_name ?? null,
      monto,
    }

    const actual = out.get(key)
    if (actual) {
      actual.piezas.push(pieza)
      if (pieza.monto !== null) actual.costo += pieza.monto
      else actual.sinPrecio++
    } else {
      out.set(key, {
        orden: t.numero_orden || t.factura || '—',
        alegraId: t.alegra_id,
        piezas: [pieza],
        costo: pieza.monto ?? 0,
        sinPrecio: pieza.monto === null ? 1 : 0,
      })
    }
  }

  return out
}

/** Recorta cada orden a solo las piezas creadas dentro de [desde, hasta] (inclusive), recalculando costo/sinPrecio. Órdenes sin piezas en el rango se descartan. */
export function presupuestosEnRango (
  presupuestos: Map<string, OrdenPresupuesto>,
  desde: string,
  hasta: string,
): Map<string, OrdenPresupuesto> {
  const out = new Map<string, OrdenPresupuesto>()
  for (const [key, p] of presupuestos) {
    const piezas = p.piezas.filter(pz => pz.fechaCreada && pz.fechaCreada >= desde && pz.fechaCreada <= hasta)
    if (piezas.length === 0) continue
    const costo = piezas.reduce((s, pz) => s + (pz.monto ?? 0), 0)
    const sinPrecio = piezas.filter(pz => pz.monto === null).length
    out.set(key, { ...p, piezas, costo, sinPrecio })
  }
  return out
}

// ─────────────────────────────────────────────────────────
export interface CobroResponsable {
  responsable: string
  ordenes: number
  piezas: number
  /** Solo suma de piezas con precio. */
  monto: number
  sinPrecio: number
}

/**
 * Suma lo devengado por responsable en un rango de fechas [desde, hasta]
 * (ISO yyyy-mm-dd, inclusivas), contando solo piezas COMPLETADAS cuya
 * fecha de completado cae en el rango.
 */
export function cobrosPorResponsable (
  presupuestos: Map<string, OrdenPresupuesto>,
  desde: string,
  hasta: string,
): CobroResponsable[] {
  const mapa = new Map<string, CobroResponsable & { setOrdenes: Set<string> }>()

  for (const [orden, p] of presupuestos) {
    for (const pieza of p.piezas) {
      if (pieza.estado !== 'completado') continue
      if (!pieza.fechaCompletada || pieza.fechaCompletada < desde || pieza.fechaCompletada > hasta) continue
      let row = mapa.get(pieza.responsable)
      if (!row) {
        row = { responsable: pieza.responsable, ordenes: 0, piezas: 0, monto: 0, sinPrecio: 0, setOrdenes: new Set<string>() }
        mapa.set(pieza.responsable, row)
      }
      row.setOrdenes.add(orden)
      row.piezas++
      if (pieza.monto !== null) row.monto += pieza.monto
      else row.sinPrecio++
    }
  }

  return [...mapa.values()]
    .map(({ setOrdenes, ...r }) => ({ ...r, ordenes: setOrdenes.size }))
    .sort((a, b) => b.monto - a.monto)
}

/** ¿Hay al menos una pieza completada en TODO el set (sin filtrar por fecha)? */
export function hayCobrosRegistrados (presupuestos: Map<string, OrdenPresupuesto>): boolean {
  for (const p of presupuestos.values()) {
    if (p.piezas.some(pz => pz.estado === 'completado')) return true
  }
  return false
}

// ─────────────────────────────────────────────────────────
export function rangoSemana (hoy: Date): { desde: string; hasta: string } {
  const d = new Date(hoy)
  const dow = (d.getDay() + 6) % 7 // lunes = 0
  const lunes = new Date(d.getFullYear(), d.getMonth(), d.getDate() - dow)
  const domingo = new Date(lunes.getFullYear(), lunes.getMonth(), lunes.getDate() + 6)
  return { desde: iso(lunes), hasta: iso(domingo) }
}

export function rangoMes (hoy: Date): { desde: string; hasta: string } {
  const primero = new Date(hoy.getFullYear(), hoy.getMonth(), 1)
  const ultimo = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0)
  return { desde: iso(primero), hasta: iso(ultimo) }
}

export function iso (d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
