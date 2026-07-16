interface Props {
  message?: string
}

export function LoadingState({ message = 'Cargando…' }: Props) {
  return (
    <div style={{
      padding: '64px 24px',
      textAlign: 'center',
      color: 'var(--gray-500)',
      fontSize: 14,
      fontWeight: 500,
    }}>
      <div style={{
        display: 'inline-block',
        width: 28,
        height: 28,
        border: '2.5px solid var(--gray-200)',
        borderTopColor: 'var(--red)',
        borderRadius: '50%',
        animation: 'spin 0.7s linear infinite',
        marginBottom: 12,
      }} />
      <div>{message}</div>
    </div>
  )
}
