// ─────────────────────────────────────────────────────────
// Modelo de la vista Producción: pestañas por etapa
// (Corte · Doblado · Fabricación), órdenes agrupadas por día y
// filtro Día / Semana / Mes.
//
// Puro: no toca Supabase ni el calendario. Consume los EventoArmador
// y las facturas que ya carga la vista.
// ─────────────────────────────────────────────────────────
import {
  fechaCompromisoDesdeDia,
  type EventoArmador,
} from '@/lib/ordenes-core'
import { type FacturaProduccion } from '@/lib/production-v2'

export type Etapa = 'corte' | 'doblado' | 'fabricacion'
export type Periodo = 'dia' | 'semana' | 'mes'

export const ETAPAS: Etapa[] = ['corte', 'doblado', 'fabricacion']

// Umbral con el que la vista silver ya considera cerrada una factura.
const UMBRAL_SALDO = 450

export const DIAS_ALERTA = 2

// ─────────────────────────────────────────────────────────
// Nombres EXACTOS de los calendarios, dados por el dueño. No se
// infieren desde las etiquetas de la UI ni por patrones sueltos.
//
// La comparación normaliza mayúsculas y espacios repetidos, porque el
// CSV trae 'PUESTO 2 ARMADOR ' (espacio final) y
// 'EVENNOT  PUESTO 4  5PM-9PM' (espacios dobles).
// ─────────────────────────────────────────────────────────
interface CalendarioConocido {
  valor: string
  etapa: Etapa
  label: string
}

const CALENDARIOS: CalendarioConocido[] = [
  // Corte
  { valor: 'PUESTO 2 ARMADOR',         etapa: 'corte',       label: 'Puesto 2' },
  // Doblado
  { valor: 'P-13 DEIVI DOBLADOR',      etapa: 'doblado',     label: 'David (P-13)' },
  { valor: 'DAVID P-13',               etapa: 'doblado',     label: 'David (P-13)' },
  // Fabricación
  { valor: 'ENCARGADO DE FABRICACION', etapa: 'fabricacion', label: 'Encargado de Fabricación' },
  { valor: 'PUESTO 3 ARMADOR',         etapa: 'fabricacion', label: 'Puesto 3 Armador' },
  { valor: 'PUESTO 3 FELIPE TRASER',   etapa: 'fabricacion', label: 'Puesto 3 Felipe' },
  { valor: 'PUESTO 4 DE 8AM 4PM',      etapa: 'fabricacion', label: 'Puesto 4 día' },
  { valor: 'EVENNOT PUESTO 4 5PM-9PM', etapa: 'fabricacion', label: 'Puesto 4 Noche' },
  { valor: 'puesto 5 oscar',           etapa: 'fabricacion', label: 'Puesto 5 Oscar' },
]

function clave (calendario: string): string {
  return calendario.toUpperCase().replace(/\s+/g, ' ').trim()
}

const POR_CLAVE = new Map(CALENDARIOS.map(c => [clave(c.valor), c]))

export function rolCalendario (calendario: string): Etapa {
  // Un calendario desconocido cae en Fabricación para que sus órdenes
  // sigan siendo visibles en vez de desaparecer sin aviso.
  return POR_CLAVE.get(clave(calendario))?.etapa ?? 'fabricacion'
}

// Reglas aprobadas, decididas con TODOS los puestos de la orden:
//   solo Puesto 2                 → Corte
//   Puesto 2 + fabricador         → Fabricación (ya fue cortada)
//   David + fabricador            → Doblado
//   fabricador sin David          → Fabricación
export function etapaDeOrden (roles: Set<Etapa>): Etapa {
  const fabrica = roles.has('fabricacion')
  const dobla = roles.has('doblado')
  if (dobla && fabrica) return 'doblado'
  if (fabrica) return 'fabricacion'
  if (dobla) return 'doblado'
  return 'corte'
}

// Sub-secciones dentro de Fabricación, en el orden del mockup.
const PUESTOS_ORDEN = [
  'Puesto 2',
  'Puesto 3 Armador',
  'Puesto 3 Felipe',
  'Puesto 4 día',
  'Puesto 4 Noche',
  'Encargado de Fabricación',
  'Puesto 5 Oscar',
]

export function labelPuesto (calendario: string): string {
  const conocido = POR_CLAVE.get(clave(calendario))
  if (conocido) return conocido.label
  const limpio = calendario.replace(/\s+/g, ' ').trim()
  return limpio.length > 24 ? `${limpio.slice(0, 24)}…` : limpio
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
const MESES_CORTO = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
const MESES_LARGO = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

// "Hoy · 31" · "Dom · 28"
export function labelDia (fechaISO: string, hoyISO: string): string {
  const d = new Date(`${fechaISO}T00:00:00`)
  if (Number.isNaN(d.getTime())) return fechaISO
  const dia = d.getDate()
  if (fechaISO === hoyISO) return `Hoy · ${dia}`
  return `${DIAS_SEMANA[d.getDay()]} · ${dia}`
}

// ─────────────────────────────────────────────────────────
export interface Rango {
  desde: string
  hasta: string
  /** "Hoy · 1 agosto 2026" · "Semana 27 jul – 2 ago" · "Agosto 2026" */
  label: string
}

export function rangoDe (periodo: Periodo, hoy: Date): Rango {
  if (periodo === 'dia') {
    const iso = isoLocal(hoy)
    return {
      desde: iso,
      hasta: iso,
      label: `Hoy · ${hoy.getDate()} ${MESES_LARGO[hoy.getMonth()]} ${hoy.getFullYear()}`,
    }
  }

  if (periodo === 'semana') {
    const dow = (hoy.getDay() + 6) % 7 // lunes = 0
    const lunes = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - dow)
    const domingo = new Date(lunes.getFullYear(), lunes.getMonth(), lunes.getDate() + 6)
    return {
      desde: isoLocal(lunes),
      hasta: isoLocal(domingo),
      label: `Semana ${lunes.getDate()} ${MESES_CORTO[lunes.getMonth()]} – ${domingo.getDate()} ${MESES_CORTO[domingo.getMonth()]}`,
    }
  }

  const primero = new Date(hoy.getFullYear(), hoy.getMonth(), 1)
  const ultimo = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0)
  const nombre = MESES_LARGO[hoy.getMonth()]
  return {
    desde: isoLocal(primero),
    hasta: isoLocal(ultimo),
    label: `${nombre.charAt(0).toUpperCase()}${nombre.slice(1)} ${hoy.getFullYear()}`,
  }
}

// ─────────────────────────────────────────────────────────
export interface DatosAlegra {
  factura: string
  productos: string[]
  total: number
  saldo: number
  pagada: boolean
}

export interface TarjetaOrden {
  key: string
  orden: string
  pieza: string
  fecha: string
  puesto: string
  puestoLabel: string
  vehiculo: string | null
  cliente: string | null
  compromiso: string | null
  dias: number
  alerta: boolean
  /** null = la orden no casó con ninguna factura de Alegra. */
  alegra: DatosAlegra | null
}

export interface GrupoPuesto {
  puesto: string
  tarjetas: TarjetaOrden[]
}

export interface GrupoDia {
  fecha: string
  label: string
  esHoy: boolean
  ordenes: number
  tarjetas: TarjetaOrden[]
  puestos: GrupoPuesto[]
}

export interface DatosEtapa {
  etapa: Etapa
  dias: GrupoDia[]
  ordenes: number
  alertas: number
}

export interface ModeloProduccion {
  etapas: Record<Etapa, DatosEtapa>
  rango: Rango
  totalAlertas: number
}

interface BuildParams {
  eventos: EventoArmador[]
  facturas: FacturaProduccion[]
  compromisos: Map<string, string>
  hoy: Date
  confirmadas: Set<string>
  periodo: Periodo
  filtro?: string
}

export function buildModelo ({
  eventos, facturas, compromisos, hoy, confirmadas, periodo, filtro = '',
}: BuildParams): ModeloProduccion {
  const hoyISO = isoLocal(hoy)
  const rango = rangoDe(periodo, hoy)
  const q = filtro.trim().toLowerCase()

  // Factura por número de orden (talonario).
  const porTalonario = new Map<string, FacturaProduccion>()
  for (const f of facturas) if (f.talonario) porTalonario.set(f.talonario, f)

  // 1. Etapa por orden — con TODOS sus puestos, no solo los del rango.
  const roles = new Map<string, Set<Etapa>>()
  for (const ev of eventos) {
    if (!ev.orden) continue
    let set = roles.get(ev.orden)
    if (!set) { set = new Set(); roles.set(ev.orden, set) }
    set.add(rolCalendario(ev.calendario))
  }
  const etapaPorOrden = new Map<string, Etapa>()
  for (const [orden, rs] of roles) etapaPorOrden.set(orden, etapaDeOrden(rs))

  // 2. Tarjetas dentro del rango visible.
  const porEtapa: Record<Etapa, TarjetaOrden[]> = { corte: [], doblado: [], fabricacion: [] }

  eventos.forEach((ev, i) => {
    if (!ev.orden) return
    const fecha = (ev.inicio || '').slice(0, 10)
    if (!fecha || fecha < rango.desde || fecha > rango.hasta) return
    if (q && !ev.orden.toLowerCase().includes(q)) return

    const etapa = etapaPorOrden.get(ev.orden) ?? 'corte'
    const factura = porTalonario.get(ev.orden) ?? null
    const compCal = ev.dia != null ? fechaCompromisoDesdeDia(ev.dia, hoy) : null
    const dias = diasDesde(fecha, hoyISO)

    porEtapa[etapa].push({
      key: `${ev.id || ev.orden}-${i}`,
      orden: ev.orden,
      pieza: ev.pieza,
      fecha,
      puesto: ev.calendario,
      puestoLabel: labelPuesto(ev.calendario),
      vehiculo: factura?.vehiculo ?? null,
      cliente: factura?.cliente ?? null,
      compromiso: compCal ?? compromisos.get(ev.orden) ?? null,
      dias,
      alerta: dias > DIAS_ALERTA && !confirmadas.has(ev.orden),
      alegra: factura
        ? {
            factura: factura.factura,
            productos: factura.productos,
            total: factura.total,
            saldo: factura.saldo,
            pagada: factura.saldo <= UMBRAL_SALDO,
          }
        : null,
    })
  })

  // 3. Agrupar por día (y por puesto dentro del día en Fabricación).
  const etapas = {} as Record<Etapa, DatosEtapa>
  for (const etapa of ETAPAS) {
    const lista = porEtapa[etapa]
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
          ordenes: new Set(lote.map(t => t.orden)).size,
          tarjetas: lote,
          puestos: etapa === 'fabricacion' ? agrupaPorPuesto(lote) : [],
        }
      })

    etapas[etapa] = {
      etapa,
      dias,
      ordenes: new Set(lista.map(t => t.orden)).size,
      alertas: new Set(lista.filter(t => t.alerta).map(t => t.orden)).size,
    }
  }

  const alertasUnicas = new Set<string>()
  for (const etapa of ETAPAS) {
    for (const t of porEtapa[etapa]) if (t.alerta) alertasUnicas.add(t.orden)
  }

  return { etapas, rango, totalAlertas: alertasUnicas.size }
}

function comparaTarjetas (a: TarjetaOrden, b: TarjetaOrden): number {
  if (a.alerta !== b.alerta) return a.alerta ? -1 : 1
  return a.orden.localeCompare(b.orden, 'es', { numeric: true })
}

function agrupaPorPuesto (tarjetas: TarjetaOrden[]): GrupoPuesto[] {
  const mapa = new Map<string, TarjetaOrden[]>()
  for (const t of tarjetas) {
    const arr = mapa.get(t.puestoLabel)
    if (arr) arr.push(t)
    else mapa.set(t.puestoLabel, [t])
  }
  return [...mapa.entries()]
    .map<GrupoPuesto>(([puesto, lote]) => ({ puesto, tarjetas: lote }))
    .sort((a, b) => {
      const pa = pesoPuesto(a.puesto)
      const pb = pesoPuesto(b.puesto)
      return pa !== pb ? pa - pb : a.puesto.localeCompare(b.puesto, 'es')
    })
}
