import type { ReactNode } from 'react'

interface Props {
  eyebrow?: string
  title: ReactNode
  subtitle?: ReactNode
  actions?: ReactNode
}

export function PageHeader({ eyebrow, title, subtitle, actions }: Props) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: 24,
      marginBottom: 32,
      flexWrap: 'wrap' as const,
    }}>
      <div style={{ minWidth: 0 }}>
        {eyebrow && (
          <div className="eyebrow" style={{ marginBottom: 8, color: 'var(--red)' }}>
            {eyebrow}
          </div>
        )}
        <h1 style={{
          fontSize: 28,
          fontWeight: 700,
          color: 'var(--gray-900)',
          letterSpacing: '-0.02em',
          lineHeight: 1.2,
          margin: 0,
        }}>
          {title}
        </h1>
        {subtitle && (
          <p style={{
            fontSize: 14.5,
            color: 'var(--gray-500)',
            fontWeight: 400,
            marginTop: 6,
            lineHeight: 1.5,
          }}>
            {subtitle}
          </p>
        )}
      </div>
      {actions && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          {actions}
        </div>
      )}
    </div>
  )
}
