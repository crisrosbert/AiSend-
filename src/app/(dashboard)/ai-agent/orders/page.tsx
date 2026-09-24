/**
 * File: src/app/(dashboard)/ai-agent/orders/page.tsx
 * Purpose: View all orders placed through the AI Agent
 */

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ShoppingCart, ArrowLeft, Package, Clock, CheckCircle2, XCircle, AlertCircle } from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface AgentOrder {
  id: string
  contact_phone: string
  items: OrderItem[]
  total_amount: number
  currency: string
  payment_method: string
  payment_status: string
  razorpay_link_id: string | null
  created_at: string
  updated_at: string
}

interface OrderItem {
  name: string
  quantity: number
  price: number
  currency?: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function currencySymbol(currency: string) {
  return currency === 'INR' ? '₹' : currency
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; icon: React.ElementType; cls: string }> = {
    confirmed:        { label: 'Confirmed',        icon: CheckCircle2, cls: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
    pending_payment:  { label: 'Pending Payment',  icon: Clock,        cls: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' },
    payment_sent:     { label: 'Payment Link Sent',icon: Clock,        cls: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
    cancelled:        { label: 'Cancelled',        icon: XCircle,      cls: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
    failed:           { label: 'Failed',           icon: XCircle,      cls: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
  }
  const s = map[status] ?? { label: status, icon: AlertCircle, cls: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300' }
  const Icon = s.icon
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${s.cls}`}>
      <Icon className="h-3.5 w-3.5" />
      {s.label}
    </span>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function AiAgentOrdersPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

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

  const typedOrders = (orders ?? []) as AgentOrder[]
  const sym = typedOrders[0] ? currencySymbol(typedOrders[0].currency) : '₹'

  const totalRevenue = typedOrders
    .filter(o => o.payment_status === 'confirmed')
    .reduce((sum, o) => sum + Number(o.total_amount), 0)

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/ai-agent"
          className="rounded-lg border border-gray-200 bg-white p-2 text-gray-500 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Orders</h1>
          <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
            All orders placed through the AI Agent
          </p>
        </div>
      </div>

      {/* Summary stats */}
      {typedOrders.length > 0 && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
            <p className="text-sm text-gray-500 dark:text-gray-400">Total Orders</p>
            <p className="mt-1 text-2xl font-semibold text-gray-900 dark:text-white">{typedOrders.length}</p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
            <p className="text-sm text-gray-500 dark:text-gray-400">Confirmed</p>
            <p className="mt-1 text-2xl font-semibold text-green-600 dark:text-green-400">
              {typedOrders.filter(o => o.payment_status === 'confirmed').length}
            </p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800 col-span-2 sm:col-span-1">
            <p className="text-sm text-gray-500 dark:text-gray-400">Revenue</p>
            <p className="mt-1 text-2xl font-semibold text-gray-900 dark:text-white">
              {sym}{totalRevenue.toLocaleString('en-IN')}
            </p>
          </div>
        </div>
      )}

      {/* Empty state */}
      {typedOrders.length === 0 && (
        <div className="flex min-h-[40vh] flex-col items-center justify-center gap-4 text-center">
          <div className="rounded-2xl bg-gray-100 p-6 dark:bg-gray-800">
            <ShoppingCart className="mx-auto h-12 w-12 text-gray-400" />
          </div>
          <div>
            <p className="font-semibold text-gray-900 dark:text-white">No orders yet</p>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Orders will appear here once customers place them via WhatsApp.
            </p>
          </div>
          <Link
            href="/ai-agent/settings"
            className="mt-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            Go to Settings
          </Link>
        </div>
      )}

      {/* Orders table */}
      {typedOrders.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
          {/* Mobile: card list */}
          <div className="divide-y divide-gray-100 dark:divide-gray-700 sm:hidden">
            {typedOrders.map((order) => (
              <div key={order.id} className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">{order.contact_phone}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{formatDate(order.created_at)}</p>
                  </div>
                  <StatusBadge status={order.payment_status} />
                </div>
                <div className="space-y-1">
                  {(order.items as OrderItem[]).map((item, i) => (
                    <div key={i} className="flex justify-between text-sm">
                      <span className="text-gray-600 dark:text-gray-300">{item.name} × {item.quantity}</span>
                      <span className="text-gray-900 dark:text-white">{sym}{(item.price * item.quantity).toLocaleString('en-IN')}</span>
                    </div>
                  ))}
                </div>
                <div className="flex justify-between border-t border-gray-100 pt-2 dark:border-gray-700">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Total</span>
                  <span className="text-sm font-semibold text-gray-900 dark:text-white">
                    {sym}{Number(order.total_amount).toLocaleString('en-IN')}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop: table */}
          <table className="hidden w-full sm:table">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-700">
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Customer</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Items</th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Total</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Payment</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {typedOrders.map((order) => (
                <tr key={order.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-100 dark:bg-indigo-900/30">
                        <Package className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                      </div>
                      <span className="text-sm font-medium text-gray-900 dark:text-white">{order.contact_phone}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="space-y-0.5">
                      {(order.items as OrderItem[]).slice(0, 2).map((item, i) => (
                        <p key={i} className="text-sm text-gray-600 dark:text-gray-300">
                          {item.name} × {item.quantity}
                        </p>
                      ))}
                      {(order.items as OrderItem[]).length > 2 && (
                        <p className="text-xs text-gray-400">+{(order.items as OrderItem[]).length - 2} more</p>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right text-sm font-semibold text-gray-900 dark:text-white">
                    {sym}{Number(order.total_amount).toLocaleString('en-IN')}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300 capitalize">
                    {order.payment_method.replace(/_/g, ' ')}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={order.payment_status} />
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">
                    {formatDate(order.created_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
