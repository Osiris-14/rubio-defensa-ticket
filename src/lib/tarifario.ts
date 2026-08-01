// ─────────────────────────────────────────────────────────
// Emparejar el texto libre de la pieza (viene del título del evento de
// Google Calendar) con una fila limpia del tarifario.
//
// REGLA DURA: si no hay match de alta confianza se devuelve null. Nunca
// se devuelve 0 como si fuera un precio real — la UI muestra
// "— sin precio" y cuenta cuántas piezas quedaron fuera.
//
// El mapeo definitivo es una tarea aparte; aquí solo se casa lo que se
// puede casar sin inventar dinero.
// ─────────────────────────────────────────────────────────
import { type PriceCatalogRow } from './production-v2'

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
// NO se usa para decidir entre tarifas distintas (p. ej. "FRENTE" solo
// NO se resuelve a "Frente Normal" vs "Frente Camión" — eso es plata).
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

// Palabras demasiado genéricas para sostener un match por sí solas.
const VACIAS = new Set(['DE', 'DEL', 'LA', 'EL', 'CON', 'Y', 'PARA'])

function significativas (nombre: string): string[] {
  return canonizar(nombre)
    .split(' ')
    .filter(w => w.length >= 3 && !VACIAS.has(w))
}

export interface ResultadoTarifa {
  row: PriceCatalogRow
  /** Nombre limpio del tarifario con el que se casó. */
  piece_name: string
}

/**
 * Casa una pieza del calendario contra el tarifario.
 * Devuelve null si no hay match inequívoco.
 */
export function matchTarifa (
  pieza: string | null | undefined,
  catalogo: PriceCatalogRow[],
): ResultadoTarifa | null {
  if (!pieza) return null
  const texto = canonizar(pieza)
  if (!texto) return null

  let mejor: PriceCatalogRow | null = null
  let mejorPeso = 0

  for (const row of catalogo) {
    if (!row.active) continue
    const palabras = significativas(row.piece_name)
    if (!palabras.length) continue
    // Todas las palabras significativas del tarifario deben aparecer.
    const casaTodo = palabras.every(w => texto.includes(w))
    if (!casaTodo) continue
    // Gana el nombre más específico (más palabras exigidas).
    const peso = palabras.join(' ').length
    if (peso > mejorPeso) { mejor = row; mejorPeso = peso }
  }

  return mejor ? { row: mejor, piece_name: mejor.piece_name } : null
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
