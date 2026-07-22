'use client'
import { useState, useEffect, useTransition } from 'react'
import {
  ArrowLeft, ChevronRight, ChevronDown, CheckCircle, Circle, Clock, Lock,
  AlertCircle, Calendar, Wrench, Flame, Paintbrush, Sparkles, Hammer,
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
import { friendlyError } from '@/lib/errorMessages'
import StageDialog from './StageDialog'
import { Toast } from '@/components/ui'

interface Props {
  ticketId: string
  user: { id: string; name: string; role: string }
  onBack: () => void
}

const STEP_ICONS: Record<ProductionStep, typeof Hammer> = {
  fabricacion: Hammer,
  soldadura: Flame,
  ferre: Wrench,
  pintura: Paintbrush,
  decoracion: Sparkles,
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
  const [showDetail, setShowDetail] = useState(false)

  useEffect(() => {
    let active = true
    async function load () {
      try {
        const t = await fetchProductionTicketFull(ticketId)
        if (!active) return
        if (!t) { setError('No encontramos este ticket.'); return }
        setTicket(t)
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

  const reload = () => setReloadKey(k => k + 1)

  const progress = ticket ? computeStageProgress(ticket) : []
  const readyToClose = ticket ? ticketIsReadyToClose(ticket) : false
  const currentStage = progress.find(p => p.state === 'actual') ?? null
  const doneCount = progress.filter(p => p.state === 'completada').length

  function handleStageConfirmed () {
    setActiveStep(null)
    reload()
  }

  function handleClose () {
    if (!ticket || !readyToClose || closing) return
    setCloseError('')
    startClosing(async () => {
      const res = await closeTicket(ticket.id)
      if (!res.ok) { setCloseError(friendlyError(res.error)); return }
      setToast(true)
      setTimeout(onBack, 1200)
    })
  }

  if (loading) {
    return <div style={{ padding: '80px 24px', textAlign: 'center', color: 'var(--gray-500)', fontSize: 14 }}>Cargando ticket…</div>
  }

  if (error || !ticket) {
    return (
      <div style={{ padding: '40px 48px' }}>
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, animation: 'fadeInUp 0.25s ease' }}>
      {/* ── Header ── */}
      <div className='workspace-header' style={{ padding: '24px 48px', flexShrink: 0 }}>
        <BackLink onBack={onBack} />
        <h1 style={{ fontSize: 28, fontWeight: 700, color: 'var(--gray-900)', letterSpacing: '-0.03em', lineHeight: 1.1, margin: 0 }}>
          {ticket.vehiculo ?? 'Ticket de producción'}
        </h1>
        <p style={{ fontSize: 14, color: 'var(--gray-500)', marginTop: 6 }}>
          Orden #{ticket.orden ?? '—'} · Factura {ticket.factura ?? '—'} · {ticket.cliente ?? 'Cliente —'}
          {ticket.tipo_trabajo && (
            <> · <strong style={{ color: 'var(--gray-700)' }}>{ticket.tipo_trabajo}</strong>
              {ticket.grado_reparacion && <span> ({ticket.grado_reparacion})</span>}</>
          )}
        </p>
        {ticket.fecha_programada && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, flexWrap: 'wrap' as const }}>
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '5px 14px', background: 'var(--red-50)', color: 'var(--red)',
              borderRadius: 9999, fontSize: 13, fontWeight: 700,
            }}>
              <Calendar size={13} /> Empieza: {formatDateLong(ticket.fecha_programada)}
            </span>
            {ticket.fabricador_name && (
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '5px 14px', background: 'var(--blue-bg)', color: 'var(--blue)',
                borderRadius: 9999, fontSize: 13, fontWeight: 700,
              }}>
                👤 {ticket.fabricador_name}
              </span>
            )}
          </div>
        )}
      </div>

      {/* ── Cuerpo ── */}
      <div style={{ flex: 1, padding: '8px 48px 80px', overflowY: 'auto' }}>

        {/* Barra de progreso de las 5 etapas */}
        <ProgressStrip progress={progress} doneCount={doneCount} />

        {/* ── Acción principal: qué toca ahora ── */}
        {readyToClose ? (
          <div style={{
            marginTop: 24, background: 'var(--green-bg)', border: '1px solid var(--green-ring)',
            borderRadius: 'var(--radius-xl)', padding: '32px 28px', textAlign: 'center',
          }}>
            <CheckCircle size={44} style={{ color: 'var(--green)', marginBottom: 12 }} />
            <h2 style={{ fontSize: 22, fontWeight: 700, color: 'var(--gray-900)', margin: 0 }}>
              ¡Todo listo! Las 5 etapas están completas
            </h2>
            <p style={{ fontSize: 14, color: 'var(--gray-600)', marginTop: 8, marginBottom: 22 }}>
              Costo total de mano de obra: <strong>{formatMoney(ticket.steps.reduce((s, st) => s + Number(st.price), 0))}</strong>
            </p>
            <button
              onClick={handleClose}
              disabled={closing}
              className='btn btn-primary btn-lg'
              style={{ height: 56, fontSize: 17, fontWeight: 700, padding: '0 32px' }}
            >
              {closing ? 'Cerrando…' : '✓ Cerrar ticket'}
            </button>
            {closeError && (
              <div style={{
                marginTop: 14, background: 'var(--red-50)', border: '1px solid var(--red-ring)',
                borderRadius: 'var(--radius)', padding: '10px 14px', fontSize: 14, color: 'var(--red)', fontWeight: 600,
                display: 'inline-flex', alignItems: 'center', gap: 8,
              }}>
                <AlertCircle size={15} /> {closeError}
              </div>
            )}
          </div>
        ) : currentStage ? (
          <CurrentStageCard
            stage={currentStage}
            ticket={ticket}
            onConfirm={() => setActiveStep(currentStage.step)}
          />
        ) : null}

        {/* ── Etapas completadas (resumen compacto) ── */}
        {progress.some(p => p.state === 'completada') && (
          <div style={{ marginTop: 24 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
              Ya terminadas
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {progress.filter(p => p.state === 'completada').map(p => (
                <CompletedChip key={p.step} ticket={ticket} step={p.step} />
              ))}
            </div>
          </div>
        )}

        {/* ── Detalle técnico (escondido) ── */}
        <button
          type='button'
          onClick={() => setShowDetail(s => !s)}
          style={{
            marginTop: 28, display: 'inline-flex', alignItems: 'center', gap: 6,
            background: 'transparent', border: 'none', cursor: 'pointer',
            fontSize: 14, fontWeight: 600, color: 'var(--gray-500)', padding: 0,
          }}
        >
          {showDetail ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
          Ver detalle de piezas
        </button>

        {showDetail && (
          <div className='card' style={{ padding: 0, overflow: 'hidden', marginTop: 12 }}>
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
        )}
      </div>

      {/* Diálogo de confirmación de etapa */}
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
        durationMs={1200}
      />
    </div>
  )
}

// ─────────────────────────────────────────────────────────
// Barra de progreso: 5 etapas
// ─────────────────────────────────────────────────────────
function ProgressStrip ({ progress, doneCount }: { progress: StageProgress[]; doneCount: number }) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--gray-900)' }}>
          Progreso del trabajo
        </span>
        <span style={{ fontSize: 13, color: 'var(--gray-500)', fontWeight: 600 }}>
          {doneCount} de 5 etapas
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {progress.map((p, i) => {
          const Icon = STEP_ICONS[p.step]
          return (
            <div key={p.step} style={{ display: 'flex', alignItems: 'center', flex: 1, gap: 6 }}>
              <div style={{
                flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                padding: '10px 4px', borderRadius: 'var(--radius)',
                background: p.state === 'completada' ? 'var(--green-bg)' : p.state === 'actual' ? 'var(--red-50)' : 'var(--gray-100)',
                border: `1px solid ${p.state === 'completada' ? 'var(--green-ring)' : p.state === 'actual' ? 'var(--red-ring)' : 'transparent'}`,
              }}>
                {p.state === 'completada'
                  ? <CheckCircle size={18} style={{ color: 'var(--green)' }} />
                  : p.state === 'actual'
                    ? <Icon size={18} style={{ color: 'var(--red)' }} />
                    : <Lock size={15} style={{ color: 'var(--gray-400)' }} />}
                <span style={{
                  fontSize: 10.5, fontWeight: 700, textAlign: 'center' as const,
                  color: p.state === 'completada' ? 'var(--green)' : p.state === 'actual' ? 'var(--red)' : 'var(--gray-400)',
                }}>
                  {STEP_LABELS[p.step]}
                </span>
              </div>
              {i < progress.length - 1 && (
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
// Tarjeta grande: la etapa que toca ahora
// ─────────────────────────────────────────────────────────
function CurrentStageCard ({ stage, ticket, onConfirm }: {
  stage: StageProgress
  ticket: ProductionTicketFull
  onConfirm: () => void
}) {
  const Icon = STEP_ICONS[stage.step]
  return (
    <div style={{
      marginTop: 24, background: 'var(--bg-card)', border: '2px solid var(--red)',
      borderRadius: 'var(--radius-xl)', padding: '28px', textAlign: 'center',
      boxShadow: '0 8px 28px rgba(232, 24, 10, 0.10)',
    }}>
      <div style={{
        width: 64, height: 64, borderRadius: '50%', margin: '0 auto 14px',
        background: 'var(--red)', color: '#fff',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: '0 6px 20px rgba(232, 24, 10, 0.35)',
      }}>
        <Icon size={28} />
      </div>
      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--red)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
        Ahora toca
      </div>
      <h2 style={{ fontSize: 30, fontWeight: 700, color: 'var(--gray-900)', margin: '6px 0 4px', letterSpacing: '-0.02em' }}>
        {STEP_LABELS[stage.step]}
      </h2>
      <p style={{ fontSize: 14.5, color: 'var(--gray-500)', margin: '0 0 22px' }}>
        {stage.totalPieces - stage.donePieces} pieza{(stage.totalPieces - stage.donePieces) !== 1 ? 's' : ''} por confirmar
        {stage.step === 'fabricacion' && ticket.fecha_programada && (
          <> · programado para {formatDateLong(ticket.fecha_programada)}</>
        )}
      </p>
      <button
        onClick={onConfirm}
        className='btn btn-primary btn-lg'
        style={{ height: 56, fontSize: 17, fontWeight: 700, padding: '0 32px' }}
      >
        Confirmar {STEP_LABELS[stage.step]} <ChevronRight size={18} />
      </button>
    </div>
  )
}

// ─────────────────────────────────────────────────────────
// Chip de etapa completada
// ─────────────────────────────────────────────────────────
function CompletedChip ({ ticket, step }: { ticket: ProductionTicketFull; step: ProductionStep }) {
  const rows = ticket.steps.filter(s => s.step === step && s.completed_at)
  const employees = [...new Set(rows.map(r => r.employee_name).filter(Boolean) as string[])]
  const last = rows.length ? rows[rows.length - 1].completed_at : null
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 8,
      padding: '8px 14px', background: 'var(--green-bg)', color: 'var(--green)',
      border: '1px solid var(--green-ring)', borderRadius: 9999,
      fontSize: 13, fontWeight: 700,
    }}>
      <CheckCircle size={14} />
      {STEP_LABELS[step]}
      {employees.length > 0 && (
        <span style={{ fontWeight: 500, color: 'var(--gray-600)' }}>· {employees.join(', ')}</span>
      )}
      {last && (
        <span style={{ fontWeight: 500, color: 'var(--gray-500)', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
          <Clock size={11} /> {formatTime(last)}
        </span>
      )}
    </span>
  )
}

// ─────────────────────────────────────────────────────────
function BackLink ({ onBack }: { onBack: () => void }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 6,
      fontSize: 13, color: 'var(--gray-500)', fontWeight: 500, marginBottom: 14,
    }}>
      <button
        onClick={onBack}
        style={{
          background: 'transparent', border: 'none', padding: 0, cursor: 'pointer',
          color: 'var(--gray-500)', display: 'inline-flex', alignItems: 'center', gap: 4,
          fontSize: 13, fontWeight: 600,
        }}
        onMouseEnter={e => e.currentTarget.style.color = 'var(--gray-900)'}
        onMouseLeave={e => e.currentTarget.style.color = 'var(--gray-500)'}
      >
        <ArrowLeft size={14} strokeWidth={2} /> Volver a tickets
      </button>
    </div>
  )
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
  return d.toLocaleDateString('es-DO', { day: 'numeric', month: 'short' })
}
