'use server'

import { supabaseAdmin } from '@/lib/supabase-server'

export interface ActionResult<T = unknown> {
  ok: boolean
  data?: T
  error?: string
}

export async function guardarFechaCompromiso (input: {
  orden: string
  fecha: string
  created_by?: string
}): Promise<ActionResult<{ orden: string; fecha: string }>> {
  const orden = input.orden.trim()
  if (!orden) return { ok: false, error: 'Falta el número de orden' }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.fecha)) return { ok: false, error: 'Fecha inválida' }

  const { data, error } = await supabaseAdmin
    .from('ordenes_fecha_compromiso')
    .upsert(
      { orden, fecha: input.fecha, created_by: input.created_by ?? null },
      { onConflict: 'orden' },
    )
    .select('orden, fecha')
    .single()

  if (error) return { ok: false, error: error.message }
  return { ok: true, data: { orden: data.orden, fecha: data.fecha } }
}
