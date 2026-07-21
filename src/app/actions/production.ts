'use server'

import { supabaseAdmin } from '@/lib/supabase-server'
import type { ProductionStep, Prioridad } from '@/lib/production-v2'

// =====================================================================
// Server Actions — Módulo de Producción rediseñado.
// Todas las mutaciones van por Supabase RPC (SECURITY DEFINER).
// Los precios NUNCA vienen del cliente: los calcula la RPC desde el
// catálogo (production_price_catalog).
// =====================================================================

export interface PieceInput {
  piece_name: string
  quantity: number
}

export interface ActionResult<T = unknown> {
  ok: boolean
  data?: T
  error?: string
}

// ── Crear ticket de producción desde una orden de Alegra ──
export async function createProductionTicket (input: {
  alegra_id: string | null
  factura: string
  orden: string | null
  cliente: string | null
  vehiculo: string | null
  pieces: PieceInput[]
  created_by?: string
  tipo_trabajo?: 'Fabricacion' | 'Reparacion' | 'Modificacion'
  grado_reparacion?: 'Grado A' | 'Grado B' | 'Grado C' | null
}): Promise<ActionResult<string>> {
  if (!input.pieces.length) return { ok: false, error: 'Selecciona al menos una pieza' }
  const { data, error } = await supabaseAdmin.rpc('create_production_ticket', {
    p_alegra_id: input.alegra_id,
    p_factura: input.factura,
    p_orden: input.orden,
    p_cliente: input.cliente,
    p_vehiculo: input.vehiculo,
    p_pieces: input.pieces,
    p_created_by: input.created_by ?? null,
    p_tipo_trabajo: input.tipo_trabajo ?? 'Fabricacion',
    p_grado_reparacion: input.grado_reparacion ?? null,
    p_re_trabajo: input.tipo_trabajo === 'Reparacion' ? 'Si' : 'No',
  })
  if (error) return { ok: false, error: error.message }
  return { ok: true, data: data as string }
}

// ── Confirmar una etapa de una pieza ──
export async function confirmStep (input: {
  ticket_id: string
  piece_name: string
  step: ProductionStep
  employee_id: string
  employee_name: string
  is_self_bent?: boolean | null
  doblador_id?: string | null
  doblador_name?: string | null
}): Promise<ActionResult<{ id: string; price: number; step: string; piece_name: string }>> {
  const { data, error } = await supabaseAdmin.rpc('confirm_production_step', {
    p_ticket_id: input.ticket_id,
    p_piece_name: input.piece_name,
    p_step: input.step,
    p_employee_id: input.employee_id,
    p_employee_name: input.employee_name,
    p_is_self_bent: input.is_self_bent ?? null,
    p_doblador_id: input.doblador_id ?? null,
    p_doblador_name: input.doblador_name ?? null,
  })
  if (error) return { ok: false, error: error.message }
  const row = (Array.isArray(data) ? data[0] : data) as { id: string; price: number; step: string; piece_name: string }
  return { ok: true, data: row }
}

// ── Cerrar ticket ──
export async function closeTicket (ticketId: string): Promise<ActionResult<{ id: string; total_cost: number; status: string }>> {
  const { data, error } = await supabaseAdmin.rpc('close_production_ticket', {
    p_ticket_id: ticketId,
  })
  if (error) return { ok: false, error: error.message }
  const row = (Array.isArray(data) ? data[0] : data) as { id: string; total_cost: number; status: string }
  return { ok: true, data: row }
}

// ── Generar nómina ──
export async function createPayrollRun (input: {
  period_type: 'semanal' | 'quincenal' | 'mensual'
  period_start: string
  period_end: string
  employee_ids: string[]
  created_by?: string
}): Promise<ActionResult<{ run_id: string; total_amount: number; details_count: number }>> {
  if (!input.employee_ids.length) return { ok: false, error: 'Selecciona al menos un empleado' }
  const { data, error } = await supabaseAdmin.rpc('create_payroll_run', {
    p_period_type: input.period_type,
    p_period_start: input.period_start,
    p_period_end: input.period_end,
    p_employee_ids: input.employee_ids,
    p_created_by: input.created_by ?? null,
  })
  if (error) return { ok: false, error: error.message }
  const row = (Array.isArray(data) ? data[0] : data) as { run_id: string; total_amount: number; details_count: number }
  return { ok: true, data: row }
}

// ── Marcar nómina como pagada ──
export async function markPayrollPaid (runId: string): Promise<ActionResult<null>> {
  const { error } = await supabaseAdmin
    .from('production_payroll_runs')
    .update({ status: 'pagada' })
    .eq('id', runId)
  if (error) return { ok: false, error: error.message }
  return { ok: true, data: null }
}

// ── Gestión de empleados ──
export async function addEmployee (name: string): Promise<ActionResult<{ id: string }>> {
  const clean = name.trim()
  if (!clean) return { ok: false, error: 'Nombre vacío' }
  const { data, error } = await supabaseAdmin
    .from('production_employees')
    .insert({ name: clean, active: true })
    .select('id')
    .single()
  if (error) {
    if (error.code === '23505') return { ok: false, error: 'Ya existe un empleado con ese nombre' }
    return { ok: false, error: error.message }
  }
  return { ok: true, data: { id: data.id } }
}

export async function toggleEmployeeActive (id: string, active: boolean): Promise<ActionResult<null>> {
  const { error } = await supabaseAdmin
    .from('production_employees')
    .update({ active })
    .eq('id', id)
  if (error) return { ok: false, error: error.message }
  return { ok: true, data: null }
}

// ── Importar catálogo desde el cliente (opcional) ──
export async function importCatalog (rows: Array<Record<string, unknown>>): Promise<ActionResult<{ inserted: number; updated: number }>> {
  const { data, error } = await supabaseAdmin.rpc('import_price_catalog', { p_rows: rows })
  if (error) return { ok: false, error: error.message }
  const row = (Array.isArray(data) ? data[0] : data) as { inserted: number; updated: number }
  return { ok: true, data: row }
}

// =====================================================================
// Planificador de Producción
// =====================================================================

// ── Capacidad diaria de un área ──
export async function setAreaCapacity (input: {
  step: ProductionStep
  daily_capacity: number
  updated_by?: string
}): Promise<ActionResult<null>> {
  if (input.daily_capacity <= 0) return { ok: false, error: 'La capacidad debe ser mayor a 0' }
  const { error } = await supabaseAdmin.rpc('set_area_capacity', {
    p_step: input.step,
    p_daily_capacity: input.daily_capacity,
    p_updated_by: input.updated_by ?? null,
  })
  if (error) return { ok: false, error: error.message }
  return { ok: true, data: null }
}

// ── Capacidad diaria de un empleado por etapa ──
export async function setEmployeeCapacity (input: {
  employee_id: string
  step: ProductionStep
  daily_capacity: number
  updated_by?: string
}): Promise<ActionResult<null>> {
  if (input.daily_capacity < 0) return { ok: false, error: 'La capacidad no puede ser negativa' }
  const { error } = await supabaseAdmin.rpc('set_employee_capacity', {
    p_employee_id: input.employee_id,
    p_step: input.step,
    p_daily_capacity: input.daily_capacity,
    p_updated_by: input.updated_by ?? null,
  })
  if (error) return { ok: false, error: error.message }
  return { ok: true, data: null }
}

// ── Programar fecha de un ticket (al crear) ──
export async function setTicketSchedule (input: {
  ticket_id: string
  fecha_programada: string
  fabricador_id?: string | null
  fabricador_name?: string | null
  prioridad?: Prioridad
  changed_by?: string
  reason?: string
}): Promise<ActionResult<null>> {
  const { error } = await supabaseAdmin.rpc('set_ticket_schedule', {
    p_ticket_id: input.ticket_id,
    p_fecha_programada: input.fecha_programada,
    p_fabricador_id: input.fabricador_id ?? null,
    p_fabricador_name: input.fabricador_name ?? null,
    p_prioridad: input.prioridad ?? 'normal',
    p_changed_by: input.changed_by ?? null,
    p_reason: input.reason ?? null,
  })
  if (error) return { ok: false, error: error.message }
  return { ok: true, data: null }
}

// ── Mover ticket (drag & drop) ──
export async function moveTicketSchedule (input: {
  ticket_id: string
  new_fecha: string
  new_fabricador_id?: string | null
  new_fabricador_name?: string | null
  changed_by?: string
  reason?: string
}): Promise<ActionResult<{ old_fecha: string; new_fecha: string; fabricador_name: string }>> {
  const { data, error } = await supabaseAdmin.rpc('move_ticket_schedule', {
    p_ticket_id: input.ticket_id,
    p_new_fecha: input.new_fecha,
    p_new_fabricador_id: input.new_fabricador_id ?? null,
    p_new_fabricador_name: input.new_fabricador_name ?? null,
    p_changed_by: input.changed_by ?? null,
    p_reason: input.reason ?? null,
  })
  if (error) return { ok: false, error: error.message }
  const row = (Array.isArray(data) ? data[0] : data) as { old_fecha: string; new_fecha: string; fabricador_name: string }
  return { ok: true, data: row }
}

// ── Reasignar empleado de una etapa confirmada ──
export async function assignStepEmployee (input: {
  step_id: string
  employee_id: string
  employee_name: string
}): Promise<ActionResult<null>> {
  const { error } = await supabaseAdmin.rpc('assign_step_employee', {
    p_step_id: input.step_id,
    p_employee_id: input.employee_id,
    p_employee_name: input.employee_name,
  })
  if (error) return { ok: false, error: error.message }
  return { ok: true, data: null }
}
