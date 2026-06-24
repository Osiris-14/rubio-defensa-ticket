'use client'
import { Sparkles, Calendar, LogOut } from 'lucide-react'
import { type AppUser } from '@/lib/store'

interface Props {
  user: AppUser
  onLogout: () => void
  circleBg: string
  circleBorder: string
  circleText: string
}

export default function Topbar({ user, onLogout, circleBg, circleBorder, circleText }: Props) {
  const initials = user.name
    .split(' ')
    .map(n => n.charAt(0))
    .slice(0, 2)
    .join('')
    .toUpperCase()
  const date = new Date().toLocaleDateString('es-DO', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '20px 26px', borderBottom: '2px solid #E8180A',
      marginBottom: '28px', flexWrap: 'wrap', gap: '12px',
    }}>
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Sparkles size={14} style={{ color: '#E8180A', flexShrink: 0 }} />
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
