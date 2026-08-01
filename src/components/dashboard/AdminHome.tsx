'use client'
import { useEffect, useState, useMemo, type ReactNode } from 'react'
import { AlertCircle, LayoutDashboard, Receipt, Wallet } from 'lucide-react'
import { AREA_THEME } from '@/lib/areaTheme'
import { type AppUser, type UserRole, ROLE_LABELS, ROLE_COLORS, getTickets, ticketsToCSV } from '@/lib/store'
import {
  fetchProductionKpis, fetchPuestosCapacidad, fetchMovimientos,
  fetchFacturasProduccion, fetchPriceCatalog, fetchProductionTickets,
  type ProductionKpis, type PuestoCapacidad, type OrdenMovimiento,
  type FacturaProduccion, type PriceCatalogRow, type ProductionTicket,
} from '@/lib/production-v2'
import { fetchEventosArmador } from '@/lib/ordenes'
import { type EventoArmador } from '@/lib/ordenes-core'
import { construirPresupuestos, type OrdenPresupuesto } from '@/lib/presupuesto'
import { labelPuesto } from '@/lib/puestos'
import QuickActions, { type DashboardView } from './QuickActions'
import ResumenTab, { type ItemAtencion, type FilaCapacidad } from './ResumenTab'
import PresupuestoTab from './PresupuestoTab'
import CobrosTab from './CobrosTab'

interface Props {
  user: AppUser
  onNavigate: (view: DashboardView) => void
  canExport?: boolean
}

type Hoja = 'resumen' | 'presupuesto' | 'cobros'

type AreaDatum = { role: UserRole; tickets: Record<string, unknown>[]; total: number; today: number; retrabajos: number }
const AREA_ROLES: UserRole[] = ['recepcion', 'produccion', 'pintura', 'instalacion', 'marquilla', 'ferre']

const UMBRAL_SALDO = 450

function isoHoy () {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function AdminHome ({ user, onNavigate, canExport = true }: Props) {
  const [hoja, setHoja] = useState<Hoja>('resumen')

  const [allTickets, setAllTickets] = useState<Record<string, unknown>[]>([])
  const [areaData, setAreaData] = useState<AreaDatum[]>([])
  const [prodKpis, setProdKpis] = useState<ProductionKpis | null>(null)
  const [puestos, setPuestos] = useState<PuestoCapacidad[]>([])
  const [eventos, setEventos] = useState<EventoArmador[]>([])
  const [movimientos, setMovimientos] = useState<OrdenMovimiento[]>([])
  const [facturas, setFacturas] = useState<FacturaProduccion[]>([])
  const [catalogo, setCatalogo] = useState<PriceCatalogRow[]>([])
  const [pendientes, setPendientes] = useState<ProductionTicket[]>([])
  const [loading, setLoading] = useState(true)
  const [prodLoading, setProdLoading] = useState(true)
  const [error, setError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [now, setNow] = useState(() => Date.now())

  // Reloj para los conteos de "+2d" — evita leer Date.now() en render.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    let active = true
    async function load () {
      setLoading(true)
      try {
        const perArea = await Promise.all(AREA_ROLES.map(role => getTickets(role)))
        if (!active) return
        const now = new Date()
        const today = now.toDateString()

        const data: AreaDatum[] = AREA_ROLES.map((role, i) => {
          const tickets = perArea[i]
          return {
            role,
            tickets,
            total: tickets.length,
            today: tickets.filter(t => new Date(t.created_at as string).toDateString() === today).length,
            retrabajos: tickets.filter(t => t.re_trabajo === 'Si').length,
          }
        })
        const combined = data
          .flatMap(d => d.tickets)
          .sort((a, b) => new Date(b.created_at as string).getTime() - new Date(a.created_at as string).getTime())

        setAreaData(data)
        setAllTickets(combined)
        setError('')
      } catch (err) {
        if (active) setError((err as Error).message)
      } finally {
        if (active) setLoading(false)
      }
    }
    load().finally(() => {
      if (active) setLastUpdated(new Date())
    })

    // Datos de producción — ninguno rompe el dashboard si falla.
    // Al refrescar se conservan los datos anteriores hasta que llegan
    // los nuevos, en vez de vaciar la vista.
    Promise.allSettled([
      fetchProductionKpis(),
      fetchPuestosCapacidad(),
      fetchEventosArmador(),
      fetchMovimientos(500),
      fetchFacturasProduccion(),
      fetchPriceCatalog(),
      fetchProductionTickets('pendiente'),
    ]).then(([k, pc, ev, mv, fa, cat, pt]) => {
      if (!active) return
      if (k.status === 'fulfilled') setProdKpis(k.value)
      if (pc.status === 'fulfilled') setPuestos(pc.value)
      if (ev.status === 'fulfilled') setEventos(ev.value)
      if (mv.status === 'fulfilled') setMovimientos(mv.value)
      if (fa.status === 'fulfilled') setFacturas(fa.value)
      if (cat.status === 'fulfilled') setCatalogo(cat.value)
      if (pt.status === 'fulfilled') setPendientes(pt.value)
      setProdLoading(false)
    })
    return () => { active = false }
  }, [reloadKey])

  function refresh () { setReloadKey(k => k + 1) }

  async function exportCSV () {
    try {
      const csv = await ticketsToCSV('admin')
      if (!csv) { alert('No hay tickets para exportar.'); return }
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `rubio_all_${new Date().toISOString().split('T')[0]}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      alert('Error al exportar: ' + (err as Error).message)
    }
  }

  // ── Presupuestos (calendario × tarifario) — los usan 2 hojas.
  const presupuestos: Map<string, OrdenPresupuesto> = useMemo(
    () => construirPresupuestos(eventos, catalogo),
    [eventos, catalogo],
  )

  // ── Dinero del mes
  const hoyISO = isoHoy()
  const mesISO = hoyISO.slice(0, 7)

  const cobrado = useMemo(() => {
    if (!facturas.length) return null
    return facturas
      .filter(f => f.fecha.slice(0, 7) === mesISO)
      .reduce((a, f) => a + f.total_pagado, 0)
  }, [facturas, mesISO])

  const pendienteCobrar = useMemo(() => {
    if (!facturas.length) return null
    return facturas
      .filter(f => f.saldo > UMBRAL_SALDO)
      .reduce((a, f) => a + f.saldo, 0)
  }, [facturas])

  // ── Carga de hoy por puesto
  const loadByPuesto = useMemo(() => {
    const map = new Map<string, Set<string>>()
    for (const ev of eventos) {
      if (!ev.inicio.startsWith(hoyISO)) continue
      if (!ev.orden) continue
      const set = map.get(ev.calendario) ?? new Set()
      set.add(ev.orden)
      map.set(ev.calendario, set)
    }
    return map
  }, [eventos, hoyISO])

  const capacidad: FilaCapacidad[] = useMemo(() => puestos.filter(p => p.activo).map(p => {
    const load = loadByPuesto.get(p.puesto)?.size ?? 0
    const lim = p.limite_diario
    let pct = 0
    let tone: FilaCapacidad['tone'] = 'gray'
    if (lim !== null && lim > 0) {
      pct = Math.min(100, Math.round((load / lim) * 100))
      tone = load > lim ? 'red' : (load / lim) >= 0.7 ? 'amber' : 'green'
    }
    return { puesto: p.puesto, label: labelPuesto(p.puesto), load, limite: lim, pct, tone }
  }), [puestos, loadByPuesto])

  const sobrecargados = capacidad.filter(c => c.tone === 'red')

  // ── Estancadas +2d sin confirmar
  const estancadas = useMemo(() => {
    const confirmadas = new Set<string>()
    for (const m of movimientos) if (m.confirmada) confirmadas.add(m.numero_orden)
    const ultimo = new Map<string, OrdenMovimiento>()
    for (const m of movimientos) {
      const cur = ultimo.get(m.numero_orden)
      if (!cur || m.ocurrido_en > cur.ocurrido_en) ultimo.set(m.numero_orden, m)
    }
    return [...ultimo.values()].filter(m =>
      m.tipo !== 'SALIDA' &&
      !confirmadas.has(m.numero_orden) &&
      Math.floor((now - new Date(m.ocurrido_en).getTime()) / 86400000) > 2,
    )
  }, [movimientos, now])

  // ── Lista "Requieren atención"
  const atencion: ItemAtencion[] = useMemo(() => {
    const out: ItemAtencion[] = []

    for (const t of pendientes) {
      if (t.fecha_programada && t.fecha_programada < hoyISO) {
        out.push({
          key: `ret-${t.id}`,
          texto: `#${t.orden ?? t.factura ?? '—'}`,
          detalle: `retrasada · ${t.fecha_programada}`,
        })
      }
    }

    for (const m of estancadas) {
      const dias = Math.floor((now - new Date(m.ocurrido_en).getTime()) / 86400000)
      out.push({
        key: `est-${m.id}`,
        texto: `#${m.numero_orden}`,
        detalle: `estancada en ${labelPuesto(m.hacia_puesto)} · ${dias}d`,
      })
    }

    if (sobrecargados.length > 0) {
      out.push({
        key: 'sobrecarga',
        texto: `${sobrecargados.length} ${sobrecargados.length === 1 ? 'puesto' : 'puestos'}`,
        detalle: 'sobrecargados hoy',
      })
    }

    return out
  }, [pendientes, estancadas, sobrecargados, hoyISO, now])

  const greeting = useMemo(() => {
    const h = new Date().getHours()
    if (h < 12) return 'Buenos días'
    if (h < 18) return 'Buenas tardes'
    return 'Buenas noches'
  }, [])

  const todayLong = useMemo(() =>
    new Date().toLocaleDateString('es-DO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  , [])

  return (
    <div style={{ animation: 'fadeInUp 0.3s ease', padding: '32px 48px 80px' }}>
      {/* Saludo */}
      <div style={{ marginBottom: 24 }}>
        <div className='eyebrow' style={{ color: 'var(--red)', marginBottom: 6 }}>Resumen</div>
        <h1 style={{ fontSize: 28, fontWeight: 700, color: 'var(--gray-900)', letterSpacing: '-0.025em', margin: 0, textTransform: 'capitalize' }}>
          {greeting}, {user.name.split(' ')[0]}
        </h1>
        <p style={{ fontSize: 14, color: '#666', marginTop: 6, textTransform: 'capitalize' }}>
          {todayLong}
        </p>
      </div>

      {error && (
        <div style={{
          background: '#FDECEA', border: '0.5px solid #F8CFCB',
          borderRadius: 10, padding: '12px 16px', marginBottom: 20, fontSize: 13.5, color: '#E8180A',
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <AlertCircle size={16} /> {error}
        </div>
      )}

      <QuickActions
        onNavigate={onNavigate}
        onRefresh={refresh}
        onExport={exportCSV}
        lastUpdated={lastUpdated}
        canExport={canExport}
      />

      {/* Hojas */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '0.5px solid #ECECEC' }}>
        <HojaTab active={hoja === 'resumen'} onClick={() => setHoja('resumen')} icon={<LayoutDashboard size={13} />}>
          Resumen
        </HojaTab>
        <HojaTab active={hoja === 'presupuesto'} onClick={() => setHoja('presupuesto')} icon={<Receipt size={13} />}>
          Presupuesto por orden
        </HojaTab>
        <HojaTab active={hoja === 'cobros'} onClick={() => setHoja('cobros')} icon={<Wallet size={13} />}>
          Cobros por puesto
        </HojaTab>
      </div>

      {hoja === 'resumen' && (
        <>
          <ResumenTab
            loading={prodLoading}
            prodKpis={prodKpis}
            cobrado={cobrado}
            pendienteCobrar={pendienteCobrar}
            estancadas={estancadas.length}
            atencion={atencion}
            capacidad={capacidad}
            onNavigate={onNavigate}
          />

          {/* Operación — se conserva del dashboard anterior */}
          <h2 style={sectionTitleStyle}>Operación</h2>
          <div className='dash-row'>
            <div style={panelStyle}>
              <div style={panelHeadStyle}>
                <h3 style={{ fontSize: 13.5, fontWeight: 700, color: '#1A1A1A', margin: 0 }}>Resumen por área</h3>
                <span style={{ fontSize: 11, color: '#999' }}>{areaData.length} áreas</span>
              </div>
              {loading ? (
                <div style={{ padding: 32, textAlign: 'center', color: '#999', fontSize: 12.5 }}>Cargando…</div>
              ) : (
                <div>
                  {areaData.map(({ role, total, today, retrabajos }, index) => {
                    const t = AREA_THEME[role]
                    const Icon = t.icon
                    return (
                      <div key={role} style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '11px 16px',
                        borderBottom: index < areaData.length - 1 ? '0.5px solid #ECECEC' : 'none',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{
                            width: 30, height: 30, borderRadius: 8,
                            background: t.bg, color: t.text,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}>
                            <Icon size={13} />
                          </div>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 600, color: '#1A1A1A', lineHeight: 1.2 }}>{ROLE_LABELS[role]}</div>
                            <div style={{ fontSize: 10.5, color: '#999', marginTop: 2 }}>
                              {today} hoy · {retrabajos > 0
                                ? <span style={{ color: '#B8860B', fontWeight: 600 }}>{retrabajos} re-trabajos</span>
                                : 'sin re-trabajos'}
                            </div>
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                          <span style={{ fontSize: 20, fontWeight: 700, color: '#1A1A1A', letterSpacing: '-0.02em' }}>{total}</span>
                          <span style={{ fontSize: 10, color: '#999', fontWeight: 600 }}>tickets</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            <div style={panelStyle}>
              <div style={panelHeadStyle}>
                <h3 style={{ fontSize: 13.5, fontWeight: 700, color: '#1A1A1A', margin: 0 }}>Tickets recientes</h3>
                <button
                  onClick={() => onNavigate('tickets')}
                  style={{ background: 'none', border: 'none', color: '#999', fontSize: 11.5, fontWeight: 600, cursor: 'pointer', padding: 0 }}
                >
                  Ver todos →
                </button>
              </div>
              {loading ? (
                <div style={{ padding: 32, textAlign: 'center', color: '#999', fontSize: 12.5 }}>Cargando…</div>
              ) : allTickets.length === 0 ? (
                <div style={{ padding: 28, textAlign: 'center', color: '#BBB', fontSize: 12.5 }}>
                  No hay tickets registrados aún.
                </div>
              ) : (
                <div>
                  {allTickets.slice(0, 6).map((t, i) => {
                    const role = t.role as UserRole
                    const color = ROLE_COLORS[role] || '#888'
                    return (
                      <div key={i} style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '10px 16px', borderBottom: i < 5 ? '0.5px solid #ECECEC' : 'none',
                        fontSize: 12, gap: 10,
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: 1 }}>
                          <span style={{
                            flexShrink: 0, fontSize: 9.5, fontWeight: 700, padding: '2px 7px', borderRadius: 9999,
                            background: `${color}12`, color, border: `0.5px solid ${color}33`,
                            textTransform: 'uppercase', letterSpacing: '0.04em',
                          }}>{ROLE_LABELS[role]?.split(' ')[0] || role}</span>
                          <span style={{ fontWeight: 600, color: '#1A1A1A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {String(t.numero_orden || t.numero_factura || '—')}
                          </span>
                        </div>
                        <span style={{ fontSize: 10.5, color: '#999', flexShrink: 0 }}>
                          {new Date(t.created_at as string).toLocaleDateString('es-DO', { day: '2-digit', month: '2-digit' })}
                        </span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {hoja === 'presupuesto' && (
        <PresupuestoTab presupuestos={presupuestos} facturas={facturas} loading={prodLoading} />
      )}

      {hoja === 'cobros' && (
        <CobrosTab presupuestos={presupuestos} puestos={puestos} loading={prodLoading} />
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────
function HojaTab ({ active, onClick, icon, children }: {
  active: boolean; onClick: () => void; icon: ReactNode; children: ReactNode
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 7,
        padding: '10px 14px', marginBottom: -1,
        background: 'transparent', border: 'none',
        borderBottom: active ? '2px solid #E8180A' : '2px solid transparent',
        cursor: 'pointer', fontSize: 13, fontWeight: 600,
        color: active ? '#1A1A1A' : '#999',
        transition: 'all 0.15s', whiteSpace: 'nowrap',
      }}
    >
      {icon}
      {children}
    </button>
  )
}

const sectionTitleStyle: React.CSSProperties = {
  fontSize: 11, fontWeight: 700, color: '#999',
  textTransform: 'uppercase', letterSpacing: '0.08em',
  margin: '28px 0 12px',
}

const panelStyle: React.CSSProperties = {
  background: '#fff', border: '0.5px solid #ECECEC', borderRadius: 12, overflow: 'hidden',
}

const panelHeadStyle: React.CSSProperties = {
  padding: '13px 16px', borderBottom: '0.5px solid #ECECEC',
  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
}
