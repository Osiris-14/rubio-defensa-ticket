import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'

interface Props {
  icon: LucideIcon
  title: string
  description?: string
  action?: ReactNode
}

export function EmptyState({ icon: Icon, title, description, action }: Props) {
  return (
    <div style={{
      padding: '72px 24px',
      textAlign: 'center',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 16,
    }}>
      <div style={{
        width: 56,
        height: 56,
        borderRadius: 16,
        background: 'var(--red-50)',
        color: 'var(--red)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <Icon size={24} strokeWidth={1.6} />
      </div>
      <div>
        <h3 style={{
          fontSize: 16,
          fontWeight: 600,
          color: 'var(--gray-900)',
          margin: 0,
          letterSpacing: '-0.01em',
        }}>
          {title}
        </h3>
        {description && (
          <p style={{
            fontSize: 14,
            color: 'var(--gray-500)',
            marginTop: 6,
            maxWidth: 380,
            margin: '6px auto 0',
            lineHeight: 1.5,
          }}>
            {description}
          </p>
        )}
      </div>
      {action}
    </div>
  )
}
