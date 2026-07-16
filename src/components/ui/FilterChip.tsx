import type { ReactNode } from 'react'

interface Props {
  active: boolean
  onClick: () => void
  children: ReactNode
  count?: ReactNode
}

export function FilterChip({ active, onClick, children, count }: Props) {
  return (
    <button type="button" onClick={onClick} className={`pill ${active ? 'active' : ''}`}>
      {children}
      {count !== undefined && (
        <span style={{ opacity: active ? 1 : 0.65, fontSize: 12 }}>{count}</span>
      )}
    </button>
  )
}
