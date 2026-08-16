'use server'

import { supabaseAdmin } from '@/lib/supabase-server'

// =====================================================================
// Server Actions — Producción v3 (flujo de tickets por pieza).
// Inserts/updates directos sobre production_tickets, sin RPC: no hay
// precios que calcular ni etapas que validar en el servidor.
// =====================================================================

export interface ActionResult<T = unknown> {
  ok: boolean
  data?: T
  error?: string
}

export interface PiezaAsignada {
  pieza: string
  responsable: string
}

// ── Abrir ticket: inserta una fila por pieza seleccionada ──
export async function abrirTicketsProduccion (input: {
  numero_orden: string | null
  factura: string
  alegra_id: string
  piezas: PiezaAsignada[]
  user_id: string
  user_name: string
}): Promise<ActionResult<null>> {
  if (!input.piezas.length) return { ok: false, error: 'Selecciona al menos una pieza' }
  const sinResponsable = input.piezas.find(p => !p.responsable.trim())
  if (sinResponsable) return { ok: false, error: `Falta el responsable de "${sinResponsable.pieza}"` }

  const rows = input.piezas.map(p => ({
    numero_orden: input.numero_orden,
    factura: input.factura,
    alegra_id: input.alegra_id,
    pieza: p.pieza,
    responsable: p.responsable.trim(),
    estado: 'pendiente' as const,
    user_id: input.user_id,
    user_name: input.user_name,
  }))

  const { error } = await supabaseAdmin.from('production_tickets').insert(rows)
  if (error) return { ok: false, error: error.message }
  return { ok: true, data: null }
}

// ── Marcar una pieza como completada ──
export async function completarTicketProduccion (id: string): Promise<ActionResult<null>> {
  const { error } = await supabaseAdmin
    .from('production_tickets')
    .update({ estado: 'completado', completado_en: new Date().toISOString() })
    .eq('id', id)
  if (error) return { ok: false, error: error.message }
  return { ok: true, data: null }
}
