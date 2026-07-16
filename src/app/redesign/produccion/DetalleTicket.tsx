'use client'
import { useState, useEffect, useCallback } from 'react'
import {
  ArrowLeft, CheckCircle, User, Package, ChevronDown,
  ChevronRight, Plus, AlertCircle, X, Calendar,
} from 'lucide-react'
import {
  type FacturaProduccion,
  type FacturaItem,
  fetchItems,
  darDeAlta,
} from '@/lib/produccion'
import { PIEZAS_OPTIONS } from '@/lib/store'

interface Props {
  factura: FacturaProduccion
  onBack: () => void
  onAlta: () => void
  user: { id: string; name: string }
}

export default function DetalleTicket({ factura, onBack, onAlta, user }: Props) {
  const [items, setItems] = useState<FacturaItem[]>([])
  const [loadingItems, setLoadingItems] = useState(true)
  const [errorItems, setErrorItems] = useState('')

  const [aCargoDe, setACargoDe] = useState('')
  const [tipoTrabajo, setTipoTrabajo] = useState<'Fabricación' | 'Reparación' | 'Modificación'>('Fabricación')
  const [gradoReparacion, setGradoReparacion] = useState('')
  const [piezas, setPiezas] = useState<string[]>([])
  const [piezasCustom, setPiezasCustom] = useState('')
  const [fechaCompromiso, setFechaCompromiso] = useState('')
  const [fechaEntrega, setFechaEntrega] = useState('')
  const [showNotas, setShowNotas] = useState(false)
  const [notas, setNotas] = useState('')

  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [toastOpen, setToastOpen] = useState(false)

  useEffect(() => {
    let active = true
    async function load() {
      try {
        const data = await fetchItems(factura.alegra_id)
        if (!active) return
        setItems(data)
        setErrorItems('')
      } catch (err) {
        if (active) setErrorItems((err as Error).message)
      } finally {
        if (active) setLoadingItems(false)
      }
    }
    load()
    return () => { active = false }
  }, [factura.alegra_id])

  const canSubmit = aCargoDe.trim() !== '' && piezas.length > 0 && !submitting

  const handleSubmit = useCallback(async () => {
    if (!canSubmit) return
    setSubmitting(true)
    setSubmitError('')
    try {
      await darDeAlta(
        factura,
        {
          a_cargo_de: aCargoDe.trim(),
          tipo_modelo: tipoTrabajo,
          re_trabajo: tipoTrabajo === 'Reparación' ? 'Si' : 'No',
          grado_reparacion: tipoTrabajo === 'Reparación' ? gradoReparacion : '',
          piezas,
          piezas_custom: piezasCustom,
          fecha_compromiso: fechaCompromiso,
          fecha_entrega: fechaEntrega,
          notas,
        },
        user,
      )
      setToastOpen(true)
      setTimeout(() => onAlta(), 1100)
    } catch (err) {
      setSubmitError((err as Error).message)
    } finally {
      setSubmitting(false)
    }
  }, [canSubmit, factura, aCargoDe, tipoTrabajo, gradoReparacion, piezas, piezasCustom, fechaCompromiso, fechaEntrega, user, onAlta])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault()
        if (canSubmit) handleSubmit()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [canSubmit, handleSubmit])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, fontFamily: 'Inter, system-ui, sans-serif' }}>
      {/* ── Header ── */}
      <div style={{
        padding: '24px 40px',
        flexShrink: 0,
        borderBottom: '1px solid #E5E7EB',
        background: 'white',
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          fontSize: 12, color: '#6B7280', fontWeight: 500, marginBottom: 16,
        }}>
          <button
            onClick={onBack}
            style={{
              background: 'transparent', border: 'none', padding: 0, cursor: 'pointer',
              color: '#6B7280', display: 'inline-flex', alignItems: 'center', gap: 4,
              fontSize: 12, fontWeight: 500,
            }}
            onMouseEnter={e => e.currentTarget.style.color = '#111827'}
            onMouseLeave={e => e.currentTarget.style.color = '#6B7280'}
          >
            <ArrowLeft size={12} strokeWidth={2} />
            Producción
          </button>
          <span style={{ color: '#D1D5DB' }}>/</span>
          <span style={{ color: '#111827', fontWeight: 600 }}>
            Ticket #{factura.talonario ?? '—'}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 24, flexWrap: 'wrap' }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <h1 style={{
              fontSize: 30, fontWeight: 700, color: '#111827',
              letterSpacing: '-0.03em', lineHeight: 1.1, margin: 0,
            }}>
              {factura.vehiculo ?? 'Ticket de producción'}
            </h1>
            <p style={{ fontSize: 14, color: '#6B7280', marginTop: 8, lineHeight: 1.5 }}>
              Factura {factura.factura} · {factura.cliente ?? 'Cliente —'}
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingTop: 4 }}>
            <span style={{
              fontSize: 11, color: '#6B7280', fontWeight: 500,
              padding: '4px 10px', border: '1px solid #E5E7EB',
              borderRadius: 9999, background: '#F9FAFB',
            }}>
              ⌘↵ para guardar
            </span>
            <button
              onClick={handleSubmit}
              disabled={!canSubmit}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                height: 40, padding: '0 18px',
                fontSize: 13, fontWeight: 600, fontFamily: 'Inter, sans-serif',
                background: canSubmit ? '#E8180A' : '#D1D5DB',
                color: '#fff',
                border: 'none', borderRadius: 10,
                cursor: canSubmit ? 'pointer' : 'not-allowed',
                transition: 'background 0.15s',
              }}
            >
              {submitting ? (
                <><Spinner /> Guardando…</>
              ) : (
                <><CheckCircle size={16} strokeWidth={2} /> Dar de Alta</>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Toast */}
      {toastOpen && (
        <div style={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 200,
          display: 'flex', alignItems: 'center', gap: 12,
          background: '#059669', color: '#fff',
          padding: '12px 16px', borderRadius: 10,
          boxShadow: '0 4px 20px rgba(0,0,0,0.15)', fontSize: 14, fontWeight: 500,
          animation: 'rd-fadeInUp 0.25s ease',
          maxWidth: 420, fontFamily: 'Inter, sans-serif',
        }}>
          <CheckCircle size={18} />
          <span style={{ flex: 1 }}>Ticket #{factura.talonario ?? factura.factura} dado de alta</span>
          <button onClick={() => setToastOpen(false)} style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.85)', cursor: 'pointer', padding: 2 }}>
            <X size={16} />
          </button>
          <style>{`@keyframes rd-fadeInUp { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }`}</style>
        </div>
      )}

      {submitError && (
        <div style={{
          margin: '20px 40px 0',
          background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 10,
          padding: '12px 16px', fontSize: 13, color: '#B91C1C',
          display: 'flex', alignItems: 'center', gap: 10, fontFamily: 'Inter, sans-serif',
        }}>
          <AlertCircle size={16} strokeWidth={1.75} />
          {submitError}
        </div>
      )}

      {/* ── Two columns ── */}
      <div style={{
        flex: 1, display: 'grid',
        gridTemplateColumns: 'minmax(360px, 40%) 1fr',
        overflow: 'hidden',
      }}>
        {/* Left — Alegra context */}
        <div style={{
          background: '#F5F7FA',
          borderRight: '1px solid #E5E7EB',
          overflowY: 'auto',
          padding: '32px',
        }}>
          <SectionHeader title="Información de la factura" subtitle="Solo lectura · proviene de Alegra" />

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <SectionCard>
              <SectionLabel>Orden</SectionLabel>
              <div style={{ display: 'grid', gap: 14 }}>
                <DataRow label="Talonario" value={factura.talonario ? `#${factura.talonario}` : '—'} bold />
                <DataRow label="Factura" value={factura.factura} />
                <DataRow label="Creada" value={formatDateFull(factura.fecha)} />

              </div>
            </SectionCard>

            <SectionCard>
              <SectionLabel>Cliente</SectionLabel>
              <div style={{ display: 'grid', gap: 14 }}>
                <DataRow label="Nombre" value={factura.cliente ?? '—'} bold />
                <DataRow label="Balance" value={formatMoney(factura.saldo)} danger={factura.saldo > 0} />
                <DataRow label="Total" value={formatMoney(factura.total)} />
              </div>
            </SectionCard>

            <SectionCard>
              <SectionLabel>Vehículo</SectionLabel>
              <div style={{ display: 'grid', gap: 14 }}>
                <DataRow label="Modelo" value={factura.vehiculo ?? '—'} bold />
                <DataRow label="Estado" value={factura.estado_cxc} tone={estadoTone(factura.estado_cxc)} />
              </div>
            </SectionCard>

            <ProductosSection items={items} loading={loadingItems} error={errorItems} numItems={factura.num_items} />
            <ObservacionesSection text={factura.observaciones} />
          </div>
        </div>

        {/* Right — Production form */}
        <div style={{
          background: 'white',
          overflowY: 'auto',
          padding: '32px 40px',
        }}>
          <div style={{ maxWidth: 720 }}>
            <SectionHeader title="Información de producción" subtitle="Completa únicamente lo que Alegra no provee." />

            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              {/* Asignación */}
              <SectionCard>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                  <div>
                    <Label>
                      <User size={11} style={{ display: 'inline', marginRight: 6, verticalAlign: 'middle' }} />
                      Responsable<span style={{ color: '#E8180A' }}>*</span>
                    </Label>
                    <Input
                      value={aCargoDe}
                      onChange={e => setACargoDe(e.target.value)}
                      placeholder="Nombre del responsable o mesa"
                    />
                  </div>

                  <div>
                    <Label>Tipo de trabajo</Label>
                    <SegmentedControl
                      options={['Fabricación', 'Reparación', 'Modificación'] as const}
                      selected={tipoTrabajo}
                      onSelect={v => setTipoTrabajo(v)}
                    />
                  </div>

                  {tipoTrabajo === 'Reparación' && (
                    <div>
                      <Label>Grado de reparación</Label>
                      <SegmentedControl
                        options={['Grado A', 'Grado B', 'Grado C']}
                        selected={gradoReparacion}
                        onSelect={v => setGradoReparacion(v)}
                      />
                    </div>
                  )}
                </div>
              </SectionCard>

              {/* Piezas */}
              <SectionCard>
                <Label style={{ marginBottom: 16, display: 'flex', alignItems: 'center' }}>
                  <Package size={11} style={{ marginRight: 6 }} />
                  Piezas a producir<span style={{ color: '#E8180A' }}>*</span>
                </Label>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 8 }}>
                  {PIEZAS_OPTIONS.map(p => {
                    const sel = piezas.includes(p)
                    return (
                      <button
                        key={p}
                        type="button"
                        onClick={() => {
                          if (sel) setPiezas(piezas.filter(x => x !== p))
                          else setPiezas([...piezas, p])
                        }}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 8,
                          padding: '10px 14px',
                          background: sel ? 'rgba(232,24,10,0.06)' : '#F9FAFB',
                          border: '1px solid ' + (sel ? '#E8180A' : '#E5E7EB'),
                          borderRadius: 8,
                          color: sel ? '#E8180A' : '#374151',
                          fontWeight: sel ? 600 : 500,
                          fontSize: 13, fontFamily: 'Inter, sans-serif',
                          cursor: 'pointer', textAlign: 'left',
                          transition: 'all 0.12s',
                        }}
                      >
                        <div style={{
                          width: 18, height: 18, borderRadius: 4,
                          background: sel ? '#E8180A' : '#E5E7EB',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          flexShrink: 0, transition: 'all 0.12s',
                        }}>
                          {sel && <span style={{ color: '#fff', fontSize: 10, lineHeight: 1 }}>✓</span>}
                        </div>
                        {p}
                      </button>
                    )
                  })}
                </div>

                {piezas.length > 0 && (
                  <div style={{ marginTop: 14, fontSize: 12.5, color: '#6B7280', fontWeight: 500 }}>
                    {piezas.length} pieza{piezas.length !== 1 ? 's' : ''} seleccionada{piezas.length !== 1 ? 's' : ''}
                  </div>
                )}

                <div style={{ marginTop: 20 }}>
                  <Label>Otras piezas (si no están en la lista)</Label>
                  <Input
                    value={piezasCustom}
                    onChange={e => setPiezasCustom(e.target.value)}
                    placeholder="Ej: Soporte lateral, refuerzo central"
                  />
                </div>
              </SectionCard>

              {/* Fechas */}
              <SectionCard>
                <Label style={{ marginBottom: 16, display: 'flex', alignItems: 'center' }}>
                  <Calendar size={11} style={{ marginRight: 6 }} />
                  Fechas
                </Label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
                  <div>
                    <Label style={{ fontSize: 11, color: '#6B7280' }}>Fecha compromiso</Label>
                    <Input type="date" value={fechaCompromiso} onChange={e => setFechaCompromiso(e.target.value)} />
                  </div>
                  <div>
                    <Label style={{ fontSize: 11, color: '#6B7280' }}>Fecha entrega</Label>
                    <Input type="date" value={fechaEntrega} onChange={e => setFechaEntrega(e.target.value)} />
                  </div>
                </div>
              </SectionCard>

              {/* Notas */}
              {!showNotas ? (
                <button
                  type="button"
                  onClick={() => setShowNotas(true)}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    alignSelf: 'flex-start',
                    background: 'transparent', border: 'none',
                    color: '#6B7280', fontSize: 13, fontWeight: 500,
                    fontFamily: 'Inter, sans-serif', padding: '4px 0', cursor: 'pointer',
                  }}
                  onMouseEnter={e => e.currentTarget.style.color = '#111827'}
                  onMouseLeave={e => e.currentTarget.style.color = '#6B7280'}
                >
                  <Plus size={14} strokeWidth={2} /> Añadir notas de producción
                </button>
              ) : (
                <SectionCard>
                  <Label>Notas de producción</Label>
                  <textarea
                    value={notas}
                    onChange={e => setNotas(e.target.value)}
                    placeholder="Escribe algo…"
                    rows={3}
                    style={{
                      width: '100%', minHeight: 88, padding: '10px 14px',
                      fontSize: 13, fontFamily: 'Inter, sans-serif', color: '#111827',
                      background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: 8,
                      outline: 'none', resize: 'vertical',
                    }}
                    onFocus={e => { e.currentTarget.style.borderColor = '#E8180A'; e.currentTarget.style.background = 'white' }}
                    onBlur={e => { e.currentTarget.style.borderColor = '#E5E7EB'; e.currentTarget.style.background = '#F9FAFB' }}
                  />
                </SectionCard>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <h2 style={{ fontSize: 15, fontWeight: 700, color: '#111827', margin: 0, letterSpacing: '-0.015em', fontFamily: 'Inter, sans-serif' }}>
        {title}
      </h2>
      {subtitle && <p style={{ fontSize: 12.5, color: '#6B7280', marginTop: 4, lineHeight: 1.5 }}>{subtitle}</p>}
    </div>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: 10.5, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.06em',
      fontWeight: 600, marginBottom: 12, fontFamily: 'Inter, sans-serif',
    }}>
      {children}
    </div>
  )
}

function SectionCard({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      background: 'white', border: '1px solid #E5E7EB', borderRadius: 12,
      padding: 24, boxShadow: '0 1px 2px rgba(15,23,42,0.04)',
    }}>
      {children}
    </div>
  )
}

function DataRow({ label, value, bold, danger, tone }: {
  label: string; value: React.ReactNode; bold?: boolean; danger?: boolean; tone?: string
}) {
  const valueColor =
    danger || tone === 'danger' ? '#E8180A' :
    tone === 'warning' ? '#B45309' :
    tone === 'info' ? '#2563EB' :
    tone === 'success' ? '#059669' : '#111827'
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
      <span style={{ fontSize: 11, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600, flexShrink: 0 }}>
        {label}
      </span>
      <span style={{
        fontSize: bold ? 14.5 : 13.5, fontWeight: bold ? 700 : 500,
        color: valueColor, textAlign: 'right', wordBreak: 'break-word',
        fontFamily: 'Inter, sans-serif',
      }}>
        {value}
      </span>
    </div>
  )
}

function ProductosSection({ items, loading, error, numItems }: {
  items: FacturaItem[]; loading: boolean; error: string; numItems: number
}) {
  const [open, setOpen] = useState(true)
  return (
    <SectionCard>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <SectionLabel>Productos</SectionLabel>
        <span style={{ fontSize: 11, color: '#6B7280', background: '#F3F4F6', padding: '2px 8px', borderRadius: 9999, fontWeight: 600 }}>
          {numItems}
        </span>
      </div>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 6,
          background: 'transparent', border: 'none', padding: 0,
          marginBottom: open ? 8 : 0,
          color: '#6B7280', fontSize: 12, fontWeight: 500, cursor: 'pointer',
          fontFamily: 'Inter, sans-serif',
        }}
      >
        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        {open ? 'Ocultar' : 'Ver'} detalle
      </button>
      {open && (
        loading ? (
          <div style={{ padding: '12px 0', fontSize: 12.5, color: '#6B7280' }}>Cargando…</div>
        ) : error ? (
          <div style={{ fontSize: 12.5, color: '#E8180A' }}>{error}</div>
        ) : items.length === 0 ? (
          <div style={{ fontSize: 12.5, color: '#6B7280' }}>Sin productos</div>
        ) : (
          <div>
            {items.map((it, i) => (
              <div key={i} style={{
                display: 'flex', justifyContent: 'space-between', gap: 12,
                padding: '12px 0', borderTop: i === 0 ? 'none' : '1px solid #F1F3F5',
              }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 13.5, color: '#111827', fontWeight: 500 }}>{it.nombre ?? '—'}</div>
                  {it.descripcion && (
                    <div style={{ fontSize: 12, color: '#6B7280', marginTop: 3, lineHeight: 1.4 }}>{it.descripcion}</div>
                  )}
                </div>
                <div style={{ flexShrink: 0, fontSize: 12.5, color: '#6B7280', fontWeight: 500, alignSelf: 'center' }}>
                  ×{it.cantidad}
                </div>
              </div>
            ))}
          </div>
        )
      )}
    </SectionCard>
  )
}

function ObservacionesSection({ text }: { text: string | null }) {
  const [open, setOpen] = useState(false)
  return (
    <SectionCard>
      <SectionLabel>Observaciones</SectionLabel>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 6,
          background: 'transparent', border: 'none', padding: 0,
          color: '#6B7280', fontSize: 12, fontWeight: 500, cursor: 'pointer',
          fontFamily: 'Inter, sans-serif',
        }}
      >
        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        {open ? 'Ocultar' : 'Ver'} observaciones
        {text && <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#E8180A', marginLeft: 'auto' }} />}
      </button>
      {open && (
        <div style={{ marginTop: 12 }}>
          {text ? (
            <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.6, whiteSpace: 'pre-wrap' as const }}>
              {text}
            </div>
          ) : (
            <div style={{ fontSize: 12.5, color: '#6B7280' }}>Sin observaciones</div>
          )}
        </div>
      )}
    </SectionCard>
  )
}

function SegmentedControl<T extends string>({ options, selected, onSelect }: {
  options: readonly T[] | T[]
  selected: T
  onSelect: (v: T) => void
}) {
  return (
    <div style={{
      display: 'flex', background: '#F3F4F6', borderRadius: 8, padding: 3, gap: 2,
    }}>
      {options.map(t => (
        <button
          key={t}
          type="button"
          onClick={() => onSelect(t)}
          style={{
            flex: 1, padding: '7px 14px',
            background: selected === t ? 'white' : 'transparent',
            color: selected === t ? '#111827' : '#6B7280',
            border: 'none', borderRadius: 6,
            fontSize: 13, fontWeight: selected ? 600 : 500,
            fontFamily: 'Inter, sans-serif',
            cursor: 'pointer',
            boxShadow: selected === t ? '0 1px 2px rgba(15,23,42,0.06)' : 'none',
            transition: 'all 0.12s',
          }}
        >
          {t}
        </button>
      ))}
    </div>
  )
}

function Label({ children, style: s }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <label style={{
      fontSize: 12, color: '#374151', fontWeight: 600, fontFamily: 'Inter, sans-serif',
      marginBottom: 8, display: 'block', ...s,
    }}>
      {children}
    </label>
  )
}

function Input({ value, onChange, placeholder, type = 'text', style: s }: {
  value: string; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  placeholder?: string; type?: string; style?: React.CSSProperties
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      style={{
        width: '100%', height: 40, padding: '0 14px',
        fontSize: 13, fontFamily: 'Inter, sans-serif', color: '#111827',
        background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: 8,
        outline: 'none', transition: 'border-color 0.15s, background 0.15s',
        ...s,
      }}
      onFocus={e => { e.currentTarget.style.borderColor = '#E8180A'; e.currentTarget.style.background = 'white' }}
      onBlur={e => { e.currentTarget.style.borderColor = '#E5E7EB'; e.currentTarget.style.background = '#F9FAFB' }}
    />
  )
}

function Spinner() {
  return (
    <div style={{
      width: 14, height: 14,
      border: '2px solid rgba(255,255,255,0.4)',
      borderTopColor: '#fff',
      borderRadius: '50%',
      animation: 'rd-spin 0.7s linear infinite',
    }} />
  )
}

function estadoTone(estado: string): string {
  if (estado === 'Atraso') return 'danger'
  if (estado === 'Cerrado') return 'success'
  return 'info'
}

function formatDateFull(iso: string): string {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('es-DO', { day: '2-digit', month: 'short', year: 'numeric' })
}

function formatMoney(n: number): string {
  return 'RD$ ' + n.toLocaleString('es-DO', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
}
