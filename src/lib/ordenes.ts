import { supabase } from './supabase'
import {
  CALENDARIO_FILES,
  parseCSV,
  parseEventoArmador,
  type OrdenAlegra,
  type EventoArmador,
} from './ordenes-core'

export {
  normalizarOrden,
  parseEventoArmador,
  fechaCompromisoDesdeDia,
  primerDiaMesISO,
  labelArmador,
  parseCSV,
  formatoCorto,
  formatoLargo,
  type OrdenAlegra,
  type EventoArmador,
  type CompromisoRow,
} from './ordenes-core'

export async function fetchEventosArmador (): Promise<EventoArmador[]> {
  const eventos: EventoArmador[] = []
  for (const slug of CALENDARIO_FILES) {
    let res: Response
    try {
      res = await fetch(`/data/calendario_armadores/${slug}.csv`)
    } catch {
      continue
    }
    if (!res.ok) continue
    const text = await res.text()
    const rows = parseCSV(text)
    if (rows.length < 2) continue
    const header = rows[0].map(h => h.trim())
    const i = (name: string) => header.indexOf(name)
    const iTitulo = i('titulo')
    const iInicio = i('inicio')
    const iCal = i('calendario')
    const iColor = i('color_nombre')
    const iId = i('id')
    for (let r = 1; r < rows.length; r++) {
      const row = rows[r]
      const get = (idx: number) => (idx >= 0 ? (row[idx] ?? '').trim() : '')
      const titulo = get(iTitulo)
      if (!titulo) continue
      const parsed = parseEventoArmador(titulo)
      if (!parsed) continue
      eventos.push({ id: get(iId), titulo, inicio: get(iInicio), calendario: get(iCal), color_nombre: get(iColor), ...parsed })
    }
  }
  return eventos
}

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

const SELECT_ORDEN = 'alegra_id, factura, cliente, talonario, vehiculo, fecha, total, saldo, estado_cxc, pendiente_produccion'

function normalizeOrdenAlegra (r: Record<string, unknown>): OrdenAlegra {
  return {
    alegra_id: String(r.alegra_id ?? ''),
    factura: String(r.factura ?? ''),
    cliente: (r.cliente as string | null) ?? null,
    talonario: (r.talonario as string | null) ?? null,
    vehiculo: (r.vehiculo as string | null) ?? null,
    fecha: String(r.fecha ?? ''),
    total: Number(r.total ?? 0),
    saldo: Number(r.saldo ?? 0),
    estado_cxc: (r.estado_cxc as OrdenAlegra['estado_cxc']) ?? 'Open',
    pendiente_produccion: Boolean(r.pendiente_produccion),
  }
}

export async function fetchOrdenesDesde28 (hoy: Date): Promise<OrdenAlegra[]> {
  const desde = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-28`
  return withSelfHeal(async () => {
    const { data, error } = await supabase
      .schema('silver')
      .from('v_facturas_produccion')
      .select(SELECT_ORDEN)
      .gte('fecha', desde)
      .order('fecha', { ascending: false })
    if (error) throw new Error(error.message)
    return (data ?? []).map(r => normalizeOrdenAlegra(r as Record<string, unknown>))
  })
}

export async function fetchOrdenesMapa (): Promise<Map<string, OrdenAlegra>> {
  return withSelfHeal(async () => {
    const { data, error } = await supabase
      .schema('silver')
      .from('v_facturas_produccion')
      .select(SELECT_ORDEN)
    if (error) throw new Error(error.message)
    const map = new Map<string, OrdenAlegra>()
    for (const r of (data ?? []) as Record<string, unknown>[]) {
      const o = normalizeOrdenAlegra(r)
      if (o.talonario) map.set(o.talonario, o)
    }
    return map
  })
}

export async function fetchCompromisos (): Promise<Map<string, string>> {
  try {
    const { data, error } = await supabase
      .from('ordenes_fecha_compromiso')
      .select('orden, fecha')
    if (error) throw new Error(error.message)
    const map = new Map<string, string>()
    for (const r of (data ?? []) as Array<{ orden: string; fecha: string }>) map.set(String(r.orden), String(r.fecha))
    return map
  } catch {
    return new Map()
  }
}
