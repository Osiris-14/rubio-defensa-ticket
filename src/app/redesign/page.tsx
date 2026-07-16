'use client'
import { useState, type ReactNode } from 'react'
import {
  LayoutDashboard, Plus, ListChecks, Settings, Bell, Search, ChevronDown,
  LogOut, CircleHelp, Sparkles, type LucideIcon,
} from 'lucide-react'
import { type AppUser, ROLE_LABELS, ROLE_COLORS } from '@/lib/store'
import TicketsList from '@/components/TicketsList'

interface Props { user?: AppUser; onLogout?: () => void }

type View = 'dashboard' | 'produccion' | 'new' | 'all'

const NAV: { id: View; label: string; icon: LucideIcon; group: 'main' | 'ops'; badge?: string }[] = [
  { id: 'dashboard',  label: 'Dashboard',     icon: LayoutDashboard, group: 'main' },
  { id: 'produccion', label: 'Tickets',       icon: Settings,       group: 'ops', badge: '14' },
  { id: 'new',        label: 'Nuevo ticket',  icon: Plus,           group: 'ops' },
  { id: 'all',        label: 'Todos los tickets', icon: ListChecks, group: 'ops' },
]

const PAGE_META: Record<View, { crumb: string; title: string; sub: string; kbd?: string }> = {
  dashboard:  { crumb: 'Operación',     title: 'Dashboard',              sub: 'Vista general de la operación en tiempo real.' },
  produccion: { crumb: 'Tickets',       title: 'Tickets pendientes',     sub: 'Las facturas de Alegra llegan aquí automáticamente.', kbd: '⏎' },
  new:        { crumb: 'Crear',         title: 'Nuevo ticket',           sub: 'Crea un ticket manual para cualquier área.' },
  all:        { crumb: 'Tickets',       title: 'Todos los tickets',      sub: 'Historial completo del sistema.' },
}

export default function NuevoDashboard({ user, onLogout }: Props) {
  const activeUser: AppUser = user ?? {
    id: 'redesign-preview',
    username: 'preview',
    password: '',
    name: 'Vista previa',
    role: 'admin',
  }
  const handleLogout = onLogout ?? (() => {})
  const [view, setView] = useState<View>('produccion')
  const [search, setSearch] = useState('')
  const userInitials = activeUser.name.split(' ').map(n => n.charAt(0)).slice(0, 2).join('').toUpperCase()
  const roleColor = ROLE_COLORS[activeUser.role]
  const meta = PAGE_META[view]

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '264px 1fr',
      minHeight: '100vh',
      background: '#F5F7FA',
      fontFamily: 'Inter, system-ui, sans-serif',
    }}>
      {/* ── Sidebar ── */}
      <aside style={{
        background: '#0B1220',
        color: 'rgba(255,255,255,0.7)',
        display: 'flex',
        flexDirection: 'column',
        position: 'sticky',
        top: 0,
        height: '100vh',
        borderRight: '1px solid rgba(255,255,255,0.06)',
      }}>
        {/* Brand */}
        <div style={{ padding: '22px 20px 18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 8,
              background: 'linear-gradient(180deg, #E8180A 0%, #B01008 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 700, color: 'white', fontSize: 14,
              boxShadow: '0 1px 0 rgba(255,255,255,0.2) inset, 0 4px 12px rgba(232,24,10,0.45)',
              letterSpacing: '-0.02em',
            }}>R</div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'white', letterSpacing: '-0.01em', lineHeight: 1.15 }}>El Rubio</div>
              <div style={{ fontSize: 9, color: '#E8180A', fontWeight: 700, letterSpacing: '0.16em', marginTop: 3 }}>DEFENSA TICKET</div>
            </div>
          </div>
        </div>

        {/* Workspace switcher */}
        <div style={{ padding: '0 12px 12px' }}>
          <button style={{
            display: 'flex', alignItems: 'center', gap: 8, width: '100%',
            background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: 8, padding: '8px 10px', cursor: 'pointer',
            color: 'rgba(255,255,255,0.85)', fontSize: 12.5, fontWeight: 500,
          }}>
            <div style={{
              width: 18, height: 18, borderRadius: 4,
              background: '#378ADD', color: 'white',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 10, fontWeight: 700,
            }}>R</div>
            <span style={{ flex: 1, textAlign: 'left' }}>Rubio Defensas</span>
            <ChevronDown size={14} style={{ opacity: 0.6 }} />
          </button>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '4px 12px', overflowY: 'auto' }}>
          <NavGroup label="Principal">
            {NAV.filter(n => n.group === 'main').map(item => (
              <NavItem
                key={item.id}
                active={view === item.id}
                icon={<item.icon size={16} strokeWidth={1.75} />}
                label={item.label}
                onClick={() => setView(item.id)}
              />
            ))}
          </NavGroup>
          <NavGroup label="Tickets" top>
            {NAV.filter(n => n.group === 'ops').map(item => (
              <NavItem
                key={item.id}
                active={view === item.id}
                icon={<item.icon size={16} strokeWidth={1.75} />}
                label={item.label}
                badge={item.badge}
                onClick={() => setView(item.id)}
              />
            ))}
          </NavGroup>
        </nav>

        {/* User */}
        <div style={{ padding: 12, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 8px' }}>
            <div style={{
              width: 28, height: 28, borderRadius: '50%',
              background: roleColor, color: 'white',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 600, fontSize: 12,
            }}>{userInitials}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: 'white', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{activeUser.name}</div>
              <div style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.5)', marginTop: 1 }}>{ROLE_LABELS[activeUser.role]}</div>
            </div>
            <button
              onClick={handleLogout}
              aria-label="Cerrar sesión"
              style={{
                background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.5)',
                cursor: 'pointer', padding: 4, borderRadius: 6,
              }}
              onMouseEnter={e => { e.currentTarget.style.color = '#fff'; e.currentTarget.style.background = 'rgba(255,255,255,0.06)' }}
              onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.5)'; e.currentTarget.style.background = 'transparent' }}
            >
              <LogOut size={14} />
            </button>
          </div>
        </div>
      </aside>

      {/* ── Workspace ── */}
      <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
        {/* Top bar — search + user */}
        <header style={{
          position: 'sticky', top: 0, zIndex: 10,
          background: 'rgba(245, 247, 250, 0.85)',
          backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
          borderBottom: '1px solid #E5E7EB',
          padding: '10px 32px',
          display: 'flex', alignItems: 'center', gap: 16,
        }}>
          <div style={{
            flex: 1, maxWidth: 480,
            position: 'relative',
          }}>
            <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF' }} />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar tickets, facturas, vehículos…"
              style={{
                width: '100%',
                height: 34,
                padding: '0 12px 0 36px',
                fontSize: 13,
                fontFamily: 'Inter, sans-serif',
                color: '#111827',
                background: '#FFFFFF',
                border: '1px solid #E5E7EB',
                borderRadius: 8,
                outline: 'none',
                transition: 'border-color 0.15s, box-shadow 0.15s',
              }}
              onFocus={e => { e.currentTarget.style.borderColor = '#E8180A'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(232,24,10,0.15)' }}
              onBlur={e => { e.currentTarget.style.borderColor = '#E5E7EB'; e.currentTarget.style.boxShadow = 'none' }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <IconButton aria-label="Notificaciones"><Bell size={16} strokeWidth={1.75} /></IconButton>
            <IconButton aria-label="Ayuda"><CircleHelp size={16} strokeWidth={1.75} /></IconButton>
            <div style={{ width: 1, height: 20, background: '#E5E7EB', margin: '0 6px' }} />
            <button style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '4px 10px 4px 4px',
              background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: 9999,
              cursor: 'pointer',
            }}>
              <div style={{
                width: 26, height: 26, borderRadius: '50%',
                background: roleColor, color: 'white',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 11, fontWeight: 600,
              }}>{userInitials}</div>
              <span style={{ fontSize: 12.5, fontWeight: 600, color: '#111827' }}>{activeUser.name.split(' ')[0]}</span>
              <ChevronDown size={12} style={{ color: '#9CA3AF' }} />
            </button>
          </div>
        </header>

        {/* Page content */}
        <main style={{ flex: 1, padding: '24px 40px 80px' }}>
          {/* Crumb + page header */}
          <div style={{ marginBottom: 24 }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6,
              fontSize: 12, color: '#6B7280', fontWeight: 500, marginBottom: 14,
            }}>
              <span>{meta.crumb}</span>
              <span style={{ color: '#D1D5DB' }}>/</span>
              <span style={{ color: '#111827', fontWeight: 600 }}>{meta.title}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 24, flexWrap: 'wrap' as const }}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <h1 style={{
                  fontSize: 32, fontWeight: 700, color: '#111827',
                  letterSpacing: '-0.035em', lineHeight: 1.05, margin: 0,
                }}>{meta.title}</h1>
                <p style={{ fontSize: 14, color: '#6B7280', marginTop: 8, lineHeight: 1.5, maxWidth: 640 }}>
                  {meta.sub}
                </p>
              </div>
              {view === 'produccion' && (
                <button
                  className="rd-btn-primary"
                  style={{ height: 44, padding: '0 18px', fontSize: 14 }}
                >
                  <Sparkles size={15} strokeWidth={2} />
                  Vista operativa
                </button>
              )}
            </div>
          </div>

          {/* Module view */}
          {view === 'produccion' && <TicketsList user={{ ...activeUser, role: 'produccion' }} />}
          {view === 'dashboard' && <Placeholder title="Dashboard" description="Próximamente." />}
          {view === 'new' && <Placeholder title="Nuevo ticket" description="Crear ticket manual." />}
          {view === 'all' && <Placeholder title="Todos los tickets" description="Historial completo." />}
        </main>
      </div>
    </div>
  )
}

function Placeholder({ title, description }: { title: string; description: string }) {
  return (
    <div style={{
      background: 'white', border: '1px solid #E5E7EB', borderRadius: 16,
      padding: '60px 24px', textAlign: 'center',
      boxShadow: '0 1px 2px rgba(15,23,42,0.04)',
    }}>
      <h3 style={{ fontSize: 16, fontWeight: 600, color: '#111827', margin: 0 }}>{title}</h3>
      <p style={{ fontSize: 13, color: '#6B7280', marginTop: 6 }}>{description}</p>
    </div>
  )
}

function NavGroup({ label, top, children }: { label: string; top?: boolean; children: ReactNode }) {
  return (
    <div style={{ marginTop: top ? 24 : 8 }}>
      <div style={{
        padding: '0 12px 8px',
        fontSize: 10, color: 'rgba(255,255,255,0.4)',
        textTransform: 'uppercase', letterSpacing: '0.12em', fontWeight: 600,
      }}>{label}</div>
      {children}
    </div>
  )
}

function NavItem({ active, icon, label, badge, onClick }: {
  active: boolean
  icon: ReactNode
  label: string
  badge?: string
  onClick: () => void
}) {
  return (
    <button onClick={onClick} style={{
      display: 'flex', alignItems: 'center', gap: 10,
      width: '100%', padding: '8px 12px',
      background: active ? 'rgba(232, 24, 10, 0.12)' : 'transparent',
      color: active ? '#fff' : 'rgba(255,255,255,0.7)',
      border: 'none', borderRadius: 8,
      fontSize: 13, fontWeight: active ? 600 : 500,
      letterSpacing: '-0.005em',
      cursor: 'pointer',
      marginBottom: 2,
      transition: 'background 0.12s, color 0.12s',
    }}
    onMouseEnter={e => { if (!active) { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.color = '#fff' } }}
    onMouseLeave={e => { if (!active) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(255,255,255,0.7)' } }}
    >
      <span style={{ color: active ? '#E8180A' : 'inherit', display: 'inline-flex' }}>{icon}</span>
      <span style={{ flex: 1, textAlign: 'left' }}>{label}</span>
      {badge && (
        <span style={{
          fontSize: 10, fontWeight: 700, color: active ? '#E8180A' : 'rgba(255,255,255,0.5)',
          background: active ? 'rgba(232,24,10,0.2)' : 'rgba(255,255,255,0.06)',
          padding: '1px 7px', borderRadius: 9999, minWidth: 20, textAlign: 'center',
        }}>{badge}</span>
      )}
    </button>
  )
}

function IconButton({ children, ...rest }: { children: ReactNode } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button {...rest} style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      width: 34, height: 34,
      background: 'transparent', border: 'none', borderRadius: 8,
      color: '#6B7280', cursor: 'pointer',
      ...(rest.style ?? {}),
    }}
    onMouseEnter={e => { e.currentTarget.style.background = '#FFFFFF'; e.currentTarget.style.color = '#111827' }}
    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#6B7280' }}
    >
      {children}
    </button>
  )
}
