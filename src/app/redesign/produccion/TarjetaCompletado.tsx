'use client'
import { CheckCircle2, ArrowRight, Package, Clock } from 'lucide-react'

function formatAgeLabel(now: number, createdAt: string): string {
  const h = (now - new Date(createdAt).getTime()) / 3_600_000
  if (h < 1) return `${Math.round(h * 60)} min`
  if (h < 24) return `${Math.round(h)}h`
  return `${Math.round(h / 24)}d`
}

interface Props {
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
  }
  now: number
}

export default function TarjetaCompletado({ ticket, now }: Props) {
  return (
    <div style={{
      background: 'white',
      border: '1px solid #E5E7EB',
      borderRadius: 14,
      boxShadow: '0 1px 2px rgba(15,23,42,0.04)',
      overflow: 'hidden',
      fontFamily: 'Inter, sans-serif',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 18px',
        borderBottom: '1px solid #F1F3F5',
      }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '3px 10px',
          background: 'rgba(16,185,129,0.10)',
          color: '#059669',
          borderRadius: 9999,
          fontSize: 11, fontWeight: 600, letterSpacing: '0.02em',
        }}>
          <CheckCircle2 size={11} strokeWidth={2.5} />
          Completado
        </div>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11.5, color: '#6B7280', fontWeight: 500 }}>
          <Clock size={11} strokeWidth={1.75} />
          hace {formatAgeLabel(now, ticket.created_at)}
        </div>
      </div>

      <div style={{ padding: '4px 22px 18px', flex: 1, display: 'flex', flexDirection: 'column' }}>
        <div style={{
          fontSize: 26, fontWeight: 700, color: '#111827',
          letterSpacing: '-0.03em', lineHeight: 1.1, marginTop: 6, marginBottom: 4,
          fontFeatureSettings: '"tnum" 1',
        }}>
          Orden #{ticket.numero_orden || '—'}
        </div>
        <div style={{ fontSize: 14, color: '#4B5563', fontWeight: 500, lineHeight: 1.4, marginBottom: 18 }}>
          {ticket.vehiculo ?? ticket.modelo ?? '—'}
        </div>

        <div style={{ height: 1, background: '#F1F3F5', margin: '0 0 16px' }} />

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
          <Row2 label="Factura" value={ticket.numero_factura} icon={<DocIcon letter="F" />} />
          <Row2 label="Cliente" value={ticket.cliente ?? '—'} icon={<DocIcon letter="C" />} />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginTop: 'auto', marginBottom: 18 }}>
          {ticket.a_cargo_de && (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <div style={{
                width: 22, height: 22, borderRadius: '50%',
                background: '#F3F4F6', color: '#4B5563',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 11, fontWeight: 600,
              }}>
                {ticket.a_cargo_de.charAt(0).toUpperCase()}
              </div>
              <span style={{ fontSize: 12, color: '#4B5563', fontWeight: 500 }}>{ticket.a_cargo_de}</span>
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
          paddingTop: 14, borderTop: '1px solid #F1F3F5',
        }}>
          <span style={{ fontSize: 11.5, color: '#6B7280', fontWeight: 500, letterSpacing: '0.02em' }}>
            Listo
          </span>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            fontSize: 13, fontWeight: 600, color: '#6B7280',
            letterSpacing: '-0.005em',
          }}>
            Ver <ArrowRight size={13} strokeWidth={2.25} />
          </span>
        </div>
      </div>
    </div>
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

const metaStyle: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 5,
  fontSize: 11.5, color: '#6B7280', fontWeight: 500,
}
