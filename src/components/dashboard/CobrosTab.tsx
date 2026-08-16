'use client'
// ─────────────────────────────────────────────────────────
// Dashboard · hoja "Cobros por responsable"
// Lo devengado por cada responsable en la semana/mes/rango, calculado
// sobre las piezas COMPLETADAS de production_tickets que tienen precio
// en el tarifario.
// ─────────────────────────────────────────────────────────
import { useMemo, useState } from 'react'
import { Wallet, AlertTriangle } from 'lucide-react'
import {
  cobrosPorResponsable, hayCobrosRegistrados, rangoSemana, rangoMes, iso,
  type OrdenPresupuesto,
} from '@/lib/presupuesto'
import { formatoMoneda } from '@/lib/tarifario'
import DateRangeFilter, { type PeriodoFiltro } from './DateRangeFilter'

interface Props {
  presupuestos: Map<string, OrdenPresupuesto>
  loading: boolean
}

export default function CobrosTab ({ presupuestos, loading }: Props) {
  const hoy = useMemo(() => new Date(), [])
  const [periodo, setPeriodo] = useState<PeriodoFiltro>('semana')
  const [desde, setDesde] = useState(() => iso(hoy))
  const [hasta, setHasta] = useState(() => iso(hoy))

  const rango = useMemo(() => {
    return periodo === 'semana' ? rangoSemana(hoy) : periodo === 'mes' ? rangoMes(hoy) : { desde, hasta }
  }, [periodo, hoy, desde, hasta])

  const filas = useMemo(() => cobrosPorResponsable(presupuestos, rango.desde, rango.hasta), [presupuestos, rango])

  const total = filas.reduce((a, f) => a + f.monto, 0)
  const totalSinPrecio = filas.reduce((a, f) => a + f.sinPrecio, 0)

  if (loading) {
    return <div style={{ padding: '56px', textAlign: 'center', color: '#999', fontSize: 13 }}>Cargando cobros…</div>
  }

  if (!hayCobrosRegistrados(presupuestos)) {
    return (
      <div style={{
        background: '#fff', border: '0.5px solid #ECECEC', borderRadius: 12,
        padding: '64px 24px', textAlign: 'center',
      }}>
        <div style={{
          width: 52, height: 52, borderRadius: 14, background: '#F7F7F7',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16,
        }}>
          <Wallet size={22} strokeWidth={1.6} style={{ color: '#BBB' }} />
        </div>
        <div style={{ fontSize: 14.5, color: '#1A1A1A', fontWeight: 600, marginBottom: 6 }}>
          No hay cobros registrados aún
        </div>
        <div style={{ fontSize: 13, color: '#999', maxWidth: 380, margin: '0 auto', lineHeight: 1.5 }}>
          Los cobros aparecerán aquí cuando se marquen piezas como completadas.
        </div>
      </div>
    )
  }

  return (
    <div>
      {/* Filtro de fecha */}
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
        <DateRangeFilter
          periodo={periodo}
          onPeriodo={p => {
            setPeriodo(p)
            if (p === 'rango') { setDesde(iso(hoy)); setHasta(iso(hoy)) }
          }}
          desde={desde}
          hasta={hasta}
          onDesde={setDesde}
          onHasta={setHasta}
        />
      </div>

      {/* Total nómina */}
      <div style={{
        background: '#F7F7F7', border: '0.5px solid #ECECEC', borderRadius: 10,
        padding: '14px 18px', marginBottom: 14,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap',
      }}>
        <div>
          <div style={{ fontSize: 11, color: '#999', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>
            Total producción
          </div>
          <div style={{ fontSize: 12, color: '#666', marginTop: 3 }}>
            {rango.desde} → {rango.hasta}
          </div>
        </div>
        <div style={{ fontSize: 26, fontWeight: 700, color: '#1A1A1A', letterSpacing: '-0.02em' }}>
          {formatoMoneda(total)}
        </div>
      </div>

      {filas.length === 0 ? (
        <div style={{
          background: '#fff', border: '0.5px solid #ECECEC', borderRadius: 12,
          padding: '56px 24px', textAlign: 'center',
        }}>
          <div style={{ fontSize: 13.5, color: '#666', fontWeight: 500 }}>
            No hay cobros en este período
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filas.map(f => (
            <div
              key={f.responsable}
              style={{
                background: '#fff', border: '0.5px solid #ECECEC', borderRadius: 10,
                padding: '12px 16px',
                display: 'flex', alignItems: 'center', gap: 12,
              }}
            >
              {/* Avatar */}
              <div style={{
                width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
                background: 'var(--red-50)', color: 'var(--red)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12.5, fontWeight: 700,
              }}>
                {iniciales(f.responsable)}
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 14, fontWeight: 500, color: '#1A1A1A',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {f.responsable}
                </div>
                <div style={{ fontSize: 12, color: '#666', marginTop: 2 }}>
                  {f.ordenes} {f.ordenes === 1 ? 'orden' : 'órdenes'} · {f.piezas} {f.piezas === 1 ? 'pieza' : 'piezas'}
                  {f.sinPrecio > 0 && (
                    <span style={{ color: '#B8860B' }}> · {f.sinPrecio} sin precio</span>
                  )}
                </div>
              </div>

              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{
                  fontSize: 18, fontWeight: 500, letterSpacing: '-0.01em',
                  color: f.monto === 0 && f.sinPrecio > 0 ? '#BBB' : '#1A1A1A',
                }}>
                  {/* Sin ninguna pieza con precio no se muestra RD$ 0:
                      no ganó cero, es que no hay tarifa que aplicar. */}
                  {f.monto === 0 && f.sinPrecio > 0 ? '— sin precio' : formatoMoneda(f.monto)}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{
        marginTop: 12, display: 'flex', alignItems: 'flex-start', gap: 6,
        fontSize: 11.5, color: totalSinPrecio > 0 ? '#B8860B' : '#999',
      }}>
        {totalSinPrecio > 0 && <AlertTriangle size={12} style={{ flexShrink: 0, marginTop: 1 }} />}
        <span>
          Montos calculados sobre las piezas completadas con precio en el tarifario.
          {totalSinPrecio > 0 && ` ${totalSinPrecio} ${totalSinPrecio === 1 ? 'pieza queda' : 'piezas quedan'} fuera del cálculo en este período.`}
        </span>
      </div>
    </div>
  )
}

function iniciales (nombre: string): string {
  const palabras = nombre.trim().split(/\s+/).filter(Boolean)
  if (palabras.length === 0) return '—'
  if (palabras.length === 1) return palabras[0].slice(0, 2).toUpperCase()
  return `${palabras[0][0]}${palabras[1][0]}`.toUpperCase()
}
