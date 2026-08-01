'use client'
// ─────────────────────────────────────────────────────────
// Tablero híbrido de producción: 3 columnas por etapa
// (Corte · Doblado · Fabricación) y, dentro de cada columna,
// las órdenes agrupadas por día como las muestra Google Calendar.
// Solo presentación: el modelo llega ya construido desde etapas.ts.
// ─────────────────────────────────────────────────────────
import { useEffect, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { formatoCorto } from '@/lib/ordenes-core'
import type { ColumnaEtapa, Etapa, GrupoDia, TarjetaOrden } from './etapas'

const ROJO = '#E8180A'

interface Tema {
  titulo: string
  icono: string | null
  subtitulo: string | null
  headerBg: string
  headerText: string
  headerBorder: string
  diaBg: string
  cardBorder: string
  accent: string
}

const TEMAS: Record<Etapa, Tema> = {
  corte: {
    titulo: 'Corte',
    icono: '✂',
    subtitulo: null,
    headerBg: '#FAEEDA',
    headerText: '#633806',
    headerBorder: '#F0D9A0',
    diaBg: '#fff8f0',
    cardBorder: '#F0D9A0',
    accent: '#D19A2E',
  },
  doblado: {
    titulo: 'Doblado',
    icono: null,
    subtitulo: 'David',
    headerBg: '#E6F1FB',
    headerText: '#0C447C',
    headerBorder: '#B8D4F0',
    diaBg: '#f0f6fd',
    cardBorder: '#B8D4F0',
    accent: '#3B82C4',
  },
  fabricacion: {
    titulo: 'Fabricación',
    icono: '🔧',
    subtitulo: null,
    headerBg: '#EAF3DE',
    headerText: '#3B6D11',
    headerBorder: '#C4DFA0',
    diaBg: '#f4faf0',
    cardBorder: '#C4DFA0',
    accent: '#7BAE3E',
  },
}

interface Props {
  columnas: ColumnaEtapa[]
  confirmando: string | null
  onConfirmar: (tarjeta: TarjetaOrden) => void
}

export default function EtapasBoard ({ columnas, confirmando, onConfirmar }: Props) {
  const esMovil = useEsMovil()
  const [colapsadas, setColapsadas] = useState<Set<Etapa>>(new Set())

  function toggle (etapa: Etapa) {
    setColapsadas(prev => {
      const next = new Set(prev)
      if (next.has(etapa)) next.delete(etapa)
      else next.add(etapa)
      return next
    })
  }

  return (
    <div className='etapas-board'>
      {columnas.map(col => (
        <Columna
          key={col.etapa}
          columna={col}
          esMovil={esMovil}
          colapsada={esMovil && colapsadas.has(col.etapa)}
          onToggle={() => toggle(col.etapa)}
          confirmando={confirmando}
          onConfirmar={onConfirmar}
        />
      ))}
    </div>
  )
}

// ─────────────────────────────────────────────────────────
function Columna ({ columna, esMovil, colapsada, onToggle, confirmando, onConfirmar }: {
  columna: ColumnaEtapa
  esMovil: boolean
  colapsada: boolean
  onToggle: () => void
  confirmando: string | null
  onConfirmar: (tarjeta: TarjetaOrden) => void
}) {
  const tema = TEMAS[columna.etapa]

  return (
    <section
      className={`etapa-col etapa-col--${columna.etapa}`}
      style={{
        border: '1px solid var(--border)',
        borderRadius: 10,
        background: '#fff',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        minWidth: 0,
      }}
    >
      {/* Cabecera de columna */}
      <button
        type='button'
        onClick={esMovil ? onToggle : undefined}
        aria-expanded={esMovil ? !colapsada : undefined}
        style={{
          display: 'flex', alignItems: 'center', gap: 8, width: '100%',
          padding: '10px 12px', border: 'none',
          borderBottom: `1px solid ${tema.headerBorder}`,
          background: tema.headerBg, color: tema.headerText,
          cursor: esMovil ? 'pointer' : 'default', textAlign: 'left',
          font: 'inherit',
        }}
      >
        {tema.icono && <span style={{ fontSize: 13, lineHeight: 1 }}>{tema.icono}</span>}
        <span style={{ fontSize: 12.5, fontWeight: 700, letterSpacing: '-0.005em' }}>
          {tema.titulo}
        </span>
        {tema.subtitulo && (
          <span style={{ fontSize: 11, fontWeight: 500, opacity: 0.7 }}>· {tema.subtitulo}</span>
        )}
        <span style={{
          marginLeft: 'auto', fontSize: 10.5, fontWeight: 700,
          padding: '1px 7px', borderRadius: 9999,
          background: 'rgba(255,255,255,0.65)', color: tema.headerText,
        }}>
          {columna.ordenes}
        </span>
        {esMovil && (
          <ChevronDown
            size={14}
            style={{ transform: colapsada ? 'rotate(-90deg)' : 'none', transition: 'transform 0.15s' }}
          />
        )}
      </button>

      {!colapsada && (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {columna.dias.length === 0 ? (
            <div style={{ padding: '22px 12px', textAlign: 'center', fontSize: 11.5, color: 'var(--gray-400)' }}>
              Sin órdenes
            </div>
          ) : (
            columna.dias.map(dia => (
              <Dia
                key={dia.fecha}
                dia={dia}
                tema={tema}
                conPuestos={columna.etapa === 'fabricacion'}
                confirmando={confirmando}
                onConfirmar={onConfirmar}
              />
            ))
          )}
        </div>
      )}
    </section>
  )
}

// ─────────────────────────────────────────────────────────
function Dia ({ dia, tema, conPuestos, confirmando, onConfirmar }: {
  dia: GrupoDia
  tema: Tema
  conPuestos: boolean
  confirmando: string | null
  onConfirmar: (tarjeta: TarjetaOrden) => void
}) {
  return (
    <div>
      {/* Banda del día */}
      <div style={{
        padding: '5px 12px',
        background: dia.esHoy ? tema.diaBg : '#fafafa',
        color: dia.esHoy ? tema.headerText : '#999',
        borderTop: '1px solid var(--border-subtle, #f0f0f0)',
        borderBottom: '1px solid var(--border-subtle, #f0f0f0)',
        fontSize: 10, fontWeight: 700,
        textTransform: 'uppercase', letterSpacing: '0.4px',
      }}>
        {dia.label}
      </div>

      <div style={{ padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 7 }}>
        {conPuestos
          ? dia.puestos.map(gp => (
            <div key={gp.puesto} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{
                fontSize: 10, fontWeight: 700, color: '#999',
                textTransform: 'uppercase', letterSpacing: '0.4px', marginTop: 2,
              }}>
                · {gp.puesto}
              </div>
              {gp.tarjetas.map(t => (
                <Tarjeta key={t.key} t={t} tema={tema} confirmando={confirmando} onConfirmar={onConfirmar} />
              ))}
            </div>
          ))
          : dia.tarjetas.map(t => (
            <Tarjeta key={t.key} t={t} tema={tema} confirmando={confirmando} onConfirmar={onConfirmar} />
          ))}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────
function Tarjeta ({ t, tema, confirmando, onConfirmar }: {
  t: TarjetaOrden
  tema: Tema
  confirmando: string | null
  onConfirmar: (tarjeta: TarjetaOrden) => void
}) {
  const enCurso = confirmando === t.orden
  const meta = [t.vehiculo, t.cliente ?? t.puesto, t.compromiso ? formatoCorto(t.compromiso) : null]
    .filter(Boolean)
    .join(' · ')

  return (
    <div style={{
      background: '#fff',
      border: `0.5px solid ${tema.cardBorder}`,
      borderLeft: `3px solid ${t.alerta ? ROJO : tema.accent}`,
      borderRadius: 7,
      padding: '8px 10px',
    }}>
      {t.alerta && (
        <div style={{ fontSize: 10, fontWeight: 700, color: ROJO, marginBottom: 3 }}>
          ⚠ {t.dias} días
        </div>
      )}

      <div style={{ fontSize: 12, color: 'var(--gray-700, #444)', lineHeight: 1.35 }}>
        <span style={{ fontWeight: 700, color: '#1A1A1A' }}>{t.orden}</span>
        {t.pieza && <> · {t.pieza}</>}
      </div>

      {meta && (
        <div style={{ fontSize: 11, color: '#666', marginTop: 2, lineHeight: 1.35 }}>
          {meta}
        </div>
      )}

      {t.alerta && (
        <button
          type='button'
          onClick={() => onConfirmar(t)}
          disabled={enCurso}
          style={{
            marginTop: 7, width: '100%', padding: '5px 8px',
            background: ROJO, color: '#fff', border: 'none', borderRadius: 5,
            fontSize: 10, fontWeight: 700, cursor: enCurso ? 'default' : 'pointer',
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
function useEsMovil (): boolean {
  const [esMovil, setEsMovil] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)')
    const sync = () => setEsMovil(mq.matches)
    sync()
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [])
  return esMovil
}
