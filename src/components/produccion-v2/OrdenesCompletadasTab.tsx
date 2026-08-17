'use client'
import { useState, useEffect, useMemo } from 'react'
import { AlertCircle, PackageCheck } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import {
  fetchOrdenesCompletadasPipeline,
  fetchFacturasProduccion,
  type ProductionTicketV3,
  type FacturaProduccion,
} from '@/lib/production-v2'
import { formatoMoneda } from '@/lib/tarifario'
import { friendlyError } from '@/lib/errorMessages'

export default function OrdenesCompletadasTab () {
  const [ordenes, setOrdenes] = useState<Map<string, ProductionTicketV3[]>>(new Map())
  const [facturas, setFacturas] = useState<FacturaProduccion[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let active = true
    async function load () {
      try {
        const [o, f] = await Promise.all([
          fetchOrdenesCompletadasPipeline(),
          fetchFacturasProduccion().catch(() => [] as FacturaProduccion[]),
        ])
        if (!active) return
        setOrdenes(o)
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

  useEffect(() => {
    const channel = supabase.channel(`ordenes-completadas-${Math.random().toString(36).slice(2)}`)
    channel.on('postgres_changes',
      { event: '*', schema: 'public', table: 'production_tickets' },
      () => setReloadKey(k => k + 1))
    channel.subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])

  const facturaPorAlegra = useMemo(() => {
    const map = new Map<string, FacturaProduccion>()
    for (const f of facturas) map.set(f.alegra_id, f)
    return map
  }, [facturas])

  const grupos = useMemo(() => [...ordenes.entries()], [ordenes])

  if (loading) {
    return <div style={{ padding: '80px 24px', textAlign: 'center', color: 'var(--gray-500)', fontSize: 13.5 }}>Cargando órdenes completadas…</div>
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

  if (grupos.length === 0) {
    return (
      <div style={{ padding: '80px 24px', textAlign: 'center', maxWidth: 420, margin: '0 auto' }}>
        <div style={{
          width: 56, height: 56, borderRadius: 'var(--radius-lg)',
          background: 'var(--green-bg)', color: 'var(--green)',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 18,
        }}>
          <PackageCheck size={22} strokeWidth={1.6} />
        </div>
        <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--gray-900)', margin: 0 }}>Sin órdenes completadas</h3>
        <p style={{ fontSize: 13.5, color: 'var(--gray-500)', marginTop: 8, lineHeight: 1.5 }}>
          Cuando todas las piezas de una orden estén completadas, aparecerá aquí.
        </p>
      </div>
    )
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
      {grupos.map(([alegraId, piezas]) => (
        <OrdenCompletadaCard key={alegraId} piezas={piezas} factura={facturaPorAlegra.get(alegraId) ?? null} />
      ))}
    </div>
  )
}

function OrdenCompletadaCard ({ piezas, factura }: { piezas: ProductionTicketV3[]; factura: FacturaProduccion | null }) {
  const primero = piezas[0]
  const pagada = factura ? factura.saldo <= 450 : null

  return (
    <div className='card' style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' as const }}>
        <div>
          <span style={{ fontSize: 20, fontWeight: 700, color: 'var(--gray-900)', letterSpacing: '-0.02em' }}>
            #{primero.numero_orden || '—'}
          </span>
          <span style={{ fontSize: 12.5, color: 'var(--gray-500)', marginLeft: 8 }}>{primero.factura ?? ''}</span>
        </div>
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '4px 12px', borderRadius: 9999, fontSize: 11.5, fontWeight: 700,
          background: 'var(--green-bg)', color: 'var(--green)',
        }}>
          Completada ✓
        </span>
      </div>

      <div style={{ fontSize: 13.5, color: 'var(--gray-700)', fontWeight: 500 }}>
        {factura?.cliente ?? 'Cliente —'}
      </div>

      <div style={{ fontSize: 12, color: 'var(--gray-500)' }}>
        ¿Dobló David? <strong style={{ color: 'var(--gray-800)' }}>{primero.doblo_david ? 'Sí' : 'No'}</strong>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, borderTop: '1px solid var(--border-subtle)', paddingTop: 10 }}>
        {piezas.map(p => (
          <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 12.5 }}>
            <span style={{ color: 'var(--gray-900)', fontWeight: 600 }}>{p.pieza}</span>
            <span style={{ color: 'var(--gray-500)', textAlign: 'right' as const }}>
              {p.responsable} · {p.completado_en ? formatDate(p.completado_en) : '—'}
            </span>
          </div>
        ))}
      </div>

      {factura && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
          fontSize: 12.5, borderTop: '1px solid var(--border-subtle)', paddingTop: 10,
        }}>
          <MoneyStat label='Total' value={factura.total} />
          <MoneyStat label='Pagado' value={factura.total_pagado} color='var(--green)' />
          <MoneyStat label='Pendiente' value={factura.saldo} color={pagada ? 'var(--green)' : 'var(--red)'} />
        </div>
      )}
    </div>
  )
}

function MoneyStat ({ label, value, color = 'var(--gray-900)' }: { label: string; value: number; color?: string }) {
  return (
    <div>
      <div style={{ fontSize: 10, color: 'var(--gray-500)', textTransform: 'uppercase' as const, letterSpacing: '0.06em', fontWeight: 600 }}>
        {label}
      </div>
      <div style={{ fontSize: 13, fontWeight: 700, color, marginTop: 2 }}>
        {formatoMoneda(value)}
      </div>
    </div>
  )
}

function formatDate (iso: string): string {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('es-DO', { day: '2-digit', month: 'short' })
}
