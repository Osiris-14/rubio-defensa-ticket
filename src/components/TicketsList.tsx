'use client'
import { useState, useEffect } from 'react'
import { type AppUser, type UserRole, getTickets, getAllTickets, ticketsToCSV, AREA_ROLES } from '@/lib/store'
import { supabase } from '@/lib/supabase'
import { AREA_THEME } from '@/lib/areaTheme'
import { Search, Download } from 'lucide-react'
import TicketRow from './TicketRow'

interface Props { user: AppUser }

export default function TicketsList({ user }: Props) {
  const [tickets, setTickets] = useState<Record<string, unknown>[]>([])
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Record<string, unknown> | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    async function load() {
      try {
        const data = user.role === 'admin' ? await getAllTickets() : await getTickets(user.role)
        if (!active) return
        setTickets(data)
        setError('')
      } catch (err) {
        if (active) setError((err as Error).message)
      } finally {
        if (active) setLoading(false)
      }
    }
    load()

    // Live updates: admin watches all areas, others just their own.
    const roles = user.role === 'admin' ? AREA_ROLES : [user.role]
    const channel = supabase.channel(`tickets-list-${user.role}-${Math.random().toString(36).slice(2)}`)
    for (const r of roles) {
      channel.on('postgres_changes', { event: 'INSERT', schema: 'public', table: `tickets_${r}` }, () => load())
    }
    channel.subscribe()

    return () => { active = false; supabase.removeChannel(channel) }
  }, [user.role])

  const filtered = tickets.filter(t =>
    !search ||
    String(t.numero_factura || '').toLowerCase().includes(search.toLowerCase()) ||
    String(t.numero_orden || '').toLowerCase().includes(search.toLowerCase()) ||
    String(t.modelo || '').toLowerCase().includes(search.toLowerCase())
  )

  const emptyTheme = AREA_THEME[user.role] || AREA_THEME.admin

  async function handleExport() {
    let csv: string
    try {
      csv = await ticketsToCSV(user.role)
    } catch (err) {
      alert('Error al exportar: ' + (err as Error).message); return
    }
    if (!csv) { alert('No hay tickets.'); return }
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url
    a.download = `rubio_${user.role}_${new Date().toISOString().split('T')[0]}.csv`
    a.click(); URL.revokeObjectURL(url)
  }

  return (
    <div style={{ animation: 'fadeInUp 0.4s ease', padding: '40px 48px 64px' }}>
      {/* Toolbar: búsqueda + exportar. El título ("Todos los tickets") ya vive
          en el header del workspace — no se repite aquí. */}
      <div style={{ marginBottom: '20px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
        <div style={{ flex: '1 1 280px', maxWidth: '400px' }}>
          <div className="input-icon-wrap">
            <Search size={16} style={{ color: '#ccc' }} />
            <input
              className="input-dark"
              placeholder="Buscar por factura, orden, modelo..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ background: '#FFFFFF', border: '1px solid #e5e5e5', borderRadius: '8px' }}
            />
          </div>
          {/* Conteo de resultados: directamente bajo la búsqueda, muted */}
          <p style={{ color: '#999999', fontSize: '12px', marginTop: '8px' }}>
            <span style={{ fontWeight: 700, color: emptyTheme.text }}>{filtered.length}</span> ticket(s) encontrado(s)
          </p>
        </div>
        {user.role !== 'admin' && (
          <button
            onClick={handleExport}
            onMouseEnter={e => { e.currentTarget.style.background = '#fff5f4'; e.currentTarget.style.borderColor = '#E8180A' }}
            onMouseLeave={e => { e.currentTarget.style.background = '#FFFFFF'; e.currentTarget.style.borderColor = '#e5e5e5' }}
            style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              background: '#FFFFFF', color: '#666666', border: '1px solid #e5e5e5',
              borderRadius: '8px', padding: '10px 16px', cursor: 'pointer',
              fontFamily: 'var(--font-sans)', fontSize: '13px', fontWeight: 600,
              transition: 'background var(--t-fast), border-color var(--t-fast)',
            }}
          >
            <Download size={15} style={{ color: '#E8180A' }} /> Exportar CSV
          </button>
        )}
      </div>

      {error && (
        <div style={{
          background: '#FFF0EF', border: '1px solid rgba(232,24,10,0.25)', borderRadius: '8px',
          padding: '12px 16px', marginBottom: '16px', fontSize: '13px', color: '#E8180A',
        }}>
          No se pudieron cargar los tickets: {error}
        </div>
      )}

      {/* Rows */}
      {loading ? (
        <div style={{ padding: '60px 24px', textAlign: 'center', background: '#F7F7F7', borderRadius: '10px', color: '#999999', fontSize: '13px' }}>
          Cargando…
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ padding: '60px 24px', textAlign: 'center', background: '#F7F7F7', borderRadius: '10px' }}>
          <div style={{
            width: '40px', height: '40px', borderRadius: '50%',
            background: '#fff0ef', color: '#E8180A',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: '14px',
          }}>
            <Search size={20} />
          </div>
          <p style={{ color: '#111111', fontSize: '15px', fontWeight: 600, marginBottom: '4px' }}>No hay tickets todavía</p>
          <p style={{ color: '#999999', fontSize: '12px' }}>Los tickets completados aparecerán aquí</p>
        </div>
      ) : (
        <div>
          {filtered.map((t, i) => (
            <TicketRow
              key={i}
              ticket={t}
              role={user.role === 'admin' ? (t.role as UserRole) : user.role}
              onClick={() => setSelected(t)}
            />
          ))}
        </div>
      )}

      {/* Detail modal */}
      {selected && (
        <div className="modal-overlay" onClick={() => setSelected(null)}>
          <div onClick={e => e.stopPropagation()} className="modal-card" style={{
            padding: '32px', maxWidth: '600px', width: '100%', maxHeight: '80vh', overflowY: 'auto',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <div>
                <div className="accent-line" style={{ background: emptyTheme.text }} />
                <h2 style={{ fontFamily: 'var(--font-sans)', fontSize: '20px', fontWeight: 700, letterSpacing: '-0.02em', color: '#111111' }}>
                  Detalle del ticket
                </h2>
              </div>
              <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', color: '#999999', cursor: 'pointer', fontSize: '20px' }}>&#10005;</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              {Object.entries(selected).filter(([k]) => !['id', 'fotos', 'fotos_urls', 'role', 'user_id'].includes(k)).map(([key, val]) => (
                <div key={key} style={{ borderBottom: '1px solid #F0F0F0', paddingBottom: '12px' }}>
                  <div style={{ fontSize: '10px', color: '#BBBBBB', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>
                    {key.replace(/_/g, ' ')}
                  </div>
                  <div style={{ fontSize: '14px', color: '#111111', fontWeight: 500 }}>
                    {Array.isArray(val) ? (val as string[]).join(', ') : String(val || '-')}
                  </div>
                </div>
              ))}
            </div>

            <TicketPhotos fotosUrls={selected.fotos_urls} />
          </div>
        </div>
      )}
    </div>
  )
}

const VIDEO_RE = /\.(mp4|mov|webm|avi|mkv|m4v)(\?|$)/i

function TicketPhotos({ fotosUrls }: { fotosUrls: unknown }) {
  const groups = fotosUrls && typeof fotosUrls === 'object'
    ? (Object.entries(fotosUrls as Record<string, unknown>)
        .filter(([, v]) => Array.isArray(v) && v.length > 0) as [string, string[]][])
    : []
  if (groups.length === 0) return null

  return (
    <div style={{ marginTop: '24px', borderTop: '1px solid #F0F0F0', paddingTop: '20px' }}>
      <div style={{ fontSize: '10px', color: '#BBBBBB', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '12px' }}>
        Fotos / Videos
      </div>
      {groups.map(([field, urls]) => (
        <div key={field} style={{ marginBottom: '16px' }}>
          <div style={{ fontSize: '11px', color: '#888888', fontWeight: 600, marginBottom: '6px' }}>
            {field.replace(/_/g, ' ')}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {urls.map((url, i) => (
              <a
                key={i}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  width: '76px', height: '76px', borderRadius: '6px', overflow: 'hidden',
                  border: '1px solid #E5E5E5', background: '#F7F7F7', textDecoration: 'none',
                }}
                title="Abrir en una pestaña nueva"
              >
                {VIDEO_RE.test(url)
                  ? <span style={{ fontSize: '12px', color: '#E8180A', fontWeight: 700 }}>▶ Video</span>
                  : <img src={url} alt={field} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
              </a>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
