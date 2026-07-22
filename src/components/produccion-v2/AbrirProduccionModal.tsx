'use client'
import { useState, useEffect, useTransition } from 'react'
import {
  X, Package, Minus, Plus, CheckCircle, AlertCircle,
  ChevronLeft, ChevronRight, Calendar, Hammer, Wrench, Pencil, Flag,
} from 'lucide-react'
import {
  type OrdenProduccion,
  type ProductionEmployee,
  type Prioridad,
  fetchProductionEmployees,
} from '@/lib/production-v2'
import { fetchItems, type FacturaItem } from '@/lib/produccion'
import { createProductionTicket, setTicketSchedule, type PieceInput } from '@/app/actions/production'
import { friendlyError } from '@/lib/errorMessages'
import CapacityCalendar from './CapacityCalendar'

interface Props {
  orden: OrdenProduccion
  pieceNames: string[]
  user: { id: string; name: string }
  onSaved: () => void
}

type TipoTrabajo = 'Fabricacion' | 'Reparacion' | 'Modificacion'

const TIPOS: { id: TipoTrabajo; label: string; desc: string; Icon: typeof Hammer }[] = [
  { id: 'Fabricacion', label: 'Fabricar nueva', desc: 'Hacer la defensa desde cero', Icon: Hammer },
  { id: 'Reparacion',  label: 'Reparar',        desc: 'Arreglar una pieza dañada',  Icon: Wrench },
  { id: 'Modificacion',label: 'Modificar',      desc: 'Cambiar una pieza existente',Icon: Pencil },
]

const GRADOS = [
  { id: 'Grado A', desc: 'Daño leve' },
  { id: 'Grado B', desc: 'Daño medio' },
  { id: 'Grado C', desc: 'Daño grave' },
]

function toISO (d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export default function AbrirProduccionModal ({ orden, pieceNames, user, onSaved }: Props) {
  // ── Paso actual del asistente (1, 2 o 3)
  const [step, setStep] = useState<1 | 2 | 3>(1)

  // ── Paso 1: tipo de trabajo
  const [tipoTrabajo, setTipoTrabajo] = useState<TipoTrabajo | null>(null)
  const [gradoReparacion, setGradoReparacion] = useState<string>('')

  // ── Paso 2: piezas y cantidades
  const [selected, setSelected] = useState<Record<string, number>>({})
  const [items, setItems] = useState<FacturaItem[]>([])
  const [loadingItems, setLoadingItems] = useState(true)
  const [showProductos, setShowProductos] = useState(false)

  // ── Paso 3: cuándo y quién
  const [employees, setEmployees] = useState<ProductionEmployee[]>([])
  const [fabricadorId, setFabricadorId] = useState<string | null>(null)
  const [fechaProgramada, setFechaProgramada] = useState<string>('')
  const [urgente, setUrgente] = useState(false)

  // ── Guardado
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState('')
  const [aviso, setAviso] = useState('')
  const [done, setDone] = useState(false)

  useEffect(() => {
    let active = true
    fetchItems(orden.alegra_id)
      .then(data => { if (active) setItems(data) })
      .catch(() => {})
      .finally(() => { if (active) setLoadingItems(false) })
    fetchProductionEmployees().then(e => { if (active) setEmployees(e) }).catch(() => {})
    return () => { active = false }
  }, [orden.alegra_id])

  const todayDate = new Date()
  const tomorrowDate = new Date(todayDate)
  tomorrowDate.setDate(tomorrowDate.getDate() + 1)
  const todayISO = toISO(todayDate)
  const tomorrowISO = toISO(tomorrowDate)

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
      return { ...s, [piece]: Math.max(1, cur + delta) }
    })
  }

  const pieces: PieceInput[] = Object.entries(selected).map(([piece_name, quantity]) => ({ piece_name, quantity }))
  const totalUnidades = pieces.reduce((s, p) => s + p.quantity, 0)
  const fabricador = employees.find(e => e.id === fabricadorId) ?? null

  // ── Validación por paso (mensajes que cualquiera entiende)
  function validateStep (): string {
    if (step === 1) {
      if (!tipoTrabajo) return 'Toca una opción para continuar'
      if (tipoTrabajo === 'Reparacion' && !gradoReparacion) return 'Toca el grado de daño para continuar'
    }
    if (step === 2) {
      if (pieces.length === 0) return 'Toca al menos una pieza para continuar'
    }
    if (step === 3) {
      if (!fechaProgramada) return 'Elige qué día se empieza a fabricar'
    }
    return ''
  }

  function handleNext () {
    const msg = validateStep()
    if (msg) { setAviso(msg); return }
    setAviso('')
    if (step < 3) setStep((step + 1) as 1 | 2 | 3)
  }

  function handleBack () {
    setAviso('')
    if (step > 1) setStep((step - 1) as 1 | 2 | 3)
  }

  function handleSave () {
    const msg = validateStep()
    if (msg || pending) { if (msg) setAviso(msg); return }
    setError('')
    const prioridad: Prioridad = urgente ? 'alta' : 'normal'
    startTransition(async () => {
      const res = await createProductionTicket({
        alegra_id: orden.alegra_id,
        factura: orden.factura,
        orden: orden.talonario ?? null,
        cliente: orden.cliente,
        vehiculo: orden.vehiculo,
        pieces,
        created_by: user.name,
        tipo_trabajo: tipoTrabajo as TipoTrabajo,
        grado_reparacion: tipoTrabajo === 'Reparacion' ? (gradoReparacion as 'Grado A' | 'Grado B' | 'Grado C') : null,
      })
      if (!res.ok) { setError(friendlyError(res.error)); return }
      const sched = await setTicketSchedule({
        ticket_id: res.data as string,
        fecha_programada: fechaProgramada,
        fabricador_id: fabricadorId,
        fabricador_name: fabricador?.name ?? null,
        prioridad,
        changed_by: user.name,
      })
      if (!sched.ok) {
        setError(`El ticket se creó, pero no se pudo programar la fecha. ${friendlyError(sched.error)}`)
        return
      }
      setDone(true)
      setTimeout(onSaved, 1200)
    })
  }

  const stepTitles = ['¿Qué se va a hacer?', '¿Qué piezas lleva?', '¿Cuándo y quién?']

  return (
    <div className='modal-overlay' onClick={() => !pending && !done && onSaved()}>
      <div onClick={e => e.stopPropagation()} className='modal-card' style={{
        padding: 0, maxWidth: 640, width: '100%', maxHeight: '92vh', display: 'flex', flexDirection: 'column',
      }}>
        {/* ── Header ── */}
        <div style={{
          padding: '20px 24px 16px', borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16,
        }}>
          <div style={{ minWidth: 0 }}>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--gray-900)', letterSpacing: '-0.02em', margin: 0 }}>
              {orden.vehiculo ?? 'Nuevo ticket'}
            </h2>
            <p style={{ fontSize: 13, color: 'var(--gray-500)', marginTop: 4 }}>
              Orden #{orden.talonario ?? '—'} · Factura {orden.factura} · {orden.cliente ?? 'Cliente —'}
            </p>
          </div>
          <button
            onClick={() => !pending && !done && onSaved()}
            aria-label='Cerrar'
            style={{ background: 'transparent', border: 'none', color: 'var(--gray-500)', cursor: 'pointer', padding: 4, flexShrink: 0 }}
          >
            <X size={20} />
          </button>
        </div>

        {done ? (
          /* ── Éxito ── */
          <div style={{ padding: '56px 28px', textAlign: 'center' }}>
            <div style={{
              width: 64, height: 64, borderRadius: '50%', background: 'var(--green-bg)', color: 'var(--green)',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16,
            }}>
              <CheckCircle size={32} />
            </div>
            <h3 style={{ fontSize: 20, fontWeight: 700, color: 'var(--gray-900)', margin: 0 }}>¡Ticket creado!</h3>
            <p style={{ fontSize: 14, color: 'var(--gray-500)', marginTop: 8 }}>
              Ya está en <strong>Tickets Pendientes</strong>.
            </p>
          </div>
        ) : (
          <>
            {/* ── Barra de progreso ── */}
            <div style={{ padding: '14px 24px 0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                {[1, 2, 3].map(n => (
                  <div key={n} style={{
                    flex: 1, height: 6, borderRadius: 3,
                    background: n <= step ? 'var(--red)' : 'var(--gray-100)',
                    transition: 'background 0.2s',
                  }} />
                ))}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--red)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Paso {step} de 3
                </span>
                <span style={{ fontSize: 12, color: 'var(--gray-500)' }}>{stepTitles[step - 1]}</span>
              </div>
            </div>

            {/* ── Cuerpo del paso ── */}
            <div style={{ padding: '18px 24px', flex: 1, overflowY: 'auto' }}>

              {/* ══════ PASO 1: ¿Qué se va a hacer? ══════ */}
              {step === 1 && (
                <div>
                  <h3 style={{ fontSize: 22, fontWeight: 700, color: 'var(--gray-900)', margin: '4px 0 18px' }}>
                    {stepTitles[0]}
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {TIPOS.map(({ id, label, desc, Icon }) => {
                      const active = tipoTrabajo === id
                      return (
                        <button
                          key={id}
                          type='button'
                          onClick={() => { setTipoTrabajo(id); if (id !== 'Reparacion') setGradoReparacion(''); setAviso('') }}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 16,
                            padding: '18px 20px', textAlign: 'left',
                            background: active ? 'var(--red-50)' : 'var(--bg-card)',
                            border: `2px solid ${active ? 'var(--red)' : 'var(--border)'}`,
                            borderRadius: 'var(--radius-lg)', cursor: 'pointer',
                            transition: 'all var(--t-fast)',
                          }}
                        >
                          <div style={{
                            width: 48, height: 48, borderRadius: 'var(--radius)', flexShrink: 0,
                            background: active ? 'var(--red)' : 'var(--gray-100)',
                            color: active ? '#fff' : 'var(--gray-600)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}>
                            <Icon size={22} />
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 17, fontWeight: 700, color: active ? 'var(--red)' : 'var(--gray-900)' }}>{label}</div>
                            <div style={{ fontSize: 13, color: 'var(--gray-500)', marginTop: 2 }}>{desc}</div>
                          </div>
                          {active && <CheckCircle size={22} style={{ color: 'var(--red)', flexShrink: 0 }} />}
                        </button>
                      )
                    })}
                  </div>

                  {/* Grado de daño (solo si es Reparación) */}
                  {tipoTrabajo === 'Reparacion' && (
                    <div style={{ marginTop: 20 }}>
                      <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--gray-900)', marginBottom: 10 }}>
                        ¿Qué tan grande es el daño?
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                        {GRADOS.map(g => {
                          const active = gradoReparacion === g.id
                          return (
                            <button
                              key={g.id}
                              type='button'
                              onClick={() => { setGradoReparacion(g.id); setAviso('') }}
                              style={{
                                padding: '16px 10px', textAlign: 'center',
                                background: active ? 'var(--red-50)' : 'var(--bg-card)',
                                border: `2px solid ${active ? 'var(--red)' : 'var(--border)'}`,
                                borderRadius: 'var(--radius-lg)', cursor: 'pointer',
                              }}
                            >
                              <div style={{ fontSize: 16, fontWeight: 700, color: active ? 'var(--red)' : 'var(--gray-900)' }}>{g.id}</div>
                              <div style={{ fontSize: 12, color: 'var(--gray-500)', marginTop: 3 }}>{g.desc}</div>
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ══════ PASO 2: ¿Qué piezas lleva? ══════ */}
              {step === 2 && (
                <div>
                  <h3 style={{ fontSize: 22, fontWeight: 700, color: 'var(--gray-900)', margin: '4px 0 6px' }}>
                    {stepTitles[1]}
                  </h3>
                  <p style={{ fontSize: 13.5, color: 'var(--gray-500)', margin: '0 0 14px' }}>
                    Toca cada pieza que lleva el trabajo.
                  </p>

                  {/* Referencia: productos de la factura */}
                  <button
                    type='button'
                    onClick={() => setShowProductos(s => !s)}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                      background: 'var(--bg-page)', border: '1px solid var(--border)',
                      borderRadius: 'var(--radius)', padding: '12px 14px', cursor: 'pointer',
                      color: 'var(--gray-700)', fontSize: 13.5, fontWeight: 600, marginBottom: 14,
                    }}
                  >
                    <Package size={15} style={{ color: 'var(--gray-500)' }} />
                    <span style={{ flex: 1, textAlign: 'left' }}>Ver lo que dice la factura ({loadingItems ? '…' : items.length} productos)</span>
                    {showProductos ? <ChevronLeft size={15} style={{ transform: 'rotate(-90deg)' }} /> : <ChevronRight size={15} style={{ transform: 'rotate(90deg)' }} />}
                  </button>
                  {showProductos && (
                    <div style={{
                      marginBottom: 14, border: '1px solid var(--border)', borderRadius: 'var(--radius)',
                      background: 'var(--bg-card)', padding: '4px 14px',
                    }}>
                      {items.length === 0 ? (
                        <div style={{ padding: '12px 0', fontSize: 13, color: 'var(--gray-500)' }}>Sin productos en la factura</div>
                      ) : items.map((it, i) => (
                        <div key={i} style={{
                          display: 'flex', justifyContent: 'space-between', gap: 12,
                          padding: '10px 0', borderTop: i === 0 ? 'none' : '1px solid var(--border-subtle)',
                        }}>
                          <div style={{ fontSize: 13.5, color: 'var(--gray-900)', fontWeight: 500 }}>{it.nombre ?? '—'}</div>
                          <div style={{ flexShrink: 0, fontSize: 13, color: 'var(--gray-500)', fontWeight: 600 }}>×{it.cantidad}</div>
                        </div>
                      ))}
                    </div>
                  )}

                  {pieceNames.length === 0 ? (
                    <div style={{
                      background: 'var(--amber-bg)', border: '1px solid var(--amber-ring)',
                      borderRadius: 'var(--radius)', padding: '14px 16px', fontSize: 14, color: 'var(--amber)',
                    }}>
                      No hay piezas en el catálogo. Avise al administrador.
                    </div>
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 10 }}>
                      {pieceNames.map(p => {
                        const qty = selected[p]
                        const isSel = qty != null
                        return (
                          <div
                            key={p}
                            onClick={() => { toggle(p); setAviso('') }}
                            style={{
                              border: `2px solid ${isSel ? 'var(--red)' : 'var(--border)'}`,
                              background: isSel ? 'var(--red-50)' : 'var(--bg-card)',
                              borderRadius: 'var(--radius-lg)', padding: '14px', cursor: 'pointer',
                              transition: 'all var(--t-fast)',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                              <span style={{
                                fontSize: 15, fontWeight: isSel ? 700 : 500,
                                color: isSel ? 'var(--red)' : 'var(--gray-800)',
                                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const, minWidth: 0,
                              }}>{p}</span>
                              {isSel && <CheckCircle size={18} style={{ color: 'var(--red)', flexShrink: 0 }} />}
                            </div>
                            {isSel && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12 }} onClick={e => e.stopPropagation()}>
                                <button type='button' onClick={() => setQty(p, -1)} aria-label='Quitar una'
                                  style={{
                                    width: 40, height: 40, borderRadius: 'var(--radius)', border: '1px solid var(--border)',
                                    background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  }}>
                                  <Minus size={16} />
                                </button>
                                <span style={{ fontSize: 20, fontWeight: 700, color: 'var(--gray-900)', minWidth: 32, textAlign: 'center' as const }}>{qty}</span>
                                <button type='button' onClick={() => setQty(p, 1)} aria-label='Agregar una'
                                  style={{
                                    width: 40, height: 40, borderRadius: 'var(--radius)', border: '1px solid var(--border)',
                                    background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  }}>
                                  <Plus size={16} />
                                </button>
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {pieces.length > 0 && (
                    <div style={{
                      marginTop: 16, padding: '12px 16px', background: 'var(--red-50)',
                      border: '1px solid var(--red-ring)', borderRadius: 'var(--radius)',
                      fontSize: 14, color: 'var(--red)', fontWeight: 600,
                    }}>
                      ✓ {pieces.length} pieza{pieces.length !== 1 ? 's' : ''} · {totalUnidades} en total
                    </div>
                  )}
                </div>
              )}

              {/* ══════ PASO 3: ¿Cuándo y quién? ══════ */}
              {step === 3 && (
                <div>
                  <h3 style={{ fontSize: 22, fontWeight: 700, color: 'var(--gray-900)', margin: '4px 0 18px' }}>
                    {stepTitles[2]}
                  </h3>

                  {/* Día de inicio — botones rápidos */}
                  <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--gray-900)', marginBottom: 10 }}>
                    <Calendar size={14} style={{ display: 'inline', marginRight: 6, verticalAlign: '-2px' }} />
                    ¿Qué día se empieza a fabricar?
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
                    {[{ label: 'Hoy', iso: todayISO }, { label: 'Mañana', iso: tomorrowISO }].map(opt => {
                      const active = fechaProgramada === opt.iso
                      return (
                        <button
                          key={opt.label}
                          type='button'
                          onClick={() => { setFechaProgramada(opt.iso); setAviso('') }}
                          style={{
                            padding: '16px 10px', fontSize: 16, fontWeight: 700,
                            color: active ? '#fff' : 'var(--gray-800)',
                            background: active ? 'var(--red)' : 'var(--bg-card)',
                            border: `2px solid ${active ? 'var(--red)' : 'var(--border)'}`,
                            borderRadius: 'var(--radius-lg)', cursor: 'pointer',
                          }}
                        >
                          {opt.label}
                        </button>
                      )
                    })}
                  </div>
                  <p style={{ fontSize: 12.5, color: 'var(--gray-500)', margin: '0 0 8px' }}>
                    O toca otro día en el calendario:
                  </p>
                  <CapacityCalendar
                    selectedDate={fechaProgramada}
                    onSelect={d => { setFechaProgramada(d); setAviso('') }}
                    fabricadorId={fabricadorId}
                  />

                  {/* Fabricador — botones con nombres */}
                  <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--gray-900)', margin: '22px 0 10px' }}>
                    ¿Quién lo fabrica? <span style={{ fontWeight: 400, color: 'var(--gray-500)', fontSize: 13 }}>(puede quedar sin asignar)</span>
                  </div>
                  {employees.length === 0 ? (
                    <div style={{
                      background: 'var(--amber-bg)', border: '1px solid var(--amber-ring)',
                      borderRadius: 'var(--radius)', padding: '12px 14px', fontSize: 13.5, color: 'var(--amber)',
                    }}>
                      No hay empleados registrados. Avise al administrador.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {employees.map(e => {
                        const active = fabricadorId === e.id
                        return (
                          <button
                            key={e.id}
                            type='button'
                            onClick={() => setFabricadorId(active ? null : e.id)}
                            style={{
                              padding: '12px 18px', fontSize: 15, fontWeight: 600,
                              color: active ? '#fff' : 'var(--gray-800)',
                              background: active ? 'var(--red)' : 'var(--bg-card)',
                              border: `2px solid ${active ? 'var(--red)' : 'var(--border)'}`,
                              borderRadius: 9999, cursor: 'pointer',
                            }}
                          >
                            {e.name}
                          </button>
                        )
                      })}
                    </div>
                  )}

                  {/* Prioridad — solo 2 opciones */}
                  <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--gray-900)', margin: '22px 0 10px' }}>
                    <Flag size={14} style={{ display: 'inline', marginRight: 6, verticalAlign: '-2px' }} />
                    ¿Es urgente?
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    {[{ label: 'Normal', val: false }, { label: '🔥 Urgente', val: true }].map(opt => {
                      const active = urgente === opt.val
                      return (
                        <button
                          key={opt.label}
                          type='button'
                          onClick={() => setUrgente(opt.val)}
                          style={{
                            padding: '14px 10px', fontSize: 16, fontWeight: 700,
                            color: active ? (opt.val ? 'var(--red)' : '#fff') : 'var(--gray-800)',
                            background: active ? (opt.val ? 'var(--red-50)' : 'var(--gray-700)') : 'var(--bg-card)',
                            border: `2px solid ${active ? (opt.val ? 'var(--red)' : 'var(--gray-700)') : 'var(--border)'}`,
                            borderRadius: 'var(--radius-lg)', cursor: 'pointer',
                          }}
                        >
                          {opt.label}
                        </button>
                      )
                    })}
                  </div>

                  {/* Resumen de la elección */}
                  {fechaProgramada && (
                    <div style={{
                      marginTop: 18, padding: '14px 16px',
                      background: 'var(--red-50)', border: '1px solid var(--red-ring)',
                      borderRadius: 'var(--radius)', fontSize: 14.5, color: 'var(--red)', fontWeight: 600,
                      display: 'flex', alignItems: 'center', gap: 8,
                    }}>
                      <Calendar size={16} />
                      Empieza: {formatDateLong(fechaProgramada)}
                      {fabricador && <> · {fabricador.name}</>}
                      {urgente && <> · 🔥 Urgente</>}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* ── Footer: aviso + navegación ── */}
            <div style={{ padding: '14px 24px 18px', borderTop: '1px solid var(--border)' }}>
              {(aviso || error) && (
                <div style={{
                  marginBottom: 12, background: 'var(--red-50)', border: '1px solid var(--red-ring)',
                  borderRadius: 'var(--radius)', padding: '10px 14px', fontSize: 14, color: 'var(--red)', fontWeight: 600,
                  display: 'flex', alignItems: 'center', gap: 8,
                }}>
                  <AlertCircle size={16} style={{ flexShrink: 0 }} /> {error || aviso}
                </div>
              )}
              <div style={{ display: 'flex', gap: 10 }}>
                {step > 1 ? (
                  <button
                    className='btn btn-secondary'
                    onClick={handleBack}
                    disabled={pending}
                    style={{ height: 52, padding: '0 20px', fontSize: 15 }}
                  >
                    <ChevronLeft size={17} /> Atrás
                  </button>
                ) : (
                  <button
                    className='btn btn-secondary'
                    onClick={() => !pending && onSaved()}
                    disabled={pending}
                    style={{ height: 52, padding: '0 20px', fontSize: 15 }}
                  >
                    Cancelar
                  </button>
                )}
                {step < 3 ? (
                  <button
                    className='btn btn-primary'
                    onClick={handleNext}
                    style={{ flex: 1, height: 52, fontSize: 16, fontWeight: 700 }}
                  >
                    Siguiente <ChevronRight size={17} />
                  </button>
                ) : (
                  <button
                    className='btn btn-primary'
                    onClick={handleSave}
                    disabled={pending}
                    style={{ flex: 1, height: 52, fontSize: 16, fontWeight: 700 }}
                  >
                    {pending ? 'Guardando…' : '✓ Crear ticket'}
                  </button>
                )}
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
