'use client'
// ─────────────────────────────────────────────────────────
// Contenido de Producción: carga los datos del calendario + Alegra y
// los pasa al tablero de etapas. No cambia ninguna consulta existente.
// ─────────────────────────────────────────────────────────
import { useState, useEffect, useMemo } from 'react'
import { AlertCircle } from 'lucide-react'
import {
  fetchMovimientos,
  insertMovimiento,
  fetchFacturasProduccion,
  type FacturaProduccion,
} from '@/lib/production-v2'
import {
  fetchEventosArmador,
  type EventoArmador,
} from '@/lib/ordenes'
import { friendlyError } from '@/lib/errorMessages'
import EtapasBoard from './EtapasBoard'
import { buildModelo, type Etapa, type Periodo, type TarjetaOrden } from './etapas'

interface Props {
  user: { id: string; name: string; role: string }
  onChanged: () => void
  busqueda: string
  onAlertas: (n: number) => void
}

export default function OrdenesTab ({ user, onChanged, busqueda, onAlertas }: Props) {
  const [eventos, setEventos] = useState<EventoArmador[]>([])
  const [facturas, setFacturas] = useState<FacturaProduccion[]>([])
  const [confirmadas, setConfirmadas] = useState<Set<string>>(new Set())
  const [confirmando, setConfirmando] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [hoy, setHoy] = useState(() => new Date())

  // La semana es el filtro por defecto: así se ven de una vez las
  // órdenes del 28 en adelante sin tocar nada.
  const [periodo, setPeriodo] = useState<Periodo>('semana')
  const [etapaActiva, setEtapaActiva] = useState<Etapa>('corte')

  useEffect(() => {
    let active = true
    async function load () {
      try {
        const today = new Date()
        const [evs, facs, movs] = await Promise.all([
          fetchEventosArmador(),
          fetchFacturasProduccion().catch(() => [] as FacturaProduccion[]),
          fetchMovimientos(500).catch(() => []),
        ])
        if (!active) return
        setEventos(evs)
        setFacturas(facs)
        setConfirmadas(new Set(movs.filter(m => m.tipo === 'SALIDA' && m.confirmada).map(m => m.numero_orden)))
        setHoy(today)
        setError('')
      } catch (e) {
        if (active) setError(friendlyError(e))
      } finally {
        if (active) setLoading(false)
      }
    }
    load()
    return () => { active = false }
  }, [])

  const modelo = useMemo(
    () => buildModelo({ eventos, facturas, hoy, confirmadas, periodo, filtro: busqueda }),
    [eventos, facturas, hoy, confirmadas, periodo, busqueda],
  )

  // El pill rojo del top bar vive en el padre.
  useEffect(() => { onAlertas(modelo.totalAlertas) }, [modelo.totalAlertas, onAlertas])

  async function handleConfirmarSalida (t: TarjetaOrden) {
    setConfirmando(t.orden)
    try {
      await insertMovimiento({
        numero_orden: t.orden,
        calendar_event_id: null,
        calendar_name: t.puesto,
        pieza: t.titulo || null,
        vehiculo: t.vehiculo,
        cliente: t.cliente,
        desde_puesto: t.puesto,
        hacia_puesto: t.puesto,
        tipo: 'SALIDA',
        detalle: `Salida confirmada por ${user.name}`,
        dias_estancada: t.dias,
        confirmada: true,
      })
      setConfirmadas(prev => new Set(prev).add(t.orden))
      setError('')
      onChanged()
    } catch (e) {
      setError(friendlyError(e))
    } finally {
      setConfirmando(null)
    }
  }

  if (loading) {
    return (
      <div style={{ padding: '72px 24px', textAlign: 'center', color: '#999', fontSize: 13 }}>
        <div style={{
          display: 'inline-block', width: 22, height: 22,
          border: '2.5px solid #ECECEC', borderTopColor: 'var(--red)',
          borderRadius: '50%', animation: 'spin 0.7s linear infinite', marginBottom: 12,
        }} />
        <div>Cargando órdenes…</div>
      </div>
    )
  }

  return (
    <>
      {error && (
        <div style={{
          background: '#FDECEA', border: '0.5px solid #F8CFCB',
          borderRadius: 10, padding: '12px 16px', fontSize: 13, color: '#E8180A',
          display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14,
        }}>
          <AlertCircle size={15} /> {error}
        </div>
      )}

      <EtapasBoard
        modelo={modelo}
        etapaActiva={etapaActiva}
        onEtapa={setEtapaActiva}
        periodo={periodo}
        onPeriodo={setPeriodo}
        confirmando={confirmando}
        onConfirmar={handleConfirmarSalida}
      />
    </>
  )
}
