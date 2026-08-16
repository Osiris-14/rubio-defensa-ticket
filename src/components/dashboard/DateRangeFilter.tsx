'use client'

export type PeriodoFiltro = 'semana' | 'mes' | 'rango'

interface Props {
  periodo: PeriodoFiltro
  onPeriodo: (p: PeriodoFiltro) => void
  desde: string
  hasta: string
  onDesde: (v: string) => void
  onHasta: (v: string) => void
}

const OPCIONES: { id: PeriodoFiltro; label: string }[] = [
  { id: 'semana', label: 'Esta semana' },
  { id: 'mes', label: 'Este mes' },
  { id: 'rango', label: 'Rango' },
]

export default function DateRangeFilter ({ periodo, onPeriodo, desde, hasta, onDesde, onHasta }: Props) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' as const }}>
      <div style={{
        padding: '4px 5px', display: 'flex', gap: 2,
        background: '#fff', border: '0.5px solid #ECECEC', borderRadius: 8,
      }}>
        {OPCIONES.map(o => (
          <button
            key={o.id}
            onClick={() => onPeriodo(o.id)}
            style={{
              padding: '5px 12px', borderRadius: 6, border: 'none',
              background: periodo === o.id ? 'var(--red)' : 'transparent',
              color: periodo === o.id ? '#fff' : '#666',
              fontSize: 12.5, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s',
              whiteSpace: 'nowrap' as const,
            }}
          >
            {o.label}
          </button>
        ))}
      </div>

      {periodo === 'rango' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <input
            type='date'
            value={desde}
            onChange={e => onDesde(e.target.value)}
            className='input-base'
            style={{ height: 32, fontSize: 12.5, padding: '0 8px' }}
          />
          <span style={{ fontSize: 12, color: '#999' }}>→</span>
          <input
            type='date'
            value={hasta}
            onChange={e => onHasta(e.target.value)}
            min={desde}
            className='input-base'
            style={{ height: 32, fontSize: 12.5, padding: '0 8px' }}
          />
        </div>
      )}
    </div>
  )
}
