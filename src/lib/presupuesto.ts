// ─────────────────────────────────────────────────────────
// Presupuesto por orden: cruza las piezas del calendario con el
// tarifario. Las piezas que no casan quedan con monto = null y se
// cuentan aparte — nunca se reportan como RD$0.
// ─────────────────────────────────────────────────────────
import { type EventoArmador } from './ordenes-core'
import { type PriceCatalogRow } from './production-v2'
import { matchTarifa, precioFabricacion, type ModoDoblado } from './tarifario'
import { etapaPuesto, labelPuesto, type EtapaPuesto } from './puestos'

const ETAPA_LABEL: Record<EtapaPuesto, string> = {
  corte: 'Corte',
  doblado: 'Doblado',
  fabricacion: 'Fabricación',
}

export interface PiezaPresupuesto {
  key: string
  pieza: string
  /** String crudo del calendario — llave de puesto_capacidad. */
  puesto: string
  puestoLabel: string
  etapa: EtapaPuesto
  /** "Fabricación · Puesto 4 · 8am-4pm" */
  etapaQuien: string
  fecha: string
  /** Nombre del tarifario con el que casó, o null. */
  tarifaNombre: string | null
  modo: ModoDoblado
  /** null = sin precio en el tarifario. */
  monto: number | null
}

export interface OrdenPresupuesto {
  orden: string
  piezas: PiezaPresupuesto[]
  /** Suma de las piezas que sí tienen precio. */
  costo: number
  /** Cuántas piezas quedaron sin precio. */
  sinPrecio: number
}

/**
 * Agrupa los eventos del calendario por orden y les pone precio.
 * `modo` se decide por orden: si pasó por un calendario de doblado
 * (David), las piezas se cobran como "me lo doblaron".
 */
export function construirPresupuestos (
  eventos: EventoArmador[],
  catalogo: PriceCatalogRow[],
): Map<string, OrdenPresupuesto> {
  // ¿La orden pasó por doblado?
  const doblada = new Set<string>()
  for (const ev of eventos) {
    if (!ev.orden) continue
    if (etapaPuesto(ev.calendario) === 'doblado') doblada.add(ev.orden)
  }

  const out = new Map<string, OrdenPresupuesto>()

  eventos.forEach((ev, i) => {
    if (!ev.orden) return
    const etapa = etapaPuesto(ev.calendario)
    const puestoLabel = labelPuesto(ev.calendario)
    const modo: ModoDoblado = doblada.has(ev.orden) ? 'other_bent' : 'self_bent'

    const match = matchTarifa(ev.pieza, catalogo)
    const monto = match ? precioFabricacion(match.row, modo) : null

    const pieza: PiezaPresupuesto = {
      key: `${ev.id || ev.orden}-${i}`,
      pieza: ev.pieza || '—',
      puesto: ev.calendario,
      puestoLabel,
      etapa,
      etapaQuien: `${ETAPA_LABEL[etapa]} · ${puestoLabel}`,
      fecha: (ev.inicio || '').slice(0, 10),
      tarifaNombre: match?.piece_name ?? null,
      modo,
      // Un match con precio 0 en el tarifario tampoco es un precio real.
      monto: monto && monto > 0 ? monto : null,
    }

    const actual = out.get(ev.orden)
    if (actual) {
      actual.piezas.push(pieza)
      if (pieza.monto !== null) actual.costo += pieza.monto
      else actual.sinPrecio++
    } else {
      out.set(ev.orden, {
        orden: ev.orden,
        piezas: [pieza],
        costo: pieza.monto ?? 0,
        sinPrecio: pieza.monto === null ? 1 : 0,
      })
    }
  })

  return out
}

// ─────────────────────────────────────────────────────────
export interface CobroPuesto {
  puesto: string
  label: string
  etapa: EtapaPuesto
  ordenes: number
  piezas: number
  /** Solo suma de piezas con precio. */
  monto: number
  sinPrecio: number
}

/**
 * Suma lo devengado por puesto en un rango de fechas [desde, hasta]
 * (ambas ISO yyyy-mm-dd, inclusivas).
 */
export function cobrosPorPuesto (
  presupuestos: Map<string, OrdenPresupuesto>,
  desde: string,
  hasta: string,
): CobroPuesto[] {
  const mapa = new Map<string, CobroPuesto & { setOrdenes: Set<string> }>()

  for (const [orden, p] of presupuestos) {
    for (const pieza of p.piezas) {
      if (!pieza.fecha || pieza.fecha < desde || pieza.fecha > hasta) continue
      let row = mapa.get(pieza.puesto)
      if (!row) {
        row = {
          puesto: pieza.puesto,
          label: pieza.puestoLabel,
          etapa: pieza.etapa,
          ordenes: 0,
          piezas: 0,
          monto: 0,
          sinPrecio: 0,
          setOrdenes: new Set<string>(),
        }
        mapa.set(pieza.puesto, row)
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

function iso (d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
