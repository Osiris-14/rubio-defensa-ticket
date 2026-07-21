'use client'
import { useState, useEffect, useMemo, useTransition } from 'react'
import {
  Gauge, TrendingUp, TrendingDown, AlertTriangle, Clock, CalendarClock,
  Settings, Save, AlertCircle, Users, BarChart3,
} from 'lucide-react'
import {
  fetchCapacityDashboard,
  fetchAreaCapacities,
  fetchEmployeeCapacities,
  fetchProductionEmployees,
  fetchProductionTickets,
  fetchEmployeeDailyLoadInRange,
  STEP_LABELS,
  PRODUCTION_STEPS,
  occupancyLevel,
  type CapacityDashboard,
  type AreaCapacity,
  type EmployeeCapacity,
  type ProductionEmployee,
  type ProductionTicket,
  type ProductionStep,
  type EmployeeDailyLoad,
} from '@/lib/production-v2'
import { setAreaCapacity, setEmployeeCapacity } from '@/app/actions/production'
import { Toast } from '@/components/ui'

interface Props {
  user: { id: string; name: string; role: string }
}

export default function DashboardCapacidadView ({ user }: Props) {
  const [kpi, setKpi] = useState<CapacityDashboard | null>(null)
  const [tickets, setTickets] = useState<ProductionTicket[]>([])
  const [areaCaps, setAreaCaps] = useState<AreaCapacity[]>([])
  const [empCaps, setEmpCaps] = useState<EmployeeCapacity[]>([])
  const [employees, setEmployees] = useState<ProductionEmployee[]>([])
  const [empLoads, setEmpLoads] = useState<EmployeeDailyLoad[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [tab, setTab] = useState<'dashboard' | 'config'>('dashboard')
  const [toast, setToast] = useState<{ open: boolean; msg: string; tone: 'success' | 'error' }>({ open: false, msg: '', tone: 'success' })
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let active = true
    async function load () {
      try {
        const today = new Date().toISOString().slice(0, 10)
        const monthEnd = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString().slice(0, 10)
        const [k, t, ac, ec, emps, el] = await Promise.all([
          fetchCapacityDashboard(),
          fetchProductionTickets('pendiente'),
          fetchAreaCapacities(),
          fetchEmployeeCapacities(),
          fetchProductionEmployees(),
          fetchEmployeeDailyLoadInRange(today, monthEnd).catch(() => [] as EmployeeDailyLoad[]),
        ])
        if (!active) return
        setKpi(k); setTickets(t); setAreaCaps(ac); setEmpCaps(ec); setEmployees(emps); setEmpLoads(el)
        setError('')
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : String(e))
      } finally {
        if (active) setLoading(false)
      }
    }
    load()
    return () => { active = false }
  }, [reloadKey])

  // Cálculos
  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), [])
  const threeDaysStr = useMemo(() => {
    const d = new Date(); d.setDate(d.getDate() + 3)
    return d.toISOString().slice(0, 10)
  }, [])
  const retrasados = useMemo(() => tickets.filter(t => t.fecha_programada && t.fecha_programada < todayStr), [tickets, todayStr])
  const proximos = useMemo(() => tickets.filter(t => t.fecha_programada && t.fecha_programada >= todayStr && t.fecha_programada <= threeDaysStr), [tickets, todayStr, threeDaysStr])
  const vencidos = retrasados

  // Carga por área (tickets pendientes programados hoy)
  const areaLoadsToday = useMemo(() => PRODUCTION_STEPS.map(step => {
    const cap = areaCaps.find(c => c.step === step)?.daily_capacity ?? 10
    // Para fabricación: tickets programados hoy pendientes
    // Para otras: trabajo real ese día (approximado desde tickets completados hoy)
    let count = 0
    if (step === 'fabricacion') {
      count = tickets.filter(t => t.fecha_programada === todayStr).length
    }
    return { step, count, cap }
  }), [areaCaps, tickets, todayStr])

  // Empleado con mayor / menor carga (suma de scheduled_count del mes)
  const empTotals = new Map<string, { name: string; total: number; capacity: number }>()
  for (const e of employees) {
    const loadsForEmp = empLoads.filter(l => l.employee_id === e.id && l.step === 'fabricacion')
    const total = loadsForEmp.reduce((s, l) => s + l.scheduled_count, 0)
    const cap = loadsForEmp.reduce((s, l) => s + l.daily_capacity, 0)
    empTotals.set(e.id, { name: e.name, total, capacity: cap })
  }
  const empArr = [...empTotals.entries()].map(([id, v]) => ({ id, ...v }))
  const empMax = empArr.length ? empArr.reduce((a, b) => (b.total > a.total ? b : a)) : null
  const empMin = empArr.length ? empArr.reduce((a, b) => (b.total < a.total ? b : a)) : null
  const areaMax = areaLoadsToday.length ? areaLoadsToday.reduce((a, b) => (b.count > a.count ? b : a)) : null

  return (
    <div style={{ animation: 'fadeInUp 0.3s ease', padding: '40px 48px 64px' }}>
      <div className='eyebrow' style={{ color: 'var(--red)', marginBottom: 8 }}>Capacidad</div>
      <h1 style={{ fontSize: 28, fontWeight: 700, color: 'var(--gray-900)', letterSpacing: '-0.025em', margin: 0 }}>
        Dashboard de Capacidad
      </h1>
      <p style={{ fontSize: 14, color: 'var(--gray-500)', marginTop: 8, lineHeight: 1.5, maxWidth: 620 }}>
        Visualiza la carga de producción, identifica cuellos de botella y configura capacidades diarias por área y empleado.
      </p>

      {/* Sub-tabs */}
      <div style={{ display: 'flex', gap: 4, marginTop: 22, marginLeft: -4, borderBottom: '1px solid var(--border)', marginBottom: 24 }}>
        <SubTab active={tab === 'dashboard'} onClick={() => setTab('dashboard')} icon={<Gauge size={14} />}>Dashboard</SubTab>
        <SubTab active={tab === 'config'} onClick={() => setTab('config')} icon={<Settings size={14} />}>Configurar capacidades</SubTab>
      </div>

      {error && (
        <div style={{
          background: 'var(--red-50)', border: '1px solid var(--red-ring)',
          borderRadius: 'var(--radius-lg)', padding: '12px 16px', marginBottom: 20, fontSize: 13.5, color: 'var(--red)',
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <AlertCircle size={16} /> {error}
        </div>
      )}

      {loading ? (
        <div style={{ padding: '60px', textAlign: 'center', color: 'var(--gray-500)' }}>Cargando…</div>
      ) : tab === 'dashboard' ? (
        <>
          {/* KPIs principales */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 32 }}>
            {kpi && (
              <>
                <KpiCard label='Capacidad utilizada hoy' value={`${kpi.tickets_hoy} / ${kpi.cap_hoy}`} icon={Gauge} tone={kpi.cap_hoy > 0 && kpi.tickets_hoy / kpi.cap_hoy > 0.8 ? 'red' : 'green'} />
                <KpiCard label='Capacidad esta semana' value={String(kpi.tickets_semana)} icon={BarChart3} />
                <KpiCard label='Capacidad este mes' value={String(kpi.tickets_mes)} icon={BarChart3} />
                <KpiCard label='Tickets retrasados' value={String(kpi.retrasados)} icon={AlertTriangle} tone={kpi.retrasados > 0 ? 'red' : 'green'} />
                <KpiCard label='Próximos a iniciar' value={String(kpi.proximos)} icon={Clock} tone={kpi.proximos > 0 ? 'amber' : 'green'} />
                <KpiCard label='Tickets vencidos' value={String(kpi.vencidos)} icon={CalendarClock} tone={kpi.vencidos > 0 ? 'red' : 'green'} />
              </>
            )}
          </div>

          {/* Área con mayor carga + ranking por área */}
          <h2 style={{ fontSize: 15, fontWeight: 600, color: 'var(--gray-900)', marginBottom: 16 }}>Carga por área (hoy)</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14, marginBottom: 32 }}>
            {areaLoadsToday.map(a => {
              const occ = occupancyLevel(a.count, a.cap)
              const toneColor = occ.tone === 'green' ? 'var(--green)' : occ.tone === 'amber' ? 'var(--amber)' : 'var(--red)'
              const isMax = areaMax?.step === a.step
              return (
                <div key={a.step} className='card' style={{ padding: 18, borderTop: `2px solid ${toneColor}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--gray-900)' }}>
                      {STEP_LABELS[a.step]}
                      {isMax && a.count > 0 && <span style={{ fontSize: 10, color: 'var(--red)', marginLeft: 6 }}>★ Mayor</span>}
                    </span>
                    <span style={{ fontSize: 11, color: 'var(--gray-500)', fontWeight: 600 }}>{occ.label}</span>
                  </div>
                  <div style={{ width: '100%', height: 6, borderRadius: 3, background: 'var(--gray-100)', overflow: 'hidden' }}>
                    <div style={{ width: `${occ.pct}%`, height: '100%', background: toneColor, transition: 'width 0.3s' }} />
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--gray-500)', marginTop: 6 }}>{occ.pct}% ocupación</div>
                </div>
              )
            })}
          </div>

          {/* Empleados con mayor / menor carga */}
          <h2 style={{ fontSize: 15, fontWeight: 600, color: 'var(--gray-900)', marginBottom: 16 }}>Carga por empleado (mes actual)</h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 32 }}>
            {empMax && (
              <div className='card' style={{ padding: 20, borderTop: '2px solid var(--red)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  <TrendingUp size={16} style={{ color: 'var(--red)' }} />
                  <span style={{ fontSize: 12, color: 'var(--gray-500)', fontWeight: 700, textTransform: 'uppercase' }}>Mayor carga</span>
                </div>
                <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--gray-900)' }}>{empMax.name}</div>
                <div style={{ fontSize: 13, color: 'var(--gray-500)', marginTop: 4 }}>
                  {empMax.total} tickets programados / {empMax.capacity} capacidad
                </div>
              </div>
            )}
            {empMin && (
              <div className='card' style={{ padding: 20, borderTop: '2px solid var(--green)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  <TrendingDown size={16} style={{ color: 'var(--green)' }} />
                  <span style={{ fontSize: 12, color: 'var(--gray-500)', fontWeight: 700, textTransform: 'uppercase' }}>Menor carga</span>
                </div>
                <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--gray-900)' }}>{empMin.name}</div>
                <div style={{ fontSize: 13, color: 'var(--gray-500)', marginTop: 4 }}>
                  {empMin.total} tickets programados / {empMin.capacity} capacidad
                </div>
              </div>
            )}
          </div>

          {/* Listas de tickets retrasados / próximos / vencidos */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
            <TicketListCard title='Tickets retrasados' icon={AlertTriangle} tone='red' tickets={retrasados} />
            <TicketListCard title='Próximos a iniciar' icon={Clock} tone='amber' tickets={proximos} />
            <TicketListCard title='Vencidos' icon={CalendarClock} tone='red' tickets={vencidos} />
          </div>
        </>
      ) : (
        <ConfigTab
          areaCaps={areaCaps}
          empCaps={empCaps}
          employees={employees}
          user={user}
          onChanged={() => setReloadKey(k => k + 1)}
          onToast={(msg, tone) => setToast({ open: true, msg, tone })}
        />
      )}

      <Toast
        open={toast.open}
        tone={toast.tone}
        message={toast.msg}
        onClose={() => setToast(t => ({ ...t, open: false }))}
      />
    </div>
  )
}

// ─────────────────────────────────────────────────────────
// Config tab
// ─────────────────────────────────────────────────────────
function ConfigTab ({ areaCaps, empCaps, employees, user, onChanged, onToast }: {
  areaCaps: AreaCapacity[]
  empCaps: EmployeeCapacity[]
  employees: ProductionEmployee[]
  user: { name: string }
  onChanged: () => void
  onToast: (msg: string, tone: 'success' | 'error') => void
}) {
  const [areaDraft, setAreaDraft] = useState<Record<string, number>>({})
  const [empDraft, setEmpDraft] = useState<Record<string, number>>({})
  const [pending, startTransition] = useTransition()

  // Inicializar draft desde los datos cargados (render-phase init, evita setState en efecto)
  if (areaCaps.length > 0 && Object.keys(areaDraft).length === 0) {
    const a: Record<string, number> = {}
    for (const c of areaCaps) a[c.step] = c.daily_capacity
    setAreaDraft(a)
  } else if (areaCaps.length === 0 && Object.keys(areaDraft).length > 0) {
    setAreaDraft({})
  }

  if (empCaps.length > 0 && Object.keys(empDraft).length === 0) {
    const e: Record<string, number> = {}
    for (const c of empCaps) e[`${c.employee_id}|${c.step}`] = c.daily_capacity
    setEmpDraft(e)
  } else if (empCaps.length === 0 && Object.keys(empDraft).length > 0) {
    setEmpDraft({})
  }

  function saveArea (step: ProductionStep) {
    const value = areaDraft[step]
    if (value == null) return
    startTransition(async () => {
      const res = await setAreaCapacity({ step, daily_capacity: value, updated_by: user.name })
      if (!res.ok) { onToast(res.error ?? 'Error', 'error'); return }
      onToast(`Capacidad de ${STEP_LABELS[step]} guardada`, 'success')
      onChanged()
    })
  }

  function saveEmp (employeeId: string, step: ProductionStep) {
    const value = empDraft[`${employeeId}|${step}`]
    if (value == null) return
    startTransition(async () => {
      const res = await setEmployeeCapacity({ employee_id: employeeId, step, daily_capacity: value, updated_by: user.name })
      if (!res.ok) { onToast(res.error ?? 'Error', 'error'); return }
      onToast('Capacidad de empleado guardada', 'success')
      onChanged()
    })
  }

  return (
    <div>
      {/* Capacidades por área */}
      <h2 style={{ fontSize: 15, fontWeight: 600, color: 'var(--gray-900)', marginBottom: 16 }}>Capacidad diaria por área</h2>
      <div className='card' style={{ padding: 0, overflow: 'hidden', marginBottom: 32 }}>
        <table className='table-dark'>
          <thead><tr><th>Área</th><th>Capacidad diaria (tickets)</th><th></th></tr></thead>
          <tbody>
            {PRODUCTION_STEPS.map(step => (
              <tr key={step}>
                <td style={{ fontWeight: 600, color: 'var(--gray-900)' }}>{STEP_LABELS[step]}</td>
                <td>
                  <input
                    type='number'
                    min={1}
                    value={areaDraft[step] ?? 10}
                    onChange={e => setAreaDraft(d => ({ ...d, [step]: Number(e.target.value) }))}
                    className='input-base'
                    style={{ height: 36, width: 120 }}
                  />
                </td>
                <td>
                  <button onClick={() => saveArea(step)} disabled={pending} className='btn btn-primary btn-sm'>
                    <Save size={13} /> Guardar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Capacidades por empleado */}
      <h2 style={{ fontSize: 15, fontWeight: 600, color: 'var(--gray-900)', marginBottom: 16 }}>
        <Users size={14} style={{ display: 'inline', marginRight: 6, verticalAlign: 'middle' }} />
        Capacidad diaria por empleado
      </h2>
      <div className='card' style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table className='table-dark'>
            <thead>
              <tr>
                <th>Empleado</th>
                {PRODUCTION_STEPS.map(s => <th key={s}>{STEP_LABELS[s]}</th>)}
              </tr>
            </thead>
            <tbody>
              {employees.map(emp => (
                <tr key={emp.id}>
                  <td style={{ fontWeight: 600, color: 'var(--gray-900)' }}>{emp.name}</td>
                  {PRODUCTION_STEPS.map(step => {
                    const key = `${emp.id}|${step}`
                    const val = empDraft[key] ?? 5
                    return (
                      <td key={step}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <input
                            type='number'
                            min={0}
                            value={val}
                            onChange={e => setEmpDraft(d => ({ ...d, [key]: Number(e.target.value) }))}
                            className='input-base'
                            style={{ height: 32, width: 70, fontSize: 12.5 }}
                          />
                          <button
                            onClick={() => saveEmp(emp.id, step)}
                            disabled={pending}
                            className='btn-icon'
                            style={{ width: 28, height: 28, flexShrink: 0 }}
                            title='Guardar'
                          >
                            <Save size={12} />
                          </button>
                        </div>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────
function TicketListCard ({ title, icon: Icon, tone, tickets }: {
  title: string
  icon: React.ComponentType<{ size?: number; style?: React.CSSProperties }>
  tone: 'red' | 'amber' | 'green'
  tickets: ProductionTicket[]
}) {
  const colors = {
    red: { border: 'var(--red)', bg: 'var(--red-50)', text: 'var(--red)' },
    amber: { border: 'var(--amber)', bg: 'var(--amber-bg)', text: 'var(--amber)' },
    green: { border: 'var(--green)', bg: 'var(--green-bg)', text: 'var(--green)' },
  }[tone]

  return (
    <div className='card' style={{ padding: 0, overflow: 'hidden', borderTop: `2px solid ${colors.border}` }}>
      <div style={{
        padding: '12px 18px', borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', gap: 8, background: colors.bg,
      }}>
        <Icon size={15} style={{ color: colors.text }} />
        <span style={{ fontSize: 13, fontWeight: 700, color: colors.text }}>{title}</span>
        <span style={{
          marginLeft: 'auto', fontSize: 11, fontWeight: 700, color: colors.text,
          background: 'var(--bg-card)', padding: '2px 8px', borderRadius: 9999,
        }}>{tickets.length}</span>
      </div>
      {tickets.length === 0 ? (
        <div style={{ padding: '24px 18px', fontSize: 12.5, color: 'var(--gray-400)' }}>Sin tickets</div>
      ) : (
        <div style={{ maxHeight: 280, overflowY: 'auto' }}>
          {tickets.slice(0, 15).map(t => (
            <div key={t.id} style={{
              padding: '10px 18px', borderBottom: '1px solid var(--border-subtle)',
              fontSize: 12.5, display: 'flex', justifyContent: 'space-between', gap: 8,
            }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 600, color: 'var(--gray-900)' }}>{t.orden ?? '—'}</div>
                <div style={{ color: 'var(--gray-500)', fontSize: 11 }}>{t.vehiculo ?? '—'}</div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontSize: 11, color: 'var(--gray-500)' }}>Programado</div>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--gray-700)' }}>
                  {t.fecha_programada ? formatDateShort(t.fecha_programada) : '—'}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function KpiCard ({ label, value, icon: Icon, tone = 'green' }: {
  label: string
  value: string
  icon: React.ComponentType<{ size?: number; style?: React.CSSProperties }>
  tone?: 'red' | 'amber' | 'green'
}) {
  const colors = {
    red: 'var(--red)', amber: 'var(--amber)', green: 'var(--green)',
  }
  return (
    <div className='kpi' style={{ borderTop: `2px solid ${colors[tone]}` }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ fontSize: 11, color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>{label}</div>
        <div style={{
          width: 32, height: 32, borderRadius: 'var(--radius)',
          background: 'var(--gray-50)', color: 'var(--gray-500)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon size={14} />
        </div>
      </div>
      <div style={{ fontSize: 26, fontWeight: 700, color: 'var(--gray-900)', lineHeight: 1, letterSpacing: '-0.02em' }}>{value}</div>
    </div>
  )
}

function SubTab ({ active, onClick, icon, children }: { active: boolean; onClick: () => void; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <button onClick={onClick} style={{
      display: 'inline-flex', alignItems: 'center', gap: 8, padding: '12px 4px', marginRight: 24,
      background: 'transparent', border: 'none',
      borderBottom: active ? '2px solid var(--red)' : '2px solid transparent',
      cursor: 'pointer', fontSize: 14, fontWeight: 600,
      color: active ? 'var(--gray-900)' : 'var(--gray-500)', marginBottom: -1,
    }}>
      {icon} {children}
    </button>
  )
}

function formatDateShort (iso: string): string {
  const d = new Date(iso + 'T00:00:00')
  if (isNaN(d.getTime())) return iso
  return d.toLocaleDateString('es-DO', { day: '2-digit', month: '2-digit' })
}
