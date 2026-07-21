'use client'
import { useState, useEffect, type ReactNode } from 'react'
import { type AppUser, type UserRole, ROLE_LABELS, ROLE_COLORS, getStatsForRole, getTickets } from '@/lib/store'
import { supabase } from '@/lib/supabase'
import { AREA_THEME } from '@/lib/areaTheme'
import {
  ArrowLeft, ArrowRight, RefreshCw, Calendar, ChartColumn as BarChart3,
  LayoutDashboard, Plus, ListChecks, Settings, LogOut, ChevronLeft, ChevronRight, Bell, Wallet, CalendarDays, Gauge,
  type LucideIcon,
} from 'lucide-react'
import TicketRow from './TicketRow'
import FormRecepcion from './forms/FormRecepcion'
import FormProduccion from './forms/FormProduccion'
import FormPintura from './forms/FormPintura'
import FormInstalacion from './forms/FormInstalacion'
import FormMarquilla from './forms/FormMarquilla'
import FormFerre from './forms/FormFerre'
import TicketsList from './TicketsList'
import ProduccionView from './produccion-v2/ProduccionView'
import PagosView from './pagos/PagosView'
import CalendarioProduccionView from './calendario/CalendarioProduccionView'
import DashboardCapacidadView from './calendario/DashboardCapacidadView'
import AdminHome from './dashboard/AdminHome'

interface Props { user: AppUser; onLogout: () => void }

type View = 'dashboard' | 'form' | 'tickets' | 'produccion' | 'pagos' | 'calendario' | 'capacidad'

const AREA_ROLES: UserRole[] = ['recepcion', 'produccion', 'pintura', 'instalacion', 'marquilla', 'ferre']
const AREA_DESCRIPTIONS: Record<string, string> = {
  recepcion: 'Registro de ingreso de vehiculos al taller',
  produccion: 'Ordenes de fabricacion de piezas',
  pintura: 'Control de pintado de defensas',
  instalacion: 'Registro de instalación de defensas',
  marquilla: 'Pago y monitoreo de piezas',
  ferre: 'Control de preparación de piezas',
}

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

// ─────────────────────────────────────────────────────────
// META por view: label, breadcrumb, eyebrow
// ─────────────────────────────────────────────────────────

const VIEW_META: Record<View, { eyebrow: string; title: string; subtitle: string }> = {
  dashboard:  { eyebrow: 'Resumen',      title: 'Dashboard Operativo',     subtitle: 'Vista general de la operación.' },
  produccion: { eyebrow: 'Tickets',      title: 'Producción',             subtitle: 'Las facturas de Alegra aparecen aquí automáticamente.' },
  form:       { eyebrow: 'Crear',        title: 'Nuevo ticket',           subtitle: 'Crea un ticket manual para cualquier área.' },
  tickets:    { eyebrow: 'Tickets',      title: 'Todos los tickets',      subtitle: 'Historial completo de tickets en el sistema.' },
  pagos:      { eyebrow: 'Pagos',        title: 'Pagos y Nóminas',        subtitle: 'Cálculo automático desde los movimientos de producción.' },
  calendario: { eyebrow: 'Planificación',title: 'Calendario de Producción', subtitle: 'Planificación de capacidad por día, área y empleado.' },
  capacidad:  { eyebrow: 'Capacidad',    title: 'Dashboard de Capacidad', subtitle: 'Visualiza la carga y configura capacidades diarias.' },
}

export default function Dashboard({ user, onLogout }: Props) {
  const [view, setView] = useState<View>('dashboard')
  const [collapsed, setCollapsed] = useState(false)

  const roleColor = ROLE_COLORS[user.role]
  const isAdmin = user.role === 'admin'
  const userInitials = user.name.split(' ').map(n => n.charAt(0)).slice(0, 2).join('').toUpperCase()

  const allNavItems: { id: View; label: string; icon: LucideIcon; group: 'main' | 'ops' | 'plan' }[] = [
    { id: 'dashboard',  label: 'Dashboard',  icon: LayoutDashboard, group: 'main' },
    { id: 'produccion', label: 'Producción', icon: Settings,       group: 'ops' },
    { id: 'pagos',      label: 'Pagos',      icon: Wallet,         group: 'ops' },
    { id: 'calendario', label: 'Calendario', icon: CalendarDays,   group: 'plan' },
    { id: 'capacidad',  label: 'Capacidad',  icon: Gauge,          group: 'plan' },
    { id: 'form',       label: 'Nuevo ticket', icon: Plus,         group: 'ops' },
    { id: 'tickets',    label: 'Todos los tickets', icon: ListChecks, group: 'ops' },
  ]
  // Producción se auto-genera desde Alegra: este rol no crea tickets manualmente
  // ni tiene "Mis tickets" — su equivalente es la pestaña Completados dentro de
  // la vista Producción. Solo ve Dashboard + Producción. El resto de roles
  // (recepción, pintura, instalación, marquilla, ferré, admin) no cambian.
  // Pagos / Calendario / Capacidad son solo para admin (nóminas, planificación).
  const navItems = allNavItems.filter(i => {
    if (i.id === 'pagos' && user.role !== 'admin') return false
    if ((i.id === 'calendario' || i.id === 'capacidad') && user.role !== 'admin' && user.role !== 'produccion') return false
    if (user.role === 'produccion' && !(i.id === 'dashboard' || i.id === 'produccion' || i.id === 'calendario' || i.id === 'capacidad')) return false
    return true
  })

  const meta = VIEW_META[view]

  // En producción no usamos Topbar legacy — el header vive dentro de ProduccionView
  // para que pueda crecer cuando se abre un ticket.

  return (
    <div className="app-layout">
      {/* Mobile header */}
      <div className="mobile-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 28, height: 28,
            background: 'var(--red)', borderRadius: 'var(--radius-sm)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 700, color: 'white', fontSize: 14,
          }}>R</div>
          <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--gray-900)', letterSpacing: '-0.01em' }}>EL RUBIO</div>
        </div>
        <div style={{
          width: 32, height: 32, borderRadius: '50%',
          background: roleColor, color: 'white',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontWeight: 600, fontSize: 13,
        }}>
          {userInitials}
        </div>
      </div>

      {/* Sidebar */}
      <div className="sidebar-wrapper" style={{ width: collapsed ? 72 : 240, transition: 'width var(--t-base)' }}>
        <div style={{
          width: collapsed ? 72 : 240, height: '100%',
          background: 'var(--bg-sidebar)', color: 'var(--gray-300)',
          display: 'flex', flexDirection: 'column',
          position: 'fixed',
          top: 0, left: 0, bottom: 0, zIndex: 50,
          borderRight: '1px solid rgba(255,255,255,0.04)',
        }}>
          {/* Logo + collapse */}
          <div style={{ padding: '20px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, overflow: 'hidden' }}>
              <div style={{
                width: 34, height: 34, background: 'var(--red)', borderRadius: 'var(--radius)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 700, color: 'white', fontSize: 16,
                boxShadow: '0 4px 14px rgba(232, 24, 10, 0.35)',
                flexShrink: 0,
              }}>R</div>
              {!collapsed && (
                <div style={{ minWidth: 0, overflow: 'hidden' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', letterSpacing: '0.02em', lineHeight: 1.1, whiteSpace: 'nowrap' }}>EL RUBIO</div>
                  <div style={{ fontSize: 9, color: 'var(--red)', fontWeight: 700, letterSpacing: '0.18em', marginTop: 3, whiteSpace: 'nowrap' }}>DEFENSA TICKET</div>
                </div>
              )}
            </div>
            <button
              onClick={() => setCollapsed(c => !c)}
              aria-label="Colapsar sidebar"
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: 'none',
                borderRadius: 'var(--radius-sm)',
                width: 24, height: 24,
                color: 'var(--gray-500)',
                cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
                transition: 'all var(--t-fast)',
              }}
              onMouseEnter={e => { e.currentTarget.style.color = '#fff'; e.currentTarget.style.background = 'rgba(255,255,255,0.08)' }}
              onMouseLeave={e => { e.currentTarget.style.color = 'var(--gray-500)'; e.currentTarget.style.background = 'rgba(255,255,255,0.04)' }}
            >
              {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
            </button>
          </div>

          {/* User info */}
          <div style={{ padding: '14px 18px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                width: 30, height: 30, borderRadius: '50%',
                background: roleColor, color: '#FFFFFF',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 600, fontSize: 12.5, flexShrink: 0,
              }}>
                {userInitials}
              </div>
              {!collapsed && (
                <div style={{ minWidth: 0, overflow: 'hidden' }}>
                  <div style={{ fontWeight: 600, fontSize: 13, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user.name}</div>
                  <div style={{ fontSize: 10, color: 'var(--gray-500)', marginTop: 1, fontWeight: 500, whiteSpace: 'nowrap' }}>
                    {ROLE_LABELS[user.role]}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Nav */}
          <nav style={{ padding: '16px 12px', flex: 1, overflowY: 'auto' }}>
            {!collapsed && (
              <div style={{ padding: '0 10px 8px', fontSize: 10, color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: '0.14em', fontWeight: 600 }}>
                Principal
              </div>
            )}
            {navItems.filter(i => i.group === 'main').map(item => {
              const active = view === item.id
              const ItemIcon = item.icon
              return (
                <SidebarItem
                  key={item.id}
                  active={active}
                  collapsed={collapsed}
                  icon={<ItemIcon size={16} strokeWidth={1.75} />}
                  label={item.label}
                  onClick={() => setView(item.id)}
                />
              )
            })}

            {!collapsed && (
              <div style={{ padding: '0 10px 8px', marginTop: 18, fontSize: 10, color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: '0.14em', fontWeight: 600 }}>
                Operación
              </div>
            )}
            {navItems.filter(i => i.group === 'ops').map(item => {
              const active = view === item.id
              const ItemIcon = item.icon
              return (
                <SidebarItem
                  key={item.id}
                  active={active}
                  collapsed={collapsed}
                  icon={<ItemIcon size={16} strokeWidth={1.75} />}
                  label={item.label}
                  onClick={() => setView(item.id)}
                />
              )
            })}

            {navItems.filter(i => i.group === 'plan').length > 0 && (
              <>
                {!collapsed && (
                  <div style={{ padding: '0 10px 8px', marginTop: 18, fontSize: 10, color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: '0.14em', fontWeight: 600 }}>
                    Planificación
                  </div>
                )}
                {navItems.filter(i => i.group === 'plan').map(item => {
                  const active = view === item.id
                  const ItemIcon = item.icon
                  return (
                    <SidebarItem
                      key={item.id}
                      active={active}
                      collapsed={collapsed}
                      icon={<ItemIcon size={16} strokeWidth={1.75} />}
                      label={item.label}
                      onClick={() => setView(item.id)}
                    />
                  )
                })}
              </>
            )}
          </nav>

          {/* Logout */}
          <div style={{ padding: '12px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            <SidebarItem
              active={false}
              collapsed={collapsed}
              icon={<LogOut size={16} strokeWidth={1.75} />}
              label="Cerrar sesión"
              onClick={onLogout}
            />
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="main-content-wrapper" style={{
        flex: 1, minWidth: 0,
        padding: 0,
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--bg-page)',
      }}>
        {/* Header con breadcrumb — solo para vistas tradicionales; Producción, Pagos, Calendario y Capacidad lo gestionan internamente */}
        {view !== 'produccion' && view !== 'pagos' && view !== 'calendario' && view !== 'capacidad' && (
          <PageHeaderBar
            eyebrow={meta.eyebrow}
            title={meta.title}
            subtitle={meta.subtitle}
            onLogout={onLogout}
          />
        )}

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          {view === 'dashboard' && (
            isAdmin || user.role === 'produccion'
              ? <AdminHome user={user} onNavigate={v => setView(v as View)} canExport={isAdmin} />
              : <DashboardView user={user} onNavigateForm={() => setView('form')} />
          )}
          {view === 'form' && (
            <FormView user={user} onSubmitSuccess={() => setView('tickets')} />
          )}
          {view === 'tickets' && <TicketsList user={user} />}
          {view === 'produccion' && <ProduccionView user={user} />}
          {view === 'pagos' && <PagosView user={user} />}
          {view === 'calendario' && <CalendarioProduccionView user={user} />}
          {view === 'capacidad' && <DashboardCapacidadView user={user} />}
        </div>
      </div>

      {/* Bottom nav — mobile only */}
      <nav className="bottom-nav">
        {navItems.map(item => (
          <button key={item.id} className={`bottom-nav-btn ${view === item.id ? 'active' : ''}`} onClick={() => setView(item.id)}>
            <span className="bottom-nav-btn-sym">
              {item.id === 'dashboard' ? '⌂'
                : item.id === 'form' ? '+'
                : item.id === 'produccion' ? '⚙'
                : item.id === 'pagos' ? '¥'
                : item.id === 'calendario' ? '▦'
                : item.id === 'capacidad' ? '☰'
                : '☰'}
            </span>
            <span>{item.id === 'tickets' ? 'Tickets'
              : item.id === 'form' ? 'Nuevo'
              : item.id === 'produccion' ? 'Prod.'
              : item.id === 'pagos' ? 'Pagos'
              : item.id === 'calendario' ? 'Cal.'
              : item.id === 'capacidad' ? 'Cap.'
              : 'Inicio'}</span>
          </button>
        ))}
      </nav>
    </div>
  )
}

// ─────────────────────────────────────────────────────────
// Sidebar item (con soporte collapsed)
// ─────────────────────────────────────────────────────────

function SidebarItem({ active, collapsed, icon, label, onClick }: {
  active: boolean
  collapsed: boolean
  icon: ReactNode
  label: string
  onClick: () => void
}) {
  return (
    <div
      onClick={onClick}
      title={collapsed ? label : undefined}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: collapsed ? '9px' : '9px 12px',
        justifyContent: collapsed ? 'center' : 'flex-start',
        borderRadius: 'var(--radius)',
        marginBottom: 2,
        cursor: 'pointer',
        color: active ? '#fff' : 'var(--gray-400)',
        background: active ? 'rgba(232, 24, 10, 0.15)' : 'transparent',
        fontSize: 13.5,
        fontWeight: active ? 600 : 500,
        letterSpacing: '-0.005em',
        transition: 'all var(--t-fast)',
        position: 'relative',
      }}
      onMouseEnter={e => {
        if (!active) {
          e.currentTarget.style.background = 'rgba(255,255,255,0.04)'
          e.currentTarget.style.color = '#fff'
        }
      }}
      onMouseLeave={e => {
        if (!active) {
          e.currentTarget.style.background = 'transparent'
          e.currentTarget.style.color = 'var(--gray-400)'
        }
      }}
    >
      {active && (
        <span style={{
          position: 'absolute',
          left: 0, top: '20%', bottom: '20%',
          width: 3,
          background: 'var(--red)',
          borderRadius: '0 2px 2px 0',
        }} />
      )}
      <span style={{ display: 'inline-flex', flexShrink: 0, color: active ? 'var(--red)' : 'var(--gray-500)' }}>{icon}</span>
      {!collapsed && <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</span>}
    </div>
  )
}

// ─────────────────────────────────────────────────────────
// Page header bar (Linear-style con breadcrumb + acciones)
// ─────────────────────────────────────────────────────────

function PageHeaderBar({ eyebrow, title, subtitle, onLogout }: {
  eyebrow: string
  title: string
  subtitle?: string
  onLogout: () => void
}) {
  return (
    <div className="workspace-header" style={{
      padding: '28px 48px',
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: 24,
      flexWrap: 'wrap' as const,
    }}>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div className="eyebrow" style={{ color: 'var(--red)', marginBottom: 8 }}>{eyebrow}</div>
        <h1 style={{
          fontSize: 28, fontWeight: 700, color: 'var(--gray-900)',
          letterSpacing: '-0.025em', lineHeight: 1.15, margin: 0,
        }}>{title}</h1>
        {subtitle && (
          <p style={{ fontSize: 14, color: 'var(--gray-500)', marginTop: 8, lineHeight: 1.5 }}>{subtitle}</p>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <button
          aria-label="Notificaciones"
          className="btn-icon"
          style={{ position: 'relative' }}
        >
          <Bell size={16} strokeWidth={1.75} />
          <span style={{
            position: 'absolute', top: 6, right: 6,
            width: 7, height: 7, borderRadius: '50%',
            background: 'var(--red)',
            border: '2px solid var(--bg-card)',
          }} />
        </button>
        {/* Identidad de usuario vive solo en el sidebar — aquí no se duplica. */}
        <button
          onClick={onLogout}
          className="btn-icon"
          aria-label="Cerrar sesión"
        >
          <LogOut size={16} strokeWidth={1.75} />
        </button>
      </div>
    </div>
  )
}

/* ── Shared bits ─────────────────────────────────────────── */
const bigNum = { fontSize: 36, fontWeight: 700, color: 'var(--gray-900)', lineHeight: 1, letterSpacing: '-0.03em' } as const

function ErrorBanner({ message }: { message: string }) {
  return (
    <div style={{
      background: 'var(--red-50)', border: '1px solid var(--red-ring)', borderRadius: 'var(--radius-lg)',
      padding: '12px 16px', marginBottom: '20px', fontSize: 13.5, color: 'var(--red)',
    }}>
      No se pudieron cargar los datos: {message}
    </div>
  )
}

function LoadingBlock() {
  return (
    <div style={{ padding: '48px 24px', textAlign: 'center', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', color: 'var(--gray-500)', fontSize: 13.5 }}>
      Cargando…
    </div>
  )
}

function DashboardView({ user, onNavigateForm }: {
  user: AppUser
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
    <div style={{ animation: 'fadeInUp 0.3s ease', padding: '40px 48px 64px' }}>
      {error && <ErrorBanner message={error} />}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 32 }}>
        {statCards.map(({ label, value, Icon }) => (
          <div key={label} className="kpi">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ fontSize: 11, color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>{label}</div>
              <div style={{
                width: 32, height: 32, borderRadius: 'var(--radius)',
                background: 'var(--gray-50)', color: 'var(--gray-500)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Icon size={14} strokeWidth={1.75} />
              </div>
            </div>
            <div style={bigNum}>{value}</div>
          </div>
        ))}
      </div>

      <h2 style={{ fontSize: 15, fontWeight: 600, color: 'var(--gray-900)', marginBottom: 16, letterSpacing: '-0.01em' }}>Tickets recientes</h2>
      {loading ? (
        <LoadingBlock />
      ) : tickets.length === 0 ? (
        <div className="card" style={{ padding: '48px 24px', textAlign: 'center' }}>
          <div style={{
            width: 40, height: 40, borderRadius: '50%',
            background: theme.bg, color: theme.text,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14,
          }}>
            <AreaIcon size={20} />
          </div>
          {user.role === 'produccion' ? (
            <p style={{ color: 'var(--gray-500)', fontSize: 13.5, lineHeight: 1.5 }}>
              Los tickets de Producción se generan automáticamente desde Alegra.<br />
              Revísalos en la pestaña <strong style={{ color: 'var(--gray-700)' }}>Producción</strong>.
            </p>
          ) : (
            <>
              <p style={{ color: 'var(--gray-500)', fontSize: 13.5, marginBottom: 16 }}>No hay tickets aún. Crea el primero.</p>
              <button onClick={onNavigateForm} className="btn btn-primary" style={{ height: 40, padding: '0 18px' }}>
                <Plus size={14} strokeWidth={2.5} />
                Crear primer ticket
              </button>
            </>
          )}
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {tickets.slice(0, 8).map((t, i) => <TicketRow key={i} ticket={t} role={user.role} />)}
        </div>
      )}
    </div>
  )
}

const roleFormMap: Record<UserRole, React.ComponentType<{ user: AppUser; onSuccess: () => void }>> = {
  recepcion: FormRecepcion,
  produccion: FormProduccion,
  pintura: FormPintura,
  instalacion: FormInstalacion,
  marquilla: FormMarquilla,
  ferre: FormFerre,
  admin: FormRecepcion,
}

function FormView({ user, onSubmitSuccess }: { user: AppUser; onSubmitSuccess: () => void }) {
  const [selectedRole, setSelectedRole] = useState<UserRole | null>(null)

  if (user.role === 'admin') {
    if (!selectedRole) return <AdminFormSelector onSelect={setSelectedRole} />
    const FormComponent = roleFormMap[selectedRole]
    const fakeUser: AppUser = { ...user, role: selectedRole }
    return (
      <div style={{ padding: '40px 48px 64px' }}>
        <button
          onClick={() => setSelectedRole(null)}
          style={{
            display: 'flex', alignItems: 'center', gap: '8px', marginBottom: 20,
            background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)',
            padding: '8px 14px', color: 'var(--gray-600)', cursor: 'pointer',
            fontSize: 13, fontWeight: 500,
          }}
        >
          <ArrowLeft size={15} strokeWidth={1.75} /> Cambiar área
        </button>
        <FormComponent user={fakeUser} onSuccess={() => { setSelectedRole(null); onSubmitSuccess() }} />
      </div>
    )
  }

  const FormComponent = roleFormMap[user.role]
  return <div style={{ padding: '40px 48px 64px' }}><FormComponent user={user} onSuccess={onSubmitSuccess} /></div>
}

function AdminFormSelector({ onSelect }: { onSelect: (role: UserRole) => void }) {
  return (
    <div style={{ animation: 'fadeInUp 0.3s ease', padding: '40px 48px 64px' }}>
      <div className="eyebrow" style={{ color: 'var(--red)', marginBottom: 8 }}>Creación de ticket</div>
      <h2 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--gray-900)', margin: 0 }}>
        Seleccionar Área
      </h2>
      <p style={{ color: 'var(--gray-500)', fontSize: 14, marginTop: 6, marginBottom: 28 }}>
        Selecciona el departamento para el cual deseas registrar un ticket.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
        {/* Producción se excluye: sus tickets vienen de las tarjetas de Alegra,
            no se crean manualmente. Los otros 5 departamentos siguen igual. */}
        {AREA_ROLES.filter(role => role !== 'produccion').map(role => {
          const t = AREA_THEME[role]
          const Icon = t.icon
          return (
            <div
              key={role}
              className="card card-interactive"
              onClick={() => onSelect(role)}
              style={{
                borderRadius: 'var(--radius-lg)',
                padding: '22px 24px',
                display: 'flex', flexDirection: 'column',
                minHeight: 180,
              }}
            >
              <div style={{
                width: 40, height: 40, borderRadius: 'var(--radius)',
                background: 'var(--gray-50)', color: 'var(--gray-700)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                marginBottom: 16, border: '1px solid var(--border)',
              }}>
                <Icon size={18} strokeWidth={1.75} />
              </div>
              <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--gray-900)', marginBottom: 4 }}>{ROLE_LABELS[role]}</div>
              <div style={{ fontSize: 12.5, color: 'var(--gray-500)', lineHeight: 1.5, marginBottom: 18 }}>
                {AREA_DESCRIPTIONS[role]}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 'auto', fontSize: 12.5, fontWeight: 600, color: 'var(--red)' }}>
                Crear ticket
                <ArrowRight size={14} strokeWidth={2} />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
