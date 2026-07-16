import type { ReactNode } from 'react'

interface Props {
  title?: string
  description?: string
  children: ReactNode
  actions?: ReactNode
  padding?: 'sm' | 'md' | 'lg'
  style?: React.CSSProperties
}

export function SectionCard({ title, description, children, actions, padding = 'md', style }: Props) {
  const pad = padding === 'sm' ? 20 : padding === 'lg' ? 36 : 28
  return (
    <div className="card" style={style}>
      {(title || actions) && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
          padding: '20px 28px',
          borderBottom: '1px solid var(--border)',
        }}>
          <div style={{ minWidth: 0 }}>
            {title && (
              <h2 style={{
                fontSize: 12,
                fontWeight: 600,
                letterSpacing: '1.2px',
                textTransform: 'uppercase' as const,
                color: 'var(--gray-700)',
                margin: 0,
              }}>
                {title}
              </h2>
            )}
            {description && (
              <p style={{ fontSize: 13, color: 'var(--gray-500)', marginTop: 4 }}>
                {description}
              </p>
            )}
          </div>
          {actions}
        </div>
      )}
      <div style={{ padding: pad }}>
        {children}
      </div>
    </div>
  )
}
