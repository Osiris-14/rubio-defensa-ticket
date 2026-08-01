'use client'
// ─────────────────────────────────────────────────────────
// AgendaView: Operational Production Board
// Orders grouped by production puesto as kanban columns.
// NOT a calendar, NOT FullCalendar, NOT a month grid.
// ─────────────────────────────────────────────────────────
import { useMemo } from 'react'
import { AlertTriangle, Clock, CheckCircle, XCircle } from 'lucide-react'
import { type EventoArmador, labelArmador } from '@/lib/ordenes-core'
import { type OrdenAlegra } from '@/lib/ordenes'

interface Props {
  eventos: EventoArmador[]
  ordenesMap: Map<string, OrdenAlegra>
  // Filters passed in from parent (shared with Table mode)
  filterOrden?: string
  filterEstado?: string
}

// Puesto accent colors
const PUESTO_ACCENT: Record<string, { top: string; dot: string }> = {
  'PUESTO 2 ARMADOR':          { top: '#1D4ED8', dot: '#3B82F6' },
  'EVENNOT  PUESTO 4  5PM-9PM': { top: '#C2410C', dot: '#F97316' },
  'PUESTO 4 DE 8AM 4PM':       { top: '#15803D', dot: '#22C55E' },
  'puesto 5 oscar':            { top: '#7C3AED', dot: '#A855F7' },
}
const DEFAULT_ACCENT = { top: '#6B7280', dot: '#9CA3AF' }

function puestoAccent (cal: string) {
  return PUESTO_ACCENT[cal] ?? DEFAULT_ACCENT
}

function daysDiff (isoDate: string): number {
  const d = new Date(isoDate + 'T00:00:00')
  if (isNaN(d.getTime())) return 0
  return Math.floor((Date.now() - d.getTime()) / 86400000)
}

function todayISO () {
  return new Date().toISOString().slice(0, 10)
}

function formatDate (iso: string): string {
  const [y, m, d] = iso.split('-')
  const months = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic']
  return `${d} ${months[parseInt(m,10)-1]} ${y}`
}

interface OrderCard {
  orden: string
  pieza: string
  vehiculo: string | null
  cliente: string | null
  compromiso: string | null
  dias: number // days since commitment (positive = overdue)
  isDelayed: boolean
}

export default function AgendaView ({ eventos, ordenesMap, filterOrden, filterEstado }: Props) {
  const today = todayISO()

  // Group events by calendar, then by order
  const puestoGroups = useMemo(() => {
    // Collect all orders per calendar
    const groupMap = new Map<string, Map<string, { pieza: string; eventStart: string }>>()
    for (const ev of eventos) {
      if (!ev.orden) continue
      if (!groupMap.has(ev.calendario)) groupMap.set(ev.calendario, new Map())
      const orders = groupMap.get(ev.calendario)!
      if (!orders.has(ev.orden)) {
        orders.set(ev.orden, { pieza: ev.pieza, eventStart: ev.inicio })
      }
    }

    // Build card data
    const result: { calendario: string; label: string; cards: OrderCard[] }[] = []
    for (const [calendario, ordersMap] of groupMap) {
      const cards: OrderCard[] = []
      for (const [orden, info] of ordersMap) {
        const alegra = ordenesMap.get(orden)
        const compromiso = info.eventStart ? info.eventStart.slice(0, 10) : null
        const diasProd = compromiso ? daysDiff(compromiso) : 0
        const isDelayed = compromiso !== null && compromiso < today

        // Apply filters
        if (filterOrden && !orden.includes(filterOrden)) continue
        if (filterEstado === 'atrasados' && !isDelayed) continue
        if (filterEstado === 'al_dia' && isDelayed) continue

        cards.push({
          orden,
          pieza: info.pieza,
          vehiculo: alegra?.vehiculo ?? null,
          cliente: alegra?.cliente ?? null,
          compromiso,
          dias: diasProd,
          isDelayed,
        })
      }
      cards.sort((a, b) => {
        // Delayed first
        if (a.isDelayed !== b.isDelayed) return a.isDelayed ? -1 : 1
        return a.orden.localeCompare(b.orden)
      })
      result.push({ calendario, label: labelArmador(calendario), cards })
    }
    // Sort puestos by name
    result.sort((a, b) => a.label.localeCompare(b.label))
    return result
  }, [eventos, ordenesMap, filterOrden, filterEstado, today])

  if (puestoGroups.length === 0) {
    return (
      <div style={{ padding: '48px 0', textAlign: 'center', color: 'var(--gray-400)', fontSize: 13.5 }}>
        No hay órdenes en el calendario para mostrar en el tablero.
        <br />
        <span style={{ fontSize: 12, marginTop: 4, display: 'block' }}>Los datos se cargan desde los CSV del calendario de armadores.</span>
      </div>
    )
  }

  return (
    <div className='agenda-board' style={{
      display: 'flex',
      gap: 14,
      overflowX: 'auto',
      paddingBottom: 16,
      alignItems: 'flex-start',
    }}>
      {puestoGroups.map(group => {
        const accent = puestoAccent(group.calendario)
        const delayed = group.cards.filter(c => c.isDelayed).length
        return (
          <div
            key={group.calendario}
            className='agenda-column'
            style={{
              minWidth: 270,
              maxWidth: 300,
              flex: '0 0 280px',
              display: 'flex',
              flexDirection: 'column',
              gap: 0,
            }}
          >
            {/* Column header */}
            <div style={{
              background: 'var(--bg-sidebar)',
              borderRadius: 'var(--radius-lg)',
              padding: '12px 16px',
              marginBottom: 10,
              borderTop: `3px solid ${accent.top}`,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 9, height: 9, borderRadius: '50%', background: accent.dot, flexShrink: 0 }} />
                <span style={{ fontSize: 12.5, fontWeight: 700, color: '#fff', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {group.label}
                </span>
                <span style={{
                  fontSize: 11, fontWeight: 700, padding: '1px 7px', borderRadius: 9999,
                  background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.7)',
                }}>
                  {group.cards.length}
                </span>
              </div>
              {delayed > 0 && (
                <div style={{ marginTop: 6, fontSize: 10.5, color: '#FCA5A5', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <AlertTriangle size={10} /> {delayed} atrasada{delayed > 1 ? 's' : ''}
                </div>
              )}
            </div>

            {/* Cards */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {group.cards.map(card => (
                <OrderCard key={card.orden} card={card} />
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function OrderCard ({ card }: { card: OrderCard }) {
  const isDelayed = card.isDelayed
  const daysAbs = Math.abs(card.dias)

  const bg = isDelayed ? '#FFF5F5' : 'var(--bg-card)'
  const topBorder = isDelayed ? 'var(--red)' : 'var(--border)'

  return (
    <div
      className='card'
      style={{
        padding: '14px 16px',
        border: `1px solid ${isDelayed ? 'var(--red-ring)' : 'var(--border)'}`,
        borderTop: `2px solid ${topBorder}`,
        background: bg,
        borderRadius: 'var(--radius)',
        transition: 'box-shadow 0.15s',
        cursor: 'default',
      }}
      onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)' }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none' }}
    >
      {/* Order number */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--gray-900)' }}>#{card.orden}</span>
        {isDelayed ? (
          <span style={{
            fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 9999,
            background: 'var(--red-50)', color: 'var(--red)', border: '1px solid var(--red-ring)',
            display: 'flex', alignItems: 'center', gap: 3,
          }}>
            <AlertTriangle size={8} /> +{daysAbs}d
          </span>
        ) : (
          <span style={{
            fontSize: 10, fontWeight: 600, padding: '2px 6px', borderRadius: 9999,
            background: 'var(--green-bg)', color: 'var(--green)', border: '1px solid var(--green-ring)',
            display: 'flex', alignItems: 'center', gap: 3,
          }}>
            <CheckCircle size={8} /> Al día
          </span>
        )}
      </div>

      {/* Piece */}
      {card.pieza && (
        <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--gray-900)', marginBottom: 6, lineHeight: 1.3 }}>
          {card.pieza}
        </div>
      )}

      {/* Vehicle */}
      {card.vehiculo && (
        <div style={{ fontSize: 11.5, color: 'var(--gray-600)', marginBottom: 4 }}>
          🚗 {card.vehiculo}
        </div>
      )}

      {/* Client */}
      {card.cliente && (
        <div style={{ fontSize: 11, color: 'var(--gray-500)', marginBottom: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {card.cliente}
        </div>
      )}

      {/* Commitment date */}
      {card.compromiso && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 5,
          fontSize: 11, color: isDelayed ? 'var(--red)' : 'var(--gray-500)',
          paddingTop: 8, borderTop: '1px solid var(--border-subtle)',
          marginTop: 4,
        }}>
          {isDelayed ? <XCircle size={11} /> : <Clock size={11} />}
          {formatDate(card.compromiso)}
          {card.dias > 0 && <span style={{ fontWeight: 600 }}> · {daysAbs}d {isDelayed ? 'tarde' : 'en prod.'}</span>}
        </div>
      )}
    </div>
  )
}
