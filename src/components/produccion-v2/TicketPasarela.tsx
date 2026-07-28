'use client'
import { useState, useEffect, useMemo, useTransition } from 'react'
import {
  ArrowLeft, CheckCircle, Lock, AlertCircle, Calendar, ChevronRight,
  Scissors, CornerUpRight, Wrench, Flame, Clock, User,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import {
  fetchTicketPasarela,
  fetchPersonalPasarela,
  etapaState,
  isEtapaPieza,
  piezaHecha,
  piezaPersona,
  piezaMotivo,
  piezaFecha,
  PASARELA_STAGES,
  ETAPA_LABELS,
  ETAPA_PREGUNTA,
  ETAPA_PERSONA_LABEL,
  type TicketPasarelaFull,
  type TicketPasarelaPieza,
  type PersonalPasarela,
  type EtapaPasarela,
  type EtapaOrden,
  type EtapaPieza,
} from '@/lib/production-v2'
import { setOrderStage, setPieceStage } from '@/app/actions/production'
import { friendlyError } from '@/lib/errorMessages'
import { Toast } from '@/components/ui'

interface Props {
  ticketId: string
  user: { id: string; name: string; role: string }
  onBack: () => void
}

const ETAPA_ICONS: Record<EtapaPasarela, typeof Scissors> = {
  corte: Scissors,
  doblado: CornerUpRight,
  armado: Wrench,
  soldadura: Flame,
}

export default function TicketPasarela ({ ticketId, onBack }: Props) {
  const [ticket, setTicket] = useState<TicketPasarelaFull | null>(null)
  const [personal, setPersonal] = useState<PersonalPasarela[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  const [toast, setToast] = useState('')

  const reload = () => setReloadKey(k => k + 1)

  useEffect(() => {
    let active = true
    async function load () {
      try {
        const [t, p] = await Promise.all([
          fetchTicketPasarela(ticketId),
          fetchPersonalPasarela(true),
        ])
        if (!active) return
        if (!t) { setError('No encontramos este ticket.'); return }
        setTicket(t)
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
  }, [ticketId, reloadKey])

  // Realtime: si otra persona avanza una etapa, esta vista se actualiza sola.
  useEffect(() => {
    const channel = supabase.channel(`pasarela-${ticketId}-${Math.random().toString(36).slice(2)}`)
    channel.on('postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'production_tickets', filter: `id=eq.${ticketId}` },
      () => reload())
    channel.on('postgres_changes',
      { event: '*', schema: 'public', table: 'production_ticket_pasarela', filter: `ticket_id=eq.${ticketId}` },
      () => reload())
    channel.on('postgres_changes',
      { event: '*', schema: 'public', table: 'personal_pasarela' },
      () => reload())
    channel.subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [ticketId])

  const personalPorEtapa = useMemo(() => {
    const m = new Map<EtapaPasarela, PersonalPasarela[]>()
    for (const p of personal) {
      const arr = m.get(p.etapa) ?? []
      arr.push(p)
      m.set(p.etapa, arr)
    }
    return m
  }, [personal])

  if (loading) {
    return <div style={{ padding: '80px 24px', textAlign: 'center', color: 'var(--gray-500)', fontSize: 14 }}>Cargando ticket…</div>
  }

  if (error || !ticket) {
    return (
      <div style={{ padding: '8px 0 40px' }}>
        <BackLink onBack={onBack} />
        <div style={{
          background: 'var(--red-50)', border: '1px solid var(--red-ring)',
          borderRadius: 'var(--radius-lg)', padding: '14px 16px', fontSize: 14, color: 'var(--red)',
          display: 'flex', alignItems: 'center', gap: 10, marginTop: 16,
        }}>
          <AlertCircle size={16} /> {error || 'No encontramos este ticket.'}
        </div>
      </div>
    )
  }

  const completado = ticket.etapa_actual === 'completado'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', animation: 'fadeInUp 0.25s ease' }}>
      <BackLink onBack={onBack} />

      {/* ── Cabecera ── */}
      <h1 style={{
        fontSize: 28, fontWeight: 700, color: 'var(--gray-900)',
        letterSpacing: '-0.03em', lineHeight: 1.1, margin: '4px 0 0',
      }}>
        {ticket.vehiculo ?? 'Ticket de producción'}
      </h1>
      <p style={{ fontSize: 14, color: 'var(--gray-500)', marginTop: 6 }}>
        Orden #{ticket.orden ?? '—'} · Factura {ticket.factura ?? '—'} · {ticket.cliente ?? 'Cliente —'}
      </p>
      {ticket.fecha_programada && (
        <div style={{ marginTop: 10 }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '5px 14px', background: 'var(--red-50)', color: 'var(--red)',
            borderRadius: 9999, fontSize: 13, fontWeight: 700,
          }}>
            <Calendar size={13} /> Empieza: {formatDateLong(ticket.fecha_programada)}
          </span>
        </div>
      )}

      {/* ── Barra de etapas ── */}
      <div style={{ marginTop: 24 }}>
        <ProgressStrip actual={ticket.etapa_actual} />
      </div>

      {/* ── Ticket terminado ── */}
      {completado && (
        <div style={{
          marginTop: 24, background: 'var(--green-bg)', border: '1px solid var(--green-ring)',
          borderRadius: 'var(--radius-xl)', padding: '32px 28px', textAlign: 'center',
        }}>
          <CheckCircle size={44} style={{ color: 'var(--green)', marginBottom: 12 }} />
          <h2 style={{ fontSize: 22, fontWeight: 700, color: 'var(--gray-900)', margin: 0 }}>
            ¡Trabajo completado!
          </h2>
          <p style={{ fontSize: 14, color: 'var(--gray-600)', marginTop: 8 }}>
            Las 4 etapas están listas. El ticket ya está en <strong>Tickets Completados</strong>.
          </p>
        </div>
      )}

      {/* ── Etapas ── */}
      <div style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
        {PASARELA_STAGES.map((etapa, i) => {
          const state = etapaState(etapa, ticket.etapa_actual)
          const anterior = i > 0 ? PASARELA_STAGES[i - 1] : null
          return (
            <EtapaCard
              key={etapa}
              etapa={etapa}
              state={state}
              anterior={anterior}
              ticket={ticket}
              personal={personalPorEtapa.get(etapa) ?? []}
              onSaved={(msg) => { setToast(msg); reload() }}
            />
          )
        })}
      </div>

      <Toast
        open={!!toast}
        tone='success'
        message={toast}
        onClose={() => setToast('')}
        durationMs={2200}
      />
    </div>
  )
}

// ─────────────────────────────────────────────────────────
// Barra horizontal de progreso de las 4 etapas
// ─────────────────────────────────────────────────────────
function ProgressStrip ({ actual }: { actual: TicketPasarelaFull['etapa_actual'] }) {
  const doneCount = PASARELA_STAGES.filter(e => etapaState(e, actual) === 'completada').length
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--gray-900)' }}>Progreso del trabajo</span>
        <span style={{ fontSize: 13, color: 'var(--gray-500)', fontWeight: 600 }}>
          {doneCount} de {PASARELA_STAGES.length} etapas
        </span>
      </div>
      <div className='pasarela-strip'>
        {PASARELA_STAGES.map((etapa, i) => {
          const state = etapaState(etapa, actual)
          const Icon = ETAPA_ICONS[etapa]
          return (
            <div key={etapa} style={{ display: 'flex', alignItems: 'center', flex: 1, gap: 6, minWidth: 0 }}>
              <div style={{
                flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column',
                alignItems: 'center', gap: 6, padding: '10px 4px',
                borderRadius: 'var(--radius)',
                background: state === 'completada' ? 'var(--green-bg)' : state === 'actual' ? 'var(--red-50)' : 'var(--gray-100)',
                border: `1px solid ${state === 'completada' ? 'var(--green-ring)' : state === 'actual' ? 'var(--red-ring)' : 'transparent'}`,
              }}>
                {state === 'completada'
                  ? <CheckCircle size={18} style={{ color: 'var(--green)' }} />
                  : state === 'actual'
                    ? <Icon size={18} style={{ color: 'var(--red)' }} />
                    : <Lock size={15} style={{ color: 'var(--gray-400)' }} />}
                <span style={{
                  fontSize: 11, fontWeight: 700, textAlign: 'center' as const,
                  color: state === 'completada' ? 'var(--green)' : state === 'actual' ? 'var(--red)' : 'var(--gray-400)',
                }}>
                  {ETAPA_LABELS[etapa]}
                </span>
              </div>
              {i < PASARELA_STAGES.length - 1 && (
                <ChevronRight size={14} style={{ color: 'var(--gray-300)', flexShrink: 0 }} />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────
// Tarjeta de una etapa: pasada (resumen), actual (form) o bloqueada
// ─────────────────────────────────────────────────────────
function EtapaCard ({ etapa, state, anterior, ticket, personal, onSaved }: {
  etapa: EtapaPasarela
  state: 'completada' | 'actual' | 'bloqueada'
  anterior: EtapaPasarela | null
  ticket: TicketPasarelaFull
  personal: PersonalPasarela[]
  onSaved: (msg: string) => void
}) {
  const Icon = ETAPA_ICONS[etapa]

  const borde = state === 'actual' ? '2px solid var(--red)' : '1px solid var(--border)'
  const fondo = state === 'bloqueada' ? 'var(--gray-50)' : 'var(--bg-card)'

  return (
    <div style={{
      background: fondo, border: borde, borderRadius: 'var(--radius-xl)',
      padding: '20px 22px', opacity: state === 'bloqueada' ? 0.72 : 1,
      boxShadow: state === 'actual' ? '0 8px 28px rgba(232, 24, 10, 0.10)' : 'none',
    }}>
      {/* Encabezado de la etapa */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: state === 'bloqueada' ? 0 : 16 }}>
        <div style={{
          width: 40, height: 40, borderRadius: 'var(--radius)', flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: state === 'completada' ? 'var(--green-bg)' : state === 'actual' ? 'var(--red)' : 'var(--gray-100)',
          color: state === 'completada' ? 'var(--green)' : state === 'actual' ? '#fff' : 'var(--gray-400)',
        }}>
          {state === 'completada' ? <CheckCircle size={20} /> : state === 'bloqueada' ? <Lock size={17} /> : <Icon size={20} />}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--gray-900)', letterSpacing: '-0.01em' }}>
            {ETAPA_LABELS[etapa]}
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--gray-500)', marginTop: 2 }}>
            {state === 'actual' && 'Ahora toca esta etapa'}
            {state === 'completada' && 'Terminada'}
            {state === 'bloqueada' && anterior && `Se habilita al completar ${ETAPA_LABELS[anterior]}`}
          </div>
        </div>
        {state === 'actual' && (
          <span style={{
            padding: '4px 12px', background: 'var(--red-50)', color: 'var(--red)',
            borderRadius: 9999, fontSize: 11, fontWeight: 700,
            textTransform: 'uppercase' as const, letterSpacing: '0.06em', flexShrink: 0,
          }}>
            En curso
          </span>
        )}
      </div>

      {state === 'completada' && <ResumenEtapa etapa={etapa} ticket={ticket} />}

      {state === 'actual' && (
        isEtapaPieza(etapa)
          ? <FormPiezas etapa={etapa} piezas={ticket.piezas} personal={personal} onSaved={onSaved} />
          : <FormOrden etapa={etapa as EtapaOrden} ticket={ticket} personal={personal} onSaved={onSaved} />
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────
// Resumen de solo lectura de una etapa ya terminada
// ─────────────────────────────────────────────────────────
function ResumenEtapa ({ etapa, ticket }: { etapa: EtapaPasarela; ticket: TicketPasarelaFull }) {
  if (!isEtapaPieza(etapa)) {
    const persona = etapa === 'corte' ? ticket.corte_persona : ticket.doblado_persona
    const fecha = etapa === 'corte' ? ticket.corte_fecha : ticket.doblado_fecha
    return <ResumenLinea persona={persona} fecha={fecha} />
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {ticket.piezas.map(p => (
        <div key={p.id} style={{
          display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' as const,
          padding: '10px 12px', background: 'var(--gray-50)',
          border: '1px solid var(--border)', borderRadius: 'var(--radius)',
        }}>
          <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--gray-900)', minWidth: 90 }}>{p.pieza}</span>
          <ResumenLinea persona={piezaPersona(p, etapa)} fecha={piezaFecha(p, etapa)} compact />
        </div>
      ))}
    </div>
  )
}

function ResumenLinea ({ persona, fecha, compact }: { persona: string | null; fecha: string | null; compact?: boolean }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' as const,
      fontSize: 13.5, color: 'var(--gray-700)',
      ...(compact ? {} : {
        padding: '12px 14px', background: 'var(--green-bg)',
        border: '1px solid var(--green-ring)', borderRadius: 'var(--radius)',
      }),
    }}>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        <User size={13} style={{ color: 'var(--gray-400)' }} />
        <strong style={{ color: 'var(--gray-900)' }}>{persona ?? '—'}</strong>
      </span>
      {fecha && (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: 'var(--gray-500)' }}>
          <Clock size={12} /> {formatTime(fecha)}
        </span>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────
// Formulario de etapa a nivel de ORDEN (Corte / Doblado)
// ─────────────────────────────────────────────────────────
function FormOrden ({ etapa, ticket, personal, onSaved }: {
  etapa: EtapaOrden
  ticket: TicketPasarelaFull
  personal: PersonalPasarela[]
  onSaved: (msg: string) => void
}) {
  const motivoPrevio = etapa === 'corte' ? ticket.corte_motivo : ticket.doblado_motivo
  const [hecho, setHecho] = useState<boolean | null>(motivoPrevio ? false : null)
  const [motivo, setMotivo] = useState(motivoPrevio ?? '')
  const [persona, setPersona] = useState('')
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState('')

  const puedeGuardar = hecho === true
    ? persona.trim() !== ''
    : hecho === false
      ? motivo.trim() !== ''
      : false

  function guardar () {
    if (!puedeGuardar || pending) return
    setError('')
    startTransition(async () => {
      const res = await setOrderStage({
        ticket_id: ticket.id,
        etapa,
        hecho: hecho === true,
        motivo: hecho === false ? motivo : null,
        persona: hecho === true ? persona : null,
      })
      if (!res.ok) { setError(friendlyError(res.error)); return }
      onSaved(hecho ? `${ETAPA_LABELS[etapa]} completado` : 'Motivo guardado')
    })
  }

  return (
    <div>
      <SiNoToggle
        pregunta={ETAPA_PREGUNTA[etapa]}
        value={hecho}
        onChange={v => { setHecho(v); setError('') }}
      />

      {hecho === false && (
        <div style={{ marginTop: 16 }}>
          <label className='form-label'>Motivo<span className='req'>*</span></label>
          <textarea
            className='input-base'
            value={motivo}
            onChange={e => setMotivo(e.target.value)}
            placeholder='¿Por qué no se ha hecho?'
            rows={3}
            style={{ minHeight: 80 }}
          />
        </div>
      )}

      {hecho === true && (
        <div style={{ marginTop: 16 }}>
          <PersonaSelect
            etapa={etapa}
            personal={personal}
            value={persona}
            onChange={setPersona}
          />
        </div>
      )}

      {error && <ErrorLine message={error} />}

      {hecho !== null && (
        <button
          onClick={guardar}
          disabled={!puedeGuardar || pending}
          className='btn btn-primary'
          style={{ marginTop: 18, height: 50, fontSize: 15.5, fontWeight: 700, padding: '0 24px' }}
        >
          {pending ? 'Guardando…' : hecho ? 'Guardar y continuar' : 'Guardar motivo'}
          {!pending && hecho && <ChevronRight size={17} />}
        </button>
      )}

      {hecho === false && (
        <p style={{ fontSize: 12.5, color: 'var(--gray-500)', marginTop: 10, lineHeight: 1.5 }}>
          El motivo queda registrado, pero la etapa sigue pendiente: la siguiente no se habilita hasta marcar <strong>Sí</strong>.
        </p>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────
// Formulario de etapa a nivel de PIEZA (Armado / Soldadura)
// ─────────────────────────────────────────────────────────
interface PiezaForm { hecho: boolean | null; motivo: string; persona: string }

function FormPiezas ({ etapa, piezas, personal, onSaved }: {
  etapa: EtapaPieza
  piezas: TicketPasarelaPieza[]
  personal: PersonalPasarela[]
  onSaved: (msg: string) => void
}) {
  const [forms, setForms] = useState<Record<string, PiezaForm>>(() => {
    const init: Record<string, PiezaForm> = {}
    for (const p of piezas) {
      const hecho = piezaHecha(p, etapa)
      const mot = piezaMotivo(p, etapa)
      init[p.id] = {
        hecho: hecho ? true : mot ? false : null,
        motivo: mot ?? '',
        persona: piezaPersona(p, etapa) ?? '',
      }
    }
    return init
  })
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState('')

  function upd (id: string, patch: Partial<PiezaForm>) {
    setForms(f => ({ ...f, [id]: { ...f[id], ...patch } }))
    setError('')
  }

  // Una pieza es guardable si está resuelta: Sí+persona o No+motivo.
  function piezaValida (id: string): boolean {
    const f = forms[id]
    if (!f) return false
    if (f.hecho === true) return f.persona.trim() !== ''
    if (f.hecho === false) return f.motivo.trim() !== ''
    return false
  }

  const pendientes = piezas.filter(p => !piezaHecha(p, etapa))
  const guardables = pendientes.filter(p => piezaValida(p.id))
  const todasSi = pendientes.length > 0 && pendientes.every(p => forms[p.id]?.hecho === true && forms[p.id].persona.trim() !== '')

  function guardar () {
    if (guardables.length === 0 || pending) return
    setError('')
    startTransition(async () => {
      for (const p of guardables) {
        const f = forms[p.id]
        const res = await setPieceStage({
          pieza_id: p.id,
          etapa,
          hecho: f.hecho === true,
          motivo: f.hecho === false ? f.motivo : null,
          persona: f.hecho === true ? f.persona : null,
        })
        if (!res.ok) { setError(friendlyError(res.error)); return }
      }
      onSaved(todasSi ? `${ETAPA_LABELS[etapa]} completado` : 'Piezas guardadas')
    })
  }

  return (
    <div>
      <p style={{ fontSize: 13.5, color: 'var(--gray-600)', margin: '0 0 14px', lineHeight: 1.5 }}>
        Registra <strong>cada pieza</strong> por separado. La etapa termina cuando todas estén en <strong>Sí</strong> con su responsable.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {piezas.map(p => {
          const yaHecha = piezaHecha(p, etapa)
          const f = forms[p.id] ?? { hecho: null, motivo: '', persona: '' }
          return (
            <div key={p.id} style={{
              border: `1px solid ${yaHecha ? 'var(--green-ring)' : 'var(--border)'}`,
              background: yaHecha ? 'var(--green-bg)' : 'var(--bg-card)',
              borderRadius: 'var(--radius-lg)', padding: '16px 18px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: yaHecha ? 0 : 12 }}>
                <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--gray-900)', flex: 1 }}>{p.pieza}</span>
                {yaHecha && (
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    fontSize: 12.5, fontWeight: 700, color: 'var(--green)',
                  }}>
                    <CheckCircle size={14} /> {piezaPersona(p, etapa) ?? 'Listo'}
                  </span>
                )}
              </div>

              {!yaHecha && (
                <>
                  <SiNoToggle
                    pregunta={ETAPA_PREGUNTA[etapa]}
                    value={f.hecho}
                    onChange={v => upd(p.id, { hecho: v })}
                    small
                  />
                  {f.hecho === false && (
                    <div style={{ marginTop: 12 }}>
                      <label className='form-label'>Motivo<span className='req'>*</span></label>
                      <textarea
                        className='input-base'
                        value={f.motivo}
                        onChange={e => upd(p.id, { motivo: e.target.value })}
                        placeholder='¿Por qué no se ha hecho?'
                        rows={2}
                        style={{ minHeight: 64 }}
                      />
                    </div>
                  )}
                  {f.hecho === true && (
                    <div style={{ marginTop: 12 }}>
                      <PersonaSelect
                        etapa={etapa}
                        personal={personal}
                        value={f.persona}
                        onChange={v => upd(p.id, { persona: v })}
                      />
                    </div>
                  )}
                </>
              )}
            </div>
          )
        })}
      </div>

      {error && <ErrorLine message={error} />}

      <button
        onClick={guardar}
        disabled={guardables.length === 0 || pending}
        className='btn btn-primary'
        style={{ marginTop: 18, height: 50, fontSize: 15.5, fontWeight: 700, padding: '0 24px' }}
      >
        {pending ? 'Guardando…' : 'Guardar etapa'}
      </button>

      {!todasSi && pendientes.length > 0 && (
        <p style={{ fontSize: 12.5, color: 'var(--gray-500)', marginTop: 10, lineHeight: 1.5 }}>
          Faltan {pendientes.length} pieza{pendientes.length !== 1 ? 's' : ''} por marcar en <strong>Sí</strong>.
          Una pieza en <strong>No</strong> guarda el motivo pero deja la etapa pendiente.
        </p>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────
// Piezas de UI compartidas
// ─────────────────────────────────────────────────────────
function SiNoToggle ({ pregunta, value, onChange, small }: {
  pregunta: string
  value: boolean | null
  onChange: (v: boolean) => void
  small?: boolean
}) {
  return (
    <div>
      <div style={{
        fontSize: small ? 13.5 : 15, fontWeight: 700,
        color: 'var(--gray-900)', marginBottom: 8,
      }}>
        {pregunta}
      </div>
      <div style={{ display: 'flex', gap: 10 }}>
        {[{ label: 'Sí', v: true }, { label: 'No', v: false }].map(opt => {
          const active = value === opt.v
          const activeColor = opt.v ? 'var(--green)' : 'var(--red)'
          return (
            <button
              key={opt.label}
              type='button'
              onClick={() => onChange(opt.v)}
              style={{
                flex: small ? '0 0 100px' : '0 0 130px',
                height: small ? 44 : 50,
                fontSize: small ? 15 : 16, fontWeight: 700,
                color: active ? '#fff' : 'var(--gray-800)',
                background: active ? activeColor : 'var(--bg-card)',
                border: `2px solid ${active ? activeColor : 'var(--border)'}`,
                borderRadius: 'var(--radius-lg)', cursor: 'pointer',
                transition: 'all var(--t-fast)',
              }}
            >
              {opt.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function PersonaSelect ({ etapa, personal, value, onChange }: {
  etapa: EtapaPasarela
  personal: PersonalPasarela[]
  value: string
  onChange: (v: string) => void
}) {
  if (personal.length === 0) {
    return (
      <div style={{
        background: 'var(--amber-bg)', border: '1px solid var(--amber-ring)',
        borderRadius: 'var(--radius)', padding: '12px 14px', fontSize: 13.5, color: 'var(--amber)',
      }}>
        No hay personas registradas en {ETAPA_LABELS[etapa]}. Agréguelas en <strong>Áreas</strong>.
      </div>
    )
  }
  return (
    <div>
      <label className='form-label'>{ETAPA_PERSONA_LABEL[etapa]}<span className='req'>*</span></label>
      <select
        className='input-base'
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{ height: 48, fontSize: 15 }}
      >
        <option value=''>Seleccione una persona…</option>
        {personal.map(p => (
          <option key={p.id} value={p.nombre}>{p.nombre}</option>
        ))}
      </select>
    </div>
  )
}

function ErrorLine ({ message }: { message: string }) {
  return (
    <div style={{
      marginTop: 14, background: 'var(--red-50)', border: '1px solid var(--red-ring)',
      borderRadius: 'var(--radius)', padding: '10px 14px', fontSize: 13.5,
      color: 'var(--red)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8,
    }}>
      <AlertCircle size={15} style={{ flexShrink: 0 }} /> {message}
    </div>
  )
}

function BackLink ({ onBack }: { onBack: () => void }) {
  return (
    <button
      onClick={onBack}
      style={{
        background: 'transparent', border: 'none', padding: 0, cursor: 'pointer',
        color: 'var(--gray-500)', display: 'inline-flex', alignItems: 'center', gap: 4,
        fontSize: 13, fontWeight: 600, alignSelf: 'flex-start', marginBottom: 10,
      }}
      onMouseEnter={e => e.currentTarget.style.color = 'var(--gray-900)'}
      onMouseLeave={e => e.currentTarget.style.color = 'var(--gray-500)'}
    >
      <ArrowLeft size={14} strokeWidth={2} /> Volver a tickets
    </button>
  )
}

function formatTime (iso: string): string {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleString('es-DO', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

function formatDateLong (iso: string): string {
  const d = new Date(iso + 'T00:00:00')
  if (isNaN(d.getTime())) return iso
  return d.toLocaleDateString('es-DO', { day: 'numeric', month: 'short' })
}
