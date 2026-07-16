'use client'
import { ArrowRight, Clock, Package } from 'lucide-react'
import { calcularPrioridad, horasTranscurridas, type FacturaProduccion, type Prioridad } from '@/lib/produccion'
import { PRIORITY_STYLE } from './ProduccionNuevo'

const PRIORITY_DOT: Record<Prioridad, string> = {
  nueva:   '#10B981',
  espera:  '#F59E0B',
  urgente: '#EA580C',
  critica: '#EF4444',
}

function formatAgeLabel(h: number): string {
  if (h < 1) return `${Math.round(h * 60)} min`
  if (h < 24) return `${Math.round(h)}h`
  return `${Math.round(h / 24)}d`
}

interface Props {
  factura: FacturaProduccion
  now: number
  onClick: () => void
}

export default function TarjetaPendiente({ factura, now, onClick }: Props) {
  const pri = calcularPrioridad(factura.fecha, now)
  const ageH = horasTranscurridas(factura.fecha, now)
  const tone = PRIORITY_STYLE[pri.nivel]
  const dotColor = PRIORITY_DOT[pri.nivel]

  return (
    <button
      onClick={onClick}
      style={{
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        textAlign: 'left',
        background: 'white',
        border: '1px solid #E5E7EB',
        borderRadius: 14,
        boxShadow: '0 1px 2px rgba(15,23,42,0.04)',
        cursor: 'pointer',
        transition: 'box-shadow 0.18s, transform 0.18s, border-color 0.18s',
        overflow: 'hidden',
        padding: 0,
        fontFamily: 'Inter, sans-serif',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.boxShadow = '0 8px 24px rgba(15,23,42,0.08), 0 2px 6px rgba(15,23,42,0.04)'
        e.currentTarget.style.transform = 'translateY(-1px)'
        e.currentTarget.style.borderColor = '#D1D5DB'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.boxShadow = '0 1px 2px rgba(15,23,42,0.04)'
        e.currentTarget.style.transform = 'translateY(0)'
        e.currentTarget.style.borderColor = '#E5E7EB'
      }}
    >
      {/* Top accent stripe */}
      <div style={{ height: 3, background: dotColor, flexShrink: 0 }} />

      {/* Header band — status pill + age */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 18px',
      }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '3px 10px',
          background: tone.bg, color: tone.text,
          borderRadius: 9999,
          fontSize: 11, fontWeight: 600, letterSpacing: '0.02em',
        }}>
          <span style={{ width: 5, height: 5, borderRadius: '50%', background: dotColor }} />
          {tone.label}
        </div>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11.5, color: '#6B7280', fontWeight: 500 }}>
          <Clock size={11} strokeWidth={1.75} />
          hace {formatAgeLabel(ageH)}
        </div>
      </div>

      {/* Body */}
      <div style={{ padding: '4px 22px 18px', flex: 1, display: 'flex', flexDirection: 'column' }}>
        {/* Order number display */}
        <div style={{
          fontSize: 26, fontWeight: 700, color: '#111827',
          letterSpacing: '-0.03em', lineHeight: 1.1, marginTop: 6, marginBottom: 4,
          fontFeatureSettings: '"tnum" 1',
        }}>
          Orden #{factura.talonario ?? '—'}
        </div>
        {/* Vehicle */}
        <div style={{ fontSize: 14, color: '#4B5563', fontWeight: 500, lineHeight: 1.4, marginBottom: 18 }}>
          {factura.vehiculo ?? 'Sin vehículo'}
        </div>

        {/* Divider */}
        <div style={{ height: 1, background: '#F1F3F5', margin: '0 0 16px' }} />

        {/* Factura + cliente */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
          <Row2 label="Factura" value={factura.factura} icon={<DocIcon letter="F" />} />
          <Row2 label="Cliente" value={factura.cliente ?? '—'} icon={<DocIcon letter="C" />} />
        </div>

        {/* Meta */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' as const, marginTop: 'auto', marginBottom: 18 }}>
          {factura.num_items > 0 && (
            <Meta><Package size={12} strokeWidth={1.75} />{factura.num_items} producto{factura.num_items !== 1 ? 's' : ''}</Meta>
          )}

        </div>

        {/* CTA row */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          paddingTop: 14,
          borderTop: '1px solid #F1F3F5',
        }}>
          <span style={{ fontSize: 11.5, color: '#6B7280', fontWeight: 500, letterSpacing: '0.02em' }}>
            Pendiente de producción
          </span>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            fontSize: 13, fontWeight: 600, color: '#E8180A',
            letterSpacing: '-0.005em',
          }}>
            Abrir ticket <ArrowRight size={13} strokeWidth={2.25} />
          </span>
        </div>
      </div>
    </button>
  )
}

function Row2({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
      {icon}
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: 10.5, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600, lineHeight: 1.1, marginBottom: 2 }}>
          {label}
        </div>
        <div style={{ fontSize: 13, color: '#111827', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>
          {value}
        </div>
      </div>
    </div>
  )
}

function DocIcon({ letter }: { letter: string }) {
  return (
    <div style={{
      width: 28, height: 28, borderRadius: 6,
      background: '#F3F4F6',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: '#6B7280', fontSize: 11, fontWeight: 700,
      flexShrink: 0,
    }}>{letter}</div>
  )
}

function Meta({ children }: { children: React.ReactNode }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      fontSize: 11.5, color: '#6B7280', fontWeight: 500,
    }}>{children}</span>
  )
}
