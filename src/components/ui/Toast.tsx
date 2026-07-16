import { useEffect } from 'react'
import { CheckCircle, AlertTriangle, X } from 'lucide-react'

export type ToastTone = 'success' | 'error' | 'info'

interface Props {
  open: boolean
  message: string
  tone?: ToastTone
  onClose: () => void
  durationMs?: number
}

export function Toast({ open, message, tone = 'success', onClose, durationMs = 3000 }: Props) {
  useEffect(() => {
    if (!open) return
    const t = setTimeout(onClose, durationMs)
    return () => clearTimeout(t)
  }, [open, durationMs, onClose])

  if (!open) return null

  const bg = tone === 'success' ? 'var(--green)' : tone === 'error' ? 'var(--red)' : 'var(--gray-900)'
  const Icon = tone === 'success' ? CheckCircle : AlertTriangle

  return (
    <div
      role="status"
      style={{
        position: 'fixed',
        bottom: 24,
        right: 24,
        zIndex: 200,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        background: bg,
        color: '#fff',
        padding: '12px 16px',
        borderRadius: 'var(--radius-lg)',
        boxShadow: 'var(--shadow-lg)',
        fontSize: 14,
        fontWeight: 500,
        animation: 'fadeInUp 0.25s ease',
        maxWidth: 420,
      }}
    >
      <Icon size={18} />
      <span style={{ flex: 1 }}>{message}</span>
      <button
        onClick={onClose}
        aria-label="Cerrar"
        style={{
          background: 'transparent',
          border: 'none',
          color: 'rgba(255,255,255,0.85)',
          cursor: 'pointer',
          padding: 2,
          display: 'flex',
        }}
      >
        <X size={16} />
      </button>
    </div>
  )
}
