'use client'
import { useState } from 'react'
import { saveTicket, PIEZAS_OPTIONS, type AppUser } from '@/lib/store'
import { TextInput, CheckboxGroup, FormHeader, SuccessMessage } from './FormBase'

interface Props { user: AppUser; onSuccess: () => void }

const EMPTY = { numero_factura: '', numero_orden: '', fecha_entrega: '', modelo: '', tipo_modelo: '', color: '', requerimiento: '' }

export default function FormMarquilla({ user }: Props) {
  const [form, setForm] = useState(EMPTY)
  const [piezas, setPiezas] = useState<string[]>([])
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)

  function set(key: string) { return (v: string) => setForm(f => ({ ...f, [key]: v })) }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.numero_factura || !form.modelo || piezas.length === 0) { alert('Completa los campos requeridos.'); return }
    setLoading(true)
    try {
      await saveTicket('marquilla', { ...form, piezas, user_id: user.id, user_name: user.name })
      setSubmitted(true)
    } catch (err) {
      alert('No se pudo guardar el ticket: ' + (err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  if (submitted) return (
    <div>
      <FormHeader title="Marquilla" subtitle="Registro de pago y monitoreo de piezas" role={user.role} />
      <SuccessMessage onNew={() => { setSubmitted(false); setForm(EMPTY); setPiezas([]) }} />
    </div>
  )

  return (
    <div style={{ animation: 'fadeInUp 0.4s ease', width: '100%' }}>
      <FormHeader title="Marquilla" subtitle="Registro de pago y monitoreo de piezas" role={user.role} />
      <form onSubmit={handleSubmit}>
        <div className="card-dark" style={{ padding: '28px', marginBottom: '20px' }}>
          <h3 style={{ fontFamily: 'Rajdhani', fontSize: '11px', fontWeight: 700, letterSpacing: '1.5px', color: '#E8180A', textTransform: 'uppercase' as const, marginBottom: '20px' }}>INFORMACION DE ORDEN</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <TextInput label="Numero de Factura" value={form.numero_factura} onChange={set('numero_factura')} placeholder="F-2025-001" required />
            <TextInput label="Numero de Orden" value={form.numero_orden} onChange={set('numero_orden')} placeholder="ORD-001" required />
            <TextInput label="Fecha de Entrega" value={form.fecha_entrega} onChange={set('fecha_entrega')} type="date" required />
            <TextInput label="Modelo" value={form.modelo} onChange={set('modelo')} placeholder="Toyota Hilux" required />
            <TextInput label="Tipo de Modelo" value={form.tipo_modelo} onChange={set('tipo_modelo')} placeholder="2023, 4x4" />
            <TextInput label="Color" value={form.color} onChange={set('color')} placeholder="Ej: Negro mate, Blanco perla" required />
          </div>
          <div style={{ marginTop: '16px' }}>
            <label className="label-field">Requerimiento <span style={{ color: '#E8180A' }}>*</span></label>
            <textarea
              className="input-dark"
              value={form.requerimiento}
              onChange={e => set('requerimiento')(e.target.value)}
              placeholder="Describe el requerimiento especial..."
              rows={4}
              style={{ resize: 'vertical' }}
            />
          </div>
        </div>

        <div className="card-dark" style={{ padding: '28px', marginBottom: '20px' }}>
          <h3 style={{ fontFamily: 'Rajdhani', fontSize: '11px', fontWeight: 700, letterSpacing: '1.5px', color: '#E8180A', textTransform: 'uppercase' as const, marginBottom: '20px' }}>PIEZAS</h3>
          <CheckboxGroup label="Selecciona las piezas" options={PIEZAS_OPTIONS} selected={piezas} onChange={setPiezas} required />
          {piezas.length > 0 && (
            <div style={{ marginTop: '12px', padding: '12px', background: 'rgba(232,24,10,0.05)', borderRadius: '6px', border: '1px solid rgba(232,24,10,0.2)' }}>
              <span style={{ fontSize: '12px', color: '#E8180A', fontWeight: 700 }}>{piezas.length} pieza(s): </span>
              <span style={{ fontSize: '12px', color: '#555555' }}>{piezas.join(', ')}</span>
            </div>
          )}
        </div>

        <button className="btn-red" type="submit" disabled={loading} style={{ width: '100%', fontSize: '16px' }}>
          {loading ? 'Guardando...' : 'GUARDAR MARQUILLA'}
        </button>
      </form>
    </div>
  )
}
