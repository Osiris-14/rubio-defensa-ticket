'use client'
// ─────────────────────────────────────────────────────────
// Dashboard · hoja "Presupuesto por orden"
// Costo de producir (tarifario, sobre production_tickets) vs facturado
// (Alegra) por orden. Las piezas sin precio en el tarifario se
// muestran como "— sin precio"; nunca como RD$0.
// ─────────────────────────────────────────────────────────
import { useMemo, useState } from 'react'
import { ChevronDown, ChevronRight, Search, Inbox, AlertTriangle, PackageOpen } from 'lucide-react'
import { type FacturaProduccion } from '@/lib/production-v2'
import { type OrdenPresupuesto, presupuestosEnRango, rangoSemana, rangoMes, iso } from '@/lib/presupuesto'
import { formatoMoneda } from '@/lib/tarifario'
import DateRangeFilter, { type PeriodoFiltro } from './DateRangeFilter'

type Filtro = 'todas' | 'pagadas' | 'pendientes'

// Umbral con el que la vista silver ya considera una factura cerrada.
const UMBRAL_SALDO = 450

interface Props {
  presupuestos: Map<string, OrdenPresupuesto>
  facturas: FacturaProduccion[]
  loading: boolean
}

export default function PresupuestoTab ({ presupuestos, facturas, loading }: Props) {
  const [busqueda, setBusqueda] = useState('')
  const [filtro, setFiltro] = useState<Filtro>('todas')
  const [abiertas, setAbiertas] = useState<Set<string>>(new Set())

  const hoy = useMemo(() => new Date(), [])
  const [periodo, setPeriodo] = useState<PeriodoFiltro>('mes')
  const [desde, setDesde] = useState(() => rangoMes(hoy).desde)
  const [hasta, setHasta] = useState(() => rangoMes(hoy).hasta)

  const rango = periodo === 'semana' ? rangoSemana(hoy) : periodo === 'mes' ? rangoMes(hoy) : { desde, hasta }

  // Factura por alegra_id — llave robusta (talonario puede venir vacío).
  const facturaPorAlegra = useMemo(() => {
    const m = new Map<string, FacturaProduccion>()
    for (const f of facturas) m.set(f.alegra_id, f)
    return m
  }, [facturas])

  const presupuestosFiltrados = useMemo(
    () => presupuestosEnRango(presupuestos, rango.desde, rango.hasta),
    [presupuestos, rango.desde, rango.hasta],
  )

  const filas = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    const out = [...presupuestosFiltrados.entries()].map(([key, p]) => {
      const factura = p.alegraId ? facturaPorAlegra.get(p.alegraId) ?? null : null
      const pagada = factura !== null && factura.saldo <= UMBRAL_SALDO
      return { key, ...p, factura, pagada }
    })
    return out
      .filter(r => {
        if (q) {
          const enOrden = r.orden.toLowerCase().includes(q)
          const enFactura = (r.factura?.factura ?? '').toLowerCase().includes(q)
          if (!enOrden && !enFactura) return false
        }
        if (filtro === 'pagadas' && !r.pagada) return false
        if (filtro === 'pendientes' && r.pagada) return false
        return true
      })
      .sort((a, b) => b.orden.localeCompare(a.orden, 'es', { numeric: true }))
  }, [presupuestosFiltrados, facturaPorAlegra, busqueda, filtro])

  function toggle (key: string) {
    setAbiertas(prev => {
      const n = new Set(prev)
      if (n.has(key)) n.delete(key)
      else n.add(key)
      return n
    })
  }

  if (loading) {
    return <div style={{ padding: '56px', textAlign: 'center', color: '#999', fontSize: 13 }}>Cargando presupuestos…</div>
  }

  if (presupuestos.size === 0) {
    return (
      <div style={{
        background: '#fff', border: '0.5px solid #ECECEC', borderRadius: 12,
        padding: '64px 24px', textAlign: 'center',
      }}>
        <div style={{
          width: 52, height: 52, borderRadius: 14, background: '#F7F7F7',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16,
        }}>
          <PackageOpen size={22} strokeWidth={1.6} style={{ color: '#BBB' }} />
        </div>
        <div style={{ fontSize: 14.5, color: '#1A1A1A', fontWeight: 600, marginBottom: 6 }}>
          No hay órdenes registradas aún
        </div>
        <div style={{ fontSize: 13, color: '#999', maxWidth: 360, margin: '0 auto', lineHeight: 1.5 }}>
          Las órdenes aparecerán aquí cuando se abran tickets desde el tab Órdenes.
        </div>
      </div>
    )
  }

  return (
    <div>
      {/* Filtro de fecha */}
      <div style={{ marginBottom: 14 }}>
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

      {/* Barra de búsqueda + filtro */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative' }}>
          <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#BBB' }} />
          <input
            className='input-base'
            style={{ height: 34, paddingLeft: 30, width: 210, fontSize: 12.5 }}
            placeholder='Orden o factura…'
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
          />
        </div>

        <div style={{
          padding: '4px 5px', display: 'flex', gap: 2,
          background: '#fff', border: '0.5px solid #ECECEC', borderRadius: 8,
        }}>
          {(['todas', 'pagadas', 'pendientes'] as Filtro[]).map(f => (
            <button
              key={f}
              onClick={() => setFiltro(f)}
              style={{
                padding: '5px 12px', borderRadius: 6, border: 'none',
                background: filtro === f ? 'var(--red)' : 'transparent',
                color: filtro === f ? '#fff' : '#666',
                fontSize: 12.5, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s',
              }}
            >
              {f === 'todas' ? 'Todas' : f === 'pagadas' ? 'Pagadas' : 'Pendiente cobro'}
            </button>
          ))}
        </div>

        <span style={{ fontSize: 12, color: '#999', marginLeft: 'auto' }}>
          {filas.length} {filas.length === 1 ? 'orden' : 'órdenes'}
        </span>
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
            No hay órdenes que coincidan en este período
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filas.map(r => (
            <OrdenCard
              key={r.key}
              row={r}
              abierta={abiertas.has(r.key)}
              onToggle={() => toggle(r.key)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────
function OrdenCard ({ row, abierta, onToggle }: {
  row: OrdenPresupuesto & { key: string; factura: FacturaProduccion | null; pagada: boolean }
  abierta: boolean
  onToggle: () => void
}) {
  const facturado = row.factura?.total ?? null
  // Sin ninguna pieza emparejada el costo no es 0: es desconocido. Y un
  // margen calculado contra costo 0 sería el facturado completo, que
  // engaña. En ese caso ambos van como "—".
  const costoConocido = row.costo > 0 || row.sinPrecio === 0
  const margen = facturado !== null && costoConocido ? facturado - row.costo : null

  return (
    <div style={{ background: '#fff', border: '0.5px solid #ECECEC', borderRadius: 12, overflow: 'hidden' }}>
      {/* Cabecera */}
      <button
        type='button'
        onClick={onToggle}
        aria-expanded={abierta}
        style={{
          display: 'flex', alignItems: 'center', gap: 10, width: '100%',
          padding: '12px 16px', border: 'none', background: 'transparent',
          cursor: 'pointer', textAlign: 'left', font: 'inherit',
        }}
      >
        {abierta
          ? <ChevronDown size={14} style={{ color: '#999', flexShrink: 0 }} />
          : <ChevronRight size={14} style={{ color: '#999', flexShrink: 0 }} />}

        <span style={{ fontSize: 14, fontWeight: 700, color: '#1A1A1A', whiteSpace: 'nowrap' }}>
          #{row.orden}
        </span>
        <span style={{
          fontSize: 14, fontWeight: 500, color: '#1A1A1A', minWidth: 0,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {row.factura?.cliente ?? 'Sin cliente'}
        </span>

        {row.factura && (
          <span style={{ fontSize: 12, color: '#999', whiteSpace: 'nowrap' }}>
            {row.factura.factura}
          </span>
        )}

        <span style={{ marginLeft: 'auto', flexShrink: 0 }}>
          {row.factura === null ? (
            <Badge bg='#F7F7F7' color='#999' border='#ECECEC'>Sin factura</Badge>
          ) : row.pagada ? (
            <Badge bg='#EAF3DE' color='#3B6D11' border='#C4DFA0'>Pagada completa</Badge>
          ) : (
            <Badge bg='#FDECEA' color='#E8180A' border='#F8CFCB'>
              Pendiente cobro · {formatoMoneda(row.factura.saldo)}
            </Badge>
          )}
        </span>
      </button>

      {abierta && (
        <div style={{ padding: '0 16px 16px' }}>
          {/* Tabla de piezas */}
          <div style={{ overflowX: 'auto', border: '0.5px solid #ECECEC', borderRadius: 8 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 480 }}>
              <thead>
                <tr>
                  <Th>Pieza</Th>
                  <Th>Responsable</Th>
                  <Th>Estado</Th>
                  <Th align='right'>Monto</Th>
                </tr>
              </thead>
              <tbody>
                {row.piezas.map(p => (
                  <tr key={p.key} style={{ borderTop: '0.5px solid #ECECEC' }}>
                    <td style={{ ...td, fontSize: 12.5, color: '#1A1A1A', fontWeight: 500 }}>
                      {p.pieza}
                    </td>
                    <td style={{ ...td, fontSize: 12, color: '#666' }}>
                      {p.responsable}
                    </td>
                    <td style={{ ...td, fontSize: 12, color: p.estado === 'completado' ? '#3B6D11' : '#B8860B' }}>
                      {p.estado === 'completado' ? 'Completado' : 'Pendiente'}
                    </td>
                    <td style={{ ...td, textAlign: 'right', fontSize: 12.5, whiteSpace: 'nowrap' }}>
                      {p.monto === null
                        ? <span style={{ color: '#BBB' }}>— sin precio</span>
                        : <span style={{ color: '#1A1A1A', fontWeight: 500 }}>{formatoMoneda(p.monto)}</span>}
                    </td>
                  </tr>
                ))}

                {/* Total */}
                <tr style={{ borderTop: '0.5px solid #ECECEC', background: '#FAFAFA' }}>
                  <td style={{ ...td, fontSize: 12.5, fontWeight: 700, color: '#1A1A1A' }} colSpan={3}>
                    Costo total de producir
                  </td>
                  <td style={{
                    ...td, textAlign: 'right', fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap',
                    color: costoConocido ? '#1A1A1A' : '#BBB',
                  }}>
                    {costoConocido ? formatoMoneda(row.costo) : '— sin precio'}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Resumen */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 8, marginTop: 12 }}>
            <MiniCard label='Costo producir' value={costoConocido ? formatoMoneda(row.costo) : '—'} />
            <MiniCard
              label='Facturado (Alegra)'
              value={facturado === null ? '—' : formatoMoneda(facturado)}
            />
            <MiniCard
              label='Margen bruto'
              value={margen === null ? '—' : formatoMoneda(margen)}
              bg={margen !== null && margen > 0 ? '#EAF3DE' : undefined}
              color={margen !== null && margen > 0 ? '#3B6D11' : undefined}
            />
          </div>

          {row.sinPrecio > 0 && (
            <div style={{
              marginTop: 10, display: 'flex', alignItems: 'center', gap: 6,
              fontSize: 11.5, color: '#B8860B',
            }}>
              <AlertTriangle size={12} style={{ flexShrink: 0 }} />
              {row.sinPrecio} {row.sinPrecio === 1 ? 'pieza sin precio' : 'piezas sin precio'} en el tarifario
              {' — el costo mostrado solo cubre las piezas emparejadas.'}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────
function Badge ({ children, bg, color, border }: {
  children: React.ReactNode; bg: string; color: string; border: string
}) {
  return (
    <span style={{
      fontSize: 11.5, fontWeight: 600, padding: '4px 11px', borderRadius: 9999,
      background: bg, color, border: `0.5px solid ${border}`, whiteSpace: 'nowrap',
    }}>
      {children}
    </span>
  )
}

function MiniCard ({ label, value, bg = '#FAFAFA', color = '#1A1A1A' }: {
  label: string; value: string; bg?: string; color?: string
}) {
  return (
    <div style={{ background: bg, border: '0.5px solid #ECECEC', borderRadius: 8, padding: '10px 12px' }}>
      <div style={{ fontSize: 10.5, color: '#999', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>
        {label}
      </div>
      <div style={{ fontSize: 15, fontWeight: 600, color, marginTop: 4, letterSpacing: '-0.01em' }}>
        {value}
      </div>
    </div>
  )
}

const td: React.CSSProperties = { padding: '9px 12px', verticalAlign: 'middle' }

function Th ({ children, align = 'left' }: { children: React.ReactNode; align?: 'left' | 'right' }) {
  return (
    <th style={{
      textAlign: align, padding: '8px 12px', fontSize: 10, fontWeight: 700,
      textTransform: 'uppercase', letterSpacing: '0.05em', color: '#999',
      background: '#FAFAFA', whiteSpace: 'nowrap',
    }}>
      {children}
    </th>
  )
}
