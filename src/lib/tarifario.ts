// ─────────────────────────────────────────────────────────
// Emparejar el texto libre de la pieza (viene del título del evento de
// Google Calendar) con una fila limpia del tarifario.
//
// REGLA DURA: si no hay match de alta confianza se devuelve null. Nunca
// se devuelve 0 como si fuera un precio real — la UI muestra
// "Sin clasificar" y cuenta cuántas piezas quedaron fuera.
//
// Orden del algoritmo (dado por el dueño):
//   1. Coincidencia exacta con el nombre del tarifario.
//   2. Casos ambiguos con regla de exclusión explícita (Frente,
//      Trasero, Canasto — el texto puede tener la palabra en cualquier
//      posición, no solo pegada a "Camión"/"Grande"/"NV350").
//   3. Resto de alias, en orden de especificidad (el más específico
//      primero, para que "ESTRIBOS CON TUBO" no caiga en "Estribos").
//   4. Sin match → null ("Sin clasificar").
// ─────────────────────────────────────────────────────────
import { type PriceCatalogRow } from './production-v2'

export const SIN_CLASIFICAR = 'Sin clasificar'

function normalizar (s: string): string {
  return s
    .toUpperCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

// Variantes morfológicas seguras: misma palabra, distinto género/número.
// NO se usa para decidir entre tarifas distintas (eso lo resuelven las
// reglas de ambigüedad de abajo).
const SINONIMOS: Array<[RegExp, string]> = [
  [/\bTRASERA\b/g, 'TRASERO'],
  [/\bTRASERAS\b/g, 'TRASERO'],
  [/\bTRASEROS\b/g, 'TRASERO'],
  [/\bESTRIBO\b/g, 'ESTRIBOS'],
  [/\bCANASTOS\b/g, 'CANASTO'],
  [/\bPARRILLAS\b/g, 'PARRILLA'],
  [/\bMALETEROS\b/g, 'MALETERO'],
]

function canonizar (s: string): string {
  let out = normalizar(s)
  for (const [re, rep] of SINONIMOS) out = out.replace(re, rep)
  return out
}

function contieneAlguna (texto: string, ...palabras: string[]): boolean {
  return palabras.some(p => texto.includes(p))
}

export interface ResultadoTarifa {
  row: PriceCatalogRow
  /** Nombre limpio del tarifario con el que se casó. */
  piece_name: string
  /** Accesorios detectados en el texto que no tienen precio propio en el tarifario (p. ej. "Porta Pies"). */
  accesorios?: string[]
}

// ── Alias por clave del tarifario, en orden de especificidad. ──
// Frente, Trasero y Canasto NO van aquí: tienen regla de exclusión
// dedicada (ver matchAmbiguos) porque su alias depende de si "Camión",
// "Grande" o "NV350"/"NV" aparecen EN CUALQUIER PARTE del texto.
interface Regla { key: string; alias: string[] }

const REGLAS: Regla[] = [
  { key: 'Estribos con Tubito', alias: ['ESTRIBOS CON TUBO', 'ESTRIBOS TUBITO'] },
  { key: 'Porta Escalera', alias: ['PORTA ESCALERA'] },
  { key: 'Juego Grande (Coaster)', alias: ['JUEGO COASTER', 'COASTER COMPLETO', 'JUEGO GRANDE'] },
  { key: 'Cachucha KIA', alias: ['CACHUCHA KIA', 'CACHUCHA K'] },
  { key: 'Mini Cachucha isuzu,fuso', alias: ['MINI CACHUCHA', 'CACHUCHA ISUZU', 'CACHUCHA FUSO'] },
  { key: 'Filos de Cama', alias: ['FILOS DE CAMA', 'FILO CAMA', 'FILOS'] },
  { key: 'Espaldal Cama Camión', alias: ['ESPALDAL', 'ESPALDAR'] },
  { key: 'Juego Protector Tanque', alias: ['PROTECTOR TANQUE', 'TANQUE'] },
  { key: 'Juego Completo', alias: ['JUEGO COMPLETO', 'KIT COMPLETO', 'COMPLETA', 'COMPLETO'] },
  { key: 'Estribos', alias: ['ESTRIBOS'] },
  { key: 'Parrilla', alias: ['PARRILLA', 'GRILLE'] },
  { key: 'Varillero', alias: ['VARILLERO'] },
  { key: 'Mini Escalera', alias: ['MINI ESCALERA', 'ESCALERA'] },
  { key: 'Tubo Cabina', alias: ['TUBO CABINA', 'TUBO'] },
  { key: 'Maletero', alias: ['MALETERO'] },
]

function buscarFila (key: string, catalogo: PriceCatalogRow[]): PriceCatalogRow | null {
  const objetivo = normalizar(key)
  return catalogo.find(r => r.active && normalizar(r.piece_name) === objetivo) ?? null
}

/** Frente / Trasero / Canasto: la palabra puede aparecer en cualquier
 *  parte del texto, no solo pegada al modificador. */
function matchAmbiguos (texto: string, catalogo: PriceCatalogRow[]): ResultadoTarifa | null {
  if (contieneAlguna(texto, 'FRENTE', 'FRONTAL', 'DELANTERA')) {
    const esCamion = contieneAlguna(texto, 'CAMION', 'GRANDE')
    const key = esCamion ? 'Frente Camión / Grande' : 'Frente Normal'
    const row = buscarFila(key, catalogo)
    if (row) return { row, piece_name: key }
  }

  if (contieneAlguna(texto, 'TRASERO')) {
    const esGrande = contieneAlguna(texto, 'GRANDE')
    const key = esGrande ? 'Trasero Grande' : 'Trasero'
    const row = buscarFila(key, catalogo)
    if (row) return { row, piece_name: key }
  }

  if (contieneAlguna(texto, 'CANASTO')) {
    const esNV = contieneAlguna(texto, 'NV350', 'NV')
    const key = esNV ? 'Canasto NV350' : 'Canasto'
    const row = buscarFila(key, catalogo)
    if (row) return { row, piece_name: key }
  }

  return null
}

function matchPorAlias (texto: string, catalogo: PriceCatalogRow[]): ResultadoTarifa | null {
  const ambiguo = matchAmbiguos(texto, catalogo)
  if (ambiguo) return ambiguo

  for (const regla of REGLAS) {
    if (regla.alias.some(a => texto.includes(a))) {
      const row = buscarFila(regla.key, catalogo)
      if (row) return { row, piece_name: regla.key }
    }
  }
  return null
}

// "PORTA PIES" no está en el tarifario. Si aparece junto a un Frente
// (p. ej. "FRENTE+PORTA PIES") se anota como accesorio, no se pierde.
function detectarAccesorios (texto: string): string[] {
  const out: string[] = []
  if (texto.includes('PORTA PIES') && contieneAlguna(texto, 'FRENTE', 'FRONTAL', 'DELANTERA')) {
    out.push('Porta Pies')
  }
  return out
}

/**
 * Casa una pieza del calendario contra el tarifario.
 * Devuelve null si no hay match ("Sin clasificar").
 */
export function matchTarifa (
  pieza: string | null | undefined,
  catalogo: PriceCatalogRow[],
): ResultadoTarifa | null {
  if (!pieza) return null
  const texto = canonizar(pieza)
  if (!texto) return null

  // 1. Coincidencia exacta con el nombre del tarifario.
  const exacto = catalogo.find(r => r.active && normalizar(r.piece_name) === texto)
  const base = exacto
    ? { row: exacto, piece_name: exacto.piece_name }
    : matchPorAlias(texto, catalogo)

  if (!base) return null

  const accesorios = detectarAccesorios(texto)
  return accesorios.length ? { ...base, accesorios } : base
}

export type ModoDoblado = 'self_bent' | 'other_bent'

/**
 * Precio de fabricación según quién dobló la pieza.
 *   other_bent → pasó por David (me lo doblaron)
 *   self_bent  → el fabricador la dobló él mismo (doblé yo)
 */
export function precioFabricacion (row: PriceCatalogRow, modo: ModoDoblado): number {
  return modo === 'self_bent'
    ? Number(row.fabrication_price_self_bent ?? 0)
    : Number(row.fabrication_price_other_bent ?? 0)
}

export function etiquetaTarifa (row: PriceCatalogRow, modo: ModoDoblado): string {
  const monto = precioFabricacion(row, modo)
  const nombre = modo === 'self_bent' ? 'Doblé yo' : 'Me lo doblaron'
  return `${nombre} · ${formatoNumero(monto)}`
}

// ─────────────────────────────────────────────────────────
export function formatoNumero (n: number): string {
  return new Intl.NumberFormat('es-DO', { maximumFractionDigits: 0 }).format(Math.round(n))
}

export function formatoMoneda (n: number): string {
  return `RD$ ${formatoNumero(n)}`
}
