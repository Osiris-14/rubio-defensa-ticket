'use client'
import { ChevronRight } from 'lucide-react'
import { AREA_THEME } from '@/lib/areaTheme'
import { type UserRole } from '@/lib/store'

interface Props {
  ticket: Record<string, unknown>
  role: UserRole
  onClick?: () => void
}

export default function TicketRow({ ticket, role, onClick }: Props) {
  const theme = AREA_THEME[role] || AREA_THEME.admin
  const Icon = theme.icon
  const factura = String(ticket.numero_factura || '-')
  const modelo = String(ticket.modelo || '-')
  const orden = String(ticket.numero_orden || '')
  const date = ticket.created_at
    ? new Date(ticket.created_at as string).toLocaleDateString('es-DO', { day: '2-digit', month: '2-digit', year: '2-digit' })
    : '-'

  return (
    <div
      onClick={onClick}
      className="ticket-row"
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: '#F7F7F7', borderRadius: '8px', padding: '12px 14px', marginBottom: '8px',
        cursor: onClick ? 'pointer' : 'default',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
        <div style={{
          width: '30px', height: '30px', borderRadius: '8px',
          background: theme.bg, color: theme.text,
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <Icon size={16} />
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: '12px', fontWeight: 500, color: '#111' }}>{factura}</div>
          <div style={{ fontSize: '10.5px', color: '#999', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {modelo}{orden ? ` · ${orden}` : ''}
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
        <span style={{ fontSize: '10px', color: '#bbb' }}>{date}</span>
        <ChevronRight size={16} style={{ color: '#ccc' }} />
      </div>
    </div>
  )
}
