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
  insertCobroProduccion,
  fetchFacturasProduccion,
  fetchPriceCatalog,
  type FacturaProduccion,
  type OrdenMovimiento,
  type PriceCatalogRow,
} from '@/lib/production-v2'
import {
  fetchEventosArmador,
  type EventoArmador,
} from '@/lib/ordenes'
import { precioFabricacion, type ModoDoblado } from '@/lib/tarifario'
import { friendlyError } from '@/lib/errorMessages'
import EtapasBoard from './EtapasBoard'
import { buildModelo, rolCalendario, type Etapa, type Periodo, type TarjetaOrden, type AltaSoldadura } from './etapas'

interface Props {
  user: { id: string; name: string; role: string }
  onChanged: () => void
  busqueda: string
  onAlertas: (n: number) => void
}

/** Parsea el campo detalle de un movimiento ALTA_SOLDADURA.
 *  Formato guardado: "self_bent:12000" o "other_bent:8500" */
function parsearDetalleAlta (detalle: string | null): { modo: ModoDoblado; precio: number | null } {
  if (!detalle) return { modo: 'self_bent', precio: null }
  const idx = detalle.indexOf(':')
  if (idx === -1) return { modo: 'self_bent', precio: null }
  const modoStr = detalle.slice(0, idx)
  const precioStr = detalle.slice(idx + 1)
  const modo: ModoDoblado = modoStr === 'other_bent' ? 'other_bent' : 'self_bent'
  const precio = precioStr ? Number(precioStr) : null
  return { modo, precio: precio != null && !Number.isNaN(precio) ? precio : null }
}

function movimientoToAlta (m: OrdenMovimiento): AltaSoldadura {
  const { modo, precio } = parsearDetalleAlta(m.detalle)
  return {
    orden: m.numero_orden,
    pieza: m.pieza,
    vehiculo: m.vehiculo,
    cliente: m.cliente,
    factura: null,
    puestoOrigen: m.desde_puesto,
    modo,
    precio,
    ocurridoEn: m.ocurrido_en,
  }
}

export default function OrdenesTab ({ user, onChanged, busqueda, onAlertas }: Props) {
  const [eventos, setEventos] = useState<EventoArmador[]>([])
  const [facturas, setFacturas] = useState<FacturaProduccion[]>([])
  const [catalogo, setCatalogo] = useState<PriceCatalogRow[]>([])
  const [confirmadas, setConfirmadas] = useState<Set<string>>(new Set())
  const [confirmando, setConfirmando] = useState<string | null>(null)
  const [altaOrdenes, setAltaOrdenes] = useState<Set<string>>(new Set())
  const [altaMovimientos, setAltaMovimientos] = useState<AltaSoldadura[]>([])
  const [dandoAlta, setDandoAlta] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [hoy, setHoy] = useState(() => new Date())

  const [periodo, setPeriodo] = useState<Periodo>('semana')
  const [etapaActiva, setEtapaActiva] = useState<Etapa>('corte')

  useEffect(() => {
    let active = true
    async function load () {
      try {
        const today = new Date()
        const [evs, facs, movs, cat] = await Promise.all([
          fetchEventosArmador(),
          fetchFacturasProduccion().catch(() => [] as FacturaProduccion[]),
          fetchMovimientos(500).catch(() => []),
          fetchPriceCatalog().catch(() => [] as PriceCatalogRow[]),
        ])
        if (!active) return
        setEventos(evs)
        setFacturas(facs)
        setCatalogo(cat)
        const altas = movs.filter(m => m.tipo === 'ALTA_SOLDADURA')
        setAltaOrdenes(new Set(altas.map(m => m.numero_orden)))
        setAltaMovimientos(altas.map(movimientoToAlta))
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
    () => buildModelo({ eventos, facturas, catalogo, hoy, confirmadas, periodo, filtro: busqueda, altaOrdenes, altaMovimientos }),
    [eventos, facturas, catalogo, hoy, confirmadas, periodo, busqueda, altaOrdenes, altaMovimientos],
  )

  useEffect(() => { onAlertas(modelo.totalAlertas) }, [modelo.totalAlertas, onAlertas])

  // Detecta si la orden pasó por el calendario de Deivi (doblador) —
  // decide qué columna del tarifario aplica (me lo doblaron / doblé yo).
  function calcularModo (orden: string): ModoDoblado {
    const ordenesDeivi = new Set(
      eventos
        .filter(ev => {
          const k = ev.calendario.toUpperCase().replace(/\s+/g, ' ').trim()
          return k.includes('DEIVI') || k.includes('P-13') || k.includes('DOBLADOR')
        })
        .map(ev => ev.orden)
        .filter(Boolean),
    )
    return ordenesDeivi.has(orden) ? 'other_bent' : 'self_bent'
  }

  // Mueve una tarjeta (posiblemente varias piezas) a Soldadura: inserta
  // el/los movimiento(s) ALTA_SOLDADURA (y opcionalmente SALIDA antes),
  // y registra el precio de cada pieza en cobros_produccion cuando la
  // tarjeta pertenece a Fabricación.
  async function moverASoldadura (t: TarjetaOrden, incluirSalida: boolean) {
    const modo = calcularModo(t.orden)
    const esFabricacion = rolCalendario(t.puesto) === 'fabricacion'
    const factura = t.alegra?.factura ?? null
    const nuevasAltas: AltaSoldadura[] = []

    for (const pieza of t.piezas) {
      const fila = pieza.matchKey ? catalogo.find(r => r.active && r.piece_name === pieza.matchKey) ?? null : null
      const precio = fila ? precioFabricacion(fila, modo) : null

      if (incluirSalida) {
        await insertMovimiento({
          numero_orden: t.orden,
          calendar_event_id: null,
          calendar_name: t.puesto,
          pieza: pieza.raw || null,
          vehiculo: t.vehiculo,
          cliente: t.cliente,
          desde_puesto: t.puesto,
          hacia_puesto: t.puesto,
          tipo: 'SALIDA',
          detalle: `Salida confirmada por ${user.name}`,
          dias_estancada: t.dias,
          confirmada: true,
        })
      }

      await insertMovimiento({
        numero_orden: t.orden,
        calendar_event_id: null,
        calendar_name: t.puesto,
        pieza: pieza.raw || null,
        vehiculo: t.vehiculo,
        cliente: t.cliente,
        desde_puesto: t.puesto,
        hacia_puesto: 'soldadura',
        tipo: 'ALTA_SOLDADURA',
        detalle: `${modo}:${precio ?? ''}`,
        dias_estancada: t.dias,
        confirmada: true,
      })

      if (esFabricacion) {
        await insertCobroProduccion({
          numero_orden: t.orden,
          pieza_calendario: pieza.raw || null,
          pieza_tarifario: pieza.matchKey,
          puesto: t.puesto,
          columna_tarifa: pieza.matchKey ? (modo === 'self_bent' ? 'fabri_lo_doble_yo' : 'fab_me_lo_doblaron') : 'sin_clasificar',
          monto: precio,
          user_id: user.id,
          factura,
        })
      }

      nuevasAltas.push({
        orden: t.orden,
        pieza: pieza.matchKey ?? pieza.raw,
        vehiculo: t.vehiculo,
        cliente: t.cliente,
        factura,
        puestoOrigen: t.puesto,
        modo,
        precio,
        ocurridoEn: new Date().toISOString(),
      })
    }

    setAltaOrdenes(prev => new Set(prev).add(t.orden))
    setAltaMovimientos(prev => [...nuevasAltas, ...prev])
  }

  // Confirmar salida → marca confirmada y envía automáticamente a
  // Soldadura. No hace falta un clic aparte en "Dar de Alta".
  async function handleConfirmarSalida (t: TarjetaOrden) {
    setConfirmando(t.orden)
    try {
      await moverASoldadura(t, true)
      setConfirmadas(prev => new Set(prev).add(t.orden))
      setError('')
      onChanged()
    } catch (e) {
      setError(friendlyError(e))
    } finally {
      setConfirmando(null)
    }
  }

  // Dar de Alta → mover a Soldadura. Solo existe en Fabricación (ver
  // EtapasBoard), para tarjetas que aún no están en alerta.
  async function handleDarAlta (t: TarjetaOrden) {
    if (!t.orden) return
    setDandoAlta(t.orden)
    try {
      await moverASoldadura(t, false)
      setEtapaActiva('soldadura')
      setError('')
      onChanged()
    } catch (e) {
      setError(friendlyError(e))
    } finally {
      setDandoAlta(null)
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
        dandoAlta={dandoAlta}
        onDarAlta={handleDarAlta}
      />
    </>
  )
}
