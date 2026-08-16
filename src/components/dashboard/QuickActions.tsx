'use client'
import { Download, RefreshCw } from 'lucide-react'

export type DashboardView = 'dashboard' | 'form' | 'tickets' | 'produccion'

interface Props {
  onNavigate: (view: DashboardView) => void
  onRefresh: () => void
  onExport: () => void
  lastUpdated: Date | null
  canExport?: boolean
}

export default function QuickActions ({ onRefresh, onExport, lastUpdated, canExport = true }: Props) {
  return (
    <div className='card' style={{ padding: 18, marginBottom: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', flexWrap: 'wrap', gap: 14 }}>
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
