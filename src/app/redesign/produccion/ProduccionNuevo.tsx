'use client'
import { useState, useEffect, useMemo, useCallback, type ReactNode } from 'react'
import {
  Inbox, CheckCircle2, Search, SlidersHorizontal, ArrowUpDown,
  Inbox as InboxIcon, Calendar, type LucideIcon,
} from 'lucide-react'
import {
  type FacturaProduccion,
  type TicketProduccion,
  type Prioridad,
  fetchPendientes,
  fetchCompletados,
  calcularPrioridad,
  horasTranscurridas,
} from '@/lib/produccion'
import TarjetaPendiente from './TarjetaPendiente'
import TarjetaCompletado from './TarjetaCompletado'
import DetalleTicket from './DetalleTicket'

type Tab = 'pendientes' | 'completados'
type Filter = 'todas' | 'critica' | 'hoy' | string

const PRIORITY_STYLE: Record<Prioridad, { color: string; bg: string; text: string; label: string }> = {
  nueva:   { color: '#10B981', bg: 'rgba(16,185,129,0.10)',  text: '#059669', label: 'Nueva' },
  espera:  { color: '#F59E0B', bg: 'rgba(245,158,11,0.10)',  text: '#B45309', label: 'En espera' },
  urgente: { color: '#EA580C', bg: 'rgba(234,88,12,0.10)',  text: '#C2410C', label: 'Urgente' },
  critica: { color: '#EF4444', bg: 'rgba(239,68,68,0.10)',  text: '#DC2626', label: 'Crítica' },
}

interface ProduccionNuevoProps {
  user: { id: string; name: string }
}

export default function ProduccionNuevo({ user }: ProduccionNuevoProps) {
  const [tab, setTab] = useState<Tab>('pendientes')
  const [pendientes, setPendientes] = useState<FacturaProduccion[]>([])
  const [completados, setCompletados] = useState<(TicketProduccion & { vehiculo: string | null; cliente: string | null; fecha_factura: string | null })[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<Filter>('todas')
  const [selectedFactura, setSelectedFactura] = useState<FacturaProduccion | null>(null)
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    let active = true
    async function fetchData() {
      try {
        const [pend, comp] = await Promise.all([fetchPendientes(), fetchCompletados()])
        if (!active) return
        setPendientes(pend)
        setCompletados(comp)
        setError('')
      } catch (err) {
        if (active) setError((err as Error).message)
      } finally {
        if (active) setLoading(false)
      }
    }
    fetchData()
    return () => { active = false }
  }, [])

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000)
    return () => clearInterval(t)
  }, [])

  const reload = useCallback(async () => {
    try {
      const [pend, comp] = await Promise.all([fetchPendientes(), fetchCompletados()])
      setPendientes(pend)
      setCompletados(comp)
    } catch (err) {
      setError((err as Error).message)
    }
  }, [])

  // ── Filters ──
  const filteredPendientes = useMemo(() => {
    let list = pendientes
    if (search) {
      const q = search.toLowerCase()
      list = list.filter(f =>
        (f.talonario ?? '').toLowerCase().includes(q) ||
        f.factura.toLowerCase().includes(q) ||
        (f.vehiculo ?? '').toLowerCase().includes(q) ||
        (f.cliente ?? '').toLowerCase().includes(q)
      )
    }
    if (filter === 'critica') list = list.filter(f => calcularPrioridad(f.fecha, now).nivel === 'critica')
    else if (filter === 'hoy') {
      const today = new Date().toDateString()
      list = list.filter(f => new Date(f.fecha).toDateString() === today)
    } else if (filter !== 'todas' && filter !== 'critica' && filter !== 'hoy') {
      list = list.filter(f => (f.vehiculo ?? '').toUpperCase() === filter)
    }
    return [...list].sort((a, b) => horasTranscurridas(b.fecha, now) - horasTranscurridas(a.fecha, now))
  }, [pendientes, search, filter, now])

  const filteredCompletados = useMemo(() => {
    let list = completados
    if (search) {
      const q = search.toLowerCase()
      list = list.filter(t =>
        (t.numero_orden ?? '').toLowerCase().includes(q) ||
        (t.numero_factura ?? '').toLowerCase().includes(q) ||
        (t.vehiculo ?? '').toLowerCase().includes(q) ||
        (t.cliente ?? '').toLowerCase().includes(q)
      )
    }
    return list
  }, [completados, search])

  const vehicleFilters = useMemo(() => {
    const counts = new Map<string, number>()
    for (const f of pendientes) {
      const v = (f.vehiculo ?? '').toUpperCase()
      if (v && v !== '—') counts.set(v, (counts.get(v) ?? 0) + 1)
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([v]) => v)
  }, [pendientes])

  const counts = useMemo(() => {
    const c: Record<Prioridad, number> = { nueva: 0, espera: 0, urgente: 0, critica: 0 }
    for (const f of pendientes) c[calcularPrioridad(f.fecha, now).nivel]++
    return c
  }, [pendientes, now])

  // Drill-in
  if (selectedFactura) {
    return <DetalleTicket factura={selectedFactura} onBack={() => setSelectedFactura(null)} onAlta={() => { setSelectedFactura(null); reload() }} user={user} />
  }

  const filterCounts = {
    todas: pendientes.length,
    critica: counts.critica,
    hoy: pendientes.filter(f => new Date(f.fecha).toDateString() === new Date().toDateString()).length,
  }

  return (
    <div>
      {/* ── KPI strip ── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: 12,
        marginBottom: 28,
      }}>
        <Kpi label="Tickets pendientes" value={pendientes.length} accent="red" icon={InboxIcon} />
        <Kpi label="Críticas (+48h)" value={counts.critica} accent={counts.critica > 0 ? 'red' : 'gray'} icon={InboxIcon} />
        <Kpi label="En espera" value={counts.espera + counts.urgente} accent="amber" icon={InboxIcon} />
        <Kpi label="Hoy" value={filterCounts.hoy} accent="blue" icon={Calendar} />
        <Kpi label="Completados (mes)" value={completados.length} accent="green" icon={CheckCircle2} />
      </div>

      {/* ── Toolbar ── */}
      <div style={{
        background: 'white',
        border: '1px solid #E5E7EB',
        borderRadius: 12,
        padding: '12px 16px',
        marginBottom: 20,
        display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' as const,
        boxShadow: '0 1px 2px rgba(15,23,42,0.04)',
      }}>
        {/* Tabs (segmented inside toolbar) */}
        <div style={{
          display: 'flex', background: '#F3F4F6', borderRadius: 8, padding: 3, gap: 2,
        }}>
          <ToolbarTab active={tab === 'pendientes'} onClick={() => { setTab('pendientes'); setFilter('todas') }}>
            Pendientes <TabCount count={pendientes.length} tone={counts.critica > 0 ? 'red' : 'gray'} />
          </ToolbarTab>
          <ToolbarTab active={tab === 'completados'} onClick={() => { setTab('completados'); setFilter('todas') }}>
            Completados <TabCount count={completados.length} />
          </ToolbarTab>
        </div>

        <div style={{ width: 1, height: 20, background: '#E5E7EB' }} />

        {/* Search */}
        <div style={{ position: 'relative', flex: '1 1 240px', minWidth: 220, maxWidth: 380 }}>
          <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF' }} />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por orden, factura, vehículo o cliente…"
            style={{
              width: '100%', height: 36, padding: '0 12px 0 36px',
              fontSize: 13, fontFamily: 'Inter, sans-serif', color: '#111827',
              background: '#F9FAFB', border: '1px solid transparent', borderRadius: 7,
              outline: 'none', transition: 'border-color 0.15s, background 0.15s',
            }}
            onFocus={e => { e.currentTarget.style.background = 'white'; e.currentTarget.style.borderColor = '#E5E7EB' }}
            onBlur={e => { e.currentTarget.style.background = '#F9FAFB'; e.currentTarget.style.borderColor = 'transparent' }}
          />
        </div>

        {/* Filters */}
        {tab === 'pendientes' && (
          <>
            <button style={toolbarBtnStyle}>
              <SlidersHorizontal size={14} strokeWidth={1.75} /> Filtros
            </button>
            <button style={toolbarBtnStyle}>
              <ArrowUpDown size={14} strokeWidth={1.75} /> Prioridad
            </button>
          </>
        )}

        <div style={{ flex: 1 }} />

        {/* Filter chips */}
        {tab === 'pendientes' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' as const }}>
            <Chip active={filter === 'todas'} onClick={() => setFilter('todas')}>
              Todas <TabCount count={filterCounts.todas} />
            </Chip>
            {counts.critica > 0 && (
              <Chip active={filter === 'critica'} onClick={() => setFilter('critica')} dot="#EF4444">
                Críticas <TabCount count={filterCounts.critica} tone="red" />
              </Chip>
            )}
            <Chip active={filter === 'hoy'} onClick={() => setFilter('hoy')}>
              Hoy <TabCount count={filterCounts.hoy} />
            </Chip>
            {vehicleFilters.map(v => (
              <Chip key={v} active={filter === v} onClick={() => setFilter(v)}>
                {v} <TabCount count={pendientes.filter(f => (f.vehiculo ?? '').toUpperCase() === v).length} />
              </Chip>
            ))}
          </div>
        )}
      </div>

      {/* ── Content ── */}
      {error && (
        <div style={{
          background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 10,
          padding: '12px 16px', marginBottom: 16, fontSize: 13, color: '#B91C1C',
        }}>{error}</div>
      )}

      {loading ? (
        <LoadingBlock />
      ) : tab === 'pendientes' ? (
        filteredPendientes.length === 0 ? (
          <EmptyState
            icon={Inbox}
            title={search || filter !== 'todas' ? 'Sin coincidencias' : 'Sin tickets pendientes'}
            description={search || filter !== 'todas' ? 'Ajusta los filtros para ver más.' : 'Cuando Alegra registre nuevas facturas, aparecerán aquí.'}
          />
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
            {filteredPendientes.map(f => (
              <TarjetaPendiente
                key={f.alegra_id}
                factura={f}
                now={now}
                onClick={() => setSelectedFactura(f)}
              />
            ))}
          </div>
        )
      ) : filteredCompletados.length === 0 ? (
        <EmptyState
          icon={CheckCircle2}
          title="Sin tickets completados"
          description="Los tickets que des de alta aparecerán aquí."
        />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
          {filteredCompletados.map(t => (
            <TarjetaCompletado key={t.id} ticket={t} now={now} />
          ))}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────
// Micro-components
// ─────────────────────────────────────────────────────────

function Kpi({ label, value, accent, icon: Icon }: { label: string; value: number; accent: 'red' | 'amber' | 'blue' | 'green' | 'gray'; icon: LucideIcon }) {
  const map = {
    red:   { bg: 'rgba(232,24,10,0.08)',  text: '#E8180A' },
    amber: { bg: 'rgba(245,158,11,0.10)', text: '#B45309' },
    blue:  { bg: 'rgba(59,130,246,0.10)', text: '#2563EB' },
    green: { bg: 'rgba(16,185,129,0.10)', text: '#059669' },
    gray:  { bg: '#F3F4F6',               text: '#6B7280' },
  } as const
  const t = map[accent]
  return (
    <div style={{
      background: 'white', border: '1px solid #E5E7EB', borderRadius: 14,
      padding: '16px 18px',
      boxShadow: '0 1px 2px rgba(15,23,42,0.04)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ fontSize: 11, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>
          {label}
        </div>
        <div style={{
          width: 30, height: 30, borderRadius: 8,
          background: t.bg, color: t.text,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon size={14} strokeWidth={1.75} />
        </div>
      </div>
      <div style={{
        fontSize: 28, fontWeight: 700, color: '#111827',
        letterSpacing: '-0.025em', lineHeight: 1, fontFeatureSettings: '"tnum" 1',
      }}>
        {value}
      </div>
    </div>
  )
}

function ToolbarTab({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button onClick={onClick} style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: '5px 12px',
      background: active ? 'white' : 'transparent',
      color: active ? '#111827' : '#6B7280',
      border: 'none', borderRadius: 6,
      fontSize: 13, fontWeight: 600, letterSpacing: '-0.005em',
      cursor: 'pointer', boxShadow: active ? '0 1px 2px rgba(15,23,42,0.06)' : 'none',
    }}>
      {children}
    </button>
  )
}

function TabCount({ count, tone = 'gray' }: { count: number; tone?: 'gray' | 'red' }) {
  return (
    <span style={{
      fontSize: 11, fontWeight: 700,
      color: tone === 'red' ? '#E8180A' : '#6B7280',
      background: tone === 'red' ? 'rgba(232,24,10,0.10)' : '#E5E7EB',
      padding: '0 6px', borderRadius: 9999, minWidth: 18, textAlign: 'center', lineHeight: '16px',
    }}>{count}</span>
  )
}

function Chip({ active, onClick, children, dot }: { active: boolean; onClick: () => void; children: ReactNode; dot?: string }) {
  return (
    <button onClick={onClick} style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      height: 28, padding: '0 10px',
      fontSize: 12, fontWeight: 500,
      background: active ? 'white' : 'transparent',
      color: active ? '#111827' : '#6B7280',
      border: '1px solid ' + (active ? '#E5E7EB' : 'transparent'),
      borderRadius: 9999, cursor: 'pointer',
      transition: 'background 0.12s, border-color 0.12s, color 0.12s',
    }}>
      {dot && <span style={{ width: 6, height: 6, borderRadius: '50%', background: dot, flexShrink: 0 }} />}
      {children}
    </button>
  )
}

function LoadingBlock() {
  return (
    <div style={{
      padding: '80px 24px', textAlign: 'center', color: '#6B7280', fontSize: 13.5,
      background: 'white', border: '1px solid #E5E7EB', borderRadius: 14,
    }}>
      <div style={{
        display: 'inline-block', width: 22, height: 22,
        border: '2.5px solid #E5E7EB', borderTopColor: '#E8180A',
        borderRadius: '50%', animation: 'rd-spin 0.7s linear infinite', marginBottom: 12,
      }} />
      <div>Cargando tickets…</div>
      <style>{`@keyframes rd-spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

function EmptyState({ icon: Icon, title, description }: { icon: LucideIcon; title: string; description: string }) {
  return (
    <div style={{
      padding: '80px 24px', textAlign: 'center', maxWidth: 360, margin: '0 auto',
      background: 'white', border: '1px solid #E5E7EB', borderRadius: 14,
    }}>
      <div style={{
        width: 52, height: 52, borderRadius: 14,
        background: 'rgba(232,24,10,0.06)', color: '#E8180A',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 18,
      }}>
        <Icon size={22} strokeWidth={1.6} />
      </div>
      <h3 style={{ fontSize: 15, fontWeight: 600, color: '#111827', margin: 0, letterSpacing: '-0.01em' }}>
        {title}
      </h3>
      <p style={{ fontSize: 13, color: '#6B7280', marginTop: 8, lineHeight: 1.5 }}>
        {description}
      </p>
    </div>
  )
}

const toolbarBtnStyle: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  height: 36, padding: '0 12px',
  fontSize: 12.5, fontWeight: 500,
  color: '#374151',
  background: 'transparent', border: 'none', borderRadius: 7,
  cursor: 'pointer',
}

// Re-export for downstream
export { PRIORITY_STYLE }
