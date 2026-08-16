'use client'
import { useState, useCallback } from 'react'
import { ChevronRight, Search } from 'lucide-react'
import OrdenesTab from './OrdenesTab'
import TicketsPendientesTab from './TicketsPendientesTab'
import TicketsCompletadosTab from './TicketsCompletadosTab'
import OrdenesCompletadasTab from './OrdenesCompletadasTab'

type Vista = 'ordenes' | 'pendientes' | 'completados' | 'ordenes-completadas'

interface Props {
  user: { id: string; name: string; role: string }
}

const TABS: { id: Vista; label: string }[] = [
  { id: 'ordenes', label: 'Órdenes' },
  { id: 'pendientes', label: 'Tickets Pendientes' },
  { id: 'completados', label: 'Tickets Completados' },
  { id: 'ordenes-completadas', label: 'Órdenes Completadas' },
]

export default function ProduccionView ({ user }: Props) {
  const [vista, setVista] = useState<Vista>('ordenes')
  const [busqueda, setBusqueda] = useState('')
  const [reloadKey, setReloadKey] = useState(0)

  const reload = useCallback(() => { setReloadKey(k => k + 1) }, [])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      {/* Migas + tabs */}
      <div className='workspace-header' style={{ padding: '24px 48px 0', flexShrink: 0 }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          fontSize: 12, color: 'var(--gray-500)', fontWeight: 500, marginBottom: 14,
        }}>
          <span>Operación</span>
          <ChevronRight size={12} strokeWidth={2} style={{ color: 'var(--gray-400)' }} />
          <span style={{ color: 'var(--gray-700)', fontWeight: 600 }}>Producción</span>
        </div>

        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          flexWrap: 'wrap' as const, marginBottom: 14,
        }}>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' as const }}>
            {TABS.map(t => (
              <button
                key={t.id}
                onClick={() => setVista(t.id)}
                style={{
                  padding: '8px 14px', borderRadius: 'var(--radius)', border: 'none',
                  background: vista === t.id ? 'var(--red)' : 'transparent',
                  color: vista === t.id ? '#fff' : 'var(--gray-600)',
                  fontSize: 12.5, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' as const,
                  transition: 'all 0.15s',
                }}
              >
                {t.label}
              </button>
            ))}
          </div>

          {vista === 'ordenes' && (
            <div style={{ marginLeft: 'auto', position: 'relative' }}>
              <Search size={13} style={{
                position: 'absolute', left: 10, top: '50%',
                transform: 'translateY(-50%)', color: 'var(--gray-400)',
              }} />
              <input
                value={busqueda}
                onChange={e => setBusqueda(e.target.value)}
                placeholder='Buscar orden...'
                style={{
                  height: 34, paddingLeft: 30, paddingRight: 10, width: 190, fontSize: 12.5,
                  background: 'var(--gray-50)', border: '1px solid var(--border)', borderRadius: 8,
                  color: 'var(--gray-900)', outline: 'none',
                }}
              />
            </div>
          )}
        </div>
      </div>

      {/* Contenido */}
      <div style={{ flex: 1, padding: '16px 48px 80px', overflowY: 'auto' }}>
        {vista === 'ordenes' && (
          <OrdenesTab key={reloadKey} user={user} busqueda={busqueda} onChanged={reload} />
        )}
        {vista === 'pendientes' && <TicketsPendientesTab />}
        {vista === 'completados' && <TicketsCompletadosTab />}
        {vista === 'ordenes-completadas' && <OrdenesCompletadasTab />}
      </div>
    </div>
  )
}
