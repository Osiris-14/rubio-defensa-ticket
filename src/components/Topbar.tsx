'use client'
import { Sparkles, Calendar, LogOut } from 'lucide-react'
import { type AppUser } from '@/lib/store'

interface Props {
  user: AppUser
  onLogout: () => void
  circleBg: string
  circleBorder: string
  circleText: string
  accentColor?: string
}

export default function Topbar({ user, onLogout, circleBg, circleBorder, circleText, accentColor }: Props) {
  const initials = user.name
    .split(' ')
    .map(n => n.charAt(0))
    .slice(0, 2)
    .join('')
    .toUpperCase()
  const date = new Date().toLocaleDateString('es-DO', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
  const borderColor = accentColor || '#E8180A'

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '20px 26px',
      marginBottom: '28px', flexWrap: 'wrap', gap: '12px',
      background: '#FFFFFF', borderRadius: '12px',
      boxShadow: 'var(--shadow-sm)',
      border: '0.5px solid var(--border-subtle)',
      borderBottom: `2px solid ${borderColor}`,
    }}>
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Sparkles size={14} style={{ color: borderColor, flexShrink: 0 }} />
          <span style={{ fontSize: '14px', color: '#999' }}>Bienvenido,&nbsp;</span>
          <span style={{ fontSize: '14px', fontWeight: 700, color: '#111' }}>{user.name}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginTop: '4px' }}>
          <Calendar size={10} style={{ color: '#bbb', flexShrink: 0 }} />
          <span style={{ fontSize: '13px', color: '#bbb', textTransform: 'capitalize' }}>{date}</span>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <div style={{
          width: '36px', height: '36px', borderRadius: '50%',
          background: circleBg, border: `1px solid ${circleBorder}`, color: circleText,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontWeight: 500, fontSize: '13px', flexShrink: 0,
        }}>
          {initials}
        </div>
        <button
          onClick={onLogout}
          className="icon-btn"
          title="Cerrar sesión"
          style={{
            width: '32px', height: '32px', borderRadius: '8px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', flexShrink: 0,
          }}
        >
          <LogOut size={16} />
        </button>
      </div>
    </div>
  )
}
