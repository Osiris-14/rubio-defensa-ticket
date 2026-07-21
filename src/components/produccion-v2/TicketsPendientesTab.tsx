'use client'
import { useState, useEffect } from 'react'
import { Loader2, ChevronRight, AlertCircle, Clock } from 'lucide-react'
import {
  fetchProductionTickets,
  type ProductionTicket,
} from '@/lib/production-v2'
import TicketPasarela from './TicketPasarela'

interface Props {
  user: { id: string; name: string; role: string }
  onChanged: () => void
}

export default function TicketsPendientesTab ({ user, onChanged }: Props) {
  const [tickets, setTickets] = useState<ProductionTicket[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    let active = true
    async function load () {
      try {
        const t = await fetchProductionTickets('pendiente')
        if (!active) return
        setTickets(t)
        setError('')
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : String(e))
      } finally {
        if (active) setLoading(false)
      }
    }
    load()
    return () => { active = false }
  }, [reloadKey])

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000)
    return () => clearInterval(id)
  }, [])

  if (selectedId) {
    return (
      <TicketPasarela
        ticketId={selectedId}
        user={user}
        onBack={() => { setSelectedId(null); setReloadKey(k => k + 1); onChanged() }}
      />
    )
  }

  if (loading) return <LoadingState message='Cargando tickets pendientes…' />

  if (error) {
    return (
      <div style={{
        background: 'var(--red-50)', border: '1px solid var(--red-ring)',
        borderRadius: 'var(--radius-lg)', padding: '14px 16px', fontSize: 13.5, color: 'var(--red)',
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <AlertCircle size={16} /> {error}
      </div>
    )
  }

  if (tickets.length === 0) {
    return (
      <EmptyState
        title='No hay tickets pendientes'
        description='Los tickets creados desde Órdenes aparecerán aquí con su pasarela de producción.'
      />
    )
  }

  return (
    <div style={{
      display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16,
    }}>
      {tickets.map(t => (
        <TicketCard key={t.id} ticket={t} now={now} onClick={() => setSelectedId(t.id)} />
      ))}
    </div>
  )
}

// ─────────────────────────────────────────────────────────
function TicketCard ({ ticket, now, onClick }: { ticket: ProductionTicket; now: number; onClick: () => void }) {
  const ageH = (now - new Date(ticket.created_at).getTime()) / 3_600_000
  const ageLabel = ageH < 1 ? 'hace minutos' : ageH < 24 ? `hace ${Math.round(ageH)}h` : `hace ${Math.round(ageH / 24)}d`

  return (
    <div onClick={onClick} className='card card-interactive' style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', cursor: 'pointer' }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 20px', borderBottom: '1px solid var(--border)', background: 'var(--bg-page)',
      }}>
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 12px',
          background: 'var(--amber-bg)', color: 'var(--amber)', borderRadius: 9999,
          fontSize: 11, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase' as const,
        }}>
          <Loader2 size={11} /> En producción
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11.5, color: 'var(--gray-500)', fontWeight: 500 }}>
          <Clock size={11} /> {ageLabel}
        </span>
      </div>

      <div style={{ padding: '22px 22px 18px', flex: 1 }}>
        <div style={{
          fontSize: 26, fontWeight: 700, color: 'var(--gray-900)',
          letterSpacing: '-0.03em', lineHeight: 1.1, marginBottom: 6, fontFeatureSettings: '"tnum" 1',
        }}>
          {ticket.orden ? `Orden #${ticket.orden}` : 'Ticket —'}
        </div>
        <div style={{ fontSize: 14, color: 'var(--gray-600)', fontWeight: 500, marginBottom: 16 }}>
          {ticket.vehiculo ?? '—'}
        </div>
        <div style={{
          display: 'flex', flexDirection: 'column', gap: 8,
          paddingTop: 16, borderTop: '1px solid var(--border)',
        }}>
          <CompactLine label='Factura' value={ticket.factura ?? '—'} />
          <CompactLine label='Cliente' value={ticket.cliente ?? '—'} />
        </div>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          paddingTop: 16, marginTop: 16, borderTop: '1px solid var(--border)',
        }}>
          <span style={{ fontSize: 11.5, color: 'var(--gray-500)', fontWeight: 500 }}>Ver pasarela</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 13, fontWeight: 600, color: 'var(--red)' }}>
            Abrir <ChevronRight size={14} strokeWidth={2.25} />
          </span>
        </div>
      </div>
    </div>
  )
}

function CompactLine ({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
      <span style={{ fontSize: 11, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600, flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: 13, color: 'var(--gray-800)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const, minWidth: 0 }}>{value}</span>
    </div>
  )
}

function LoadingState ({ message }: { message: string }) {
  return (
    <div style={{ padding: '80px 24px', textAlign: 'center', color: 'var(--gray-500)', fontSize: 13.5 }}>
      <div style={{
        display: 'inline-block', width: 24, height: 24,
        border: '2.5px solid var(--gray-200)', borderTopColor: 'var(--red)',
        borderRadius: '50%', animation: 'spin 0.7s linear infinite', marginBottom: 12,
      }} />
      <div>{message}</div>
    </div>
  )
}

function EmptyState ({ title, description }: { title: string; description: string }) {
  return (
    <div style={{ padding: '80px 24px', textAlign: 'center', maxWidth: 420, margin: '0 auto' }}>
      <div style={{
        width: 56, height: 56, borderRadius: 'var(--radius-lg)',
        background: 'var(--amber-bg)', color: 'var(--amber)',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 18,
      }}>
        <Loader2 size={22} strokeWidth={1.6} />
      </div>
      <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--gray-900)', margin: 0, letterSpacing: '-0.01em' }}>{title}</h3>
      <p style={{ fontSize: 13.5, color: 'var(--gray-500)', marginTop: 8, lineHeight: 1.5 }}>{description}</p>
    </div>
  )
}
