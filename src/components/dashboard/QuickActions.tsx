'use client'
import { Plus, CalendarDays, Gauge, Wallet, Settings, Download, RefreshCw, type LucideIcon } from 'lucide-react'

export type DashboardView = 'dashboard' | 'form' | 'tickets' | 'produccion' | 'pagos' | 'calendario' | 'capacidad'

interface Action {
  id: string
  label: string
  icon: LucideIcon
  tone: 'red' | 'blue' | 'amber' | 'green' | 'gray'
  onClick: () => void
}

interface Props {
  onNavigate: (view: DashboardView) => void
  onRefresh: () => void
  onExport: () => void
  lastUpdated: Date | null
  canExport?: boolean
}

const toneStyles: Record<Action['tone'], { bg: string; color: string; border: string }> = {
  red:   { bg: 'var(--red-50)',   color: 'var(--red)',   border: 'var(--red-ring)' },
  blue:  { bg: 'var(--blue-bg)',  color: 'var(--blue)',  border: 'var(--blue-ring)' },
  amber: { bg: 'var(--amber-bg)', color: 'var(--amber)', border: 'var(--amber-ring)' },
  green: { bg: 'var(--green-bg)', color: 'var(--green)', border: 'var(--green-ring)' },
  gray:  { bg: 'var(--gray-50)',  color: 'var(--gray-700)', border: 'var(--border)' },
}

export default function QuickActions ({ onNavigate, onRefresh, onExport, lastUpdated, canExport = true }: Props) {
  const actions: Action[] = [
    { id: 'new',      label: 'Nuevo ticket',  icon: Plus,         tone: 'red',   onClick: () => onNavigate('form') },
    { id: 'cal',      label: 'Calendario',    icon: CalendarDays, tone: 'blue',  onClick: () => onNavigate('calendario') },
    { id: 'cap',      label: 'Capacidad',     icon: Gauge,        tone: 'amber', onClick: () => onNavigate('capacidad') },
    { id: 'pay',      label: 'Pagos',         icon: Wallet,       tone: 'green', onClick: () => onNavigate('pagos') },
  ]

  return (
    <div className='card' style={{ padding: 18, marginBottom: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 14 }}>
        <div>
          <div style={{ fontSize: 11, color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700, marginBottom: 4 }}>
            Acceso rápido
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            {actions.map(a => {
              const t = toneStyles[a.tone]
              const Icon = a.icon
              return (
                <button
                  key={a.id}
                  onClick={a.onClick}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 7,
                    padding: '8px 14px', borderRadius: 'var(--radius)',
                    background: t.bg, color: t.color,
                    border: `1px solid ${t.border}`,
                    fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
                    transition: 'all 0.15s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 4px 10px rgba(0,0,0,0.06)' }}
                  onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none' }}
                >
                  <Icon size={13} strokeWidth={2} />
                  {a.label}
                </button>
              )
            })}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {lastUpdated && (
            <span style={{ fontSize: 11, color: 'var(--gray-500)' }}>
              Actualizado {formatRelative(lastUpdated)}
            </span>
          )}
          <button onClick={onRefresh} className='btn btn-secondary btn-sm' title='Refrescar datos'>
            <RefreshCw size={12} /> Refrescar
          </button>
          {canExport && (
            <button onClick={onExport} className='btn btn-secondary btn-sm' title='Exportar CSV'>
              <Download size={12} /> CSV
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function formatRelative (date: Date): string {
  const diff = Math.floor((Date.now() - date.getTime()) / 1000)
  if (diff < 5) return 'ahora mismo'
  if (diff < 60) return `hace ${diff}s`
  if (diff < 3600) return `hace ${Math.floor(diff / 60)}m`
  return date.toLocaleTimeString('es-DO', { hour: '2-digit', minute: '2-digit' })
}
