'use client'
import { useState, useEffect, useCallback } from 'react'
import { ArrowLeft, CheckCircle, ChevronRight, User, Package, ChevronDown, ChevronRight as ChevronRightSmall, Plus, AlertCircle } from 'lucide-react'
import {
  type FacturaProduccion,
  type FacturaItem,
  fetchItems,
  darDeAlta,
} from '@/lib/produccion'
import { PIEZAS_OPTIONS } from '@/lib/store'
import { Toast } from '@/components/ui'

interface Props {
  factura: FacturaProduccion
  user: { id: string; name: string }
  onBack: () => void
  onAlta: () => void
}

export default function TicketDetail({ factura, user, onBack, onAlta }: Props) {
  const [items, setItems] = useState<FacturaItem[]>([])
  const [loadingItems, setLoadingItems] = useState(true)
  const [errorItems, setErrorItems] = useState('')

  // Form state — only fields Producción fills
  const [aCargoDe, setACargoDe] = useState('')
  const [tipoTrabajo, setTipoTrabajo] = useState<'Fabricación' | 'Reparación' | 'Modificación'>('Fabricación')
  const [gradoReparacion, setGradoReparacion] = useState('')
  const [piezas, setPiezas] = useState<string[]>([])
  const [piezasCustom, setPiezasCustom] = useState('')
  const [fechaCompromiso, setFechaCompromiso] = useState('')
  const [fechaEntrega, setFechaEntrega] = useState('')
  const [notas, setNotas] = useState('')
  const [showNotas, setShowNotas] = useState(false)

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
      setTimeout(() => {
        onAlta()
      }, 1100)
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
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, animation: 'fadeInUp 0.25s ease' }}>
      {/* ── Header: breadcrumb + page title + action ── */}
      <div className="workspace-header" style={{
        padding: '24px 48px',
        flexShrink: 0,
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          fontSize: 12, color: 'var(--gray-500)', fontWeight: 500, marginBottom: 16,
        }}>
          <button
            onClick={onBack}
            style={{
              background: 'transparent', border: 'none', padding: 0, cursor: 'pointer',
              color: 'var(--gray-500)', display: 'inline-flex', alignItems: 'center', gap: 4,
              fontSize: 12, fontWeight: 500,
            }}
            onMouseEnter={e => e.currentTarget.style.color = 'var(--gray-900)'}
            onMouseLeave={e => e.currentTarget.style.color = 'var(--gray-500)'}
          >
            <ArrowLeft size={12} strokeWidth={2} />
            Producción
          </button>
          <ChevronRight size={12} strokeWidth={2} style={{ color: 'var(--gray-400)' }} />
          <span style={{ color: 'var(--gray-700)', fontWeight: 600 }}>
            Ticket #{factura.talonario ?? '—'}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 24, flexWrap: 'wrap' as const }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <h1 style={{
              fontSize: 30, fontWeight: 700, color: 'var(--gray-900)',
              letterSpacing: '-0.03em', lineHeight: 1.1, margin: 0,
            }}>
              {factura.vehiculo ?? 'Ticket de producción'}
            </h1>
            <p style={{ fontSize: 14, color: 'var(--gray-500)', marginTop: 8, lineHeight: 1.5 }}>
              Factura {factura.factura} · {factura.cliente ?? 'Cliente —'}
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingTop: 4 }}>
            <span style={{
              fontSize: 11, color: 'var(--gray-500)', fontWeight: 500,
              padding: '4px 10px', border: '1px solid var(--border)',
              borderRadius: 9999, background: 'var(--bg-card)',
            }}>
              ⌘↵ para guardar
            </span>
            <button
              onClick={handleSubmit}
              disabled={!canSubmit}
              className="btn btn-primary btn-lg"
            >
              {submitting ? (
                <>
                  <Spinner light /> Guardando…
                </>
              ) : (
                <>
                  <CheckCircle size={16} strokeWidth={2} />
                  Dar de Alta
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      <Toast
        open={toastOpen}
        tone="success"
        message={`Ticket #${factura.talonario ?? factura.factura} dado de alta`}
        onClose={() => setToastOpen(false)}
        durationMs={1100}
      />

      {submitError && (
        <div style={{
          margin: '20px 48px 0',
          background: 'var(--red-50)',
          border: '1px solid var(--red-ring)',
          borderRadius: 'var(--radius-lg)',
          padding: '12px 16px',
          fontSize: 13.5,
          color: 'var(--red)',
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <AlertCircle size={16} strokeWidth={1.75} />
          {submitError}
        </div>
      )}

      {/* ── Two blocks ── */}
      <div style={{
        flex: 1,
        display: 'grid',
        gridTemplateColumns: 'minmax(360px, 40%) 1fr',
        gap: 0,
        overflow: 'hidden',
      }}>
        {/* Bloque 1 — Alegra context (cards sobre workspace gris) */}
        <div style={{
          background: 'var(--bg-page)',
          borderRight: '1px solid var(--border)',
          overflowY: 'auto',
          padding: '32px 32px 80px',
        }}>
          <BloqueAlegra
            factura={factura}
            items={items}
            loadingItems={loadingItems}
            errorItems={errorItems}
          />
        </div>

        {/* Bloque 2 — Producción form (fondo blanco) */}
        <div style={{
          background: 'var(--bg-card)',
          overflowY: 'auto',
          padding: '32px 48px 80px',
        }}>
          <BloqueProduccion
            aCargoDe={aCargoDe}
            setACargoDe={setACargoDe}
            tipoTrabajo={tipoTrabajo}
            setTipoTrabajo={setTipoTrabajo}
            gradoReparacion={gradoReparacion}
            setGradoReparacion={setGradoReparacion}
            piezas={piezas}
            setPiezas={setPiezas}
            piezasCustom={piezasCustom}
            setPiezasCustom={setPiezasCustom}
            fechaCompromiso={fechaCompromiso}
            setFechaCompromiso={setFechaCompromiso}
            fechaEntrega={fechaEntrega}
            setFechaEntrega={setFechaEntrega}
            notas={notas}
            setNotas={setNotas}
            showNotas={showNotas}
            setShowNotas={setShowNotas}
          />
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────
// Bloque 1 — Alegra context
// ─────────────────────────────────────────────────────────

function BloqueAlegra({ factura, items, loadingItems, errorItems }: {
  factura: FacturaProduccion
  items: FacturaItem[]
  loadingItems: boolean
  errorItems: string
}) {
  return (
    <div>
      <SectionHeader title="Información de la factura" subtitle="Solo lectura · proviene de Alegra" />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Card: Orden */}
        <SectionCard padding="md">
          <SectionLabel>Orden</SectionLabel>
          <div style={{ display: 'grid', gap: 14 }}>
            <DataRow label="Talonario" value={factura.talonario ? `#${factura.talonario}` : '—'} bold />
            <DataRow label="Factura" value={factura.factura} />
            <DataRow label="Creada" value={formatDateFull(factura.fecha)} />

          </div>
        </SectionCard>

        {/* Card: Cliente */}
        <SectionCard padding="md">
          <SectionLabel>Cliente</SectionLabel>
          <div style={{ display: 'grid', gap: 14 }}>
            <DataRow label="Nombre" value={factura.cliente ?? '—'} bold />
            <DataRow label="Balance" value={formatMoney(factura.saldo)} danger={factura.saldo > 0} />
            <DataRow label="Total" value={formatMoney(factura.total)} />
          </div>
        </SectionCard>

        {/* Card: Vehículo */}
        <SectionCard padding="md">
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
  )
}

function ProductosSection({ items, loading, error, numItems }: {
  items: FacturaItem[]
  loading: boolean
  error: string
  numItems: number
}) {
  const [open, setOpen] = useState(true)
  return (
    <SectionCard
      padding="md"
      actions={
        <span style={{ fontSize: 11, color: 'var(--gray-500)', background: 'var(--gray-100)', padding: '2px 8px', borderRadius: 9999, fontWeight: 600 }}>
          {numItems}
        </span>
      }
    >
      <SectionLabel>Productos</SectionLabel>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 6,
          background: 'transparent', border: 'none', padding: 0,
          marginBottom: open ? 8 : 0,
          color: 'var(--gray-500)', fontSize: 12, fontWeight: 500, cursor: 'pointer',
        }}
      >
        {open ? <ChevronDown size={14} /> : <ChevronRightSmall size={14} />}
        {open ? 'Ocultar' : 'Ver'} detalle
      </button>
      {open && (
        loading ? (
          <div style={{ padding: '12px 0', fontSize: 12.5, color: 'var(--gray-500)' }}>Cargando…</div>
        ) : error ? (
          <div style={{ fontSize: 12.5, color: 'var(--red)' }}>{error}</div>
        ) : items.length === 0 ? (
          <div style={{ fontSize: 12.5, color: 'var(--gray-500)' }}>Sin productos</div>
        ) : (
          <div>
            {items.map((it, i) => (
              <div
                key={i}
                style={{
                  display: 'flex', justifyContent: 'space-between', gap: 12,
                  padding: '12px 0',
                  borderTop: i === 0 ? 'none' : '1px solid var(--border)',
                }}
              >
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 13.5, color: 'var(--gray-900)', fontWeight: 500 }}>{it.nombre ?? '—'}</div>
                  {it.descripcion && (
                    <div style={{ fontSize: 12, color: 'var(--gray-500)', marginTop: 3, lineHeight: 1.4 }}>{it.descripcion}</div>
                  )}
                </div>
                <div style={{ flexShrink: 0, fontSize: 12.5, color: 'var(--gray-500)', fontWeight: 500, alignSelf: 'center' }}>
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
    <SectionCard padding="md">
      <SectionLabel>Observaciones</SectionLabel>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 6,
          background: 'transparent', border: 'none', padding: 0,
          color: 'var(--gray-500)', fontSize: 12, fontWeight: 500, cursor: 'pointer',
        }}
      >
        {open ? <ChevronDown size={14} /> : <ChevronRightSmall size={14} />}
        {open ? 'Ocultar' : 'Ver'} observaciones
        {text && <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--red)', marginLeft: 'auto' }} />}
      </button>
      {open && (
        <div style={{ marginTop: 12 }}>
          {text ? (
            <div style={{ fontSize: 13, color: 'var(--gray-700)', lineHeight: 1.6, whiteSpace: 'pre-wrap' as const }}>
              {text}
            </div>
          ) : (
            <div style={{ fontSize: 12.5, color: 'var(--gray-500)' }}>Sin observaciones</div>
          )}
        </div>
      )}
    </SectionCard>
  )
}

// ─────────────────────────────────────────────────────────
// Bloque 2 — Producción form
// ─────────────────────────────────────────────────────────

function BloqueProduccion(props: {
  aCargoDe: string
  setACargoDe: (v: string) => void
  tipoTrabajo: 'Fabricación' | 'Reparación' | 'Modificación'
  setTipoTrabajo: (v: 'Fabricación' | 'Reparación' | 'Modificación') => void
  gradoReparacion: string
  setGradoReparacion: (v: string) => void
  piezas: string[]
  setPiezas: (v: string[]) => void
  piezasCustom: string
  setPiezasCustom: (v: string) => void
  fechaCompromiso: string
  setFechaCompromiso: (v: string) => void
  fechaEntrega: string
  setFechaEntrega: (v: string) => void
  notas: string
  setNotas: (v: string) => void
  showNotas: boolean
  setShowNotas: (v: boolean) => void
}) {
  const {
    aCargoDe, setACargoDe,
    tipoTrabajo, setTipoTrabajo,
    gradoReparacion, setGradoReparacion,
    piezas, setPiezas,
    piezasCustom, setPiezasCustom,
    fechaCompromiso, setFechaCompromiso,
    fechaEntrega, setFechaEntrega,
    notas, setNotas,
    showNotas, setShowNotas,
  } = props

  function togglePieza(p: string) {
    if (piezas.includes(p)) setPiezas(piezas.filter(x => x !== p))
    else setPiezas([...piezas, p])
  }

  return (
    <div style={{ maxWidth: 720 }}>
      <SectionHeader
        title="Información de producción"
        subtitle="Completa únicamente lo que Alegra no provee."
      />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        {/* Sección 1: Asignación */}
        <SectionCard padding="lg">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div>
              <label className="form-label">
                <User size={11} style={{ display: 'inline', marginRight: 6, verticalAlign: 'middle' }} />
                Responsable<span className="req">*</span>
              </label>
              <input
                type="text"
                className="input-base"
                value={aCargoDe}
                onChange={e => setACargoDe(e.target.value)}
                placeholder="Nombre del responsable o mesa"
              />
            </div>

            <div>
              <label className="form-label">Tipo de trabajo</label>
              <div className="segmented" style={{ width: '100%' }}>
                {(['Fabricación', 'Reparación', 'Modificación'] as const).map(t => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTipoTrabajo(t)}
                    className={`segmented-item ${tipoTrabajo === t ? 'active' : ''}`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {tipoTrabajo === 'Reparación' && (
              <div>
                <label className="form-label">Grado de reparación</label>
                <div className="segmented" style={{ width: '100%' }}>
                  {['Grado A', 'Grado B', 'Grado C'].map(g => (
                    <button
                      key={g}
                      type="button"
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
        </SectionCard>

        {/* Sección 2: Piezas */}
        <SectionCard padding="lg">
          <div className="form-label" style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
            <Package size={11} style={{ marginRight: 6 }} />
            Piezas a producir<span className="req">*</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 8 }}>
            {PIEZAS_OPTIONS.map(p => {
              const sel = piezas.includes(p)
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => togglePieza(p)}
                  className="radio-option"
                  style={{
                    background: sel ? 'var(--red-50)' : 'var(--bg-card)',
                    borderColor: sel ? 'var(--red)' : 'var(--border)',
                    color: sel ? 'var(--red)' : 'var(--gray-700)',
                    fontWeight: sel ? 600 : 500,
                    fontSize: 13,
                  }}
                >
                  <div className={`checkbox-custom ${sel ? 'checked' : ''}`}>
                    {sel && <span style={{ color: '#fff', fontSize: 10, lineHeight: 1 }}>✓</span>}
                  </div>
                  {p}
                </button>
              )
            })}
          </div>

          {piezas.length > 0 && (
            <div style={{ marginTop: 14, fontSize: 12.5, color: 'var(--gray-500)', fontWeight: 500 }}>
              {piezas.length} pieza{piezas.length !== 1 ? 's' : ''} seleccionada{piezas.length !== 1 ? 's' : ''}
            </div>
          )}

          <div style={{ marginTop: 20 }}>
            <label className="form-label">Otras piezas (si no están en la lista)</label>
            <input
              type="text"
              className="input-base"
              value={piezasCustom}
              onChange={e => setPiezasCustom(e.target.value)}
              placeholder="Ej: Soporte lateral, refuerzo central"
            />
          </div>
        </SectionCard>

        {/* Sección 3: Fechas */}
        <SectionCard padding="lg">
          <div className="form-label" style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
            <Calendar size={11} style={{ marginRight: 6 }} />
            Fechas
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
            <div>
              <label className="form-label" style={{ fontSize: 11, color: 'var(--gray-500)' }}>Fecha compromiso</label>
              <input
                type="date"
                className="input-base"
                value={fechaCompromiso}
                onChange={e => setFechaCompromiso(e.target.value)}
              />
            </div>
            <div>
              <label className="form-label" style={{ fontSize: 11, color: 'var(--gray-500)' }}>Fecha entrega</label>
              <input
                type="date"
                className="input-base"
                value={fechaEntrega}
                onChange={e => setFechaEntrega(e.target.value)}
              />
            </div>
          </div>
        </SectionCard>

        {/* Notas colapsable */}
        {!showNotas ? (
          <button
            type="button"
            onClick={() => setShowNotas(true)}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              alignSelf: 'flex-start',
              background: 'transparent', border: 'none',
              color: 'var(--gray-500)', fontSize: 13, fontWeight: 500,
              padding: '4px 0', cursor: 'pointer',
            }}
            onMouseEnter={e => e.currentTarget.style.color = 'var(--gray-900)'}
            onMouseLeave={e => e.currentTarget.style.color = 'var(--gray-500)'}
          >
            <Plus size={14} strokeWidth={2} /> Añadir notas de producción
          </button>
        ) : (
          <SectionCard padding="lg">
            <div>
              <label className="form-label">Notas de producción</label>
              <textarea
                className="input-base"
                value={notas}
                onChange={e => setNotas(e.target.value)}
                placeholder="Escribe algo…"
                rows={3}
                style={{ minHeight: 88 }}
              />
            </div>
          </SectionCard>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────
// Shared sub-components (locales)
// ─────────────────────────────────────────────────────────

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--gray-900)', margin: 0, letterSpacing: '-0.015em' }}>
        {title}
      </h2>
      {subtitle && <p style={{ fontSize: 12.5, color: 'var(--gray-500)', marginTop: 4, lineHeight: 1.5 }}>{subtitle}</p>}
    </div>
  )
}

function SectionCard({ padding = 'md', actions, children }: {
  padding?: 'sm' | 'md' | 'lg'
  actions?: React.ReactNode
  children: React.ReactNode
}) {
  const pad = padding === 'sm' ? 20 : padding === 'lg' ? 28 : 24
  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      {actions && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: `14px ${pad}px`, borderBottom: '1px solid var(--border)' }}>
          {actions}
        </div>
      )}
      <div style={{ padding: pad }}>{children}</div>
    </div>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="eyebrow" style={{ marginBottom: 12 }}>{children}</div>
  )
}

function DataRow({ label, value, bold, danger, tone }: {
  label: string
  value: React.ReactNode
  bold?: boolean
  danger?: boolean
  tone?: 'default' | 'success' | 'warning' | 'danger' | 'info'
}) {
  const valueColor =
    danger || tone === 'danger' ? 'var(--red)' :
    tone === 'warning' ? 'var(--amber)' :
    tone === 'info' ? 'var(--blue)' :
    tone === 'success' ? 'var(--green)' :
    'var(--gray-900)'
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
      <span style={{ fontSize: 11, color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600, flexShrink: 0 }}>
        {label}
      </span>
      <span style={{
        fontSize: bold ? 14.5 : 13.5,
        fontWeight: bold ? 700 : 500,
        color: valueColor,
        textAlign: 'right' as const,
        wordBreak: 'break-word' as const,
      }}>
        {value}
      </span>
    </div>
  )
}

function Calendar({ size, style, ...rest }: { size?: number; style?: React.CSSProperties; [k: string]: unknown }) {
  return (
    <svg
      width={size ?? 16} height={size ?? 16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={style} {...rest}
    >
      <rect width="18" height="18" x="3" y="4" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  )
}

function Spinner({ light = false }: { light?: boolean }) {
  return (
    <div style={{
      width: 14, height: 14,
      border: `2px solid ${light ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.2)'}`,
      borderTopColor: light ? '#fff' : 'currentColor',
      borderRadius: '50%',
      animation: 'spin 0.7s linear infinite',
    }} />
  )
}

function estadoTone(estado: string): 'default' | 'danger' | 'success' | 'warning' | 'info' {
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
