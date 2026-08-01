'use client'
// ─────────────────────────────────────────────────────────
// Dashboard · hoja "Resumen"
// ─────────────────────────────────────────────────────────
import { Package, Wallet, TrendingUp, AlertTriangle, type LucideIcon } from 'lucide-react'
import { type ProductionKpis } from '@/lib/production-v2'
import { formatoMoneda } from '@/lib/tarifario'
import MiniCalendarWidget from './MiniCalendarWidget'
import { type DashboardView } from './QuickActions'

export interface ItemAtencion {
  key: string
  texto: string
  detalle: string
}

export interface FilaCapacidad {
  puesto: string
  label: string
  load: number
  limite: number | null
  pct: number
  tone: 'gray' | 'green' | 'amber' | 'red'
}

interface Props {
  loading: boolean
  prodKpis: ProductionKpis | null
  cobrado: number | null
  pendienteCobrar: number | null
  estancadas: number
  atencion: ItemAtencion[]
  capacidad: FilaCapacidad[]
  onNavigate: (v: DashboardView) => void
}

const BAR: Record<FilaCapacidad['tone'], string> = {
  gray: '#DDDDDD', green: '#5FA83B', amber: '#D9A441', red: '#E8180A',
}

export default function ResumenTab ({
  loading, prodKpis, cobrado, pendienteCobrar, estancadas, atencion, capacidad, onNavigate,
}: Props) {
  const sinLimites = capacidad.length > 0 && capacidad.every(c => c.limite === null)

  return (
    <div>
      {/* ── Fila 1: 4 métricas */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 16 }}>
        <MetricCard
          label='Órdenes activas'
          value={prodKpis ? String(prodKpis.tickets_pendientes) : '—'}
          icon={Package}
          onClick={() => onNavigate('produccion')}
        />
        <MetricCard
          label='Costo producción (mes)'
          value={prodKpis ? formatoMoneda(prodKpis.costo_mes) : '—'}
          icon={Wallet}
          onClick={() => onNavigate('pagos')}
        />
        <MetricCard
          label='Cobrado'
          value={cobrado === null ? '—' : formatoMoneda(cobrado)}
          icon={TrendingUp}
          bg='#EAF3DE'
          color='#3B6D11'
        />
        <MetricCard
          label='Pendiente cobrar'
          value={pendienteCobrar === null ? '—' : formatoMoneda(pendienteCobrar)}
          icon={AlertTriangle}
          bg='#FDECEA'
          color='#E8180A'
        />
      </div>

      {/* ── Fila 2: Producción + Requieren atención */}
      <div className='dash-row' style={{ marginBottom: 16 }}>
        {/* Producción */}
        <Panel>
          <PanelHeader title='Producción' onLink={() => onNavigate('produccion')} linkLabel='Ver más →' />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <MiniMetric label='Órdenes' value={prodKpis ? String(prodKpis.ordenes) : '—'} />
            <MiniMetric
              label='Pendientes'
              value={prodKpis ? String(prodKpis.tickets_pendientes) : '—'}
              color={prodKpis && prodKpis.tickets_pendientes > 0 ? '#B8860B' : undefined}
            />
            <MiniMetric
              label='Completadas'
              value={prodKpis ? String(prodKpis.tickets_completados) : '—'}
              color='#3B6D11'
            />
            <MiniMetric
              label='Estancadas +2d'
              value={loading ? '—' : String(estancadas)}
              color={estancadas > 0 ? '#E8180A' : undefined}
            />
          </div>
        </Panel>

        {/* Requieren atención */}
        <div style={{
          background: '#FDECEA', border: '0.5px solid #F8CFCB', borderRadius: 12,
          padding: '14px 16px', display: 'flex', flexDirection: 'column',
        }}>
          <div style={{
            fontSize: 13, fontWeight: 700, color: '#E8180A',
            display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10,
          }}>
            <AlertTriangle size={14} style={{ flexShrink: 0 }} />
            {atencion.length > 0
              ? `${atencion.length} ${atencion.length === 1 ? 'ticket requiere' : 'tickets requieren'} atención`
              : 'Todo en orden'}
          </div>

          {atencion.length === 0 ? (
            <div style={{ fontSize: 12, color: '#B4635C', paddingTop: 4 }}>
              Sin órdenes retrasadas, estancadas ni puestos sobrecargados.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {atencion.slice(0, 5).map(i => (
                <div key={i.key} style={{
                  fontSize: 12, color: '#8C2E26',
                  display: 'flex', alignItems: 'baseline', gap: 6,
                }}>
                  <span style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{i.texto}</span>
                  <span style={{ color: '#B4635C', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {i.detalle}
                  </span>
                </div>
              ))}
              {atencion.length > 5 && (
                <button
                  onClick={() => onNavigate('movimientos')}
                  style={{
                    marginTop: 4, alignSelf: 'flex-start', background: 'none', border: 'none',
                    color: '#E8180A', fontSize: 12, fontWeight: 600, cursor: 'pointer', padding: 0,
                  }}
                >
                  Ver todas →
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Fila 3: Próximos 7 días + Capacidad por área */}
      <div className='dash-row'>
        <MiniCalendarWidget onOpenCalendar={() => onNavigate('calendario')} />

        <Panel>
          <PanelHeader title='Capacidad por área' onLink={() => onNavigate('capacidad')} linkLabel='Configurar →' />

          {capacidad.length === 0 ? (
            <div style={{ fontSize: 12, color: '#999', padding: '20px 0', textAlign: 'center' }}>
              No hay puestos configurados.
            </div>
          ) : sinLimites ? (
            <button
              onClick={() => onNavigate('capacidad')}
              style={{
                background: 'none', border: 'none', padding: '20px 0', cursor: 'pointer',
                fontSize: 12.5, color: '#999', textAlign: 'left',
              }}
            >
              Sin límites configurados — ir a Capacidad →
            </button>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {capacidad.map(c => (
                <div key={c.puesto}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4, gap: 8 }}>
                    <span style={{
                      fontSize: 12.5, fontWeight: 500, color: '#1A1A1A',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {c.label}
                    </span>
                    <span style={{ fontSize: 11, fontWeight: 600, color: '#999', flexShrink: 0 }}>
                      {c.limite === null ? 'Sin límite' : `${c.load}/${c.limite}`}
                    </span>
                  </div>
                  <div style={{ height: 6, borderRadius: 20, background: '#F0F0F0', overflow: 'hidden' }}>
                    <div style={{
                      height: '100%', width: c.limite === null ? 0 : `${c.pct}%`,
                      background: BAR[c.tone], borderRadius: 20, transition: 'width 0.3s',
                    }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────
function Panel ({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      background: '#fff', border: '0.5px solid #ECECEC', borderRadius: 12,
      padding: '14px 16px', display: 'flex', flexDirection: 'column',
    }}>
      {children}
    </div>
  )
}

function PanelHeader ({ title, onLink, linkLabel }: { title: string; onLink: () => void; linkLabel: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, gap: 8 }}>
      <h3 style={{ fontSize: 13.5, fontWeight: 700, color: '#1A1A1A', margin: 0 }}>{title}</h3>
      <button
        onClick={onLink}
        style={{ background: 'none', border: 'none', color: '#999', fontSize: 11.5, fontWeight: 600, cursor: 'pointer', padding: 0, whiteSpace: 'nowrap' }}
        onMouseEnter={e => { e.currentTarget.style.color = '#E8180A' }}
        onMouseLeave={e => { e.currentTarget.style.color = '#999' }}
      >
        {linkLabel}
      </button>
    </div>
  )
}

function MiniMetric ({ label, value, color = '#1A1A1A' }: { label: string; value: string; color?: string }) {
  return (
    <div>
      <div style={{ fontSize: 10.5, color: '#999', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>
        {label}
      </div>
      <div style={{ fontSize: 20, fontWeight: 700, color, marginTop: 3, letterSpacing: '-0.02em', lineHeight: 1 }}>
        {value}
      </div>
    </div>
  )
}

function MetricCard ({ label, value, icon: Icon, bg = '#fff', color = '#1A1A1A', onClick }: {
  label: string
  value: string
  icon: LucideIcon
  bg?: string
  color?: string
  onClick?: () => void
}) {
  const muted = color === '#1A1A1A'
  return (
    <div
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      style={{
        background: bg, border: '0.5px solid #ECECEC', borderRadius: 10, padding: '14px 16px',
        cursor: onClick ? 'pointer' : 'default', transition: 'box-shadow 0.15s',
      }}
      onMouseEnter={e => { if (onClick) e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.05)' }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, gap: 8 }}>
        <div style={{
          fontSize: 11, color: muted ? '#666' : color,
          textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600,
        }}>
          {label}
        </div>
        <Icon size={14} style={{ color: muted ? '#BBB' : color, flexShrink: 0 }} />
      </div>
      <div style={{ fontSize: 22, fontWeight: 700, color, lineHeight: 1.1, letterSpacing: '-0.02em' }}>
        {value}
      </div>
    </div>
  )
}
