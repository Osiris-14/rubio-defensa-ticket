'use server'

import { supabaseAdmin } from '@/lib/supabase-server'
import type { EtapaPipeline } from '@/lib/production-v2'

// =====================================================================
// Server Actions — Pipeline de Producción v4.
// Órdenes → Corte → Fabricación → Soldadura → Pulido → Completada.
// Inserts/updates directos sobre production_tickets, sin RPC.
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

// ── Tab Órdenes → Corte: mueve la orden completa, sin formulario ──
export async function enviarACorte (input: {
  numero_orden: string | null
  factura: string
  alegra_id: string
  user_id: string
  user_name: string
}): Promise<ActionResult<null>> {
  const { error } = await supabaseAdmin.from('production_tickets').insert({
    numero_orden: input.numero_orden,
    factura: input.factura,
    alegra_id: input.alegra_id,
    etapa: 'corte',
    estado: 'en_proceso',
    user_id: input.user_id,
    user_name: input.user_name,
  })
  if (error) return { ok: false, error: error.message }
  return { ok: true, data: null }
}

// ── Tab Corte → Fabricación: crea una fila por pieza + cierra la fila de Corte ──
export async function abrirProduccion (input: {
  corte_ticket_id: string
  numero_orden: string | null
  factura: string
  alegra_id: string
  piezas: PiezaAsignada[]
  doblo_david: boolean
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
    doblo_david: input.doblo_david,
    etapa: 'fabricacion' as const,
    estado: 'pendiente' as const,
    user_id: input.user_id,
    user_name: input.user_name,
  }))

  const { error: insertError } = await supabaseAdmin.from('production_tickets').insert(rows)
  if (insertError) return { ok: false, error: insertError.message }

  const { error: updateError } = await supabaseAdmin
    .from('production_tickets')
    .update({ estado: 'completado' })
    .eq('id', input.corte_ticket_id)
  if (updateError) return { ok: false, error: updateError.message }

  return { ok: true, data: null }
}

// ── Qué pasa cuando TODAS las piezas de una orden terminan una etapa ──
const SIGUIENTE_ETAPA: Record<'fabricacion' | 'soldadura' | 'pulido', { next: EtapaPipeline; modo: 'insert' | 'update' }> = {
  fabricacion: { next: 'soldadura', modo: 'insert' },
  soldadura: { next: 'pulido', modo: 'insert' },
  pulido: { next: 'completada', modo: 'update' },
}

// ── Marcar una pieza completada en Fabricación/Soldadura/Pulido y,
//    si con eso la orden termina esa etapa completa, hacer la cascada
//    (insertar filas nuevas en la siguiente etapa, o pasar a Completada). ──
export async function completarPiezaPipeline (id: string): Promise<ActionResult<{ cascada: boolean }>> {
  const { data: fila, error: fetchError } = await supabaseAdmin
    .from('production_tickets')
    .select('id, alegra_id, numero_orden, etapa')
    .eq('id', id)
    .maybeSingle()
  if (fetchError) return { ok: false, error: fetchError.message }
  if (!fila) return { ok: false, error: 'Ticket no encontrado' }

  const etapa = fila.etapa as string
  if (etapa !== 'fabricacion' && etapa !== 'soldadura' && etapa !== 'pulido') {
    return { ok: false, error: 'Esta pieza no está en una etapa que se pueda completar así' }
  }

  const { error: updateError } = await supabaseAdmin
    .from('production_tickets')
    .update({ estado: 'completado', completado_en: new Date().toISOString() })
    .eq('id', id)
  if (updateError) return { ok: false, error: updateError.message }

  // ¿Están todas las piezas de esta orden, en esta misma etapa, completadas?
  let q = supabaseAdmin.from('production_tickets').select('*').eq('etapa', etapa)
  q = fila.alegra_id ? q.eq('alegra_id', fila.alegra_id) : q.eq('numero_orden', fila.numero_orden)
  const { data: hermanas, error: hermanasError } = await q
  if (hermanasError) return { ok: false, error: hermanasError.message }

  const todasCompletas = (hermanas ?? []).length > 0 && (hermanas ?? []).every(h => h.estado === 'completado')
  if (!todasCompletas) return { ok: true, data: { cascada: false } }

  const { next, modo } = SIGUIENTE_ETAPA[etapa]

  if (modo === 'update') {
    const ids = (hermanas ?? []).map(h => h.id as string)
    const { error: cascadaError } = await supabaseAdmin
      .from('production_tickets')
      .update({ etapa: next })
      .in('id', ids)
    if (cascadaError) return { ok: false, error: cascadaError.message }
  } else {
    const nuevas = (hermanas ?? []).map(h => ({
      numero_orden: h.numero_orden,
      factura: h.factura,
      alegra_id: h.alegra_id,
      pieza: h.pieza,
      responsable: h.responsable,
      doblo_david: h.doblo_david,
      etapa: next,
      estado: 'pendiente' as const,
      user_id: h.user_id,
      user_name: h.user_name,
    }))
    const { error: cascadaError } = await supabaseAdmin.from('production_tickets').insert(nuevas)
    if (cascadaError) return { ok: false, error: cascadaError.message }
  }

  return { ok: true, data: { cascada: true } }
}
