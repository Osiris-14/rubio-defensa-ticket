'use client'
import { useState, useEffect } from 'react'
import { DEMO_USERS, type AppUser } from '@/lib/store'
import { User, Lock, ArrowRight } from 'lucide-react'
import Dashboard from '@/components/Dashboard'

export default function Home() {
  const [user, setUser] = useState<AppUser | null>(null)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    const stored = sessionStorage.getItem('rubio_user')
    if (stored) {
      try {
        const parsed = JSON.parse(stored)
        queueMicrotask(() => { if (active) setUser(parsed) })
      } catch {
        sessionStorage.removeItem('rubio_user')
      }
    }
    return () => { active = false }
  }, [])

  function validateAndLogin(u: string, p: string) {
    const found = DEMO_USERS.find(user => user.username === u.trim().toLowerCase() && user.password === p.trim())
    if (found) {
      sessionStorage.setItem('rubio_user', JSON.stringify(found))
      setUser(found)
    } else {
      setError('Usuario o contraseña incorrectos')
    }
  }

  function handleLogin() {
    setError('')
    validateAndLogin(username, password)
  }

  if (user) {
    return <Dashboard user={user} onLogout={() => { sessionStorage.removeItem('rubio_user'); setUser(null) }} />
  }

  const features = [
    { title: 'Recepción & Producción', subtitle: 'Control de ingreso y fabricación' },
    { title: 'Pintura & Instalación', subtitle: 'Seguimiento por departamento' },
    { title: 'Dashboard en tiempo real', subtitle: 'KPIs y resumen operativo' },
  ]

  return (
    <div style={{
      minHeight: '100vh',
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
    }}>
      {/* ── Left: dark brand panel ── */}
      <div style={{
        background: 'var(--bg-sidebar)',
        position: 'relative',
        overflow: 'hidden',
        padding: '64px 72px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
      }}>
        {/* Grid pattern */}
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: `
            linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)
          `,
          backgroundSize: '40px 40px',
          pointerEvents: 'none',
        }} />
        {/* Subtle red glow */}
        <div style={{
          position: 'absolute', top: '-15%', right: '-10%',
          width: 500, height: 500,
          background: 'radial-gradient(circle, rgba(232,24,10,0.10) 0%, transparent 65%)',
          pointerEvents: 'none',
        }} />

        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 42, height: 42, background: 'var(--red)', borderRadius: 'var(--radius)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 700, color: 'white', fontSize: 19,
            boxShadow: '0 4px 18px rgba(232, 24, 10, 0.4)',
          }}>R</div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'white', letterSpacing: '0.02em' }}>EL RUBIO</div>
            <div style={{ fontSize: 10, color: 'var(--red)', fontWeight: 700, letterSpacing: '0.18em', marginTop: 3 }}>DEFENSA TICKET</div>
          </div>
        </div>

        <div style={{ position: 'relative' }}>
          <h1 style={{
            fontSize: 40, fontWeight: 700, color: 'white',
            lineHeight: 1.1, letterSpacing: '-0.025em',
            margin: 0, marginBottom: 16,
          }}>
            Sistema de Gestión
            <br />de Producción
          </h1>
          <p style={{
            fontSize: 16, color: 'var(--gray-400)', lineHeight: 1.6,
            margin: 0, maxWidth: 460,
          }}>
            Plataforma centralizada para la gestión de tickets de producción, instalación y control de calidad.
          </p>
        </div>

        <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {features.map((f) => (
            <div key={f.title} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
              <div style={{
                width: 7, height: 7, borderRadius: '50%',
                background: 'var(--red)', marginTop: 8, flexShrink: 0,
                boxShadow: '0 0 0 3px rgba(232, 24, 10, 0.15)',
              }} />
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'white' }}>{f.title}</div>
                <div style={{ fontSize: 12.5, color: 'var(--gray-500)', marginTop: 2 }}>{f.subtitle}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Right: form panel ── */}
      <div style={{
        background: 'var(--bg-card)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '64px 72px',
      }}>
        <div style={{ width: '100%', maxWidth: 380 }}>
          <h2 style={{
            fontSize: 28, fontWeight: 700, color: 'var(--gray-900)',
            letterSpacing: '-0.02em', margin: 0, marginBottom: 8,
          }}>
            Iniciar Sesión
          </h2>
          <p style={{ color: 'var(--gray-500)', fontSize: 14, marginTop: 0, marginBottom: 32 }}>
            Ingresa tus credenciales para continuar
          </p>

          <form autoComplete="off" onSubmit={e => { e.preventDefault(); handleLogin() }}>
            <div style={{ marginBottom: 16 }}>
              <label className="form-label">Usuario</label>
              <div style={{ position: 'relative' }}>
                <User size={15} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--gray-400)', pointerEvents: 'none' }} />
                <input
                  className="input-base"
                  type="text"
                  placeholder="nombre de usuario"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  style={{ paddingLeft: 40 }}
                />
              </div>
            </div>

            <div style={{ marginBottom: 24 }}>
              <label className="form-label">Contraseña</label>
              <div style={{ position: 'relative' }}>
                <Lock size={15} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--gray-400)', pointerEvents: 'none' }} />
                <input
                  className="input-base"
                  type="password"
                  placeholder="contraseña"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  autoComplete="new-password"
                  style={{ paddingLeft: 40 }}
                />
              </div>
            </div>

            {error && (
              <div style={{
                background: 'var(--red-50)',
                border: '1px solid var(--red-ring)',
                borderRadius: 'var(--radius-lg)',
                padding: '10px 14px',
                marginBottom: 16,
                fontSize: 13,
                color: 'var(--red)',
              }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              className="btn btn-primary btn-lg"
              style={{ width: '100%' }}
            >
              Ingresar al Sistema
              <ArrowRight size={16} strokeWidth={2} />
            </button>
          </form>

          <div style={{ marginTop: 40, textAlign: 'center' }}>
            <p style={{ fontSize: 12, color: 'var(--gray-500)', margin: 0 }}>Rubio Defensas Ticket · Sistema ERP v2.0</p>
            <p style={{ fontSize: 11, color: 'var(--gray-400)', margin: '4px 0 0' }}>© 2026 El Rubio. Todos los derechos reservados.</p>
          </div>
        </div>
      </div>
    </div>
  )
}
