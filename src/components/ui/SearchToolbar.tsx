import type { ReactNode } from 'react'
import { Search } from 'lucide-react'

interface Props {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  children?: ReactNode // FilterChips, etc. alineados a la derecha
}

export function SearchToolbar({ value, onChange, placeholder = 'Buscar…', children }: Props) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      marginBottom: 24,
      flexWrap: 'wrap' as const,
    }}>
      <div style={{ position: 'relative', flex: '1 1 280px', minWidth: 240, maxWidth: 420 }}>
        <Search
          size={16}
          style={{
            position: 'absolute',
            left: 14,
            top: '50%',
            transform: 'translateY(-50%)',
            color: 'var(--gray-400)',
            pointerEvents: 'none',
          }}
        />
        <input
          type="text"
          className="input-base"
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          style={{ paddingLeft: 40, height: 42 }}
        />
      </div>
      {children && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' as const }}>
          {children}
        </div>
      )}
    </div>
  )
}
