'use client'
import { useState, useEffect, useTransition } from 'react'
import { X, User, AlertCircle, ChevronRight } from 'lucide-react'
import {
  fetchProductionTicketFull,
  fetchProductionEmployees,
  STEP_LABELS,
  type ProductionTicketFull,
  type ProductionStep,
  type ProductionEmployee,
} from '@/lib/production-v2'
import { confirmStep } from '@/app/actions/production'
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
      .catch(e => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => { if (active) setLoadingEmp(false) })
    return () => { active = false }
  }, [])

  const donePieces = new Set(
    localTicket.steps.filter(s => s.step === step && s.completed_at).map(s => s.piece_name)
  )
  const pendingPieces = localTicket.pieces.filter(p => !donePieces.has(p.piece_name))

  async function reloadLocal () {
    const t = await fetchProductionTicketFull(localTicket.id)
    if (t) setLocalTicket(t)
  }

  // Cuando ya no quedan piezas pendientes para esta etapa → avisar al padre
  useEffect(() => {
    if (pendingPieces.length === 0 && localTicket.pieces.length > 0) {
      const t = setTimeout(() => { setToast(true); onConfirmed() }, 700)
      return () => clearTimeout(t)
    }
  }, [pendingPieces.length, localTicket.pieces.length, onConfirmed])

  const isFabricacion = step === 'fabricacion'

  return (
    <div className='modal-overlay' onClick={() => !pending && onClose()}>
      <div onClick={e => e.stopPropagation()} className='modal-card' style={{
        padding: 0, maxWidth: 560, width: '100%', maxHeight: '90vh', display: 'flex', flexDirection: 'column',
      }}>
        {/* Header */}
        <div style={{
          padding: '22px 28px 18px', borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16,
        }}>
          <div>
            <div className='eyebrow' style={{ color: 'var(--red)', marginBottom: 8 }}>Etapa de producción</div>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--gray-900)', letterSpacing: '-0.02em', margin: 0 }}>
              {STEP_LABELS[step]}
            </h2>
            <p style={{ fontSize: 13, color: 'var(--gray-500)', marginTop: 6 }}>
              {pendingPieces.length} pieza{pendingPieces.length !== 1 ? 's' : ''} por confirmar · precio automático desde el tarifario
            </p>
          </div>
          <button onClick={() => !pending && onClose()} aria-label='Cerrar'
            style={{ background: 'transparent', border: 'none', color: 'var(--gray-500)', cursor: 'pointer', padding: 4, flexShrink: 0 }}>
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '20px 28px', flex: 1, overflowY: 'auto' }}>
          {loadingEmp ? (
            <div style={{ color: 'var(--gray-500)', fontSize: 13.5, padding: '12px 0' }}>Cargando empleados…</div>
          ) : employees.length === 0 ? (
            <div style={{
              background: 'var(--amber-bg)', border: '1px solid var(--amber-ring)',
              borderRadius: 'var(--radius)', padding: '12px 14px', fontSize: 13, color: 'var(--amber)',
            }}>
              No hay empleados registrados. Agrega empleados en el módulo de Pagos.
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
              borderRadius: 'var(--radius)', padding: '10px 14px', fontSize: 13, color: 'var(--red)',
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <AlertCircle size={14} /> {error}
            </div>
          )}
        </div>
      </div>

      <Toast open={toast} tone='success' message='Etapa completada' onClose={() => setToast(false)} durationMs={700} />
    </div>
  )
}

// ─────────────────────────────────────────────────────────
// Etapas simples (soldadura, ferré, pintura, decoración):
// un empleado para todas las piezas pendientes.
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
        if (!res.ok) { onError(res.error ?? 'Error'); return }
      }
      await onConfirmedBatch()
    })
  }

  return (
    <div>
      <label className='form-label'>
        <User size={11} style={{ display: 'inline', marginRight: 6, verticalAlign: 'middle' }} />
        Empleado<span className='req'>*</span>
      </label>
      <select className='input-base' value={employeeId} onChange={e => setEmployeeId(e.target.value)}>
        <option value=''>Selecciona un empleado…</option>
        {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
      </select>

      <div style={{ marginTop: 18 }}>
        <div className='eyebrow' style={{ marginBottom: 10 }}>Piezas a confirmar</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {pendingPieces.map(p => (
            <div key={p.id} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '10px 12px', background: 'var(--bg-page)', borderRadius: 'var(--radius)', fontSize: 13.5,
            }}>
              <span style={{ color: 'var(--gray-800)', fontWeight: 500 }}>{p.piece_name}</span>
              <span style={{ color: 'var(--gray-500)', fontSize: 12.5 }}>×{p.quantity}</span>
            </div>
          ))}
        </div>
      </div>

      <button
        onClick={handleConfirm}
        disabled={!employeeId || pendingPieces.length === 0 || pending}
        className='btn btn-primary'
        style={{ width: '100%', marginTop: 20 }}
      >
        {pending ? <><Spinner /> Confirmando…</> : <>Confirmar {pendingPieces.length} pieza{pendingPieces.length !== 1 ? 's' : ''}</>}
      </button>
    </div>
  )
}

// ─────────────────────────────────────────────────────────
// Fabricación: por pieza (fabricador + doblador)
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
    if (!st.self && !st.doblador) { onError('Selecciona el doblador'); return }
    const fab = employees.find(e => e.id === st.fab)
    const doblador = !st.self ? employees.find(e => e.id === st.doblador) : null
    if (!fab) return
    if (!st.self && !doblador) { onError('Doblador no válido'); return }
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
      if (!res.ok) { onError(res.error ?? 'Error'); return }
      setState(s => { const n = { ...s }; delete n[pieceName]; return n })
      await onConfirmedPiece()
    })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {pendingPieces.map(p => {
        const st = state[p.piece_name] ?? { fab: '', self: null, doblador: '' }
        const canConfirm = st.fab && st.self !== null && (st.self || st.doblador)
        return (
          <div key={p.id} style={{
            border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: 16, background: 'var(--bg-card)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--gray-900)' }}>{p.piece_name}</span>
              <span style={{ fontSize: 12, color: 'var(--gray-500)' }}>×{p.quantity}</span>
            </div>

            <label className='form-label' style={{ fontSize: 11 }}>Fabricador</label>
            <select className='input-base' style={{ height: 40 }} value={st.fab} onChange={e => set(p.piece_name, { fab: e.target.value })}>
              <option value=''>Selecciona…</option>
              {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>

            <label className='form-label' style={{ fontSize: 11, marginTop: 14 }}>¿El mismo fabricador dobló la pieza?</label>
            <div className='segmented' style={{ width: '100%' }}>
              {(['Sí', 'No'] as const).map(opt => {
                const val = opt === 'Sí'
                return (
                  <button key={opt} type='button' onClick={() => set(p.piece_name, { self: val })}
                    className={`segmented-item ${st.self === val ? 'active' : ''}`}>
                    {opt}
                  </button>
                )
              })}
            </div>

            {st.self === false && (
              <>
                <label className='form-label' style={{ fontSize: 11, marginTop: 14 }}>Doblador</label>
                <select className='input-base' style={{ height: 40 }} value={st.doblador} onChange={e => set(p.piece_name, { doblador: e.target.value })}>
                  <option value=''>Selecciona…</option>
                  {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                </select>
              </>
            )}

            <button
              onClick={() => handleConfirm(p.piece_name)}
              disabled={!canConfirm || pending}
              className='btn btn-primary'
              style={{ width: '100%', marginTop: 16, height: 40 }}
            >
              {pending ? <Spinner /> : <>Confirmar fabricación <ChevronRight size={14} /></>}
            </button>
          </div>
        )
      })}
    </div>
  )
}

function Spinner () {
  return (
    <div style={{
      width: 14, height: 14,
      border: '2px solid rgba(255,255,255,0.4)', borderTopColor: '#fff',
      borderRadius: '50%', animation: 'spin 0.7s linear infinite', display: 'inline-block',
    }} />
  )
}
