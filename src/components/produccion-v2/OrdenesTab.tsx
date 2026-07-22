'use client'
import { useState, useEffect } from 'react'
import { Inbox, ArrowRight, Clock, AlertCircle } from 'lucide-react'
import {
  fetchOrdenesProduccion,
  fetchActivePieceNames,
  type OrdenProduccion,
} from '@/lib/production-v2'
import { friendlyError } from '@/lib/errorMessages'
import AbrirProduccionModal from './AbrirProduccionModal'

interface Props {
  user: { id: string; name: string; role: string }
  onChanged: () => void
}

export default function OrdenesTab ({ user, onChanged }: Props) {
  const [ordenes, setOrdenes] = useState<OrdenProduccion[]>([])
  const [pieceNames, setPieceNames] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState<OrdenProduccion | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    let active = true
    async function load () {
      try {
        const [o, p] = await Promise.all([fetchOrdenesProduccion(), fetchActivePieceNames()])
        if (!active) return
        setOrdenes(o)
        setPieceNames(p)
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
    const id = setInterval(() => setNow(Date.now()), 60_000)
    return () => clearInterval(id)
  }, [])

  function reload () { setReloadKey(k => k + 1) }

  function handleSaved () {
    setSelected(null)
    reload()
    onChanged()
  }

  if (loading) return <LoadingState message='Cargando órdenes…' />

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

  if (ordenes.length === 0) {
    return (
      <EmptyState
        icon={Inbox}
        title='No hay órdenes pendientes'
        description='Las facturas de Alegra aparecerán aquí automáticamente. Cuando abras producción se creará un ticket y la orden desaparecerá de esta pestaña.'
      />
    )
  }

  return (
    <>
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16,
      }}>
        {ordenes.map(o => (
          <OrdenCard key={o.alegra_id} orden={o} now={now} onAbrir={() => setSelected(o)} />
        ))}
      </div>

      {selected && (
        <AbrirProduccionModal
          orden={selected}
          pieceNames={pieceNames}
          user={user}
          onSaved={handleSaved}
        />
      )}
    </>
  )
}

// ─────────────────────────────────────────────────────────
function OrdenCard ({ orden, now, onAbrir }: { orden: OrdenProduccion; now: number; onAbrir: () => void }) {
  const ageH = (now - new Date(orden.fecha).getTime()) / 3_600_000
  const ageLabel = ageH < 1 ? 'hace minutos' : ageH < 24 ? `hace ${Math.round(ageH)}h` : `hace ${Math.round(ageH / 24)}d`
  const estadoTone = orden.estado_cxc === 'Atraso' ? 'var(--red)' : orden.estado_cxc === 'Cerrado' ? 'var(--green)' : 'var(--gray-500)'

  return (
    <div className='card' style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 20px', borderBottom: '1px solid var(--border)', background: 'var(--bg-page)',
      }}>
        <span style={{
          fontSize: 11, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase' as const,
          color: estadoTone,
        }}>{orden.estado_cxc}</span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11.5, color: 'var(--gray-500)', fontWeight: 500 }}>
          <Clock size={11} /> {ageLabel}
        </span>
      </div>

      <div style={{ padding: '22px 22px 18px', flex: 1, display: 'flex', flexDirection: 'column' }}>
        <div style={{
          fontSize: 26, fontWeight: 700, color: 'var(--gray-900)',
          letterSpacing: '-0.03em', lineHeight: 1.1, marginBottom: 6, fontFeatureSettings: '"tnum" 1',
        }}>
          {orden.talonario ? `Orden #${orden.talonario}` : 'Orden —'}
        </div>
        <div style={{
          fontSize: 14, color: orden.vehiculo ? 'var(--gray-600)' : 'var(--gray-400)',
          fontWeight: 500, fontStyle: orden.vehiculo ? 'normal' : 'italic', marginBottom: 18,
        }}>
          {orden.vehiculo ?? 'Sin identificar'}
        </div>

        <div style={{
          display: 'flex', flexDirection: 'column', gap: 8,
          paddingTop: 16, borderTop: '1px solid var(--border)', marginBottom: 16,
        }}>
          <CompactLine label='Factura' value={orden.factura} />
          <CompactLine label='Cliente' value={orden.cliente ?? '—'} />
        </div>

        <button
          onClick={onAbrir}
          className='btn btn-primary'
          style={{ marginTop: 'auto', width: '100%' }}
        >
          Abrir Producción <ArrowRight size={14} strokeWidth={2.25} />
        </button>
      </div>
    </div>
  )
}

function CompactLine ({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
      <span style={{ fontSize: 11, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600, flexShrink: 0 }}>
        {label}
      </span>
      <span style={{
        fontSize: 13, color: 'var(--gray-800)', fontWeight: 500,
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const, minWidth: 0,
      }}>
        {value}
      </span>
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

function EmptyState ({ icon: Icon, title, description }: {
  icon: React.ComponentType<{ size?: number; strokeWidth?: number; style?: React.CSSProperties }>
  title: string
  description: string
}) {
  return (
    <div style={{ padding: '80px 24px', textAlign: 'center', maxWidth: 420, margin: '0 auto' }}>
      <div style={{
        width: 56, height: 56, borderRadius: 'var(--radius-lg)',
        background: 'var(--red-50)', color: 'var(--red)',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 18,
      }}>
        <Icon size={22} strokeWidth={1.6} />
      </div>
      <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--gray-900)', margin: 0, letterSpacing: '-0.01em' }}>{title}</h3>
      <p style={{ fontSize: 13.5, color: 'var(--gray-500)', marginTop: 8, lineHeight: 1.5 }}>{description}</p>
    </div>
  )
}
