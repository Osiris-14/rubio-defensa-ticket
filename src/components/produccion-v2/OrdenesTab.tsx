'use client'
import { useState, useEffect, useMemo } from 'react'
import { Inbox, ArrowRight, Clock, AlertCircle, Check, Search } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import {
  fetchActivePieceNames,
  fetchMovimientos,
  insertMovimiento,
} from '@/lib/production-v2'
import {
  fetchOrdenesDesde28,
  fetchOrdenesMapa,
  fetchCompromisos,
  fetchEventosArmador,
  fechaCompromisoDesdeDia,
  primerDiaMesISO,
  type OrdenAlegra,
  type EventoArmador,
} from '@/lib/ordenes'
import { friendlyError } from '@/lib/errorMessages'
import AbrirProduccionModal from './AbrirProduccionModal'
import EtapasBoard from './EtapasBoard'
import { buildEtapasModel, type TarjetaOrden } from './etapas'

interface Props {
  user: { id: string; name: string; role: string }
  onChanged: () => void
}

export default function OrdenesTab ({ user, onChanged }: Props) {
  const [ordenes, setOrdenes] = useState<OrdenAlegra[]>([])
  const [eventos, setEventos] = useState<EventoArmador[]>([])
  const [ordenesMap, setOrdenesMap] = useState<Map<string, OrdenAlegra>>(new Map())
  const [compromisos, setCompromisos] = useState<Map<string, string>>(new Map())
  const [confirmadas, setConfirmadas] = useState<Set<string>>(new Set())
  const [confirmando, setConfirmando] = useState<string | null>(null)
  const [ticketedIds, setTicketedIds] = useState<Set<string>>(new Set())
  const [ticketedFacturas, setTicketedFacturas] = useState<Set<string>>(new Set())
  const [pieceNames, setPieceNames] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState<OrdenAlegra | null>(null)
  const [busqueda, setBusqueda] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  const [now, setNow] = useState(() => Date.now())
  const [hoy, setHoy] = useState(() => new Date())

  useEffect(() => {
    let active = true
    async function load () {
      try {
        const today = new Date()
        const [o, mapa, comp, evs, pieces, prodIds, legacy, movs] = await Promise.all([
          fetchOrdenesDesde28(today),
          fetchOrdenesMapa(),
          fetchCompromisos(),
          fetchEventosArmador(),
          fetchActivePieceNames(),
          supabase.from('production_tickets').select('alegra_id'),
          supabase.from('tickets_produccion').select('numero_factura'),
          fetchMovimientos(500).catch(() => []),
        ])
        if (!active) return
        const ids = new Set<string>((prodIds.data ?? []).map(r => String(r.alegra_id)).filter(Boolean))
        const facturas = new Set<string>((legacy.data ?? []).map(r => String(r.numero_factura)).filter(Boolean))
        setOrdenes(o)
        setOrdenesMap(mapa)
        setCompromisos(comp)
        setEventos(evs.filter(e => eventoEnVentana(e, today)).sort((a, b) => compararEventos(a, b, today)))
        setConfirmadas(new Set(movs.filter(m => m.tipo === 'SALIDA' && m.confirmada).map(m => m.numero_orden)))
        setTicketedIds(ids)
        setTicketedFacturas(facturas)
        setPieceNames(pieces)
        setHoy(today)
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

  const modelo = useMemo(
    () => buildEtapasModel({ eventos, ordenesMap, compromisos, hoy, confirmadas, filtro: busqueda }),
    [eventos, ordenesMap, compromisos, hoy, confirmadas, busqueda],
  )

  function reload () { setReloadKey(k => k + 1) }

  function handleSaved () {
    setSelected(null)
    reload()
    onChanged()
  }

  // Registra la salida en el mismo registro de movimientos que ya alimenta la
  // hoja de movimientos (orden_movimientos, tipo SALIDA + confirmada).
  async function handleConfirmarSalida (t: TarjetaOrden) {
    setConfirmando(t.orden)
    try {
      await insertMovimiento({
        numero_orden: t.orden,
        calendar_event_id: null,
        calendar_name: null,
        pieza: t.pieza || null,
        vehiculo: t.vehiculo,
        cliente: t.cliente,
        desde_puesto: t.puesto,
        hacia_puesto: t.puesto,
        tipo: 'SALIDA',
        detalle: `Salida confirmada por ${user.name}`,
        dias_estancada: t.dias,
        confirmada: true,
      })
      setConfirmadas(prev => new Set(prev).add(t.orden))
      setError('')
    } catch (e) {
      setError(friendlyError(e))
    } finally {
      setConfirmando(null)
    }
  }

  if (loading) return <LoadingState message='Cargando órdenes…' />

  const fecha28 = `28/${String(hoy.getMonth() + 1).padStart(2, '0')}`

  const ordenFiltro = busqueda.trim().toLowerCase()
  const ordenesFiltradas = ordenes.filter(o => {
    if (ordenFiltro && !(o.talonario ?? '').toLowerCase().includes(ordenFiltro) && !o.factura.toLowerCase().includes(ordenFiltro)) return false
    return true
  })
  const hayFiltros = ordenFiltro !== ''

  return (
    <>
      {error && (
        <div style={{
          background: 'var(--red-50)', border: '1px solid var(--red-ring)',
          borderRadius: 'var(--radius-lg)', padding: '14px 16px', fontSize: 13.5, color: 'var(--red)',
          display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24,
        }}>
          <AlertCircle size={16} /> {error}
        </div>
      )}

      <BarraSuperior
        totalOrdenes={modelo.totalOrdenes}
        totalAlertas={modelo.totalAlertas}
        busqueda={busqueda}
        onBusqueda={setBusqueda}
      />

      <EtapasBoard
        columnas={modelo.columnas}
        confirmando={confirmando}
        onConfirmar={handleConfirmarSalida}
      />

      <div style={{ height: 40 }} />

      <SectionHeader
        title='Órdenes'
        subtitle={`Todas las órdenes abiertas desde el día 28 del mes actual (${fecha28} en adelante).`}
        badge={ordenesFiltradas.length > 0 ? String(ordenesFiltradas.length) : undefined}
      />

      {ordenesFiltradas.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title={hayFiltros ? 'Sin coincidencias' : 'No hay órdenes desde el 28'}
          description={hayFiltros
            ? 'Ninguna orden coincide con los filtros aplicados.'
            : `Las facturas de Alegra aparecerán aquí automáticamente cuando tengan fecha de apertura del ${fecha28} en adelante.`}
        />
      ) : (
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16,
        }}>
          {ordenesFiltradas.map(o => (
            <OrdenCard
              key={o.alegra_id}
              orden={o}
              now={now}
              ticketed={ticketedIds.has(o.alegra_id) || ticketedFacturas.has(o.factura)}
              onAbrir={() => setSelected(o)}
            />
          ))}
        </div>
      )}

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

function eventoCompromiso (ev: EventoArmador, hoy: Date): string | null {
  return ev.dia != null ? fechaCompromisoDesdeDia(ev.dia, hoy) : null
}

function eventoEnVentana (ev: EventoArmador, hoy: Date): boolean {
  const primerDia = primerDiaMesISO(hoy)
  return (ev.inicio || '').slice(0, 10) >= primerDia
}

function compararEventos (a: EventoArmador, b: EventoArmador, hoy: Date): number {
  const fa = eventoCompromiso(a, hoy)
  const fb = eventoCompromiso(b, hoy)
  if (fa && fb) return fa.localeCompare(fb)
  if (fa) return -1
  if (fb) return 1
  return (a.inicio || '').localeCompare(b.inicio || '')
}

// ─────────────────────────────────────────────────────────
function BarraSuperior ({ totalOrdenes, totalAlertas, busqueda, onBusqueda }: {
  totalOrdenes: number
  totalAlertas: number
  busqueda: string
  onBusqueda: (v: string) => void
}) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      marginBottom: 14, flexWrap: 'wrap',
    }}>
      <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--gray-900)', letterSpacing: '-0.01em' }}>
        Producción
      </span>

      <Pill>{totalOrdenes} {totalOrdenes === 1 ? 'orden' : 'órdenes'}</Pill>
      {totalAlertas > 0 && (
        <Pill tone='danger'>⚠ {totalAlertas} sin confirmar +2d</Pill>
      )}

      <div style={{ position: 'relative', marginLeft: 'auto' }}>
        <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--gray-400)' }} />
        <input
          className='input-base'
          style={{ height: 32, paddingLeft: 30, width: 150, fontSize: 12.5 }}
          placeholder='Buscar orden…'
          value={busqueda}
          onChange={e => onBusqueda(e.target.value)}
        />
      </div>
    </div>
  )
}

function Pill ({ children, tone = 'neutral' }: { children: React.ReactNode; tone?: 'neutral' | 'danger' }) {
  const danger = tone === 'danger'
  return (
    <span style={{
      fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 9999,
      whiteSpace: 'nowrap' as const,
      color: danger ? '#E8180A' : 'var(--gray-600)',
      background: danger ? 'var(--red-50)' : 'var(--gray-100)',
      border: `1px solid ${danger ? 'var(--red-ring)' : 'var(--border)'}`,
    }}>
      {children}
    </span>
  )
}

// ─────────────────────────────────────────────────────────
function OrdenCard ({ orden, now, ticketed, onAbrir }: {
  orden: OrdenAlegra
  now: number
  ticketed: boolean
  onAbrir: () => void
}) {
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

        {ticketed ? (
          <div style={{
            marginTop: 'auto', width: '100%', height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center',
            gap: 7, background: 'var(--green-50, #eafaf1)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md, 10px)', color: 'var(--green, #0a7d3c)',
            fontSize: 13, fontWeight: 600,
          }}>
            <Check size={14} /> En producción
          </div>
        ) : (
          <button
            onClick={onAbrir}
            className='btn btn-primary'
            style={{ marginTop: 'auto', width: '100%' }}
          >
            Abrir Producción <ArrowRight size={14} strokeWidth={2.25} />
          </button>
        )}
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

function SectionHeader ({ title, subtitle, badge }: { title: string; subtitle: string; badge?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 14, marginTop: 8 }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <h2 style={{ fontSize: 17, fontWeight: 700, color: 'var(--gray-900)', letterSpacing: '-0.015em', margin: 0 }}>{title}</h2>
          {badge && (
            <span style={{
              fontSize: 11.5, fontWeight: 600, color: 'var(--gray-500)',
              background: 'var(--gray-100)', padding: '1px 8px', borderRadius: 9999, minWidth: 22, textAlign: 'center' as const,
            }}>
              {badge}
            </span>
          )}
        </div>
        <p style={{ fontSize: 13, color: 'var(--gray-500)', marginTop: 5, marginBottom: 0, lineHeight: 1.5, maxWidth: 680 }}>{subtitle}</p>
      </div>
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
    <div style={{ padding: '48px 24px', textAlign: 'center', maxWidth: 420, margin: '0 auto' }}>
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
