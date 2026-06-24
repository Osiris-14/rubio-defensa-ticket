'use client'
import { useState, useEffect } from 'react'
import { type AppUser, type UserRole, ROLE_LABELS, ROLE_COLORS, getStatsForRole, getTickets, ticketsToCSV } from '@/lib/store'
import { supabase } from '@/lib/supabase'
import { AREA_THEME } from '@/lib/areaTheme'
import { ArrowLeft, ArrowRight, Download, RefreshCw, Calendar, ChartColumn as BarChart3 } from 'lucide-react'
import Topbar from './Topbar'
import TicketRow from './TicketRow'
import FormRecepcion from './forms/FormRecepcion'
import FormProduccion from './forms/FormProduccion'
import FormPintura from './forms/FormPintura'
import FormInstalacion from './forms/FormInstalacion'
import FormMarquilla from './forms/FormMarquilla'
import TicketsList from './TicketsList'

interface Props { user: AppUser; onLogout: () => void }

type View = 'dashboard' | 'form' | 'tickets'

const AREA_ROLES: UserRole[] = ['recepcion', 'produccion', 'pintura', 'instalacion', 'marquilla']

const AREA_DESCRIPTIONS: Record<string, string> = {
  recepcion: 'Registro de ingreso de vehiculos al taller',
  produccion: 'Ordenes de fabricacion de piezas',
  pintura: 'Control de pintado de defensas',
  instalacion: 'Registro de instalacion de defensas',
  marquilla: 'Pago y monitoreo de piezas',
}

async function downloadCSV(role: UserRole | 'all') {
  let csv: string
  try {
    csv = await ticketsToCSV(role === 'all' ? 'admin' : role)
  } catch (err) {
    alert('Error al exportar: ' + (err as Error).message)
    return
  }
  if (!csv) { alert('No hay tickets para exportar en esta area.'); return }
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `rubio_${role}_${new Date().toISOString().split('T')[0]}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

// Subscribe to INSERTs on the given area tables; calls onInsert on each new row.
// Returns a cleanup function that removes the channel.
function subscribeToInserts(roles: UserRole[], onInsert: () => void): () => void {
  const channel = supabase.channel(`rt-${roles.join('-')}-${Math.random().toString(36).slice(2)}`)
  for (const r of roles) {
    channel.on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: `tickets_${r}` },
      () => onInsert()
    )
  }
  channel.subscribe()
  return () => { supabase.removeChannel(channel) }
}

export default function Dashboard({ user, onLogout }: Props) {
  const [view, setView] = useState<View>('dashboard')

  const roleColor = ROLE_COLORS[user.role]
  const isAdmin = user.role === 'admin'

  const navItems: { id: View; label: string }[] = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'form', label: 'Nuevo Ticket' },
    { id: 'tickets', label: isAdmin ? 'Todos los Tickets' : 'Mis Tickets' },
  ]

  return (
    <div className="app-layout">
      {/* Mobile header — hidden on desktop */}
      <div className="mobile-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{
            width: '28px', height: '28px',
            background: '#E8180A',
            borderRadius: '4px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{ fontFamily: 'Bebas Neue', fontSize: '13px', color: 'white' }}>R</span>
          </div>
          <div style={{ fontFamily: 'Bebas Neue', fontSize: '15px', color: '#111111', letterSpacing: '1px', lineHeight: 1 }}>EL RUBIO DEFENSA</div>
        </div>
        <div style={{
          width: '32px', height: '32px',
          background: '#E8180A', borderRadius: '50%',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          <span style={{ fontFamily: 'Bebas Neue', fontSize: '14px', color: 'white' }}>
            {user.name.charAt(0).toUpperCase()}
          </span>
        </div>
      </div>

      {/* Sidebar */}
      <div className="sidebar-wrapper">
        <div style={{
          width: '240px', background: '#FFFFFF', borderRight: '1px solid #E5E5E5',
          display: 'flex', flexDirection: 'column', position: 'fixed',
          top: 0, left: 0, bottom: 0, zIndex: 50,
        }}>
          {/* Logo */}
          <div style={{ padding: '24px 20px', borderBottom: '1px solid #E5E5E5' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{
                width: '36px', height: '36px', background: '#E8180A',
                borderRadius: '6px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <span style={{ fontFamily: 'Bebas Neue', fontSize: '16px', color: 'white' }}>R</span>
              </div>
              <div>
                <div style={{ fontFamily: 'Bebas Neue', fontSize: '16px', color: '#111111', letterSpacing: '1px', lineHeight: 1 }}>EL RUBIO</div>
                <div style={{ fontFamily: 'Bebas Neue', fontSize: '9px', color: '#E8180A', letterSpacing: '3px', lineHeight: 1 }}>DEFENSA TICKET</div>
              </div>
            </div>
          </div>

          {/* User info */}
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #E5E5E5' }}>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: '6px',
              background: `${roleColor}12`, border: `1px solid ${roleColor}44`,
              borderRadius: '20px', padding: '4px 10px', marginBottom: '8px',
            }}>
              <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: roleColor }} />
              <span style={{ fontSize: '10px', fontWeight: 700, color: roleColor, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                {ROLE_LABELS[user.role]}
              </span>
            </div>
            <div style={{ fontWeight: 700, fontSize: '14px', color: '#111111' }}>{user.name}</div>
          </div>

          {/* Navigation */}
          <nav style={{ padding: '16px 12px', flex: 1 }}>
            <div style={{ marginBottom: '4px', padding: '0 4px', fontSize: '10px', color: '#BBBBBB', textTransform: 'uppercase', letterSpacing: '1px', marginTop: '8px' }}>Menu</div>
            {navItems.map(item => (
              <div key={item.id} className={`nav-item ${view === item.id ? 'active' : ''}`} onClick={() => setView(item.id)}>
                {item.label}
              </div>
            ))}
          </nav>

          {/* Logout */}
          <div style={{ padding: '16px', borderTop: '1px solid #E5E5E5' }}>
            <button onClick={onLogout} style={{
              width: '100%', padding: '10px',
              background: 'transparent', border: '1px solid #E5E5E5',
              borderRadius: '6px', color: '#999999', cursor: 'pointer',
              fontFamily: 'Rajdhani', fontSize: '13px', fontWeight: 600,
              textTransform: 'uppercase', letterSpacing: '0.5px',
            }}>
              &larr; Cerrar Sesion
            </button>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="main-content-wrapper" style={{ flex: 1, minWidth: 0, padding: '32px', overflowY: 'auto' }}>
        <div style={{ width: '100%', maxWidth: 'none', padding: 0 }}>
          {view === 'dashboard' && (
            isAdmin
              ? <AdminDashboardView user={user} onLogout={onLogout} />
              : <DashboardView user={user} onLogout={onLogout} onNavigateForm={() => setView('form')} />
          )}
          {view === 'form' && (
            <FormView user={user} onSubmitSuccess={() => setView('tickets')} />
          )}
          {view === 'tickets' && <TicketsList user={user} />}
        </div>
      </div>

      {/* Bottom nav — mobile only */}
      <nav className="bottom-nav">
        {navItems.map(item => (
          <button key={item.id} className={`bottom-nav-btn ${view === item.id ? 'active' : ''}`} onClick={() => setView(item.id)}>
            <span className="bottom-nav-btn-sym">{item.id === 'dashboard' ? '[D]' : item.id === 'form' ? '+' : '='}</span>
            <span>{item.id === 'tickets' ? 'Tickets' : item.id === 'form' ? 'Nuevo' : 'Inicio'}</span>
          </button>
        ))}
      </nav>
    </div>
  )
}

/* ── Shared bits ─────────────────────────────────────────── */
const bigNum = { fontFamily: 'Bebas Neue', fontSize: '32px', color: '#111111', lineHeight: 1 } as const
const exportBtnBase = {
  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
  padding: '13px 16px', borderRadius: '8px', border: 'none', cursor: 'pointer',
  fontFamily: 'Rajdhani', fontSize: '13px', fontWeight: 700,
  textTransform: 'uppercase', letterSpacing: '0.5px',
} as const

function ErrorBanner({ message }: { message: string }) {
  return (
    <div style={{
      background: '#FFF0EF', border: '1px solid rgba(232,24,10,0.25)', borderRadius: '8px',
      padding: '12px 16px', marginBottom: '20px', fontSize: '13px', color: '#E8180A',
    }}>
      No se pudieron cargar los datos: {message}
    </div>
  )
}

function LoadingBlock() {
  return (
    <div style={{ padding: '48px 24px', textAlign: 'center', background: '#F7F7F7', borderRadius: '10px', color: '#999999', fontSize: '13px' }}>
      Cargando…
    </div>
  )
}

function StatLabel({ text }: { text: string }) {
  return (
    <div style={{ fontSize: '11px', color: '#999999', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px', fontFamily: 'Rajdhani', fontWeight: 700 }}>
      {text}
    </div>
  )
}

type AreaDatum = { role: UserRole; tickets: Record<string, unknown>[]; total: number; today: number; retrabajos: number }

function AreaBreakdown({ data, getValue }: { data: AreaDatum[]; getValue: (d: AreaDatum) => number }) {
  const total = data.reduce((s, d) => s + getValue(d), 0)
  return (
    <div style={{ marginTop: '14px' }}>
      <div style={{ display: 'flex', height: '5px', borderRadius: '3px', overflow: 'hidden', marginBottom: '10px', background: '#ececec' }}>
        {data.map(d => {
          const w = total > 0 ? (getValue(d) / total) * 100 : 0
          return w > 0 ? <div key={d.role} style={{ width: `${w}%`, background: AREA_THEME[d.role].borderTop }} /> : null
        })}
      </div>
      <div>
        {data.map(d => (
          <div key={d.role} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '3.5px 0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: AREA_THEME[d.role].borderTop }} />
              <span style={{ fontSize: '12px', color: '#888888' }}>{ROLE_LABELS[d.role]}</span>
            </div>
            <span style={{ fontSize: '12px', fontWeight: 500, color: '#555555' }}>{getValue(d)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ── Regular (non-admin) dashboard ──────────────────────── */
function DashboardView({ user, onLogout, onNavigateForm }: {
  user: AppUser
  onLogout: () => void
  onNavigateForm: () => void
}) {
  const theme = AREA_THEME[user.role]
  const AreaIcon = theme.icon

  const [stats, setStats] = useState({ total: 0, today: 0, week: 0, month: 0, retrabajos: 0 })
  const [tickets, setTickets] = useState<Record<string, unknown>[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    async function load() {
      try {
        const [s, t] = await Promise.all([getStatsForRole(user.role), getTickets(user.role)])
        if (!active) return
        setStats(s)
        setTickets(t)
        setError('')
      } catch (err) {
        if (active) setError((err as Error).message)
      } finally {
        if (active) setLoading(false)
      }
    }
    load()
    // Live updates: refetch whenever a ticket is inserted in this area.
    const unsubscribe = subscribeToInserts([user.role], load)
    return () => { active = false; unsubscribe() }
  }, [user.role])

  const statCards = [
    { label: 'HOY', value: stats.today, Icon: Calendar },
    { label: 'SEMANA', value: stats.week, Icon: BarChart3 },
    { label: 'MES', value: stats.month, Icon: BarChart3 },
    { label: 'TOTAL', value: stats.total, Icon: BarChart3 },
    { label: 'RE-TRABAJOS', value: stats.retrabajos, Icon: RefreshCw },
  ]

  return (
    <div style={{ animation: 'fadeInUp 0.4s ease' }}>
      <Topbar user={user} onLogout={onLogout} circleBg={theme.bg} circleBorder={theme.text} circleText={theme.text} />

      {error && <ErrorBanner message={error} />}

      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '16px', marginBottom: '32px' }}>
        {statCards.map(({ label, value, Icon }) => (
          <div key={label} style={{ background: '#F7F7F7', borderRadius: '10px', padding: '20px 22px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
              <Icon size={13} style={{ color: theme.text }} />
              <span style={{ fontSize: '11px', color: '#999999', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 700, fontFamily: 'Rajdhani' }}>{label}</span>
            </div>
            <div style={{ fontFamily: 'Bebas Neue', fontSize: '32px', color: '#111111', lineHeight: 1 }}>{value}</div>
          </div>
        ))}
      </div>

      <h2 style={{ fontFamily: 'Bebas Neue', fontSize: '14px', letterSpacing: '1px', marginBottom: '16px', color: '#111111' }}>TICKETS RECIENTES</h2>
      {loading ? (
        <LoadingBlock />
      ) : tickets.length === 0 ? (
        <div style={{ padding: '48px 24px', textAlign: 'center', background: '#F7F7F7', borderRadius: '10px' }}>
          <div style={{
            width: '40px', height: '40px', borderRadius: '50%',
            background: theme.bg, color: theme.text,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: '14px',
          }}>
            <AreaIcon size={20} />
          </div>
          <p style={{ color: '#999999', fontSize: '13px', marginBottom: '16px' }}>No hay tickets aun. Crea el primero.</p>
          <button onClick={onNavigateForm} style={{
            background: theme.text, color: '#FFFFFF', border: 'none', borderRadius: '7px',
            padding: '10px 18px', cursor: 'pointer', fontFamily: 'Rajdhani', fontWeight: 700, fontSize: '13px',
          }}>
            + Crear primer ticket
          </button>
        </div>
      ) : (
        <div>
          {tickets.slice(0, 8).map((t, i) => <TicketRow key={i} ticket={t} role={user.role} />)}
        </div>
      )}
    </div>
  )
}

/* ── Admin dashboard ─────────────────────────────────────── */
function AdminDashboardView({ user, onLogout }: { user: AppUser; onLogout: () => void }) {
  const [allTickets, setAllTickets] = useState<Record<string, unknown>[]>([])
  const [totalStats, setTotalStats] = useState({ total: 0, today: 0, week: 0, month: 0, retrabajos: 0 })
  const [areaData, setAreaData] = useState<AreaDatum[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    async function load() {
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
    load()
    // Admin sees every area, so subscribe to all five tables.
    const unsubscribe = subscribeToInserts(AREA_ROLES, load)
    return () => { active = false; unsubscribe() }
  }, [])

  const topRework = areaData.length
    ? areaData.reduce((a, b) => (b.retrabajos > a.retrabajos ? b : a), areaData[0])
    : null

  return (
    <div style={{ animation: 'fadeInUp 0.4s ease' }}>
      <Topbar user={user} onLogout={onLogout} circleBg="#FFF0EF" circleBorder="#FFCAC7" circleText="#E8180A" />

      {error && <ErrorBanner message={error} />}

      {/* Top 3 global stats with area breakdown */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px', marginBottom: '32px' }}>
        <div className="stat-card">
          <StatLabel text="TOTAL — TODAS LAS AREAS" />
          <div style={bigNum}>{totalStats.total}</div>
          <AreaBreakdown data={areaData} getValue={d => d.total} />
        </div>
        <div className="stat-card">
          <StatLabel text="TICKETS HOY" />
          <div style={bigNum}>{totalStats.today}</div>
          <AreaBreakdown data={areaData} getValue={d => d.today} />
        </div>
        <div className="stat-card">
          <StatLabel text="RE-TRABAJOS" />
          <div style={bigNum}>{totalStats.retrabajos}</div>
          <div style={{ fontSize: '11px', color: '#999999', marginTop: '10px' }}>
            {totalStats.retrabajos > 0 && topRework
              ? <>Más en <span style={{ color: AREA_THEME[topRework.role].text, fontWeight: 700 }}>{ROLE_LABELS[topRework.role]}</span> ({topRework.retrabajos})</>
              : 'Sin re-trabajos'}
          </div>
        </div>
      </div>

      {/* Area breakdown list */}
      <h2 style={{ fontFamily: 'Bebas Neue', fontSize: '14px', letterSpacing: '1px', color: '#111111', marginBottom: '16px' }}>RESUMEN POR AREA</h2>
      {loading && <LoadingBlock />}
      <div style={{ background: '#F7F7F7', borderRadius: '10px', marginBottom: '40px', overflow: 'hidden' }}>
        {areaData.map(({ role, total }, index) => {
          const t = AREA_THEME[role]
          const Icon = t.icon
          return (
            <div key={role} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '19px 22px', background: '#F7F7F7',
              borderBottom: index < areaData.length - 1 ? '1px solid #ececec' : 'none',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  width: '36px', height: '36px', borderRadius: '8px',
                  background: t.bg, color: t.text,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Icon size={18} />
                </div>
                <span style={{ fontSize: '16px', fontWeight: 600, color: '#111111', fontFamily: 'Rajdhani' }}>{ROLE_LABELS[role]}</span>
              </div>
              <span style={{ fontFamily: 'Bebas Neue', fontSize: '19px', color: '#111111' }}>{total}</span>
            </div>
          )
        })}
      </div>

      {/* Full combined tickets table */}
      <h2 style={{ fontFamily: 'Bebas Neue', fontSize: '14px', letterSpacing: '1px', color: '#111111', marginBottom: '16px' }}>TODOS LOS TICKETS</h2>
      <div className="card-dark" style={{ padding: 0, overflow: 'hidden', marginBottom: '40px' }}>
        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#BBBBBB' }}>Cargando…</div>
        ) : allTickets.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#BBBBBB' }}>No hay tickets registrados aun.</div>
        ) : (
          <table className="table-dark">
            <thead>
              <tr><th>Factura</th><th>Orden</th><th>Modelo</th><th>Area</th><th>Responsable</th><th>Fecha</th></tr>
            </thead>
            <tbody>
              {allTickets.map((t, i) => {
                const role = t.role as UserRole
                const color = ROLE_COLORS[role] || '#888'
                return (
                  <tr key={i}>
                    <td style={{ color: '#111111', fontWeight: 600 }}>{String(t.numero_factura || '-')}</td>
                    <td>{String(t.numero_orden || '-')}</td>
                    <td>{String(t.modelo || '-')}</td>
                    <td>
                      <span className="badge" style={{ background: `${color}12`, color, border: `1px solid ${color}33` }}>
                        {ROLE_LABELS[role] || String(role)}
                      </span>
                    </td>
                    <td>{String(t.user_name || t.a_cargo_de || t.entregado_por || '-')}</td>
                    <td style={{ fontSize: '12px', color: '#999999' }}>
                      {new Date(t.created_at as string).toLocaleDateString('es-DO', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Export section */}
      <h2 style={{ fontFamily: 'Bebas Neue', fontSize: '14px', letterSpacing: '1px', color: '#111111', marginBottom: '16px' }}>EXPORTAR CSV</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '10px' }}>
        <button onClick={() => downloadCSV('all')} style={{ ...exportBtnBase, background: '#E8180A', color: '#FFFFFF' }}>
          <Download size={15} /> Todo
        </button>
        {AREA_ROLES.map(role => {
          const t = AREA_THEME[role]
          return (
            <button key={role} onClick={() => downloadCSV(role)} style={{ ...exportBtnBase, background: t.bg, color: t.text }}>
              <Download size={15} /> {ROLE_LABELS[role]}
            </button>
          )
        })}
      </div>
    </div>
  )
}

/* ── Form selector / form view ───────────────────────────── */
const roleFormMap: Record<UserRole, React.ComponentType<{ user: AppUser; onSuccess: () => void }>> = {
  recepcion: FormRecepcion,
  produccion: FormProduccion,
  pintura: FormPintura,
  instalacion: FormInstalacion,
  marquilla: FormMarquilla,
  admin: FormRecepcion,
}

function FormView({ user, onSubmitSuccess }: { user: AppUser; onSubmitSuccess: () => void }) {
  const [selectedRole, setSelectedRole] = useState<UserRole | null>(null)

  if (user.role === 'admin') {
    if (!selectedRole) return <AdminFormSelector onSelect={setSelectedRole} />
    const FormComponent = roleFormMap[selectedRole]
    const fakeUser: AppUser = { ...user, role: selectedRole }
    return (
      <div>
        <button
          onClick={() => setSelectedRole(null)}
          style={{
            display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '18px',
            background: '#FFFFFF', border: '1px solid #e5e5e5', borderRadius: '7px',
            padding: '8px 13px', color: '#666666', cursor: 'pointer',
            fontFamily: 'Rajdhani', fontSize: '13px', fontWeight: 600,
          }}
        >
          <ArrowLeft size={15} style={{ color: '#E8180A' }} /> Cambiar área
        </button>
        <FormComponent user={fakeUser} onSuccess={() => { setSelectedRole(null); onSubmitSuccess() }} />
      </div>
    )
  }

  const FormComponent = roleFormMap[user.role]
  return <FormComponent user={user} onSuccess={onSubmitSuccess} />
}

function AdminFormSelector({ onSelect }: { onSelect: (role: UserRole) => void }) {
  return (
    <div style={{ animation: 'fadeInUp 0.4s ease' }}>
      <div style={{ marginBottom: '28px' }}>
        <div style={{ width: '40px', height: '3px', background: '#E8180A', marginBottom: '12px' }} />
        <h1 style={{ fontSize: '19px', fontWeight: 500, color: '#111111', marginBottom: '4px' }}>Nuevo ticket</h1>
        <p style={{ color: '#999999', fontSize: '12px' }}>Selecciona el área para la que deseas crear un ticket</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 240px))', gap: '16px' }}>
        {AREA_ROLES.map(role => {
          const t = AREA_THEME[role]
          const Icon = t.icon
          return (
            <div
              key={role}
              className="area-select-card"
              onClick={() => onSelect(role)}
              style={{
                borderRadius: '10px', padding: '16px',
                borderTop: `3px solid ${t.borderTop}`,
                cursor: 'pointer', display: 'flex', flexDirection: 'column',
              }}
            >
              <div style={{
                width: '32px', height: '32px', borderRadius: '8px',
                background: t.bg, color: t.text,
                display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '12px',
              }}>
                <Icon size={18} />
              </div>
              <div style={{ fontSize: '14px', fontWeight: 500, color: t.text, marginBottom: '4px' }}>{ROLE_LABELS[role]}</div>
              <div style={{ fontSize: '10.5px', color: '#999999', lineHeight: 1.5, marginBottom: '14px' }}>{AREA_DESCRIPTIONS[role]}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginTop: 'auto', fontSize: '12px', fontWeight: 600, color: t.text }}>
                Crear ticket <ArrowRight size={13} />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
