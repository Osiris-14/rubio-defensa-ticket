'use client'
import { useEffect, useState, useMemo, useCallback } from 'react'
import {
  Gauge, AlertTriangle, CheckCircle, Users, Edit2, Save, X, AlertCircle,
} from 'lucide-react'
import {
  fetchPuestosCapacidad,
  fetchMovimientos,
  updatePuestoLimiteDiario,
  type PuestoCapacidad,
  type OrdenMovimiento,
} from '@/lib/production-v2'
import { fetchEventosArmador } from '@/lib/ordenes'
import { type EventoArmador } from '@/lib/ordenes-core'
import { Toast } from '@/components/ui'

interface Props {
  user: { id: string; name: string; role: string }
}

// Color map matching calendar string values
const PUESTO_COLORS: Record<string, string> = {
  'PUESTO 2 ARMADOR':          '#1D4ED8',
  'EVENNOT  PUESTO 4  5PM-9PM': '#C2410C',
  'PUESTO 4 DE 8AM 4PM':       '#15803D',
  'puesto 5 oscar':            '#7C3AED',
}

function puestoColor (puesto: string) {
  return PUESTO_COLORS[puesto] ?? '#6B7280'
}

function todayISO () {
  return new Date().toISOString().slice(0, 10)
}

export default function DashboardCapacidadView ({ user }: Props) {
  const isAdmin = user.role === 'admin'

  const [puestos, setPuestos] = useState<PuestoCapacidad[]>([])
  const [eventos, setEventos] = useState<EventoArmador[]>([])
  const [movimientos, setMovimientos] = useState<OrdenMovimiento[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editingLimite, setEditingLimite] = useState<Record<string, string>>({})
  const [savingPuesto, setSavingPuesto] = useState<string | null>(null)
  const [toast, setToast] = useState<{ open: boolean; msg: string; tone: 'success' | 'error' }>({ open: false, msg: '', tone: 'success' })
  const [reloadKey, setReloadKey] = useState(0)
  const [now, setNow] = useState(() => Date.now())

  const loadData = useCallback(async () => {
    try {
      const [p, ev, movs] = await Promise.all([
        fetchPuestosCapacidad(),
        fetchEventosArmador(),
        fetchMovimientos(500),
      ])
      setPuestos(p)
      setEventos(ev)
      setMovimientos(movs)
      setError('')
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }, [])

  useEffect(() => {
    let active = true
    void (async () => {
      try {
        await loadData()
        if (active) setLoading(false)
      } catch {
        if (active) setLoading(false)
      }
    })()
    return () => { active = false }
  }, [loadData, reloadKey])

  // Ticking clock for "+2d sin confirmar" counts
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000)
    return () => clearInterval(id)
  }, [])

  // Compute today's load per puesto from CSV events
  const today = todayISO()
  const loadByPuesto = useMemo(() => {
    const map = new Map<string, Set<string>>() // puesto → unique orders today
    for (const ev of eventos) {
      if (!ev.inicio.startsWith(today)) continue
      if (!ev.orden) continue
      const set = map.get(ev.calendario) ?? new Set()
      set.add(ev.orden)
      map.set(ev.calendario, set)
    }
    return map
  }, [eventos, today])

  // "Sin confirmar +2d" — stagnated orders
  const sinConfirmar = useMemo(() => {
    const latestByOrden = new Map<string, OrdenMovimiento>()
    for (const m of movimientos) {
      const cur = latestByOrden.get(m.numero_orden)
      if (!cur || m.ocurrido_en > cur.ocurrido_en) latestByOrden.set(m.numero_orden, m)
    }
    return [...latestByOrden.values()].filter(m => {
      if (m.tipo === 'SALIDA') return false
      const dias = Math.floor((now - new Date(m.ocurrido_en).getTime()) / 86400000)
      return dias >= 2
    }).length
  }, [movimientos, now])

  // Top KPIs
  const ordenesHoy = useMemo(() => {
    const all = new Set<string>()
    for (const set of loadByPuesto.values()) for (const o of set) all.add(o)
    return all.size
  }, [loadByPuesto])

  const puestosActivos = puestos.filter(p => p.activo).length

  const sobrecargados = useMemo(() => puestos.filter(p => {
    if (p.limite_diario === null) return false
    const load = loadByPuesto.get(p.puesto)?.size ?? 0
    return load > p.limite_diario
  }).length, [puestos, loadByPuesto])

  // Per-puesto row data
  const puestoRows = useMemo(() => puestos.map(p => {
    const load = loadByPuesto.get(p.puesto)?.size ?? 0
    const lim = p.limite_diario
    let pct = 0
    let tone: 'gray' | 'green' | 'amber' | 'red' = 'gray'
    if (lim !== null && lim > 0) {
      pct = Math.min(100, Math.round((load / lim) * 100))
      tone = load > lim ? 'red' : pct >= 70 ? 'amber' : 'green'
    }
    return { ...p, load, pct, tone }
  }), [puestos, loadByPuesto])

  const overloadedPuestos = puestoRows.filter(r => r.tone === 'red')

  function startEdit (puesto: string, current: number | null) {
    setEditingLimite(prev => ({ ...prev, [puesto]: current !== null ? String(current) : '' }))
  }

  function cancelEdit (puesto: string) {
    setEditingLimite(prev => { const n = { ...prev }; delete n[puesto]; return n })
  }

  async function saveLimit (puesto: string) {
    const val = editingLimite[puesto]
    const num = val === '' || val === null ? null : parseInt(val, 10)
    if (num !== null && (isNaN(num) || num < 1)) {
      setToast({ open: true, msg: 'El límite debe ser un número mayor a 0', tone: 'error' })
      return
    }
    setSavingPuesto(puesto)
    try {
      await updatePuestoLimiteDiario(puesto, num)
      setToast({ open: true, msg: `Límite de ${puesto} actualizado`, tone: 'success' })
      cancelEdit(puesto)
      setReloadKey(k => k + 1)
    } catch (e) {
      setToast({ open: true, msg: (e as Error).message, tone: 'error' })
    } finally {
      setSavingPuesto(null)
    }
  }

  const toneColor = {
    gray:  { bar: 'var(--gray-300)', badge: 'var(--gray-600)', badgeBg: 'var(--gray-100)', badgeBorder: 'var(--border)' },
    green: { bar: 'var(--green)',    badge: 'var(--green)',     badgeBg: 'var(--green-bg)', badgeBorder: 'var(--green-ring)' },
    amber: { bar: 'var(--amber)',    badge: 'var(--amber)',     badgeBg: 'var(--amber-bg)', badgeBorder: 'var(--amber-ring)' },
    red:   { bar: 'var(--red)',      badge: 'var(--red)',       badgeBg: 'var(--red-50)',   badgeBorder: 'var(--red-ring)' },
  }

  return (
    <div style={{ animation: 'fadeInUp 0.3s ease', padding: '40px 48px 80px' }}>
      <div className='eyebrow' style={{ color: 'var(--red)', marginBottom: 8 }}>Planificación</div>
      <h1 style={{ fontSize: 28, fontWeight: 700, color: 'var(--gray-900)', letterSpacing: '-0.025em', margin: 0 }}>
        Capacidad por Puesto
      </h1>
      <p style={{ fontSize: 14, color: 'var(--gray-500)', marginTop: 8, lineHeight: 1.5, maxWidth: 600 }}>
        Carga actual vs límite diario por puesto. El dueño configura los límites — aparecen en gris hasta que se definen.
      </p>

      {error && (
        <div style={{
          background: 'var(--red-50)', border: '1px solid var(--red-ring)',
          borderRadius: 'var(--radius-lg)', padding: '12px 16px', marginTop: 16, marginBottom: 0,
          fontSize: 13.5, color: 'var(--red)', display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <AlertCircle size={15} /> {error}
        </div>
      )}

      {/* Top KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 14, marginTop: 24, marginBottom: 32 }}>
        <KpiCard label='Órdenes hoy' value={loading ? '—' : String(ordenesHoy)} icon={Gauge} tone='blue' />
        <KpiCard label='Puestos activos' value={loading ? '—' : String(puestosActivos)} icon={Users} tone='green' />
        <KpiCard label='Sobrecargados' value={loading ? '—' : String(sobrecargados)} icon={AlertTriangle} tone={sobrecargados > 0 ? 'red' : 'green'} />
        <KpiCard label='Sin confirmar +2d' value={loading ? '—' : String(sinConfirmar)} icon={CheckCircle} tone={sinConfirmar > 0 ? 'amber' : 'green'} />
      </div>

      {/* Per-puesto rows */}
      <h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--gray-700)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 14 }}>
        Carga por puesto — hoy
      </h2>

      <div className='card' style={{ padding: 0, overflow: 'hidden', marginBottom: 24 }}>
        {loading ? (
          <div style={{ padding: '48px', textAlign: 'center', color: 'var(--gray-400)', fontSize: 13 }}>Cargando…</div>
        ) : puestoRows.length === 0 ? (
          <div style={{ padding: '48px', textAlign: 'center', color: 'var(--gray-400)', fontSize: 13 }}>No hay puestos configurados.</div>
        ) : (
          puestoRows.map((row, idx) => {
            const colors = toneColor[row.tone]
            const isEditing = editingLimite[row.puesto] !== undefined
            const accentColor = puestoColor(row.puesto)
            return (
              <div
                key={row.id}
                style={{
                  padding: '18px 24px',
                  borderBottom: idx < puestoRows.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                  display: 'flex', alignItems: 'center', gap: 20,
                  flexWrap: 'wrap',
                }}
              >
                {/* Color dot + name */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 220, flex: 1 }}>
                  <div style={{
                    width: 10, height: 10, borderRadius: '50%',
                    background: accentColor, flexShrink: 0,
                    boxShadow: `0 0 0 3px ${accentColor}22`,
                  }} />
                  <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--gray-900)' }}>{row.puesto}</span>
                </div>

                {/* Load badge */}
                <div style={{ flexShrink: 0 }}>
                  {row.tone === 'gray' ? (
                    <span style={{
                      fontSize: 11.5, fontWeight: 600, padding: '3px 10px', borderRadius: 9999,
                      background: 'var(--gray-100)', color: 'var(--gray-500)', border: '1px solid var(--border)',
                    }}>
                      {row.load} ords · Sin límite
                    </span>
                  ) : (
                    <span style={{
                      fontSize: 11.5, fontWeight: 700, padding: '3px 10px', borderRadius: 9999,
                      background: colors.badgeBg, color: colors.badge, border: `1px solid ${colors.badgeBorder}`,
                    }}>
                      {row.load} / {row.pct}%
                    </span>
                  )}
                </div>

                {/* Progress bar */}
                <div style={{ flex: 2, minWidth: 100 }}>
                  {row.tone === 'gray' ? (
                    <div style={{ fontSize: 11, color: 'var(--gray-400)', fontStyle: 'italic' }}>Sin límite definido</div>
                  ) : (
                    <div style={{ width: '100%', height: 8, borderRadius: 4, background: 'var(--gray-100)', overflow: 'hidden' }}>
                      <div style={{
                        width: `${Math.min(100, row.pct)}%`, height: '100%',
                        background: colors.bar, transition: 'width 0.4s ease',
                        borderRadius: 4,
                      }} />
                    </div>
                  )}
                </div>

                {/* Limit display / edit (admin only) */}
                {isAdmin && (
                  isEditing ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                      <input
                        type='number'
                        min={1}
                        value={editingLimite[row.puesto]}
                        onChange={e => setEditingLimite(prev => ({ ...prev, [row.puesto]: e.target.value }))}
                        placeholder='Límite'
                        className='input-base'
                        style={{ height: 30, width: 80, fontSize: 12 }}
                        onKeyDown={e => { if (e.key === 'Enter') saveLimit(row.puesto); if (e.key === 'Escape') cancelEdit(row.puesto) }}
                        autoFocus
                      />
                      <button
                        onClick={() => saveLimit(row.puesto)}
                        disabled={savingPuesto === row.puesto}
                        className='btn btn-primary btn-sm'
                        style={{ height: 30, padding: '0 10px' }}
                      >
                        <Save size={11} />
                      </button>
                      <button
                        onClick={() => cancelEdit(row.puesto)}
                        className='btn btn-secondary btn-sm'
                        style={{ height: 30, padding: '0 8px' }}
                      >
                        <X size={11} />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => startEdit(row.puesto, row.limite_diario)}
                      className='btn btn-ghost btn-sm'
                      style={{ height: 30, flexShrink: 0, fontSize: 11.5 }}
                      title='Editar límite'
                    >
                      <Edit2 size={11} />
                      {row.limite_diario !== null ? `Límite: ${row.limite_diario}` : 'Definir límite'}
                    </button>
                  )
                )}
              </div>
            )
          })
        )}
      </div>

      {/* Bottom alert */}
      {overloadedPuestos.length > 0 && (
        <div style={{
          background: 'var(--red-50)', border: '1px solid var(--red-ring)',
          borderRadius: 'var(--radius-lg)', padding: '16px 20px',
          display: 'flex', alignItems: 'flex-start', gap: 12,
        }}>
          <AlertTriangle size={18} style={{ color: 'var(--red)', flexShrink: 0, marginTop: 1 }} />
          <div>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--red)', marginBottom: 4 }}>
              {overloadedPuestos.length} puesto{overloadedPuestos.length > 1 ? 's' : ''} sobre capacidad hoy
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--gray-700)', lineHeight: 1.5 }}>
              <strong>{overloadedPuestos.map(p => p.puesto).join(', ')}</strong> superaron el límite diario.
              Considera redistribuir órdenes entre puestos con capacidad disponible.
            </div>
          </div>
        </div>
      )}

      {!isAdmin && puestos.length > 0 && (
        <div style={{ marginTop: 16, fontSize: 12, color: 'var(--gray-400)', textAlign: 'center' }}>
          Solo el administrador puede editar los límites de capacidad.
        </div>
      )}

      <Toast open={toast.open} tone={toast.tone} message={toast.msg} onClose={() => setToast(t => ({ ...t, open: false }))} />
    </div>
  )
}

function KpiCard ({ label, value, icon: Icon, tone = 'green' }: {
  label: string
  value: string
  icon: React.ComponentType<{ size?: number; style?: React.CSSProperties }>
  tone?: 'red' | 'amber' | 'green' | 'blue'
}) {
  const toneColor = { red: 'var(--red)', amber: 'var(--amber)', green: 'var(--green)', blue: 'var(--blue)' }[tone]
  return (
    <div className='kpi' style={{ borderTop: `2px solid ${toneColor}` }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ fontSize: 11, color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>{label}</div>
        <div style={{ width: 30, height: 30, borderRadius: 'var(--radius)', background: 'var(--gray-50)', color: 'var(--gray-500)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon size={13} />
        </div>
      </div>
      <div style={{ fontSize: 26, fontWeight: 700, color: 'var(--gray-900)', lineHeight: 1, letterSpacing: '-0.02em' }}>{value}</div>
    </div>
  )
}
