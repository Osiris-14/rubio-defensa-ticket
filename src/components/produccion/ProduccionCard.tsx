'use client'
import type { ReactNode } from 'react'
import { ArrowRight, CheckCircle, Clock, Package } from 'lucide-react'
import { calcularPrioridad, horasTranscurridas, type FacturaProduccion } from '@/lib/produccion'

const PRIORITY_TONE: Record<string, { dot: string; bg: string; text: string; label: string }> = {
  nueva:   { dot: 'var(--green)',  bg: 'var(--green-bg)',  text: 'var(--green)',  label: 'Nueva' },
  espera:  { dot: 'var(--amber)',  bg: 'var(--amber-bg)',  text: 'var(--amber)',  label: 'En espera' },
  urgente: { dot: 'var(--orange)', bg: 'var(--orange-bg)', text: 'var(--orange)', label: 'Urgente' },
  critica: { dot: 'var(--danger)', bg: 'var(--danger-bg)', text: 'var(--danger)', label: 'Crítica' },
}

function formatAgeLabel(h: number): string {
  if (h < 1) return `${Math.round(h * 60)} min`
  if (h < 24) return `${Math.round(h)}h`
  return `${Math.round(h / 24)}d`
}

// ─────────────────────────────────────────────────────────
// Pendiente card — Linear/Vercel-inspired
// ─────────────────────────────────────────────────────────

interface PendienteCardProps {
  factura: FacturaProduccion
  now: number
  onClick: () => void
}

export function PendienteCard({ factura, now, onClick }: PendienteCardProps) {
  const pri = calcularPrioridad(factura.fecha, now)
  const ageH = horasTranscurridas(factura.fecha, now)
  const tone = PRIORITY_TONE[pri.nivel]

  return (
    <div
      onClick={onClick}
      className="card card-interactive"
      style={{
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        cursor: 'pointer',
      }}
    >
      {/* Header band: priority + age */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 20px',
        borderBottom: '1px solid var(--border)',
        background: 'var(--bg-page)',
      }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '4px 12px',
          background: tone.bg,
          color: tone.text,
          borderRadius: 9999,
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: '0.04em',
          textTransform: 'uppercase' as const,
        }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: tone.dot }} />
          {tone.label}
        </div>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 4,
          fontSize: 11.5, color: 'var(--gray-500)', fontWeight: 500,
        }}>
          <Clock size={11} strokeWidth={1.75} />
          hace {formatAgeLabel(ageH)}
        </div>
      </div>

      {/* Body */}
      <div style={{ padding: '24px 24px 20px', flex: 1, display: 'flex', flexDirection: 'column' }}>
        {/* Order number — display */}
        <div style={{
          fontSize: 28,
          fontWeight: 700,
          color: 'var(--gray-900)',
          letterSpacing: '-0.03em',
          lineHeight: 1.1,
          marginBottom: 6,
          fontFeatureSettings: '"tnum" 1',
        }}>
          {factura.talonario ? `Orden #${factura.talonario}` : 'Orden —'}
        </div>

        {/* Vehicle — secondary line. vehiculo NULL = no se pudo identificar
            un modelo confiable: mostrarlo atenuado y honesto, nunca en blanco. */}
        <div style={{
          fontSize: 14,
          color: factura.vehiculo ? 'var(--gray-600)' : 'var(--gray-400)',
          fontWeight: 500,
          fontStyle: factura.vehiculo ? 'normal' : 'italic',
          lineHeight: 1.4,
          marginBottom: 20,
        }}>
          {factura.vehiculo ?? 'Sin identificar'}
        </div>

        {/* Factura + cliente — compactos */}
        <div style={{
          display: 'flex', flexDirection: 'column', gap: 8,
          paddingTop: 16, borderTop: '1px solid var(--border)',
          marginBottom: 18,
        }}>
          <CompactLine icon={<span style={dotStyle}>F</span>} label="Factura" value={factura.factura} />
          <CompactLine icon={<span style={dotStyle}>C</span>} label="Cliente" value={factura.cliente ?? '—'} />
        </div>

        {/* Meta */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' as const,
          marginTop: 'auto', marginBottom: 16,
        }}>
          {factura.num_items > 0 && (
            <span style={metaStyle}>
              <Package size={12} strokeWidth={1.75} /> {factura.num_items} producto{factura.num_items !== 1 ? 's' : ''}
            </span>
          )}

        </div>

        {/* CTA */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          paddingTop: 16, borderTop: '1px solid var(--border)',
        }}>
          <span style={{ fontSize: 11.5, color: 'var(--gray-500)', fontWeight: 500 }}>
            Pendiente de producción
          </span>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            fontSize: 13, fontWeight: 600, color: 'var(--red)',
          }}>
            Abrir <ArrowRight size={13} strokeWidth={2.25} />
          </span>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────
// Completado card
// ─────────────────────────────────────────────────────────

interface CompletadoCardProps {
  ticket: {
    id: string
    numero_factura: string
    numero_orden: string
    a_cargo_de: string | null
    modelo: string
    piezas: string[] | null
    created_at: string
    vehiculo: string | null
    cliente: string | null
    fecha_factura: string | null
  }
  now: number
  onClick: () => void
}

export function CompletadoCard({ ticket, now, onClick }: CompletadoCardProps) {
  const horas = (now - new Date(ticket.created_at).getTime()) / 3_600_000
  const edadLabel = horas < 1 ? 'hace minutos' : horas < 24 ? `hace ${Math.round(horas)}h` : `hace ${Math.round(horas / 24)}d`

  return (
    <div
      onClick={onClick}
      className="card card-interactive"
      style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', cursor: 'pointer' }}
    >
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 20px',
        borderBottom: '1px solid var(--border)',
        background: 'var(--bg-page)',
      }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '4px 12px',
          background: 'var(--green-bg)',
          color: 'var(--green)',
          borderRadius: 9999,
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: '0.04em',
          textTransform: 'uppercase' as const,
        }}>
          <CheckCircle size={11} strokeWidth={2.5} />
          Completado
        </div>
        <div style={{ fontSize: 11.5, color: 'var(--gray-500)', fontWeight: 500 }}>
          {edadLabel}
        </div>
      </div>

      <div style={{ padding: '24px 24px 20px', flex: 1, display: 'flex', flexDirection: 'column' }}>
        <div style={{
          fontSize: 28, fontWeight: 700, color: 'var(--gray-900)',
          letterSpacing: '-0.03em', lineHeight: 1.1, marginBottom: 6,
        }}>
          {ticket.numero_orden ? `Orden #${ticket.numero_orden}` : 'Orden —'}
        </div>
        <div style={{ fontSize: 14, color: 'var(--gray-600)', fontWeight: 500, marginBottom: 20, lineHeight: 1.4 }}>
          {ticket.vehiculo ?? ticket.modelo ?? '—'}
        </div>

        <div style={{
          display: 'flex', flexDirection: 'column', gap: 8,
          paddingTop: 16, borderTop: '1px solid var(--border)',
          marginBottom: 18,
        }}>
          <CompactLine icon={<span style={dotStyle}>F</span>} label="Factura" value={ticket.numero_factura} />
          <CompactLine icon={<span style={dotStyle}>C</span>} label="Cliente" value={ticket.cliente ?? '—'} />
        </div>

        <div style={{
          display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' as const,
          marginTop: 'auto', marginBottom: 16,
        }}>
          {ticket.a_cargo_de && (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <div style={{
                width: 22, height: 22, borderRadius: '50%',
                background: 'var(--gray-100)', color: 'var(--gray-700)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 11, fontWeight: 600,
              }}>
                {ticket.a_cargo_de.charAt(0).toUpperCase()}
              </div>
              <span style={{ fontSize: 12, color: 'var(--gray-700)', fontWeight: 500 }}>{ticket.a_cargo_de}</span>
            </div>
          )}
          {(ticket.piezas?.length ?? 0) > 0 && (
            <span style={metaStyle}>
              <Package size={12} strokeWidth={1.75} /> {ticket.piezas!.length} pieza{ticket.piezas!.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          paddingTop: 16, borderTop: '1px solid var(--border)',
        }}>
          <span style={{ fontSize: 11.5, color: 'var(--gray-500)', fontWeight: 500 }}>
            Listo
          </span>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            fontSize: 13, fontWeight: 600, color: 'var(--gray-600)',
          }}>
            Ver <ArrowRight size={13} strokeWidth={2.25} />
          </span>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────
// Micro-typography
// ─────────────────────────────────────────────────────────

const dotStyle: React.CSSProperties = {
  width: 16, height: 16, borderRadius: 4,
  background: 'var(--gray-100)', color: 'var(--gray-500)',
  fontSize: 9, fontWeight: 700, letterSpacing: '0.05em',
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  flexShrink: 0,
}

const metaStyle: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 5,
  fontSize: 11.5, color: 'var(--gray-500)', fontWeight: 500,
  letterSpacing: '-0.005em',
}

function CompactLine({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
      {icon}
      <span style={{ fontSize: 11, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600, flexShrink: 0 }}>
        {label}
      </span>
      <span style={{
        fontSize: 13, color: 'var(--gray-800)', fontWeight: 500,
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const,
        minWidth: 0,
      }}>
        {value}
      </span>
    </div>
  )
}
