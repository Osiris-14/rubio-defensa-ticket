export interface OrdenAlegra {
  alegra_id: string
  factura: string
  cliente: string | null
  talonario: string | null
  vehiculo: string | null
  fecha: string
  total: number
  saldo: number
  estado_cxc: 'Open' | 'Atraso' | 'Cerrado'
  pendiente_produccion: boolean
}

export interface EventoArmador {
  id: string
  titulo: string
  inicio: string
  calendario: string
  color_nombre: string
  pieza: string
  orden: string
  dia: number | null
}

export interface CompromisoRow {
  orden: string
  fecha: string
}

export const CALENDARIO_FILES = [
  'armador_evennot',
  'armador_puesto2',
  'armador_puesto3',
  'armador_puesto4',
  'armador_puesto5',
]

const PIEZA_KEYWORDS = [
  'FRENTE', 'TRASERA', 'TRASERO', 'ESTRIBOS', 'PORTA', 'PARRILLA', 'CACHUCHA',
  'RIBETE', 'LATERAL', 'PUERTA', 'REPOSA', 'PROTECTOR', 'BARILLERO', 'MALETERO',
  'CANASTO', 'PISA PIES', 'PISA', 'DEFENSA', 'K2700', 'MIRA', 'REPARACION',
  'REPARAR', 'REPARA', 'MODIFICACION', 'MODIFICAR',
]

function isoDate (d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function normalizarOrden (raw: string): string {
  const m = raw.trim().replace(/^0+/, '')
  return m === '' ? raw.trim() : m
}

export function parseEventoArmador (titulo: string): { pieza: string; orden: string; dia: number | null } | null {
  if (!titulo) return null
  const t = titulo.trim()
  const up = t.toUpperCase()

  const ordenMatch = up.match(/(?:(\d{4})ORDEN|ORDEN)\s*0*(\d{3,4})(?:\s*DIA\s*(\d{1,2}))?/)
  if (ordenMatch) {
    const index = ordenMatch.index ?? 0
    const pieza = t.slice(0, index).replace(/[\s\-:;,]+$/, '').trim()
    const orden = normalizarOrden(ordenMatch[2])
    const dia = ordenMatch[3] != null ? parseInt(ordenMatch[3], 10) : null
    return { pieza: pieza || t, orden, dia }
  }

  if (/\bORDEN\b/i.test(up) || /\dORDEN/i.test(up)) return null

  const diaMatch = up.match(/\bDIA\s*(\d{1,2})\b/)
  const dia = diaMatch != null ? parseInt(diaMatch[1], 10) : null
  const sinDia = up.replace(/\bDIA\s*\d{1,2}\b/g, '').replace(/[\s\-:;,]+$/, '')

  const numMatch = sinDia.match(/(?:^|\s)(\d{3,4})\s*$/)
  if (!numMatch) return null

  const num = numMatch[1]
  if (/\d-\s*\d{3,4}\s*$/.test(sinDia) || /,\s*\d{3,4}\s*$/.test(sinDia)) return null

  if (!PIEZA_KEYWORDS.some(k => up.includes(k))) return null

  const pieza = t.replace(/\bDIA\s*\d{1,2}\b/gi, '').replace(/[\s\-:;,]+$/, '').trim()

  return {
    pieza: pieza || t,
    orden: normalizarOrden(num),
    dia,
  }
}

export function fechaCompromisoDesdeDia (dia: number, hoy: Date): string | null {
  if (!Number.isFinite(dia) || dia < 1 || dia > 31) return null
  const y = hoy.getFullYear()
  const m = hoy.getMonth()

  let target = new Date(y, m, dia)
  if (target.getMonth() !== m) target = new Date(y, m + 1, 0)

  if (target.getDate() < hoy.getDate()) {
    target = new Date(y, m + 1, dia)
    if (target.getMonth() !== ((m + 1) % 12)) target = new Date(y, m + 2, 0)
  }

  return isoDate(target)
}

export function primerDiaMesISO (hoy: Date): string {
  return isoDate(new Date(hoy.getFullYear(), hoy.getMonth(), 1))
}

export function labelArmador (calendario: string): string {
  const s = calendario.toUpperCase()
  if (s.includes('EVENNOT')) return 'EVENNOT (5PM-9PM)'
  if (/PUESTO\s*2/.test(s)) return 'Puesto 2'
  if (/PUESTO\s*3/.test(s)) return 'Puesto 3'
  if (/PUESTO\s*4\s*DE\s*8AM/.test(s)) return 'Puesto 4 (8AM-4PM)'
  if (/PUESTO\s*4/.test(s)) return 'Puesto 4'
  if (/PUESTO\s*5/.test(s)) return 'Puesto 5'
  const clean = calendario.replace(/\s+/g, ' ').trim()
  return clean.length > 24 ? clean.slice(0, 24) + '…' : clean
}

export function parseCSV (text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++ } else quoted = false
      } else field += c
    } else if (c === '"') {
      quoted = true
    } else if (c === ',') {
      row.push(field); field = ''
    } else if (c === '\n') {
      row.push(field); rows.push(row); row = []; field = ''
    } else if (c !== '\r') {
      field += c
    }
  }
  if (field !== '' || row.length > 0) { row.push(field); rows.push(row) }
  return rows
}

export function formatoCorto (fechaISO: string): string {
  const [ , m, d] = fechaISO.split('-')
  return `${d}/${m}`
}

export function formatoLargo (fechaISO: string): string {
  const [y, m, d] = fechaISO.split('-')
  const meses = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
  return `${d} ${meses[parseInt(m, 10) - 1]} ${y}`
}
