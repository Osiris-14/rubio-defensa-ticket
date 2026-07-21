// =====================================================================
// Importador del catálogo de precios (tarifario) -> Supabase
//
// Lee scripts/production_price_catalog.csv y llama al RPC
// public.import_price_catalog(json) para hacer upsert.
//
// Uso:
//   node scripts/import_price_catalog.mjs
//
// Variables de entorno (lee desde .env.local automáticamente):
//   NEXT_PUBLIC_SUPABASE_URL
//   NEXT_PUBLIC_SUPABASE_ANON_KEY
//
// O pásalas explícitamente:
//   NEXT_PUBLIC_SUPABASE_URL=... NEXT_PUBLIC_SUPABASE_ANON_KEY=... node scripts/import_price_catalog.mjs
// =====================================================================
import { readFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const projectRoot = join(__dirname, '..')

// Cargar .env.local manualmente (sin depender de dotenv)
function loadEnvFile () {
  const envPath = join(projectRoot, '.env.local')
  if (!existsSync(envPath)) return
  const content = readFileSync(envPath, 'utf8')
  for (const line of content.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    const value = trimmed.slice(eq + 1).trim()
    if (!process.env[key]) process.env[key] = value
  }
}
loadEnvFile()

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('ERROR: falta NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY')
  process.exit(1)
}

const CSV_PATH = process.argv[2] || join(projectRoot, 'scripts', 'production_price_catalog.csv')
if (!existsSync(CSV_PATH)) {
  console.error(`ERROR: no se encontró el CSV en ${CSV_PATH}`)
  process.exit(1)
}

// --- Parser CSV mínimo (maneja campos entrecomillados con comas internas) ---
function parseCsv (text) {
  const rows = []
  let row = []
  let field = ''
  let inQuotes = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++ } else { inQuotes = false }
      } else { field += ch }
    } else {
      if (ch === '"') { inQuotes = true }
      else if (ch === ',') { row.push(field); field = '' }
      else if (ch === '\n') { row.push(field); rows.push(row); row = []; field = '' }
      else if (ch === '\r') { /* skip */ }
      else { field += ch }
    }
  }
  if (field !== '' || row.length > 0) { row.push(field); rows.push(row) }
  return rows.filter(r => r.some(c => c.trim() !== ''))
}

const raw = readFileSync(CSV_PATH, 'utf8')
// BOM-safe
const clean = raw.replace(/^\uFEFF/, '')
const rows = parseCsv(clean)
if (rows.length < 2) {
  console.error('ERROR: el CSV no tiene filas de datos')
  process.exit(1)
}

const headers = rows[0].map(h => h.trim())
const expected = [
  'piece_name', 'ferre_price', 'paint_price', 'decoration_price',
  'fabrication_price_other_bent', 'fabrication_price_self_bent', 'welding_price'
]
for (const e of expected) {
  if (!headers.includes(e)) {
    console.error(`ERROR: falta la columna "${e}" en el CSV. Encontradas: ${headers.join(', ')}`)
    process.exit(1)
  }
}

const records = rows.slice(1).map(r => {
  const obj = {}
  headers.forEach((h, i) => { obj[h] = (r[i] ?? '').trim() })
  return {
    piece_name: obj.piece_name,
    ferre_price: Number(obj.ferre_price) || 0,
    paint_price: Number(obj.paint_price) || 0,
    decoration_price: Number(obj.decoration_price) || 0,
    fabrication_price_other_bent: Number(obj.fabrication_price_other_bent) || 0,
    fabrication_price_self_bent: Number(obj.fabrication_price_self_bent) || 0,
    welding_price: Number(obj.welding_price) || 0,
    active: true
  }
})

console.log(`Importando ${records.length} piezas desde:\n  ${CSV_PATH}\n`)

const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/import_price_catalog`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${SUPABASE_KEY}`
  },
  body: JSON.stringify({ p_rows: records })
})

if (!res.ok) {
  const text = await res.text()
  console.error(`ERROR (${res.status}):`, text)
  console.error('\nAsegúrate de haber ejecutado primero la migración:')
  console.error('  supabase/migrations/20260720000000_production_module.sql')
  process.exit(1)
}

const data = await res.json()
console.log('Resultado:', data)
if (Array.isArray(data) && data[0]) {
  console.log(`\n✔ Importación completa: ${data[0].inserted} insertadas, ${data[0].updated} actualizadas`)
} else {
  console.log('\n✔ Importación completada')
}
