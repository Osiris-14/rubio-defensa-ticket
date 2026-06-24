import { NextRequest, NextResponse } from 'next/server'

// This API route would connect to Supabase in production
// For now it returns demo structure for Alegra integration

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const role = searchParams.get('role') || 'all'
  const format = searchParams.get('format') || 'json'
  const from = searchParams.get('from')
  const to = searchParams.get('to')

  // In production: query Supabase with filters
  // const { data } = await supabase.from(`tickets_${role}`).select('*').gte('created_at', from).lte('created_at', to)

  const mockData = {
    success: true,
    area: role,
    period: { from, to },
    meta: {
      endpoint: '/api/tickets',
      params: { role: 'recepcion|produccion|pintura|instalacion|marquilla|all', format: 'json|csv', from: 'ISO date', to: 'ISO date' },
      description: 'API para integración con Alegra y sistemas externos',
    },
    data: [],
    total: 0,
  }

  if (format === 'csv') {
    const headers = 'id,numero_factura,numero_orden,modelo,tipo_modelo,piezas,created_at,role'
    return new NextResponse(headers, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="rubio_tickets_${role}_${new Date().toISOString().split('T')[0]}.csv"`,
      },
    })
  }

  return NextResponse.json(mockData)
}
