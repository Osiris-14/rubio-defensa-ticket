'use client'
// ─────────────────────────────────────────────────────────
// Vista Producción: pestañas por etapa (Corte · Doblado · Fabricación),
// filtro Día/Semana/Mes y órdenes agrupadas por día.
// Solo presentación: el modelo llega construido desde etapas.ts.
// ─────────────────────────────────────────────────────────
import { Fragment } from 'react'
import type {
  DatosEtapa, Etapa, GrupoDia, ModeloProduccion, Periodo, PiezaInfo, SinClasificarItem, TarjetaOrden,
} from './etapas'
import { ETAPAS } from './etapas'

const ROJO = '#E8180A'
const VERDE_SOLDADURA = '#1A7F5A'
const AMBAR = '#B45309'
const AMBAR_BG = '#FEF3C7'

interface Tema {
  titulo: string
  icono: string
  /** Fondo de la pestaña activa. */
  bg: string
  /** Color del texto de la pestaña. */
  text: string
  /** Acento: subrayado activo, borde izquierdo de tarjeta, filtro activo. */
  accent: string
  /** Borde suave de tarjetas y línea del día. */
  linea: string
}

const TEMAS: Record<Etapa, Tema> = {
  corte:       { titulo: 'Corte',       icono: '✂',  bg: '#FAEEDA', text: '#633806', accent: '#997022', linea: '#F0D9A0' },
  doblado:     { titulo: 'Doblado',     icono: '〰', bg: '#E6F1FB', text: '#0C447C', accent: '#0C447C', linea: '#B8D4F0' },
  fabricacion: { titulo: 'Fabricación', icono: '🔧', bg: '#EAF3DE', text: '#3B6D11', accent: '#3B6D11', linea: '#C4DFA0' },
  soldadura:   { titulo: 'Soldadura',   icono: '⚡',  bg: '#E8F5F0', text: VERDE_SOLDADURA, accent: VERDE_SOLDADURA, linea: '#A8D9C8' },
}

const PERIODOS: { id: Periodo; label: string }[] = [
  { id: 'dia', label: 'Día' },
  { id: 'semana', label: 'Semana' },
  { id: 'mes', label: 'Mes' },
]

interface Props {
  modelo: ModeloProduccion
  etapaActiva: Etapa
  onEtapa: (e: Etapa) => void
  periodo: Periodo
  onPeriodo: (p: Periodo) => void
  confirmando: string | null
  onConfirmar: (t: TarjetaOrden) => void
  /** Dar de Alta → mover a Soldadura (solo Fabricación) */
  dandoAlta: string | null
  onDarAlta: (t: TarjetaOrden) => void
}

export default function EtapasBoard ({
  modelo, etapaActiva, onEtapa, periodo, onPeriodo, confirmando, onConfirmar,
  dandoAlta, onDarAlta,
}: Props) {
  const tema = TEMAS[etapaActiva]
  const datos = modelo.etapas[etapaActiva]
  // "Dar de Alta" solo existe en Fabricación — en Corte/Doblado la
  // transición a Soldadura ocurre automáticamente al Confirmar salida.
  const permiteDarAlta = etapaActiva === 'fabricacion'

  return (
    <div>
      {/* ── Pestañas */}
      <div className='etapa-tabs' role='tablist' style={{
        display: 'flex', borderBottom: '2px solid #ECECEC', overflowX: 'auto',
      }}>
        {ETAPAS.map(e => (
          <TabEtapa
            key={e}
            etapa={e}
            activa={e === etapaActiva}
            datos={modelo.etapas[e]}
            onClick={() => onEtapa(e)}
          />
        ))}
      </div>

      {/* ── Barra de filtro */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
        background: '#FAFAFA', border: '0.5px solid #ECECEC', borderTop: 'none',
        padding: '8px 14px',
      }}>
        <span style={{ fontSize: 11, color: '#999' }}>Ver:</span>
        {PERIODOS.map(p => {
          const activo = p.id === periodo
          return (
            <button
              key={p.id}
              onClick={() => onPeriodo(p.id)}
              style={{
                fontSize: 11, padding: '3px 11px', borderRadius: 20, cursor: 'pointer',
                background: activo ? tema.accent : '#fff',
                color: activo ? '#fff' : '#666',
                border: activo ? `0.5px solid ${tema.accent}` : '0.5px solid #ECECEC',
                fontWeight: activo ? 600 : 500,
                transition: 'all 0.15s', whiteSpace: 'nowrap',
              }}
            >
              {p.label}
            </button>
          )
        })}
        <span style={{ marginLeft: 'auto', fontSize: 11, color: '#999', whiteSpace: 'nowrap' }}>
          {modelo.rango.label}
        </span>
      </div>

      {/* ── Contenido */}
      <div style={{ paddingTop: 16 }}>
        {datos.dias.length === 0 ? (
          <div style={{ padding: '48px 24px', textAlign: 'center', fontSize: 13, color: '#999' }}>
            No hay órdenes en {tema.titulo.toLowerCase()} para {modelo.rango.label.toLowerCase()}.
          </div>
        ) : (
          datos.dias.map(dia => (
            <SeccionDia
              key={dia.fecha}
              dia={dia}
              tema={tema}
              conPuestos={etapaActiva === 'fabricacion'}
              esSoldadura={etapaActiva === 'soldadura'}
              permiteDarAlta={permiteDarAlta}
              confirmando={confirmando}
              onConfirmar={onConfirmar}
              dandoAlta={dandoAlta}
              onDarAlta={onDarAlta}
            />
          ))
        )}
      </div>

      {/* ── Piezas sin clasificar en este tab (solo lectura) */}
      <PanelSinClasificar items={datos.sinClasificar} />
    </div>
  )
}

// ─────────────────────────────────────────────────────────
function TabEtapa ({ etapa, activa, datos, onClick }: {
  etapa: Etapa
  activa: boolean
  datos: DatosEtapa
  onClick: () => void
}) {
  const t = TEMAS[etapa]
  return (
    <button
      onClick={onClick}
      role='tab'
      aria-selected={activa}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 7,
        padding: '9px 16px', marginBottom: -2, flexShrink: 0,
        background: activa ? t.bg : '#fff',
        color: t.text,
        opacity: activa ? 1 : 0.55,
        border: 'none',
        borderBottom: `2px solid ${activa ? t.accent : 'transparent'}`,
        borderRadius: '8px 8px 0 0',
        cursor: 'pointer', fontSize: 13, fontWeight: 600,
        transition: 'all 0.15s', whiteSpace: 'nowrap',
      }}
    >
      <span style={{ fontSize: 12 }}>{t.icono}</span>
      {t.titulo}
      <span style={{
        fontSize: 10, fontWeight: 700, minWidth: 18, textAlign: 'center',
        padding: '1px 6px', borderRadius: 10,
        background: activa
          ? (etapa === 'corte' ? t.accent : '#fff')
          : t.bg,
        color: activa
          ? (etapa === 'corte' ? '#fff' : t.text)
          : t.text,
      }}>
        {datos.ordenes}
      </span>
    </button>
  )
}

// ─────────────────────────────────────────────────────────
function SeccionDia ({ dia, tema, conPuestos, esSoldadura, permiteDarAlta, confirmando, onConfirmar, dandoAlta, onDarAlta }: {
  dia: GrupoDia
  tema: Tema
  conPuestos: boolean
  esSoldadura: boolean
  permiteDarAlta: boolean
  confirmando: string | null
  onConfirmar: (t: TarjetaOrden) => void
  dandoAlta: string | null
  onDarAlta: (t: TarjetaOrden) => void
}) {
  return (
    <div style={{ marginBottom: 20 }}>
      {/* Cabecera del día: etiqueta + línea + conteo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <span style={{
          fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
          letterSpacing: '0.5px', color: tema.accent, whiteSpace: 'nowrap',
        }}>
          {dia.label}
        </span>
        <span style={{ flex: 1, height: 1, background: tema.linea }} />
        <span style={{ fontSize: 10, color: tema.accent, whiteSpace: 'nowrap' }}>
          {dia.ordenes} {dia.ordenes === 1 ? 'orden' : 'órdenes'}
        </span>
      </div>

      {conPuestos ? (
        dia.puestos.map(gp => (
          <div key={gp.puesto} style={{ marginBottom: 12 }}>
            <div style={{
              fontSize: 10, fontWeight: 700, color: '#999',
              textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 6,
            }}>
              · {gp.puesto}
            </div>
            <GridTarjetas tarjetas={gp.tarjetas} tema={tema} esSoldadura={false} permiteDarAlta={permiteDarAlta} confirmando={confirmando} onConfirmar={onConfirmar} dandoAlta={dandoAlta} onDarAlta={onDarAlta} />
          </div>
        ))
      ) : (
        <GridTarjetas tarjetas={dia.tarjetas} tema={tema} esSoldadura={esSoldadura} permiteDarAlta={permiteDarAlta} confirmando={confirmando} onConfirmar={onConfirmar} dandoAlta={dandoAlta} onDarAlta={onDarAlta} />
      )}
    </div>
  )
}

function GridTarjetas ({ tarjetas, tema, esSoldadura, permiteDarAlta, confirmando, onConfirmar, dandoAlta, onDarAlta }: {
  tarjetas: TarjetaOrden[]
  tema: Tema
  esSoldadura: boolean
  permiteDarAlta: boolean
  confirmando: string | null
  onConfirmar: (t: TarjetaOrden) => void
  dandoAlta: string | null
  onDarAlta: (t: TarjetaOrden) => void
}) {
  return (
    <div className='orden-grid'>
      {tarjetas.map(t => (
        <Tarjeta key={t.key} t={t} tema={tema} esSoldadura={esSoldadura} permiteDarAlta={permiteDarAlta} confirmando={confirmando} onConfirmar={onConfirmar} dandoAlta={dandoAlta} onDarAlta={onDarAlta} />
      ))}
    </div>
  )
}

// ─────────────────────────────────────────────────────────
function nombrePieza (p: PiezaInfo): string {
  const base = p.matchKey ?? p.raw
  return p.accesorios.length ? `${base} + ${p.accesorios.join(' + ')}` : base
}

function SinClasificarBadge () {
  return (
    <span style={{
      fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 8,
      background: AMBAR_BG, color: AMBAR, whiteSpace: 'nowrap',
    }}>
      Sin clasificar
    </span>
  )
}

function ListaPiezas ({ piezas }: { piezas: PiezaInfo[] }) {
  return (
    <div style={{ fontSize: 12, fontWeight: 700, color: '#1A1A1A', lineHeight: 1.5 }}>
      <span style={{ fontWeight: 600, color: '#666', fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.3px' }}>
        Piezas ·{' '}
      </span>
      <span style={{ display: 'inline-flex', flexWrap: 'wrap', gap: '4px 6px', verticalAlign: 'middle' }}>
        {piezas.map((p, i) => (
          <Fragment key={i}>
            {i > 0 && <span style={{ color: '#CCC', fontWeight: 400 }}>·</span>}
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              {nombrePieza(p)}
              {!p.matchKey && <SinClasificarBadge />}
            </span>
          </Fragment>
        ))}
      </span>
    </div>
  )
}

function Tarjeta ({ t, tema, esSoldadura, permiteDarAlta, confirmando, onConfirmar, dandoAlta, onDarAlta }: {
  t: TarjetaOrden
  tema: Tema
  esSoldadura: boolean
  permiteDarAlta: boolean
  confirmando: string | null
  onConfirmar: (t: TarjetaOrden) => void
  dandoAlta: string | null
  onDarAlta: (t: TarjetaOrden) => void
}) {
  const enCurso = confirmando === t.orden
  const enAlta = dandoAlta === t.orden
  const agrupada = t.piezas.length > 1
  const pieza0 = t.piezas[0]
  const muestraConfirmar = t.alerta && !esSoldadura && !t.esEncargado
  const muestraDarAlta = !esSoldadura && !!t.orden && permiteDarAlta && !t.esEncargado

  return (
    <div style={{
      background: '#fff',
      border: `0.5px solid ${tema.linea}`,
      borderLeft: `3px solid ${t.alerta ? ROJO : tema.accent}`,
      borderRadius: 8,
      padding: '10px 12px',
    }}>
      {/* 1. Alerta */}
      {t.alerta && (
        <div style={{ fontSize: 10, fontWeight: 600, color: ROJO, marginBottom: 4 }}>
          ⚠ {t.dias} días sin confirmar
        </div>
      )}

      {/* 2. Orden + título (agrupado: cabecera con orden+vehículo; simple: orden+pieza) */}
      {agrupada ? (
        <>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#1A1A1A', lineHeight: 1.35 }}>
            {t.orden ? `#${t.orden}` : ''}{t.vehiculo ? ` — ${t.vehiculo}` : ''}
          </div>
          <div style={{ marginTop: 4 }}>
            <ListaPiezas piezas={t.piezas} />
          </div>
        </>
      ) : (
        <div style={{ fontSize: 12, fontWeight: 700, color: '#1A1A1A', lineHeight: 1.35, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <span>{t.orden ? `#${t.orden} · ` : ''}{nombrePieza(pieza0)}</span>
          {!pieza0.matchKey && <SinClasificarBadge />}
        </div>
      )}

      {/* 3. Metadatos */}
      <div style={{ fontSize: 11, color: '#666', marginTop: 6, lineHeight: 1.6 }}>
        <div>Fecha · {formatoFecha(t.fecha)}</div>
        <div>Puesto · {t.puestoLabel}</div>
        {t.alegra && (
          <>
            <div>{t.cliente || '—'} · {t.vehiculo || '—'}</div>
            <div>Factura · {t.alegra.factura}</div>
          </>
        )}
      </div>

      {/* 4. Estado de pago */}
      {t.alegra && (
        <div style={{ marginTop: 6 }}>
          {t.alegra.pagada ? (
            <span style={{
              fontSize: 10, padding: '2px 8px', borderRadius: 10,
              background: '#EAF3DE', color: '#3B6D11', fontWeight: 600,
            }}>
              ✓ Pagada
            </span>
          ) : (
            <span style={{
              fontSize: 10, padding: '2px 8px', borderRadius: 10,
              background: '#FDECEA', color: ROJO, fontWeight: 600,
            }}>
              Pendiente
            </span>
          )}
        </div>
      )}

      {/* 5. Info de precio (solo en Soldadura) */}
      {esSoldadura && (
        <div style={{
          marginTop: 8, padding: '6px 10px', borderRadius: 6,
          background: '#E8F5F0', border: '0.5px solid #A8D9C8',
        }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: VERDE_SOLDADURA }}>
            ⚡ En Soldadura
          </div>
          {t.precio != null && (
            <div style={{ fontSize: 12, fontWeight: 700, color: '#1A1A1A', marginTop: 2 }}>
              RD$ {new Intl.NumberFormat('es-DO', { maximumFractionDigits: 0 }).format(t.precio)}
              <span style={{ fontSize: 10, fontWeight: 400, color: '#666', marginLeft: 6 }}>
                {t.modoDoblado === 'other_bent' ? '· Me lo doblaron' : '· Doblé yo'}
              </span>
            </div>
          )}
          {t.precio == null && (
            <div style={{ fontSize: 11, color: '#999', marginTop: 2 }}>— sin precio en tarifario</div>
          )}
        </div>
      )}

      {/* 6. Encargado: solo informativo, sin botones de acción */}
      {t.esEncargado && !esSoldadura && (
        <div style={{ marginTop: 8, fontSize: 10, color: '#999', fontStyle: 'italic' }}>
          Entrada de supervisión — sin acciones
        </div>
      )}

      {/* 7. Confirmar salida → auto-envía a Soldadura */}
      {muestraConfirmar && (
        <button
          type='button'
          onClick={() => onConfirmar(t)}
          disabled={enCurso}
          style={{
            marginTop: 6, width: '100%', padding: '5px 8px',
            background: ROJO, color: '#fff', border: 'none', borderRadius: 5,
            fontSize: 10, fontWeight: 600, cursor: enCurso ? 'default' : 'pointer',
            opacity: enCurso ? 0.6 : 1,
          }}
        >
          {enCurso ? 'Confirmando…' : 'Confirmar salida'}
        </button>
      )}

      {/* 8. Dar de Alta → mover a Soldadura (solo Fabricación, no Encargado) */}
      {muestraDarAlta && (
        <button
          type='button'
          onClick={() => onDarAlta(t)}
          disabled={enAlta}
          style={{
            marginTop: 6, width: '100%', padding: '5px 8px',
            background: VERDE_SOLDADURA, color: '#fff', border: 'none', borderRadius: 5,
            fontSize: 10, fontWeight: 600, cursor: enAlta ? 'default' : 'pointer',
            opacity: enAlta ? 0.6 : 1,
          }}
        >
          {enAlta ? 'Confirmando…' : '⚡ Confirmar ticket'}
        </button>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────
function PanelSinClasificar ({ items }: { items: SinClasificarItem[] }) {
  if (items.length === 0) return null
  return (
    <details style={{ marginTop: 24 }}>
      <summary style={{
        cursor: 'pointer', fontSize: 12, fontWeight: 600, color: AMBAR,
        padding: '8px 4px', userSelect: 'none',
      }}>
        ⚠ Piezas sin clasificar en este tab ({items.length})
      </summary>
      <div style={{
        marginTop: 8, background: '#F7F7F7', border: '0.5px solid #ECECEC',
        borderRadius: 8, padding: '12px 14px', maxHeight: 260, overflowY: 'auto',
      }}>
        {items.map((it, i) => (
          <div
            key={i}
            style={{
              fontSize: 11, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
              color: '#555', lineHeight: 1.7, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
            }}
          >
            · &quot;{it.texto}&quot;{it.orden ? ` — orden #${it.orden}` : ' — sin orden'}
          </div>
        ))}
      </div>
    </details>
  )
}

// ─────────────────────────────────────────────────────────
function formatoFecha (fechaISO: string): string {
  const [, m, d] = fechaISO.split('-')
  return `${d}/${m}`
}
