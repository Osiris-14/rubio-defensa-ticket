'use client'
import { useState, useEffect, useMemo } from 'react'
import { AlertCircle, CheckCircle, Clock, User } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { fetchProductionTicketsV3, type ProductionTicketV3 } from '@/lib/production-v2'
import { friendlyError } from '@/lib/errorMessages'

export default function TicketsCompletadosTab () {
  const [todos, setTodos] = useState<ProductionTicketV3[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let active = true
    async function load () {
      try {
        const t = await fetchProductionTicketsV3()
        if (!active) return
        setTodos(t)
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
    const channel = supabase.channel(`completados-v3-${Math.random().toString(36).slice(2)}`)
    channel.on('postgres_changes',
      { event: '*', schema: 'public', table: 'production_tickets' },
      () => setReloadKey(k => k + 1))
    channel.subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])

  // ¿La orden completa (todas sus piezas) ya está en 'completado'?
  const ordenCompleta = useMemo(() => {
    const porOrden = new Map<string, ProductionTicketV3[]>()
    for (const t of todos) {
      const key = t.alegra_id ?? t.numero_orden ?? t.id
      const arr = porOrden.get(key) ?? []
      arr.push(t)
      porOrden.set(key, arr)
    }
    const out = new Map<string, boolean>()
    for (const [key, piezas] of porOrden) out.set(key, piezas.every(p => p.estado === 'completado'))
    return out
  }, [todos])

  const completados = useMemo(() => todos.filter(t => t.estado === 'completado'), [todos])

  const grupos = useMemo(() => {
    const map = new Map<string, ProductionTicketV3[]>()
    for (const t of completados) {
      const key = t.responsable || 'Sin asignar'
      const arr = map.get(key) ?? []
      arr.push(t)
      map.set(key, arr)
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0], 'es'))
  }, [completados])

  if (loading) {
    return <div style={{ padding: '80px 24px', textAlign: 'center', color: 'var(--gray-500)', fontSize: 13.5 }}>Cargando tickets completados…</div>
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

  if (completados.length === 0) {
    return (
      <div style={{ padding: '80px 24px', textAlign: 'center', maxWidth: 420, margin: '0 auto' }}>
        <div style={{
          width: 56, height: 56, borderRadius: 'var(--radius-lg)',
          background: 'var(--green-bg)', color: 'var(--green)',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 18,
        }}>
          <CheckCircle size={22} strokeWidth={1.6} />
        </div>
        <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--gray-900)', margin: 0 }}>No hay piezas completadas</h3>
        <p style={{ fontSize: 13.5, color: 'var(--gray-500)', marginTop: 8, lineHeight: 1.5 }}>
          Las piezas que se marquen como completadas aparecerán aquí.
        </p>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
      {grupos.map(([responsable, piezas]) => (
        <div key={responsable}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <span style={{
              width: 28, height: 28, borderRadius: '50%', background: 'var(--green-bg)', color: 'var(--green)',
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
                ordenLista={ordenCompleta.get(t.alegra_id ?? t.numero_orden ?? t.id) ?? false}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function PiezaCard ({ ticket, ordenLista }: { ticket: ProductionTicketV3; ordenLista: boolean }) {
  return (
    <div className='card' style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' as const }}>
        <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--gray-900)' }}>#{ticket.numero_orden || '—'}</span>
        {ordenLista && (
          <span style={{
            fontSize: 10.5, fontWeight: 700, color: 'var(--green)', background: 'var(--green-bg)',
            padding: '2px 8px', borderRadius: 9999, textTransform: 'uppercase' as const, letterSpacing: '0.04em',
          }}>
            Orden completa
          </span>
        )}
      </div>
      <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--gray-900)' }}>{ticket.pieza}</div>
      {!ordenLista && (
        <div style={{ fontSize: 12, color: 'var(--gray-500)' }}>Otras piezas de esta orden siguen pendientes</div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--gray-500)' }}>
        <Clock size={12} /> {ticket.completado_en ? formatDate(ticket.completado_en) : '—'}
      </div>
    </div>
  )
}

function formatDate (iso: string): string {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('es-DO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}
