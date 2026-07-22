'use client'
import { useState, useEffect, useCallback, type ReactNode } from 'react'
import { Inbox, Loader2, CheckCircle, ChevronRight, AlertCircle } from 'lucide-react'
import {
  fetchProductionKpis,
  type ProductionKpis,
} from '@/lib/production-v2'
import { friendlyError } from '@/lib/errorMessages'
import OrdenesTab from './OrdenesTab'
import TicketsPendientesTab from './TicketsPendientesTab'
import TicketsCompletadosTab from './TicketsCompletadosTab'

type Tab = 'ordenes' | 'pendientes' | 'completados'

interface Props {
  user: { id: string; name: string; role: string }
}

export default function ProduccionView ({ user }: Props) {
  const [tab, setTab] = useState<Tab>('ordenes')
  const [kpis, setKpis] = useState<ProductionKpis | null>(null)
  const [error, setError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)

  const reload = useCallback(() => {
    setReloadKey(k => k + 1)
  }, [])

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
              Órdenes de Alegra → Tickets → Pasarela de fabricación. Los precios se toman automáticamente del tarifario.
            </p>
          </div>

          {kpis && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 28, paddingTop: 4 }}>
              <HeaderStat label='Órdenes' value={kpis.ordenes} />
              <Divider />
              <HeaderStat label='Pendientes' value={kpis.tickets_pendientes} />
              <Divider />
              <HeaderStat label='Completados' value={kpis.tickets_completados} />
            </div>
          )}
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4, marginTop: 26, marginLeft: -4 }}>
          <TabButton active={tab === 'ordenes'} onClick={() => setTab('ordenes')}>
            <Inbox size={14} strokeWidth={1.75} /> Órdenes
            {kpis && <TabCount count={kpis.ordenes} />}
          </TabButton>
          <TabButton active={tab === 'pendientes'} onClick={() => setTab('pendientes')}>
            <Loader2 size={14} strokeWidth={1.75} /> Tickets Pendientes
            {kpis && <TabCount count={kpis.tickets_pendientes} tone={kpis.tickets_pendientes > 0 ? 'danger' : 'neutral'} />}
          </TabButton>
          <TabButton active={tab === 'completados'} onClick={() => setTab('completados')}>
            <CheckCircle size={14} strokeWidth={1.75} /> Tickets Completados
            {kpis && <TabCount count={kpis.tickets_completados} />}
          </TabButton>
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, padding: '24px 48px 80px', overflowY: 'auto' }}>
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

        {tab === 'ordenes' && <OrdenesTab user={user} onChanged={reload} />}
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
