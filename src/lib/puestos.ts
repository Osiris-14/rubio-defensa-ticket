// ─────────────────────────────────────────────────────────
// Puestos: nombre bonito, etapa y color a partir del string crudo
// del calendario (que es también la llave de puesto_capacidad.puesto).
//
// La llave sigue siendo el string exacto del CSV para que el conteo de
// carga por puesto siga cuadrando; aquí solo se traduce a la etiqueta
// que ve el dueño.
// ─────────────────────────────────────────────────────────

export type EtapaPuesto = 'corte' | 'doblado' | 'fabricacion'

interface Regla {
  test: RegExp
  label: string
  etapa: EtapaPuesto
}

// El orden importa: la primera regla que casa gana (de más específica a
// más general).
const REGLAS: Regla[] = [
  { test: /\bDAVID\b|\bP\s*-?\s*13\b/, label: 'David · Doblador',        etapa: 'doblado' },
  { test: /PUESTO\s*2/,                label: 'Puesto 2 · Corte',        etapa: 'corte' },
  { test: /PUESTO\s*3\s*FELIPE/,       label: 'Puesto 3 Felipe',         etapa: 'fabricacion' },
  { test: /PUESTO\s*3/,                label: 'Puesto 3 Armador',        etapa: 'fabricacion' },
  { test: /EVE[NR]NOT/,                label: 'Puesto 4 Noche · Evernot', etapa: 'fabricacion' },
  { test: /PUESTO\s*4\s*DE\s*8\s*AM/,  label: 'Puesto 4 · 8am-4pm',      etapa: 'fabricacion' },
  { test: /PUESTO\s*4/,                label: 'Puesto 4',                etapa: 'fabricacion' },
  { test: /PUESTO\s*5/,                label: 'Puesto 5 · Oscar',        etapa: 'fabricacion' },
]

function regla (puesto: string | null): Regla | null {
  if (!puesto) return null
  const s = puesto.toUpperCase()
  return REGLAS.find(r => r.test.test(s)) ?? null
}

export function labelPuesto (puesto: string | null): string {
  if (!puesto) return '—'
  const r = regla(puesto)
  if (r) return r.label
  const limpio = puesto.replace(/\s+/g, ' ').trim()
  return limpio.length > 26 ? `${limpio.slice(0, 26)}…` : limpio
}

export function etapaPuesto (puesto: string | null): EtapaPuesto {
  return regla(puesto)?.etapa ?? 'fabricacion'
}

// Colores por etapa, del sistema aprobado.
export const COLOR_ETAPA: Record<EtapaPuesto, { bg: string; text: string; border: string }> = {
  corte:       { bg: '#FAEEDA', text: '#633806', border: '#F0D9A0' },
  doblado:     { bg: '#E6F1FB', text: '#0C447C', border: '#B8D4F0' },
  fabricacion: { bg: '#EAF3DE', text: '#3B6D11', border: '#C4DFA0' },
}

export const COLOR_CONFIRMADA = { bg: '#EAF3DE', text: '#3B6D11', border: '#C4DFA0' }
export const COLOR_NEUTRO = { bg: '#F7F7F7', text: '#666666', border: '#ECECEC' }

export function colorPuesto (puesto: string | null) {
  if (!puesto) return COLOR_NEUTRO
  return COLOR_ETAPA[etapaPuesto(puesto)]
}

// Iniciales para el avatar de "Cobros por puesto".
export function inicialesPuesto (puesto: string | null): string {
  const label = labelPuesto(puesto)
  const limpio = label.replace(/·/g, ' ')
  const palabras = limpio.split(/\s+/).filter(w => /[A-Za-zÁÉÍÓÚÑ0-9]/.test(w))
  if (!palabras.length) return '—'
  if (palabras.length === 1) return palabras[0].slice(0, 2).toUpperCase()
  // "Puesto 2 · Corte" → "P2"; "David · Doblador" → "DD"
  const a = palabras[0][0]
  const b = palabras[1][0]
  return `${a}${b}`.toUpperCase()
}
