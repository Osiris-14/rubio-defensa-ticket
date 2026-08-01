'use client'
import { useEffect, useState, useCallback, useMemo } from 'react'
import {
  Activity, AlertTriangle, Clock, ArrowRight, RefreshCw,
  Filter, Search, Inbox, PauseCircle,
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
import { labelPuesto, colorPuesto, COLOR_CONFIRMADA } from '@/lib/puestos'

type FilterPeriod = 'hoy' | 'semana' | 'mes'
type FilterEstado = 'todos' | 'estancadas' | 'activas'

const WARNING_BG = '#FAEEDA'
const WARNING_TEXT = '#B8860B'

// El motor de snapshot escribe ENTRADA / CAMBIO_PUESTO / SALIDA / ESTANCADA.
// La hoja los presenta con el vocabulario del mockup.
type TipoVista = 'movimiento' | 'estancada' | 'confirmada' | 'salida'

function tipoVista (m: OrdenMovimiento): TipoVista {
  if (m.confirmada) return 'confirmada'
  if (m.tipo === 'ESTANCADA') return 'estancada'
  if (m.tipo === 'SALIDA') return 'salida'
  return 'movimiento'
}

function relativeTime (iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (diff < 60) return 'hace un momento'
  if (diff < 3600) return `hace ${Math.floor(diff / 60)}m`
  if (diff < 86400) return `hace ${Math.floor(diff / 3600)}h`
  const dias = Math.floor(diff / 86400)
  if (dias === 1) return 'ayer'
  return `${dias} días`
}

function daysDiff (iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24))
}

function isoToday () {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
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
        const updated = await fetchMovimientos(500)
        setMovimientos(updated)
      }
      setError('')
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }, [runSnapshot])

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

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000)
    return () => clearInterval(id)
  }, [])

  // Realtime: las filas nuevas entran en vivo.
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

  // Órdenes con salida confirmada — no cuentan como estancadas.
  const confirmadas = useMemo(() => {
    const set = new Set<string>()
    for (const m of movimientos) if (m.confirmada) set.add(m.numero_orden)
    return set
  }, [movimientos])

  const filtered = useMemo(() => {
    const today = isoToday()
    const weekAgo = new Date(now - 7 * 86400000).toISOString()
    const monthAgo = new Date(now - 30 * 86400000).toISOString()

    return movimientos
      .filter(m => {
        if (period === 'hoy' && !m.ocurrido_en.startsWith(today)) return false
        if (period === 'semana' && m.ocurrido_en < weekAgo) return false
        if (period === 'mes' && m.ocurrido_en < monthAgo) return false

        if (estado === 'estancadas' && m.tipo !== 'ESTANCADA' && daysDiff(m.ocurrido_en) < 2) return false
        if (estado === 'activas' && m.tipo === 'SALIDA') return false

        if (searchOrden && !m.numero_orden.toLowerCase().includes(searchOrden.toLowerCase())) return false
        if (searchPuesto) {
          const q = searchPuesto.toLowerCase()
          const enCrudo = (m.hacia_puesto ?? '').toLowerCase().includes(q)
          const enLabel = labelPuesto(m.hacia_puesto).toLowerCase().includes(q)
          if (!enCrudo && !enLabel) return false
        }
        return true
      })
      // Más reciente primero.
      .sort((a, b) => b.ocurrido_en.localeCompare(a.ocurrido_en))
  }, [movimientos, period, estado, searchOrden, searchPuesto, now])

  // ── Card 1: movimientos de hoy
  const movHoy = useMemo(() => {
    const today = isoToday()
    return movimientos.filter(m =>
      m.ocurrido_en.startsWith(today) && tipoVista(m) === 'movimiento',
    ).length
  }, [movimientos])

  // ── Card 2: días promedio entre movimientos consecutivos de una orden
  const tiempoPromedio = useMemo(() => {
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
        const d = (new Date(sorted[i].ocurrido_en).getTime() - new Date(sorted[i - 1].ocurrido_en).getTime()) / 86400000
        if (d >= 0) diffs.push(d)
      }
    }
    if (!diffs.length) return null
    return diffs.reduce((a, b) => a + b, 0) / diffs.length
  }, [movimientos])

  // ── Card 3: órdenes cuyo último movimiento tiene +2d y no fueron confirmadas
  const estancadas = useMemo(() => {
    const latestByOrden = new Map<string, OrdenMovimiento>()
    for (const m of movimientos) {
      const cur = latestByOrden.get(m.numero_orden)
      if (!cur || m.ocurrido_en > cur.ocurrido_en) latestByOrden.set(m.numero_orden, m)
    }
    return [...latestByOrden.values()].filter(m =>
      m.tipo !== 'SALIDA' &&
      !confirmadas.has(m.numero_orden) &&
      daysDiff(m.ocurrido_en) > 2,
    )
  }, [movimientos, confirmadas])

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
          borderRadius: 10, padding: '12px 16px', marginBottom: 20,
          fontSize: 13.5, color: 'var(--red)', display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <AlertTriangle size={15} /> {error}
        </div>
      )}

      {/* 3 métricas */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 12, marginBottom: 24 }}>
        <MetricCard
          label='Movimientos hoy'
          value={String(movHoy)}
          icon={Activity}
        />
        <MetricCard
          label='Tiempo prom. por etapa'
          value={tiempoPromedio !== null ? `${tiempoPromedio.toFixed(1)} días` : '—'}
          icon={Clock}
        />
        <MetricCard
          label='Estancadas +2d'
          value={String(estancadas.length)}
          icon={AlertTriangle}
          bg={WARNING_BG}
          color={WARNING_TEXT}
        />
      </div>

      {/* Filtros */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
        <div style={segmentedWrap}>
          {(['hoy', 'semana', 'mes'] as FilterPeriod[]).map(p => (
            <button key={p} onClick={() => setPeriod(p)} style={segmentedBtn(period === p, 'var(--red)')}>
              {p === 'hoy' ? 'Hoy' : p === 'semana' ? 'Semana' : 'Mes'}
            </button>
          ))}
        </div>

        <div style={segmentedWrap}>
          {(['todos', 'estancadas', 'activas'] as FilterEstado[]).map(e => (
            <button key={e} onClick={() => setEstado(e)} style={segmentedBtn(estado === e, 'var(--gray-800)')}>
              {e === 'todos' ? 'Todos' : e === 'estancadas' ? 'Estancadas' : 'Activas'}
            </button>
          ))}
        </div>

        <div style={{ position: 'relative' }}>
          <Search size={13} style={iconInput} />
          <input
            className='input-base'
            style={{ height: 34, paddingLeft: 30, width: 130, fontSize: 12.5 }}
            placeholder='Orden…'
            value={searchOrden}
            onChange={e => setSearchOrden(e.target.value)}
          />
        </div>

        <div style={{ position: 'relative' }}>
          <Filter size={13} style={iconInput} />
          <input
            className='input-base'
            style={{ height: 34, paddingLeft: 30, width: 150, fontSize: 12.5 }}
            placeholder='Puesto…'
            value={searchPuesto}
            onChange={e => setSearchPuesto(e.target.value)}
          />
        </div>

        <span style={{ fontSize: 12, color: '#999', marginLeft: 'auto' }}>
          {filtered.length} movimiento{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Tabla */}
      <div style={{
        background: '#fff', border: '0.5px solid #ECECEC', borderRadius: 12, overflow: 'hidden',
      }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 620 }}>
            <thead>
              <tr>
                <Th>Orden</Th>
                <Th>Movimiento</Th>
                <Th>Vehículo</Th>
                <Th align='right'>Cuándo</Th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={4} style={{ padding: '48px', textAlign: 'center', color: '#999', fontSize: 13 }}>
                    Cargando movimientos…
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={4} style={{ padding: '56px 24px' }}>
                    <EmptyState />
                  </td>
                </tr>
              ) : (
                filtered.map(m => (
                  <MovimientoRow key={m.id} m={m} confirmada={confirmadas.has(m.numero_orden)} />
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: '#999' }}>
        <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--green)', display: 'inline-block' }} />
        Actualizaciones en tiempo real activas
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────
function MovimientoRow ({ m, confirmada }: { m: OrdenMovimiento; confirmada: boolean }) {
  const dias = daysDiff(m.ocurrido_en)
  const vista = tipoVista(m)
  const estancada = vista === 'estancada' || (!confirmada && vista !== 'salida' && dias > 2)

  return (
    <tr style={{
      borderTop: '0.5px solid #ECECEC',
      background: estancada ? WARNING_BG : undefined,
    }}>
      {/* Orden */}
      <td style={{ ...td, fontWeight: 700, color: '#1A1A1A', fontSize: 13, whiteSpace: 'nowrap' }}>
        #{m.numero_orden}
      </td>

      {/* Movimiento */}
      <td style={td}>
        {estancada ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: WARNING_TEXT, fontSize: 12, fontWeight: 600 }}>
            <PauseCircle size={13} style={{ flexShrink: 0 }} />
            Sin moverse — sigue en {labelPuesto(m.hacia_puesto)}
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            {m.desde_puesto && m.desde_puesto !== m.hacia_puesto && (
              <>
                <PuestoChip puesto={m.desde_puesto} />
                <ArrowRight size={12} style={{ color: '#999', flexShrink: 0 }} />
              </>
            )}
            <PuestoChip puesto={m.hacia_puesto} />
            {vista === 'confirmada' && (
              <span style={chip(COLOR_CONFIRMADA)}>Confirmada</span>
            )}
          </div>
        )}
      </td>

      {/* Vehículo */}
      <td style={{ ...td, fontSize: 12, color: '#666', minWidth: 140 }}>
        {m.vehiculo || '—'}
      </td>

      {/* Cuándo */}
      <td style={{ ...td, textAlign: 'right', whiteSpace: 'nowrap' }}>
        {estancada ? (
          <span style={{ fontSize: 12, fontWeight: 700, color: WARNING_TEXT }}>
            {dias} días
          </span>
        ) : (
          <span style={{ fontSize: 12, color: '#999' }}>
            {relativeTime(m.ocurrido_en)}
          </span>
        )}
      </td>
    </tr>
  )
}

function PuestoChip ({ puesto }: { puesto: string | null }) {
  return <span style={chip(colorPuesto(puesto))}>{labelPuesto(puesto)}</span>
}

function chip (c: { bg: string; text: string; border: string }): React.CSSProperties {
  return {
    fontSize: 11, fontWeight: 600, padding: '2px 9px', borderRadius: 9999,
    background: c.bg, color: c.text, border: `0.5px solid ${c.border}`,
    whiteSpace: 'nowrap',
  }
}

function EmptyState () {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{
        width: 46, height: 46, borderRadius: 12, background: '#F7F7F7',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12,
      }}>
        <Inbox size={20} strokeWidth={1.6} style={{ color: '#BBB' }} />
      </div>
      <div style={{ fontSize: 13.5, color: '#666', fontWeight: 500 }}>
        No hay movimientos registrados todavía
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────
function MetricCard ({ label, value, icon: Icon, bg = '#fff', color = '#1A1A1A' }: {
  label: string
  value: string
  icon: React.ComponentType<{ size?: number; style?: React.CSSProperties }>
  bg?: string
  color?: string
}) {
  return (
    <div style={{
      background: bg, border: '0.5px solid #ECECEC', borderRadius: 10, padding: '14px 16px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <div style={{
          fontSize: 11, color: color === '#1A1A1A' ? '#666' : color,
          textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600,
        }}>
          {label}
        </div>
        <Icon size={14} style={{ color: color === '#1A1A1A' ? '#BBB' : color }} />
      </div>
      <div style={{ fontSize: 24, fontWeight: 700, color, lineHeight: 1, letterSpacing: '-0.02em' }}>
        {value}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────
const td: React.CSSProperties = { padding: '11px 14px', verticalAlign: 'middle' }

function Th ({ children, align = 'left' }: { children: React.ReactNode; align?: 'left' | 'right' }) {
  return (
    <th style={{
      textAlign: align, padding: '9px 14px', fontSize: 10.5, fontWeight: 700,
      textTransform: 'uppercase', letterSpacing: '0.05em', color: '#999',
      background: '#FAFAFA', borderBottom: '0.5px solid #ECECEC', whiteSpace: 'nowrap',
    }}>
      {children}
    </th>
  )
}

const segmentedWrap: React.CSSProperties = {
  padding: '4px 5px', display: 'flex', gap: 2,
  background: '#fff', border: '0.5px solid #ECECEC', borderRadius: 8,
}

function segmentedBtn (active: boolean, activeBg: string): React.CSSProperties {
  return {
    padding: '5px 12px', borderRadius: 6, border: 'none',
    background: active ? activeBg : 'transparent',
    color: active ? '#fff' : '#666',
    fontSize: 12.5, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s',
  }
}

const iconInput: React.CSSProperties = {
  position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#BBB',
}
