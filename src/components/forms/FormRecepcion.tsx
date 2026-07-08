'use client'
import { useState } from 'react'
import { saveTicket, type AppUser } from '@/lib/store'
import { RadioField, PhotoField, TextInput, FormHeader, SuccessMessage } from './FormBase'

interface Props { user: AppUser; onSuccess: () => void }

export default function FormRecepcion({ user, onSuccess }: Props) {
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)

  const [form, setForm] = useState({
    numero_factura: '',
    numero_orden: '',
    fecha: '',
    entregado_por: '',
    modelo: '',
    tipo_modelo: '',
    micas_rotas: '',
    cristales_rotos: '',
    pertenencias_personales: '',
    rayaduras: '',
  })

  // Holds uploaded public URLs per field (PhotoField uploads to Storage on select).
  const [photos, setPhotos] = useState<Record<string, string[]>>({
    micas_rotas_fotos: [],
    cristales_rotos_fotos: [],
    pertenencias_fotos: [],
    rayaduras_fotos: [],
  })

  // Per-field upload status, so we can block submit while photos are pending/failed.
  const [photoStatus, setPhotoStatus] = useState<Record<string, { uploading: number; error: number }>>({})
  const photosUploading = Object.values(photoStatus).reduce((n, s) => n + s.uploading, 0)
  const photosFailed = Object.values(photoStatus).reduce((n, s) => n + s.error, 0)
  const submitBlocked = photosUploading > 0 || photosFailed > 0

  function set(key: string) { return (v: string) => setForm(f => ({ ...f, [key]: v })) }
  function photoStatusFor(field: string) {
    return (s: { uploading: number; error: number }) => setPhotoStatus(p => ({ ...p, [field]: s }))
  }

  function clearPhotoField(field: string) {
    setPhotos(p => ({ ...p, [field]: [] }))
    setPhotoStatus(p => {
      const next = { ...p }
      delete next[field]
      return next
    })
  }

  // Radio setter for fields that reveal a photo section: when the answer changes
  // away from `showValue`, the section is hidden — so clear its photos + status
  // so a lingering pending/failed upload can't block submission.
  function setRadioWithPhoto(formKey: string, photoField: string, showValue: string) {
    return (v: string) => {
      setForm(f => ({ ...f, [formKey]: v }))
      if (v !== showValue) clearPhotoField(photoField)
    }
  }

  function resetPhotos() {
    setPhotos({ micas_rotas_fotos: [], cristales_rotos_fotos: [], pertenencias_fotos: [], rayaduras_fotos: [] })
    setPhotoStatus({})
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.numero_factura || !form.numero_orden || !form.entregado_por || !form.modelo) {
      alert('Por favor completa los campos requeridos.')
      return
    }
    if (photosUploading > 0) {
      alert('Espera a que terminen de subir las fotos.')
      return
    }
    if (photosFailed > 0) {
      alert('Hay fotos que no se subieron. Reintenta o elimínalas antes de guardar.')
      return
    }
    setLoading(true)
    try {
      await saveTicket('recepcion', {
        ...form,
        user_id: user.id,
        user_name: user.name,
        fotos: photos, // already the uploaded public URLs, keyed by field
      })
      setSubmitted(true)
    } catch (err) {
      alert('No se pudo guardar el ticket: ' + (err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  if (submitted) {
    return (
      <div>
        <FormHeader title="Ticket de Recepcion" subtitle="Registro de recepcion de vehiculo" role={user.role} />
        <SuccessMessage onNew={() => { setSubmitted(false); setForm({ numero_factura: '', numero_orden: '', fecha: '', entregado_por: '', modelo: '', tipo_modelo: '', micas_rotas: '', cristales_rotos: '', pertenencias_personales: '', rayaduras: '' }); resetPhotos() }} />
      </div>
    )
  }

  return (
    <div style={{ animation: 'fadeInUp 0.4s ease', width: '100%' }}>
      <FormHeader title="Ticket de Recepcion" subtitle="Registro de recepcion de vehiculo" role={user.role} />

      <form onSubmit={handleSubmit}>
        <div className="card-dark" style={{ padding: '28px', marginBottom: '20px' }}>
          <h3 style={{ fontFamily: 'Rajdhani', fontSize: '11px', fontWeight: 700, letterSpacing: '1.5px', color: '#E8180A', textTransform: 'uppercase' as const, marginBottom: '20px' }}>INFORMACION BASICA</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <TextInput label="Numero de Factura" value={form.numero_factura} onChange={set('numero_factura')} placeholder="Ej: F-2025-001" required />
            <div>
              <TextInput label="Numero de Orden" value={form.numero_orden} onChange={set('numero_orden')} placeholder="Ej: ORD-001" required />
              <p style={{ fontSize: '11px', color: '#999999', marginTop: '2px' }}>Al integrar con Alegra, los datos del vehículo se traerán automáticamente desde la orden</p>
            </div>
            <TextInput label="Fecha" value={form.fecha} onChange={set('fecha')} type="date" />
            <TextInput label="Entregado Por" value={form.entregado_por} onChange={set('entregado_por')} placeholder="Nombre del cliente" required />
          </div>
        </div>

        <div className="card-dark" style={{ padding: '28px', marginBottom: '20px' }}>
          <h3 style={{ fontFamily: 'Rajdhani', fontSize: '11px', fontWeight: 700, letterSpacing: '1.5px', color: '#E8180A', textTransform: 'uppercase' as const, marginBottom: '20px' }}>DATOS DEL VEHICULO</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
            <TextInput label="Modelo" value={form.modelo} onChange={set('modelo')} placeholder="Ej: Toyota Hilux" required />
            <TextInput label="Tipo de Modelo" value={form.tipo_modelo} onChange={set('tipo_modelo')} placeholder="Ej: 2023, 4x4" />
          </div>
        </div>

        <div className="card-dark" style={{ padding: '28px', marginBottom: '20px' }}>
          <h3 style={{ fontFamily: 'Rajdhani', fontSize: '11px', fontWeight: 700, letterSpacing: '1.5px', color: '#E8180A', textTransform: 'uppercase' as const, marginBottom: '20px' }}>INSPECCION DEL VEHICULO</h3>

          <RadioField label="Micas Rotas" options={['Si', 'NO']} value={form.micas_rotas} onChange={setRadioWithPhoto('micas_rotas', 'micas_rotas_fotos', 'Si')} required />
          {form.micas_rotas === 'Si' && <PhotoField label="Fotos de micas rotas" fieldName="micas_rotas_fotos" photos={photos.micas_rotas_fotos} onChange={f => setPhotos(p => ({ ...p, micas_rotas_fotos: f }))} onStatusChange={photoStatusFor('micas_rotas_fotos')} />}

          <div style={{ height: '20px' }} />
          <RadioField label="Cristales Rotos" options={['Si', 'No']} value={form.cristales_rotos} onChange={setRadioWithPhoto('cristales_rotos', 'cristales_rotos_fotos', 'Si')} required />
          {form.cristales_rotos === 'Si' && <PhotoField label="Fotos de cristales rotos" fieldName="cristales_rotos_fotos" photos={photos.cristales_rotos_fotos} onChange={f => setPhotos(p => ({ ...p, cristales_rotos_fotos: f }))} onStatusChange={photoStatusFor('cristales_rotos_fotos')} />}

          <div style={{ height: '20px' }} />
          <RadioField label="Tiene pertenencias personales?" options={['Si', 'no']} value={form.pertenencias_personales} onChange={setRadioWithPhoto('pertenencias_personales', 'pertenencias_fotos', 'Si')} required />
          {form.pertenencias_personales === 'Si' && <PhotoField label="Foto mostrando que no quedan pertenencias" fieldName="pertenencias_fotos" photos={photos.pertenencias_fotos} onChange={f => setPhotos(p => ({ ...p, pertenencias_fotos: f }))} onStatusChange={photoStatusFor('pertenencias_fotos')} />}

          <div style={{ height: '20px' }} />
          <RadioField label="Rayaduras en la Pintura" options={['Si', 'No']} value={form.rayaduras} onChange={setRadioWithPhoto('rayaduras', 'rayaduras_fotos', 'Si')} required />
          {form.rayaduras === 'Si' && <PhotoField label="Fotos de rayaduras" fieldName="rayaduras_fotos" photos={photos.rayaduras_fotos} onChange={f => setPhotos(p => ({ ...p, rayaduras_fotos: f }))} onStatusChange={photoStatusFor('rayaduras_fotos')} />}
        </div>

        {submitBlocked && (
          <div style={{
            background: '#FFF0EF', border: '1px solid rgba(232,24,10,0.25)', borderRadius: '8px',
            padding: '12px 16px', marginBottom: '12px', fontSize: '13px', color: '#E8180A', fontWeight: 600,
          }}>
            {photosUploading > 0
              ? 'Espera a que terminen de subir las fotos.'
              : 'Hay fotos que no se subieron. Reintenta o elimínalas antes de guardar.'}
          </div>
        )}
        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            className="btn-red"
            type="submit"
            disabled={loading || submitBlocked}
            style={{ flex: 1, fontSize: '16px', letterSpacing: '1px', opacity: (loading || submitBlocked) ? 0.6 : 1 }}
          >
            {loading
              ? 'Guardando...'
              : photosUploading > 0
                ? 'Subiendo fotos…'
                : photosFailed > 0
                  ? 'Corrige las fotos'
                  : 'GUARDAR TICKET DE RECEPCION'}
          </button>
        </div>
      </form>
    </div>
  )
}
