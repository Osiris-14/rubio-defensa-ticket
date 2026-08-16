'use client'
import { useState, useEffect, useCallback } from 'react'
import { AlertCircle, Inbox } from 'lucide-react'
import { fetchOrdenesParaTicket, type OrdenParaTicket } from '@/lib/production-v2'
import { formatoMoneda } from '@/lib/tarifario'
import { friendlyError } from '@/lib/errorMessages'
import AbrirTicketModal from './AbrirTicketModal'

const UMBRAL_SALDO = 450

interface Props {
  user: { id: string; name: string; role: string }
  busqueda: string
  onChanged: () => void
}

export default function OrdenesTab ({ user, busqueda, onChanged }: Props) {
  const [ordenes, setOrdenes] = useState<OrdenParaTicket[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [seleccionada, setSeleccionada] = useState<OrdenParaTicket | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  const reload = useCallback(() => setReloadKey(k => k + 1), [])

  useEffect(() => {
    let active = true
    async function load () {
      try {
        const data = await fetchOrdenesParaTicket()
        if (!active) return
        setOrdenes(data)
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

  const q = busqueda.trim().toLowerCase()
  const filtradas = q
    ? ordenes.filter(o =>
        (o.talonario ?? '').toLowerCase().includes(q) ||
        o.factura.toLowerCase().includes(q) ||
        (o.cliente ?? '').toLowerCase().includes(q),
      )
    : ordenes

  if (loading) {
    return (
      <div style={{ padding: '72px 24px', textAlign: 'center', color: 'var(--gray-500)', fontSize: 13.5 }}>
        <div style={{
          display: 'inline-block', width: 22, height: 22,
          border: '2.5px solid var(--gray-200)', borderTopColor: 'var(--red)',
          borderRadius: '50%', animation: 'spin 0.7s linear infinite', marginBottom: 12,
        }} />
        <div>Cargando órdenes…</div>
      </div>
    )
  }

  return (
    <>
      {error && (
        <div style={{
          background: 'var(--red-50)', border: '1px solid var(--red-ring)',
          borderRadius: 'var(--radius-lg)', padding: '12px 16px', fontSize: 13.5, color: 'var(--red)',
          display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16,
        }}>
          <AlertCircle size={16} /> {error}
        </div>
      )}

      {filtradas.length === 0 ? (
        <div style={{ padding: '80px 24px', textAlign: 'center', maxWidth: 420, margin: '0 auto' }}>
          <div style={{
            width: 56, height: 56, borderRadius: 'var(--radius-lg)',
            background: 'var(--gray-100)', color: 'var(--gray-500)',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 18,
          }}>
            <Inbox size={22} strokeWidth={1.6} />
          </div>
          <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--gray-900)', margin: 0 }}>
            {q ? 'Sin coincidencias' : 'No hay órdenes nuevas'}
          </h3>
          <p style={{ fontSize: 13.5, color: 'var(--gray-500)', marginTop: 8, lineHeight: 1.5 }}>
            {q ? 'Ajusta la búsqueda.' : 'Cuando Alegra registre una factura nueva, aparecerá aquí.'}
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
          {filtradas.map(o => (
            <OrdenCard key={o.alegra_id} orden={o} onAbrir={() => setSeleccionada(o)} />
          ))}
        </div>
      )}

      {seleccionada && (
        <AbrirTicketModal
          orden={seleccionada}
          user={user}
          onClose={() => setSeleccionada(null)}
          onSaved={() => { setSeleccionada(null); reload(); onChanged() }}
        />
      )}
    </>
  )
}

function OrdenCard ({ orden, onAbrir }: { orden: OrdenParaTicket; onAbrir: () => void }) {
  const pagada = orden.saldo <= UMBRAL_SALDO
  const nombres = orden.productos.map(p => p.nombre).filter(Boolean) as string[]

  return (
    <div className='card' style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ padding: '20px 20px 16px', flex: 1, display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 4, flexWrap: 'wrap' as const }}>
          <span style={{ fontSize: 22, fontWeight: 700, color: 'var(--gray-900)', letterSpacing: '-0.02em' }}>
            #{orden.talonario || '—'}
          </span>
          <span style={{ fontSize: 12.5, color: 'var(--gray-500)' }}>{orden.factura}</span>
        </div>
        <div style={{ fontSize: 14, color: 'var(--gray-700)', fontWeight: 500, marginBottom: 12 }}>
          {orden.cliente ?? 'Cliente —'}
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

        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
          fontSize: 12.5, padding: '10px 0', borderTop: '1px solid var(--border-subtle)', marginTop: 'auto',
        }}>
          <MoneyStat label='Total' value={orden.total} />
          <MoneyStat label='Pagado' value={orden.total_pagado} color='var(--green)' />
          <MoneyStat label='Pendiente' value={orden.saldo} color={pagada ? 'var(--green)' : 'var(--red)'} />
        </div>

        <div style={{ marginTop: 10 }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '4px 12px', borderRadius: 9999, fontSize: 12, fontWeight: 700,
            background: pagada ? 'var(--green-bg)' : 'var(--red-50)',
            color: pagada ? 'var(--green)' : 'var(--red)',
          }}>
            {pagada ? 'Pagada ✓' : `Pendiente · ${formatoMoneda(orden.saldo)}`}
          </span>
        </div>
      </div>

      <button
        onClick={onAbrir}
        className='btn btn-primary'
        style={{ width: '100%', height: 48, fontSize: 14.5, fontWeight: 700, borderRadius: 0 }}
      >
        Abrir ticket
      </button>
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
