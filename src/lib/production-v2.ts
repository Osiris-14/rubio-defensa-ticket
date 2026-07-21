// =====================================================================
// Módulo de Producción Rediseñado — tipos + capa de lectura (cliente)
// No toca el módulo legacy (./produccion.ts) que sigue usándose para
// los dashboards existentes.
// =====================================================================
import { supabase } from './supabase'

// ─────────────────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────────────────

export interface PriceCatalogRow {
  id: string
  piece_name: string
  ferre_price: number
  paint_price: number
  decoration_price: number
  fabrication_price_other_bent: number
  fabrication_price_self_bent: number
  welding_price: number
  active: boolean
  created_at: string
  updated_at: string
}

export interface ProductionEmployee {
  id: string
  name: string
  active: boolean
  created_at: string
}

export interface ProductionTicket {
  id: string
  alegra_id: string | null
  factura: string | null
  orden: string | null
  cliente: string | null
  vehiculo: string | null
  status: 'pendiente' | 'completado'
  total_cost: number
  tipo_trabajo: 'Fabricacion' | 'Reparacion' | 'Modificacion' | null
  grado_reparacion: 'Grado A' | 'Grado B' | 'Grado C' | null
  re_trabajo: 'Si' | 'No' | null
  fecha_programada: string | null
  prioridad: 'baja' | 'normal' | 'alta' | 'critica' | null
  fabricador_id: string | null
  fabricador_name: string | null
  created_by: string | null
  created_at: string
  completed_at: string | null
}

export interface ProductionTicketPiece {
  id: string
  ticket_id: string
  piece_name: string
  quantity: number
  created_at: string
}

export type ProductionStep = 'fabricacion' | 'soldadura' | 'ferre' | 'pintura' | 'decoracion'

export interface ProductionTicketStep {
  id: string
  ticket_id: string
  piece_name: string
  step: ProductionStep
  employee_id: string | null
  employee_name: string | null
  doblador_id: string | null
  doblador_name: string | null
  price: number
  started_at: string | null
  completed_at: string | null
  payroll_run_id: string | null
  created_at: string
}

export interface ProductionTicketFull extends ProductionTicket {
  pieces: ProductionTicketPiece[]
  steps: ProductionTicketStep[]
}

// Orden proveniente de Alegra (vista silver) aún no convertida en ticket.
export interface OrdenProduccion {
  alegra_id: string
  factura: string
  cliente: string | null
  talonario: string | null
  vehiculo: string | null
  fecha: string
  total: number
  saldo: number
  estado_cxc: 'Open' | 'Atraso' | 'Cerrado'
}

export interface ProductionKpis {
  ordenes: number
  tickets_pendientes: number
  tickets_completados: number
  costo_hoy: number
  costo_semana: number
  costo_mes: number
}

export interface EmployeeProductionTotal {
  employee_id: string
  employee_name: string
  step: ProductionStep
  work_count: number
  total_earned: number
}

export interface EmployeePendingPayment {
  employee_id: string
  employee_name: string
  pending_count: number
  pending_amount: number
}

export interface PayrollRun {
  id: string
  period_type: 'semanal' | 'quincenal' | 'mensual'
  period_start: string
  period_end: string
  total_amount: number
  status: 'emitida' | 'pagada' | 'anulada'
  created_by: string | null
  created_at: string
}

export interface PayrollDetail {
  id: string
  run_id: string
  employee_id: string | null
  employee_name: string | null
  step: string | null
  work_count: number
  amount: number
  created_at: string
}

// ─────────────────────────────────────────────────────────
// Tipos — Planificador
// ─────────────────────────────────────────────────────────

export type Prioridad = 'baja' | 'normal' | 'alta' | 'critica'

export interface AreaCapacity {
  id: string
  step: ProductionStep
  daily_capacity: number
  updated_at: string
  updated_by: string | null
}

export interface EmployeeCapacity {
  id: string
  employee_id: string
  step: ProductionStep
  daily_capacity: number
  updated_at: string
  updated_by: string | null
}

export interface AreaDailyLoad {
  fecha: string
  step: ProductionStep
  tickets_count: number
  daily_capacity: number
}

export interface EmployeeDailyLoad {
  fecha: string
  employee_id: string
  employee_name: string
  step: ProductionStep
  done_count: number
  scheduled_count: number
  daily_capacity: number
}

export interface CapacityDashboard {
  tickets_hoy: number
  cap_hoy: number
  tickets_semana: number
  tickets_mes: number
  retrasados: number
  proximos: number
  vencidos: number
}

export interface ScheduleAudit {
  id: string
  ticket_id: string
  orden: string | null
  vehiculo: string | null
  field: string
  old_value: string | null
  new_value: string | null
  changed_by: string | null
  reason: string | null
  changed_at: string
}

export interface CalendarEvent {
  id: string
  ticket_id: string
  orden: string | null
  vehiculo: string | null
  cliente: string | null
  factura: string | null
  fecha_programada: string | null
  status: 'pendiente' | 'completado'
  prioridad: Prioridad | null
  fabricador_id: string | null
  fabricador_name: string | null
  tipo_trabajo: string | null
  // Para filtrar por etapa: si el ticket ya completó cierta etapa
  completed_steps: ProductionStep[]
  total_pieces: number
}

// ─────────────────────────────────────────────────────────
// Etapas (orden fijo del prompt)
// ─────────────────────────────────────────────────────────
export const PRODUCTION_STEPS: ProductionStep[] = ['fabricacion', 'soldadura', 'ferre', 'pintura', 'decoracion']

export const STEP_LABELS: Record<ProductionStep, string> = {
  fabricacion: 'Fabricación',
  soldadura: 'Soldadura',
  ferre: 'Ferré',
  pintura: 'Pintura',
  decoracion: 'Decoración',
}

export const PRIORIDAD_LABELS: Record<Prioridad, string> = {
  baja: 'Baja',
  normal: 'Normal',
  alta: 'Alta',
  critica: 'Crítica',
}

export const PRIORIDAD_COLORS: Record<Prioridad, { dot: string; bg: string; text: string }> = {
  baja:     { dot: 'var(--gray-300)',  bg: 'var(--gray-100)',  text: 'var(--gray-600)' },
  normal:   { dot: 'var(--blue)',      bg: 'var(--blue-bg)',   text: 'var(--blue)' },
  alta:     { dot: 'var(--amber)',     bg: 'var(--amber-bg)',  text: 'var(--amber)' },
  critica:  { dot: 'var(--red)',       bg: 'var(--red-50)',    text: 'var(--red)' },
}

// Devuelve el % de ocupación (0-100) y el color según el prompt:
//   0–50%  → verde
//   51–80% → amarillo
//   81–100% → rojo
export function occupancyLevel (count: number, capacity: number): { pct: number; tone: 'green' | 'amber' | 'red'; label: string } {
  const cap = capacity > 0 ? capacity : 1
  const pct = Math.min(100, Math.round((count / cap) * 100))
  const tone: 'green' | 'amber' | 'red' = pct <= 50 ? 'green' : pct <= 80 ? 'amber' : 'red'
  const label = `${count} / ${capacity}`
  return { pct, tone, label }
}

// ─────────────────────────────────────────────────────────
// Self-heal para la vista silver (el sync de Alegra puede borrarla)
// ─────────────────────────────────────────────────────────
const VIEW_MISSING = /could not find.*v_facturas_produccion|v_facturas_produccion.*schema cache/i

async function rebuildSilverView (): Promise<void> {
  const { error } = await supabase.rpc('rebuild_v_facturas_produccion')
  if (error) throw new Error(`rebuild_v_facturas_produccion: ${error.message}`)
}

async function withSelfHeal<T> (fn: () => Promise<T>): Promise<T> {
  try {
    return await fn()
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    if (!VIEW_MISSING.test(msg)) throw e
    await rebuildSilverView()
    return fn()
  }
}

// ─────────────────────────────────────────────────────────
// Lecturas — catálogo y empleados
// ─────────────────────────────────────────────────────────

export async function fetchPriceCatalog (): Promise<PriceCatalogRow[]> {
  const { data, error } = await supabase
    .from('production_price_catalog')
    .select('*')
    .order('piece_name', { ascending: true })
  if (error) throw new Error(error.message)
  return (data ?? []).map(normalizeCatalogRow)
}

export async function fetchActivePieceNames (): Promise<string[]> {
  const { data, error } = await supabase
    .from('production_price_catalog')
    .select('piece_name')
    .eq('active', true)
    .order('piece_name', { ascending: true })
  if (error) throw new Error(error.message)
  return (data ?? []).map(r => r.piece_name as string)
}

export async function fetchProductionEmployees (activeOnly = true): Promise<ProductionEmployee[]> {
  let q = supabase.from('production_employees').select('*').order('name', { ascending: true })
  if (activeOnly) q = q.eq('active', true)
  const { data, error } = await q
  if (error) throw new Error(error.message)
  return (data ?? []) as ProductionEmployee[]
}

// ─────────────────────────────────────────────────────────
// Lecturas — órdenes desde Alegra (excluye las ya convertidas)
// ─────────────────────────────────────────────────────────

export async function fetchOrdenesProduccion (): Promise<OrdenProduccion[]> {
  return withSelfHeal(async () => {
    const { data: facturas, error } = await supabase
      .schema('silver')
      .from('v_facturas_produccion')
      .select('alegra_id, factura, cliente, talonario, vehiculo, fecha, total, saldo, estado_cxc, pendiente_produccion')
      .eq('pendiente_produccion', true)
      .order('fecha', { ascending: false })
    if (error) throw new Error(error.message)
    const raw = (facturas ?? []) as Record<string, unknown>[]

    // Alegra_ids ya convertidas a production_tickets
    const { data: prodIds } = await supabase
      .from('production_tickets')
      .select('alegra_id')
    const prodSet = new Set((prodIds ?? []).map(r => r.alegra_id).filter(Boolean) as string[])

    // Facturas ya en tickets_produccion (legacy) para no re-procesar órdenes
    const { data: legacy } = await supabase
      .from('tickets_produccion')
      .select('numero_factura')
    const legacySet = new Set((legacy ?? []).map(r => r.numero_factura as string).filter(Boolean))

    return raw
      .filter(f => !prodSet.has(String(f.alegra_id)) && !legacySet.has(String(f.factura)))
      .map(normalizeOrden)
  })
}

// ─────────────────────────────────────────────────────────
// Lecturas — tickets
// ─────────────────────────────────────────────────────────

export async function fetchProductionTickets (status?: 'pendiente' | 'completado'): Promise<ProductionTicket[]> {
  let q = supabase.from('production_tickets').select('*')
  if (status) q = q.eq('status', status)
  q = q.order('created_at', { ascending: false })
  const { data, error } = await q
  if (error) throw new Error(error.message)
  return (data ?? []) as ProductionTicket[]
}

export async function fetchProductionTicketFull (id: string): Promise<ProductionTicketFull | null> {
  const { data: ticket, error } = await supabase
    .from('production_tickets')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!ticket) return null

  const [pieces, steps] = await Promise.all([
    supabase.from('production_ticket_pieces').select('*').eq('ticket_id', id).order('piece_name'),
    supabase.from('production_ticket_steps').select('*').eq('ticket_id', id).order('created_at'),
  ])
  if (pieces.error) throw new Error(pieces.error.message)
  if (steps.error) throw new Error(steps.error.message)

  return { ...(ticket as ProductionTicket), pieces: (pieces.data ?? []) as ProductionTicketPiece[], steps: (steps.data ?? []) as ProductionTicketStep[] }
}

// ─────────────────────────────────────────────────────────
// Lecturas — KPIs
// ─────────────────────────────────────────────────────────

export async function fetchProductionKpis (): Promise<ProductionKpis> {
  const [ordenes, kpiRes] = await Promise.all([
    fetchOrdenesProduccion().catch(() => [] as OrdenProduccion[]),
    supabase.from('vw_production_kpis').select('*').maybeSingle(),
  ])
  if (kpiRes.error) throw new Error(kpiRes.error.message)
  const k = (kpiRes.data ?? {}) as Record<string, number>
  return {
    ordenes: ordenes.length,
    tickets_pendientes: Number(k.tickets_pendientes ?? 0),
    tickets_completados: Number(k.tickets_completados ?? 0),
    costo_hoy: Number(k.costo_hoy ?? 0),
    costo_semana: Number(k.costo_semana ?? 0),
    costo_mes: Number(k.costo_mes ?? 0),
  }
}

// ─────────────────────────────────────────────────────────
// Lecturas — pagos / nóminas
// ─────────────────────────────────────────────────────────

export async function fetchEmployeeTotals (): Promise<EmployeeProductionTotal[]> {
  const { data, error } = await supabase
    .from('vw_employee_production_totals')
    .select('*')
    .order('employee_name', { ascending: true })
  if (error) throw new Error(error.message)
  return (data ?? []) as EmployeeProductionTotal[]
}

export async function fetchEmployeePendingPayments (): Promise<EmployeePendingPayment[]> {
  const { data, error } = await supabase
    .from('vw_employee_pending_payments')
    .select('*')
    .order('pending_amount', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []) as EmployeePendingPayment[]
}

export async function fetchPayrollRuns (): Promise<PayrollRun[]> {
  const { data, error } = await supabase
    .from('production_payroll_runs')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []) as PayrollRun[]
}

export async function fetchPayrollRunDetails (runId: string): Promise<PayrollDetail[]> {
  const { data, error } = await supabase
    .from('production_payroll_details')
    .select('*')
    .eq('run_id', runId)
    .order('employee_name', { ascending: true })
  if (error) throw new Error(error.message)
  return (data ?? []) as PayrollDetail[]
}

// ─────────────────────────────────────────────────────────
// Helpers — cálculo de estado de la pasarela (en cliente)
// ─────────────────────────────────────────────────────────

export type StageState = 'completada' | 'actual' | 'pendiente'

export interface StageProgress {
  step: ProductionStep
  state: StageState
  donePieces: number
  totalPieces: number
}

export function computeStageProgress (ticket: ProductionTicketFull): StageProgress[] {
  const totalPieces = ticket.pieces.length
  const stepsByPiece = new Map<string, Set<ProductionStep>>()
  for (const s of ticket.steps) {
    if (s.completed_at) {
      if (!stepsByPiece.has(s.piece_name)) stepsByPiece.set(s.piece_name, new Set())
      stepsByPiece.get(s.piece_name)!.add(s.step)
    }
  }
  const progress: StageProgress[] = PRODUCTION_STEPS.map(step => {
    const donePieces = ticket.pieces.filter(p => stepsByPiece.get(p.piece_name)?.has(step)).length
    return { step, donePieces, totalPieces, state: 'pendiente' as StageState }
  })
  // primera etapa no completada = actual
  let firstIncomplete = -1
  for (let i = 0; i < progress.length; i++) {
    if (progress[i].donePieces < progress[i].totalPieces || progress[i].totalPieces === 0) { firstIncomplete = i; break }
  }
  for (let i = 0; i < progress.length; i++) {
    if (i < firstIncomplete) progress[i].state = 'completada'
    else if (i === firstIncomplete) progress[i].state = 'actual'
    else progress[i].state = 'pendiente'
  }
  if (firstIncomplete === -1) {
    // todas completadas
    for (const p of progress) p.state = 'completada'
  }
  return progress
}

export function ticketIsReadyToClose (ticket: ProductionTicketFull): boolean {
  const progress = computeStageProgress(ticket)
  return progress.every(p => p.totalPieces > 0 && p.donePieces === p.totalPieces)
}

// ─────────────────────────────────────────────────────────
// Normalizadores
// ─────────────────────────────────────────────────────────

function normalizeCatalogRow (r: Record<string, unknown>): PriceCatalogRow {
  return {
    id: String(r.id ?? ''),
    piece_name: String(r.piece_name ?? ''),
    ferre_price: Number(r.ferre_price ?? 0),
    paint_price: Number(r.paint_price ?? 0),
    decoration_price: Number(r.decoration_price ?? 0),
    fabrication_price_other_bent: Number(r.fabrication_price_other_bent ?? 0),
    fabrication_price_self_bent: Number(r.fabrication_price_self_bent ?? 0),
    welding_price: Number(r.welding_price ?? 0),
    active: Boolean(r.active),
    created_at: String(r.created_at ?? ''),
    updated_at: String(r.updated_at ?? ''),
  }
}

function normalizeOrden (r: Record<string, unknown>): OrdenProduccion {
  return {
    alegra_id: String(r.alegra_id ?? ''),
    factura: String(r.factura ?? ''),
    cliente: (r.cliente as string | null) ?? null,
    talonario: (r.talonario as string | null) ?? null,
    vehiculo: (r.vehiculo as string | null) ?? null,
    fecha: String(r.fecha ?? ''),
    total: Number(r.total ?? 0),
    saldo: Number(r.saldo ?? 0),
    estado_cxc: (r.estado_cxc as OrdenProduccion['estado_cxc']) ?? 'Open',
  }
}

// ─────────────────────────────────────────────────────────
// Lecturas — Planificador
// ─────────────────────────────────────────────────────────

export async function fetchAreaCapacities (): Promise<AreaCapacity[]> {
  const { data, error } = await supabase
    .from('production_area_capacities')
    .select('*')
    .order('step', { ascending: true })
  if (error) throw new Error(error.message)
  return (data ?? []) as AreaCapacity[]
}

export async function fetchAreaCapacity (step: ProductionStep): Promise<number> {
  const { data, error } = await supabase
    .from('production_area_capacities')
    .select('daily_capacity')
    .eq('step', step)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data?.daily_capacity ?? 10
}

export async function fetchEmployeeCapacities (): Promise<EmployeeCapacity[]> {
  const { data, error } = await supabase
    .from('production_employee_capacities')
    .select('*')
    .order('employee_id', { ascending: true })
  if (error) throw new Error(error.message)
  return (data ?? []) as EmployeeCapacity[]
}

// Ocupación diaria por área en un rango de fechas [from, to] inclusive.
// Devuelve un mapa por 'fecha|step' → load.
export async function fetchAreaDailyLoadInRange (from: string, to: string): Promise<AreaDailyLoad[]> {
  const { data, error } = await supabase
    .from('vw_area_daily_load')
    .select('*')
    .gte('fecha', from)
    .lte('fecha', to)
    .order('fecha', { ascending: true })
  if (error) throw new Error(error.message)
  return (data ?? []) as AreaDailyLoad[]
}

export async function fetchEmployeeDailyLoadInRange (from: string, to: string): Promise<EmployeeDailyLoad[]> {
  const { data, error } = await supabase
    .from('vw_employee_daily_load')
    .select('*')
    .gte('fecha', from)
    .lte('fecha', to)
    .order('fecha', { ascending: true })
  if (error) throw new Error(error.message)
  return (data ?? []) as EmployeeDailyLoad[]
}

export async function fetchCapacityDashboard (): Promise<CapacityDashboard> {
  const { data, error } = await supabase
    .from('vw_capacity_dashboard')
    .select('*')
    .maybeSingle()
  if (error) throw new Error(error.message)
  const d = (data ?? {}) as Record<string, number>
  return {
    tickets_hoy: Number(d.tickets_hoy ?? 0),
    cap_hoy: Number(d.cap_hoy ?? 0),
    tickets_semana: Number(d.tickets_semana ?? 0),
    tickets_mes: Number(d.tickets_mes ?? 0),
    retrasados: Number(d.retrasados ?? 0),
    proximos: Number(d.proximos ?? 0),
    vencidos: Number(d.vencidos ?? 0),
  }
}

export async function fetchScheduleAudit (ticketId?: string): Promise<ScheduleAudit[]> {
  let q = supabase.from('vw_schedule_audit').select('*')
  if (ticketId) q = q.eq('ticket_id', ticketId)
  q = q.order('changed_at', { ascending: false }).limit(200)
  const { data, error } = await q
  if (error) throw new Error(error.message)
  return (data ?? []) as ScheduleAudit[]
}

// Eventos del calendario: tickets con fecha_programada o completados
// (para mostrar también los completados en su fecha de completed_at).
export async function fetchCalendarEvents (from: string, to: string): Promise<CalendarEvent[]> {
  const { data: tickets, error } = await supabase
    .from('production_tickets')
    .select('*')
    .or(`and(fecha_programada.gte.${from},fecha_programada.lte.${to}),and(completed_at.gte.${from},completed_at.lte.${to})`)
    .order('fecha_programada', { ascending: true, nullsFirst: false })
  if (error) throw new Error(error.message)
  if (!tickets || tickets.length === 0) return []

  const ticketIds = tickets.map(t => t.id)
  const [piecesRes, stepsRes] = await Promise.all([
    supabase.from('production_ticket_pieces').select('ticket_id, piece_name').in('ticket_id', ticketIds),
    supabase.from('production_ticket_steps').select('ticket_id, step, completed_at').in('ticket_id', ticketIds),
  ])
  if (piecesRes.error) throw new Error(piecesRes.error.message)
  if (stepsRes.error) throw new Error(stepsRes.error.message)

  const piecesMap = new Map<string, number>()
  for (const p of piecesRes.data ?? []) {
    piecesMap.set(p.ticket_id as string, (piecesMap.get(p.ticket_id as string) ?? 0) + 1)
  }
  const stepsMap = new Map<string, ProductionStep[]>()
  for (const s of stepsRes.data ?? []) {
    if (!s.completed_at) continue
    const arr = stepsMap.get(s.ticket_id as string) ?? []
    arr.push(s.step as ProductionStep)
    stepsMap.set(s.ticket_id as string, arr)
  }

  return tickets.map(t => ({
    id: t.id as string,
    ticket_id: t.id as string,
    orden: (t.orden as string | null) ?? null,
    vehiculo: (t.vehiculo as string | null) ?? null,
    cliente: (t.cliente as string | null) ?? null,
    factura: (t.factura as string | null) ?? null,
    fecha_programada: (t.fecha_programada as string | null) ?? null,
    status: t.status as 'pendiente' | 'completado',
    prioridad: (t.prioridad as Prioridad | null) ?? null,
    fabricador_id: (t.fabricador_id as string | null) ?? null,
    fabricador_name: (t.fabricador_name as string | null) ?? null,
    tipo_trabajo: (t.tipo_trabajo as string | null) ?? null,
    completed_steps: stepsMap.get(t.id as string) ?? [],
    total_pieces: piecesMap.get(t.id as string) ?? 0,
  }))
}

// Carga de fabricación para una fecha específica (para el calendario del modal)
export async function fetchFabricacionLoadForDate (fecha: string): Promise<{ count: number; capacity: number }> {
  const capacity = await fetchAreaCapacity('fabricacion')
  const { count, error } = await supabase
    .from('production_tickets')
    .select('*', { count: 'exact', head: true })
    .eq('fecha_programada', fecha)
    .eq('status', 'pendiente')
  if (error) throw new Error(error.message)
  return { count: count ?? 0, capacity }
}

// Carga de un empleado para una fecha (tickets de fabricación programados)
export async function fetchEmployeeLoadForDate (employeeId: string, fecha: string): Promise<{ count: number; capacity: number }> {
  const { data: capRow } = await supabase
    .from('production_employee_capacities')
    .select('daily_capacity')
    .eq('employee_id', employeeId)
    .eq('step', 'fabricacion')
    .maybeSingle()
  const capacity = capRow?.daily_capacity ?? 5
  const { count, error } = await supabase
    .from('production_tickets')
    .select('*', { count: 'exact', head: true })
    .eq('fabricador_id', employeeId)
    .eq('fecha_programada', fecha)
    .eq('status', 'pendiente')
  if (error) throw new Error(error.message)
  return { count: count ?? 0, capacity }
}
