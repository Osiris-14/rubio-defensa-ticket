'use client'
import { useEffect, useState, useMemo, useCallback } from 'react'
import {
  Gauge, AlertTriangle, Users, Edit2, Save, X, AlertCircle, MinusCircle,
} from 'lucide-react'
import {
  fetchPuestosCapacidad,
  updatePuestoLimiteDiario,
  type PuestoCapacidad,
} from '@/lib/production-v2'
import { fetchEventosArmador } from '@/lib/ordenes'
import { type EventoArmador } from '@/lib/ordenes-core'
import { labelPuesto } from '@/lib/puestos'
import { Toast } from '@/components/ui'

interface Props {
  user: { id: string; name: string; role: string }
}

type Tone = 'gray' | 'green' | 'amber' | 'red'

const TONO: Record<Tone, { bar: string; text: string; bg: string; border: string }> = {
  gray:  { bar: '#DDDDDD', text: '#999999', bg: '#F7F7F7', border: '#ECECEC' },
  green: { bar: '#5FA83B', text: '#3B6D11', bg: '#EAF3DE', border: '#C4DFA0' },
  amber: { bar: '#D9A441', text: '#633806', bg: '#FAEEDA', border: '#F0D9A0' },
  red:   { bar: '#E8180A', text: '#E8180A', bg: '#FDECEA', border: '#F8CFCB' },
}

function todayISO () {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function DashboardCapacidadView ({ user }: Props) {
  const isAdmin = user.role === 'admin'

  const [puestos, setPuestos] = useState<PuestoCapacidad[]>([])
  const [eventos, setEventos] = useState<EventoArmador[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editingLimite, setEditingLimite] = useState<Record<string, string>>({})
  const [savingPuesto, setSavingPuesto] = useState<string | null>(null)
  const [toast, setToast] = useState<{ open: boolean; msg: string; tone: 'success' | 'error' }>({ open: false, msg: '', tone: 'success' })
  const [reloadKey, setReloadKey] = useState(0)

  const loadData = useCallback(async () => {
    try {
      const [p, ev] = await Promise.all([
        fetchPuestosCapacidad(),
        fetchEventosArmador(todayISO()),
      ])
      setPuestos(p)
      setEventos(ev)
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

  // Carga de hoy por puesto — órdenes únicas del calendario.
  const today = todayISO()
  const loadByPuesto = useMemo(() => {
    const map = new Map<string, Set<string>>()
    for (const ev of eventos) {
      if (!ev.inicio.startsWith(today)) continue
      if (!ev.orden) continue
      const set = map.get(ev.calendario) ?? new Set()
      set.add(ev.orden)
      map.set(ev.calendario, set)
    }
    return map
  }, [eventos, today])

  const activos = useMemo(() => puestos.filter(p => p.activo), [puestos])

  const puestoRows = useMemo(() => activos.map(p => {
    const load = loadByPuesto.get(p.puesto)?.size ?? 0
    const lim = p.limite_diario
    let pct = 0
    let tone: Tone = 'gray'
    if (lim !== null && lim > 0) {
      pct = Math.min(100, Math.round((load / lim) * 100))
      tone = load > lim ? 'red' : (load / lim) >= 0.7 ? 'amber' : 'green'
    }
    return { ...p, load, pct, tone, label: labelPuesto(p.puesto) }
  }), [activos, loadByPuesto])

  // ── KPIs
  const ordenesHoy = useMemo(() => {
    const all = new Set<string>()
    for (const set of loadByPuesto.values()) for (const o of set) all.add(o)
    return all.size
  }, [loadByPuesto])

  const sobrecargados = puestoRows.filter(r => r.tone === 'red')
  const sinLimite = puestoRows.filter(r => r.limite_diario === null).length

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
      setToast({ open: true, msg: `Límite de ${labelPuesto(puesto)} actualizado`, tone: 'success' })
      cancelEdit(puesto)
      setReloadKey(k => k + 1)
    } catch (e) {
      setToast({ open: true, msg: (e as Error).message, tone: 'error' })
    } finally {
      setSavingPuesto(null)
    }
  }

  return (
    <div style={{ animation: 'fadeInUp 0.3s ease', padding: '40px 48px 80px' }}>
      <div className='eyebrow' style={{ color: 'var(--red)', marginBottom: 8 }}>Planificación</div>
      <h1 style={{ fontSize: 28, fontWeight: 700, color: 'var(--gray-900)', letterSpacing: '-0.025em', margin: 0 }}>
        Capacidad por Puesto
      </h1>
      <p style={{ fontSize: 14, color: '#666', marginTop: 8, lineHeight: 1.5, maxWidth: 600 }}>
        Carga de hoy contra el límite diario de cada puesto. Los puestos sin límite aparecen en gris
        hasta que se define uno.
      </p>

      {error && (
        <div style={{
          background: '#FDECEA', border: '0.5px solid #F8CFCB', borderRadius: 10,
          padding: '12px 16px', marginTop: 16,
          fontSize: 13.5, color: '#E8180A', display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <AlertCircle size={15} /> {error}
        </div>
      )}

      {/* 4 métricas */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(185px, 1fr))', gap: 12, marginTop: 24, marginBottom: 28 }}>
        <MetricCard label='Órdenes hoy' value={loading ? '—' : String(ordenesHoy)} icon={Gauge} />
        <MetricCard label='Puestos activos' value={loading ? '—' : String(activos.length)} icon={Users} />
        <MetricCard
          label='Sobrecargados'
          value={loading ? '—' : String(sobrecargados.length)}
          icon={AlertTriangle}
          bg='#FDECEA'
          color='#E8180A'
        />
        <MetricCard
          label='Sin límite fijado'
          value={loading ? '—' : String(sinLimite)}
          icon={MinusCircle}
          bg='#F7F7F7'
          color='#999999'
        />
      </div>

      {/* Filas por puesto */}
      <h2 style={{
        fontSize: 11, fontWeight: 700, color: '#999', textTransform: 'uppercase',
        letterSpacing: '0.08em', marginBottom: 12,
      }}>
        Carga por puesto — hoy
      </h2>

      {loading ? (
        <div style={{ padding: '48px', textAlign: 'center', color: '#999', fontSize: 13 }}>Cargando…</div>
      ) : puestoRows.length === 0 ? (
        <div style={{
          background: '#fff', border: '0.5px solid #ECECEC', borderRadius: 10,
          padding: '40px 24px', textAlign: 'center', color: '#999', fontSize: 13,
        }}>
          No hay puestos activos configurados.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {puestoRows.map(r => {
            const c = TONO[r.tone]
            const editing = editingLimite[r.puesto] !== undefined
            const sinLim = r.limite_diario === null
            return (
              <div
                key={r.puesto}
                style={{
                  background: '#fff', border: '0.5px solid #ECECEC', borderRadius: 10,
                  padding: '12px 16px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                  {/* Izquierda */}
                  <div style={{ flex: 1, minWidth: 180 }}>
                    <div style={{ fontSize: 14, fontWeight: 500, color: '#1A1A1A' }}>
                      {r.label}
                    </div>
                    <div style={{ fontSize: 12, color: '#666', marginTop: 2 }}>
                      {r.load} {r.load === 1 ? 'orden' : 'órdenes'} hoy
                    </div>
                  </div>

                  {/* Derecha: badge + edición */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                    {editing ? (
                      <>
                        <input
                          type='number'
                          min={1}
                          autoFocus
                          value={editingLimite[r.puesto]}
                          onChange={e => setEditingLimite(prev => ({ ...prev, [r.puesto]: e.target.value }))}
                          placeholder='Sin límite'
                          style={{
                            height: 30, width: 100, fontSize: 12.5, padding: '0 8px',
                            border: '0.5px solid #ECECEC', borderRadius: 7, color: '#1A1A1A', background: '#fff',
                          }}
                        />
                        <button
                          onClick={() => saveLimit(r.puesto)}
                          disabled={savingPuesto === r.puesto}
                          className='btn btn-primary'
                          style={{ height: 30, fontSize: 11.5, padding: '0 10px', gap: 4 }}
                        >
                          <Save size={12} /> {savingPuesto === r.puesto ? 'Guardando…' : 'Guardar'}
                        </button>
                        <button
                          onClick={() => cancelEdit(r.puesto)}
                          disabled={savingPuesto === r.puesto}
                          className='btn'
                          style={{ height: 30, fontSize: 11.5, padding: '0 9px' }}
                        >
                          <X size={12} />
                        </button>
                      </>
                    ) : (
                      <>
                        <span style={{
                          fontSize: 11.5, fontWeight: 600, padding: '4px 11px', borderRadius: 9999,
                          background: c.bg, color: c.text, border: `0.5px solid ${c.border}`,
                          whiteSpace: 'nowrap',
                        }}>
                          {sinLim
                            ? `Sin límite · ${r.load} ${r.load === 1 ? 'orden' : 'órdenes'}`
                            : r.tone === 'red'
                              ? `Sobrecargado · ${r.load}/${r.limite_diario}`
                              : r.tone === 'amber'
                                ? `Casi lleno · ${r.load}/${r.limite_diario}`
                                : `Disponible · ${r.load}/${r.limite_diario}`}
                        </span>
                        {isAdmin && (
                          <button
                            onClick={() => startEdit(r.puesto, r.limite_diario)}
                            style={{
                              display: 'inline-flex', alignItems: 'center', gap: 4,
                              background: 'none', border: 'none', cursor: 'pointer',
                              fontSize: 11.5, color: '#999', padding: '4px 2px',
                            }}
                            onMouseEnter={e => { e.currentTarget.style.color = '#E8180A' }}
                            onMouseLeave={e => { e.currentTarget.style.color = '#999' }}
                          >
                            <Edit2 size={11} /> Editar límite
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>

                {/* Barra de progreso — solo con límite definido */}
                {!sinLim && (
                  <div style={{
                    height: 8, borderRadius: 20, background: '#F0F0F0',
                    marginTop: 10, overflow: 'hidden',
                  }}>
                    <div style={{
                      height: '100%', width: `${r.pct}%`, background: c.bar,
                      borderRadius: 20, transition: 'width 0.3s',
                    }} />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Alerta inferior */}
      {sobrecargados.length > 0 && (
        <div style={{
          marginTop: 18, background: '#FDECEA', border: '0.5px solid #F8CFCB',
          borderRadius: 10, padding: '12px 16px',
          fontSize: 13, color: '#E8180A', display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <AlertTriangle size={15} style={{ flexShrink: 0 }} />
          <span>
            <strong>{listaPuestos(sobrecargados.map(s => s.label))}</strong>
            {sobrecargados.length === 1 ? ' pasado' : ' pasados'} del límite hoy — considerar redistribuir órdenes
          </span>
        </div>
      )}

      <Toast
        open={toast.open}
        message={toast.msg}
        tone={toast.tone}
        onClose={() => setToast(t => ({ ...t, open: false }))}
      />
    </div>
  )
}

function listaPuestos (nombres: string[]): string {
  if (nombres.length === 1) return nombres[0]
  if (nombres.length === 2) return `${nombres[0]} y ${nombres[1]}`
  return `${nombres.slice(0, -1).join(', ')} y ${nombres[nombres.length - 1]}`
}

// ─────────────────────────────────────────────────────────
function MetricCard ({ label, value, icon: Icon, bg = '#fff', color = '#1A1A1A' }: {
  label: string
  value: string
  icon: React.ComponentType<{ size?: number; style?: React.CSSProperties }>
  bg?: string
  color?: string
}) {
  const muted = color === '#1A1A1A'
  return (
    <div style={{ background: bg, border: '0.5px solid #ECECEC', borderRadius: 10, padding: '14px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <div style={{
          fontSize: 11, color: muted ? '#666' : color,
          textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600,
        }}>
          {label}
        </div>
        <Icon size={14} style={{ color: muted ? '#BBB' : color }} />
      </div>
      <div style={{ fontSize: 24, fontWeight: 700, color, lineHeight: 1, letterSpacing: '-0.02em' }}>
        {value}
      </div>
    </div>
  )
}
