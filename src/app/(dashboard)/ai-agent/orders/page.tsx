/**
 * File: src/app/(dashboard)/ai-agent/orders/page.tsx
 * Purpose: Merchant order management dashboard — everything needed for fulfillment
 *
 * Shows: customer name + phone, delivery address, items with images,
 * order total, payment method, order status with update controls,
 * status filters, search, and summary stats.
 */

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import {
  ShoppingCart, ArrowLeft, Package, Clock, CheckCircle2, XCircle,
  AlertCircle, Truck, MapPin, Phone, User, CreditCard, Search,
  IndianRupee, PackageCheck, PackageX, Filter,
} from 'lucide-react'
import { OrderStatusForm } from './status-form'

// ─── Types ────────────────────────────────────────────────────────────────────

interface AgentOrder {
  id: string
  contact_phone: string
  contact_name: string | null
  delivery_address: string | null
  items: CartItem[]
  total: number
  payment_method: string
  order_status: string
  razorpay_payment_id: string | null
  created_at: string
  updated_at: string
}

/** Matches CartItem from src/lib/ai-agent/cart.ts */
interface CartItem {
  productId: string
  externalId: string
  productName: string
  price: number
  currency: string
  quantity: number
  imageUrl: string | null
  productUrl: string | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function shortDate(iso: string) {
  return new Date(iso).toLocaleString('en-IN', {
    day: '2-digit', month: 'short',
    hour: '2-digit', minute: '2-digit',
  })
}

function formatPhone(phone: string) {
  // Format Indian numbers nicely
  if (phone.startsWith('91') && phone.length === 12) {
    return `+91 ${phone.slice(2, 7)} ${phone.slice(7)}`
  }
  return phone.startsWith('+') ? phone : `+${phone}`
}

const STATUS_CONFIG: Record<string, { label: string; icon: React.ElementType; cls: string; bgCls: string }> = {
  confirmed:        { label: 'Confirmed',         icon: CheckCircle2, cls: 'text-green-700 dark:text-green-400',  bgCls: 'bg-green-100 dark:bg-green-900/30' },
  processing:       { label: 'Processing',        icon: Package,      cls: 'text-blue-700 dark:text-blue-400',   bgCls: 'bg-blue-100 dark:bg-blue-900/30' },
  shipped:          { label: 'Shipped',            icon: Truck,        cls: 'text-purple-700 dark:text-purple-400', bgCls: 'bg-purple-100 dark:bg-purple-900/30' },
  delivered:        { label: 'Delivered',          icon: PackageCheck, cls: 'text-emerald-700 dark:text-emerald-400', bgCls: 'bg-emerald-100 dark:bg-emerald-900/30' },
  pending_payment:  { label: 'Pending Payment',   icon: Clock,        cls: 'text-yellow-700 dark:text-yellow-400', bgCls: 'bg-yellow-100 dark:bg-yellow-900/30' },
  payment_sent:     { label: 'Payment Link Sent', icon: CreditCard,   cls: 'text-blue-700 dark:text-blue-400',   bgCls: 'bg-blue-100 dark:bg-blue-900/30' },
  cancelled:        { label: 'Cancelled',          icon: XCircle,      cls: 'text-red-700 dark:text-red-400',     bgCls: 'bg-red-100 dark:bg-red-900/30' },
  failed:           { label: 'Failed',             icon: PackageX,     cls: 'text-red-700 dark:text-red-400',     bgCls: 'bg-red-100 dark:bg-red-900/30' },
}

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_CONFIG[status] ?? { label: status, icon: AlertCircle, cls: 'text-gray-600 dark:text-gray-300', bgCls: 'bg-gray-100 dark:bg-gray-700' }
  const Icon = s.icon
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${s.bgCls} ${s.cls}`}>
      <Icon className="h-3.5 w-3.5" />
      {s.label}
    </span>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function AiAgentOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; search?: string }>
}) {
  const params = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Fetch all orders
  const { data: orders, error } = await supabase
    .from('ai_agent_orders')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (error) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-4 p-6 text-center">
        <AlertCircle className="h-10 w-10 text-red-500" />
        <p className="text-gray-600 dark:text-gray-400">Failed to load orders: {error.message}</p>
        <Link href="/ai-agent" className="text-sm text-indigo-600 underline dark:text-indigo-400">Back to AI Agent</Link>
      </div>
    )
  }

  const allOrders = (orders ?? []) as AgentOrder[]

  // Filter by status
  const statusFilter = params.status || 'all'
  const searchQuery = (params.search || '').toLowerCase().trim()

  let filteredOrders = allOrders
  if (statusFilter !== 'all') {
    filteredOrders = filteredOrders.filter(o => o.order_status === statusFilter)
  }
  if (searchQuery) {
    filteredOrders = filteredOrders.filter(o =>
      (o.contact_name || '').toLowerCase().includes(searchQuery) ||
      o.contact_phone.includes(searchQuery) ||
      (o.delivery_address || '').toLowerCase().includes(searchQuery) ||
      o.items.some(item => (item.productName || '').toLowerCase().includes(searchQuery))
    )
  }

  // Stats
  const totalOrders = allOrders.length
  const confirmedCount = allOrders.filter(o => o.order_status === 'confirmed').length
  const pendingCount = allOrders.filter(o => ['pending_payment', 'payment_sent'].includes(o.order_status)).length
  const deliveredCount = allOrders.filter(o => o.order_status === 'delivered').length
  const totalRevenue = allOrders
    .filter(o => !['cancelled', 'failed'].includes(o.order_status))
    .reduce((sum, o) => sum + Number(o.total), 0)
  const codCount = allOrders.filter(o => o.payment_method === 'COD').length
  const onlineCount = allOrders.filter(o => o.payment_method === 'ONLINE').length

  return (
    <div className="space-y-6 p-4 sm:p-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/ai-agent"
            className="rounded-lg border border-gray-200 bg-white p-2 text-gray-500 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Order Management</h1>
            <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
              Manage orders, track deliveries, view customer details
            </p>
          </div>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard icon={ShoppingCart} label="Total Orders" value={String(totalOrders)} />
        <StatCard icon={CheckCircle2} label="Confirmed" value={String(confirmedCount)} color="green" />
        <StatCard icon={Clock} label="Pending" value={String(pendingCount)} color="yellow" />
        <StatCard icon={PackageCheck} label="Delivered" value={String(deliveredCount)} color="emerald" />
        <StatCard icon={IndianRupee} label="Revenue" value={`₹${totalRevenue.toLocaleString('en-IN')}`} color="indigo" />
        <StatCard icon={CreditCard} label="COD / Online" value={`${codCount} / ${onlineCount}`} />
      </div>

      {/* Filters + Search */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        {/* Status filter tabs */}
        <div className="flex flex-wrap gap-2">
          {[
            { key: 'all', label: 'All', count: totalOrders },
            { key: 'confirmed', label: 'Confirmed', count: confirmedCount },
            { key: 'pending_payment', label: 'Pending', count: pendingCount },
            { key: 'shipped', label: 'Shipped', count: allOrders.filter(o => o.order_status === 'shipped').length },
            { key: 'delivered', label: 'Delivered', count: deliveredCount },
            { key: 'cancelled', label: 'Cancelled', count: allOrders.filter(o => o.order_status === 'cancelled').length },
          ].map(tab => (
            <Link
              key={tab.key}
              href={`/ai-agent/orders?status=${tab.key}${searchQuery ? `&search=${searchQuery}` : ''}`}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                statusFilter === tab.key
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700'
              }`}
            >
              {tab.label}
              {tab.count > 0 && (
                <span className={`rounded-full px-1.5 py-0.5 text-[10px] ${
                  statusFilter === tab.key
                    ? 'bg-white/20 text-white'
                    : 'bg-gray-200 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
                }`}>
                  {tab.count}
                </span>
              )}
            </Link>
          ))}
        </div>

        {/* Search */}
        <form className="relative sm:ml-auto sm:w-72" action="/ai-agent/orders" method="GET">
          <input type="hidden" name="status" value={statusFilter} />
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            name="search"
            defaultValue={searchQuery}
            placeholder="Search name, phone, address..."
            className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-10 pr-4 text-sm text-gray-900 placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:placeholder:text-gray-500"
          />
        </form>
      </div>

      {/* Empty state */}
      {filteredOrders.length === 0 && (
        <div className="flex min-h-[30vh] flex-col items-center justify-center gap-4 text-center">
          <div className="rounded-2xl bg-gray-100 p-6 dark:bg-gray-800">
            <ShoppingCart className="mx-auto h-12 w-12 text-gray-400" />
          </div>
          <div>
            <p className="font-semibold text-gray-900 dark:text-white">
              {totalOrders === 0 ? 'No orders yet' : 'No matching orders'}
            </p>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {totalOrders === 0
                ? 'Orders will appear here once customers place them via WhatsApp.'
                : 'Try a different filter or search term.'}
            </p>
          </div>
        </div>
      )}

      {/* Order Cards */}
      {filteredOrders.length > 0 && (
        <div className="space-y-4">
          {filteredOrders.map((order) => (
            <OrderCard key={order.id} order={order} />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function StatCard({ icon: Icon, label, value, color }: {
  icon: React.ElementType; label: string; value: string; color?: string
}) {
  const colorMap: Record<string, string> = {
    green: 'text-green-600 dark:text-green-400',
    yellow: 'text-yellow-600 dark:text-yellow-400',
    emerald: 'text-emerald-600 dark:text-emerald-400',
    indigo: 'text-indigo-600 dark:text-indigo-400',
  }
  const valueColor = color ? colorMap[color] || '' : 'text-gray-900 dark:text-white'

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-800">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-gray-400" />
        <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
      </div>
      <p className={`mt-1 text-lg font-semibold ${valueColor}`}>{value}</p>
    </div>
  )
}

function OrderCard({ order }: { order: AgentOrder }) {
  const items = order.items ?? []
  const customerName = order.contact_name || 'Customer'
  const orderId = order.id.slice(0, 8).toUpperCase()

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
      {/* Order header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-4 py-3 dark:border-gray-700">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-100 dark:bg-indigo-900/30">
            <Package className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-gray-900 dark:text-white">#{orderId}</span>
              <StatusBadge status={order.order_status} />
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">{formatDate(order.created_at)}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-lg font-bold text-gray-900 dark:text-white">
            ₹{Number(order.total).toLocaleString('en-IN')}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {order.payment_method === 'COD' ? '💵 Cash on Delivery' : '💳 Online Payment'}
          </p>
        </div>
      </div>

      <div className="grid gap-0 divide-y divide-gray-100 dark:divide-gray-700 lg:grid-cols-3 lg:divide-x lg:divide-y-0">
        {/* Customer Info */}
        <div className="p-4 space-y-2">
          <p className="text-xs font-medium uppercase tracking-wider text-gray-400">Customer</p>
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <User className="h-3.5 w-3.5 text-gray-400" />
              <span className="text-sm font-medium text-gray-900 dark:text-white">{customerName}</span>
            </div>
            <div className="flex items-center gap-2">
              <Phone className="h-3.5 w-3.5 text-gray-400" />
              <a
                href={`https://wa.me/${order.contact_phone}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-indigo-600 hover:underline dark:text-indigo-400"
              >
                {formatPhone(order.contact_phone)}
              </a>
            </div>
            {order.delivery_address && (
              <div className="flex items-start gap-2">
                <MapPin className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-gray-400" />
                <span className="text-sm text-gray-600 dark:text-gray-300">{order.delivery_address}</span>
              </div>
            )}
          </div>
        </div>

        {/* Items */}
        <div className="p-4 space-y-2">
          <p className="text-xs font-medium uppercase tracking-wider text-gray-400">
            Items ({items.length})
          </p>
          <div className="space-y-2">
            {items.map((item, i) => (
              <div key={i} className="flex items-center gap-3">
                {item.imageUrl ? (
                  <img
                    src={item.imageUrl}
                    alt={item.productName}
                    className="h-10 w-10 rounded-lg border border-gray-200 object-cover dark:border-gray-600"
                  />
                ) : (
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-700">
                    <Package className="h-5 w-5 text-gray-400" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="truncate text-sm font-medium text-gray-900 dark:text-white">
                    {item.productName || 'Unknown Product'}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    ₹{item.price.toLocaleString('en-IN')} × {item.quantity}
                    <span className="ml-2 font-medium text-gray-700 dark:text-gray-300">
                      = ₹{(item.price * item.quantity).toLocaleString('en-IN')}
                    </span>
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Actions / Status Update */}
        <div className="p-4 space-y-3">
          <p className="text-xs font-medium uppercase tracking-wider text-gray-400">Update Status</p>
          <OrderStatusForm orderId={order.id} currentStatus={order.order_status} />

          {order.razorpay_payment_id && (
            <div className="mt-2 rounded-lg bg-gray-50 p-2 dark:bg-gray-900/50">
              <p className="text-xs text-gray-500 dark:text-gray-400">Payment ID</p>
              <p className="truncate text-xs font-mono text-gray-700 dark:text-gray-300">
                {order.razorpay_payment_id}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
