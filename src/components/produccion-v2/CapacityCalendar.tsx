'use client'
import { useState, useEffect } from 'react'
import { ChevronLeft, ChevronRight, AlertCircle } from 'lucide-react'
import {
  fetchFabricacionLoadForDate,
  fetchEmployeeLoadForDate,
  occupancyLevel,
} from '@/lib/production-v2'

interface Props {
  selectedDate: string
  onSelect: (date: string) => void
  fabricadorId?: string | null
  capacityLabel?: string
}

const WEEKDAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

interface DayLoad {
  count: number
  capacity: number
}

export default function CapacityCalendar ({ selectedDate, onSelect, fabricadorId, capacityLabel = 'Tickets' }: Props) {
  const today = new Date()
  const [viewYear, setViewYear] = useState(today.getFullYear())
  const [viewMonth, setViewMonth] = useState(today.getMonth())
  const [loads, setLoads] = useState<Record<string, DayLoad>>({})
  const [empLoad, setEmpLoad] = useState<Record<string, DayLoad>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Cargar ocupación del mes visible
  useEffect(() => {
    let active = true
    async function load () {
      setLoading(true)
      setError('')
      try {
        const firstDay = new Date(viewYear, viewMonth, 1)
        const lastDay = new Date(viewYear, viewMonth + 1, 0)

        const days: string[] = []
        const cur = new Date(firstDay)
        while (cur <= lastDay) {
          days.push(cur.toISOString().slice(0, 10))
          cur.setDate(cur.getDate() + 1)
        }
        const fabMap: Record<string, DayLoad> = {}
        await Promise.all(days.map(async d => {
          const r = await fetchFabricacionLoadForDate(d)
          fabMap[d] = { count: r.count, capacity: r.capacity }
        }))
        if (!active) return
        setLoads(fabMap)

        // Carga del fabricador seleccionado
        if (fabricadorId) {
          const empMap: Record<string, DayLoad> = {}
          await Promise.all(days.map(async d => {
            const r = await fetchEmployeeLoadForDate(fabricadorId, d)
            empMap[d] = { count: r.count, capacity: r.capacity }
          }))
          if (!active) return
          setEmpLoad(empMap)
        } else {
          setEmpLoad({})
        }
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : String(e))
      } finally {
        if (active) setLoading(false)
      }
    }
    load()
    return () => { active = false }
  }, [viewYear, viewMonth, fabricadorId])

  function prevMonth () {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1) }
    else setViewMonth(m => m - 1)
  }
  function nextMonth () {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1) }
    else setViewMonth(m => m + 1)
  }
  function goToday () {
    setViewYear(today.getFullYear())
    setViewMonth(today.getMonth())
  }

  // Construir grilla del mes (Lun..Dom)
  const firstOfMonth = new Date(viewYear, viewMonth, 1)
  // 0=Dom, 1=Lun... convertir a Lun=0
  const startOffset = (firstOfMonth.getDay() + 6) % 7
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
  const cells: (string | null)[] = []
  for (let i = 0; i < startOffset; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(viewYear, viewMonth, d)
    cells.push(date.toISOString().slice(0, 10))
  }
  while (cells.length % 7 !== 0) cells.push(null)

  const todayStr = today.toISOString().slice(0, 10)

  function getLoad (date: string): DayLoad | null {
    return loads[date] ?? null
  }
  function getEmpLoad (date: string): DayLoad | null {
    if (!fabricadorId) return null
    return empLoad[date] ?? null
  }

  return (
    <div style={{
      border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)',
      background: 'var(--bg-card)', overflow: 'hidden',
    }}>
      {/* Header del calendario */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 16px', borderBottom: '1px solid var(--border)', background: 'var(--bg-page)',
      }}>
        <button type='button' onClick={prevMonth} className='btn-icon' style={{ width: 30, height: 30 }}>
          <ChevronLeft size={16} />
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--gray-900)' }}>
            {MONTHS[viewMonth]} {viewYear}
          </span>
          <button type='button' onClick={goToday} className='btn btn-secondary btn-sm' style={{ height: 26, padding: '0 10px', fontSize: 11 }}>
            Hoy
          </button>
        </div>
        <button type='button' onClick={nextMonth} className='btn-icon' style={{ width: 30, height: 30 }}>
          <ChevronRight size={16} />
        </button>
      </div>

      {/* Weekday headers */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: '1px solid var(--border-subtle)' }}>
        {WEEKDAYS.map(d => (
          <div key={d} style={{
            padding: '8px 4px', textAlign: 'center', fontSize: 10.5, fontWeight: 700,
            color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: '0.06em',
          }}>{d}</div>
        ))}
      </div>

      {/* Grid de días */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 1, background: 'var(--border-subtle)' }}>
        {cells.map((date, i) => {
          if (!date) return <div key={i} style={{ background: 'var(--bg-card)', minHeight: 78 }} />
          const load = getLoad(date)
          const empL = getEmpLoad(date)
          const isToday = date === todayStr
          const isSelected = date === selectedDate
          const isPast = date < todayStr

          const occ = load ? occupancyLevel(load.count, load.capacity) : null
          const empOcc = empL ? occupancyLevel(empL.count, empL.capacity) : null
          const toneColor = occ ? (occ.tone === 'green' ? 'var(--green)' : occ.tone === 'amber' ? 'var(--amber)' : 'var(--red)') : 'var(--gray-300)'
          const toneBg = occ ? (occ.tone === 'green' ? 'var(--green-bg)' : occ.tone === 'amber' ? 'var(--amber-bg)' : 'var(--red-50)') : 'transparent'

          return (
            <button
              key={i}
              type='button'
              onClick={() => onSelect(date)}
              style={{
                background: isSelected ? 'var(--red-50)' : toneBg,
                border: isSelected ? '2px solid var(--red)' : '1px solid transparent',
                borderRadius: 4,
                padding: '6px 4px',
                cursor: 'pointer',
                minHeight: 78,
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                transition: 'all var(--t-fast)',
                opacity: isPast && !isSelected ? 0.55 : 1,
              }}
              onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'var(--bg-card-hover)' }}
              onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = toneBg }}
            >
              <span style={{
                fontSize: 12, fontWeight: 700,
                color: isSelected ? 'var(--red)' : isToday ? 'var(--red)' : 'var(--gray-700)',
                fontFeatureSettings: '"tnum" 1',
              }}>
                {Number(date.slice(-2))}
                {isToday && <span style={{ display: 'inline-block', width: 4, height: 4, borderRadius: '50%', background: 'var(--red)', marginLeft: 3, verticalAlign: 'middle' }} />}
              </span>

              {/* Barra de ocupación */}
              {occ && (
                <div style={{
                  width: '100%', height: 4, borderRadius: 2,
                  background: 'var(--gray-100)', overflow: 'hidden', marginTop: 2,
                }}>
                  <div style={{
                    width: `${occ.pct}%`, height: '100%',
                    background: toneColor, transition: 'width 0.3s',
                  }} />
                </div>
              )}

              {/* Conteo */}
              {load && (
                <span style={{
                  fontSize: 10, fontWeight: 600,
                  color: isSelected ? 'var(--red)' : toneColor,
                  fontFeatureSettings: '"tnum" 1',
                }}>
                  {load.count}/{load.capacity}
                </span>
              )}

              {/* Carga del empleado */}
              {empOcc && empL && (
                <span style={{
                  fontSize: 9, color: empOcc.tone === 'red' ? 'var(--red)' : 'var(--gray-500)',
                  fontWeight: 600, marginTop: 2,
                }}>
                  👤 {empL.count}/{empL.capacity}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Leyenda */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14,
        padding: '10px 16px', borderTop: '1px solid var(--border-subtle)', fontSize: 11, color: 'var(--gray-500)',
      }}>
        <LegendItem color='var(--green)' label='0–50%' />
        <LegendItem color='var(--amber)' label='51–80%' />
        <LegendItem color='var(--red)' label='81–100%' />
        <span style={{ color: 'var(--gray-400)' }}>·</span>
        <span>{capacityLabel}</span>
      </div>

      {error && (
        <div style={{
          padding: '8px 16px', background: 'var(--red-50)', color: 'var(--red)',
          fontSize: 12, display: 'flex', alignItems: 'center', gap: 6,
        }}>
          <AlertCircle size={12} /> {error}
        </div>
      )}

      {loading && (
        <div style={{ position: 'absolute', pointerEvents: 'none', inset: 0 }} />
      )}
    </div>
  )
}

function LegendItem ({ color, label }: { color: string; label: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      <span style={{ width: 10, height: 10, borderRadius: 2, background: color }} />
      {label}
    </span>
  )
}
