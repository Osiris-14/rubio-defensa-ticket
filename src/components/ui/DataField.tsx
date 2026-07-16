import type { ReactNode } from 'react'

interface Props {
  label: string
  value: ReactNode
  /** Acento de color sobre el valor. */
  tone?: 'default' | 'danger' | 'success' | 'warning' | 'info'
  bold?: boolean
  /** Texto auxiliar debajo del valor. */
  hint?: ReactNode
}

export function DataField({ label, value, tone = 'default', bold, hint }: Props) {
  const valueColor =
    tone === 'danger'  ? 'var(--red)'   :
    tone === 'success' ? 'var(--green)' :
    tone === 'warning' ? 'var(--amber)' :
    tone === 'info'    ? 'var(--blue)'  :
                          'var(--gray-900)'
  return (
    <div style={{ minWidth: 0 }}>
      <div className="eyebrow" style={{ marginBottom: 6 }}>{label}</div>
      <div style={{
        fontSize: bold ? 15 : 14,
        fontWeight: bold ? 600 : 500,
        color: valueColor,
        lineHeight: 1.4,
        wordBreak: 'break-word' as const,
      }}>
        {value}
      </div>
      {hint && (
        <div style={{ fontSize: 12, color: 'var(--gray-400)', marginTop: 4, lineHeight: 1.4 }}>
          {hint}
        </div>
      )}
    </div>
  )
}
