'use client'
import { useState, useEffect, useMemo, useCallback, type ReactNode } from 'react'
import { Inbox, CheckCircle, ChevronRight, ListFilter, ArrowUpDown } from 'lucide-react'
import {
  type FacturaProduccion,
  type CompletadoProduccion,
  type Prioridad,
  fetchPendientes,
  fetchCompletados,
  calcularPrioridad,
  horasTranscurridas,
} from '@/lib/produccion'
import { PendienteCard } from './ProduccionCard'
import TicketDetail from './TicketDetail'

type Tab = 'pendientes' | 'completados'
type Filter = 'todas' | 'critica' | 'hoy' | string

interface Props {
  user: { id: string; name: string; role: string }
}

export default function ProduccionView({ user }: Props) {
  const [tab, setTab] = useState<Tab>('pendientes')
  const [pendientes, setPendientes] = useState<FacturaProduccion[]>([])
  const [completados, setCompletados] = useState<CompletadoProduccion[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<Filter>('todas')
  const [selectedFactura, setSelectedFactura] = useState<FacturaProduccion | null>(null)
  const [selectedCompletado, setSelectedCompletado] = useState<CompletadoProduccion | null>(null)
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
    const interval = setInterval(() => setNow(Date.now()), 60_000)
    return () => clearInterval(interval)
  }, [])

  const reload = useCallback(async () => {
    try {
      const [pend, comp] = await Promise.all([fetchPendientes(), fetchCompletados()])
      setPendientes(pend)
      setCompletados(comp)
      setError('')
    } catch (err) {
      setError((err as Error).message)
    }
  }, [])

  const pendientesFiltrados = useMemo(() => {
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
    if (filter === 'critica') {
      list = list.filter(f => calcularPrioridad(f.fecha, now).nivel === 'critica')
    } else if (filter === 'hoy') {
      const hoy = new Date().toDateString()
      list = list.filter(f => new Date(f.fecha).toDateString() === hoy)
    } else if (filter !== 'todas' && filter !== 'critica' && filter !== 'hoy') {
      list = list.filter(f => (f.vehiculo ?? '').toUpperCase() === filter)
    }
    return [...list].sort((a, b) => horasTranscurridas(b.fecha, now) - horasTranscurridas(a.fecha, now))
  }, [pendientes, search, filter, now])

  const completadosFiltrados = useMemo(() => {
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
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([v]) => v)
  }, [pendientes])

  const counts = useMemo(() => {
    const c: Record<Prioridad, number> = { nueva: 0, espera: 0, urgente: 0, critica: 0 }
    for (const f of pendientes) c[calcularPrioridad(f.fecha, now).nivel]++
    return c
  }, [pendientes, now])

  // Cuando se abre el detalle, ocupamos toda la pantalla (sin sidebar nav)
  if (selectedFactura) {
    return (
      <TicketDetail
        factura={selectedFactura}
        user={user}
        onBack={() => setSelectedFactura(null)}
        onAlta={() => {
          setSelectedFactura(null)
          reload()
        }}
      />
    )
  }

  const filterCounts = {
    todas: pendientes.length,
    critica: counts.critica,
    hoy: pendientes.filter(f => new Date(f.fecha).toDateString() === new Date().toDateString()).length,
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      {/* ── Page header (Linear-style) ── */}
      <div className="workspace-header" style={{
        padding: '24px 48px 0',
        flexShrink: 0,
      }}>
        {/* Breadcrumb */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          fontSize: 12, color: 'var(--gray-500)', fontWeight: 500, marginBottom: 16,
        }}>
          <span style={{ color: 'var(--gray-500)' }}>Operación</span>
          <ChevronRight size={12} strokeWidth={2} style={{ color: 'var(--gray-400)' }} />
          <span style={{ color: 'var(--gray-700)', fontWeight: 600 }}>Producción</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 24, flexWrap: 'wrap' as const }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <h1 style={{
              fontSize: 30, fontWeight: 700, color: 'var(--gray-900)',
              letterSpacing: '-0.03em', lineHeight: 1.1, margin: 0,
            }}>
              Tickets de Producción
            </h1>
            <p style={{ fontSize: 14, color: 'var(--gray-500)', marginTop: 8, lineHeight: 1.5, maxWidth: 560 }}>
              Las facturas de Alegra aparecen aquí automáticamente. No es necesario crear tickets manualmente.
            </p>
          </div>

          {/* Stat strip in header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 28, paddingTop: 4 }}>
            <HeaderStat label="Pendientes" value={pendientes.length} />
            <Divider />
            <HeaderStat label="Críticas" value={counts.critica} tone={counts.critica > 0 ? 'danger' : 'neutral'} />
            <Divider />
            <HeaderStat label="Hoy" value={filterCounts.hoy} />
            <Divider />
            <HeaderStat label="Completados" value={completados.length} />
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4, marginTop: 26, marginLeft: -4 }}>
          <TabButton active={tab === 'pendientes'} onClick={() => { setTab('pendientes'); setFilter('todas') }}>
            <Inbox size={14} strokeWidth={1.75} /> Pendientes
            <TabCount count={pendientes.length} tone={counts.critica > 0 ? 'danger' : 'neutral'} />
          </TabButton>
          <TabButton active={tab === 'completados'} onClick={() => { setTab('completados'); setFilter('todas') }}>
            <CheckCircle size={14} strokeWidth={1.75} /> Completados
            <TabCount count={completados.length} />
          </TabButton>
        </div>
      </div>

      {/* ── Toolbar (search + filters) ── */}
      <div className="workspace-header" style={{
        padding: '16px 48px',
        flexShrink: 0,
        borderTop: 'none',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' as const }}>
          <div style={{ position: 'relative', flex: '1 1 280px', minWidth: 240, maxWidth: 420 }}>
            <SearchIcon />
            <input
              type="text"
              className="input-base"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar por orden, factura, vehículo o cliente…"
              style={{ paddingLeft: 40, height: 40 }}
            />
          </div>

          {tab === 'pendientes' && (
            <>
              <button className="btn btn-secondary btn-sm" style={{ height: 40, padding: '0 12px' }}>
                <ListFilter size={14} strokeWidth={1.75} /> Filtros
              </button>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' as const, marginLeft: 'auto' }}>
                <FilterChip active={filter === 'todas'} onClick={() => setFilter('todas')}>
                  Todas <TabCount count={filterCounts.todas} />
                </FilterChip>
                {counts.critica > 0 && (
                  <FilterChip active={filter === 'critica'} onClick={() => setFilter('critica')} dot="var(--danger)">
                    Críticas <TabCount count={filterCounts.critica} tone="danger" />
                  </FilterChip>
                )}
                <FilterChip active={filter === 'hoy'} onClick={() => setFilter('hoy')}>
                  Hoy <TabCount count={filterCounts.hoy} />
                </FilterChip>
                {vehicleFilters.map(v => (
                  <FilterChip key={v} active={filter === v} onClick={() => setFilter(v)}>
                    {v} <TabCount count={pendientes.filter(f => (f.vehiculo ?? '').toUpperCase() === v).length} />
                  </FilterChip>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Content ── */}
      <div style={{ flex: 1, padding: '32px 48px 80px', overflowY: 'auto' }}>
        {error && (
          <div style={{
            background: 'var(--red-50)', border: '1px solid var(--red-ring)',
            borderRadius: 'var(--radius-lg)', padding: '12px 16px',
            marginBottom: 20, fontSize: 13.5, color: 'var(--red)',
          }}>
            {error}
          </div>
        )}

        {loading ? (
          <LoadingState message="Cargando tickets…" />
        ) : tab === 'pendientes' ? (
          pendientesFiltrados.length === 0 ? (
            <EmptyState
              icon={Inbox}
              title={search || filter !== 'todas' ? 'No hay tickets que coincidan' : 'No hay tickets pendientes'}
              description={
                search || filter !== 'todas'
                  ? 'Ajusta los filtros o la búsqueda para ver más resultados.'
                  : 'Los tickets aparecerán automáticamente cuando se registren facturas en Alegra.'
              }
            />
          ) : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
              gap: 16,
            }}>
              {pendientesFiltrados.map(f => (
                <PendienteCard
                  key={f.alegra_id}
                  factura={f}
                  now={now}
                  onClick={() => setSelectedFactura(f)}
                />
              ))}
            </div>
          )
        ) : completadosFiltrados.length === 0 ? (
          <EmptyState
            icon={CheckCircle}
            title="Aún no hay tickets completados"
            description="Los tickets que des de alta aparecerán aquí."
          />
        ) : (
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table className="table-dark">
                <thead>
                  <tr>
                    <th>Factura</th>
                    <th>Orden</th>
                    <th>Vehículo</th>
                    <th>A cargo de</th>
                    <th>Fecha entrega</th>
                    <th>Grado</th>
                    <th>Completado por</th>
                    <th>Fecha</th>
                  </tr>
                </thead>
                <tbody>
                  {completadosFiltrados.map(t => (
                    <tr key={t.id} onClick={() => setSelectedCompletado(t)} style={{ cursor: 'pointer' }}>
                      <td style={{ color: 'var(--gray-900)', fontWeight: 600 }}>{t.numero_factura || '—'}</td>
                      <td>{t.talonario ?? '—'}</td>
                      <td style={{
                        color: t.vehiculo ? 'var(--gray-700)' : 'var(--gray-400)',
                        fontStyle: t.vehiculo ? 'normal' : 'italic',
                      }}>
                        {t.vehiculo ?? 'Sin identificar'}
                      </td>
                      <td>{t.a_cargo_de ?? '—'}</td>
                      <td>{t.fecha_entrega ?? '—'}</td>
                      <td>{t.re_trabajo === 'Si' ? (t.grado_reparacion ?? '—') : ''}</td>
                      <td>{t.user_name ?? '—'}</td>
                      <td style={{ fontSize: 12, color: 'var(--gray-500)', whiteSpace: 'nowrap' }}>
                        {new Date(t.created_at).toLocaleDateString('es-DO', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Completed ticket detail modal (read-only) */}
      {selectedCompletado && (
        <div className="modal-overlay" onClick={() => setSelectedCompletado(null)}>
          <div onClick={e => e.stopPropagation()} className="modal-card" style={{
            padding: 32, maxWidth: 600, width: '100%', maxHeight: '80vh', overflowY: 'auto',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <div>
                <div className="eyebrow" style={{ color: 'var(--green)', marginBottom: 8 }}>Completado</div>
                <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--gray-900)', margin: 0, letterSpacing: '-0.01em' }}>
                  Ticket #{selectedCompletado.numero_orden || '—'}
                </h2>
              </div>
              <button
                onClick={() => setSelectedCompletado(null)}
                aria-label="Cerrar"
                style={{ background: 'transparent', border: 'none', color: 'var(--gray-500)', cursor: 'pointer', padding: 4 }}
              >
                <ArrowUpDown size={16} />
              </button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
              <DetailItem label="Factura" value={selectedCompletado.numero_factura} />
              <DetailItem label="Cliente" value={selectedCompletado.cliente ?? '—'} />
              <DetailItem label="Vehículo" value={selectedCompletado.vehiculo ?? selectedCompletado.modelo ?? '—'} />
              <DetailItem label="A cargo de" value={selectedCompletado.a_cargo_de ?? '—'} />
              <DetailItem label="Re-trabajo" value={selectedCompletado.re_trabajo ?? 'No'} />
              {selectedCompletado.grado_reparacion && (
                <DetailItem label="Grado" value={selectedCompletado.grado_reparacion} />
              )}
              <DetailItem label="Fecha compromiso" value={selectedCompletado.fecha_compromiso ?? '—'} />
              <DetailItem label="Fecha entrega" value={selectedCompletado.fecha_entrega ?? '—'} />
              {selectedCompletado.piezas && selectedCompletado.piezas.length > 0 && (
                <div style={{ gridColumn: '1 / -1' }}>
                  <DetailItem label="Piezas" value={selectedCompletado.piezas.join(', ')} />
                </div>
              )}
              {selectedCompletado.piezas_custom && (
                <div style={{ gridColumn: '1 / -1' }}>
                  <DetailItem label="Otras piezas" value={selectedCompletado.piezas_custom} />
                </div>
              )}
              {selectedCompletado.productos && selectedCompletado.productos.length > 0 && (
                <div style={{ gridColumn: '1 / -1' }}>
                  <div className="eyebrow" style={{ marginBottom: 8 }}>Productos de la factura</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {selectedCompletado.productos.map((p, i) => (
                      <div key={i} style={{
                        display: 'flex', justifyContent: 'space-between', gap: 12,
                        fontSize: 13.5, color: 'var(--gray-800)',
                        borderBottom: '1px solid var(--border-subtle)', paddingBottom: 6,
                      }}>
                        <span style={{ fontWeight: 500 }}>
                          {p.nombre ?? '—'}
                          {p.descripcion ? <span style={{ color: 'var(--gray-500)', fontWeight: 400 }}> · {p.descripcion}</span> : null}
                        </span>
                        <span style={{ color: 'var(--gray-500)', flexShrink: 0 }}>×{p.cantidad ?? 0}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div style={{ gridColumn: '1 / -1' }}>
                <DetailItem label="Completado" value={new Date(selectedCompletado.created_at).toLocaleDateString('es-DO', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })} />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────

function TabButton({ active, onClick, children }: {
  active: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        padding: '12px 4px',
        marginRight: 24,
        background: 'transparent',
        border: 'none',
        borderBottom: active ? '2px solid var(--red)' : '2px solid transparent',
        cursor: 'pointer',
        fontSize: 14,
        fontWeight: 600,
        color: active ? 'var(--gray-900)' : 'var(--gray-500)',
        letterSpacing: '-0.005em',
        transition: 'all var(--t-fast)',
        marginBottom: -1,
      }}
    >
      {children}
    </button>
  )
}

function TabCount({ count, tone = 'neutral' }: { count: number; tone?: 'neutral' | 'danger' }) {
  return (
    <span style={{
      fontSize: 11.5,
      fontWeight: 600,
      color: tone === 'danger' ? 'var(--red)' : 'var(--gray-500)',
      background: tone === 'danger' ? 'var(--red-50)' : 'var(--gray-100)',
      padding: '1px 8px',
      borderRadius: 9999,
      minWidth: 22,
      textAlign: 'center' as const,
    }}>
      {count}
    </span>
  )
}

function HeaderStat({ label, value, tone = 'neutral' }: { label: string; value: number; tone?: 'neutral' | 'danger' }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
      <span style={{ fontSize: 10, color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>
        {label}
      </span>
      <span style={{
        fontSize: 22, fontWeight: 700, lineHeight: 1,
        color: tone === 'danger' && value > 0 ? 'var(--red)' : 'var(--gray-900)',
        letterSpacing: '-0.02em',
      }}>
        {value}
      </span>
    </div>
  )
}

function Divider() {
  return <div style={{ width: 1, height: 32, background: 'var(--border)' }} />
}

function FilterChip({ active, onClick, children, dot }: {
  active: boolean
  onClick: () => void
  children: ReactNode
  dot?: string
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        height: 32, padding: '0 12px',
        fontSize: 12.5, fontWeight: 600,
        background: active ? 'var(--bg-card)' : 'transparent',
        color: active ? 'var(--gray-900)' : 'var(--gray-500)',
        border: '1px solid ' + (active ? 'var(--border-strong)' : 'var(--border)'),
        borderRadius: 'var(--radius-pill)',
        cursor: 'pointer',
        transition: 'all var(--t-fast)',
      }}
    >
      {dot && (
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: dot, flexShrink: 0 }} />
      )}
      {children}
    </button>
  )
}

function LoadingState({ message }: { message: string }) {
  return (
    <div style={{
      padding: '80px 24px', textAlign: 'center', color: 'var(--gray-500)', fontSize: 13.5,
    }}>
      <div style={{
        display: 'inline-block', width: 24, height: 24,
        border: '2.5px solid var(--gray-200)', borderTopColor: 'var(--red)',
        borderRadius: '50%', animation: 'spin 0.7s linear infinite', marginBottom: 12,
      }} />
      <div>{message}</div>
    </div>
  )
}

function EmptyState({ icon: Icon, title, description }: {
  icon: React.ComponentType<{ size?: number; strokeWidth?: number; style?: React.CSSProperties }>
  title: string
  description: string
}) {
  return (
    <div style={{
      padding: '80px 24px', textAlign: 'center', maxWidth: 380, margin: '0 auto',
    }}>
      <div style={{
        width: 56, height: 56, borderRadius: 'var(--radius-lg)',
        background: 'var(--red-50)', color: 'var(--red)',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 18,
      }}>
        <Icon size={22} strokeWidth={1.6} />
      </div>
      <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--gray-900)', margin: 0, letterSpacing: '-0.01em' }}>
        {title}
      </h3>
      <p style={{ fontSize: 13.5, color: 'var(--gray-500)', marginTop: 8, lineHeight: 1.5 }}>
        {description}
      </p>
    </div>
  )
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="eyebrow" style={{ marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 14, color: 'var(--gray-900)', fontWeight: 500, wordBreak: 'break-word' as const }}>
        {value}
      </div>
    </div>
  )
}

function SearchIcon() {
  return (
    <svg
      width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
      style={{
        position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)',
        color: 'var(--gray-400)', pointerEvents: 'none',
      }}
    >
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  )
}
