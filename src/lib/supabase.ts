import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export type UserRole = 'recepcion' | 'produccion' | 'pintura' | 'instalacion' | 'marquilla' | 'admin'

export interface UserProfile {
  id: string
  user_id: string
  name: string
  role: UserRole
  area: string
  created_at: string
}

export const ROLE_LABELS: Record<UserRole, string> = {
  recepcion: 'Recepción',
  produccion: 'Producción',
  pintura: 'Pintura',
  instalacion: 'Instalación',
  marquilla: 'Marquilla',
  admin: 'Administrador',
}

export const ROLE_COLORS: Record<UserRole, string> = {
  recepcion: '#4488ff',
  produccion: '#ffc800',
  pintura: '#E8180A',
  instalacion: '#00c864',
  marquilla: '#aa44ff',
  admin: '#ffffff',
}

export const PIEZAS_OPTIONS = [
  'Delantero', 'Trasero', 'Estribos', 'Parrilla',
  'Porta escalera', 'Cachucha', 'Mini Cachucha', 'Barillero',
  'Protector de Batería', 'Protector de tanque', 'Porta pies',
  'Maletero', 'Canasto'
]
