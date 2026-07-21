'use client'
import { useState, useEffect, useTransition } from 'react'
import {
  Wallet, Users, Receipt, BarChart3, AlertCircle, Plus, X, CheckCircle, Lock,
} from 'lucide-react'
import {
  fetchEmployeeTotals,
  fetchEmployeePendingPayments,
  fetchPayrollRuns,
  fetchPayrollRunDetails,
  fetchProductionEmployees,
  STEP_LABELS,
  type EmployeeProductionTotal,
  type EmployeePendingPayment,
  type PayrollRun,
  type PayrollDetail,
  type ProductionEmployee,
} from '@/lib/production-v2'
import {
  addEmployee,
  toggleEmployeeActive,
  createPayrollRun,
  markPayrollPaid,
} from '@/app/actions/production'
import { Toast } from '@/components/ui'

type SubTab = 'pendientes' | 'totales' | 'nominas' | 'empleados'

interface Props {
  user: { id: string; name: string; role: string }
}

export default function PagosView ({ user }: Props) {
  const [tab, setTab] = useState<SubTab>('pendientes')
  const [reloadKey, setReloadKey] = useState(0)
  const reload = () => setReloadKey(k => k + 1)

  return (
    <div style={{ animation: 'fadeInUp 0.3s ease', padding: '40px 48px 64px' }}>
      <div className='eyebrow' style={{ color: 'var(--red)', marginBottom: 8 }}>Pagos</div>
      <h1 style={{ fontSize: 28, fontWeight: 700, color: 'var(--gray-900)', letterSpacing: '-0.025em', margin: 0 }}>
        Pagos y Nóminas
      </h1>
      <p style={{ fontSize: 14, color: 'var(--gray-500)', marginTop: 8, lineHeight: 1.5, maxWidth: 620 }}>
        Cálculo automático desde <code>production_ticket_steps</code>. Sin acumulados manuales. Las nóminas marcan los movimientos como pagados.
      </p>

      {/* Sub-tabs */}
      <div style={{ display: 'flex', gap: 4, marginTop: 24, marginLeft: -4, borderBottom: '1px solid var(--border)', marginBottom: 24 }}>
        <SubTabBtn active={tab === 'pendientes'} onClick={() => setTab('pendientes')} icon={<Wallet size={14} />}>Pendientes</SubTabBtn>
        <SubTabBtn active={tab === 'totales'} onClick={() => setTab('totales')} icon={<BarChart3 size={14} />}>Totales</SubTabBtn>
        <SubTabBtn active={tab === 'nominas'} onClick={() => setTab('nominas')} icon={<Receipt size={14} />}>Nóminas</SubTabBtn>
        <SubTabBtn active={tab === 'empleados'} onClick={() => setTab('empleados')} icon={<Users size={14} />}>Empleados</SubTabBtn>
      </div>

      {tab === 'pendientes' && <PendientesTab key={`p-${reloadKey}`} user={user} onChanged={reload} />}
      {tab === 'totales' && <TotalesTab key={`t-${reloadKey}`} />}
      {tab === 'nominas' && <NominasTab key={`n-${reloadKey}`} onChanged={reload} />}
      {tab === 'empleados' && <EmpleadosTab key={`e-${reloadKey}`} onChanged={reload} />}
    </div>
  )
}

// ─────────────────────────────────────────────────────────
// Pendientes de pago + generar nómina
// ─────────────────────────────────────────────────────────
function PendientesTab ({ user, onChanged }: { user: { id: string; name: string }; onChanged: () => void }) {
  const [rows, setRows] = useState<EmployeePendingPayment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [periodType, setPeriodType] = useState<'semanal' | 'quincenal' | 'mensual'>('semanal')
  const [periodStart, setPeriodStart] = useState(() => defaultPeriodStart())
  const [periodEnd, setPeriodEnd] = useState(() => defaultPeriodEnd())
  const [pending, startTransition] = useTransition()
  const [genError, setGenError] = useState('')
  const [toast, setToast] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let active = true
    async function load () {
      try {
        const r = await fetchEmployeePendingPayments()
        if (!active) return
        setRows(r.filter(x => x.pending_count > 0))
        setError('')
      } catch (e) { if (active) setError(e instanceof Error ? e.message : String(e)) }
      finally { if (active) setLoading(false) }
    }
    load()
    return () => { active = false }
  }, [reloadKey])

  const reload = () => setReloadKey(k => k + 1)

  function toggle (id: string) {
    setSelected(s => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n })
  }

  const totalSelected = rows.filter(r => selected.has(r.employee_id)).reduce((s, r) => s + r.pending_amount, 0)

  function handleGenerate () {
    if (selected.size === 0 || !periodStart || !periodEnd || pending) return
    setGenError('')
    startTransition(async () => {
      const res = await createPayrollRun({
        period_type: periodType,
        period_start: periodStart,
        period_end: periodEnd,
        employee_ids: [...selected],
        created_by: user.name,
      })
      if (!res.ok) { setGenError(res.error ?? 'Error'); return }
      setToast(true)
      setSelected(new Set())
      onChanged()
      setTimeout(reload, 400)
    })
  }

  if (loading) return <div style={{ padding: '40px', textAlign: 'center', color: 'var(--gray-500)' }}>Cargando…</div>
  if (error) return <ErrorBox message={error} />

  if (rows.length === 0) {
    return (
      <div style={{ padding: '60px 24px', textAlign: 'center', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)' }}>
        <CheckCircle size={32} style={{ color: 'var(--green)', marginBottom: 12 }} />
        <p style={{ color: 'var(--gray-700)', fontSize: 14, fontWeight: 600, margin: 0 }}>No hay pagos pendientes</p>
        <p style={{ color: 'var(--gray-500)', fontSize: 13, marginTop: 6 }}>Todos los movimientos están al día.</p>
      </div>
    )
  }

  return (
    <div>
      <div className='card' style={{ padding: 0, overflow: 'hidden', marginBottom: 24 }}>
        <table className='table-dark'>
          <thead>
            <tr><th>Empleado</th><th>Trabajos pendientes</th><th>Monto pendiente</th><th></th></tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.employee_id}>
                <td style={{ color: 'var(--gray-900)', fontWeight: 600 }}>{r.employee_name}</td>
                <td>{r.pending_count}</td>
                <td style={{ fontWeight: 700, color: 'var(--gray-900)' }}>{formatMoney(r.pending_amount)}</td>
                <td>
                  <input type='checkbox' checked={selected.has(r.employee_id)} onChange={() => toggle(r.employee_id)} style={{ width: 18, height: 18, cursor: 'pointer' }} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Generar nómina */}
      <div className='card' style={{ padding: 24 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--gray-900)', marginBottom: 16 }}>Generar nómina</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14, marginBottom: 16 }}>
          <div>
            <label className='form-label'>Tipo de período</label>
            <select className='input-base' value={periodType} onChange={e => setPeriodType(e.target.value as typeof periodType)}>
              <option value='semanal'>Semanal</option>
              <option value='quincenal'>Quincenal</option>
              <option value='mensual'>Mensual</option>
            </select>
          </div>
          <div>
            <label className='form-label'>Desde</label>
            <input type='date' className='input-base' value={periodStart} onChange={e => setPeriodStart(e.target.value)} />
          </div>
          <div>
            <label className='form-label'>Hasta</label>
            <input type='date' className='input-base' value={periodEnd} onChange={e => setPeriodEnd(e.target.value)} />
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap' as const, gap: 12, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
          <div style={{ fontSize: 13.5, color: 'var(--gray-600)' }}>
            {selected.size} empleado(s) seleccionado(s) · <strong style={{ color: 'var(--gray-900)' }}>{formatMoney(totalSelected)}</strong>
          </div>
          <button onClick={handleGenerate} disabled={selected.size === 0 || !periodStart || !periodEnd || pending} className='btn btn-primary'>
            {pending ? 'Generando…' : <>Generar nómina</>}
          </button>
        </div>

        {genError && (
          <div style={{
            marginTop: 14, background: 'var(--red-50)', border: '1px solid var(--red-ring)',
            borderRadius: 'var(--radius)', padding: '10px 14px', fontSize: 13, color: 'var(--red)',
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <AlertCircle size={14} /> {genError}
          </div>
        )}
      </div>

      <Toast open={toast} tone='success' message='Nómina generada. Los movimientos quedan marcados como pagados.' onClose={() => setToast(false)} />
    </div>
  )
}

// ─────────────────────────────────────────────────────────
// Totales por empleado (histórico)
// ─────────────────────────────────────────────────────────
function TotalesTab () {
  const [rows, setRows] = useState<EmployeeProductionTotal[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchEmployeeTotals()
      .then(r => setRows(r))
      .catch(e => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div style={{ padding: '40px', textAlign: 'center', color: 'var(--gray-500)' }}>Cargando…</div>
  if (error) return <ErrorBox message={error} />
  if (rows.length === 0) return <EmptyBox title='Sin datos' description='Aún no hay movimientos registrados.' />

  // Agrupar por empleado
  const byEmployee = new Map<string, { name: string; steps: EmployeeProductionTotal[] }>()
  for (const r of rows) {
    if (!byEmployee.has(r.employee_id)) byEmployee.set(r.employee_id, { name: r.employee_name, steps: [] })
    byEmployee.get(r.employee_id)!.steps.push(r)
  }

  return (
    <div className='card' style={{ padding: 0, overflow: 'hidden' }}>
      <table className='table-dark'>
        <thead>
          <tr><th>Empleado</th><th>Etapa</th><th>Trabajos</th><th>Total ganado</th></tr>
        </thead>
        <tbody>
          {[...byEmployee.entries()].map(([id, g]) => {
            const empTotal = g.steps.reduce((s, x) => s + x.total_earned, 0)
            return (
              <FragmentRows key={id} name={g.name} steps={g.steps} empTotal={empTotal} />
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function FragmentRows ({ name, steps, empTotal }: { name: string; steps: EmployeeProductionTotal[]; empTotal: number }) {
  return (
    <>
      {steps.map((s, i) => (
        <tr key={s.employee_id + s.step}>
          {i === 0 && <td rowSpan={steps.length} style={{ color: 'var(--gray-900)', fontWeight: 600, verticalAlign: 'top' }}>{name}</td>}
          <td>{STEP_LABELS[s.step as keyof typeof STEP_LABELS] ?? s.step}</td>
          <td>{s.work_count}</td>
          <td style={{ fontWeight: 600 }}>{formatMoney(s.total_earned)}</td>
        </tr>
      ))}
      <tr style={{ background: 'var(--gray-50)' }}>
        <td colSpan={2} style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-500)', textTransform: 'uppercase' as const, letterSpacing: '0.04em' }}>Total {name}</td>
        <td style={{ fontWeight: 700, color: 'var(--gray-700)' }}>{steps.reduce((s, x) => s + x.work_count, 0)}</td>
        <td style={{ fontWeight: 800, color: 'var(--gray-900)' }}>{formatMoney(empTotal)}</td>
      </tr>
    </>
  )
}

// ─────────────────────────────────────────────────────────
// Nóminas — historial + detalle
// ─────────────────────────────────────────────────────────
function NominasTab ({ onChanged }: { onChanged: () => void }) {
  const [runs, setRuns] = useState<PayrollRun[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [detail, setDetail] = useState<{ run: PayrollRun; rows: PayrollDetail[] } | null>(null)
  const [pending, startTransition] = useTransition()
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let active = true
    async function load () {
      try {
        const r = await fetchPayrollRuns(); if (!active) return; setRuns(r); setError('')
      } catch (e) { if (active) setError(e instanceof Error ? e.message : String(e)) }
      finally { if (active) setLoading(false) }
    }
    load()
    return () => { active = false }
  }, [reloadKey])

  const reload = () => setReloadKey(k => k + 1)

  async function openDetail (run: PayrollRun) {
    try {
      const rows = await fetchPayrollRunDetails(run.id)
      setDetail({ run, rows })
    } catch (e) { setError(e instanceof Error ? e.message : String(e)) }
  }

  function handleMarkPaid (runId: string) {
    startTransition(async () => {
      const res = await markPayrollPaid(runId)
      if (res.ok) { setDetail(null); onChanged(); reload() }
    })
  }

  if (loading) return <div style={{ padding: '40px', textAlign: 'center', color: 'var(--gray-500)' }}>Cargando…</div>
  if (error) return <ErrorBox message={error} />

  if (runs.length === 0) return <EmptyBox title='Sin nóminas' description='Genera una nómina desde la pestaña Pendientes.' />

  return (
    <>
      <div className='card' style={{ padding: 0, overflow: 'hidden' }}>
        <table className='table-dark'>
          <thead>
            <tr><th>Período</th><th>Tipo</th><th>Desde</th><th>Hasta</th><th>Total</th><th>Estado</th><th>Generada</th><th></th></tr>
          </thead>
          <tbody>
            {runs.map(r => (
              <tr key={r.id} onClick={() => openDetail(r)} style={{ cursor: 'pointer' }}>
                <td style={{ color: 'var(--gray-900)', fontWeight: 600, textTransform: 'capitalize' as const }}>{r.period_type}</td>
                <td style={{ textTransform: 'capitalize' as const }}>{r.period_type}</td>
                <td>{r.period_start}</td>
                <td>{r.period_end}</td>
                <td style={{ fontWeight: 700 }}>{formatMoney(Number(r.total_amount))}</td>
                <td>
                  <span className='badge' style={{
                    background: r.status === 'pagada' ? 'var(--green-bg)' : 'var(--amber-bg)',
                    color: r.status === 'pagada' ? 'var(--green)' : 'var(--amber)',
                    border: `1px solid ${r.status === 'pagada' ? 'var(--green-ring)' : 'var(--amber-ring)'}`,
                  }}>
                    {r.status}
                  </span>
                </td>
                <td style={{ fontSize: 12, color: 'var(--gray-500)' }}>{new Date(r.created_at).toLocaleDateString('es-DO')}</td>
                <td><Receipt size={14} style={{ color: 'var(--gray-400)' }} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {detail && (
        <div className='modal-overlay' onClick={() => setDetail(null)}>
          <div onClick={e => e.stopPropagation()} className='modal-card' style={{ padding: 0, maxWidth: 620, width: '100%', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '22px 28px 18px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div className='eyebrow' style={{ color: 'var(--red)', marginBottom: 8 }}>Nómina {detail.run.period_type}</div>
                <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--gray-900)', margin: 0 }}>
                  {detail.run.period_start} → {detail.run.period_end}
                </h2>
                <p style={{ fontSize: 12.5, color: 'var(--gray-500)', marginTop: 4 }}>
                  Estado: <strong>{detail.run.status}</strong> · Generada por {detail.run.created_by ?? '—'}
                </p>
              </div>
              <button onClick={() => setDetail(null)} style={{ background: 'transparent', border: 'none', color: 'var(--gray-500)', cursor: 'pointer', padding: 4 }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: '20px 28px', flex: 1, overflowY: 'auto' }}>
              <table className='table-dark'>
                <thead><tr><th>Empleado</th><th>Etapa</th><th>Trabajos</th><th>Monto</th></tr></thead>
                <tbody>
                  {detail.rows.map(d => (
                    <tr key={d.id}>
                      <td style={{ fontWeight: 600, color: 'var(--gray-900)' }}>{d.employee_name ?? '—'}</td>
                      <td>{STEP_LABELS[d.step as keyof typeof STEP_LABELS] ?? d.step ?? '—'}</td>
                      <td>{d.work_count}</td>
                      <td style={{ fontWeight: 600 }}>{formatMoney(Number(d.amount))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ padding: '16px 28px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--gray-900)' }}>Total: {formatMoney(Number(detail.run.total_amount))}</span>
              {detail.run.status === 'emitida' && (
                <button onClick={() => handleMarkPaid(detail.run.id)} disabled={pending} className='btn btn-primary'>
                  <CheckCircle size={15} /> Marcar como pagada
                </button>
              )}
              {detail.run.status === 'pagada' && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--green)', fontWeight: 600 }}>
                  <Lock size={14} /> Pagada
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}

// ─────────────────────────────────────────────────────────
// Empleados — gestión
// ─────────────────────────────────────────────────────────
function EmpleadosTab ({ onChanged }: { onChanged: () => void }) {
  const [employees, setEmployees] = useState<ProductionEmployee[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [newName, setNewName] = useState('')
  const [pending, startTransition] = useTransition()
  const [actionError, setActionError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let active = true
    async function load () {
      try {
        const e = await fetchProductionEmployees(false); if (!active) return; setEmployees(e); setError('')
      } catch (e) { if (active) setError(e instanceof Error ? e.message : String(e)) }
      finally { if (active) setLoading(false) }
    }
    load()
    return () => { active = false }
  }, [reloadKey])

  const reload = () => setReloadKey(k => k + 1)

  function handleAdd () {
    if (!newName.trim() || pending) return
    setActionError('')
    startTransition(async () => {
      const res = await addEmployee(newName)
      if (!res.ok) { setActionError(res.error ?? 'Error'); return }
      setNewName('')
      reload(); onChanged()
    })
  }

  function handleToggle (id: string, active: boolean) {
    startTransition(async () => {
      const res = await toggleEmployeeActive(id, active)
      if (res.ok) { reload(); onChanged() }
    })
  }

  if (loading) return <div style={{ padding: '40px', textAlign: 'center', color: 'var(--gray-500)' }}>Cargando…</div>
  if (error) return <ErrorBox message={error} />

  return (
    <div style={{ maxWidth: 640 }}>
      <div className='card' style={{ padding: 20, marginBottom: 20 }}>
        <label className='form-label'>Agregar empleado</label>
        <div style={{ display: 'flex', gap: 10 }}>
          <input className='input-base' value={newName} onChange={e => setNewName(e.target.value)} placeholder='Nombre del empleado' onKeyDown={e => { if (e.key === 'Enter') handleAdd() }} />
          <button onClick={handleAdd} disabled={!newName.trim() || pending} className='btn btn-primary'>
            <Plus size={15} /> Agregar
          </button>
        </div>
        {actionError && <p style={{ fontSize: 12.5, color: 'var(--red)', marginTop: 8 }}>{actionError}</p>}
      </div>

      <div className='card' style={{ padding: 0, overflow: 'hidden' }}>
        <table className='table-dark'>
          <thead><tr><th>Nombre</th><th>Estado</th><th></th></tr></thead>
          <tbody>
            {employees.map(e => (
              <tr key={e.id}>
                <td style={{ color: 'var(--gray-900)', fontWeight: 600 }}>{e.name}</td>
                <td>
                  <span className='badge' style={{
                    background: e.active ? 'var(--green-bg)' : 'var(--gray-100)',
                    color: e.active ? 'var(--green)' : 'var(--gray-500)',
                    border: `1px solid ${e.active ? 'var(--green-ring)' : 'var(--border)'}`,
                  }}>
                    {e.active ? 'Activo' : 'Inactivo'}
                  </span>
                </td>
                <td>
                  <button onClick={() => handleToggle(e.id, !e.active)} className='btn btn-secondary btn-sm'>
                    {e.active ? 'Desactivar' : 'Activar'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────
function SubTabBtn ({ active, onClick, icon, children }: { active: boolean; onClick: () => void; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <button onClick={onClick} style={{
      display: 'inline-flex', alignItems: 'center', gap: 8, padding: '12px 4px', marginRight: 24,
      background: 'transparent', border: 'none',
      borderBottom: active ? '2px solid var(--red)' : '2px solid transparent',
      cursor: 'pointer', fontSize: 14, fontWeight: 600,
      color: active ? 'var(--gray-900)' : 'var(--gray-500)',
      marginBottom: -1, transition: 'all var(--t-fast)',
    }}>
      {icon} {children}
    </button>
  )
}

function ErrorBox ({ message }: { message: string }) {
  return (
    <div style={{
      background: 'var(--red-50)', border: '1px solid var(--red-ring)',
      borderRadius: 'var(--radius-lg)', padding: '14px 16px', fontSize: 13.5, color: 'var(--red)',
      display: 'flex', alignItems: 'center', gap: 10,
    }}>
      <AlertCircle size={16} /> {message}
    </div>
  )
}

function EmptyBox ({ title, description }: { title: string; description: string }) {
  return (
    <div style={{ padding: '60px 24px', textAlign: 'center', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)' }}>
      <p style={{ color: 'var(--gray-700)', fontSize: 14, fontWeight: 600, margin: 0 }}>{title}</p>
      <p style={{ color: 'var(--gray-500)', fontSize: 13, marginTop: 6 }}>{description}</p>
    </div>
  )
}

function formatMoney (n: number): string {
  return 'RD$ ' + n.toLocaleString('es-DO', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
}

function defaultPeriodStart (): string {
  const now = new Date()
  const day = now.getDay() || 7
  const monday = new Date(now); monday.setDate(now.getDate() - day + 1)
  return monday.toISOString().slice(0, 10)
}

function defaultPeriodEnd (): string {
  const now = new Date()
  const day = now.getDay() || 7
  const monday = new Date(now); monday.setDate(now.getDate() - day + 1)
  const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6)
  return sunday.toISOString().slice(0, 10)
}
