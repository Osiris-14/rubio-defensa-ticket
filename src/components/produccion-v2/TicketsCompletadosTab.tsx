'use client'
import { useState, useEffect } from 'react'
import { CheckCircle, AlertCircle, Lock, X, ChevronRight } from 'lucide-react'
import {
  fetchProductionTickets,
  fetchProductionTicketFull,
  STEP_LABELS,
  PRODUCTION_STEPS,
  type ProductionTicket,
  type ProductionTicketFull,
  type ProductionStep,
} from '@/lib/production-v2'

export default function TicketsCompletadosTab () {
  const [tickets, setTickets] = useState<ProductionTicket[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState<ProductionTicketFull | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)

  useEffect(() => {
    let active = true
    async function load () {
      try {
        const t = await fetchProductionTickets('completado')
        if (!active) return
        setTickets(t)
        setError('')
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : String(e))
      } finally {
        if (active) setLoading(false)
      }
    }
    load()
    return () => { active = false }
  }, [])

  async function openDetail (id: string) {
    setLoadingDetail(true)
    try {
      const t = await fetchProductionTicketFull(id)
      if (t) setSelected(t)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoadingDetail(false)
    }
  }

  if (loading) return <div style={{ padding: '80px 24px', textAlign: 'center', color: 'var(--gray-500)', fontSize: 13.5 }}>Cargando tickets completados…</div>

  if (error) {
    return (
      <div style={{
        background: 'var(--red-50)', border: '1px solid var(--red-ring)',
        borderRadius: 'var(--radius-lg)', padding: '14px 16px', fontSize: 13.5, color: 'var(--red)',
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <AlertCircle size={16} /> {error}
      </div>
    )
  }

  if (tickets.length === 0) {
    return (
      <div style={{ padding: '80px 24px', textAlign: 'center', maxWidth: 420, margin: '0 auto' }}>
        <div style={{
          width: 56, height: 56, borderRadius: 'var(--radius-lg)',
          background: 'var(--green-bg)', color: 'var(--green)',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 18,
        }}>
          <CheckCircle size={22} strokeWidth={1.6} />
        </div>
        <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--gray-900)', margin: 0 }}>No hay tickets completados</h3>
        <p style={{ fontSize: 13.5, color: 'var(--gray-500)', marginTop: 8, lineHeight: 1.5 }}>
          Los tickets que cierres desde la pasarela quedarán congelados aquí.
        </p>
      </div>
    )
  }

  return (
    <>
      <div className='card' style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table className='table-dark'>
            <thead>
              <tr>
                <th>Orden</th><th>Factura</th><th>Cliente</th><th>Vehículo</th>
                <th>Costo total</th><th>Completado</th><th></th>
              </tr>
            </thead>
            <tbody>
              {tickets.map(t => (
                <tr key={t.id} onClick={() => openDetail(t.id)} style={{ cursor: 'pointer' }}>
                  <td style={{ color: 'var(--gray-900)', fontWeight: 600 }}>{t.orden ?? '—'}</td>
                  <td>{t.factura ?? '—'}</td>
                  <td>{t.cliente ?? '—'}</td>
                  <td>{t.vehiculo ?? '—'}</td>
                  <td style={{ fontWeight: 700, color: 'var(--gray-900)' }}>{formatMoney(Number(t.total_cost))}</td>
                  <td style={{ fontSize: 12, color: 'var(--gray-500)', whiteSpace: 'nowrap' }}>
                    {t.completed_at ? formatTime(t.completed_at) : '—'}
                  </td>
                  <td><ChevronRight size={14} style={{ color: 'var(--gray-400)' }} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {loadingDetail && (
        <div style={{ padding: '20px', textAlign: 'center', color: 'var(--gray-500)', fontSize: 13 }}>Cargando detalle…</div>
      )}

      {selected && (
        <CompletedDetailModal ticket={selected} onClose={() => setSelected(null)} />
      )}
    </>
  )
}

// ─────────────────────────────────────────────────────────
function CompletedDetailModal ({ ticket, onClose }: { ticket: ProductionTicketFull; onClose: () => void }) {
  const stepsByStage = new Map<ProductionStep, ProductionTicketFull['steps']>()
  for (const st of PRODUCTION_STEPS) {
    stepsByStage.set(st, ticket.steps.filter(s => s.step === st))
  }
  const total = ticket.steps.reduce((s, st) => s + Number(st.price), 0)

  return (
    <div className='modal-overlay' onClick={onClose}>
      <div onClick={e => e.stopPropagation()} className='modal-card' style={{
        padding: 0, maxWidth: 620, width: '100%', maxHeight: '90vh', display: 'flex', flexDirection: 'column',
      }}>
        {/* Header */}
        <div style={{
          padding: '22px 28px 18px', borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16,
        }}>
          <div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 12px',
                background: 'var(--green-bg)', color: 'var(--green)', borderRadius: 9999,
                fontSize: 11, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase' as const,
              }}>
                <Lock size={11} /> Congelado
              </span>
            </div>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--gray-900)', letterSpacing: '-0.02em', margin: 0 }}>
              {ticket.vehiculo ?? 'Ticket'}
            </h2>
            <p style={{ fontSize: 13, color: 'var(--gray-500)', marginTop: 6 }}>
              {ticket.orden ? `Orden #${ticket.orden}` : 'Ticket'} · {ticket.cliente ?? 'Cliente —'}
            </p>
          </div>
          <button onClick={onClose} aria-label='Cerrar'
            style={{ background: 'transparent', border: 'none', color: 'var(--gray-500)', cursor: 'pointer', padding: 4, flexShrink: 0 }}>
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '22px 28px', flex: 1, overflowY: 'auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 24 }}>
            <DetailItem label='Factura' value={ticket.factura ?? '—'} />
            <DetailItem label='Cliente' value={ticket.cliente ?? '—'} />
            <DetailItem label='Vehículo' value={ticket.vehiculo ?? '—'} />
            <DetailItem label='Tipo de trabajo' value={ticket.tipo_trabajo ?? '—'} />
            {ticket.grado_reparacion && (
              <DetailItem label='Grado de reparación' value={ticket.grado_reparacion} />
            )}
            <DetailItem label='Inicio programado' value={ticket.fecha_programada ? formatDateLong(ticket.fecha_programada) : '—'} />
            {ticket.fabricador_name && (
              <DetailItem label='Fabricador' value={ticket.fabricador_name} />
            )}
            <DetailItem label='Completado' value={ticket.completed_at ? formatTime(ticket.completed_at) : '—'} />
          </div>

          <div className='eyebrow' style={{ marginBottom: 12 }}>Detalle de costos</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {PRODUCTION_STEPS.map(step => {
              const rows = stepsByStage.get(step) ?? []
              const stageTotal = rows.reduce((s, r) => s + Number(r.price), 0)
              const employees = dedupeEmployees(rows.map(r => r.employee_name))
              return (
                <div key={step} style={{
                  border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '14px 16px',
                  background: 'var(--bg-card)',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--gray-900)' }}>{STEP_LABELS[step]}</span>
                    <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--green)' }}>{formatMoney(stageTotal)}</span>
                  </div>
                  {rows.length === 0 ? (
                    <span style={{ fontSize: 12.5, color: 'var(--gray-400)' }}>Sin movimientos</span>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {rows.map(r => (
                        <div key={r.id} style={{
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12,
                          fontSize: 12.5, color: 'var(--gray-700)',
                        }}>
                          <span>
                            <span style={{ fontWeight: 500 }}>{r.piece_name}</span>
                            {step === 'fabricacion' && r.doblador_name && (
                              <span style={{ color: 'var(--gray-400)' }}> · dobló: {r.doblador_name}</span>
                            )}
                            <span style={{ color: 'var(--gray-400)' }}> · {r.employee_name ?? '—'}</span>
                            {r.completed_at && (
                              <span style={{ color: 'var(--gray-400)', fontSize: 11 }}> · {formatTime(r.completed_at)}</span>
                            )}
                          </span>
                          <span style={{ fontWeight: 500 }}>{formatMoney(Number(r.price))}</span>
                        </div>
                      ))}
                      {employees.length > 0 && (
                        <div style={{ fontSize: 11, color: 'var(--gray-400)', marginTop: 4 }}>
                          Empleado(s): {employees.join(', ')}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Total */}
          <div style={{
            marginTop: 20, padding: '18px 20px', background: 'var(--gray-50)',
            borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--gray-700)', textTransform: 'uppercase' as const, letterSpacing: '0.04em' }}>
              Costo total
            </span>
            <span style={{ fontSize: 22, fontWeight: 700, color: 'var(--gray-900)', letterSpacing: '-0.02em' }}>
              {formatMoney(total)}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

function DetailItem ({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className='eyebrow' style={{ marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 14, color: 'var(--gray-900)', fontWeight: 500, wordBreak: 'break-word' as const }}>{value}</div>
    </div>
  )
}

function dedupeEmployees (names: (string | null)[]): string[] {
  const set = new Set<string>()
  for (const n of names) if (n && n.trim()) set.add(n.trim())
  return [...set]
}

function formatMoney (n: number): string {
  return 'RD$ ' + n.toLocaleString('es-DO', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
}

function formatTime (iso: string): string {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleString('es-DO', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

function formatDateLong (iso: string): string {
  const d = new Date(iso + 'T00:00:00')
  if (isNaN(d.getTime())) return iso
  return d.toLocaleDateString('es-DO', { day: 'numeric', month: 'short', year: 'numeric' })
}
