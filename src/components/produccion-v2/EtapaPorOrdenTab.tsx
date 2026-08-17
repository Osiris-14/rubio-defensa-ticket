'use client'
import { useState, useEffect, useMemo, useTransition } from 'react'
import { AlertCircle, CheckCircle2, Flame } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import {
  fetchProductionTicketsPorEtapa, fetchOrdenInfoMap,
  type ProductionTicketV3, type FacturaProduccion,
} from '@/lib/production-v2'
import { completarPiezaPipeline } from '@/app/actions/production'
import { friendlyError } from '@/lib/errorMessages'

interface Props {
  etapa: 'soldadura' | 'pulido'
  emptyTitle: string
  emptyDescription: string
}

export default function EtapaPorOrdenTab ({ etapa, emptyTitle, emptyDescription }: Props) {
  const [tickets, setTickets] = useState<ProductionTicketV3[]>([])
  const [ordenesInfo, setOrdenesInfo] = useState<Map<string, FacturaProduccion>>(new Map())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let active = true
    async function load () {
      try {
        const [t, ordenes] = await Promise.all([
          fetchProductionTicketsPorEtapa(etapa, false),
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
  }, [etapa, reloadKey])

  useEffect(() => {
    const channel = supabase.channel(`${etapa}-${Math.random().toString(36).slice(2)}`)
    channel.on('postgres_changes',
      { event: '*', schema: 'public', table: 'production_tickets' },
      () => setReloadKey(k => k + 1))
    channel.subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [etapa])

  // Agrupadas por orden; se descartan las órdenes cuyas piezas YA están
  // todas completadas en esta etapa (ya hicieron cascada a la siguiente).
  const ordenes = useMemo(() => {
    const map = new Map<string, ProductionTicketV3[]>()
    for (const t of tickets) {
      const key = t.alegra_id ?? t.numero_orden ?? t.id
      const arr = map.get(key) ?? []
      arr.push(t)
      map.set(key, arr)
    }
    return [...map.entries()].filter(([, piezas]) => !piezas.every(p => p.estado === 'completado'))
  }, [tickets])

  function marcarCompletada (id: string) {
    setTickets(prev => prev.map(t => t.id === id ? { ...t, estado: 'completado' as const } : t))
    completarPiezaPipeline(id).then(res => {
      if (!res.ok) { setError(friendlyError(res.error)); setReloadKey(k => k + 1) }
    }).catch(e => {
      setError(friendlyError(e))
      setReloadKey(k => k + 1)
    })
  }

  if (loading) {
    return <div style={{ padding: '80px 24px', textAlign: 'center', color: 'var(--gray-500)', fontSize: 13.5 }}>Cargando…</div>
  }

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

  if (ordenes.length === 0) {
    return (
      <div style={{ padding: '80px 24px', textAlign: 'center', maxWidth: 420, margin: '0 auto' }}>
        <div style={{
          width: 56, height: 56, borderRadius: 'var(--radius-lg)',
          background: 'var(--gray-100)', color: 'var(--gray-500)',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 18,
        }}>
          <Flame size={22} strokeWidth={1.6} />
        </div>
        <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--gray-900)', margin: 0 }}>{emptyTitle}</h3>
        <p style={{ fontSize: 13.5, color: 'var(--gray-500)', marginTop: 8, lineHeight: 1.5 }}>{emptyDescription}</p>
      </div>
    )
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
      {ordenes.map(([key, piezas]) => (
        <OrdenCard
          key={key}
          piezas={piezas}
          info={piezas[0].alegra_id ? ordenesInfo.get(piezas[0].alegra_id) ?? null : null}
          onCompletar={marcarCompletada}
        />
      ))}
    </div>
  )
}

function OrdenCard ({ piezas, info, onCompletar }: {
  piezas: ProductionTicketV3[]
  info: FacturaProduccion | null
  onCompletar: (id: string) => void
}) {
  const primero = piezas[0]
  const completadas = piezas.filter(p => p.estado === 'completado').length

  return (
    <div className='card' style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' as const }}>
        <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--gray-900)' }}>#{primero.numero_orden || '—'}</span>
        <span style={{
          fontSize: 11.5, fontWeight: 700, color: completadas === piezas.length ? 'var(--green)' : 'var(--gray-600)',
          background: completadas === piezas.length ? 'var(--green-bg)' : 'var(--gray-100)',
          padding: '3px 10px', borderRadius: 9999,
        }}>
          {completadas} de {piezas.length} completadas
        </span>
      </div>
      <div style={{ fontSize: 13, color: 'var(--gray-600)' }}>{info?.cliente ?? 'Cliente —'}</div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, borderTop: '1px solid var(--border-subtle)', paddingTop: 10 }}>
        {piezas.map(p => (
          <PiezaRow key={p.id} pieza={p} onCompletar={() => onCompletar(p.id)} />
        ))}
      </div>
    </div>
  )
}

function PiezaRow ({ pieza, onCompletar }: { pieza: ProductionTicketV3; onCompletar: () => void }) {
  const [pending, startTransition] = useTransition()
  const completada = pieza.estado === 'completado'

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, color: 'var(--gray-900)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>
          {pieza.pieza}
        </div>
        <div style={{ fontSize: 11.5, color: 'var(--gray-500)' }}>{pieza.responsable}</div>
      </div>
      {completada ? (
        <span style={{
          fontSize: 11, fontWeight: 700, color: 'var(--green)', background: 'var(--green-bg)',
          padding: '3px 9px', borderRadius: 9999, whiteSpace: 'nowrap' as const,
        }}>
          Completada ✓
        </span>
      ) : (
        <button
          onClick={() => startTransition(onCompletar)}
          disabled={pending}
          className='btn'
          style={{
            height: 32, padding: '0 10px', fontSize: 11.5, fontWeight: 700,
            background: 'var(--green-bg)', color: 'var(--green)', border: '1px solid var(--green-ring)',
            flexShrink: 0,
          }}
        >
          <CheckCircle2 size={13} /> {pending ? '…' : 'Marcar completada'}
        </button>
      )}
    </div>
  )
}
