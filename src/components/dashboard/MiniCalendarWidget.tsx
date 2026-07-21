'use client'
import { useEffect, useState, useMemo } from 'react'
import { CalendarDays, ArrowRight } from 'lucide-react'
import { fetchAreaDailyLoadInRange, occupancyLevel, type AreaDailyLoad } from '@/lib/production-v2'

interface Props {
  onOpenCalendar: () => void
}

const WEEKDAYS_SHORT = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

export default function MiniCalendarWidget ({ onOpenCalendar }: Props) {
  const [loads, setLoads] = useState<AreaDailyLoad[]>([])
  const [loading, setLoading] = useState(true)

  const range = useMemo(() => {
    const today = new Date()
    const end = new Date(); end.setDate(today.getDate() + 6)
    return {
      from: today.toISOString().slice(0, 10),
      to: end.toISOString().slice(0, 10),
    }
  }, [])

  useEffect(() => {
    let active = true
    fetchAreaDailyLoadInRange(range.from, range.to)
      .then(data => { if (active) { setLoads(data); setLoading(false) } })
      .catch(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [range.from, range.to])

  const days = useMemo(() => {
    const result: { key: string; day: number; weekday: string; count: number; cap: number; pct: number; tone: 'green' | 'amber' | 'red' }[] = []
    for (let i = 0; i < 7; i++) {
      const d = new Date(); d.setDate(d.getDate() + i)
      const key = d.toISOString().slice(0, 10)
      const fab = loads.find(l => l.fecha === key && l.step === 'fabricacion')
      const count = fab?.tickets_count ?? 0
      const cap = fab?.daily_capacity ?? 10
      const occ = occupancyLevel(count, cap)
      result.push({
        key,
        day: d.getDate(),
        weekday: WEEKDAYS_SHORT[(d.getDay() + 6) % 7],
        count,
        cap,
        pct: occ.pct,
        tone: occ.tone,
      })
    }
    return result
  }, [loads])

  const isToday = (d: { key: string }) => d.key === new Date().toISOString().slice(0, 10)

  return (
    <div className='card' style={{ padding: 20, display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 28, height: 28, borderRadius: 'var(--radius)',
            background: 'var(--red-50)', color: 'var(--red)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <CalendarDays size={14} />
          </div>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--gray-900)', margin: 0 }}>Próximos 7 días</h3>
        </div>
        <button onClick={onOpenCalendar} className='btn btn-ghost btn-sm' style={{ fontSize: 11.5 }}>
          Calendario <ArrowRight size={11} />
        </button>
      </div>

      {loading ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--gray-400)', fontSize: 12 }}>Cargando…</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6, flex: 1 }}>
          {days.map(d => {
            const toneColor = d.tone === 'red' ? 'var(--red)' : d.tone === 'amber' ? 'var(--amber)' : 'var(--green)'
            const today = isToday(d)
            return (
              <div key={d.key} style={{
                textAlign: 'center', padding: '8px 4px',
                background: today ? 'var(--blue-bg)' : 'var(--gray-50)',
                borderRadius: 'var(--radius)',
                border: today ? '1px solid var(--blue-ring)' : '1px solid transparent',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
              }}>
                <div style={{ fontSize: 9, color: 'var(--gray-500)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  {d.weekday}
                </div>
                <div style={{ fontSize: 18, fontWeight: 700, color: today ? 'var(--blue)' : 'var(--gray-900)', lineHeight: 1 }}>
                  {d.day}
                </div>
                <div style={{ width: '100%', height: 3, background: 'var(--gray-100)', borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{ width: `${d.pct}%`, height: '100%', background: toneColor, transition: 'width 0.3s' }} />
                </div>
                <div style={{ fontSize: 9, color: d.count > 0 ? 'var(--gray-700)' : 'var(--gray-400)', fontWeight: 600, lineHeight: 1 }}>
                  {d.count > 0 ? `${d.count}/${d.cap}` : '—'}
                </div>
              </div>
            )
          })}
        </div>
      )}

      <div style={{ marginTop: 14, fontSize: 11, color: 'var(--gray-500)', lineHeight: 1.5, paddingTop: 12, borderTop: '1px solid var(--border-subtle)' }}>
        Barras por día según ocupación de fabricación. Click para ver el calendario completo.
      </div>
    </div>
  )
}
