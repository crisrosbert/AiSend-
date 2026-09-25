import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * Escape a value for CSV: wrap in double-quotes if it contains commas,
 * double-quotes, or newlines. Double-quote characters are escaped as "".
 */
function csvEscape(value: string): string {
  if (
    value.includes(',') ||
    value.includes('"') ||
    value.includes('\n') ||
    value.includes('\r')
  ) {
    return '"' + value.replace(/"/g, '""') + '"'
  }
  return value
}

interface CartItem {
  productName?: string
  quantity?: number
}

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = request.nextUrl
  const status = searchParams.get('status') || 'all'
  const from = searchParams.get('from')
  const to = searchParams.get('to')

  let query = supabase
    .from('ai_agent_orders')
    .select(
      'id, created_at, contact_name, contact_phone, delivery_address, items, total, payment_method, order_status, razorpay_payment_id, tracking_number'
    )
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (status && status !== 'all') {
    query = query.eq('order_status', status)
  }
  if (from) {
    query = query.gte('created_at', from)
  }
  if (to) {
    // Include the entire "to" day
    query = query.lte('created_at', to + 'T23:59:59.999Z')
  }

  const { data: orders, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Build CSV
  const headers = [
    'Order ID',
    'Date',
    'Customer Name',
    'Phone',
    'Address',
    'Items',
    'Quantity',
    'Total (INR)',
    'Payment Method',
    'Status',
    'Razorpay ID',
    'Tracking Number',
  ]

  const rows: string[] = [headers.map(csvEscape).join(',')]

  for (const order of orders || []) {
    const items: CartItem[] = Array.isArray(order.items) ? order.items : []
    const itemNames = items
      .map((i: CartItem) => i.productName || 'Unknown')
      .join('; ')
    const totalQty = items.reduce(
      (sum: number, i: CartItem) => sum + (i.quantity || 0),
      0
    )
    const date = order.created_at
      ? new Date(order.created_at).toLocaleDateString('en-IN', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        })
      : ''

    const row = [
      order.id || '',
      date,
      order.contact_name || '',
      order.contact_phone || '',
      order.delivery_address || '',
      itemNames,
      String(totalQty),
      order.total != null ? `₹${Number(order.total).toLocaleString('en-IN')}` : '',
      order.payment_method || '',
      order.order_status || '',
      order.razorpay_payment_id || '',
      order.tracking_number || '',
    ]

    rows.push(row.map(csvEscape).join(','))
  }

  const csv = rows.join('\r\n')
  const filename = `orders-${status}-${new Date().toISOString().slice(0, 10)}.csv`

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
