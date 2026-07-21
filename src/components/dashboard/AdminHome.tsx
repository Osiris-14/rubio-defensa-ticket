'use client'
import { useEffect, useState, useMemo } from 'react'
import {
  Calendar, AlertCircle, TrendingUp, Package, Wallet, AlertTriangle,
  Download, type LucideIcon,
} from 'lucide-react'
import { AREA_THEME } from '@/lib/areaTheme'
import { type AppUser, type UserRole, ROLE_LABELS, ROLE_COLORS, getTickets, ticketsToCSV } from '@/lib/store'
import {
  fetchProductionKpis, fetchCapacityDashboard, fetchAreaCapacities,
  PRODUCTION_STEPS, STEP_LABELS, occupancyLevel,
  type ProductionKpis, type CapacityDashboard, type AreaCapacity,
} from '@/lib/production-v2'
import QuickActions, { type DashboardView } from './QuickActions'
import MiniCalendarWidget from './MiniCalendarWidget'
import AttentionWidget from './AttentionWidget'

interface Props {
  user: AppUser
  onNavigate: (view: DashboardView) => void
  canExport?: boolean
}

type AreaDatum = { role: UserRole; tickets: Record<string, unknown>[]; total: number; today: number; retrabajos: number }
const AREA_ROLES: UserRole[] = ['recepcion', 'produccion', 'pintura', 'instalacion', 'marquilla', 'ferre']

export default function AdminHome ({ user, onNavigate, canExport = true }: Props) {
  const [allTickets, setAllTickets] = useState<Record<string, unknown>[]>([])
  const [totalStats, setTotalStats] = useState({ total: 0, today: 0, week: 0, month: 0, retrabajos: 0 })
  const [areaData, setAreaData] = useState<AreaDatum[]>([])
  const [prodKpis, setProdKpis] = useState<ProductionKpis | null>(null)
  const [capKpis, setCapKpis] = useState<CapacityDashboard | null>(null)
  const [areaCaps, setAreaCaps] = useState<AreaCapacity[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  useEffect(() => {
    let active = true
    async function load () {
      setLoading(true)
      try {
        const perArea = await Promise.all(AREA_ROLES.map(role => getTickets(role)))
        if (!active) return
        const now = new Date()
        const today = now.toDateString()
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

        const data: AreaDatum[] = AREA_ROLES.map((role, i) => {
          const tickets = perArea[i]
          return {
            role,
            tickets,
            total: tickets.length,
            today: tickets.filter(t => new Date(t.created_at as string).toDateString() === today).length,
            retrabajos: tickets.filter(t => t.re_trabajo === 'Si').length,
          }
        })
        const combined = data
          .flatMap(d => d.tickets)
          .sort((a, b) => new Date(b.created_at as string).getTime() - new Date(a.created_at as string).getTime())

        setAreaData(data)
        setAllTickets(combined)
        setTotalStats({
          total: combined.length,
          today: combined.filter(t => new Date(t.created_at as string).toDateString() === today).length,
          week: combined.filter(t => new Date(t.created_at as string) >= weekAgo).length,
          month: combined.filter(t => new Date(t.created_at as string) >= monthAgo).length,
          retrabajos: combined.filter(t => t.re_trabajo === 'Si').length,
        })
        setError('')
      } catch (err) {
        if (active) setError((err as Error).message)
      } finally {
        if (active) setLoading(false)
      }
    }
    load().finally(() => {
      if (active) setLastUpdated(new Date())
    })
    // Carga de datos de producción y capacidad (no rompen el dashboard si fallan)
    Promise.allSettled([
      fetchProductionKpis(),
      fetchCapacityDashboard(),
      fetchAreaCapacities(),
    ]).then(([k, c, ac]) => {
      if (!active) return
      if (k.status === 'fulfilled') setProdKpis(k.value)
      if (c.status === 'fulfilled') setCapKpis(c.value)
      if (ac.status === 'fulfilled') setAreaCaps(ac.value)
    })
    return () => { active = false }
  }, [reloadKey])

  function refresh () { setReloadKey(k => k + 1) }

  async function exportCSV () {
    try {
      const csv = await ticketsToCSV('admin')
      if (!csv) { alert('No hay tickets para exportar.'); return }
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `rubio_all_${new Date().toISOString().split('T')[0]}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      alert('Error al exportar: ' + (err as Error).message)
    }
  }

  // Ocupación por área (hoy)
  const areaOccupancy = useMemo(() => PRODUCTION_STEPS.map(step => {
    const cap = areaCaps.find(c => c.step === step)?.daily_capacity ?? 10
    return { step, cap }
  }), [areaCaps])

  const greeting = useMemo(() => {
    const h = new Date().getHours()
    if (h < 12) return 'Buenos días'
    if (h < 18) return 'Buenas tardes'
    return 'Buenas noches'
  }, [])

  const todayLong = useMemo(() =>
    new Date().toLocaleDateString('es-DO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  , [])

  return (
    <div style={{ animation: 'fadeInUp 0.3s ease', padding: '32px 48px 80px' }}>
      {/* Header con saludo */}
      <div style={{ marginBottom: 24 }}>
        <div className='eyebrow' style={{ color: 'var(--red)', marginBottom: 6 }}>Resumen</div>
        <h1 style={{ fontSize: 28, fontWeight: 700, color: 'var(--gray-900)', letterSpacing: '-0.025em', margin: 0, textTransform: 'capitalize' }}>
          {greeting}, {user.name.split(' ')[0]}
        </h1>
        <p style={{ fontSize: 14, color: 'var(--gray-500)', marginTop: 6, textTransform: 'capitalize' }}>
          {todayLong}
        </p>
      </div>

      {error && (
        <div style={{
          background: 'var(--red-50)', border: '1px solid var(--red-ring)',
          borderRadius: 'var(--radius-lg)', padding: '12px 16px', marginBottom: 20, fontSize: 13.5, color: 'var(--red)',
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <AlertCircle size={16} /> {error}
        </div>
      )}

      <QuickActions
        onNavigate={onNavigate}
        onRefresh={refresh}
        onExport={exportCSV}
        lastUpdated={lastUpdated}
        canExport={canExport}
      />

      {/* KPIs principales */}
      <h2 style={sectionTitleStyle}>Indicadores del mes</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14, marginBottom: 32 }}>
        <KpiCard
          label='Tickets del mes'
          value={String(totalStats.month)}
          icon={Calendar}
          tone='blue'
          onClick={() => onNavigate('tickets')}
        />
        <KpiCard
          label='Costo producción mes'
          value={prodKpis ? formatProdMoney(prodKpis.costo_mes) : '—'}
          icon={Wallet}
          tone='green'
          onClick={() => onNavigate('produccion')}
        />
        <KpiCard
          label='Capacidad usada hoy'
          value={capKpis ? `${capKpis.tickets_hoy} / ${capKpis.cap_hoy}` : '—'}
          icon={TrendingUp}
          tone={capKpis && capKpis.cap_hoy > 0 && capKpis.tickets_hoy / capKpis.cap_hoy > 0.8 ? 'red' : 'amber'}
          onClick={() => onNavigate('capacidad')}
        />
        <KpiCard
          label='Tickets retrasados'
          value={capKpis ? String(capKpis.retrasados) : String(totalStats.retrabajos)}
          icon={AlertTriangle}
          tone={(capKpis?.retrasados ?? 0) > 0 || totalStats.retrabajos > 0 ? 'red' : 'green'}
          onClick={() => onNavigate('capacidad')}
        />
      </div>

      {/* Sección Producción + Capacity widgets lado a lado */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 32 }}>
        {prodKpis && (
          <div className='card' style={{ padding: 20, borderTop: '2px solid var(--green)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{
                  width: 30, height: 30, borderRadius: 'var(--radius)',
                  background: 'var(--green-bg)', color: 'var(--green)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Package size={14} />
                </div>
                <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--gray-900)', margin: 0 }}>Producción</h3>
              </div>
              <button onClick={() => onNavigate('produccion')} className='btn btn-ghost btn-sm' style={{ fontSize: 11.5 }}>
                Ver más →
              </button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <MiniMetric label='Órdenes' value={String(prodKpis.ordenes)} />
              <MiniMetric label='Pendientes' value={String(prodKpis.tickets_pendientes)} tone={prodKpis.tickets_pendientes > 0 ? 'amber' : 'green'} />
              <MiniMetric label='Completados' value={String(prodKpis.tickets_completados)} tone='green' />
              <MiniMetric label='Costo hoy' value={formatProdMoney(prodKpis.costo_hoy)} />
            </div>
          </div>
        )}

        <AttentionWidget onOpenCapacidad={() => onNavigate('capacidad')} />
      </div>

      {/* Mini calendario + capacidad por área */}
      <h2 style={sectionTitleStyle}>Planificación</h2>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 32 }}>
        <MiniCalendarWidget onOpenCalendar={() => onNavigate('calendario')} />

        <div className='card' style={{ padding: 20, display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{
                width: 28, height: 28, borderRadius: 'var(--radius)',
                background: 'var(--amber-bg)', color: 'var(--amber)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <TrendingUp size={14} />
              </div>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--gray-900)', margin: 0 }}>Capacidad por área</h3>
            </div>
            <button onClick={() => onNavigate('capacidad')} className='btn btn-ghost btn-sm' style={{ fontSize: 11.5 }}>
              Configurar →
            </button>
          </div>

          {areaCaps.length === 0 ? (
            <div style={{ color: 'var(--gray-400)', fontSize: 12, padding: '24px 0', textAlign: 'center' }}>
              Carga capacidades para ver la ocupación.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {areaOccupancy.map(a => {
                const occ = occupancyLevel(0, a.cap)
                const toneColor = 'var(--gray-300)'
                return (
                  <div key={a.step} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--gray-900)' }}>{STEP_LABELS[a.step]}</span>
                        <span style={{ fontSize: 11, color: 'var(--gray-500)', fontWeight: 600 }}>{a.cap}/día</span>
                      </div>
                      <div style={{ width: '100%', height: 6, borderRadius: 3, background: 'var(--gray-100)', overflow: 'hidden' }}>
                        <div style={{ width: `${occ.pct}%`, height: '100%', background: toneColor, transition: 'width 0.3s' }} />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          <div style={{ marginTop: 12, fontSize: 11, color: 'var(--gray-500)', paddingTop: 12, borderTop: '1px solid var(--border-subtle)' }}>
            Capacidad configurada. Click en &quot;Configurar&quot; para ajustarla.
          </div>
        </div>
      </div>

      {/* Resumen por área (compacto) + Tickets recientes */}
      <h2 style={sectionTitleStyle}>Operación</h2>
      <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1fr', gap: 16, marginBottom: 32 }}>
        <div className='card' style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--gray-900)', margin: 0 }}>Resumen por área</h3>
            <span style={{ fontSize: 11, color: 'var(--gray-500)' }}>{areaData.length} áreas</span>
          </div>
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--gray-500)', fontSize: 12.5 }}>Cargando…</div>
          ) : (
            <div>
              {areaData.map(({ role, total, today, retrabajos }, index) => {
                const t = AREA_THEME[role]
                const Icon = t.icon
                return (
                  <div key={role} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '12px 18px', borderBottom: index < areaData.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-card-hover)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{
                        width: 30, height: 30, borderRadius: 'var(--radius)',
                        background: t.bg, color: t.text,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <Icon size={13} />
                      </div>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--gray-900)', lineHeight: 1.2 }}>{ROLE_LABELS[role]}</div>
                        <div style={{ fontSize: 10.5, color: 'var(--gray-500)', marginTop: 2 }}>
                          {today} hoy · {retrabajos > 0 && <span style={{ color: 'var(--amber)', fontWeight: 600 }}>{retrabajos} re-trabajos</span>}
                          {retrabajos === 0 && 'sin re-trabajos'}
                        </div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                      <span style={{ fontSize: 20, fontWeight: 700, color: 'var(--gray-900)', letterSpacing: '-0.02em' }}>{total}</span>
                      <span style={{ fontSize: 10, color: 'var(--gray-500)', fontWeight: 600 }}>tickets</span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div className='card' style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--gray-900)', margin: 0 }}>Tickets recientes</h3>
            <button onClick={() => onNavigate('tickets')} className='btn btn-ghost btn-sm' style={{ fontSize: 11.5 }}>
              Ver todos →
            </button>
          </div>
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--gray-500)', fontSize: 12.5 }}>Cargando…</div>
          ) : allTickets.length === 0 ? (
            <div style={{ padding: 32, textAlign: 'center', color: 'var(--gray-400)', fontSize: 12.5 }}>
              No hay tickets registrados aún.
            </div>
          ) : (
            <div>
              {allTickets.slice(0, 6).map((t, i) => {
                const role = t.role as UserRole
                const color = ROLE_COLORS[role] || '#888'
                return (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '10px 18px', borderBottom: i < 5 ? '1px solid var(--border-subtle)' : 'none',
                    fontSize: 12, gap: 10,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: 1 }}>
                      <span style={{
                        flexShrink: 0, fontSize: 9.5, fontWeight: 700, padding: '2px 7px', borderRadius: 9999,
                        background: `${color}12`, color, border: `1px solid ${color}33`,
                        textTransform: 'uppercase', letterSpacing: '0.04em',
                      }}>{ROLE_LABELS[role]?.split(' ')[0] || role}</span>
                      <span style={{ fontWeight: 600, color: 'var(--gray-900)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {String(t.numero_orden || t.numero_factura || '—')}
                      </span>
                    </div>
                    <span style={{ fontSize: 10.5, color: 'var(--gray-500)', flexShrink: 0 }}>
                      {new Date(t.created_at as string).toLocaleDateString('es-DO', { day: '2-digit', month: '2-digit' })}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Acciones de export — solo admin */}
      {canExport && (
        <>
          <h2 style={sectionTitleStyle}>Exportar</h2>
          <div className='card' style={{ padding: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
              <div>
                <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--gray-900)', margin: 0, marginBottom: 4 }}>Descarga de datos</h3>
            <p style={{ fontSize: 12, color: 'var(--gray-500)', margin: 0 }}>
              Exporta todos los tickets o filtra por área para análisis externo.
            </p>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <button onClick={exportCSV} style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '9px 14px', borderRadius: 'var(--radius)', border: 'none',
              background: 'var(--red)', color: '#fff', fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
              boxShadow: 'var(--shadow-sm)',
            }}>
              <Download size={13} /> Todos los tickets
            </button>
            {AREA_ROLES.map(role => {
              const t = AREA_THEME[role]
              return (
                <button key={role} onClick={async () => {
                  try {
                    const csv = await ticketsToCSV(role)
                    if (!csv) { alert('No hay tickets en ' + ROLE_LABELS[role]); return }
                    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
                    const url = URL.createObjectURL(blob)
                    const a = document.createElement('a')
                    a.href = url
                    a.download = `rubio_${role}_${new Date().toISOString().split('T')[0]}.csv`
                    a.click()
                    URL.revokeObjectURL(url)
                  } catch (e) { alert('Error: ' + (e as Error).message) }
                }} style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '9px 14px', borderRadius: 'var(--radius)',
                  border: `1px solid ${t.borderTop}33`, background: 'var(--bg-card)', color: t.text,
                  fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
                }}>
                  <Download size={12} /> {ROLE_LABELS[role]}
                </button>
              )
            })}
          </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

const sectionTitleStyle: React.CSSProperties = {
  fontSize: 11, fontWeight: 700,
  marginBottom: 14, letterSpacing: '0.06em',
  textTransform: 'uppercase', color: 'var(--gray-500)',
}

function KpiCard ({ label, value, icon: Icon, tone = 'green', onClick }: {
  label: string
  value: string
  icon: LucideIcon
  tone?: 'red' | 'amber' | 'green' | 'blue'
  onClick?: () => void
}) {
  const toneColor = { red: 'var(--red)', amber: 'var(--amber)', green: 'var(--green)', blue: 'var(--blue)' }[tone]
  const toneBg = { red: 'var(--red-50)', amber: 'var(--amber-bg)', green: 'var(--green-bg)', blue: 'var(--blue-bg)' }[tone]
  return (
    <div
      onClick={onClick}
      className='kpi'
      style={{
        borderTop: `2px solid ${toneColor}`,
        cursor: onClick ? 'pointer' : 'default',
        transition: 'all 0.15s',
      }}
      onMouseEnter={e => { if (onClick) e.currentTarget.style.transform = 'translateY(-2px)' }}
      onMouseLeave={e => { if (onClick) e.currentTarget.style.transform = 'translateY(0)' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ fontSize: 11, color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>{label}</div>
        <div style={{
          width: 30, height: 30, borderRadius: 'var(--radius)',
          background: toneBg, color: toneColor,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon size={13} />
        </div>
      </div>
      <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--gray-900)', lineHeight: 1, letterSpacing: '-0.02em' }}>{value}</div>
    </div>
  )
}

function MiniMetric ({ label, value, tone = 'gray' }: {
  label: string
  value: string
  tone?: 'red' | 'amber' | 'green' | 'gray'
}) {
  const color = tone === 'red' ? 'var(--red)' : tone === 'amber' ? 'var(--amber)' : tone === 'green' ? 'var(--green)' : 'var(--gray-900)'
  return (
    <div>
      <div style={{ fontSize: 10.5, color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 700, color, lineHeight: 1, letterSpacing: '-0.01em' }}>{value}</div>
    </div>
  )
}

function formatProdMoney (n: number): string {
  return 'RD$ ' + n.toLocaleString('es-DO', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}
