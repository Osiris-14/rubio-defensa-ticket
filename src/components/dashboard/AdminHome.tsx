'use client'
import { useEffect, useState, useMemo, type ReactNode } from 'react'
import { AlertCircle, LayoutDashboard, Receipt, Wallet } from 'lucide-react'
import { type AppUser, ticketsToCSV } from '@/lib/store'
import {
  fetchProductionTicketsV3, fetchFacturasProduccion, fetchPriceCatalog,
  type FacturaProduccion, type PriceCatalogRow, type ProductionTicketV3,
} from '@/lib/production-v2'
import { construirPresupuestos, type OrdenPresupuesto } from '@/lib/presupuesto'
import QuickActions, { type DashboardView } from './QuickActions'
import PresupuestoTab from './PresupuestoTab'
import CobrosTab from './CobrosTab'

interface Props {
  user: AppUser
  onNavigate: (view: DashboardView) => void
  canExport?: boolean
}

type Hoja = 'resumen' | 'presupuesto' | 'cobros'

export default function AdminHome ({ user, onNavigate, canExport = true }: Props) {
  const [hoja, setHoja] = useState<Hoja>('resumen')

  const [tickets, setTickets] = useState<ProductionTicketV3[]>([])
  const [facturas, setFacturas] = useState<FacturaProduccion[]>([])
  const [catalogo, setCatalogo] = useState<PriceCatalogRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  useEffect(() => {
    let active = true
    async function load () {
      setLoading(true)
      try {
        const [t, f, c] = await Promise.all([
          fetchProductionTicketsV3(),
          fetchFacturasProduccion(),
          fetchPriceCatalog(),
        ])
        if (!active) return
        setTickets(t)
        setFacturas(f)
        setCatalogo(c)
        setError('')
      } catch (err) {
        if (active) setError((err as Error).message)
      } finally {
        if (active) { setLoading(false); setLastUpdated(new Date()) }
      }
    }
    load()
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

  // ── Presupuesto/Cobros — SOLO sobre production_tickets × tarifario.
  const presupuestos: Map<string, OrdenPresupuesto> = useMemo(
    () => construirPresupuestos(tickets, catalogo),
    [tickets, catalogo],
  )

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
          Cobros por responsable
        </HojaTab>
      </div>

      {hoja === 'presupuesto' && (
        <PresupuestoTab presupuestos={presupuestos} facturas={facturas} loading={loading} />
      )}

      {hoja === 'cobros' && (
        <CobrosTab presupuestos={presupuestos} loading={loading} />
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
