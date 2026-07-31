'use client'
import { useState, useEffect } from 'react'
import {
  Inbox, ArrowRight, Clock, AlertCircle, CalendarPlus, Save, X, Check, Link2, Unlink,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { fetchActivePieceNames } from '@/lib/production-v2'
import {
  fetchOrdenesDesde28,
  fetchOrdenesMapa,
  fetchCompromisos,
  fetchEventosArmador,
  fechaCompromisoDesdeDia,
  primerDiaMesISO,
  labelArmador,
  formatoCorto,
  type OrdenAlegra,
  type EventoArmador,
} from '@/lib/ordenes'
import { friendlyError } from '@/lib/errorMessages'
import { guardarFechaCompromiso } from '@/app/actions/ordenes'
import AbrirProduccionModal from './AbrirProduccionModal'

interface Props {
  user: { id: string; name: string; role: string }
  onChanged: () => void
}

export default function OrdenesTab ({ user, onChanged }: Props) {
  const [ordenes, setOrdenes] = useState<OrdenAlegra[]>([])
  const [eventos, setEventos] = useState<EventoArmador[]>([])
  const [ordenesMap, setOrdenesMap] = useState<Map<string, OrdenAlegra>>(new Map())
  const [compromisos, setCompromisos] = useState<Map<string, string>>(new Map())
  const [ticketedIds, setTicketedIds] = useState<Set<string>>(new Set())
  const [ticketedFacturas, setTicketedFacturas] = useState<Set<string>>(new Set())
  const [pieceNames, setPieceNames] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState<OrdenAlegra | null>(null)
  const [editing, setEditing] = useState<{ orden: string; fecha: string } | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [errorGuardar, setErrorGuardar] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  const [now, setNow] = useState(() => Date.now())
  const [hoy, setHoy] = useState(() => new Date())

  useEffect(() => {
    let active = true
    async function load () {
      try {
        const today = new Date()
        const [o, mapa, comp, evs, pieces, prodIds, legacy] = await Promise.all([
          fetchOrdenesDesde28(today),
          fetchOrdenesMapa(),
          fetchCompromisos(),
          fetchEventosArmador(),
          fetchActivePieceNames(),
          supabase.from('production_tickets').select('alegra_id'),
          supabase.from('tickets_produccion').select('numero_factura'),
        ])
        if (!active) return
        const ids = new Set<string>((prodIds.data ?? []).map(r => String(r.alegra_id)).filter(Boolean))
        const facturas = new Set<string>((legacy.data ?? []).map(r => String(r.numero_factura)).filter(Boolean))
        setOrdenes(o)
        setOrdenesMap(mapa)
        setCompromisos(comp)
        setEventos(evs.filter(e => eventoEnVentana(e, today)).sort((a, b) => compararEventos(a, b, today)))
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

  function reload () { setReloadKey(k => k + 1) }

  function handleSaved () {
    setSelected(null)
    reload()
    onChanged()
  }

  async function handleGuardarCompromiso () {
    if (!editing || !editing.fecha) { setErrorGuardar('Selecciona una fecha'); return }
    setGuardando(true)
    setErrorGuardar('')
    const res = await guardarFechaCompromiso({ orden: editing.orden, fecha: editing.fecha, created_by: user.name })
    setGuardando(false)
    if (!res.ok) { setErrorGuardar(res.error ?? 'No se pudo guardar'); return }
    setCompromisos(prev => new Map(prev).set(editing.orden, res.data!.fecha))
    setEditing(null)
  }

  if (loading) return <LoadingState message='Cargando órdenes…' />

  const fecha28 = `28/${String(hoy.getMonth() + 1).padStart(2, '0')}`

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

      <SectionHeader
        title='Proceso de armado'
        subtitle='Filas del calendario de los armadores (armado programado del mes en curso en adelante), enlazadas por número de ORDEN con las órdenes. La fecha de compromiso se agrega sola cuando el calendario trae el día.'
        badge={eventos.length > 0 ? String(eventos.length) : undefined}
      />

      {eventos.length === 0 ? (
        <EmptyState
          icon={CalendarPlus}
          title='No hay armado programado'
          description='Cuando los armadores agenden piezas en sus calendarios, aparecerán aquí como filas con su fecha de compromiso.'
        />
      ) : (
        <div className='card' style={{ overflow: 'hidden', marginBottom: 40 }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5 }}>
              <thead>
                <tr>
                  <TH>Orden</TH>
                  <TH>Pieza</TH>
                  <TH>Armador</TH>
                  <TH>Vehículo</TH>
                  <TH>Fecha de compromiso</TH>
                </tr>
              </thead>
              <tbody>
                {eventos.map(ev => (
                  <ArmadoRow
                    key={ev.id}
                    ev={ev}
                    hoy={hoy}
                    ordenesMap={ordenesMap}
                    compromisos={compromisos}
                    editing={editing}
                    guardando={guardando}
                    errorGuardar={errorGuardar}
                    onEditar={() => {
                      const actual = compromisos.get(ev.orden) ?? ''
                      setEditing({ orden: ev.orden, fecha: actual })
                      setErrorGuardar('')
                    }}
                    onCancelarEdicion={() => { setEditing(null); setErrorGuardar('') }}
                    onFechaChange={f => setEditing(prev => prev ? { ...prev, fecha: f } : prev)}
                    onGuardar={handleGuardarCompromiso}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <SectionHeader
        title='Órdenes'
        subtitle={`Todas las órdenes abiertas desde el día 28 del mes actual (${fecha28} en adelante).`}
        badge={ordenes.length > 0 ? String(ordenes.length) : undefined}
      />

      {ordenes.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title='No hay órdenes desde el 28'
          description={`Las facturas de Alegra aparecerán aquí automáticamente cuando tengan fecha de apertura del ${fecha28} en adelante.`}
        />
      ) : (
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16,
        }}>
          {ordenes.map(o => (
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
function ArmadoRow ({ ev, hoy, ordenesMap, compromisos, editing, guardando, errorGuardar, onEditar, onCancelarEdicion, onFechaChange, onGuardar }: {
  ev: EventoArmador
  hoy: Date
  ordenesMap: Map<string, OrdenAlegra>
  compromisos: Map<string, string>
  editing: { orden: string; fecha: string } | null
  guardando: boolean
  errorGuardar: string
  onEditar: () => void
  onCancelarEdicion: () => void
  onFechaChange: (fecha: string) => void
  onGuardar: () => void
}) {
  const orden = ordenesMap.get(ev.orden)
  const compCal = eventoCompromiso(ev, hoy)
  const compManual = compCal == null ? (compromisos.get(ev.orden) ?? null) : null
  const visible = compCal ?? compManual
  const esEdicion = editing?.orden === ev.orden

  return (
    <tr style={{ borderTop: '1px solid var(--border)' }}>
      <td style={{ padding: '12px 16px', verticalAlign: 'middle' }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--gray-900)', fontFeatureSettings: '"tnum" 1' }}>
          #{ev.orden}
        </div>
        <div style={{ fontSize: 11, color: 'var(--gray-400)', marginTop: 2 }}>
          {ev.dia != null ? `Día ${ev.dia}` : 'Sin día'}
        </div>
      </td>
      <td style={{ padding: '12px 16px', verticalAlign: 'middle', color: 'var(--gray-700)', fontWeight: 500 }}>
        {ev.pieza}
      </td>
      <td style={{ padding: '12px 16px', verticalAlign: 'middle' }}>
        <span style={{
          fontSize: 11.5, fontWeight: 600, color: 'var(--gray-600)',
          background: 'var(--gray-100)', border: '1px solid var(--border)',
          padding: '3px 10px', borderRadius: 9999, whiteSpace: 'nowrap' as const,
        }}>
          {labelArmador(ev.calendario)}
        </span>
      </td>
      <td style={{ padding: '12px 16px', verticalAlign: 'middle', minWidth: 180 }}>
        {orden ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Link2 size={13} style={{ color: 'var(--green)', flexShrink: 0 }} />
            <div style={{ minWidth: 0 }}>
              <div style={{ color: 'var(--gray-800)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>
                {orden.vehiculo ?? '—'}
              </div>
              <div style={{ fontSize: 11, color: 'var(--gray-400)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>
                {orden.cliente ?? ''}
              </div>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--gray-400)' }}>
            <Unlink size={13} style={{ flexShrink: 0 }} />
            <span style={{ fontSize: 12 }}>Sin vínculo</span>
          </div>
        )}
      </td>
      <td style={{ padding: '12px 16px', verticalAlign: 'middle', minWidth: 170 }}>
        {esEdicion ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <input
              type='date'
              value={editing.fecha}
              onChange={e => onFechaChange(e.target.value)}
              style={{
                height: 32, fontSize: 13, padding: '0 8px', border: '1px solid var(--border)',
                borderRadius: 8, color: 'var(--gray-800)', background: '#fff',
              }}
            />
            {errorGuardar && <span style={{ fontSize: 11.5, color: 'var(--red)' }}>{errorGuardar}</span>}
            <div style={{ display: 'flex', gap: 6 }}>
              <button className='btn btn-primary' onClick={onGuardar} disabled={guardando} style={{ height: 28, fontSize: 12, padding: '0 10px' }}>
                {guardando ? 'Guardando…' : 'Guardar'} <Save size={12} />
              </button>
              <button className='btn' onClick={onCancelarEdicion} disabled={guardando} style={{ height: 28, fontSize: 12, padding: '0 10px' }}>
                <X size={12} />
              </button>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {visible ? (
              <>
                <span style={{
                  fontSize: 14, fontWeight: 700, color: 'var(--gray-900)', fontFeatureSettings: '"tnum" 1',
                }}>
                  {formatoCorto(visible)}
                </span>
                <span style={{
                  fontSize: 10, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.04em',
                  color: compCal != null ? 'var(--green)' : 'var(--blue)',
                  background: compCal != null ? 'var(--green-50, #eafaf1)' : 'var(--blue-bg)',
                  border: '1px solid var(--border)', padding: '1px 7px', borderRadius: 9999,
                }}>
                  {compCal != null ? 'Calendario' : 'Manual'}
                </span>
              </>
            ) : (
              <span style={{ fontSize: 13, color: 'var(--gray-400)' }}>—</span>
            )}
            {compCal == null && (
              <button className='btn' onClick={onEditar} style={{ height: 26, fontSize: 11.5, padding: '0 9px', marginLeft: 'auto' }}>
                <CalendarPlus size={12} /> {compManual ? 'Editar' : 'Agregar'}
              </button>
            )}
          </div>
        )}
      </td>
    </tr>
  )
}

function TH ({ children }: { children: React.ReactNode }) {
  return (
    <th style={{
      textAlign: 'left', padding: '10px 16px', fontSize: 10.5, fontWeight: 700,
      textTransform: 'uppercase' as const, letterSpacing: '0.05em', color: 'var(--gray-500)',
      background: 'var(--bg-page)', borderBottom: '1px solid var(--border)',
    }}>
      {children}
    </th>
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
