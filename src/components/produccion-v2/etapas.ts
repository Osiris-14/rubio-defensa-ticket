// ─────────────────────────────────────────────────────────
// Modelo de presentación del tablero de etapas (Corte / Doblado / Fabricación).
// Puro: no toca Supabase ni el calendario. Consume los EventoArmador que
// OrdenesTab ya carga para "Proceso de armado".
// ─────────────────────────────────────────────────────────
import {
  fechaCompromisoDesdeDia,
  type EventoArmador,
  type OrdenAlegra,
} from '@/lib/ordenes-core'

export type Etapa = 'corte' | 'doblado' | 'fabricacion'

export const ETAPAS: Etapa[] = ['corte', 'doblado', 'fabricacion']

// El calendario donde cae el evento define el rol; el rol del conjunto de
// calendarios de la orden define en qué columna vive la orden.
export function rolCalendario (calendario: string): Etapa {
  const s = calendario.toUpperCase()
  if (/\bDAVID\b/.test(s) || /\bP\s*-?\s*13\b/.test(s)) return 'doblado'
  if (/PUESTO\s*2/.test(s)) return 'corte'
  return 'fabricacion'
}

// Reglas aprobadas:
//   solo Puesto 2                     → Corte
//   Puesto 2 + fabricador             → Fabricación (ya fue cortada)
//   David/P-13 + fabricador           → Doblado (David la dobló)
//   fabricador sin David              → Fabricación (el fabricador la dobló)
export function etapaDeOrden (roles: Set<Etapa>): Etapa {
  const fabrica = roles.has('fabricacion')
  const dobla = roles.has('doblado')
  if (dobla && fabrica) return 'doblado'
  if (fabrica) return 'fabricacion'
  if (dobla) return 'doblado'
  return 'corte'
}

// Sub-secciones de Fabricación, en el orden del mockup. Los puestos que no
// están en la lista (p. ej. Puesto 5) se muestran al final para no ocultar
// órdenes que sí existen en el calendario.
const PUESTOS_ORDEN = [
  'Puesto 2',
  'Puesto 3 Armador',
  'Puesto 3 Felipe (trasero)',
  'Puesto 4 (8am-4pm)',
  'Puesto 4 Noche (Evernot)',
]

export function labelPuesto (calendario: string): string {
  const s = calendario.toUpperCase()
  if (/EVE[NR]NOT/.test(s)) return 'Puesto 4 Noche (Evernot)'
  if (/PUESTO\s*4\s*DE\s*8\s*AM/.test(s)) return 'Puesto 4 (8am-4pm)'
  if (/PUESTO\s*4/.test(s)) return 'Puesto 4'
  if (/PUESTO\s*3\s*FELIPE/.test(s)) return 'Puesto 3 Felipe (trasero)'
  if (/PUESTO\s*3/.test(s)) return 'Puesto 3 Armador'
  if (/PUESTO\s*2/.test(s)) return 'Puesto 2'
  if (/PUESTO\s*5/.test(s)) return 'Puesto 5 (Oscar)'
  if (/\bDAVID\b/.test(s) || /\bP\s*-?\s*13\b/.test(s)) return 'David (P-13)'
  const limpio = calendario.replace(/\s+/g, ' ').trim()
  return limpio.length > 26 ? `${limpio.slice(0, 26)}…` : limpio
}

function pesoPuesto (label: string): number {
  const i = PUESTOS_ORDEN.indexOf(label)
  return i === -1 ? PUESTOS_ORDEN.length : i
}

// ─────────────────────────────────────────────────────────
export function isoLocal (d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function diasDesde (fechaISO: string, hoyISO: string): number {
  const a = Date.parse(`${fechaISO}T00:00:00Z`)
  const b = Date.parse(`${hoyISO}T00:00:00Z`)
  if (Number.isNaN(a) || Number.isNaN(b)) return 0
  return Math.round((b - a) / 86_400_000)
}

const DIAS_SEMANA = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

// "Hoy · 31" · "Vie · 1" · "Sáb · 2 ago" (el mes solo cuando no es el actual).
export function labelDia (fechaISO: string, hoyISO: string): string {
  const d = new Date(`${fechaISO}T00:00:00`)
  if (Number.isNaN(d.getTime())) return fechaISO
  const dia = d.getDate()
  if (fechaISO === hoyISO) return `Hoy · ${dia}`
  const mismoMes = fechaISO.slice(0, 7) === hoyISO.slice(0, 7)
  const mes = mismoMes ? '' : ` ${MESES[d.getMonth()]}`
  return `${DIAS_SEMANA[d.getDay()]} · ${dia}${mes}`
}

// Umbral de alerta: la fecha del calendario quedó a más de 2 días.
export const DIAS_ALERTA = 2

// ─────────────────────────────────────────────────────────
export interface TarjetaOrden {
  key: string
  orden: string
  pieza: string
  fecha: string
  puesto: string
  vehiculo: string | null
  cliente: string | null
  compromiso: string | null
  dias: number
  alerta: boolean
}

export interface GrupoPuesto {
  puesto: string
  tarjetas: TarjetaOrden[]
}

export interface GrupoDia {
  fecha: string
  label: string
  esHoy: boolean
  tarjetas: TarjetaOrden[]
  puestos: GrupoPuesto[]
}

export interface ColumnaEtapa {
  etapa: Etapa
  dias: GrupoDia[]
  ordenes: number
  alertas: number
}

export interface EtapasModel {
  columnas: ColumnaEtapa[]
  totalOrdenes: number
  totalAlertas: number
}

interface BuildParams {
  eventos: EventoArmador[]
  ordenesMap: Map<string, OrdenAlegra>
  compromisos: Map<string, string>
  hoy: Date
  confirmadas: Set<string>
  filtro?: string
}

export function buildEtapasModel ({
  eventos, ordenesMap, compromisos, hoy, confirmadas, filtro = '',
}: BuildParams): EtapasModel {
  const hoyISO = isoLocal(hoy)
  const q = filtro.trim().toLowerCase()

  // 1. Calendarios en los que aparece cada orden → etapa de la orden.
  const rolesPorOrden = new Map<string, Set<Etapa>>()
  for (const ev of eventos) {
    if (!ev.orden) continue
    let roles = rolesPorOrden.get(ev.orden)
    if (!roles) { roles = new Set(); rolesPorOrden.set(ev.orden, roles) }
    roles.add(rolCalendario(ev.calendario))
  }
  const etapaPorOrden = new Map<string, Etapa>()
  for (const [orden, roles] of rolesPorOrden) etapaPorOrden.set(orden, etapaDeOrden(roles))

  // 2. Una tarjeta por evento, pero solo los eventos del calendario que
  //    corresponde a la etapa donde vive la orden (así no se duplica).
  const tarjetas: Record<Etapa, TarjetaOrden[]> = { corte: [], doblado: [], fabricacion: [] }
  eventos.forEach((ev, i) => {
    if (!ev.orden) return
    const etapa = etapaPorOrden.get(ev.orden)
    if (!etapa || rolCalendario(ev.calendario) !== etapa) return
    if (q && !ev.orden.toLowerCase().includes(q)) return

    const fecha = (ev.inicio || '').slice(0, 10)
    if (!fecha) return

    const alegra = ordenesMap.get(ev.orden)
    const compCal = ev.dia != null ? fechaCompromisoDesdeDia(ev.dia, hoy) : null
    const dias = diasDesde(fecha, hoyISO)

    tarjetas[etapa].push({
      key: `${ev.id || ev.orden}-${i}`,
      orden: ev.orden,
      pieza: ev.pieza,
      fecha,
      puesto: labelPuesto(ev.calendario),
      vehiculo: alegra?.vehiculo ?? null,
      cliente: alegra?.cliente ?? null,
      compromiso: compCal ?? compromisos.get(ev.orden) ?? null,
      dias,
      alerta: dias > DIAS_ALERTA && !confirmadas.has(ev.orden),
    })
  })

  // 3. Agrupar por día (y por puesto dentro del día en Fabricación).
  const columnas = ETAPAS.map<ColumnaEtapa>(etapa => {
    const lista = tarjetas[etapa]
    const porDia = new Map<string, TarjetaOrden[]>()
    for (const t of lista) {
      const arr = porDia.get(t.fecha)
      if (arr) arr.push(t)
      else porDia.set(t.fecha, [t])
    }

    const dias = [...porDia.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map<GrupoDia>(([fecha, lote]) => {
        lote.sort(comparaTarjetas)
        return {
          fecha,
          label: labelDia(fecha, hoyISO),
          esHoy: fecha === hoyISO,
          tarjetas: lote,
          puestos: etapa === 'fabricacion' ? agrupaPorPuesto(lote) : [],
        }
      })

    return {
      etapa,
      dias,
      ordenes: new Set(lista.map(t => t.orden)).size,
      alertas: new Set(lista.filter(t => t.alerta).map(t => t.orden)).size,
    }
  })

  const ordenesUnicas = new Set<string>()
  const alertasUnicas = new Set<string>()
  for (const etapa of ETAPAS) {
    for (const t of tarjetas[etapa]) {
      ordenesUnicas.add(t.orden)
      if (t.alerta) alertasUnicas.add(t.orden)
    }
  }

  return { columnas, totalOrdenes: ordenesUnicas.size, totalAlertas: alertasUnicas.size }
}

function comparaTarjetas (a: TarjetaOrden, b: TarjetaOrden): number {
  if (a.alerta !== b.alerta) return a.alerta ? -1 : 1
  return a.orden.localeCompare(b.orden, 'es', { numeric: true })
}

function agrupaPorPuesto (tarjetas: TarjetaOrden[]): GrupoPuesto[] {
  const mapa = new Map<string, TarjetaOrden[]>()
  for (const t of tarjetas) {
    const arr = mapa.get(t.puesto)
    if (arr) arr.push(t)
    else mapa.set(t.puesto, [t])
  }
  return [...mapa.entries()]
    .map<GrupoPuesto>(([puesto, lote]) => ({ puesto, tarjetas: lote }))
    .sort((a, b) => {
      const pa = pesoPuesto(a.puesto)
      const pb = pesoPuesto(b.puesto)
      return pa !== pb ? pa - pb : a.puesto.localeCompare(b.puesto, 'es')
    })
}
