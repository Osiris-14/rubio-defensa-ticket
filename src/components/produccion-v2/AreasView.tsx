'use client'
import { useState, useEffect, useMemo, useTransition } from 'react'
import {
  Plus, Trash2, AlertCircle, ChevronRight, Users,
  Scissors, CornerUpRight, Wrench, Flame, EyeOff, Eye,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import {
  fetchPersonalPasarela,
  PASARELA_STAGES,
  ETAPA_LABELS,
  ETAPA_PERSONA_LABEL,
  type PersonalPasarela,
  type EtapaPasarela,
} from '@/lib/production-v2'
import {
  addPersonalPasarela,
  togglePersonalPasarela,
  deletePersonalPasarela,
} from '@/app/actions/production'
import { friendlyError } from '@/lib/errorMessages'
import { Toast } from '@/components/ui'

interface Props {
  user: { id: string; name: string; role: string }
}

const ETAPA_ICONS: Record<EtapaPasarela, typeof Scissors> = {
  corte: Scissors,
  doblado: CornerUpRight,
  armado: Wrench,
  soldadura: Flame,
}

const ETAPA_DESC: Record<EtapaPasarela, string> = {
  corte: 'Quienes cortan la lámina. Se asigna una sola persona por orden.',
  doblado: 'Quienes doblan las piezas. Se asigna una sola persona por orden.',
  armado: 'Quienes arman las piezas. Se asigna una persona por cada pieza.',
  soldadura: 'Quienes sueldan las piezas. Se asigna una persona por cada pieza.',
}

export default function AreasView ({ user }: Props) {
  const [personal, setPersonal] = useState<PersonalPasarela[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')
  const [reloadKey, setReloadKey] = useState(0)

  const puedeEditar = user.role === 'admin' || user.role === 'produccion'
  const reload = () => setReloadKey(k => k + 1)

  useEffect(() => {
    let active = true
    async function load () {
      try {
        // activeOnly=false: el admin también ve los desactivados para reactivarlos.
        const p = await fetchPersonalPasarela(false)
        if (!active) return
        setPersonal(p)
        setError('')
      } catch (e) {
        if (active) setError(friendlyError(e))
      } finally {
        if (active) setLoading(false)
      }
    }
    load()
    return () => { active = false }
  }, [reloadKey])

  // Realtime: si otro admin agrega o quita gente, la lista se actualiza sola.
  useEffect(() => {
    const channel = supabase.channel(`areas-${Math.random().toString(36).slice(2)}`)
    channel.on('postgres_changes',
      { event: '*', schema: 'public', table: 'personal_pasarela' },
      () => reload())
    channel.subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])

  const porEtapa = useMemo(() => {
    const m = new Map<EtapaPasarela, PersonalPasarela[]>()
    for (const e of PASARELA_STAGES) m.set(e, [])
    for (const p of personal) m.get(p.etapa)?.push(p)
    return m
  }, [personal])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      {/* Cabecera */}
      <div className='workspace-header' style={{ padding: '24px 48px 20px', flexShrink: 0 }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          fontSize: 12, color: 'var(--gray-500)', fontWeight: 500, marginBottom: 16,
        }}>
          <span>Operación</span>
          <ChevronRight size={12} strokeWidth={2} style={{ color: 'var(--gray-400)' }} />
          <span style={{ color: 'var(--gray-700)', fontWeight: 600 }}>Áreas</span>
        </div>
        <h1 style={{
          fontSize: 30, fontWeight: 700, color: 'var(--gray-900)',
          letterSpacing: '-0.03em', lineHeight: 1.1, margin: 0,
        }}>
          Áreas de la pasarela
        </h1>
        <p style={{ fontSize: 14, color: 'var(--gray-500)', marginTop: 8, lineHeight: 1.5, maxWidth: 620 }}>
          El personal de cada área es el que aparece para elegir en la pasarela de cada ticket.
        </p>
      </div>

      {/* Contenido */}
      <div style={{ flex: 1, padding: '24px 48px 80px', overflowY: 'auto' }}>
        {error && (
          <div style={{
            background: 'var(--red-50)', border: '1px solid var(--red-ring)',
            borderRadius: 'var(--radius-lg)', padding: '12px 16px',
            marginBottom: 20, fontSize: 13.5, color: 'var(--red)',
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <AlertCircle size={16} /> {error}
          </div>
        )}

        {loading ? (
          <div style={{ padding: '80px 24px', textAlign: 'center', color: 'var(--gray-500)', fontSize: 13.5 }}>
            Cargando áreas…
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
            gap: 16,
          }}>
            {PASARELA_STAGES.map(etapa => (
              <AreaCard
                key={etapa}
                etapa={etapa}
                gente={porEtapa.get(etapa) ?? []}
                puedeEditar={puedeEditar}
                onChanged={(msg) => { setToast(msg); reload() }}
                onError={setError}
              />
            ))}
          </div>
        )}
      </div>

      <Toast
        open={!!toast}
        tone='success'
        message={toast}
        onClose={() => setToast('')}
        durationMs={2000}
      />
    </div>
  )
}

// ─────────────────────────────────────────────────────────
function AreaCard ({ etapa, gente, puedeEditar, onChanged, onError }: {
  etapa: EtapaPasarela
  gente: PersonalPasarela[]
  puedeEditar: boolean
  onChanged: (msg: string) => void
  onError: (msg: string) => void
}) {
  const [nombre, setNombre] = useState('')
  const [pending, startTransition] = useTransition()
  const Icon = ETAPA_ICONS[etapa]

  const activos = gente.filter(g => g.activo)

  function agregar () {
    const clean = nombre.trim()
    if (!clean || pending) return
    startTransition(async () => {
      const res = await addPersonalPasarela({ etapa, nombre: clean })
      if (!res.ok) { onError(friendlyError(res.error)); return }
      setNombre('')
      onChanged(`${clean} agregado a ${ETAPA_LABELS[etapa]}`)
    })
  }

  function alternar (p: PersonalPasarela) {
    if (pending) return
    startTransition(async () => {
      const res = await togglePersonalPasarela(p.id, !p.activo)
      if (!res.ok) { onError(friendlyError(res.error)); return }
      onChanged(p.activo ? `${p.nombre} desactivado` : `${p.nombre} reactivado`)
    })
  }

  function eliminar (p: PersonalPasarela) {
    if (pending) return
    if (!confirm(`¿Eliminar a ${p.nombre} de ${ETAPA_LABELS[etapa]}?`)) return
    startTransition(async () => {
      const res = await deletePersonalPasarela(p.id)
      if (!res.ok) { onError(friendlyError(res.error)); return }
      onChanged(`${p.nombre} eliminado`)
    })
  }

  return (
    <div className='card' style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      {/* Cabecera del área */}
      <div style={{
        padding: '18px 20px', borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'flex-start', gap: 12,
      }}>
        <div style={{
          width: 40, height: 40, borderRadius: 'var(--radius)', flexShrink: 0,
          background: 'var(--red-50)', color: 'var(--red)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon size={19} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--gray-900)', letterSpacing: '-0.01em' }}>
            {ETAPA_LABELS[etapa]}
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--gray-500)', marginTop: 3, lineHeight: 1.45 }}>
            {ETAPA_DESC[etapa]}
          </div>
        </div>
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 5, flexShrink: 0,
          fontSize: 12, fontWeight: 700, color: 'var(--gray-500)',
          background: 'var(--gray-100)', padding: '3px 10px', borderRadius: 9999,
        }}>
          <Users size={12} /> {activos.length}
        </span>
      </div>

      {/* Lista de personas */}
      <div style={{ flex: 1, padding: '8px 20px' }}>
        {gente.length === 0 ? (
          <div style={{ padding: '20px 0', fontSize: 13, color: 'var(--gray-500)', textAlign: 'center' }}>
            Sin {ETAPA_PERSONA_LABEL[etapa].toLowerCase()}es todavía.
          </div>
        ) : gente.map((p, i) => (
          <div key={p.id} style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '11px 0',
            borderTop: i === 0 ? 'none' : '1px solid var(--border-subtle)',
            opacity: p.activo ? 1 : 0.5,
          }}>
            <span style={{
              width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
              background: p.activo ? 'var(--red-50)' : 'var(--gray-100)',
              color: p.activo ? 'var(--red)' : 'var(--gray-500)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 12, fontWeight: 700,
            }}>
              {p.nombre.charAt(0).toUpperCase()}
            </span>
            <span style={{
              flex: 1, minWidth: 0, fontSize: 14, fontWeight: 600, color: 'var(--gray-900)',
              textDecoration: p.activo ? 'none' : 'line-through',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const,
            }}>
              {p.nombre}
            </span>
            {puedeEditar && (
              <>
                <button
                  onClick={() => alternar(p)}
                  disabled={pending}
                  title={p.activo ? 'Desactivar (deja de aparecer en la pasarela)' : 'Reactivar'}
                  aria-label={p.activo ? 'Desactivar' : 'Reactivar'}
                  style={iconBtn}
                >
                  {p.activo ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
                <button
                  onClick={() => eliminar(p)}
                  disabled={pending}
                  title='Eliminar'
                  aria-label='Eliminar'
                  style={{ ...iconBtn, color: 'var(--red)' }}
                >
                  <Trash2 size={15} />
                </button>
              </>
            )}
          </div>
        ))}
      </div>

      {/* Agregar persona */}
      {puedeEditar && (
        <div style={{ padding: '14px 20px 18px', borderTop: '1px solid var(--border)', background: 'var(--bg-page)' }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type='text'
              className='input-base'
              value={nombre}
              onChange={e => setNombre(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); agregar() } }}
              placeholder={`Nombre del ${ETAPA_PERSONA_LABEL[etapa].toLowerCase()}`}
              style={{ flex: 1, height: 42 }}
            />
            <button
              onClick={agregar}
              disabled={!nombre.trim() || pending}
              className='btn btn-primary'
              style={{ height: 42, padding: '0 16px', fontWeight: 700, flexShrink: 0 }}
            >
              <Plus size={15} strokeWidth={2.5} /> Agregar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

const iconBtn: React.CSSProperties = {
  background: 'transparent',
  border: 'none',
  padding: 5,
  borderRadius: 'var(--radius-sm)',
  cursor: 'pointer',
  color: 'var(--gray-500)',
  display: 'inline-flex',
  alignItems: 'center',
  flexShrink: 0,
}
