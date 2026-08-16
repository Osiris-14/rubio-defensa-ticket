'use client'
import { useState, useTransition } from 'react'
import { X, Package, CheckCircle, AlertCircle } from 'lucide-react'
import { PIEZAS_TARIFARIO, type OrdenParaTicket } from '@/lib/production-v2'
import { abrirTicketsProduccion } from '@/app/actions/production'
import { friendlyError } from '@/lib/errorMessages'

interface Props {
  orden: OrdenParaTicket
  user: { id: string; name: string }
  onClose: () => void
  onSaved: () => void
}

export default function AbrirTicketModal ({ orden, user, onClose, onSaved }: Props) {
  const [responsables, setResponsables] = useState<Record<string, string>>({})
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  const nombres = orden.productos.map(p => p.nombre).filter(Boolean) as string[]
  const piezasSeleccionadas = Object.keys(responsables)

  function toggle (pieza: string) {
    setResponsables(s => {
      const next = { ...s }
      if (pieza in next) delete next[pieza]
      else next[pieza] = ''
      return next
    })
  }

  function setResponsable (pieza: string, nombre: string) {
    setResponsables(s => ({ ...s, [pieza]: nombre }))
  }

  function handleConfirmar () {
    if (piezasSeleccionadas.length === 0) { setError('Selecciona al menos una pieza'); return }
    const sinNombre = piezasSeleccionadas.find(p => !responsables[p].trim())
    if (sinNombre) { setError(`Falta el responsable de "${sinNombre}"`); return }

    setError('')
    startTransition(async () => {
      const res = await abrirTicketsProduccion({
        numero_orden: orden.talonario,
        factura: orden.factura,
        alegra_id: orden.alegra_id,
        piezas: piezasSeleccionadas.map(pieza => ({ pieza, responsable: responsables[pieza] })),
        user_id: user.id,
        user_name: user.name,
      })
      if (!res.ok) { setError(friendlyError(res.error)); return }
      setDone(true)
      setTimeout(onSaved, 900)
    })
  }

  return (
    <div className='modal-overlay' onClick={() => !pending && !done && onClose()}>
      <div onClick={e => e.stopPropagation()} className='modal-card' style={{
        padding: 0, maxWidth: 640, width: '100%', maxHeight: '92vh', display: 'flex', flexDirection: 'column',
      }}>
        {/* Header */}
        <div style={{
          padding: '20px 24px 16px', borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16,
        }}>
          <div style={{ minWidth: 0 }}>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--gray-900)', letterSpacing: '-0.02em', margin: 0 }}>
              Abrir ticket
            </h2>
            <p style={{ fontSize: 13, color: 'var(--gray-500)', marginTop: 4 }}>
              Orden #{orden.talonario || '—'} · Factura {orden.factura} · {orden.cliente ?? 'Cliente —'}
            </p>
          </div>
          <button
            onClick={() => !pending && !done && onClose()}
            aria-label='Cerrar'
            style={{ background: 'transparent', border: 'none', color: 'var(--gray-500)', cursor: 'pointer', padding: 4, flexShrink: 0 }}
          >
            <X size={20} />
          </button>
        </div>

        {done ? (
          <div style={{ padding: '56px 28px', textAlign: 'center' }}>
            <div style={{
              width: 64, height: 64, borderRadius: '50%', background: 'var(--green-bg)', color: 'var(--green)',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16,
            }}>
              <CheckCircle size={32} />
            </div>
            <h3 style={{ fontSize: 20, fontWeight: 700, color: 'var(--gray-900)', margin: 0 }}>¡Ticket abierto!</h3>
            <p style={{ fontSize: 14, color: 'var(--gray-500)', marginTop: 8 }}>
              Las piezas ya están en <strong>Tickets Pendientes</strong>.
            </p>
          </div>
        ) : (
          <>
            <div style={{ padding: '18px 24px', flex: 1, overflowY: 'auto' }}>
              {/* ── Sección A: productos de la orden (solo lectura) ── */}
              <div style={{ marginBottom: 22 }}>
                <div className='eyebrow' style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Package size={13} /> Productos de la orden (Alegra)
                </div>
                {nombres.length === 0 ? (
                  <div style={{ fontSize: 13, color: 'var(--gray-500)' }}>Sin productos en la factura.</div>
                ) : (
                  <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 6 }}>
                    {nombres.map((n, i) => (
                      <span key={i} style={{
                        fontSize: 12, fontWeight: 500, color: 'var(--gray-700)',
                        background: 'var(--gray-100)', padding: '4px 10px', borderRadius: 9999,
                      }}>
                        {n}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* ── Sección B: piezas a producir ── */}
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--gray-900)', margin: '0 0 4px' }}>
                  Piezas a producir
                </h3>
                <p style={{ fontSize: 13, color: 'var(--gray-500)', margin: '0 0 14px' }}>
                  Selecciona cada pieza que se va a fabricar y quién la produce.
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {PIEZAS_TARIFARIO.map(pieza => {
                    const sel = pieza in responsables
                    return (
                      <div key={pieza} style={{
                        border: `2px solid ${sel ? 'var(--red)' : 'var(--border)'}`,
                        background: sel ? 'var(--red-50)' : 'var(--bg-card)',
                        borderRadius: 'var(--radius-lg)', padding: '12px 14px',
                        transition: 'all var(--t-fast)',
                      }}>
                        <div
                          onClick={() => toggle(pieza)}
                          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, cursor: 'pointer' }}
                        >
                          <span style={{ fontSize: 14.5, fontWeight: sel ? 700 : 500, color: sel ? 'var(--red)' : 'var(--gray-800)' }}>
                            {pieza}
                          </span>
                          {sel && <CheckCircle size={18} style={{ color: 'var(--red)', flexShrink: 0 }} />}
                        </div>
                        {sel && (
                          <div style={{ marginTop: 10 }}>
                            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--gray-700)', display: 'block', marginBottom: 4 }}>
                              ¿Quién lo produce?
                            </label>
                            <input
                              type='text'
                              className='input-base'
                              autoFocus
                              value={responsables[pieza]}
                              onChange={e => setResponsable(pieza, e.target.value)}
                              placeholder='Nombre de la persona asignada'
                              style={{ width: '100%', height: 40 }}
                            />
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>

            {/* ── Footer ── */}
            <div style={{ padding: '14px 24px 18px', borderTop: '1px solid var(--border)' }}>
              {error && (
                <div style={{
                  marginBottom: 12, background: 'var(--red-50)', border: '1px solid var(--red-ring)',
                  borderRadius: 'var(--radius)', padding: '10px 14px', fontSize: 13.5, color: 'var(--red)', fontWeight: 600,
                  display: 'flex', alignItems: 'center', gap: 8,
                }}>
                  <AlertCircle size={16} style={{ flexShrink: 0 }} /> {error}
                </div>
              )}
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  className='btn btn-secondary'
                  onClick={() => !pending && onClose()}
                  disabled={pending}
                  style={{ height: 50, padding: '0 20px', fontSize: 14.5 }}
                >
                  Cancelar
                </button>
                <button
                  className='btn btn-primary'
                  onClick={handleConfirmar}
                  disabled={pending}
                  style={{ flex: 1, height: 50, fontSize: 15, fontWeight: 700 }}
                >
                  {pending ? 'Guardando…' : 'Confirmar y abrir ticket'}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
