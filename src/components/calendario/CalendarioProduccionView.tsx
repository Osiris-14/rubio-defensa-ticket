'use client'
import { useState, useEffect, useMemo } from 'react'
import { useTransition } from 'react'
import {
  ChevronLeft, ChevronRight, Calendar as CalendarIcon, Filter, AlertCircle,
  LayoutGrid, Calendar as CalIcon, CalendarDays,
} from 'lucide-react'
import {
  fetchCalendarEvents,
  fetchAreaCapacities,
  fetchAreaDailyLoadInRange,
  fetchProductionEmployees,
  STEP_LABELS,
  PRODUCTION_STEPS,
  PRIORIDAD_LABELS,
  PRIORIDAD_COLORS,
  occupancyLevel,
  type CalendarEvent,
  type AreaCapacity,
  type AreaDailyLoad,
  type ProductionEmployee,
  type ProductionStep,
  type Prioridad,
} from '@/lib/production-v2'
import { moveTicketSchedule } from '@/app/actions/production'
import { Toast } from '@/components/ui'

type View = 'mes' | 'semana' | 'dia'

interface Props {
  user: { id: string; name: string; role: string }
}

export default function CalendarioProduccionView ({ user }: Props) {
  const [view, setView] = useState<View>('mes')
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [capacities, setCapacities] = useState<AreaCapacity[]>([])
  const [loads, setLoads] = useState<AreaDailyLoad[]>([])
  const [employees, setEmployees] = useState<ProductionEmployee[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [cursor, setCursor] = useState(() => new Date())
  const [toast, setToast] = useState<{ open: boolean; msg: string; tone: 'success' | 'error' }>({ open: false, msg: '', tone: 'success' })
  const [pending, startTransition] = useTransition()

  // Filtros
  const [fArea, setFArea] = useState<ProductionStep | 'todas'>('todas')
  const [fEmpleado, setFEmpleado] = useState<string>('todos')
  const [fEstado, setFEstado] = useState<'todos' | 'pendiente' | 'completado'>('todos')
  const [fSearch, setFSearch] = useState('')

  // Rango visible según la vista
  const range = useMemo(() => getRange(view, cursor), [view, cursor])

  useEffect(() => {
    fetchAreaCapacities().then(setCapacities).catch(() => {})
    fetchProductionEmployees().then(setEmployees).catch(() => {})
  }, [])

  useEffect(() => {
    let active = true
    ;(async () => {
      setLoading(true)
      setError('')
      try {
        const [evs, loadsData] = await Promise.all([
          fetchCalendarEvents(range.from, range.to),
          fetchAreaDailyLoadInRange(range.from, range.to),
        ])
        if (!active) return
        setEvents(evs)
        setLoads(loadsData)
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : String(e))
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => { active = false }
  }, [range.from, range.to])

  // Filtros aplicados
  const filteredEvents = useMemo(() => {
    let list = events
    if (fArea !== 'todas') {
      list = list.filter(e => {
        if (fArea === 'fabricacion') return !e.completed_steps.includes('fabricacion')
        // Para otras etapas: el ticket ya completó esa etapa
        return e.completed_steps.includes(fArea)
      })
    }
    if (fEmpleado !== 'todos') {
      list = list.filter(e => e.fabricador_id === fEmpleado)
    }
    if (fEstado !== 'todos') {
      list = list.filter(e => e.status === fEstado)
    }
    if (fSearch) {
      const q = fSearch.toLowerCase()
      list = list.filter(e =>
        (e.orden ?? '').toLowerCase().includes(q) ||
        (e.vehiculo ?? '').toLowerCase().includes(q) ||
        (e.cliente ?? '').toLowerCase().includes(q) ||
        (e.factura ?? '').toLowerCase().includes(q)
      )
    }
    return list
  }, [events, fArea, fEmpleado, fEstado, fSearch])

  function refresh () {
    setLoading(true)
    setError('')
    Promise.all([
      fetchCalendarEvents(range.from, range.to),
      fetchAreaDailyLoadInRange(range.from, range.to),
    ]).then(([evs, loadsData]) => {
      setEvents(evs)
      setLoads(loadsData)
    }).catch(e => {
      setError(e instanceof Error ? e.message : String(e))
    }).finally(() => {
      setLoading(false)
    })
  }

  function handleDrop (ticketId: string, newFecha: string) {
    startTransition(async () => {
      const res = await moveTicketSchedule({
        ticket_id: ticketId,
        new_fecha: newFecha,
        changed_by: user.name,
      })
      if (!res.ok) {
        setToast({ open: true, msg: res.error ?? 'Error al mover', tone: 'error' })
        return
      }
      setToast({ open: true, msg: `Ticket movido a ${formatDateLong(newFecha)}`, tone: 'success' })
      refresh()
    })
  }

  function prev () { setCursor(c => shiftCursor(view, c, -1)) }
  function next () { setCursor(c => shiftCursor(view, c, 1)) }
  function goToday () { setCursor(new Date()) }

  const rangeLabel = formatRangeLabel(view, cursor)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      {/* Header */}
      <div className='workspace-header' style={{ padding: '24px 48px 0', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--gray-500)', fontWeight: 500, marginBottom: 16 }}>
          <span>Operación</span>
          <ChevronRight size={12} style={{ color: 'var(--gray-400)' }} />
          <span style={{ color: 'var(--gray-700)', fontWeight: 600 }}>Calendario de Producción</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 24, flexWrap: 'wrap' }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <h1 style={{ fontSize: 28, fontWeight: 700, color: 'var(--gray-900)', letterSpacing: '-0.025em', margin: 0 }}>
              Calendario
            </h1>
            <p style={{ fontSize: 13.5, color: 'var(--gray-500)', marginTop: 6, lineHeight: 1.5 }}>
              Planificación de capacidad por día, área y empleado. Arrastra tickets para reprogramar.
            </p>
          </div>

          {/* View switcher */}
          <div style={{ display: 'flex', gap: 4, padding: 3, background: 'var(--gray-100)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
            {(['mes','semana','dia'] as View[]).map(v => (
              <button key={v} onClick={() => setView(v)} className={`segmented-item ${view === v ? 'active' : ''}`} style={{ padding: '6px 14px' }}>
                {v === 'mes' ? <><LayoutGrid size={13} style={{ display: 'inline', marginRight: 4, verticalAlign: 'middle' }} />Mes</> :
                 v === 'semana' ? <><CalIcon size={13} style={{ display: 'inline', marginRight: 4, verticalAlign: 'middle' }} />Semana</> :
                 <><CalendarDays size={13} style={{ display: 'inline', marginRight: 4, verticalAlign: 'middle' }} />Día</>}
              </button>
            ))}
          </div>
        </div>

        {/* Toolbar: navegación + filtros */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 18, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button onClick={prev} className='btn-icon' style={{ width: 32, height: 32 }}><ChevronLeft size={16} /></button>
            <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--gray-900)', minWidth: 140, textAlign: 'center' }}>
              {rangeLabel}
            </span>
            <button onClick={next} className='btn-icon' style={{ width: 32, height: 32 }}><ChevronRight size={16} /></button>
            <button onClick={goToday} className='btn btn-secondary btn-sm' style={{ marginLeft: 6 }}>Hoy</button>
          </div>

          <div style={{ width: 1, height: 24, background: 'var(--border)' }} />

          {/* Filtros */}
          <FilterSelect label='Área' value={fArea} onChange={v => setFArea(v as ProductionStep | 'todas')} options={[
            { value: 'todas', label: 'Todas' },
            ...PRODUCTION_STEPS.map(s => ({ value: s, label: STEP_LABELS[s] })),
          ]} />
          <FilterSelect label='Empleado' value={fEmpleado} onChange={setFEmpleado} options={[
            { value: 'todos', label: 'Todos' },
            ...employees.map(e => ({ value: e.id, label: e.name })),
          ]} />
          <FilterSelect label='Estado' value={fEstado} onChange={v => setFEstado(v as typeof fEstado)} options={[
            { value: 'todos', label: 'Todos' },
            { value: 'pendiente', label: 'Pendiente' },
            { value: 'completado', label: 'Completado' },
          ]} />
          <div style={{ position: 'relative', flex: '1 1 200px', maxWidth: 260 }}>
            <input
              type='text'
              className='input-base'
              style={{ height: 36, fontSize: 13, paddingLeft: 36 }}
              placeholder='Buscar orden, vehículo, cliente…'
              value={fSearch}
              onChange={e => setFSearch(e.target.value)}
            />
            <Filter size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--gray-400)' }} />
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, padding: '20px 48px 80px', overflowY: 'auto' }}>
        {error && (
          <div style={{
            background: 'var(--red-50)', border: '1px solid var(--red-ring)',
            borderRadius: 'var(--radius-lg)', padding: '12px 16px', marginBottom: 16, fontSize: 13.5, color: 'var(--red)',
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <AlertCircle size={16} /> {error}
          </div>
        )}

        {loading ? (
          <div style={{ padding: '60px', textAlign: 'center', color: 'var(--gray-500)' }}>Cargando…</div>
        ) : view === 'mes' ? (
          <MonthView
            cursor={cursor}
            events={filteredEvents}
            loads={loads}
            capacities={capacities}
            onDrop={handleDrop}
            pending={pending}
          />
        ) : view === 'semana' ? (
          <WeekView
            cursor={cursor}
            events={filteredEvents}
            loads={loads}
            capacities={capacities}
            onDrop={handleDrop}
            pending={pending}
          />
        ) : (
          <DayView
            cursor={cursor}
            events={filteredEvents}
            onDrop={handleDrop}
            pending={pending}
          />
        )}
      </div>

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
// Vista Mes
// ─────────────────────────────────────────────────────────
const WEEKDAYS_FULL = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

function MonthView ({ cursor, events, loads, capacities, onDrop, pending }: {
  cursor: Date
  events: CalendarEvent[]
  loads: AreaDailyLoad[]
  capacities: AreaCapacity[]
  onDrop: (ticketId: string, newFecha: string) => void
  pending: boolean
}) {
  const year = cursor.getFullYear()
  const month = cursor.getMonth()
  const firstOfMonth = new Date(year, month, 1)
  const startOffset = (firstOfMonth.getDay() + 6) % 7
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const todayStr = new Date().toISOString().slice(0, 10)

  const cells: (string | null)[] = []
  for (let i = 0; i < startOffset; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(new Date(year, month, d).toISOString().slice(0, 10))
  }
  while (cells.length % 7 !== 0) cells.push(null)

  const loadMap = new Map<string, AreaDailyLoad>()
  for (const l of loads) loadMap.set(`${l.fecha}|${l.step}`, l)
  const fabCap = capacities.find(c => c.step === 'fabricacion')?.daily_capacity ?? 10

  function eventsForDay (date: string): CalendarEvent[] {
    return events.filter(e => e.fecha_programada === date || (e.status === 'completado' && e.fecha_programada === date))
  }

  return (
    <div style={{
      border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)',
      background: 'var(--bg-card)', overflow: 'hidden',
    }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: '1px solid var(--border)' }}>
        {WEEKDAYS_FULL.map(d => (
          <div key={d} style={{
            padding: '10px 8px', textAlign: 'center', fontSize: 11, fontWeight: 700,
            color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: '0.06em',
            borderRight: '1px solid var(--border-subtle)',
          }}>{d}</div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 1, background: 'var(--border-subtle)' }}>
        {cells.map((date, i) => {
          if (!date) return <div key={i} style={{ background: 'var(--gray-50)', minHeight: 120 }} />
          const dayEvents = eventsForDay(date)
          const fabLoad = loadMap.get(`${date}|fabricacion`)
          const count = fabLoad?.tickets_count ?? 0
          const cap = fabLoad?.daily_capacity ?? fabCap
          const occ = occupancyLevel(count, cap)
          const isToday = date === todayStr

          return (
            <DropCell
              key={i}
              date={date}
              isToday={isToday}
              occ={occ}
              count={count}
              cap={cap}
              events={dayEvents}
              onDrop={onDrop}
              pending={pending}
            />
          )
        })}
      </div>
    </div>
  )
}

function DropCell ({ date, isToday, occ, count, cap, events, onDrop, pending }: {
  date: string
  isToday: boolean
  occ: { pct: number; tone: 'green' | 'amber' | 'red'; label: string }
  count: number
  cap: number
  events: CalendarEvent[]
  onDrop: (ticketId: string, newFecha: string) => void
  pending: boolean
}) {
  const [over, setOver] = useState(false)
  const toneBg = occ.tone === 'green' ? 'var(--green-bg)' : occ.tone === 'amber' ? 'var(--amber-bg)' : 'var(--red-50)'
  const toneColor = occ.tone === 'green' ? 'var(--green)' : occ.tone === 'amber' ? 'var(--amber)' : 'var(--red)'

  return (
    <div
      onDragOver={e => { e.preventDefault(); setOver(true) }}
      onDragLeave={() => setOver(false)}
      onDrop={e => {
        e.preventDefault()
        setOver(false)
        const ticketId = e.dataTransfer.getData('text/ticket-id')
        if (ticketId) onDrop(ticketId, date)
      }}
      style={{
        background: over ? 'var(--red-50)' : (isToday ? 'var(--blue-bg)' : 'var(--bg-card)'),
        minHeight: 120, padding: '6px 6px 4px', cursor: 'default',
        display: 'flex', flexDirection: 'column', gap: 4,
        outline: over ? '2px solid var(--red)' : 'none',
        outlineOffset: -2,
        opacity: pending ? 0.5 : 1,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{
          fontSize: 12, fontWeight: 700,
          color: isToday ? 'var(--blue)' : 'var(--gray-700)',
          fontFeatureSettings: '"tnum" 1',
        }}>
          {Number(date.slice(-2))}
        </span>
        {count > 0 && (
          <span style={{
            fontSize: 9.5, fontWeight: 700, color: toneColor,
            background: toneBg, padding: '1px 6px', borderRadius: 9999,
          }}>
            {count}/{cap}
          </span>
        )}
      </div>

      {/* Barra de ocupación */}
      {count > 0 && (
        <div style={{ width: '100%', height: 3, borderRadius: 2, background: 'var(--gray-100)', overflow: 'hidden' }}>
          <div style={{ width: `${occ.pct}%`, height: '100%', background: toneColor }} />
        </div>
      )}

      {/* Eventos del día */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, overflowY: 'auto', flex: 1 }}>
        {events.slice(0, 4).map(e => (
          <EventChip key={e.id} event={e} />
        ))}
        {events.length > 4 && (
          <span style={{ fontSize: 10, color: 'var(--gray-400)', padding: '2px 4px' }}>
            +{events.length - 4} más
          </span>
        )}
      </div>
    </div>
  )
}

function EventChip ({ event }: { event: CalendarEvent }) {
  const pri = event.prioridad ?? 'normal'
  const priColor = PRIORIDAD_COLORS[pri]
  const doneFab = event.completed_steps.includes('fabricacion')
  return (
    <div
      draggable
      onDragStart={e => {
        e.dataTransfer.setData('text/ticket-id', event.ticket_id)
        e.dataTransfer.effectAllowed = 'move'
      }}
      style={{
        padding: '3px 7px', borderRadius: 4, cursor: 'grab', fontSize: 10.5,
        background: event.status === 'completado' ? 'var(--green-bg)' : priColor.bg,
        color: event.status === 'completado' ? 'var(--green)' : priColor.text,
        borderLeft: `3px solid ${event.status === 'completado' ? 'var(--green)' : priColor.dot}`,
        fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        display: 'flex', alignItems: 'center', gap: 4,
      }}
      title={`${event.orden ?? '—'} · ${event.vehiculo ?? '—'}${event.fabricador_name ? ' · ' + event.fabricador_name : ''}`}
    >
      {doneFab && <span style={{ fontSize: 9 }}>✔</span>}
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {event.orden ?? event.vehiculo ?? '—'}
      </span>
    </div>
  )
}

// ─────────────────────────────────────────────────────────
// Vista Semana
// ─────────────────────────────────────────────────────────
function WeekView ({ cursor, events, loads, capacities, onDrop, pending }: {
  cursor: Date
  events: CalendarEvent[]
  loads: AreaDailyLoad[]
  capacities: AreaCapacity[]
  onDrop: (ticketId: string, newFecha: string) => void
  pending: boolean
}) {
  const weekStart = startOfWeek(cursor)
  const days: string[] = []
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart); d.setDate(weekStart.getDate() + i)
    days.push(d.toISOString().slice(0, 10))
  }
  const todayStr = new Date().toISOString().slice(0, 10)
  const loadMap = new Map<string, AreaDailyLoad>()
  for (const l of loads) loadMap.set(`${l.fecha}|${l.step}`, l)
  const fabCap = capacities.find(c => c.step === 'fabricacion')?.daily_capacity ?? 10

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 8 }}>
      {days.map(date => {
        const dayEvents = events.filter(e => e.fecha_programada === date)
        const fabLoad = loadMap.get(`${date}|fabricacion`)
        const count = fabLoad?.tickets_count ?? 0
        const cap = fabLoad?.daily_capacity ?? fabCap
        const occ = occupancyLevel(count, cap)
        const isToday = date === todayStr
        return (
          <div key={date} style={{
            border: `1px solid ${isToday ? 'var(--blue-ring)' : 'var(--border)'}`,
            borderRadius: 'var(--radius)', background: 'var(--bg-card)', minHeight: 360,
            display: 'flex', flexDirection: 'column', overflow: 'hidden',
          }}>
            <div style={{
              padding: '10px 12px', borderBottom: '1px solid var(--border)',
              background: isToday ? 'var(--blue-bg)' : 'var(--bg-page)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <div>
                <div style={{ fontSize: 11, color: 'var(--gray-500)', fontWeight: 600, textTransform: 'uppercase' }}>
                  {WEEKDAYS_FULL[(new Date(date + 'T00:00:00').getDay() + 6) % 7]}
                </div>
                <div style={{ fontSize: 18, fontWeight: 700, color: isToday ? 'var(--blue)' : 'var(--gray-900)' }}>
                  {Number(date.slice(-2))}
                </div>
              </div>
              {count > 0 && (
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 10, color: 'var(--gray-500)', fontWeight: 600 }}>{occ.label}</div>
                  <div style={{ width: 40, height: 4, borderRadius: 2, background: 'var(--gray-100)', overflow: 'hidden', marginTop: 3 }}>
                    <div style={{ width: `${occ.pct}%`, height: '100%', background: occ.tone === 'green' ? 'var(--green)' : occ.tone === 'amber' ? 'var(--amber)' : 'var(--red)' }} />
                  </div>
                </div>
              )}
            </div>
            <DropCell
              date={date}
              isToday={isToday}
              occ={occ}
              count={count}
              cap={cap}
              events={dayEvents}
              onDrop={onDrop}
              pending={pending}
            />
          </div>
        )
      })}
    </div>
  )
}

// ─────────────────────────────────────────────────────────
// Vista Día
// ─────────────────────────────────────────────────────────
function DayView ({ cursor, events, onDrop, pending }: {
  cursor: Date
  events: CalendarEvent[]
  onDrop: (ticketId: string, newFecha: string) => void
  pending: boolean
}) {
  const date = cursor.toISOString().slice(0, 10)
  const dayEvents = events.filter(e => e.fecha_programada === date)
  const [over, setOver] = useState(false)

  return (
    <div
      onDragOver={e => { e.preventDefault(); setOver(true) }}
      onDragLeave={() => setOver(false)}
      onDrop={e => {
        e.preventDefault(); setOver(false)
        const ticketId = e.dataTransfer.getData('text/ticket-id')
        if (ticketId) onDrop(ticketId, date)
      }}
      style={{
        background: over ? 'var(--red-50)' : 'var(--bg-card)',
        border: `1px solid ${over ? 'var(--red)' : 'var(--border)'}`,
        borderRadius: 'var(--radius-lg)', padding: 24, minHeight: 400,
        opacity: pending ? 0.5 : 1,
      }}
    >
      <div style={{ marginBottom: 20 }}>
        <div className='eyebrow' style={{ color: 'var(--red)', marginBottom: 6 }}>Día</div>
        <h2 style={{ fontSize: 22, fontWeight: 700, color: 'var(--gray-900)', margin: 0 }}>
          {formatDateLong(date)}
        </h2>
        <p style={{ fontSize: 13, color: 'var(--gray-500)', marginTop: 4 }}>
          {dayEvents.length} ticket{dayEvents.length !== 1 ? 's' : ''} programado{dayEvents.length !== 1 ? 's' : ''}
        </p>
      </div>

      {dayEvents.length === 0 ? (
        <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--gray-400)' }}>
          <CalendarIcon size={32} style={{ marginBottom: 10 }} />
          <p style={{ fontSize: 13 }}>No hay tickets programados para este día.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {dayEvents.map(e => <DayEventRow key={e.id} event={e} />)}
        </div>
      )}
    </div>
  )
}

function DayEventRow ({ event }: { event: CalendarEvent }) {
  const pri = event.prioridad ?? 'normal'
  const priColor = PRIORIDAD_COLORS[pri]
  return (
    <div
      draggable
      onDragStart={e => {
        e.dataTransfer.setData('text/ticket-id', event.ticket_id)
        e.dataTransfer.effectAllowed = 'move'
      }}
      style={{
        display: 'flex', alignItems: 'center', gap: 14, padding: '12px 16px',
        background: event.status === 'completado' ? 'var(--green-bg)' : 'var(--bg-page)',
        border: `1px solid ${event.status === 'completado' ? 'var(--green-ring)' : 'var(--border)'}`,
        borderLeft: `4px solid ${event.status === 'completado' ? 'var(--green)' : priColor.dot}`,
        borderRadius: 'var(--radius)', cursor: 'grab',
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--gray-900)' }}>
            {event.orden ?? '—'}
          </span>
          {event.prioridad && event.prioridad !== 'normal' && (
            <span style={{
              fontSize: 10, fontWeight: 700, color: priColor.text, background: priColor.bg,
              padding: '2px 8px', borderRadius: 9999, textTransform: 'uppercase',
            }}>{PRIORIDAD_LABELS[event.prioridad]}</span>
          )}
          {event.status === 'completado' && (
            <span style={{
              fontSize: 10, fontWeight: 700, color: 'var(--green)', background: 'var(--green-bg)',
              padding: '2px 8px', borderRadius: 9999, textTransform: 'uppercase',
            }}>Completado</span>
          )}
        </div>
        <div style={{ fontSize: 12.5, color: 'var(--gray-600)' }}>
          {event.vehiculo ?? '—'} · {event.cliente ?? 'Cliente —'} · {event.total_pieces} pieza{event.total_pieces !== 1 ? 's' : ''}
        </div>
      </div>
      {event.fabricador_name && (
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '4px 12px', background: 'var(--bg-card)', border: '1px solid var(--border)',
          borderRadius: 9999, fontSize: 12, color: 'var(--gray-700)', fontWeight: 500,
        }}>
          👤 {event.fabricador_name}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────
// Filter select
// ─────────────────────────────────────────────────────────
function FilterSelect ({ label, value, onChange, options }: {
  label: string
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
}) {
  return (
    <div style={{ position: 'relative' }}>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className='input-base'
        style={{ height: 36, fontSize: 12.5, fontWeight: 600, paddingRight: 30, appearance: 'none' as const, minWidth: 120 }}
      >
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <ChevronRight size={12} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%) rotate(90deg)', color: 'var(--gray-400)', pointerEvents: 'none' }} />
    </div>
  )
}

// ─────────────────────────────────────────────────────────
// Date helpers
// ─────────────────────────────────────────────────────────
function startOfWeek (d: Date): Date {
  const r = new Date(d)
  const day = r.getDay() || 7
  r.setDate(r.getDate() - day + 1)
  r.setHours(0, 0, 0, 0)
  return r
}

function getRange (view: View, cursor: Date): { from: string; to: string } {
  if (view === 'mes') {
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1)
    const last = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0)
    return { from: first.toISOString().slice(0, 10), to: last.toISOString().slice(0, 10) }
  }
  if (view === 'semana') {
    const start = startOfWeek(cursor)
    const end = new Date(start); end.setDate(start.getDate() + 6)
    return { from: start.toISOString().slice(0, 10), to: end.toISOString().slice(0, 10) }
  }
  return { from: cursor.toISOString().slice(0, 10), to: cursor.toISOString().slice(0, 10) }
}

function shiftCursor (view: View, cursor: Date, dir: 1 | -1): Date {
  if (view === 'mes') {
    return new Date(cursor.getFullYear(), cursor.getMonth() + dir, 1)
  }
  if (view === 'semana') {
    const r = new Date(cursor); r.setDate(cursor.getDate() + dir * 7)
    return r
  }
  const r = new Date(cursor); r.setDate(cursor.getDate() + dir)
  return r
}

function formatRangeLabel (view: View, cursor: Date): string {
  const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
  if (view === 'mes') return `${MONTHS[cursor.getMonth()]} ${cursor.getFullYear()}`
  if (view === 'semana') {
    const start = startOfWeek(cursor)
    const end = new Date(start); end.setDate(start.getDate() + 6)
    return `${start.getDate()} – ${end.getDate()} ${MONTHS[end.getMonth()]}`
  }
  return cursor.toLocaleDateString('es-DO', { weekday: 'long', day: 'numeric', month: 'long' })
}

function formatDateLong (iso: string): string {
  const d = new Date(iso + 'T00:00:00')
  if (isNaN(d.getTime())) return iso
  return d.toLocaleDateString('es-DO', { day: 'numeric', month: 'short', year: 'numeric' })
}
