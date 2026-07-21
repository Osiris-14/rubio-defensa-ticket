'use client'
import { useState, useEffect, useTransition } from 'react'
import { X, Package, Minus, Plus, CheckCircle, AlertCircle, ChevronDown, ChevronRight, Calendar, User, Flag } from 'lucide-react'
import {
  type OrdenProduccion,
  type ProductionEmployee,
  type Prioridad,
  fetchProductionEmployees,
  PRIORIDAD_LABELS,
} from '@/lib/production-v2'
import { fetchItems, type FacturaItem } from '@/lib/produccion'
import { createProductionTicket, setTicketSchedule, type PieceInput } from '@/app/actions/production'
import CapacityCalendar from './CapacityCalendar'

interface Props {
  orden: OrdenProduccion
  pieceNames: string[]
  user: { id: string; name: string }
  onSaved: () => void
}

export default function AbrirProduccionModal ({ orden, pieceNames, user, onSaved }: Props) {
  const [selected, setSelected] = useState<Record<string, number>>({})
  const [items, setItems] = useState<FacturaItem[]>([])
  const [loadingItems, setLoadingItems] = useState(true)
  const [errorItems, setErrorItems] = useState('')
  const [showProductos, setShowProductos] = useState(true)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const [tipoTrabajo, setTipoTrabajo] = useState<'Fabricacion' | 'Reparacion' | 'Modificacion'>('Fabricacion')
  const [gradoReparacion, setGradoReparacion] = useState<string>('')

  // Planificación
  const [employees, setEmployees] = useState<ProductionEmployee[]>([])
  const [fabricadorId, setFabricadorId] = useState<string | null>(null)
  const [fechaProgramada, setFechaProgramada] = useState<string>('')
  const [prioridad, setPrioridad] = useState<Prioridad>('normal')

  useEffect(() => {
    let active = true
    async function loadItems () {
      try {
        const data = await fetchItems(orden.alegra_id)
        if (!active) return
        setItems(data)
        setErrorItems('')
      } catch (e) {
        if (active) setErrorItems(e instanceof Error ? e.message : String(e))
      } finally {
        if (active) setLoadingItems(false)
      }
    }
    loadItems()
    fetchProductionEmployees().then(e => { if (active) setEmployees(e) }).catch(() => {})
    return () => { active = false }
  }, [orden.alegra_id])

  function toggle (piece: string) {
    setSelected(s => {
      const next = { ...s }
      if (next[piece] != null) delete next[piece]
      else next[piece] = 1
      return next
    })
  }

  function setQty (piece: string, delta: number) {
    setSelected(s => {
      const cur = s[piece] ?? 1
      const next = Math.max(1, cur + delta)
      return { ...s, [piece]: next }
    })
  }

  const pieces: PieceInput[] = Object.entries(selected).map(([piece_name, quantity]) => ({ piece_name, quantity }))
  const canSave = pieces.length > 0 && !pending
    && (tipoTrabajo !== 'Reparacion' || gradoReparacion !== '')
    && fechaProgramada !== ''

  const fabricador = employees.find(e => e.id === fabricadorId) ?? null

  function handleSave () {
    if (!canSave) return
    setError('')
    startTransition(async () => {
      // 1) Crear el ticket
      const res = await createProductionTicket({
        alegra_id: orden.alegra_id,
        factura: orden.factura,
        orden: orden.talonario ?? null,
        cliente: orden.cliente,
        vehiculo: orden.vehiculo,
        pieces,
        created_by: user.name,
        tipo_trabajo: tipoTrabajo,
        grado_reparacion: tipoTrabajo === 'Reparacion' ? (gradoReparacion as 'Grado A' | 'Grado B' | 'Grado C') : null,
      })
      if (!res.ok) { setError(res.error ?? 'Error al guardar'); return }
      // 2) Programar la fecha de fabricación
      const sched = await setTicketSchedule({
        ticket_id: res.data as string,
        fecha_programada: fechaProgramada,
        fabricador_id: fabricadorId,
        fabricador_name: fabricador?.name ?? null,
        prioridad,
        changed_by: user.name,
      })
      if (!sched.ok) {
        // El ticket se creó pero falló la programación — avisar pero no bloquear
        setError(`Ticket creado, pero falló la programación: ${sched.error}`)
        return
      }
      setDone(true)
      setTimeout(onSaved, 900)
    })
  }

  return (
    <div className='modal-overlay' onClick={() => !pending && !done && onSaved()}>
      <div onClick={e => e.stopPropagation()} className='modal-card' style={{
        padding: 0, maxWidth: 640, width: '100%', maxHeight: '90vh', display: 'flex', flexDirection: 'column',
      }}>
        {/* Header */}
        <div style={{
          padding: '22px 28px 18px', borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16,
        }}>
          <div style={{ minWidth: 0 }}>
            <div className='eyebrow' style={{ color: 'var(--red)', marginBottom: 8 }}>Abrir producción</div>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--gray-900)', letterSpacing: '-0.02em', margin: 0 }}>
              {orden.vehiculo ?? 'Ticket de producción'}
            </h2>
            <p style={{ fontSize: 13, color: 'var(--gray-500)', marginTop: 6 }}>
              Orden #{orden.talonario ?? '—'} · Factura {orden.factura} · {orden.cliente ?? 'Cliente —'}
            </p>
          </div>
          <button
            onClick={() => !pending && !done && onSaved()}
            aria-label='Cerrar'
            style={{ background: 'transparent', border: 'none', color: 'var(--gray-500)', cursor: 'pointer', padding: 4, flexShrink: 0 }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        {done ? (
          <div style={{ padding: '48px 28px', textAlign: 'center' }}>
            <div style={{
              width: 48, height: 48, borderRadius: '50%', background: 'var(--green-bg)', color: 'var(--green)',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14,
            }}>
              <CheckCircle size={24} />
            </div>
            <h3 style={{ fontSize: 17, fontWeight: 700, color: 'var(--gray-900)', margin: 0 }}>Ticket creado</h3>
            <p style={{ fontSize: 13.5, color: 'var(--gray-500)', marginTop: 6 }}>
              La orden pasó a <strong>Tickets Pendientes</strong>.
            </p>
          </div>
        ) : (
          <>
            <div style={{ padding: '20px 28px', flex: 1, overflowY: 'auto' }}>
              {/* Productos de la factura (Alegra) */}
              <div style={{ marginBottom: 22 }}>
                <button
                  type='button'
                  onClick={() => setShowProductos(s => !s)}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                    background: 'var(--bg-page)', border: '1px solid var(--border)',
                    borderRadius: 'var(--radius)', padding: '10px 14px', cursor: 'pointer',
                    color: 'var(--gray-700)', fontSize: 13, fontWeight: 600,
                  }}
                >
                  {showProductos ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  <Package size={13} style={{ color: 'var(--gray-500)' }} />
                  <span style={{ flex: 1, textAlign: 'left' }}>Productos de la factura</span>
                  <span style={{
                    fontSize: 11, fontWeight: 700, color: 'var(--gray-500)',
                    background: 'var(--bg-card)', padding: '1px 8px', borderRadius: 9999, border: '1px solid var(--border)',
                  }}>
                    {loadingItems ? '…' : items.length}
                  </span>
                </button>
                {showProductos && (
                  <div style={{
                    marginTop: 8, border: '1px solid var(--border)', borderRadius: 'var(--radius)',
                    background: 'var(--bg-card)', padding: '4px 14px',
                  }}>
                    {loadingItems ? (
                      <div style={{ padding: '12px 0', fontSize: 12.5, color: 'var(--gray-500)' }}>Cargando productos…</div>
                    ) : errorItems ? (
                      <div style={{ padding: '12px 0', fontSize: 12.5, color: 'var(--red)' }}>{errorItems}</div>
                    ) : items.length === 0 ? (
                      <div style={{ padding: '12px 0', fontSize: 12.5, color: 'var(--gray-500)' }}>Sin productos</div>
                    ) : (
                      items.map((it, i) => (
                        <div key={i} style={{
                          display: 'flex', justifyContent: 'space-between', gap: 12,
                          padding: '11px 0', borderTop: i === 0 ? 'none' : '1px solid var(--border-subtle)',
                        }}>
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <div style={{ fontSize: 13.5, color: 'var(--gray-900)', fontWeight: 500 }}>
                              {it.nombre ?? '—'}
                            </div>
                            {it.descripcion && (
                              <div style={{ fontSize: 12, color: 'var(--gray-500)', marginTop: 3, lineHeight: 1.4 }}>
                                {it.descripcion}
                              </div>
                            )}
                          </div>
                          <div style={{ flexShrink: 0, fontSize: 12.5, color: 'var(--gray-500)', fontWeight: 600, alignSelf: 'center' }}>
                            ×{it.cantidad}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>

              {/* Tipo de trabajo */}
              <div style={{ marginBottom: 22 }}>
                <label className='form-label'>Tipo de trabajo</label>
                <div className='segmented' style={{ width: '100%' }}>
                  {(['Fabricacion', 'Reparacion', 'Modificacion'] as const).map(t => (
                    <button
                      key={t}
                      type='button'
                      onClick={() => { setTipoTrabajo(t); if (t !== 'Reparacion') setGradoReparacion('') }}
                      className={`segmented-item ${tipoTrabajo === t ? 'active' : ''}`}
                    >
                      {t}
                    </button>
                  ))}
                </div>

                {tipoTrabajo === 'Reparacion' && (
                  <div style={{ marginTop: 14 }}>
                    <label className='form-label'>Grado de reparación<span className='req'>*</span></label>
                    <div className='segmented' style={{ width: '100%' }}>
                      {['Grado A', 'Grado B', 'Grado C'].map(g => (
                        <button
                          key={g}
                          type='button'
                          onClick={() => setGradoReparacion(g)}
                          className={`segmented-item ${gradoReparacion === g ? 'active' : ''}`}
                        >
                          {g}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className='form-label' style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 14 }}>
                <Package size={12} /> Piezas y cantidades<span className='req'>*</span>
              </div>

              {pieceNames.length === 0 ? (
                <div style={{
                  background: 'var(--amber-bg)', border: '1px solid var(--amber-ring)',
                  borderRadius: 'var(--radius)', padding: '12px 14px', fontSize: 13, color: 'var(--amber)',
                }}>
                  No hay piezas en el catálogo. Ejecuta el importador del tarifario primero.
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 8 }}>
                  {pieceNames.map(p => {
                    const qty = selected[p]
                    const isSel = qty != null
                    return (
                      <div key={p} style={{
                        border: `1px solid ${isSel ? 'var(--red)' : 'var(--border)'}`,
                        background: isSel ? 'var(--red-50)' : 'var(--bg-card)',
                        borderRadius: 'var(--radius)', padding: '10px 12px', cursor: 'pointer',
                        transition: 'all var(--t-fast)',
                      }} onClick={() => toggle(p)}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                          <span style={{
                            fontSize: 13, fontWeight: isSel ? 600 : 500,
                            color: isSel ? 'var(--red)' : 'var(--gray-700)',
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const, minWidth: 0,
                          }}>{p}</span>
                          <div className={`checkbox-custom ${isSel ? 'checked' : ''}`} style={{ flexShrink: 0 }}>
                            {isSel && <span style={{ color: '#fff', fontSize: 10, lineHeight: 1 }}>✓</span>}
                          </div>
                        </div>
                        {isSel && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 10 }} onClick={e => e.stopPropagation()}>
                            <button type='button' onClick={() => setQty(p, -1)} className='btn-icon' style={{ width: 26, height: 26 }}>
                              <Minus size={13} />
                            </button>
                            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--gray-900)', minWidth: 24, textAlign: 'center' as const }}>{qty}</span>
                            <button type='button' onClick={() => setQty(p, 1)} className='btn-icon' style={{ width: 26, height: 26 }}>
                              <Plus size={13} />
                            </button>
                            <span style={{ fontSize: 11, color: 'var(--gray-400)', marginLeft: 4 }}>cant.</span>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}

              {pieces.length > 0 && (
                <p style={{ fontSize: 12.5, color: 'var(--gray-500)', marginTop: 14, fontWeight: 500 }}>
                  {pieces.length} pieza{pieces.length !== 1 ? 's' : ''} · {pieces.reduce((s, p) => s + p.quantity, 0)} unidad(es)
                </p>
              )}

              {/* Programación de fabricación */}
              <div style={{ marginTop: 26, paddingTop: 22, borderTop: '1px solid var(--border)' }}>
                <div className='form-label' style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 14 }}>
                  <Calendar size={12} /> Programar inicio de fabricación<span className='req'>*</span>
                </div>

                {/* Fabricador + prioridad */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                  <div>
                    <label className='form-label' style={{ fontSize: 11 }}>
                      <User size={11} style={{ display: 'inline', marginRight: 4, verticalAlign: 'middle' }} />
                      Fabricador
                    </label>
                    <select
                      className='input-base'
                      style={{ height: 40 }}
                      value={fabricadorId ?? ''}
                      onChange={e => setFabricadorId(e.target.value || null)}
                    >
                      <option value=''>Sin asignar…</option>
                      {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className='form-label' style={{ fontSize: 11 }}>
                      <Flag size={11} style={{ display: 'inline', marginRight: 4, verticalAlign: 'middle' }} />
                      Prioridad
                    </label>
                    <select
                      className='input-base'
                      style={{ height: 40 }}
                      value={prioridad}
                      onChange={e => setPrioridad(e.target.value as Prioridad)}
                    >
                      {(['baja','normal','alta','critica'] as Prioridad[]).map(p => (
                        <option key={p} value={p}>{PRIORIDAD_LABELS[p]}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Calendario interactivo */}
                <CapacityCalendar
                  selectedDate={fechaProgramada}
                  onSelect={setFechaProgramada}
                  fabricadorId={fabricadorId}
                />

                {fechaProgramada && (
                  <div style={{
                    marginTop: 12, padding: '10px 14px',
                    background: 'var(--red-50)', border: '1px solid var(--red-ring)',
                    borderRadius: 'var(--radius)', fontSize: 13, color: 'var(--red)', fontWeight: 600,
                    display: 'flex', alignItems: 'center', gap: 8,
                  }}>
                    <Calendar size={14} />
                    Inicio de fabricación: {formatDateLong(fechaProgramada)}
                    {fabricador && <> · 👤 {fabricador.name}</>}
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div style={{
              padding: '16px 28px', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12,
            }}>
              {error && (
                <span style={{ fontSize: 12.5, color: 'var(--red)', display: 'inline-flex', alignItems: 'center', gap: 6, flex: 1 }}>
                  <AlertCircle size={14} /> {error}
                </span>
              )}
              <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
                <button className='btn btn-secondary' onClick={() => !pending && onSaved()} disabled={pending}>
                  Cancelar
                </button>
                <button className='btn btn-primary' onClick={handleSave} disabled={!canSave}>
                  {pending ? 'Guardando…' : 'Crear ticket'}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function formatDateLong (iso: string): string {
  const d = new Date(iso + 'T00:00:00')
  if (isNaN(d.getTime())) return iso
  return d.toLocaleDateString('es-DO', { weekday: 'long', day: 'numeric', month: 'long' })
}
