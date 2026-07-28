'use client'
import { useState, useEffect } from 'react'
import { CheckCircle, AlertCircle, Lock, X, ChevronRight, Clock, User, Scissors, CornerUpRight, Wrench, Flame } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import {
  fetchProductionTickets,
  fetchProductionTicketFull,
  fetchPasarelaPiezas,
  piezaPersona,
  piezaFecha,
  PASARELA_STAGES,
  ETAPA_LABELS,
  STEP_LABELS,
  PRODUCTION_STEPS,
  type ProductionTicket,
  type ProductionTicketFull,
  type TicketPasarelaPieza,
  type EtapaPasarela,
} from '@/lib/production-v2'
import { friendlyError } from '@/lib/errorMessages'

const ETAPA_ICONS: Record<EtapaPasarela, typeof Scissors> = {
  corte: Scissors,
  doblado: CornerUpRight,
  armado: Wrench,
  soldadura: Flame,
}

interface Detalle {
  ticket: ProductionTicketFull
  piezas: TicketPasarelaPieza[]
}

export default function TicketsCompletadosTab () {
  const [tickets, setTickets] = useState<ProductionTicket[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState<Detalle | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let active = true
    async function load () {
      try {
        const t = await fetchProductionTickets('completado')
        if (!active) return
        setTickets(t)
        setError('')
      } catch (e) {
        if (active) setError(friendlyError(e))
      } finally {
        if (active) setLoading(false)
      }
    }
    load()
    return () => { active = false }
  }, [reloadKey])

  // Realtime: cuando un ticket se completa en la pasarela, aparece aquí solo.
  useEffect(() => {
    const channel = supabase.channel(`completados-${Math.random().toString(36).slice(2)}`)
    channel.on('postgres_changes',
      { event: '*', schema: 'public', table: 'production_tickets' },
      () => setReloadKey(k => k + 1))
    channel.subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])

  async function openDetail (id: string) {
    setLoadingDetail(true)
    try {
      const [t, piezas] = await Promise.all([
        fetchProductionTicketFull(id),
        fetchPasarelaPiezas(id),
      ])
      if (t) setSelected({ ticket: t, piezas })
    } catch (e) {
      setError(friendlyError(e))
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
          Los tickets que terminen la etapa de Soldadura quedarán congelados aquí.
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
                <th>Completado</th><th></th>
              </tr>
            </thead>
            <tbody>
              {tickets.map(t => (
                <tr key={t.id} onClick={() => openDetail(t.id)} style={{ cursor: 'pointer' }}>
                  <td style={{ color: 'var(--gray-900)', fontWeight: 600 }}>{t.orden ?? '—'}</td>
                  <td>{t.factura ?? '—'}</td>
                  <td>{t.cliente ?? '—'}</td>
                  <td>{t.vehiculo ?? '—'}</td>
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
        <CompletedDetailModal detalle={selected} onClose={() => setSelected(null)} />
      )}
    </>
  )
}

// ─────────────────────────────────────────────────────────
// Detalle congelado: quién cortó, quién dobló y, por pieza,
// quién armó y quién soldó — con sus fechas.
// ─────────────────────────────────────────────────────────
function CompletedDetailModal ({ detalle, onClose }: { detalle: Detalle; onClose: () => void }) {
  const { ticket, piezas } = detalle
  const legacySteps = ticket.steps.length > 0
  const totalLegacy = ticket.steps.reduce((s, st) => s + Number(st.price), 0)

  return (
    <div className='modal-overlay' onClick={onClose}>
      <div onClick={e => e.stopPropagation()} className='modal-card' style={{
        padding: 0, maxWidth: 640, width: '100%', maxHeight: '90vh', display: 'flex', flexDirection: 'column',
      }}>
        {/* Header */}
        <div style={{
          padding: '22px 28px 18px', borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16,
        }}>
          <div>
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 12px',
              background: 'var(--green-bg)', color: 'var(--green)', borderRadius: 9999,
              fontSize: 11, fontWeight: 700, letterSpacing: '0.04em',
              textTransform: 'uppercase' as const, marginBottom: 8,
            }}>
              <Lock size={11} /> Congelado
            </span>
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
            <DetailItem label='Completado' value={ticket.completed_at ? formatTime(ticket.completed_at) : '—'} />
          </div>

          <div className='eyebrow' style={{ marginBottom: 12 }}>Historial de la pasarela</div>

          {piezas.length === 0 && !ticket.corte_persona && !ticket.doblado_persona ? (
            <div style={{
              background: 'var(--gray-50)', border: '1px solid var(--border)',
              borderRadius: 'var(--radius)', padding: '14px 16px',
              fontSize: 13, color: 'var(--gray-500)', lineHeight: 1.5,
            }}>
              Este ticket se completó antes de la pasarela Corte → Doblado → Armado → Soldadura,
              por eso no tiene historial por etapa.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {PASARELA_STAGES.map(etapa => (
                <EtapaHistorial key={etapa} etapa={etapa} ticket={ticket} piezas={piezas} />
              ))}
            </div>
          )}

          {/* Costos de la pasarela anterior — solo si el ticket los tiene. */}
          {legacySteps && (
            <>
              <div className='eyebrow' style={{ margin: '24px 0 12px' }}>
                Costos registrados (pasarela anterior)
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {PRODUCTION_STEPS.map(step => {
                  const rows = ticket.steps.filter(s => s.step === step)
                  if (rows.length === 0) return null
                  const stageTotal = rows.reduce((s, r) => s + Number(r.price), 0)
                  return (
                    <div key={step} style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12,
                      border: '1px solid var(--border)', borderRadius: 'var(--radius)',
                      padding: '10px 14px', background: 'var(--bg-card)', fontSize: 13,
                    }}>
                      <span style={{ color: 'var(--gray-700)', fontWeight: 600 }}>{STEP_LABELS[step]}</span>
                      <span style={{ color: 'var(--gray-900)', fontWeight: 700 }}>{formatMoney(stageTotal)}</span>
                    </div>
                  )
                })}
              </div>
              <div style={{
                marginTop: 14, padding: '16px 18px', background: 'var(--gray-50)',
                borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}>
                <span style={{
                  fontSize: 12.5, fontWeight: 700, color: 'var(--gray-700)',
                  textTransform: 'uppercase' as const, letterSpacing: '0.04em',
                }}>
                  Costo total
                </span>
                <span style={{ fontSize: 20, fontWeight: 700, color: 'var(--gray-900)', letterSpacing: '-0.02em' }}>
                  {formatMoney(totalLegacy)}
                </span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────
function EtapaHistorial ({ etapa, ticket, piezas }: {
  etapa: EtapaPasarela
  ticket: ProductionTicketFull
  piezas: TicketPasarelaPieza[]
}) {
  const Icon = ETAPA_ICONS[etapa]
  const esPieza = etapa === 'armado' || etapa === 'soldadura'

  return (
    <div style={{
      border: '1px solid var(--border)', borderRadius: 'var(--radius)',
      padding: '14px 16px', background: 'var(--bg-card)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <Icon size={15} style={{ color: 'var(--gray-500)', flexShrink: 0 }} />
        <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--gray-900)' }}>{ETAPA_LABELS[etapa]}</span>
      </div>

      {!esPieza ? (
        <PersonaLinea
          persona={etapa === 'corte' ? ticket.corte_persona : ticket.doblado_persona}
          fecha={etapa === 'corte' ? ticket.corte_fecha : ticket.doblado_fecha}
        />
      ) : piezas.length === 0 ? (
        <span style={{ fontSize: 12.5, color: 'var(--gray-400)' }}>Sin registro</span>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          {piezas.map(p => (
            <div key={p.id} style={{
              display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' as const,
              fontSize: 13, color: 'var(--gray-700)',
            }}>
              <span style={{ fontWeight: 700, color: 'var(--gray-900)', minWidth: 84 }}>{p.pieza}</span>
              <PersonaLinea persona={piezaPersona(p, etapa)} fecha={piezaFecha(p, etapa)} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function PersonaLinea ({ persona, fecha }: { persona: string | null; fecha: string | null }) {
  if (!persona) return <span style={{ fontSize: 12.5, color: 'var(--gray-400)' }}>Sin registro</span>
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' as const, fontSize: 13 }}>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
        <User size={12} style={{ color: 'var(--gray-400)' }} />
        <strong style={{ color: 'var(--gray-900)' }}>{persona}</strong>
      </span>
      {fecha && (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--gray-500)' }}>
          <Clock size={11} /> {formatTime(fecha)}
        </span>
      )}
    </span>
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

function formatMoney (n: number): string {
  return 'RD$ ' + n.toLocaleString('es-DO', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
}

function formatTime (iso: string): string {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleString('es-DO', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}
