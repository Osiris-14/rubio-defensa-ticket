'use client'
import { useState, useEffect, useCallback, type ReactNode } from 'react'
import { Inbox, Loader2, CheckCircle, ChevronRight, AlertCircle, LayoutGrid, Table2, RefreshCw, Search, X } from 'lucide-react'
import {
  fetchProductionKpis,
  type ProductionKpis,
} from '@/lib/production-v2'
import { fetchEventosArmador, fetchOrdenesMapa, type OrdenAlegra } from '@/lib/ordenes'
import { type EventoArmador } from '@/lib/ordenes-core'
import { friendlyError } from '@/lib/errorMessages'
import OrdenesTab from './OrdenesTab'
import TicketsPendientesTab from './TicketsPendientesTab'
import TicketsCompletadosTab from './TicketsCompletadosTab'
import AgendaView from './AgendaView'

type Tab = 'ordenes' | 'pendientes' | 'completados'
type Mode = 'tabla' | 'agenda'
type FilterEstado = 'todos' | 'atrasados' | 'al_dia'

const MODE_KEY = 'produccion_view_mode'

interface Props {
  user: { id: string; name: string; role: string }
}

export default function ProduccionView ({ user }: Props) {
  const [tab, setTab] = useState<Tab>('ordenes')
  const [mode, setMode] = useState<Mode>(() => {
    if (typeof window !== 'undefined') {
      return (sessionStorage.getItem(MODE_KEY) as Mode) ?? 'tabla'
    }
    return 'tabla'
  })
  const [kpis, setKpis] = useState<ProductionKpis | null>(null)
  const [error, setError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)

  // Filtros compartidos entre vista Tabla y Agenda (se conservan al cambiar)
  const [filterOrden, setFilterOrden] = useState('')
  const [filterEstado, setFilterEstado] = useState<FilterEstado>('todos')

  // Agenda data (only loaded when agenda mode is active)
  const [eventos, setEventos] = useState<EventoArmador[]>([])
  const [ordenesMap, setOrdenesMap] = useState<Map<string, OrdenAlegra>>(new Map())
  const [agendaLoading, setAgendaLoading] = useState(false)
  const [agendaError, setAgendaError] = useState('')

  const reload = useCallback(() => {
    setReloadKey(k => k + 1)
  }, [])

  function switchMode (m: Mode) {
    setMode(m)
    if (m === 'agenda') setAgendaLoading(true)
    if (typeof window !== 'undefined') sessionStorage.setItem(MODE_KEY, m)
  }

  useEffect(() => {
    let active = true
    async function load () {
      try {
        const k = await fetchProductionKpis()
        if (active) { setKpis(k); setError('') }
      } catch (e) {
        if (active) setError(friendlyError(e))
      }
    }
    load()
    return () => { active = false }
  }, [reloadKey])

  // Load agenda data when agenda mode is active
  useEffect(() => {
    if (mode !== 'agenda') return
    let active = true
    Promise.all([fetchEventosArmador(), fetchOrdenesMapa()])
      .then(([evs, map]) => {
        if (!active) return
        setEventos(evs)
        setOrdenesMap(map)
        setAgendaError('')
      })
      .catch(e => { if (active) setAgendaError(friendlyError(e)) })
      .finally(() => { if (active) setAgendaLoading(false) })
    return () => { active = false }
  }, [mode, reloadKey])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      {/* Header */}
      <div className='workspace-header' style={{ padding: '24px 48px 0', flexShrink: 0 }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          fontSize: 12, color: 'var(--gray-500)', fontWeight: 500, marginBottom: 16,
        }}>
          <span>Operación</span>
          <ChevronRight size={12} strokeWidth={2} style={{ color: 'var(--gray-400)' }} />
          <span style={{ color: 'var(--gray-700)', fontWeight: 600 }}>Producción</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 24, flexWrap: 'wrap' as const }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <h1 style={{
              fontSize: 30, fontWeight: 700, color: 'var(--gray-900)',
              letterSpacing: '-0.03em', lineHeight: 1.1, margin: 0,
            }}>
              Producción
            </h1>
            <p style={{ fontSize: 14, color: 'var(--gray-500)', marginTop: 8, lineHeight: 1.5, maxWidth: 620 }}>
              Órdenes de Alegra → Tickets → Pasarela: Corte → Doblado → Armado → Soldadura.
              Las <strong>Órdenes</strong> aún no se han dado de alta; <strong>En proceso</strong> son las que ya van por la pasarela.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
            {kpis && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 28, paddingTop: 4 }}>
                <HeaderStat label='Órdenes' value={kpis.ordenes} />
                <Divider />
                <HeaderStat label='En proceso' value={kpis.tickets_pendientes} />
                <Divider />
                <HeaderStat label='Completados' value={kpis.tickets_completados} />
              </div>
            )}

            {/* Mode switcher — only when on ordenes tab */}
            {tab === 'ordenes' && (
              <div className='card' style={{ padding: '3px 4px', display: 'flex', gap: 2 }}>
                <button
                  onClick={() => switchMode('tabla')}
                  title='Vista Tabla'
                  style={{
                    padding: '6px 10px', borderRadius: 'var(--radius-sm)', border: 'none',
                    background: mode === 'tabla' ? 'var(--red)' : 'transparent',
                    color: mode === 'tabla' ? '#fff' : 'var(--gray-500)',
                    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5,
                    fontSize: 12, fontWeight: 600, transition: 'all 0.15s',
                  }}
                >
                  <Table2 size={13} /> Tabla
                </button>
                <button
                  onClick={() => switchMode('agenda')}
                  title='Vista Agenda'
                  style={{
                    padding: '6px 10px', borderRadius: 'var(--radius-sm)', border: 'none',
                    background: mode === 'agenda' ? 'var(--red)' : 'transparent',
                    color: mode === 'agenda' ? '#fff' : 'var(--gray-500)',
                    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5,
                    fontSize: 12, fontWeight: 600, transition: 'all 0.15s',
                  }}
                >
                  <LayoutGrid size={13} /> Agenda
                </button>
              </div>
            )}

            {mode === 'agenda' && tab === 'ordenes' && (
              <button
                onClick={reload}
                className='btn btn-secondary btn-sm'
                disabled={agendaLoading}
                style={{ height: 34 }}
              >
                <RefreshCw size={12} style={{ animation: agendaLoading ? 'spin 1s linear infinite' : 'none' }} />
                Refrescar
              </button>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4, marginTop: 26, marginLeft: -4 }}>
          <TabButton active={tab === 'ordenes'} onClick={() => setTab('ordenes')}>
            <Inbox size={14} strokeWidth={1.75} /> Órdenes
            {kpis && <TabCount count={kpis.ordenes} />}
          </TabButton>
          <TabButton active={tab === 'pendientes'} onClick={() => setTab('pendientes')}>
            <Loader2 size={14} strokeWidth={1.75} /> En proceso
            {kpis && <TabCount count={kpis.tickets_pendientes} tone={kpis.tickets_pendientes > 0 ? 'danger' : 'neutral'} />}
          </TabButton>
          <TabButton active={tab === 'completados'} onClick={() => setTab('completados')}>
            <CheckCircle size={14} strokeWidth={1.75} /> Tickets Completados
            {kpis && <TabCount count={kpis.tickets_completados} />}
          </TabButton>
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, padding: '24px 48px 80px', overflowY: 'auto', overflowX: mode === 'agenda' && tab === 'ordenes' ? 'auto' : 'hidden' }}>
        {error && (
          <div style={{
            background: 'var(--red-50)', border: '1px solid var(--red-ring)',
            borderRadius: 'var(--radius-lg)', padding: '12px 16px',
            marginBottom: 20, fontSize: 13.5, color: 'var(--red)',
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <AlertCircle size={16} /> {error}
          </div>
        )}

        {tab === 'ordenes' && (
          <FilterBar
            filterOrden={filterOrden}
            filterEstado={filterEstado}
            onOrdenChange={setFilterOrden}
            onEstadoChange={setFilterEstado}
          />
        )}

        {tab === 'ordenes' && mode === 'tabla' && (
          <OrdenesTab
            user={user}
            onChanged={reload}
            filterOrden={filterOrden}
            filterEstado={filterEstado}
          />
        )}
        {tab === 'ordenes' && mode === 'agenda' && (
          agendaError ? (
            <div style={{
              background: 'var(--red-50)', border: '1px solid var(--red-ring)',
              borderRadius: 'var(--radius-lg)', padding: '12px 16px',
              fontSize: 13.5, color: 'var(--red)',
              display: 'flex', alignItems: 'center', gap: 10,
            }}>
              <AlertCircle size={16} /> {agendaError}
            </div>
          ) : agendaLoading ? (
            <div style={{ padding: '48px', textAlign: 'center', color: 'var(--gray-400)', fontSize: 13 }}>
              Cargando tablero de agenda…
            </div>
          ) : (
            <AgendaView
              eventos={eventos}
              ordenesMap={ordenesMap}
              filterOrden={filterOrden}
              filterEstado={filterEstado}
            />
          )
        )}
        {tab === 'pendientes' && <TicketsPendientesTab user={user} onChanged={reload} />}
        {tab === 'completados' && <TicketsCompletadosTab />}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────
function TabButton ({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 8,
        padding: '12px 4px', marginRight: 24,
        background: 'transparent', border: 'none',
        borderBottom: active ? '2px solid var(--red)' : '2px solid transparent',
        cursor: 'pointer', fontSize: 14, fontWeight: 600,
        color: active ? 'var(--gray-900)' : 'var(--gray-500)',
        letterSpacing: '-0.005em', transition: 'all var(--t-fast)', marginBottom: -1,
      }}
    >
      {children}
    </button>
  )
}

function TabCount ({ count, tone = 'neutral' }: { count: number; tone?: 'neutral' | 'danger' }) {
  return (
    <span style={{
      fontSize: 11.5, fontWeight: 600,
      color: tone === 'danger' ? 'var(--red)' : 'var(--gray-500)',
      background: tone === 'danger' ? 'var(--red-50)' : 'var(--gray-100)',
      padding: '1px 8px', borderRadius: 9999, minWidth: 22, textAlign: 'center' as const,
    }}>
      {count}
    </span>
  )
}

function HeaderStat ({ label, value }: { label: string; value: number }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
      <span style={{ fontSize: 10, color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>
        {label}
      </span>
      <span style={{ fontSize: 22, fontWeight: 700, lineHeight: 1, color: 'var(--gray-900)', letterSpacing: '-0.02em' }}>
        {value}
      </span>
    </div>
  )
}

function Divider () {
  return <div style={{ width: 1, height: 32, background: 'var(--border)' }} />
}

// ─────────────────────────────────────────────────────────
function FilterBar ({ filterOrden, filterEstado, onOrdenChange, onEstadoChange }: {
  filterOrden: string
  filterEstado: FilterEstado
  onOrdenChange: (v: string) => void
  onEstadoChange: (v: FilterEstado) => void
}) {
  const hayFiltros = filterOrden !== '' || filterEstado !== 'todos'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
      {/* Estado */}
      <div className='card' style={{ padding: '4px 6px', display: 'flex', gap: 2 }}>
        {(['todos', 'atrasados', 'al_dia'] as FilterEstado[]).map(e => (
          <button
            key={e}
            onClick={() => onEstadoChange(e)}
            style={{
              padding: '5px 12px', borderRadius: 'var(--radius-sm)', border: 'none',
              background: filterEstado === e ? 'var(--red)' : 'transparent',
              color: filterEstado === e ? '#fff' : 'var(--gray-600)',
              fontSize: 12.5, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s',
            }}
          >
            {e === 'todos' ? 'Todos' : e === 'atrasados' ? 'Atrasados' : 'Al día'}
          </button>
        ))}
      </div>

      {/* Orden */}
      <div style={{ position: 'relative' }}>
        <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--gray-400)' }} />
        <input
          className='input-base'
          style={{ height: 34, paddingLeft: 30, width: 140, fontSize: 12.5 }}
          placeholder='Orden…'
          value={filterOrden}
          onChange={e => onOrdenChange(e.target.value)}
        />
      </div>

      {hayFiltros && (
        <button
          onClick={() => { onOrdenChange(''); onEstadoChange('todos') }}
          className='btn btn-ghost btn-sm'
          style={{ height: 32, gap: 4, fontSize: 12 }}
        >
          <X size={12} /> Limpiar
        </button>
      )}
    </div>
  )
}
