// Runner: ejecuta un archivo .sql contra Postgres usando `pg`.
// Uso:  DATABASE_URL="postgresql://postgres.<ref>:<pass>@aws-0-<region>.pooler.supabase.com:6543/postgres" \
//       node scripts/run_sql.mjs scripts/verify_step1.sql
// Múltiples statements: se ejecutan como un solo batch (client.query soporta varios).
import { readFileSync } from 'node:fs'
import pg from 'pg'

const url = process.env.DATABASE_URL
if (!url) { console.error('ERROR: falta DATABASE_URL'); process.exit(1) }
const file = process.argv[2]
if (!file) { console.error('ERROR: falta ruta al .sql'); process.exit(1) }

const sql = readFileSync(file, 'utf8')
const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } })

const run = async () => {
  await client.connect()
  // simple_query permite múltiples statements y devuelve un array de results
  const res = await client.query(sql)
  const results = Array.isArray(res) ? res : [res]
  for (const r of results) {
    if (r && r.command && r.rows && r.rows.length) {
      console.log(`\n--- ${r.command} (${r.rowCount} filas) ---`)
      console.table(r.rows)
    } else if (r && r.command) {
      console.log(`--- ${r.command} ok (${r.rowCount ?? 0}) ---`)
    }
  }
  await client.end()
}
run().catch(async (e) => { console.error('SQL ERROR:', e.message); try { await client.end() } catch {} ; process.exit(1) })
