'use client'
import { useState, useEffect, useTransition } from 'react'
import {
  ArrowLeft, ChevronRight, CheckCircle, Circle, Clock, User, Lock,
  AlertCircle, Calendar,
} from 'lucide-react'
import {
  fetchProductionTicketFull,
  computeStageProgress,
  ticketIsReadyToClose,
  STEP_LABELS,
  type ProductionTicketFull,
  type ProductionStep,
  type StageProgress,
} from '@/lib/production-v2'
import { closeTicket } from '@/app/actions/production'
import StageDialog from './StageDialog'
import { Toast } from '@/components/ui'

interface Props {
  ticketId: string
  user: { id: string; name: string; role: string }
  onBack: () => void
}

export default function TicketPasarela ({ ticketId, user, onBack }: Props) {
  const [ticket, setTicket] = useState<ProductionTicketFull | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeStep, setActiveStep] = useState<ProductionStep | null>(null)
  const [closing, startClosing] = useTransition()
  const [closeError, setCloseError] = useState('')
  const [toast, setToast] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let active = true
    async function load () {
      try {
        const t = await fetchProductionTicketFull(ticketId)
        if (!active) return
        if (!t) { setError('Ticket no encontrado'); return }
        setTicket(t)
        setError('')
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : String(e))
      } finally {
        if (active) setLoading(false)
      }
    }
    load()
    return () => { active = false }
  }, [ticketId, reloadKey])

  const reload = () => setReloadKey(k => k + 1)

  const progress = ticket ? computeStageProgress(ticket) : []
  const readyToClose = ticket ? ticketIsReadyToClose(ticket) : false

  function handleStageConfirmed () {
    setActiveStep(null)
    reload()
  }

  function handleClose () {
    if (!ticket || !readyToClose || closing) return
    setCloseError('')
    startClosing(async () => {
      const res = await closeTicket(ticket.id)
      if (!res.ok) { setCloseError(res.error ?? 'Error al cerrar'); return }
      setToast(true)
      setTimeout(onBack, 1000)
    })
  }

  if (loading) {
    return <div style={{ padding: '80px 24px', textAlign: 'center', color: 'var(--gray-500)', fontSize: 13.5 }}>Cargando ticket…</div>
  }

  if (error || !ticket) {
    return (
      <div style={{ padding: '40px 48px' }}>
        <BackLink onBack={onBack} />
        <div style={{
          background: 'var(--red-50)', border: '1px solid var(--red-ring)',
          borderRadius: 'var(--radius-lg)', padding: '14px 16px', fontSize: 13.5, color: 'var(--red)',
          display: 'flex', alignItems: 'center', gap: 10, marginTop: 16,
        }}>
          <AlertCircle size={16} /> {error || 'Ticket no encontrado'}
        </div>
      </div>
    )
  }

  const totalCost = ticket.steps.reduce((s, st) => s + Number(st.price), 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, animation: 'fadeInUp 0.25s ease' }}>
      {/* Header */}
      <div className='workspace-header' style={{ padding: '24px 48px', flexShrink: 0 }}>
        <BackLink onBack={onBack} />

        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 24, flexWrap: 'wrap' as const }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <h1 style={{ fontSize: 30, fontWeight: 700, color: 'var(--gray-900)', letterSpacing: '-0.03em', lineHeight: 1.1, margin: 0 }}>
              {ticket.vehiculo ?? 'Ticket de producción'}
            </h1>
            <p style={{ fontSize: 14, color: 'var(--gray-500)', marginTop: 8, lineHeight: 1.5 }}>
              {ticket.orden ? `Orden #${ticket.orden}` : 'Ticket'} · Factura {ticket.factura ?? '—'} · {ticket.cliente ?? 'Cliente —'}
              {ticket.tipo_trabajo && (
                <> · <span style={{ color: 'var(--gray-700)', fontWeight: 600 }}>{ticket.tipo_trabajo}</span>
                  {ticket.grado_reparacion && <span style={{ color: 'var(--gray-500)' }}> ({ticket.grado_reparacion})</span>}</>
              )}
            </p>
            {ticket.fecha_programada && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '4px 12px', background: 'var(--red-50)', color: 'var(--red)',
                  borderRadius: 9999, fontSize: 12, fontWeight: 700,
                }}>
                  <Calendar size={12} /> Inicio fabricación: {formatDateLong(ticket.fecha_programada)}
                </span>
                {ticket.fabricador_name && (
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    padding: '4px 12px', background: 'var(--blue-bg)', color: 'var(--blue)',
                    borderRadius: 9999, fontSize: 12, fontWeight: 700,
                  }}>
                    👤 {ticket.fabricador_name}
                  </span>
                )}
                {ticket.prioridad && ticket.prioridad !== 'normal' && (
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    padding: '4px 12px',
                    background: ticket.prioridad === 'critica' ? 'var(--red-50)' : ticket.prioridad === 'alta' ? 'var(--amber-bg)' : 'var(--gray-100)',
                    color: ticket.prioridad === 'critica' ? 'var(--red)' : ticket.prioridad === 'alta' ? 'var(--amber)' : 'var(--gray-600)',
                    borderRadius: 9999, fontSize: 12, fontWeight: 700, textTransform: 'uppercase',
                  }}>
                    {ticket.prioridad}
                  </span>
                )}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 16, paddingTop: 4 }}>
            <div style={{ textAlign: 'right' as const }}>
              <div style={{ fontSize: 10, color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>
                Costo acumulado
              </div>
              <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--gray-900)', letterSpacing: '-0.02em' }}>
                {formatMoney(totalCost)}
              </div>
            </div>
            <button
              onClick={handleClose}
              disabled={!readyToClose || closing}
              className='btn btn-primary btn-lg'
            >
              {closing ? <><Spinner light /> Cerrando…</> : <><CheckCircle size={16} /> Cerrar ticket</>}
            </button>
          </div>
        </div>

        {closeError && (
          <div style={{
            marginTop: 14, background: 'var(--red-50)', border: '1px solid var(--red-ring)',
            borderRadius: 'var(--radius)', padding: '10px 14px', fontSize: 13, color: 'var(--red)',
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <AlertCircle size={14} /> {closeError}
          </div>
        )}

        {!readyToClose && (
          <p style={{ fontSize: 12.5, color: 'var(--gray-500)', marginTop: 14 }}>
            El ticket se puede cerrar cuando las 5 etapas estén completadas para todas las piezas.
          </p>
        )}
      </div>

      {/* Pasarela */}
      <div style={{ flex: 1, padding: '32px 48px 80px', overflowY: 'auto' }}>
        <PasarelaHorizontal
          ticket={ticket}
          progress={progress}
          readyToClose={readyToClose}
          onStageClick={(step) => setActiveStep(step)}
          onCloseClick={handleClose}
          closing={closing}
        />

        {/* Detalle de piezas */}
        <h2 style={{ fontSize: 15, fontWeight: 600, color: 'var(--gray-900)', marginBottom: 16, marginTop: 40, letterSpacing: '-0.01em' }}>
          Piezas del ticket
        </h2>
        <div className='card' style={{ padding: 0, overflow: 'hidden' }}>
          <table className='table-dark'>
            <thead>
              <tr><th>Pieza</th><th>Cantidad</th><th>Fabricación</th><th>Soldadura</th><th>Ferré</th><th>Pintura</th><th>Decoración</th></tr>
            </thead>
            <tbody>
              {ticket.pieces.map(p => {
                const stepMap = new Map(ticket.steps.filter(s => s.piece_name === p.piece_name).map(s => [s.step, s]))
                return (
                  <tr key={p.id}>
                    <td style={{ color: 'var(--gray-900)', fontWeight: 600 }}>{p.piece_name}</td>
                    <td>{p.quantity}</td>
                    {(['fabricacion','soldadura','ferre','pintura','decoracion'] as ProductionStep[]).map(st => {
                      const s = stepMap.get(st)
                      return (
                        <td key={st}>
                          {s ? (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                              <CheckCircle size={13} style={{ color: 'var(--green)' }} />
                              <span style={{ fontSize: 12.5, color: 'var(--gray-700)', fontWeight: 500 }}>
                                {formatMoney(Number(s.price))}
                              </span>
                            </span>
                          ) : (
                            <span style={{ color: 'var(--gray-300)' }}><Circle size={12} /></span>
                          )}
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Stage dialog */}
      {activeStep && (
        <StageDialog
          ticket={ticket}
          step={activeStep}
          user={user}
          onConfirmed={handleStageConfirmed}
          onClose={() => setActiveStep(null)}
        />
      )}

      <Toast
        open={toast}
        tone='success'
        message='Ticket cerrado y movido a Completados'
        onClose={() => setToast(false)}
        durationMs={1000}
      />
    </div>
  )
}

// ─────────────────────────────────────────────────────────
// Pasarela horizontal
// ─────────────────────────────────────────────────────────
function PasarelaHorizontal ({
  ticket, progress, readyToClose, onStageClick, onCloseClick, closing,
}: {
  ticket: ProductionTicketFull
  progress: StageProgress[]
  readyToClose: boolean
  onStageClick: (step: ProductionStep) => void
  onCloseClick: () => void
  closing: boolean
}) {
  return (
    <div style={{ overflowX: 'auto', paddingBottom: 8 }}>
      <div style={{
        display: 'flex', gap: 12, minWidth: 760, alignItems: 'stretch',
      }}>
        {progress.map((p, i) => (
          <StageCard
            key={p.step}
            label={STEP_LABELS[p.step]}
            state={p.state}
            progress={p}
            ticket={ticket}
            step={p.step}
            onClick={() => onStageClick(p.step)}
            connector={i < progress.length - 1}
          />
        ))}
        {/* Cerrar card */}
        <CloseCard
          ready={readyToClose}
          closing={closing}
          onClick={onCloseClick}
        />
      </div>
    </div>
  )
}

function StageCard ({
  label, state, progress, ticket, step, onClick, connector,
}: {
  label: string
  state: 'completada' | 'actual' | 'pendiente'
  progress: StageProgress
  ticket: ProductionTicketFull
  step: ProductionStep
  onClick: () => void
  connector: boolean
}) {
  const stepRows = ticket.steps.filter(s => s.step === step && s.completed_at)
  const employees = dedupeEmployees(stepRows.map(s => s.employee_name))
  const total = stepRows.reduce((s, r) => s + Number(r.price), 0)
  const lastTime = stepRows.length ? stepRows[stepRows.length - 1].completed_at : null
  const clickable = state !== 'pendiente' || progress.donePieces < progress.totalPieces

  const tone = state === 'completada' ? 'var(--green)' : state === 'actual' ? 'var(--red)' : 'var(--gray-300)'
  const bg = state === 'completada' ? 'var(--green-bg)' : state === 'actual' ? 'var(--red-50)' : 'var(--bg-card)'
  const border = state === 'completada' ? 'var(--green-ring)' : state === 'actual' ? 'var(--red-ring)' : 'var(--border)'

  return (
    <div style={{ display: 'flex', alignItems: 'stretch', flex: 1, minWidth: 150 }}>
      <div
        onClick={clickable ? onClick : undefined}
        className='card'
        style={{
          flex: 1, padding: 16, cursor: clickable ? 'pointer' : 'default',
          background: bg, borderColor: border, position: 'relative',
          opacity: state === 'pendiente' && progress.donePieces === progress.totalPieces ? 0.6 : 1,
        }}
      >
        {/* State icon */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          {state === 'completada' ? (
            <CheckCircle size={18} style={{ color: tone }} />
          ) : state === 'actual' ? (
            <div style={{ width: 16, height: 16, borderRadius: '50%', background: tone, boxShadow: '0 0 0 4px var(--red-ring)' }} />
          ) : (
            <Circle size={18} style={{ color: tone }} />
          )}
          <span style={{
            fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' as const,
            color: state === 'completada' ? 'var(--green)' : state === 'actual' ? 'var(--red)' : 'var(--gray-400)',
          }}>
            {state === 'completada' ? 'Completado' : state === 'actual' ? 'Actual' : 'Pendiente'}
          </span>
        </div>

        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--gray-900)', marginBottom: 4 }}>{label}</div>
        <div style={{ fontSize: 11.5, color: 'var(--gray-500)', marginBottom: 12 }}>
          {progress.donePieces}/{progress.totalPieces} piezas
        </div>

        {/* Content */}
        {state === 'completada' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {employees.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--gray-700)' }}>
                <User size={11} style={{ color: 'var(--gray-400)' }} />
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>
                  {employees.join(', ')}
                </span>
              </div>
            )}
            {lastTime && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11.5, color: 'var(--gray-500)' }}>
                <Clock size={11} /> {formatTime(lastTime)}
              </div>
            )}
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--green)', marginTop: 4 }}>{formatMoney(total)}</div>
          </div>
        ) : state === 'actual' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {step === 'fabricacion' && ticket.fecha_programada && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11.5, color: 'var(--red)', fontWeight: 600 }}>
                <Calendar size={11} /> Programado: {formatDateLong(ticket.fecha_programada)}
              </div>
            )}
            <div style={{ fontSize: 12.5, color: 'var(--red)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
              Confirmar →
            </div>
          </div>
        ) : (
          <div style={{ fontSize: 12, color: 'var(--gray-400)', display: 'flex', alignItems: 'center', gap: 4 }}>
            <Lock size={11} /> en cola
          </div>
        )}
      </div>

      {connector && (
        <div style={{ display: 'flex', alignItems: 'center', color: 'var(--gray-200)', padding: '0 2px' }}>
          <ChevronRight size={16} />
        </div>
      )}
    </div>
  )
}

function CloseCard ({ ready, closing, onClick }: { ready: boolean; closing: boolean; onClick: () => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'stretch', minWidth: 160 }}>
      <div style={{ display: 'flex', alignItems: 'center', color: ready ? 'var(--gray-300)' : 'var(--gray-200)', padding: '0 2px' }}>
        <ChevronRight size={16} />
      </div>
      <div
        onClick={ready && !closing ? onClick : undefined}
        className='card'
        style={{
          flex: 1, padding: 16, cursor: ready && !closing ? 'pointer' : 'default',
          background: ready ? 'var(--red)' : 'var(--bg-card)',
          borderColor: ready ? 'var(--red)' : 'var(--border)',
          color: ready ? '#fff' : 'var(--gray-500)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          {ready ? <CheckCircle size={18} /> : <Lock size={18} style={{ color: 'var(--gray-300)' }} />}
          <span style={{
            fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' as const,
            color: ready ? '#fff' : 'var(--gray-400)',
          }}>
            {ready ? 'Listo' : 'Bloqueado'}
          </span>
        </div>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>Cerrar</div>
        <div style={{ fontSize: 11.5, opacity: 0.85, marginBottom: 12 }}>
          {ready ? 'Calcula costo total' : 'Faltan etapas'}
        </div>
        <div style={{ fontSize: 12.5, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
          {closing ? 'Cerrando…' : ready ? 'Cerrar ticket →' : 'en cola'}
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────
function BackLink ({ onBack }: { onBack: () => void }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 6,
      fontSize: 12, color: 'var(--gray-500)', fontWeight: 500, marginBottom: 16,
    }}>
      <button
        onClick={onBack}
        style={{
          background: 'transparent', border: 'none', padding: 0, cursor: 'pointer',
          color: 'var(--gray-500)', display: 'inline-flex', alignItems: 'center', gap: 4,
          fontSize: 12, fontWeight: 500,
        }}
        onMouseEnter={e => e.currentTarget.style.color = 'var(--gray-900)'}
        onMouseLeave={e => e.currentTarget.style.color = 'var(--gray-500)'}
      >
        <ArrowLeft size={12} strokeWidth={2} /> Producción
      </button>
      <ChevronRight size={12} strokeWidth={2} style={{ color: 'var(--gray-400)' }} />
      <span style={{ color: 'var(--gray-700)', fontWeight: 600 }}>Pasarela</span>
    </div>
  )
}

function Spinner ({ light = false }: { light?: boolean }) {
  return (
    <div style={{
      width: 14, height: 14,
      border: `2px solid ${light ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.2)'}`,
      borderTopColor: light ? '#fff' : 'currentColor',
      borderRadius: '50%', animation: 'spin 0.7s linear infinite',
    }} />
  )
}

function dedupeEmployees (names: (string | null)[]): string[] {
  const set = new Set<string>()
  for (const n of names) if (n && n.trim()) set.add(n.trim())
  return [...set]
}

function formatMoney (n: number): string {
  return 'RD$ ' + n.toLocaleString('es-DO', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
}

function formatTime (iso: string): string {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleString('es-DO', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

function formatDateLong (iso: string): string {
  const d = new Date(iso + 'T00:00:00')
  if (isNaN(d.getTime())) return iso
  return d.toLocaleDateString('es-DO', { day: 'numeric', month: 'short', year: 'numeric' })
}
