'use client'
import { useState, useEffect, useMemo, useTransition } from 'react'
import { AlertCircle, Calendar, CheckCircle2, Loader2, User } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import {
  fetchProductionTicketsV3,
  fetchFacturasProduccion,
  type ProductionTicketV3,
  type FacturaProduccion,
} from '@/lib/production-v2'
import { completarTicketProduccion } from '@/app/actions/production'
import { friendlyError } from '@/lib/errorMessages'

export default function TicketsPendientesTab () {
  const [tickets, setTickets] = useState<ProductionTicketV3[]>([])
  const [facturas, setFacturas] = useState<FacturaProduccion[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let active = true
    async function load () {
      try {
        const [t, f] = await Promise.all([
          fetchProductionTicketsV3('pendiente'),
          fetchFacturasProduccion().catch(() => [] as FacturaProduccion[]),
        ])
        if (!active) return
        setTickets(t)
        setFacturas(f)
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

  // Realtime: los tickets nuevos/completados se reflejan en vivo.
  useEffect(() => {
    const channel = supabase.channel(`pendientes-v3-${Math.random().toString(36).slice(2)}`)
    channel.on('postgres_changes',
      { event: '*', schema: 'public', table: 'production_tickets' },
      () => setReloadKey(k => k + 1))
    channel.subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])

  const clientePorAlegra = useMemo(() => {
    const map = new Map<string, FacturaProduccion>()
    for (const f of facturas) map.set(f.alegra_id, f)
    return map
  }, [facturas])

  const grupos = useMemo(() => {
    const map = new Map<string, ProductionTicketV3[]>()
    for (const t of tickets) {
      const key = t.responsable || 'Sin asignar'
      const arr = map.get(key) ?? []
      arr.push(t)
      map.set(key, arr)
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0], 'es'))
  }, [tickets])

  function marcarCompletado (id: string) {
    setTickets(prev => prev.filter(t => t.id !== id))
    completarTicketProduccion(id).catch(e => {
      setError(friendlyError(e))
      setReloadKey(k => k + 1)
    })
  }

  if (loading) return <LoadingState message='Cargando tickets pendientes…' />

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
        title='No hay piezas pendientes'
        description='Cuando abras un ticket desde una orden, las piezas aparecerán aquí agrupadas por responsable.'
      />
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
      {grupos.map(([responsable, piezas]) => (
        <div key={responsable}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <span style={{
              width: 28, height: 28, borderRadius: '50%', background: 'var(--red-50)', color: 'var(--red)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <User size={14} />
            </span>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--gray-900)', margin: 0 }}>{responsable}</h3>
            <span style={{
              fontSize: 11.5, fontWeight: 700, color: 'var(--gray-500)',
              background: 'var(--gray-100)', padding: '2px 9px', borderRadius: 9999,
            }}>
              {piezas.length}
            </span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
            {piezas.map(t => (
              <PiezaCard
                key={t.id}
                ticket={t}
                cliente={t.alegra_id ? clientePorAlegra.get(t.alegra_id)?.cliente ?? null : null}
                onCompletar={() => marcarCompletado(t.id)}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function PiezaCard ({ ticket, cliente, onCompletar }: {
  ticket: ProductionTicketV3
  cliente: string | null
  onCompletar: () => void
}) {
  const [pending, startTransition] = useTransition()

  return (
    <div className='card' style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' as const }}>
        <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--gray-900)' }}>#{ticket.numero_orden || '—'}</span>
        <span style={{ fontSize: 12, color: 'var(--gray-500)' }}>{ticket.factura ?? ''}</span>
      </div>
      <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--red)' }}>{ticket.pieza}</div>
      <div style={{ fontSize: 13, color: 'var(--gray-600)' }}>{cliente ?? 'Cliente —'}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--gray-500)' }}>
        <Calendar size={12} /> {formatDate(ticket.created_at)}
      </div>
      <button
        onClick={() => startTransition(onCompletar)}
        disabled={pending}
        className='btn'
        style={{
          marginTop: 4, height: 42, fontSize: 13.5, fontWeight: 700,
          background: 'var(--green-bg)', color: 'var(--green)', border: '1px solid var(--green-ring)',
        }}
      >
        <CheckCircle2 size={15} /> {pending ? 'Guardando…' : 'Marcar completado'}
      </button>
    </div>
  )
}

function formatDate (iso: string): string {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('es-DO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
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
