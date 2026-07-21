'use client'
import { useEffect, useState, useMemo } from 'react'
import { AlertTriangle, Clock, CalendarClock, ArrowRight, AlertCircle } from 'lucide-react'
import { fetchProductionTickets, type ProductionTicket } from '@/lib/production-v2'

interface Props {
  onOpenCapacidad: () => void
}

type Tone = 'red' | 'amber' | 'green'

export default function AttentionWidget ({ onOpenCapacidad }: Props) {
  const [tickets, setTickets] = useState<ProductionTicket[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    fetchProductionTickets('pendiente')
      .then(t => { if (active) { setTickets(t); setLoading(false) } })
      .catch(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), [])
  const threeDaysStr = useMemo(() => {
    const d = new Date(); d.setDate(d.getDate() + 3)
    return d.toISOString().slice(0, 10)
  }, [])

  const retrasados = useMemo(() =>
    tickets.filter(t => t.fecha_programada && t.fecha_programada < todayStr)
  , [tickets, todayStr])

  const proximos = useMemo(() =>
    tickets.filter(t => t.fecha_programada && t.fecha_programada >= todayStr && t.fecha_programada <= threeDaysStr)
  , [tickets, todayStr, threeDaysStr])

  const items: { title: string; icon: React.ComponentType<{ size?: number; style?: React.CSSProperties }>; tone: Tone; list: ProductionTicket[] }[] = [
    { title: 'Retrasados', icon: AlertTriangle, tone: 'red', list: retrasados },
    { title: 'Próximos 3d', icon: Clock, tone: 'amber', list: proximos },
  ]

  const total = retrasados.length + proximos.length
  const tone: Tone = retrasados.length > 0 ? 'red' : proximos.length > 0 ? 'amber' : 'green'
  const toneColor = tone === 'red' ? 'var(--red)' : tone === 'amber' ? 'var(--amber)' : 'var(--green)'
  const toneBg = tone === 'red' ? 'var(--red-50)' : tone === 'amber' ? 'var(--amber-bg)' : 'var(--green-bg)'

  return (
    <div className='card' style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', height: '100%', borderTop: `2px solid ${toneColor}` }}>
      <div style={{
        padding: '14px 18px', borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', gap: 10, background: toneBg,
      }}>
        <AlertCircle size={15} style={{ color: toneColor }} />
        <span style={{ fontSize: 13, fontWeight: 700, color: toneColor, flex: 1 }}>
          {total > 0 ? `${total} ticket${total !== 1 ? 's' : ''} requieren atención` : 'Todo en orden'}
        </span>
        <span style={{
          fontSize: 11, fontWeight: 700, color: toneColor,
          background: 'var(--bg-card)', padding: '2px 8px', borderRadius: 9999,
        }}>{total}</span>
      </div>

      {loading ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--gray-400)', fontSize: 12, padding: 24 }}>Cargando…</div>
      ) : total === 0 ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', padding: 24, color: 'var(--gray-500)', fontSize: 12, textAlign: 'center', gap: 6 }}>
          <span style={{ fontSize: 24 }}>✓</span>
          Sin tickets retrasados ni próximos
        </div>
      ) : (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          {items.map(({ title, icon: Icon, tone: t, list }) => {
            const tColor = t === 'red' ? 'var(--red)' : 'var(--amber)'
            return (
              <div key={title} style={{ padding: '12px 18px', borderBottom: '1px solid var(--border-subtle)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                  <Icon size={12} style={{ color: tColor }} />
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-700)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{title}</span>
                  <span style={{ fontSize: 11, color: 'var(--gray-500)', fontWeight: 600 }}>({list.length})</span>
                </div>
                {list.length === 0 ? (
                  <div style={{ fontSize: 11, color: 'var(--gray-400)', fontStyle: 'italic' }}>Ninguno</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {list.slice(0, 3).map(t => (
                      <div key={t.id} style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        fontSize: 11.5, padding: '4px 0',
                      }}>
                        <span style={{ fontWeight: 600, color: 'var(--gray-900)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 180 }}>
                          {t.orden ?? t.vehiculo ?? '—'}
                        </span>
                        <span style={{ fontSize: 10.5, color: 'var(--gray-500)', flexShrink: 0 }}>
                          {t.fecha_programada ? formatDateShort(t.fecha_programada) : '—'}
                        </span>
                      </div>
                    ))}
                    {list.length > 3 && (
                      <div style={{ fontSize: 10.5, color: 'var(--gray-400)', marginTop: 2 }}>
                        +{list.length - 3} más…
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      <button onClick={onOpenCapacidad} style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        padding: '12px', fontSize: 12, fontWeight: 600,
        color: 'var(--gray-700)', background: 'var(--bg-page)',
        border: 'none', borderTop: '1px solid var(--border)', cursor: 'pointer',
        transition: 'background 0.15s',
      }}
      onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-card-hover)'}
      onMouseLeave={e => e.currentTarget.style.background = 'var(--bg-page)'}
      >
        Ver dashboard de capacidad <ArrowRight size={12} />
      </button>
    </div>
  )
}

function formatDateShort (iso: string): string {
  const d = new Date(iso + 'T00:00:00')
  if (isNaN(d.getTime())) return iso
  return d.toLocaleDateString('es-DO', { day: '2-digit', month: '2-digit' })
}
