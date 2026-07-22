'use client'
import { useState, useEffect } from 'react'
import { ChevronRight, AlertCircle, Calendar, Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import {
  fetchProductionTickets,
  PRODUCTION_STEPS,
  STEP_LABELS,
  type ProductionTicket,
  type ProductionStep,
} from '@/lib/production-v2'
import { friendlyError } from '@/lib/errorMessages'
import TicketPasarela from './TicketPasarela'

interface Props {
  user: { id: string; name: string; role: string }
  onChanged: () => void
}

interface TicketProgress {
  doneStages: number
  currentLabel: string | null
  totalPieces: number
}

export default function TicketsPendientesTab ({ user, onChanged }: Props) {
  const [tickets, setTickets] = useState<ProductionTicket[]>([])
  const [progressMap, setProgressMap] = useState<Record<string, TicketProgress>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let active = true
    async function load () {
      try {
        const t = await fetchProductionTickets('pendiente')
        if (!active) return
        setTickets(t)

        // Progreso de cada ticket: etapas completadas de sus piezas
        if (t.length > 0) {
          const ids = t.map(x => x.id)
          const [stepsRes, piecesRes] = await Promise.all([
            supabase.from('production_ticket_steps').select('ticket_id, step, piece_name, completed_at').in('ticket_id', ids),
            supabase.from('production_ticket_pieces').select('ticket_id, piece_name').in('ticket_id', ids),
          ])
          if (stepsRes.error) throw new Error(stepsRes.error.message)
          if (piecesRes.error) throw new Error(piecesRes.error.message)
          if (!active) return

          const piecesCount = new Map<string, number>()
          for (const p of piecesRes.data ?? []) {
            piecesCount.set(p.ticket_id as string, (piecesCount.get(p.ticket_id as string) ?? 0) + 1)
          }
          // ticket → etapa → piezas que ya la completaron
          const doneMap = new Map<string, Map<ProductionStep, Set<string>>>()
          for (const s of stepsRes.data ?? []) {
            if (!s.completed_at) continue
            const tid = s.ticket_id as string
            const st = s.step as ProductionStep
            const stageMap = doneMap.get(tid) ?? new Map<ProductionStep, Set<string>>()
            const pieceSet = stageMap.get(st) ?? new Set<string>()
            pieceSet.add(s.piece_name as string)
            stageMap.set(st, pieceSet)
            doneMap.set(tid, stageMap)
          }

          const map: Record<string, TicketProgress> = {}
          for (const ticket of t) {
            const totalPieces = piecesCount.get(ticket.id) ?? 0
            const stageMap = doneMap.get(ticket.id)
            // Una etapa está lista solo cuando TODAS las piezas la completaron
            const doneSet = new Set<ProductionStep>()
            if (totalPieces > 0 && stageMap) {
              for (const st of PRODUCTION_STEPS) {
                if ((stageMap.get(st)?.size ?? 0) >= totalPieces) doneSet.add(st)
              }
            }
            const next = PRODUCTION_STEPS.find(st => !doneSet.has(st)) ?? null
            map[ticket.id] = {
              doneStages: doneSet.size,
              currentLabel: next ? STEP_LABELS[next] : null,
              totalPieces,
            }
          }
          setProgressMap(map)
        } else {
          setProgressMap({})
        }
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

  if (selectedId) {
    return (
      <TicketPasarela
        ticketId={selectedId}
        user={user}
        onBack={() => { setSelectedId(null); setReloadKey(k => k + 1); onChanged() }}
      />
    )
  }

  if (loading) return <LoadingState message='Cargando tickets…' />

  if (error) {
    return (
      <div style={{
        background: 'var(--red-50)', border: '1px solid var(--red-ring)',
        borderRadius: 'var(--radius-lg)', padding: '14px 16px', fontSize: 14, color: 'var(--red)',
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <AlertCircle size={16} /> {error}
      </div>
    )
  }

  if (tickets.length === 0) {
    return (
      <EmptyState
        title='No hay trabajos pendientes'
        description='Cuando abras una orden en la pestaña Órdenes, el trabajo aparecerá aquí.'
      />
    )
  }

  return (
    <div style={{
      display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16,
    }}>
      {tickets.map(t => (
        <TicketCard
          key={t.id}
          ticket={t}
          progress={progressMap[t.id]}
          onClick={() => setSelectedId(t.id)}
        />
      ))}
    </div>
  )
}

// ─────────────────────────────────────────────────────────
// Tarjeta simple de ticket pendiente
// ─────────────────────────────────────────────────────────
function TicketCard ({ ticket, progress, onClick }: {
  ticket: ProductionTicket
  progress?: TicketProgress
  onClick: () => void
}) {
  const done = progress?.doneStages ?? 0

  return (
    <div className='card' style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ padding: '22px 22px 18px', flex: 1, display: 'flex', flexDirection: 'column' }}>
        {/* Vehículo en grande */}
        <div style={{
          fontSize: 24, fontWeight: 700, color: 'var(--gray-900)',
          letterSpacing: '-0.02em', lineHeight: 1.15, marginBottom: 4,
        }}>
          {ticket.vehiculo ?? 'Sin vehículo'}
        </div>
        <div style={{ fontSize: 13.5, color: 'var(--gray-500)', marginBottom: 14 }}>
          Orden #{ticket.orden ?? '—'} · {ticket.cliente ?? 'Cliente —'}
        </div>

        {/* Fecha programada */}
        {ticket.fecha_programada && (
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6, alignSelf: 'flex-start',
            padding: '4px 12px', background: 'var(--red-50)', color: 'var(--red)',
            borderRadius: 9999, fontSize: 12.5, fontWeight: 700, marginBottom: 14,
          }}>
            <Calendar size={12} /> {formatDateFriendly(ticket.fecha_programada)}
          </div>
        )}

        {/* Barra de progreso de 5 etapas */}
        <div style={{ marginTop: 'auto' }}>
          <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
            {PRODUCTION_STEPS.map((st, i) => (
              <div
                key={st}
                title={STEP_LABELS[st]}
                style={{
                  flex: 1, height: 8, borderRadius: 4,
                  background: i < done ? 'var(--green)' : i === done ? 'var(--red)' : 'var(--gray-100)',
                  transition: 'background 0.2s',
                }}
              />
            ))}
          </div>
          <div style={{ fontSize: 13, color: 'var(--gray-600)', fontWeight: 600, marginBottom: 16 }}>
            {progress?.currentLabel
              ? <>Ahora toca: <span style={{ color: 'var(--red)' }}>{progress.currentLabel}</span></>
              : <span style={{ color: 'var(--green)' }}>✓ Listo para cerrar</span>}
          </div>
        </div>

        <button
          onClick={onClick}
          className='btn btn-primary'
          style={{ width: '100%', height: 48, fontSize: 15, fontWeight: 700 }}
        >
          Continuar <ChevronRight size={16} strokeWidth={2.25} />
        </button>
      </div>
    </div>
  )
}

function formatDateFriendly (iso: string): string {
  const d = new Date(iso + 'T00:00:00')
  if (isNaN(d.getTime())) return iso
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const target = new Date(d); target.setHours(0, 0, 0, 0)
  const diffDays = Math.round((target.getTime() - today.getTime()) / 86_400_000)
  const fecha = d.toLocaleDateString('es-DO', { weekday: 'long', day: 'numeric', month: 'short' })
  if (diffDays === 0) return `Hoy · ${fecha}`
  if (diffDays === 1) return `Mañana · ${fecha}`
  if (diffDays < 0) return `Atrasado · ${fecha}`
  return fecha
}

function LoadingState ({ message }: { message: string }) {
  return (
    <div style={{ padding: '80px 24px', textAlign: 'center', color: 'var(--gray-500)', fontSize: 13.5 }}>
      <div style={{
        display: 'inline-block', width: 24, height: 24,
        border: '2.5px solid var(--gray-200)', borderTopColor: 'var(--red)',
        borderRadius: '50%', animation: 'spin 0.7s linear infinite', marginBottom: 12,
      }} />
      <div>{message}</div>
    </div>
  )
}

function EmptyState ({ title, description }: { title: string; description: string }) {
  return (
    <div style={{ padding: '80px 24px', textAlign: 'center', maxWidth: 420, margin: '0 auto' }}>
      <div style={{
        width: 56, height: 56, borderRadius: 'var(--radius-lg)',
        background: 'var(--amber-bg)', color: 'var(--amber)',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 18,
      }}>
        <Loader2 size={22} strokeWidth={1.6} />
      </div>
      <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--gray-900)', margin: 0, letterSpacing: '-0.01em' }}>{title}</h3>
      <p style={{ fontSize: 13.5, color: 'var(--gray-500)', marginTop: 8, lineHeight: 1.5 }}>{description}</p>
    </div>
  )
}
