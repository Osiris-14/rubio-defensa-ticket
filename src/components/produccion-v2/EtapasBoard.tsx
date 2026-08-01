'use client'
// ─────────────────────────────────────────────────────────
// Vista Producción: pestañas por etapa (Corte · Doblado · Fabricación),
// filtro Día/Semana/Mes y órdenes agrupadas por día.
// Solo presentación: el modelo llega construido desde etapas.ts.
// ─────────────────────────────────────────────────────────
import type {
  DatosEtapa, Etapa, GrupoDia, ModeloProduccion, Periodo, TarjetaOrden,
} from './etapas'
import { ETAPAS } from './etapas'

const ROJO = '#E8180A'

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
}

export default function EtapasBoard ({
  modelo, etapaActiva, onEtapa, periodo, onPeriodo, confirmando, onConfirmar,
}: Props) {
  const tema = TEMAS[etapaActiva]
  const datos = modelo.etapas[etapaActiva]

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
              confirmando={confirmando}
              onConfirmar={onConfirmar}
            />
          ))
        )}
      </div>
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
function SeccionDia ({ dia, tema, conPuestos, confirmando, onConfirmar }: {
  dia: GrupoDia
  tema: Tema
  conPuestos: boolean
  confirmando: string | null
  onConfirmar: (t: TarjetaOrden) => void
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
            <GridTarjetas tarjetas={gp.tarjetas} tema={tema} confirmando={confirmando} onConfirmar={onConfirmar} />
          </div>
        ))
      ) : (
        <GridTarjetas tarjetas={dia.tarjetas} tema={tema} confirmando={confirmando} onConfirmar={onConfirmar} />
      )}
    </div>
  )
}

function GridTarjetas ({ tarjetas, tema, confirmando, onConfirmar }: {
  tarjetas: TarjetaOrden[]
  tema: Tema
  confirmando: string | null
  onConfirmar: (t: TarjetaOrden) => void
}) {
  return (
    <div className='orden-grid'>
      {tarjetas.map(t => (
        <Tarjeta key={t.key} t={t} tema={tema} confirmando={confirmando} onConfirmar={onConfirmar} />
      ))}
    </div>
  )
}

// ─────────────────────────────────────────────────────────
function Tarjeta ({ t, tema, confirmando, onConfirmar }: {
  t: TarjetaOrden
  tema: Tema
  confirmando: string | null
  onConfirmar: (t: TarjetaOrden) => void
}) {
  const enCurso = confirmando === t.orden
  const info = [t.vehiculo, t.cliente, t.compromiso ? formatoCorto(t.compromiso) : null]
    .filter(Boolean)
    .join(' · ')

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

      {/* 2. Orden + pieza — un evento de calendario = una orden */}
      <div style={{ fontSize: 12, fontWeight: 600, color: '#1A1A1A', lineHeight: 1.35 }}>
        #{t.orden}{t.pieza ? ` · ${t.pieza}` : ''}
      </div>

      {/* 3. Info */}
      {info && (
        <div style={{ fontSize: 11, color: '#666', marginTop: 5, lineHeight: 1.35 }}>
          {info}
        </div>
      )}

      {/* 5. Estado de pago — se omite si no hay match en Alegra */}
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
              Pendiente · {formatoMoneda(t.alegra.saldo)}
            </span>
          )}
        </div>
      )}

      {/* 6. Confirmar salida — solo en alertas */}
      {t.alerta && (
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
    </div>
  )
}

// ─────────────────────────────────────────────────────────
function formatoCorto (fechaISO: string): string {
  const [, m, d] = fechaISO.split('-')
  return `${d}/${m}`
}

function formatoMoneda (n: number): string {
  return `RD$ ${new Intl.NumberFormat('es-DO', { maximumFractionDigits: 0 }).format(Math.round(n))}`
}
