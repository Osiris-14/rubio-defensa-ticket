'use client'
// ─────────────────────────────────────────────────────────
// Dashboard · hoja "Cobros por puesto"
// Lo devengado por cada puesto en la semana o el mes, calculado sobre
// las piezas del calendario que tienen precio en el tarifario.
// ─────────────────────────────────────────────────────────
import { useMemo, useState } from 'react'
import { Inbox, AlertTriangle } from 'lucide-react'
import {
  cobrosPorPuesto, rangoSemana, rangoMes,
  type OrdenPresupuesto,
} from '@/lib/presupuesto'
import { COLOR_ETAPA, inicialesPuesto } from '@/lib/puestos'
import { formatoMoneda } from '@/lib/tarifario'
import { type PuestoCapacidad } from '@/lib/production-v2'

type Periodo = 'semana' | 'mes'

interface Props {
  presupuestos: Map<string, OrdenPresupuesto>
  puestos: PuestoCapacidad[]
  loading: boolean
}

export default function CobrosTab ({ presupuestos, puestos, loading }: Props) {
  const [periodo, setPeriodo] = useState<Periodo>('semana')

  const rango = useMemo(() => {
    const hoy = new Date()
    return periodo === 'semana' ? rangoSemana(hoy) : rangoMes(hoy)
  }, [periodo])

  // Solo puestos activos, según puesto_capacidad.
  const activos = useMemo(() => {
    const set = new Set(puestos.filter(p => p.activo).map(p => p.puesto))
    return set
  }, [puestos])

  const filas = useMemo(() => {
    const todos = cobrosPorPuesto(presupuestos, rango.desde, rango.hasta)
    // Si puesto_capacidad aún no tiene filas, no se oculta nada.
    if (activos.size === 0) return todos
    return todos.filter(c => activos.has(c.puesto))
  }, [presupuestos, rango, activos])

  const total = filas.reduce((a, f) => a + f.monto, 0)
  const totalSinPrecio = filas.reduce((a, f) => a + f.sinPrecio, 0)
  const etiquetaPeriodo = periodo === 'semana' ? 'Esta semana' : 'Este mes'

  if (loading) {
    return <div style={{ padding: '56px', textAlign: 'center', color: '#999', fontSize: 13 }}>Cargando cobros…</div>
  }

  return (
    <div>
      {/* Selector de período */}
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
        <div style={{
          marginLeft: 'auto', padding: '4px 5px', display: 'flex', gap: 2,
          background: '#fff', border: '0.5px solid #ECECEC', borderRadius: 8,
        }}>
          {(['semana', 'mes'] as Periodo[]).map(p => (
            <button
              key={p}
              onClick={() => setPeriodo(p)}
              style={{
                padding: '5px 12px', borderRadius: 6, border: 'none',
                background: periodo === p ? 'var(--red)' : 'transparent',
                color: periodo === p ? '#fff' : '#666',
                fontSize: 12.5, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s',
              }}
            >
              {p === 'semana' ? 'Esta semana' : 'Este mes'}
            </button>
          ))}
        </div>
      </div>

      {/* Total nómina */}
      <div style={{
        background: '#F7F7F7', border: '0.5px solid #ECECEC', borderRadius: 10,
        padding: '14px 18px', marginBottom: 14,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap',
      }}>
        <div>
          <div style={{ fontSize: 11, color: '#999', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>
            Total nómina producción
          </div>
          <div style={{ fontSize: 12, color: '#666', marginTop: 3 }}>
            {etiquetaPeriodo} · {rango.desde} → {rango.hasta}
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
          <div style={{
            width: 46, height: 46, borderRadius: 12, background: '#F7F7F7',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12,
          }}>
            <Inbox size={20} strokeWidth={1.6} style={{ color: '#BBB' }} />
          </div>
          <div style={{ fontSize: 13.5, color: '#666', fontWeight: 500 }}>
            No hay piezas agendadas en este período
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filas.map(f => {
            const c = COLOR_ETAPA[f.etapa]
            return (
              <div
                key={f.puesto}
                style={{
                  background: '#fff', border: '0.5px solid #ECECEC', borderRadius: 10,
                  padding: '12px 16px',
                  display: 'flex', alignItems: 'center', gap: 12,
                }}
              >
                {/* Avatar */}
                <div style={{
                  width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
                  background: c.bg, color: c.text,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 12.5, fontWeight: 700,
                }}>
                  {inicialesPuesto(f.puesto)}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: 14, fontWeight: 500, color: '#1A1A1A',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {f.label}
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
                  <div style={{ fontSize: 11, color: '#999', marginTop: 2 }}>
                    {etiquetaPeriodo.toLowerCase()}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <div style={{
        marginTop: 12, display: 'flex', alignItems: 'flex-start', gap: 6,
        fontSize: 11.5, color: totalSinPrecio > 0 ? '#B8860B' : '#999',
      }}>
        {totalSinPrecio > 0 && <AlertTriangle size={12} style={{ flexShrink: 0, marginTop: 1 }} />}
        <span>
          Montos calculados sobre las piezas con precio en el tarifario.
          {totalSinPrecio > 0 && ` ${totalSinPrecio} ${totalSinPrecio === 1 ? 'pieza queda' : 'piezas quedan'} fuera del cálculo en este período.`}
        </span>
      </div>
    </div>
  )
}
