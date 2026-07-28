'use client'
import { useState, useEffect } from 'react'
import { ChevronRight, AlertCircle, Calendar, Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import {
  fetchProductionTickets,
  fetchPasarelaPiezasFor,
  etapaState,
  etapaIndex,
  piezaHecha,
  PASARELA_STAGES,
  ETAPA_LABELS,
  type ProductionTicket,
  type TicketPasarelaPieza,
} from '@/lib/production-v2'
import { friendlyError } from '@/lib/errorMessages'
import TicketPasarela from './TicketPasarela'

interface Props {
  user: { id: string; name: string; role: string }
  onChanged: () => void
}

export default function TicketsPendientesTab ({ user, onChanged }: Props) {
  const [tickets, setTickets] = useState<ProductionTicket[]>([])
  const [piezasMap, setPiezasMap] = useState<Map<string, TicketPasarelaPieza[]>>(new Map())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let active = true
    async function load () {
      try {
        const t = await fetchProductionTickets('pendiente')
        if (!active) return
        setTickets(t)
        const map = await fetchPasarelaPiezasFor(t.map(x => x.id))
        if (!active) return
        setPiezasMap(map)
        setError('')
      } catch (e) {
        if (active) setError(friendlyError(e))
      } finally {
        if (active) setLoading(false)
      }
    }
    load()
    return () => { active = false }
  }, [reloadKey])

  // Realtime: los cambios de etapa se reflejan en vivo en la lista.
  useEffect(() => {
    const channel = supabase.channel(`pendientes-${Math.random().toString(36).slice(2)}`)
    channel.on('postgres_changes',
      { event: '*', schema: 'public', table: 'production_tickets' },
      () => setReloadKey(k => k + 1))
    channel.on('postgres_changes',
      { event: '*', schema: 'public', table: 'production_ticket_pasarela' },
      () => setReloadKey(k => k + 1))
    channel.subscribe()
    return () => { supabase.removeChannel(channel) }
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

  if (loading) return <LoadingState message='Cargando tickets…' />

  if (error) {
    return (
      <div style={{
        background: 'var(--red-50)', border: '1px solid var(--red-ring)',
        borderRadius: 'var(--radius-lg)', padding: '14px 16px', fontSize: 14, color: 'var(--red)',
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <AlertCircle size={16} /> {error}
      </div>
    )
  }

  if (tickets.length === 0) {
    return (
      <EmptyState
        title='No hay trabajos en proceso'
        description='Cuando abras una orden en la pestaña Órdenes, el trabajo aparecerá aquí en la etapa de Corte.'
      />
    )
  }

  return (
    <div style={{
      display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16,
    }}>
      {tickets.map(t => (
        <TicketCard
          key={t.id}
          ticket={t}
          piezas={piezasMap.get(t.id) ?? []}
          onClick={() => setSelectedId(t.id)}
        />
      ))}
    </div>
  )
}

// ─────────────────────────────────────────────────────────
// Tarjeta de ticket en proceso, con su etapa actual
// ─────────────────────────────────────────────────────────
function TicketCard ({ ticket, piezas, onClick }: {
  ticket: ProductionTicket
  piezas: TicketPasarelaPieza[]
  onClick: () => void
}) {
  const actual = ticket.etapa_actual
  const done = etapaIndex(actual)

  // En Armado/Soldadura mostramos además cuántas piezas van.
  let detalle = ''
  if ((actual === 'armado' || actual === 'soldadura') && piezas.length > 0) {
    const listas = piezas.filter(p => piezaHecha(p, actual)).length
    detalle = ` · ${listas} de ${piezas.length} piezas`
  }

  return (
    <div className='card' style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ padding: '22px 22px 18px', flex: 1, display: 'flex', flexDirection: 'column' }}>
        {/* Badge de etapa actual */}
        <div style={{ marginBottom: 10 }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '4px 12px', background: 'var(--red-50)', color: 'var(--red)',
            borderRadius: 9999, fontSize: 12, fontWeight: 700,
            textTransform: 'uppercase' as const, letterSpacing: '0.05em',
          }}>
            En {ETAPA_LABELS[actual]}
          </span>
        </div>

        <div style={{
          fontSize: 24, fontWeight: 700, color: 'var(--gray-900)',
          letterSpacing: '-0.02em', lineHeight: 1.15, marginBottom: 4,
        }}>
          {ticket.vehiculo ?? 'Sin vehículo'}
        </div>
        <div style={{ fontSize: 13.5, color: 'var(--gray-500)', marginBottom: 14 }}>
          Orden #{ticket.orden ?? '—'} · {ticket.cliente ?? 'Cliente —'}
        </div>

        {ticket.fecha_programada && (
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6, alignSelf: 'flex-start',
            padding: '4px 12px', background: 'var(--gray-100)', color: 'var(--gray-600)',
            borderRadius: 9999, fontSize: 12.5, fontWeight: 700, marginBottom: 14,
          }}>
            <Calendar size={12} /> {formatDateFriendly(ticket.fecha_programada)}
          </div>
        )}

        {/* Barra de las 4 etapas */}
        <div style={{ marginTop: 'auto' }}>
          <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
            {PASARELA_STAGES.map(etapa => {
              const st = etapaState(etapa, actual)
              return (
                <div
                  key={etapa}
                  title={ETAPA_LABELS[etapa]}
                  style={{
                    flex: 1, height: 8, borderRadius: 4,
                    background: st === 'completada' ? 'var(--green)' : st === 'actual' ? 'var(--red)' : 'var(--gray-100)',
                    transition: 'background 0.2s',
                  }}
                />
              )
            })}
          </div>
          <div style={{ fontSize: 13, color: 'var(--gray-600)', fontWeight: 600, marginBottom: 16 }}>
            {done} de {PASARELA_STAGES.length} etapas
            <span style={{ color: 'var(--gray-500)', fontWeight: 500 }}>{detalle}</span>
          </div>
        </div>

        <button
          onClick={onClick}
          className='btn btn-primary'
          style={{ width: '100%', height: 48, fontSize: 15, fontWeight: 700 }}
        >
          Continuar <ChevronRight size={16} strokeWidth={2.25} />
        </button>
      </div>
    </div>
  )
}

function formatDateFriendly (iso: string): string {
  const d = new Date(iso + 'T00:00:00')
  if (isNaN(d.getTime())) return iso
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const target = new Date(d); target.setHours(0, 0, 0, 0)
  const diffDays = Math.round((target.getTime() - today.getTime()) / 86_400_000)
  const fecha = d.toLocaleDateString('es-DO', { weekday: 'long', day: 'numeric', month: 'short' })
  if (diffDays === 0) return `Hoy · ${fecha}`
  if (diffDays === 1) return `Mañana · ${fecha}`
  if (diffDays < 0) return `Atrasado · ${fecha}`
  return fecha
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
