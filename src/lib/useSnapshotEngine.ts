'use client'
// ─────────────────────────────────────────────────────────
// Snapshot engine: detects order movements from CSV delta
// Compares current EventoArmador[] against last known DB state
// and inserts orden_movimientos rows for each delta found.
// Runs client-side on every calendar refresh.
// ─────────────────────────────────────────────────────────
import { useCallback, useRef } from 'react'
import { type EventoArmador } from '@/lib/ordenes-core'
import { type OrdenAlegra } from '@/lib/ordenes'
import {
  insertMovimiento,
  fetchLatestSnapshotPerOrden,
} from '@/lib/production-v2'

const STAGNATION_DAYS = 2

function daysDiff (iso: string): number {
  const then = new Date(iso).getTime()
  const now = Date.now()
  return Math.floor((now - then) / (1000 * 60 * 60 * 24))
}

export function useSnapshotEngine () {
  // Avoid running twice concurrently
  const running = useRef(false)

  const runSnapshot = useCallback(async (
    eventos: EventoArmador[],
    ordenesMap: Map<string, OrdenAlegra>,
  ) => {
    if (running.current) return
    running.current = true
    try {
      // Build current state: order → set of calendar names it appears in
      const currentState = new Map<string, { calendars: Set<string>; pieza: string; eventId: string }>()
      for (const ev of eventos) {
        if (!ev.orden) continue
        const existing = currentState.get(ev.orden)
        if (existing) {
          existing.calendars.add(ev.calendario)
        } else {
          currentState.set(ev.orden, {
            calendars: new Set([ev.calendario]),
            pieza: ev.pieza,
            eventId: ev.id,
          })
        }
      }

      // Fetch last known snapshot from DB (one row per order, most recent ENTRADA/CAMBIO_PUESTO)
      const lastSnapshot = await fetchLatestSnapshotPerOrden()

      // Detect ENTRADA and CAMBIO_PUESTO
      for (const [orden, state] of currentState.entries()) {
        const orden_data = ordenesMap.get(orden)
        const vehiculo = orden_data?.vehiculo ?? null
        const cliente = orden_data?.cliente ?? null
        const hacia_puesto = [...state.calendars].join(', ')

        const last = lastSnapshot.get(orden)

        if (!last) {
          // New order — ENTRADA
          await insertMovimiento({
            numero_orden: orden,
            calendar_event_id: state.eventId || null,
            calendar_name: hacia_puesto,
            pieza: state.pieza || null,
            vehiculo,
            cliente,
            desde_puesto: null,
            hacia_puesto,
            tipo: 'ENTRADA',
            detalle: `Orden ${orden} apareció en ${hacia_puesto}`,
            dias_estancada: 0,
            confirmada: false,
          })
        } else if (last.hacia_puesto !== hacia_puesto) {
          // Puesto changed — CAMBIO_PUESTO
          await insertMovimiento({
            numero_orden: orden,
            calendar_event_id: state.eventId || null,
            calendar_name: hacia_puesto,
            pieza: state.pieza || null,
            vehiculo,
            cliente,
            desde_puesto: last.hacia_puesto,
            hacia_puesto,
            tipo: 'CAMBIO_PUESTO',
            detalle: `Orden ${orden} pasó de ${last.hacia_puesto} a ${hacia_puesto}`,
            dias_estancada: 0,
            confirmada: false,
          })
        } else {
          // Same puesto — check stagnation
          const dias = daysDiff(last.ocurrido_en)
          if (dias >= STAGNATION_DAYS && last.tipo !== 'ESTANCADA') {
            await insertMovimiento({
              numero_orden: orden,
              calendar_event_id: state.eventId || null,
              calendar_name: hacia_puesto,
              pieza: state.pieza || null,
              vehiculo,
              cliente,
              desde_puesto: hacia_puesto,
              hacia_puesto,
              tipo: 'ESTANCADA',
              detalle: `Orden ${orden} lleva ${dias} días en ${hacia_puesto} sin cambio`,
              dias_estancada: dias,
              confirmada: false,
            })
          }
        }
      }

      // Detect SALIDA: orders in lastSnapshot that are no longer in CSV
      for (const [orden, last] of lastSnapshot.entries()) {
        if (!currentState.has(orden) && last.tipo !== 'SALIDA') {
          const orden_data = ordenesMap.get(orden)
          await insertMovimiento({
            numero_orden: orden,
            calendar_event_id: null,
            calendar_name: null,
            pieza: last.pieza,
            vehiculo: orden_data?.vehiculo ?? last.vehiculo,
            cliente: orden_data?.cliente ?? last.cliente,
            desde_puesto: last.hacia_puesto,
            hacia_puesto: last.hacia_puesto,
            tipo: 'SALIDA',
            detalle: `Orden ${orden} salió de ${last.hacia_puesto}`,
            dias_estancada: 0,
            confirmada: false,
          })
        }
      }
    } finally {
      running.current = false
    }
  }, [])

  return { runSnapshot }
}
