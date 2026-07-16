import type { ReactNode } from 'react'

export type StatusTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'brand' | 'purple' | 'orange'

const TONE_BG: Record<StatusTone, string> = {
  neutral: 'var(--gray-100)',
  success: 'var(--green-bg)',
  warning: 'var(--amber-bg)',
  danger:  'var(--danger-bg)',
  info:    'var(--blue-bg)',
  brand:   'var(--red-50)',
  purple:  'var(--purple-bg)',
  orange:  'var(--orange-bg)',
}
const TONE_FG: Record<StatusTone, string> = {
  neutral: 'var(--gray-700)',
  success: 'var(--green)',
  warning: 'var(--amber)',
  danger:  'var(--danger)',
  info:    'var(--blue)',
  brand:   'var(--red)',
  purple:  'var(--purple)',
  orange:  'var(--orange)',
}

interface Props {
  tone?: StatusTone
  /** Mostrar dot de color a la izquierda. */
  dot?: boolean
  children: ReactNode
  size?: 'sm' | 'md'
}

export function StatusBadge({ tone = 'neutral', dot = true, children, size = 'sm' }: Props) {
  const bg = TONE_BG[tone]
  const fg = TONE_FG[tone]
  const fontSize = size === 'md' ? 12 : 11
  const py = size === 'md' ? 5 : 3
  const px = size === 'md' ? 12 : 10
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      padding: `${py}px ${px}px`,
      borderRadius: 9999,
      background: bg,
      color: fg,
      fontSize,
      fontWeight: 600,
      letterSpacing: '0.3px',
      whiteSpace: 'nowrap' as const,
      lineHeight: 1.2,
    }}>
      {dot && <span style={{ width: 6, height: 6, borderRadius: '50%', background: fg, flexShrink: 0 }} />}
      {children}
    </span>
  )
}
