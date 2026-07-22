'use client'
import { useState, useEffect, useTransition } from 'react'
import { X, AlertCircle, CheckCircle, ChevronRight } from 'lucide-react'
import {
  fetchProductionTicketFull,
  fetchProductionEmployees,
  STEP_LABELS,
  type ProductionTicketFull,
  type ProductionStep,
  type ProductionEmployee,
} from '@/lib/production-v2'
import { confirmStep } from '@/app/actions/production'
import { friendlyError } from '@/lib/errorMessages'
import { Toast } from '@/components/ui'

interface Props {
  ticket: ProductionTicketFull
  step: ProductionStep
  user: { id: string; name: string }
  onConfirmed: () => void
  onClose: () => void
}

export default function StageDialog ({ ticket, step, onConfirmed, onClose }: Props) {
  const [localTicket, setLocalTicket] = useState<ProductionTicketFull>(ticket)
  const [employees, setEmployees] = useState<ProductionEmployee[]>([])
  const [loadingEmp, setLoadingEmp] = useState(true)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState('')
  const [toast, setToast] = useState(false)

  useEffect(() => {
    let active = true
    fetchProductionEmployees()
      .then(e => { if (active) setEmployees(e) })
      .catch(e => setError(friendlyError(e)))
      .finally(() => { if (active) setLoadingEmp(false) })
    return () => { active = false }
  }, [])

  const donePieces = new Set(
    localTicket.steps.filter(s => s.step === step && s.completed_at).map(s => s.piece_name)
  )
  const pendingPieces = localTicket.pieces.filter(p => !donePieces.has(p.piece_name))

  async function reloadLocal () {
    try {
      const t = await fetchProductionTicketFull(localTicket.id)
      if (t) setLocalTicket(t)
    } catch (e) {
      setError(friendlyError(e))
    }
  }

  // Cuando ya no quedan piezas pendientes para esta etapa → avisar al padre
  useEffect(() => {
    if (pendingPieces.length === 0 && localTicket.pieces.length > 0) {
      const t = setTimeout(() => { setToast(true); onConfirmed() }, 800)
      return () => clearTimeout(t)
    }
  }, [pendingPieces.length, localTicket.pieces.length, onConfirmed])

  const isFabricacion = step === 'fabricacion'

  return (
    <div className='modal-overlay' onClick={() => !pending && onClose()}>
      <div onClick={e => e.stopPropagation()} className='modal-card' style={{
        padding: 0, maxWidth: 560, width: '100%', maxHeight: '92vh', display: 'flex', flexDirection: 'column',
      }}>
        {/* Header */}
        <div style={{
          padding: '20px 24px 16px', borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16,
        }}>
          <div>
            <h2 style={{ fontSize: 22, fontWeight: 700, color: 'var(--gray-900)', letterSpacing: '-0.02em', margin: 0 }}>
              {STEP_LABELS[step]}
            </h2>
            <p style={{ fontSize: 13.5, color: 'var(--gray-500)', marginTop: 4 }}>
              {pendingPieces.length} pieza{pendingPieces.length !== 1 ? 's' : ''} por confirmar
            </p>
          </div>
          <button onClick={() => !pending && onClose()} aria-label='Cerrar'
            style={{ background: 'transparent', border: 'none', color: 'var(--gray-500)', cursor: 'pointer', padding: 4, flexShrink: 0 }}>
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '20px 24px 24px', flex: 1, overflowY: 'auto' }}>
          {loadingEmp ? (
            <div style={{ color: 'var(--gray-500)', fontSize: 14, padding: '12px 0' }}>Cargando empleados…</div>
          ) : employees.length === 0 ? (
            <div style={{
              background: 'var(--amber-bg)', border: '1px solid var(--amber-ring)',
              borderRadius: 'var(--radius)', padding: '14px 16px', fontSize: 14, color: 'var(--amber)',
            }}>
              No hay empleados registrados. Avise al administrador.
            </div>
          ) : isFabricacion ? (
            <FabricacionList
              pendingPieces={pendingPieces}
              employees={employees}
              ticketId={localTicket.id}
              pending={pending}
              startTransition={startTransition}
              onConfirmedPiece={reloadLocal}
              onError={setError}
            />
          ) : (
            <SimpleStage
              step={step}
              pendingPieces={pendingPieces}
              employees={employees}
              ticketId={localTicket.id}
              pending={pending}
              startTransition={startTransition}
              onConfirmedBatch={reloadLocal}
              onError={setError}
            />
          )}

          {error && (
            <div style={{
              marginTop: 14, background: 'var(--red-50)', border: '1px solid var(--red-ring)',
              borderRadius: 'var(--radius)', padding: '12px 14px', fontSize: 14, color: 'var(--red)', fontWeight: 600,
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <AlertCircle size={15} style={{ flexShrink: 0 }} /> {error}
            </div>
          )}
        </div>
      </div>

      <Toast open={toast} tone='success' message='Etapa completada' onClose={() => setToast(false)} durationMs={800} />
    </div>
  )
}

// ─────────────────────────────────────────────────────────
// Botón grande con el nombre de un empleado
// ─────────────────────────────────────────────────────────
function EmployeeButton ({ name, selected, onClick }: { name: string; selected: boolean; onClick: () => void }) {
  return (
    <button
      type='button'
      onClick={onClick}
      style={{
        padding: '14px 18px', fontSize: 15, fontWeight: 600,
        display: 'inline-flex', alignItems: 'center', gap: 8,
        color: selected ? '#fff' : 'var(--gray-800)',
        background: selected ? 'var(--red)' : 'var(--bg-card)',
        border: `2px solid ${selected ? 'var(--red)' : 'var(--border)'}`,
        borderRadius: 'var(--radius-lg)', cursor: 'pointer',
        transition: 'all var(--t-fast)',
      }}
    >
      {selected && <CheckCircle size={16} />}
      {name}
    </button>
  )
}

// ─────────────────────────────────────────────────────────
// Etapas simples (soldadura, ferré, pintura, decoración):
// tocar el nombre del empleado → confirmar todas las piezas.
// ─────────────────────────────────────────────────────────
function SimpleStage ({
  step, pendingPieces, employees, ticketId, pending, startTransition, onConfirmedBatch, onError,
}: {
  step: ProductionStep
  pendingPieces: ProductionTicketFull['pieces']
  employees: ProductionEmployee[]
  ticketId: string
  pending: boolean
  startTransition: React.TransitionStartFunction
  onConfirmedBatch: () => Promise<void>
  onError: (m: string) => void
}) {
  const [employeeId, setEmployeeId] = useState('')

  function handleConfirm () {
    if (!employeeId || pendingPieces.length === 0 || pending) return
    const emp = employees.find(e => e.id === employeeId)
    if (!emp) return
    startTransition(async () => {
      for (const p of pendingPieces) {
        const res = await confirmStep({
          ticket_id: ticketId,
          piece_name: p.piece_name,
          step,
          employee_id: emp.id,
          employee_name: emp.name,
        })
        if (!res.ok) { onError(friendlyError(res.error)); return }
      }
      await onConfirmedBatch()
    })
  }

  return (
    <div>
      <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--gray-900)', marginBottom: 12 }}>
        ¿Quién hizo este trabajo?
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
        {employees.map(e => (
          <EmployeeButton
            key={e.id}
            name={e.name}
            selected={employeeId === e.id}
            onClick={() => { setEmployeeId(e.id); onError('') }}
          />
        ))}
      </div>

      {/* Piezas que se van a confirmar */}
      <div style={{ marginTop: 20, padding: '14px 16px', background: 'var(--bg-page)', borderRadius: 'var(--radius-lg)' }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
          Se confirmarán estas piezas
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {pendingPieces.map(p => (
            <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
              <span style={{ color: 'var(--gray-800)', fontWeight: 600 }}>{p.piece_name}</span>
              <span style={{ color: 'var(--gray-500)' }}>×{p.quantity}</span>
            </div>
          ))}
        </div>
      </div>

      <button
        onClick={handleConfirm}
        disabled={!employeeId || pendingPieces.length === 0 || pending}
        className='btn btn-primary'
        style={{ width: '100%', marginTop: 20, height: 54, fontSize: 16, fontWeight: 700 }}
      >
        {pending ? 'Guardando…' : `✓ Confirmar ${STEP_LABELS[step]}`}
      </button>
    </div>
  )
}

// ─────────────────────────────────────────────────────────
// Fabricación: por pieza (fabricador + ¿dobló él mismo?)
// ─────────────────────────────────────────────────────────
function FabricacionList ({
  pendingPieces, employees, ticketId, pending, startTransition, onConfirmedPiece, onError,
}: {
  pendingPieces: ProductionTicketFull['pieces']
  employees: ProductionEmployee[]
  ticketId: string
  pending: boolean
  startTransition: React.TransitionStartFunction
  onConfirmedPiece: () => Promise<void>
  onError: (m: string) => void
}) {
  // Estado por pieza: { fabricadorId, selfBent, dobladorId }
  const [state, setState] = useState<Record<string, { fab: string; self: boolean | null; doblador: string }>>({})

  function set (piece: string, patch: Partial<{ fab: string; self: boolean | null; doblador: string }>) {
    setState(s => {
      const cur = s[piece] ?? { fab: '', self: null, doblador: '' }
      return { ...s, [piece]: { ...cur, ...patch } }
    })
  }

  function handleConfirm (pieceName: string) {
    const st = state[pieceName]
    if (!st || !st.fab || st.self === null) return
    if (!st.self && !st.doblador) { onError('Toca el nombre de quien dobló la pieza'); return }
    const fab = employees.find(e => e.id === st.fab)
    const doblador = !st.self ? employees.find(e => e.id === st.doblador) : null
    if (!fab) return
    if (!st.self && !doblador) { onError('Toca el nombre de quien dobló la pieza'); return }
    startTransition(async () => {
      const res = await confirmStep({
        ticket_id: ticketId,
        piece_name: pieceName,
        step: 'fabricacion',
        employee_id: fab.id,
        employee_name: fab.name,
        is_self_bent: st.self,
        doblador_id: doblador?.id ?? null,
        doblador_name: doblador?.name ?? null,
      })
      if (!res.ok) { onError(friendlyError(res.error)); return }
      setState(s => { const n = { ...s }; delete n[pieceName]; return n })
      await onConfirmedPiece()
    })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {pendingPieces.map(p => {
        const st = state[p.piece_name] ?? { fab: '', self: null, doblador: '' }
        const canConfirm = st.fab && st.self !== null && (st.self || st.doblador)
        return (
          <div key={p.id} style={{
            border: '1px solid var(--border)', borderRadius: 'var(--radius-xl)', padding: 18, background: 'var(--bg-card)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <span style={{ fontSize: 17, fontWeight: 700, color: 'var(--gray-900)' }}>{p.piece_name}</span>
              <span style={{ fontSize: 13, color: 'var(--gray-500)', fontWeight: 600 }}>×{p.quantity}</span>
            </div>

            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--gray-900)', marginBottom: 10 }}>
              ¿Quién la fabricó?
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {employees.map(e => (
                <EmployeeButton
                  key={e.id}
                  name={e.name}
                  selected={st.fab === e.id}
                  onClick={() => { set(p.piece_name, { fab: e.id }); onError('') }}
                />
              ))}
            </div>

            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--gray-900)', margin: '18px 0 10px' }}>
              ¿Esa misma persona dobló la pieza?
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {(['Sí', 'No'] as const).map(opt => {
                const val = opt === 'Sí'
                const active = st.self === val
                return (
                  <button
                    key={opt}
                    type='button'
                    onClick={() => { set(p.piece_name, { self: val }); onError('') }}
                    style={{
                      padding: '14px 10px', fontSize: 16, fontWeight: 700,
                      color: active ? '#fff' : 'var(--gray-800)',
                      background: active ? 'var(--red)' : 'var(--bg-card)',
                      border: `2px solid ${active ? 'var(--red)' : 'var(--border)'}`,
                      borderRadius: 'var(--radius-lg)', cursor: 'pointer',
                    }}
                  >
                    {opt}
                  </button>
                )
              })}
            </div>

            {st.self === false && (
              <>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--gray-900)', margin: '18px 0 10px' }}>
                  ¿Quién la dobló?
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {employees.map(e => (
                    <EmployeeButton
                      key={e.id}
                      name={e.name}
                      selected={st.doblador === e.id}
                      onClick={() => { set(p.piece_name, { doblador: e.id }); onError('') }}
                    />
                  ))}
                </div>
              </>
            )}

            <button
              onClick={() => handleConfirm(p.piece_name)}
              disabled={!canConfirm || pending}
              className='btn btn-primary'
              style={{ width: '100%', marginTop: 20, height: 50, fontSize: 15, fontWeight: 700 }}
            >
              {pending ? 'Guardando…' : <>✓ Confirmar fabricación <ChevronRight size={15} /></>}
            </button>
          </div>
        )
      })}
    </div>
  )
}
