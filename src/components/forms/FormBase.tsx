'use client'
import { useRef, useState } from 'react'
import { ROLE_LABELS, type UserRole } from '@/lib/store'
import { AREA_THEME } from '@/lib/areaTheme'
import { supabase } from '@/lib/supabase'

const BUCKET = 'ticket-fotos'

interface PhotoFieldProps {
  label: string
  fieldName: string
  /** Uploaded public URLs (lifted to the parent form). */
  photos: string[]
  onChange: (urls: string[]) => void
  /** Reports in-flight / failed counts so the parent can block submission. */
  onStatusChange?: (status: { uploading: number; error: number }) => void
  /** Storage folder prefix; defaults to the recepción area. */
  folder?: string
}

type UploadItem = {
  id: string
  name: string
  preview: string
  isImage: boolean
  status: 'uploading' | 'done' | 'error'
  url?: string
  error?: string
  file: File
}

export function PhotoField({ label, fieldName, onChange, onStatusChange, folder = 'recepcion' }: PhotoFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [items, setItems] = useState<UploadItem[]>([])

  // Report the successfully uploaded URLs + in-flight/failed counts to the parent.
  function syncUp(list: UploadItem[]) {
    onChange(list.filter(i => i.status === 'done' && i.url).map(i => i.url as string))
    onStatusChange?.({
      uploading: list.filter(i => i.status === 'uploading').length,
      error: list.filter(i => i.status === 'error').length,
    })
  }

  function patchItem(id: string, patch: Partial<UploadItem>) {
    setItems(prev => {
      const next = prev.map(i => (i.id === id ? { ...i, ...patch } : i))
      syncUp(next)
      return next
    })
  }

  async function uploadOne(item: UploadItem) {
    patchItem(item.id, { status: 'uploading', error: undefined })
    const safeName = item.file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
    const path = `${folder}/${fieldName}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safeName}`
    const { error } = await supabase.storage.from(BUCKET).upload(path, item.file, {
      cacheControl: '3600',
      upsert: false,
      contentType: item.file.type || undefined,
    })
    if (error) {
      patchItem(item.id, { status: 'error', error: error.message })
      return
    }
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
    patchItem(item.id, { status: 'done', url: data.publicUrl })
  }

  function handleFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return
    const newItems: UploadItem[] = files.map(f => ({
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      name: f.name,
      preview: URL.createObjectURL(f),
      isImage: f.type.startsWith('image/'),
      status: 'uploading',
      file: f,
    }))
    setItems(prev => [...prev, ...newItems])
    newItems.forEach(uploadOne)
    e.target.value = '' // allow re-selecting the same file
  }

  function removeItem(id: string) {
    setItems(prev => {
      const target = prev.find(i => i.id === id)
      if (target) URL.revokeObjectURL(target.preview)
      const next = prev.filter(i => i.id !== id)
      syncUp(next)
      return next
    })
  }

  const doneCount = items.filter(i => i.status === 'done').length
  const uploadingCount = items.filter(i => i.status === 'uploading').length
  const errorCount = items.filter(i => i.status === 'error').length

  return (
    <div style={{ marginTop: '12px' }}>
      <label className="label-field" style={{ color: '#E8180A' }}>{label}</label>
      <div className="photo-upload-zone" onClick={() => inputRef.current?.click()}>
        <input ref={inputRef} type="file" accept="image/*,video/*" multiple hidden onChange={handleFiles} />
        <div style={{ fontSize: '13px', color: '#999999', marginBottom: '4px', fontWeight: 700 }}>+ Agregar fotos/video</div>
        <p style={{ color: '#BBBBBB', fontSize: '11px', marginTop: '4px' }}>JPG, PNG, MP4 aceptados</p>
      </div>

      {items.length > 0 && (
        <>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginTop: '10px' }}>
            {items.map(item => (
              <div key={item.id} style={{ width: '76px' }}>
                <div style={{
                  position: 'relative', width: '76px', height: '76px', borderRadius: '6px',
                  overflow: 'hidden', border: '1px solid #E5E5E5', background: '#F7F7F7',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {item.isImage
                    ? <img src={item.preview} alt={item.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : <span style={{ fontSize: '24px' }}>🎬</span>}

                  {item.status === 'uploading' && (
                    <div style={{
                      position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <div className="spinner" />
                    </div>
                  )}
                  {item.status === 'error' && (
                    <div style={{
                      position: 'absolute', inset: 0, background: 'rgba(232,24,10,0.55)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: '#FFFFFF', fontSize: '11px', fontWeight: 700,
                    }}>
                      Error
                    </div>
                  )}
                  {item.status === 'done' && (
                    <div style={{
                      position: 'absolute', top: '3px', right: '3px',
                      width: '18px', height: '18px', borderRadius: '50%',
                      background: '#00a050', color: '#FFFFFF',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px',
                    }}>
                      &#10003;
                    </div>
                  )}
                  {/* Remove (don't trigger the bigger actions while uploading) */}
                  {item.status !== 'uploading' && (
                    <button
                      type="button"
                      onClick={() => removeItem(item.id)}
                      style={{
                        position: 'absolute', top: '3px', left: '3px',
                        width: '18px', height: '18px', borderRadius: '50%', border: 'none',
                        background: 'rgba(0,0,0,0.55)', color: '#FFFFFF', cursor: 'pointer',
                        fontSize: '11px', lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}
                      aria-label="Quitar"
                    >
                      &#10005;
                    </button>
                  )}
                </div>
                {item.status === 'error' && (
                  <button
                    type="button"
                    onClick={() => uploadOne(item)}
                    style={{
                      marginTop: '4px', width: '100%', border: '1px solid #E8180A',
                      background: '#FFF0EF', color: '#E8180A', borderRadius: '4px',
                      fontSize: '10px', fontWeight: 700, padding: '3px 0', cursor: 'pointer',
                    }}
                  >
                    Reintentar
                  </button>
                )}
              </div>
            ))}
          </div>
          {errorCount > 0 ? (
            <p style={{ color: '#E8180A', fontSize: '12px', fontWeight: 600, marginTop: '8px' }}>
              &#9888; {errorCount} foto(s) no se subieron. Reintenta o elimínalas.
            </p>
          ) : uploadingCount > 0 ? (
            <p style={{ color: '#999999', fontSize: '12px', marginTop: '8px' }}>
              Subiendo… {doneCount}/{items.length} listo(s)
            </p>
          ) : (
            <p style={{ color: '#00a050', fontSize: '12px', marginTop: '8px' }}>
              &#10003; {doneCount} archivo(s) subido(s)
            </p>
          )}
        </>
      )}
    </div>
  )
}

interface RadioFieldProps {
  label: string
  options: string[]
  value: string
  onChange: (v: string) => void
  required?: boolean
}

export function RadioField({ label, options, value, onChange, required }: RadioFieldProps) {
  return (
    <div style={{ marginBottom: '20px' }}>
      <label className="label-field">{label}{required && <span style={{ color: '#E8180A' }}> *</span>}</label>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
        {options.map(opt => (
          <div
            key={opt}
            className={`radio-option ${value === opt ? 'selected' : ''}`}
            onClick={() => onChange(opt)}
            style={{ minWidth: '80px', justifyContent: 'center' }}
          >
            {opt}
          </div>
        ))}
      </div>
    </div>
  )
}

interface CheckboxGroupProps {
  label: string
  options: string[]
  selected: string[]
  onChange: (v: string[]) => void
  required?: boolean
}

export function CheckboxGroup({ label, options, selected, onChange, required }: CheckboxGroupProps) {
  function toggle(opt: string) {
    if (selected.includes(opt)) {
      onChange(selected.filter(s => s !== opt))
    } else {
      onChange([...selected, opt])
    }
  }

  return (
    <div style={{ marginBottom: '20px' }}>
      <label className="label-field">{label}{required && <span style={{ color: '#E8180A' }}> *</span>}</label>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '8px' }}>
        {options.map(opt => {
          const checked = selected.includes(opt)
          return (
            <div
              key={opt}
              onClick={() => toggle(opt)}
              style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                padding: '10px 12px',
                background: checked ? '#E8180A' : '#FFFFFF',
                border: `1px solid ${checked ? '#E8180A' : '#E5E5E5'}`,
                borderRadius: '6px', cursor: 'pointer',
                transition: 'all 0.15s', fontSize: '13px',
                color: checked ? '#FFFFFF' : '#444444',
                fontWeight: checked ? 600 : 400,
              }}
            >
              <div style={{
                width: '16px', height: '16px', borderRadius: '3px',
                border: `2px solid ${checked ? 'rgba(255,255,255,0.6)' : '#CCCCCC'}`,
                background: checked ? 'rgba(255,255,255,0.2)' : 'transparent',
                flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {checked && <span style={{ color: 'white', fontSize: '10px' }}>&#10003;</span>}
              </div>
              {opt}
            </div>
          )
        })}
      </div>
    </div>
  )
}

interface TextInputProps {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  required?: boolean
  type?: string
}

export function TextInput({ label, value, onChange, placeholder, required, type = 'text' }: TextInputProps) {
  return (
    <div style={{ marginBottom: '16px' }}>
      <label className="label-field">{label}{required && <span style={{ color: '#E8180A' }}> *</span>}</label>
      <input
        className="input-dark"
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
      />
    </div>
  )
}

export function FormHeader({ title, subtitle, role }: { title: string; subtitle: string; role?: UserRole }) {
  const accentColor = role ? (AREA_THEME[role]?.text || '#E8180A') : '#E8180A'

  return (
    <div style={{ marginBottom: '28px' }}>
      {role && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
          <div style={{ width: '28px', height: '3px', background: accentColor, borderRadius: '2px' }} />
          <span style={{ fontSize: '10px', color: '#BBBBBB', textTransform: 'uppercase', letterSpacing: '1px' }}>
            {ROLE_LABELS[role]}
          </span>
        </div>
      )}
      <h1 style={{ fontSize: '19px', fontWeight: 500, color: '#111111', lineHeight: 1.2 }}>{title}</h1>
      <p style={{ color: '#999999', fontSize: '12px', marginTop: '4px' }}>{subtitle}</p>
    </div>
  )
}

export function SuccessMessage({ onNew }: { onNew: () => void }) {
  return (
    <div style={{
      textAlign: 'center', padding: '60px 40px',
      background: '#FFFFFF', border: '0.5px solid #E5E5E5', borderRadius: '12px',
      animation: 'fadeInUp 0.4s ease',
      boxShadow: '0 4px 20px rgba(0,0,0,0.06)',
    }}>
      <div style={{ fontSize: '40px', color: '#00a050', marginBottom: '12px', lineHeight: 1 }}>&#10003;</div>
      <h2 style={{ fontFamily: 'var(--font-sans)', fontSize: '24px', fontWeight: 700, color: '#111111', letterSpacing: '-0.02em', marginBottom: '8px' }}>
        Ticket guardado
      </h2>
      <p style={{ color: '#888888', marginBottom: '24px' }}>El ticket fue registrado exitosamente</p>
      <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
        <button className="btn-red" onClick={onNew}>+ Nuevo Ticket</button>
      </div>
    </div>
  )
}
