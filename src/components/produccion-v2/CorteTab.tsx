'use client'
import { useState, useEffect } from 'react'
import { AlertCircle, Calendar, Scissors } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import {
  fetchProductionTicketsPorEtapa, fetchOrdenInfoMap,
  type ProductionTicketV3, type FacturaProduccion,
} from '@/lib/production-v2'
import { friendlyError } from '@/lib/errorMessages'
import { formatFecha } from './OrdenesTab'
import AbrirProduccionModal from './AbrirProduccionModal'

interface Props {
  user: { id: string; name: string; role: string }
}

export default function CorteTab ({ user }: Props) {
  const [tickets, setTickets] = useState<ProductionTicketV3[]>([])
  const [ordenesInfo, setOrdenesInfo] = useState<Map<string, FacturaProduccion>>(new Map())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [seleccionado, setSeleccionado] = useState<ProductionTicketV3 | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let active = true
    async function load () {
      try {
        const [t, ordenes] = await Promise.all([
          fetchProductionTicketsPorEtapa('corte'),
          fetchOrdenInfoMap(),
        ])
        if (!active) return
        setTickets(t)
        setOrdenesInfo(ordenes)
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

  useEffect(() => {
    const channel = supabase.channel(`corte-${Math.random().toString(36).slice(2)}`)
    channel.on('postgres_changes',
      { event: '*', schema: 'public', table: 'production_tickets' },
      () => setReloadKey(k => k + 1))
    channel.subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])

  if (loading) {
    return <div style={{ padding: '80px 24px', textAlign: 'center', color: 'var(--gray-500)', fontSize: 13.5 }}>Cargando órdenes en Corte…</div>
  }

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
      <div style={{ padding: '80px 24px', textAlign: 'center', maxWidth: 420, margin: '0 auto' }}>
        <div style={{
          width: 56, height: 56, borderRadius: 'var(--radius-lg)',
          background: 'var(--gray-100)', color: 'var(--gray-500)',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 18,
        }}>
          <Scissors size={22} strokeWidth={1.6} />
        </div>
        <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--gray-900)', margin: 0 }}>No hay órdenes en Corte</h3>
        <p style={{ fontSize: 13.5, color: 'var(--gray-500)', marginTop: 8, lineHeight: 1.5 }}>
          Las órdenes que envíes desde el tab Órdenes aparecerán aquí.
        </p>
      </div>
    )
  }

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
        {tickets.map(t => (
          <CorteCard key={t.id} ticket={t} info={t.alegra_id ? ordenesInfo.get(t.alegra_id) ?? null : null} onAbrir={() => setSeleccionado(t)} />
        ))}
      </div>

      {seleccionado && (
        <AbrirProduccionModal
          corteTicket={seleccionado}
          info={seleccionado.alegra_id ? ordenesInfo.get(seleccionado.alegra_id) ?? null : null}
          user={user}
          onClose={() => setSeleccionado(null)}
          onSaved={() => { setSeleccionado(null); setReloadKey(k => k + 1) }}
        />
      )}
    </>
  )
}

function CorteCard ({ ticket, info, onAbrir }: {
  ticket: ProductionTicketV3
  info: FacturaProduccion | null
  onAbrir: () => void
}) {
  const pagada = info ? info.saldo <= 450 : null
  const nombres = (info?.productos ?? []).map(p => p.nombre).filter(Boolean) as string[]

  return (
    <div className='card' style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ padding: '20px 20px 16px', flex: 1, display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 4, flexWrap: 'wrap' as const }}>
          <span style={{ fontSize: 22, fontWeight: 700, color: 'var(--gray-900)', letterSpacing: '-0.02em' }}>
            #{ticket.numero_orden || '—'}
          </span>
          <span style={{ fontSize: 12.5, color: 'var(--gray-500)' }}>{ticket.factura}</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 12, color: 'var(--gray-500)', marginBottom: 12 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <Calendar size={11} /> Apertura {formatFecha(info?.fecha ?? null)}
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <Calendar size={11} /> Fecha 0 {formatFecha(info?.fecha_vencimiento ?? null)}
          </span>
        </div>

        {nombres.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 6, marginBottom: 14 }}>
            {nombres.map((n, i) => (
              <span key={i} style={{
                fontSize: 11.5, fontWeight: 500, color: 'var(--gray-600)',
                background: 'var(--gray-100)', padding: '3px 9px', borderRadius: 9999,
              }}>
                {n}
              </span>
            ))}
          </div>
        )}

        {pagada !== null && (
          <div style={{ marginTop: 'auto', paddingTop: 10 }}>
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '4px 12px', borderRadius: 9999, fontSize: 12, fontWeight: 700,
              background: pagada ? 'var(--green-bg)' : 'var(--red-50)',
              color: pagada ? 'var(--green)' : 'var(--red)',
            }}>
              {pagada ? 'Pagada ✓' : `Pendiente · RD$ ${info!.saldo.toLocaleString('es-DO')}`}
            </span>
          </div>
        )}
      </div>

      <button
        onClick={onAbrir}
        className='btn btn-primary'
        style={{ width: '100%', height: 48, fontSize: 14.5, fontWeight: 700, borderRadius: 0 }}
      >
        Abrir Producción
      </button>
    </div>
  )
}
