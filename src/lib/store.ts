// Supabase-backed data layer.
// Auth is custom (DEMO_USERS below), not Supabase Auth — tickets carry a plain
// `user_id` TEXT + `user_name`. RLS is disabled on the ticket tables.
import { supabase } from './supabase'

export type UserRole = 'recepcion' | 'produccion' | 'pintura' | 'instalacion' | 'marquilla' | 'ferre' | 'admin'

export interface AppUser {
  id: string
  username: string
  name: string
  role: UserRole
  password: string
}

export const DEMO_USERS: AppUser[] = [
  { id: '1', username: 'recepcion', name: 'Carlos Martínez', role: 'recepcion', password: '1234' },
  { id: '2', username: 'produccion', name: 'Luis García', role: 'produccion', password: '1234' },
  { id: '3', username: 'pintura', name: 'Pedro Rodríguez', role: 'pintura', password: '1234' },
  { id: '4', username: 'instalacion', name: 'Juan Torres', role: 'instalacion', password: '1234' },
  { id: '5', username: 'marquilla', name: 'Ana López', role: 'marquilla', password: '1234' },
  { id: '6', username: 'admin', name: 'Administrador', role: 'admin', password: 'admin123' },
  { id: '7', username: 'ferre', name: 'Área Ferré', role: 'ferre', password: '1234' },
]

export const ROLE_LABELS: Record<UserRole, string> = {
  recepcion: 'Recepción',
  produccion: 'Producción',
  pintura: 'Pintura',
  instalacion: 'Instalación',
  marquilla: 'Marquilla',
  ferre: 'Ferré (Preparación)',
  admin: 'Administrador',
}

// Accent (border-top) color per area — kept in sync with AREA_THEME.
export const ROLE_COLORS: Record<UserRole, string> = {
  recepcion: '#378ADD',
  produccion: '#BA7517',
  pintura: '#E8180A',
  instalacion: '#3B6D11',
  marquilla: '#534AB7',
  ferre: '#e07b00',
  admin: '#E8180A',
}

export const PIEZAS_OPTIONS = [
  'Delantero', 'Trasero', 'Estribos', 'Parrilla',
  'Porta escalera', 'Cachucha', 'Mini Cachucha', 'Barillero',
  'Protector de Batería', 'Protector de tanque', 'Porta pies',
  'Maletero', 'Canasto'
]

// The area tables (admin is a view across all of them, not its own table).
export const AREA_ROLES: UserRole[] = ['recepcion', 'produccion', 'pintura', 'instalacion', 'marquilla', 'ferre']

// Postgres rejects '' for DATE/TIME columns, so blank fields become null.
// The forms send a `fotos` object; the schema column is `fotos_urls`.
function toRow(data: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(data)) {
    if (key === 'fotos') { out.fotos_urls = value; continue }
    out[key] = value === '' ? null : value
  }
  return out
}

export async function saveTicket(role: UserRole, data: Record<string, unknown>): Promise<void> {
  const { error } = await supabase.from(`tickets_${role}`).insert(toRow(data))
  if (error) throw new Error(error.message)
}

export async function getTickets(role: UserRole): Promise<Record<string, unknown>[]> {
  const { data, error } = await supabase
    .from(`tickets_${role}`)
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  // Tag each row with its area so combined/admin views know where it came from.
  return (data ?? []).map(row => ({ ...row, role }))
}

export async function getAllTickets(): Promise<Record<string, unknown>[]> {
  const results = await Promise.all(AREA_ROLES.map(r => getTickets(r)))
  return results
    .flat()
    .sort((a, b) =>
      new Date(b.created_at as string).getTime() - new Date(a.created_at as string).getTime()
    )
}

export async function getStatsForRole(role: UserRole) {
  const tickets = role === 'admin' ? await getAllTickets() : await getTickets(role)
  const now = new Date()
  const today = now.toDateString()
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

  return {
    total: tickets.length,
    today: tickets.filter(t => new Date(t.created_at as string).toDateString() === today).length,
    week: tickets.filter(t => new Date(t.created_at as string) >= weekAgo).length,
    month: tickets.filter(t => new Date(t.created_at as string) >= monthAgo).length,
    retrabajos: tickets.filter(t => t.re_trabajo === 'Si').length,
  }
}

const CSV_SKIP = ['fotos', 'fotos_urls']

export async function ticketsToCSV(role: UserRole): Promise<string> {
  const tickets = role === 'admin' ? await getAllTickets() : await getTickets(role)
  if (tickets.length === 0) return ''
  const headers = Object.keys(tickets[0]).filter(k => !CSV_SKIP.includes(k)).join(',')
  const rows = tickets.map(t =>
    Object.entries(t)
      .filter(([k]) => !CSV_SKIP.includes(k))
      .map(([, v]) => {
        const val = Array.isArray(v) ? (v as string[]).join(';') : String(v ?? '')
        return `"${val.replace(/"/g, '""')}"`
      })
      .join(',')
  )
  return [headers, ...rows].join('\n')
}
