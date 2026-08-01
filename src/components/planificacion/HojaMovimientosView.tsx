'use client'
import { useEffect, useState, useCallback, useMemo } from 'react'
import {
  Activity, AlertTriangle, Clock, ArrowRight, RefreshCw,
  Filter, Search,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import {
  fetchMovimientos,
  type OrdenMovimiento,
} from '@/lib/production-v2'
import {
  fetchEventosArmador,
  fetchOrdenesMapa,
} from '@/lib/ordenes'
import { useSnapshotEngine } from '@/lib/useSnapshotEngine'

type FilterPeriod = 'hoy' | 'semana' | 'mes'
type FilterEstado = 'todos' | 'estancadas' | 'activas'

// ── Puesto color map (matches calendar string values)
const PUESTO_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  'PUESTO 2 ARMADOR':          { bg: '#EFF6FF', text: '#1D4ED8', border: '#BFDBFE' },
  'EVENNOT  PUESTO 4  5PM-9PM': { bg: '#FFF7ED', text: '#C2410C', border: '#FED7AA' },
  'PUESTO 4 DE 8AM 4PM':       { bg: '#F0FDF4', text: '#15803D', border: '#BBF7D0' },
  'puesto 5 oscar':            { bg: '#FAF5FF', text: '#7C3AED', border: '#DDD6FE' },
}

const DEFAULT_PUESTO_COLOR = { bg: 'var(--gray-50)', text: 'var(--gray-700)', border: 'var(--border)' }

function puestoColor (puesto: string | null) {
  if (!puesto) return DEFAULT_PUESTO_COLOR
  return PUESTO_COLORS[puesto] ?? DEFAULT_PUESTO_COLOR
}

function relativeTime (iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (diff < 60) return 'hace unos segundos'
  if (diff < 3600) return `hace ${Math.floor(diff / 60)}m`
  if (diff < 86400) return `hace ${Math.floor(diff / 3600)}h`
  return `hace ${Math.floor(diff / 86400)}d`
}

function daysDiff (iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24))
}

function isoToday () {
  return new Date().toISOString().slice(0, 10)
}

export default function HojaMovimientosView () {
  const [movimientos, setMovimientos] = useState<OrdenMovimiento[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [period, setPeriod] = useState<FilterPeriod>('hoy')
  const [estado, setEstado] = useState<FilterEstado>('todos')
  const [searchOrden, setSearchOrden] = useState('')
  const [searchPuesto, setSearchPuesto] = useState('')
  const [now, setNow] = useState(() => Date.now())

  const { runSnapshot } = useSnapshotEngine()

  const loadData = useCallback(async (runSnap = false) => {
    try {
      const [movs, eventos, ordenesMap] = await Promise.all([
        fetchMovimientos(500),
        fetchEventosArmador(),
        fetchOrdenesMapa(),
      ])
      setMovimientos(movs)
      if (runSnap) {
        await runSnapshot(eventos, ordenesMap)
        // Reload after snapshot inserts
        const updated = await fetchMovimientos(500)
        setMovimientos(updated)
      }
      setError('')
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }, [runSnapshot])

  // Initial load with snapshot
  useEffect(() => {
    let active = true
    void (async () => {
      try {
        await loadData(true)
        if (active) setLoading(false)
      } catch {
        if (active) setLoading(false)
      }
    })()
    return () => { active = false }
  }, [loadData])

  // Ticking clock for relative times / period windows
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000)
    return () => clearInterval(id)
  }, [])

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel('hoja-movimientos-rt')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orden_movimientos' }, payload => {
        const newRow = payload.new as OrdenMovimiento
        setMovimientos(prev => [newRow, ...prev])
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])

  async function handleRefresh () {
    setRefreshing(true)
    await loadData(true)
    setRefreshing(false)
  }

  // ── Filters
  const filtered = useMemo(() => {
    const today = isoToday()
    const weekAgo = new Date(now - 7 * 86400000).toISOString()
    const monthAgo = new Date(now - 30 * 86400000).toISOString()

    return movimientos.filter(m => {
      // Period
      if (period === 'hoy' && !m.ocurrido_en.startsWith(today)) return false
      if (period === 'semana' && m.ocurrido_en < weekAgo) return false
      if (period === 'mes' && m.ocurrido_en < monthAgo) return false

      // Estado
      if (estado === 'estancadas' && m.tipo !== 'ESTANCADA' && daysDiff(m.ocurrido_en) < 2) return false
      if (estado === 'activas' && m.tipo === 'SALIDA') return false

      // Search
      if (searchOrden && !m.numero_orden.toLowerCase().includes(searchOrden.toLowerCase())) return false
      if (searchPuesto && !m.hacia_puesto.toLowerCase().includes(searchPuesto.toLowerCase())) return false

      return true
    })
  }, [movimientos, period, estado, searchOrden, searchPuesto, now])

  // ── KPIs
  const today = isoToday()
  const movHoy = movimientos.filter(m => m.ocurrido_en.startsWith(today)).length

  const tiempoPromedio = useMemo(() => {
    // Average days between consecutive ENTRADA and CAMBIO_PUESTO per order
    const byOrden = new Map<string, OrdenMovimiento[]>()
    for (const m of movimientos) {
      if (m.tipo === 'ENTRADA' || m.tipo === 'CAMBIO_PUESTO') {
        const arr = byOrden.get(m.numero_orden) ?? []
        arr.push(m)
        byOrden.set(m.numero_orden, arr)
      }
    }
    const diffs: number[] = []
    for (const rows of byOrden.values()) {
      const sorted = [...rows].sort((a, b) => a.ocurrido_en.localeCompare(b.ocurrido_en))
      for (let i = 1; i < sorted.length; i++) {
        const d = Math.floor((new Date(sorted[i].ocurrido_en).getTime() - new Date(sorted[i-1].ocurrido_en).getTime()) / 86400000)
        if (d >= 0) diffs.push(d)
      }
    }
    if (!diffs.length) return null
    return Math.round(diffs.reduce((a, b) => a + b, 0) / diffs.length)
  }, [movimientos])

  const estancadas = useMemo(() => {
    // Orders where latest movement is >2 days old and type != SALIDA
    const latestByOrden = new Map<string, OrdenMovimiento>()
    for (const m of movimientos) {
      const cur = latestByOrden.get(m.numero_orden)
      if (!cur || m.ocurrido_en > cur.ocurrido_en) latestByOrden.set(m.numero_orden, m)
    }
    return [...latestByOrden.values()].filter(m => m.tipo !== 'SALIDA' && daysDiff(m.ocurrido_en) >= 2)
  }, [movimientos])

  return (
    <div style={{ animation: 'fadeInUp 0.3s ease', padding: '40px 48px 80px' }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div className='eyebrow' style={{ color: 'var(--red)', marginBottom: 6 }}>Planificación</div>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 700, color: 'var(--gray-900)', letterSpacing: '-0.025em', margin: 0 }}>
              Hoja de Movimientos
            </h1>
            <p style={{ fontSize: 14, color: 'var(--gray-500)', marginTop: 6 }}>
              Log en vivo de cómo las órdenes se mueven entre puestos de producción.
            </p>
          </div>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className='btn btn-secondary'
            style={{ height: 36, gap: 6, flexShrink: 0 }}
          >
            <RefreshCw size={13} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
            {refreshing ? 'Sincronizando…' : 'Sincronizar'}
          </button>
        </div>
      </div>

      {error && (
        <div style={{
          background: 'var(--red-50)', border: '1px solid var(--red-ring)',
          borderRadius: 'var(--radius-lg)', padding: '12px 16px', marginBottom: 20,
          fontSize: 13.5, color: 'var(--red)', display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <AlertTriangle size={15} /> {error}
        </div>
      )}

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, marginBottom: 28 }}>
        <KpiCard
          label='Movimientos hoy'
          value={String(movHoy)}
          icon={Activity}
          tone='blue'
        />
        <KpiCard
          label='Tiempo promedio por etapa'
          value={tiempoPromedio !== null ? `${tiempoPromedio}d` : '—'}
          icon={Clock}
          tone='green'
        />
        <KpiCard
          label='Estancadas +2 días'
          value={String(estancadas.length)}
          icon={AlertTriangle}
          tone={estancadas.length > 0 ? 'amber' : 'green'}
        />
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18, flexWrap: 'wrap' }}>
        {/* Period */}
        <div className='card' style={{ padding: '4px 6px', display: 'flex', gap: 2 }}>
          {(['hoy', 'semana', 'mes'] as FilterPeriod[]).map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              style={{
                padding: '5px 12px', borderRadius: 'var(--radius-sm)', border: 'none',
                background: period === p ? 'var(--red)' : 'transparent',
                color: period === p ? '#fff' : 'var(--gray-600)',
                fontSize: 12.5, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s',
              }}
            >
              {p === 'hoy' ? 'Hoy' : p === 'semana' ? 'Semana' : 'Mes'}
            </button>
          ))}
        </div>

        {/* Estado */}
        <div className='card' style={{ padding: '4px 6px', display: 'flex', gap: 2 }}>
          {(['todos', 'estancadas', 'activas'] as FilterEstado[]).map(e => (
            <button
              key={e}
              onClick={() => setEstado(e)}
              style={{
                padding: '5px 12px', borderRadius: 'var(--radius-sm)', border: 'none',
                background: estado === e ? 'var(--gray-800)' : 'transparent',
                color: estado === e ? '#fff' : 'var(--gray-600)',
                fontSize: 12.5, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s',
              }}
            >
              {e === 'todos' ? 'Todos' : e === 'estancadas' ? 'Estancadas' : 'Activas'}
            </button>
          ))}
        </div>

        {/* Search orden */}
        <div style={{ position: 'relative' }}>
          <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--gray-400)' }} />
          <input
            className='input-base'
            style={{ height: 34, paddingLeft: 30, width: 130, fontSize: 12.5 }}
            placeholder='Orden…'
            value={searchOrden}
            onChange={e => setSearchOrden(e.target.value)}
          />
        </div>

        {/* Search puesto */}
        <div style={{ position: 'relative' }}>
          <Filter size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--gray-400)' }} />
          <input
            className='input-base'
            style={{ height: 34, paddingLeft: 30, width: 150, fontSize: 12.5 }}
            placeholder='Puesto…'
            value={searchPuesto}
            onChange={e => setSearchPuesto(e.target.value)}
          />
        </div>

        <span style={{ fontSize: 12, color: 'var(--gray-400)', marginLeft: 'auto' }}>
          {filtered.length} movimiento{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Movement Table */}
      <div className='card' style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table className='table-dark' style={{ minWidth: 680 }}>
            <thead>
              <tr>
                <th>Orden</th>
                <th>Movimiento</th>
                <th>Pieza / Vehículo</th>
                <th>Cuándo</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} style={{ padding: '48px', textAlign: 'center', color: 'var(--gray-400)', fontSize: 13 }}>
                    Cargando movimientos…
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ padding: '48px', textAlign: 'center', color: 'var(--gray-400)', fontSize: 13 }}>
                    No hay movimientos {period === 'hoy' ? 'hoy' : `esta ${period}`}.
                    {period === 'hoy' && <> Presiona <strong>Sincronizar</strong> para detectar cambios en el calendario.</>}
                  </td>
                </tr>
              ) : (
                filtered.map(m => {
                  const dias = daysDiff(m.ocurrido_en)
                  const isStagnant = (m.tipo === 'ESTANCADA' || dias >= 2) && m.tipo !== 'SALIDA'
                  const desde = puestoColor(m.desde_puesto)
                  const hacia = puestoColor(m.hacia_puesto)
                  return (
                    <tr
                      key={m.id}
                      style={{
                        background: isStagnant ? '#FFFBEB' : undefined,
                        transition: 'background 0.15s',
                      }}
                    >
                      {/* Orden */}
                      <td style={{ fontWeight: 700, color: 'var(--gray-900)', fontSize: 13, whiteSpace: 'nowrap' }}>
                        #{m.numero_orden}
                      </td>

                      {/* Movimiento */}
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                          {m.desde_puesto && (
                            <>
                              <span style={{
                                fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 9999,
                                background: desde.bg, color: desde.text, border: `1px solid ${desde.border}`,
                                whiteSpace: 'nowrap',
                              }}>
                                {m.desde_puesto}
                              </span>
                              <ArrowRight size={12} style={{ color: 'var(--gray-400)', flexShrink: 0 }} />
                            </>
                          )}
                          <span style={{
                            fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 9999,
                            background: hacia.bg, color: hacia.text, border: `1px solid ${hacia.border}`,
                            whiteSpace: 'nowrap',
                          }}>
                            {m.hacia_puesto}
                          </span>
                          {m.tipo === 'ENTRADA' && (
                            <span style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--green)', background: 'var(--green-bg)', padding: '1px 6px', borderRadius: 9999, border: '1px solid var(--green-ring)' }}>ENTRADA</span>
                          )}
                          {m.tipo === 'SALIDA' && (
                            <span style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--gray-500)', background: 'var(--gray-50)', padding: '1px 6px', borderRadius: 9999, border: '1px solid var(--border)' }}>SALIDA</span>
                          )}
                        </div>
                      </td>

                      {/* Pieza / Vehículo */}
                      <td style={{ minWidth: 160 }}>
                        {m.pieza && <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--gray-900)' }}>{m.pieza}</div>}
                        {m.vehiculo && <div style={{ fontSize: 11, color: 'var(--gray-500)', marginTop: 1 }}>{m.vehiculo}</div>}
                        {!m.pieza && !m.vehiculo && <span style={{ color: 'var(--gray-400)', fontSize: 12 }}>—</span>}
                      </td>

                      {/* Cuándo */}
                      <td style={{ fontSize: 12, color: 'var(--gray-500)', whiteSpace: 'nowrap' }}>
                        {relativeTime(m.ocurrido_en)}
                      </td>

                      {/* Estado */}
                      <td>
                        {isStagnant ? (
                          <span style={{
                            fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 9999,
                            background: '#FEF3C7', color: '#92400E', border: '1px solid #FCD34D',
                            whiteSpace: 'nowrap',
                          }}>
                            +{m.dias_estancada || dias}d estancada
                          </span>
                        ) : m.tipo === 'CAMBIO_PUESTO' ? (
                          <span style={{
                            fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 9999,
                            background: '#EFF6FF', color: '#1D4ED8', border: '1px solid #BFDBFE',
                          }}>
                            Movida
                          </span>
                        ) : m.tipo === 'SALIDA' ? (
                          <span style={{
                            fontSize: 11, fontWeight: 600, color: 'var(--gray-400)', padding: '2px 8px',
                          }}>
                            Finalizada
                          </span>
                        ) : (
                          <span style={{
                            fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 9999,
                            background: 'var(--green-bg)', color: 'var(--green)', border: '1px solid var(--green-ring)',
                          }}>
                            Nueva
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Realtime indicator */}
      <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: 'var(--gray-400)' }}>
        <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--green)', display: 'inline-block' }} />
        Actualizaciones en tiempo real activas
      </div>
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
        <div style={{
          width: 30, height: 30, borderRadius: 'var(--radius)',
          background: 'var(--gray-50)', color: 'var(--gray-500)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon size={13} />
        </div>
      </div>
      <div style={{ fontSize: 26, fontWeight: 700, color: 'var(--gray-900)', lineHeight: 1, letterSpacing: '-0.02em' }}>{value}</div>
    </div>
  )
}
