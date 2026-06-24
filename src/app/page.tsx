'use client'
import { useState, useEffect } from 'react'
import { DEMO_USERS, ROLE_LABELS, type AppUser, type UserRole } from '@/lib/store'
import { AREA_THEME } from '@/lib/areaTheme'
import { Sparkles, User, Lock } from 'lucide-react'
import Dashboard from '@/components/Dashboard'

export default function Home() {
  const [user, setUser] = useState<AppUser | null>(null)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    const stored = sessionStorage.getItem('rubio_user')
    if (stored) {
      try { setUser(JSON.parse(stored)) } catch { sessionStorage.removeItem('rubio_user') }
    }
  }, [])

  function validateAndLogin(u: string, p: string) {
    const found = DEMO_USERS.find(user => user.username === u.trim().toLowerCase() && user.password === p.trim())
    if (found) {
      sessionStorage.setItem('rubio_user', JSON.stringify(found))
      setUser(found)
    } else {
      setError('Usuario o contrasena incorrectos')
    }
  }

  function handleLogin() {
    setError('')
    validateAndLogin(username, password)
  }

  if (user) {
    return <Dashboard user={user} onLogout={() => { sessionStorage.removeItem('rubio_user'); setUser(null) }} />
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: '#FFFFFF',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Subtle background accents */}
      <div style={{
        position: 'absolute', top: 0, right: 0,
        width: '40%', height: '100%',
        background: 'linear-gradient(135deg, transparent 0%, rgba(232,24,10,0.03) 100%)',
        pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', bottom: '-20%', right: '-10%',
        width: '500px', height: '500px',
        background: 'radial-gradient(circle, rgba(232,24,10,0.06) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      <div style={{ width: '100%', maxWidth: '420px', animation: 'fadeInUp 0.5s ease' }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', marginBottom: '8px' }}>
            <div style={{
              width: '52px', height: '52px',
              background: '#E8180A',
              borderRadius: '8px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              position: 'relative', overflow: 'hidden',
            }}>
              <Sparkles size={12} style={{ position: 'absolute', top: '5px', right: '5px', color: 'white', opacity: 0.6 }} />
              <span style={{ fontFamily: 'Bebas Neue', fontSize: '22px', color: 'white' }}>R</span>
            </div>
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontFamily: 'Bebas Neue', fontSize: '28px', color: '#111111', lineHeight: 1, letterSpacing: '1px' }}>
                EL RUBIO
              </div>
              <div style={{ fontFamily: 'Bebas Neue', fontSize: '14px', color: '#E8180A', letterSpacing: '4px', lineHeight: 1 }}>
                DEFENSA TICKET
              </div>
            </div>
          </div>
          <p style={{ color: '#999999', fontSize: '13px', fontFamily: 'Rajdhani', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
            Sistema de Gestion de Tickets
          </p>
        </div>

        {/* Login Card */}
        <div style={{
          background: '#FFFFFF',
          border: '0.5px solid #E5E5E5',
          borderRadius: '12px',
          padding: '36px',
          boxShadow: '0 4px 24px rgba(0,0,0,0.06)',
          position: 'relative',
        }}>
          <div style={{ width: '24px', height: '2px', background: '#E8180A', marginBottom: '20px' }} />
          <h2 style={{ fontFamily: 'Bebas Neue', fontSize: '22px', letterSpacing: '2px', marginBottom: '24px', color: '#111111' }}>
            INICIAR SESION
          </h2>

          <form autoComplete="off">
            <div style={{ marginBottom: '16px' }}>
              <label className="label-field">Usuario</label>
              <div className="input-icon-wrap">
                <User size={16} style={{ color: '#ccc' }} />
                <input
                  className="input-dark"
                  type="text"
                  placeholder="nombre de usuario"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  style={{ background: '#FFFFFF', border: '1px solid #e5e5e5', borderRadius: '6px' }}
                />
              </div>
            </div>
            <div style={{ marginBottom: '24px' }}>
              <label className="label-field">Contrasena</label>
              <div className="input-icon-wrap">
                <Lock size={16} style={{ color: '#ccc' }} />
                <input
                  className="input-dark"
                  type="password"
                  placeholder="contrasena"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  autoComplete="new-password"
                  style={{ background: '#FFFFFF', border: '1px solid #e5e5e5', borderRadius: '6px' }}
                />
              </div>
            </div>
            {error && (
              <div style={{
                background: '#FFF0EF',
                border: '1px solid rgba(232,24,10,0.25)',
                borderRadius: '6px',
                padding: '10px 14px',
                marginBottom: '16px',
                fontSize: '13px',
                color: '#E8180A',
              }}>
                {error}
              </div>
            )}
            <button
              className="btn-red"
              type="button"
              onClick={handleLogin}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = '#C91509' }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = '#E8180A' }}
              style={{ width: '100%', fontSize: '16px', letterSpacing: '1px' }}
            >
              ENTRAR
            </button>
          </form>

          {/* Quick access demo */}
          <div style={{ marginTop: '28px', borderTop: '1px solid #F0F0F0', paddingTop: '20px' }}>
            <p style={{ fontSize: '11px', color: '#BBBBBB', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '10px' }}>
              Acceso rapido (demo)
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {DEMO_USERS.map(u => {
                const t = AREA_THEME[u.role]
                const Icon = t.icon
                return (
                  <button
                    key={u.id}
                    onClick={() => { setUsername(u.username); setPassword(u.password); validateAndLogin(u.username, u.password) }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '5px',
                      background: t.bg,
                      border: 'none',
                      borderRadius: '20px',
                      padding: '5px 11px',
                      fontSize: '11px',
                      color: t.text,
                      cursor: 'pointer',
                      fontFamily: 'Rajdhani',
                      fontWeight: 600,
                      textTransform: 'uppercase',
                      letterSpacing: '0.3px',
                    }}
                  >
                    <Icon size={12} /> {ROLE_LABELS[u.role as UserRole]}
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        <p style={{ textAlign: 'center', marginTop: '20px', fontSize: '11px', color: '#CCCCCC' }}>
          &copy; 2025 El Rubio Defensa &middot; Sistema de Tickets
        </p>
      </div>
    </div>
  )
}
