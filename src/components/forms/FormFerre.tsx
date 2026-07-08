'use client'
import { useState } from 'react'
import { saveTicket, PIEZAS_OPTIONS, type AppUser } from '@/lib/store'
import { RadioField, TextInput, CheckboxGroup, FormHeader, SuccessMessage } from './FormBase'

interface Props { user: AppUser; onSuccess: () => void }

const EMPTY = {
  numero_factura: '', numero_orden: '', a_cargo_de: '',
  fecha_entrega: '', modelo: '', tipo_modelo: '',
  re_trabajo: '', fecha_compromiso: '', grado_reparacion: '',
  piezas_custom: '',
}

export default function FormFerre({ user }: Props) {
  const [form, setForm] = useState(EMPTY)
  const [piezas, setPiezas] = useState<string[]>([])
  const [ordenes, setOrdenes] = useState<string[]>([''])
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)

  function set(key: string) { return (v: string) => setForm(f => ({ ...f, [key]: v })) }

  function addOrden() { setOrdenes(o => [...o, '']) }
  function removeOrden(i: number) { setOrdenes(o => o.filter((_, idx) => idx !== i)) }
  function setOrden(i: number, v: string) { setOrdenes(o => o.map((val, idx) => idx === i ? v : val)) }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.numero_factura || !form.modelo || piezas.length === 0) {
      alert('Completa los campos requeridos y selecciona al menos una pieza.'); return
    }
    if (form.re_trabajo === 'Si' && !form.grado_reparacion) {
      alert('Selecciona el grado de reparación.'); return
    }
    setLoading(true)
    try {
      const ordenesFiltradas = ordenes.map(o => o.trim()).filter(Boolean)
      await saveTicket('ferre', {
        ...form,
        piezas,
        ordenes: ordenesFiltradas,
        numero_orden: ordenesFiltradas[0] || '',
        user_id: user.id,
        user_name: user.name,
      })
      setSubmitted(true)
    } catch (err) {
      alert('No se pudo guardar el ticket: ' + (err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  if (submitted) return (
    <div>
      <FormHeader title="Ticket de Ferré (Preparación)" subtitle="Control de preparación de piezas" role={user.role} />
      <SuccessMessage onNew={() => { setSubmitted(false); setForm(EMPTY); setPiezas([]); setOrdenes(['']) }} />
    </div>
  )

  return (
    <div style={{ animation: 'fadeInUp 0.4s ease', width: '100%' }}>
      <FormHeader title="Ticket de Ferré (Preparación)" subtitle="Control de preparación de piezas" role={user.role} />
      <form onSubmit={handleSubmit}>
        <div className="card-dark" style={{ padding: '28px', marginBottom: '20px' }}>
          <h3 style={{ fontFamily: 'Rajdhani', fontSize: '11px', fontWeight: 700, letterSpacing: '1.5px', color: '#E8180A', textTransform: 'uppercase' as const, marginBottom: '20px' }}>INFORMACION DE ORDEN</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <TextInput label="Numero de Factura" value={form.numero_factura} onChange={set('numero_factura')} placeholder="F-2025-001" required />
            <div>
              <TextInput label="Numero de Orden" value={ordenes[0] || ''} onChange={v => setOrden(0, v)} placeholder="ORD-001" required />
              {ordenes.slice(1).map((o, i) => (
                <div key={i + 1} style={{ display: 'flex', gap: '8px', alignItems: 'flex-end', marginTop: '8px' }}>
                  <div style={{ flex: 1 }}>
                    <TextInput label={`Orden adicional ${i + 2}`} value={o} onChange={v => setOrden(i + 1, v)} placeholder="ORD-002" />
                  </div>
                  <button type="button" onClick={() => removeOrden(i + 1)} style={{
                    background: 'none', border: 'none', color: '#E8180A', cursor: 'pointer',
                    fontSize: '20px', padding: '0 4px 16px', lineHeight: 1,
                  }}>&times;</button>
                </div>
              ))}
              <button type="button" onClick={addOrden} style={{
                background: 'none', border: 'none', color: '#378ADD', cursor: 'pointer',
                fontFamily: 'Rajdhani', fontSize: '12px', fontWeight: 700, padding: '4px 0',
              }}>+ Agregar otra orden</button>
            </div>
            <TextInput label="A Cargo De" value={form.a_cargo_de} onChange={set('a_cargo_de')} placeholder="Nombre del responsable" required />
            <TextInput label="Fecha de Entrega" value={form.fecha_entrega} onChange={set('fecha_entrega')} type="date" />
            <TextInput label="Modelo" value={form.modelo} onChange={set('modelo')} placeholder="Toyota Hilux" required />
            <TextInput label="Tipo de Modelo" value={form.tipo_modelo} onChange={set('tipo_modelo')} placeholder="2023, 4x4" />
            <TextInput label="Fecha de Compromiso" value={form.fecha_compromiso} onChange={set('fecha_compromiso')} type="date" required />
          </div>
        </div>

        <div className="card-dark" style={{ padding: '28px', marginBottom: '20px' }}>
          <RadioField label="¿Es Re-Trabajo?" options={['Si', 'No']} value={form.re_trabajo} onChange={set('re_trabajo')} required />
          {form.re_trabajo === 'Si' && (
            <div style={{ marginTop: '12px', padding: '16px', background: 'rgba(232,24,10,0.03)', borderRadius: '6px', border: '1px solid rgba(232,24,10,0.1)' }}>
              <RadioField label="Grado de reparación" options={['Grado A', 'Grado B', 'Grado C']} value={form.grado_reparacion} onChange={set('grado_reparacion')} required />
            </div>
          )}
        </div>

        <div className="card-dark" style={{ padding: '28px', marginBottom: '20px' }}>
          <h3 style={{ fontFamily: 'Rajdhani', fontSize: '11px', fontWeight: 700, letterSpacing: '1.5px', color: '#E8180A', textTransform: 'uppercase' as const, marginBottom: '20px' }}>PIEZAS A PREPARAR</h3>
          <CheckboxGroup label="Selecciona las piezas" options={PIEZAS_OPTIONS} selected={piezas} onChange={setPiezas} required />
          {piezas.length > 0 && (
            <div style={{ marginTop: '12px', padding: '12px', background: 'rgba(232,24,10,0.05)', borderRadius: '6px', border: '1px solid rgba(232,24,10,0.2)' }}>
              <span style={{ fontSize: '12px', color: '#E8180A', fontWeight: 700 }}>{piezas.length} pieza(s) seleccionada(s): </span>
              <span style={{ fontSize: '12px', color: '#555555' }}>{piezas.join(', ')}</span>
            </div>
          )}
          <div style={{ marginTop: '16px' }}>
            <label className="label-field">Otras piezas (si no está en la lista)</label>
            <input
              className="input-dark"
              type="text"
              value={form.piezas_custom}
              onChange={e => set('piezas_custom')(e.target.value)}
              placeholder="Ej: Soporte lateral, refuerzo central"
            />
          </div>
        </div>

        <button className="btn-red" type="submit" disabled={loading} style={{ width: '100%', fontSize: '16px' }}>
          {loading ? 'Guardando...' : 'GUARDAR TICKET DE FERRÉ'}
        </button>
      </form>
    </div>
  )
}
