// Central visual system for each area — icon, colors used consistently everywhere.
import { Car, Settings, Paintbrush, Wrench, Tag, SprayCan, type LucideIcon } from 'lucide-react'
import type { UserRole } from './store'

export interface AreaTheme {
  icon: LucideIcon
  bg: string
  text: string
  borderTop: string
}

export const AREA_THEME: Record<UserRole, AreaTheme> = {
  recepcion:   { icon: Car,       bg: '#E6F1FB', text: '#185FA5', borderTop: '#378ADD' },
  produccion:  { icon: Settings,  bg: '#FAEEDA', text: '#854F0B', borderTop: '#BA7517' },
  pintura:     { icon: Paintbrush, bg: '#FCEBEB', text: '#A32D2D', borderTop: '#E8180A' },
  instalacion: { icon: Wrench,    bg: '#EAF3DE', text: '#3B6D11', borderTop: '#3B6D11' },
  marquilla:   { icon: Tag,       bg: '#EEEDFE', text: '#534AB7', borderTop: '#534AB7' },
  ferre:       { icon: SprayCan,  bg: '#FFF3E0', text: '#e07b00', borderTop: '#e07b00' },
  // Admin is the neutral / overview color (red).
  admin:       { icon: Tag,       bg: '#FFF0EF', text: '#E8180A', borderTop: '#E8180A' },
}
