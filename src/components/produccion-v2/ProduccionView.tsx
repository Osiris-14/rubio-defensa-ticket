'use client'
import { useState, useCallback } from 'react'
import { ChevronRight, Search, ArrowLeft } from 'lucide-react'
import OrdenesTab from './OrdenesTab'
import TicketsCompletadosTab from './TicketsCompletadosTab'

type Vista = 'produccion' | 'completados'

interface Props {
  user: { id: string; name: string; role: string }
}

export default function ProduccionView ({ user }: Props) {
  const [vista, setVista] = useState<Vista>('produccion')
  const [busqueda, setBusqueda] = useState('')
  const [alertas, setAlertas] = useState(0)
  const [reloadKey, setReloadKey] = useState(0)

  const reload = useCallback(() => { setReloadKey(k => k + 1) }, [])
  const handleAlertas = useCallback((n: number) => { setAlertas(n) }, [])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      {/* Migas */}
      <div className='workspace-header' style={{ padding: '24px 48px 0', flexShrink: 0 }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          fontSize: 12, color: '#999', fontWeight: 500, marginBottom: 14,
        }}>
          <span>Operación</span>
          <ChevronRight size={12} strokeWidth={2} style={{ color: '#BBB' }} />
          <span style={{ color: '#666', fontWeight: 600 }}>Producción</span>
        </div>

        {/* ── Top bar */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          flexWrap: 'wrap', marginBottom: 14,
        }}>
          <span style={{ fontSize: 15, fontWeight: 600, color: '#1A1A1A' }}>
            {vista === 'completados' ? 'Tickets completados' : 'Producción'}
          </span>

          {vista === 'produccion' && alertas > 0 && (
            <span style={{
              fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 9999,
              background: '#FDECEA', color: '#E8180A', whiteSpace: 'nowrap',
            }}>
              ⚠ {alertas} sin confirmar +2d
            </span>
          )}

          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            {vista === 'produccion' ? (
              <>
                <button
                  onClick={() => setVista('completados')}
                  style={{
                    background: '#fff', border: '0.5px solid #ECECEC', color: '#666',
                    fontSize: 11, padding: '6px 12px', borderRadius: 8,
                    cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 0.15s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.color = '#1A1A1A' }}
                  onMouseLeave={e => { e.currentTarget.style.color = '#666' }}
                >
                  Ver completados →
                </button>

                <div style={{ position: 'relative' }}>
                  <Search size={13} style={{
                    position: 'absolute', left: 10, top: '50%',
                    transform: 'translateY(-50%)', color: '#BBB',
                  }} />
                  <input
                    value={busqueda}
                    onChange={e => setBusqueda(e.target.value)}
                    placeholder='Buscar orden...'
                    style={{
                      height: 30, paddingLeft: 30, paddingRight: 10, width: 170, fontSize: 12,
                      background: '#F7F7F7', border: '0.5px solid #ECECEC', borderRadius: 8,
                      color: '#1A1A1A', outline: 'none',
                    }}
                  />
                </div>
              </>
            ) : (
              <button
                onClick={() => setVista('produccion')}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                  background: '#fff', border: '0.5px solid #ECECEC', color: '#666',
                  fontSize: 11, padding: '6px 12px', borderRadius: 8,
                  cursor: 'pointer', whiteSpace: 'nowrap',
                }}
              >
                <ArrowLeft size={12} /> Volver a Producción
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Contenido */}
      <div style={{ flex: 1, padding: '0 48px 80px', overflowY: 'auto' }}>
        {vista === 'produccion' ? (
          <OrdenesTab
            key={reloadKey}
            user={user}
            onChanged={reload}
            busqueda={busqueda}
            onAlertas={handleAlertas}
          />
        ) : (
          <div style={{ paddingTop: 16 }}>
            <TicketsCompletadosTab />
          </div>
        )}
      </div>
    </div>
  )
}
