/**
 * File: src/app/(dashboard)/ai-agent/analytics/page.tsx
 * Purpose: AI Ecommerce Agent analytics dashboard — revenue, orders, products, conversions
 *
 * All charts are hand-rolled inline SVG. No charting libraries.
 * Server component — data fetched with Supabase on the server.
 */

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, TrendingUp, IndianRupee, ShoppingCart, Users,
  Package, BarChart3, CreditCard,
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

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

interface AgentOrder {
  id: string
  contact_phone: string
  contact_name: string | null
  items: CartItem[]
  total: number
  payment_method: string
  order_status: string
  created_at: string
}

interface DailyRevenue {
  date: string
  label: string
  revenue: number
}

interface ProductSales {
  name: string
  units: number
  revenue: number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number): string {
  return n.toLocaleString('en-IN')
}

function fmtCurrency(n: number): string {
  return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
}

function fmtCompact(n: number): string {
  if (n >= 10_00_000) return `₹${(n / 10_00_000).toFixed(1)}M`
  if (n >= 1_000) return `₹${(n / 1_000).toFixed(1)}K`
  return `₹${fmt(n)}`
}

function shortDate(iso: string): string {
  return new Date(iso).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  })
}

function periodLabel(period: string): string {
  if (period === '7') return 'Last 7 days'
  if (period === '90') return 'Last 90 days'
  return 'Last 30 days'
}

function daysAgo(days: number): Date {
  const d = new Date()
  d.setDate(d.getDate() - days)
  d.setHours(0, 0, 0, 0)
  return d
}

function trendPercent(current: number, previous: number): { value: number; up: boolean } {
  if (previous === 0) return { value: current > 0 ? 100 : 0, up: current > 0 }
  const pct = ((current - previous) / previous) * 100
  return { value: Math.abs(Math.round(pct)), up: pct >= 0 }
}

function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10)
}

// ─── Status colors ────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, { bar: string; text: string; label: string }> = {
  confirmed:       { bar: 'fill-green-500',   text: 'text-green-600 dark:text-green-400',   label: 'Confirmed' },
  processing:      { bar: 'fill-blue-500',    text: 'text-blue-600 dark:text-blue-400',     label: 'Processing' },
  shipped:         { bar: 'fill-purple-500',   text: 'text-purple-600 dark:text-purple-400', label: 'Shipped' },
  delivered:       { bar: 'fill-emerald-500',  text: 'text-emerald-600 dark:text-emerald-400', label: 'Delivered' },
  pending_payment: { bar: 'fill-yellow-500',   text: 'text-yellow-600 dark:text-yellow-400', label: 'Pending Payment' },
  cancelled:       { bar: 'fill-red-500',      text: 'text-red-600 dark:text-red-400',       label: 'Cancelled' },
  failed:          { bar: 'fill-red-400',      text: 'text-red-500 dark:text-red-400',       label: 'Failed' },
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function AiAgentAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>
}) {
  const params = await searchParams
  const period = ['7', '30', '90'].includes(params.period ?? '') ? params.period! : '30'
  const days = Number(period)

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // ── Fetch data ──────────────────────────────────────────────────────────────

  const periodStart = daysAgo(days)
  const prevPeriodStart = daysAgo(days * 2)

  const [ordersRes, sessionsRes, prevSessionsRes] = await Promise.all([
    supabase
      .from('ai_agent_orders')
      .select('id, contact_phone, contact_name, items, total, payment_method, order_status, created_at')
      .eq('user_id', user.id)
      .gte('created_at', prevPeriodStart.toISOString())
      .order('created_at', { ascending: false }),
    supabase
      .from('ai_agent_sessions')
      .select('id, contact_phone, created_at', { count: 'exact' })
      .eq('user_id', user.id)
      .gte('created_at', periodStart.toISOString()),
    supabase
      .from('ai_agent_sessions')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .gte('created_at', prevPeriodStart.toISOString())
      .lt('created_at', periodStart.toISOString()),
  ])

  const allOrders = (ordersRes.data ?? []) as AgentOrder[]

  // Split orders into current and previous period
  const currentOrders = allOrders.filter(o => new Date(o.created_at) >= periodStart)
  const prevOrders = allOrders.filter(o => new Date(o.created_at) < periodStart)

  const currentSessions = sessionsRes.count ?? 0
  const prevSessions = prevSessionsRes.count ?? 0

  // ── Stat card calculations ──────────────────────────────────────────────────

  const validStatuses = ['confirmed', 'processing', 'shipped', 'delivered']

  const currentRevenue = currentOrders
    .filter(o => validStatuses.includes(o.order_status))
    .reduce((s, o) => s + Number(o.total), 0)
  const prevRevenue = prevOrders
    .filter(o => validStatuses.includes(o.order_status))
    .reduce((s, o) => s + Number(o.total), 0)

  const currentOrderCount = currentOrders.length
  const prevOrderCount = prevOrders.length

  const avgOrderValue = currentOrderCount > 0 ? currentRevenue / currentOrderCount : 0
  const prevAvgOrderValue = prevOrderCount > 0 ? prevRevenue / prevOrderCount : 0

  // Conversion: sessions that became orders / total sessions
  const orderPhones = new Set(currentOrders.map(o => o.contact_phone))
  const conversionRate = currentSessions > 0
    ? (orderPhones.size / currentSessions) * 100
    : 0
  const prevOrderPhones = new Set(prevOrders.map(o => o.contact_phone))
  const prevConversionRate = prevSessions > 0
    ? (prevOrderPhones.size / prevSessions) * 100
    : 0

  const activeCustomers = new Set(currentOrders.map(o => o.contact_phone)).size
  const prevActiveCustomers = new Set(prevOrders.map(o => o.contact_phone)).size

  const revenueTrend = trendPercent(currentRevenue, prevRevenue)
  const orderTrend = trendPercent(currentOrderCount, prevOrderCount)
  const aovTrend = trendPercent(avgOrderValue, prevAvgOrderValue)
  const convTrend = trendPercent(conversionRate, prevConversionRate)
  const custTrend = trendPercent(activeCustomers, prevActiveCustomers)

  // ── Daily revenue for bar chart ─────────────────────────────────────────────

  const dailyMap = new Map<string, number>()
  for (let i = 0; i < days; i++) {
    const d = new Date(periodStart)
    d.setDate(d.getDate() + i)
    dailyMap.set(dayKey(d), 0)
  }
  for (const o of currentOrders) {
    if (validStatuses.includes(o.order_status)) {
      const k = dayKey(new Date(o.created_at))
      dailyMap.set(k, (dailyMap.get(k) ?? 0) + Number(o.total))
    }
  }
  const dailyRevenue: DailyRevenue[] = Array.from(dailyMap.entries()).map(([date, revenue]) => ({
    date,
    label: new Date(date + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
    revenue,
  }))

  // ── Orders by status ────────────────────────────────────────────────────────

  const statusCounts: Record<string, number> = {}
  for (const o of currentOrders) {
    statusCounts[o.order_status] = (statusCounts[o.order_status] ?? 0) + 1
  }
  const statusEntries = Object.entries(statusCounts).sort((a, b) => b[1] - a[1])
  const maxStatusCount = Math.max(...statusEntries.map(e => e[1]), 1)

  // ── Top 5 products ──────────────────────────────────────────────────────────

  const productMap = new Map<string, { units: number; revenue: number }>()
  for (const o of currentOrders) {
    if (!validStatuses.includes(o.order_status)) continue
    for (const item of (o.items ?? [])) {
      const name = item.productName || 'Unknown'
      const existing = productMap.get(name) ?? { units: 0, revenue: 0 }
      existing.units += item.quantity
      existing.revenue += item.price * item.quantity
      productMap.set(name, existing)
    }
  }
  const topProducts: ProductSales[] = Array.from(productMap.entries())
    .map(([name, data]) => ({ name, ...data }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5)

  // ── Payment method split ────────────────────────────────────────────────────

  const codOrders = currentOrders.filter(o => o.payment_method === 'COD').length
  const onlineOrders = currentOrders.filter(o => o.payment_method === 'ONLINE').length
  const paymentTotal = codOrders + onlineOrders
  const codPct = paymentTotal > 0 ? Math.round((codOrders / paymentTotal) * 100) : 0
  const onlinePct = paymentTotal > 0 ? 100 - codPct : 0

  // ── Recent 5 orders ─────────────────────────────────────────────────────────

  const recentOrders = currentOrders.slice(0, 5)

  // ── SVG chart dimensions ────────────────────────────────────────────────────

  const chartW = 700
  const chartH = 220
  const chartPadL = 60
  const chartPadR = 20
  const chartPadT = 10
  const chartPadB = 40
  const plotW = chartW - chartPadL - chartPadR
  const plotH = chartH - chartPadT - chartPadB
  const maxRevenue = Math.max(...dailyRevenue.map(d => d.revenue), 1)
  const barCount = dailyRevenue.length
  const gap = Math.max(1, Math.round(plotW * 0.15 / barCount))
  const barW = Math.max(2, Math.floor((plotW - gap * (barCount - 1)) / barCount))

  // Y-axis ticks (5 nice ticks)
  const yStep = Math.ceil(maxRevenue / 4 / (10 ** Math.floor(Math.log10(maxRevenue / 4)))) * (10 ** Math.floor(Math.log10(maxRevenue / 4)))
  const yTicks = [0, yStep, yStep * 2, yStep * 3, yStep * 4].filter(v => v <= maxRevenue * 1.2)

  // Show every Nth label so they don't overlap
  const labelEvery = barCount <= 10 ? 1 : barCount <= 31 ? Math.ceil(barCount / 10) : Math.ceil(barCount / 15)

  return (
    <div className="space-y-6 p-4 sm:p-6">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/ai-agent"
            className="rounded-lg border border-gray-200 bg-white p-2 text-gray-500 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Analytics</h1>
            <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
              AI Agent performance overview
            </p>
          </div>
        </div>

        {/* Period selector */}
        <div className="flex items-center gap-2">
          {(['7', '30', '90'] as const).map(p => (
            <Link
              key={p}
              href={`/ai-agent/analytics?period=${p}`}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                period === p
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700'
              }`}
            >
              {p === '7' ? '7D' : p === '30' ? '30D' : '90D'}
            </Link>
          ))}
        </div>
      </div>

      {/* ── Stat Cards ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <KpiCard
          icon={IndianRupee}
          label="Total Revenue"
          value={fmtCurrency(currentRevenue)}
          trend={revenueTrend}
          period={periodLabel(period)}
        />
        <KpiCard
          icon={ShoppingCart}
          label="Total Orders"
          value={fmt(currentOrderCount)}
          trend={orderTrend}
          period={periodLabel(period)}
        />
        <KpiCard
          icon={BarChart3}
          label="Avg Order Value"
          value={fmtCurrency(Math.round(avgOrderValue))}
          trend={aovTrend}
          period={periodLabel(period)}
        />
        <KpiCard
          icon={TrendingUp}
          label="Conversion Rate"
          value={`${conversionRate.toFixed(1)}%`}
          trend={convTrend}
          period={periodLabel(period)}
        />
        <KpiCard
          icon={Users}
          label="Active Customers"
          value={fmt(activeCustomers)}
          trend={custTrend}
          period={periodLabel(period)}
        />
      </div>

      {/* ── Revenue Chart ──────────────────────────────────────────────────── */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
        <h2 className="mb-4 text-base font-semibold text-gray-900 dark:text-white">
          Daily Revenue
        </h2>

        {dailyRevenue.length === 0 ? (
          <p className="py-8 text-center text-sm text-gray-400">No data for this period</p>
        ) : (
          <div className="overflow-x-auto">
            <svg
              viewBox={`0 0 ${chartW} ${chartH}`}
              className="w-full min-w-[500px]"
              role="img"
              aria-label="Daily revenue bar chart"
            >
              {/* Y grid lines + labels */}
              {yTicks.map(v => {
                const y = chartPadT + plotH - (v / (maxRevenue * 1.1)) * plotH
                return (
                  <g key={v}>
                    <line
                      x1={chartPadL} y1={y} x2={chartW - chartPadR} y2={y}
                      className="stroke-gray-200 dark:stroke-gray-700" strokeWidth={1}
                    />
                    <text
                      x={chartPadL - 8} y={y + 4}
                      className="fill-gray-400 dark:fill-gray-500"
                      fontSize={11} textAnchor="end"
                    >
                      {fmtCompact(v)}
                    </text>
                  </g>
                )
              })}

              {/* Bars */}
              {dailyRevenue.map((d, i) => {
                const barH = maxRevenue > 0 ? (d.revenue / (maxRevenue * 1.1)) * plotH : 0
                const x = chartPadL + i * (barW + gap)
                const y = chartPadT + plotH - barH
                return (
                  <g key={d.date}>
                    <rect
                      x={x} y={y} width={barW} height={Math.max(barH, 0)}
                      rx={Math.min(3, barW / 2)}
                      className="fill-indigo-500 dark:fill-indigo-400"
                    />
                    {/* X labels */}
                    {i % labelEvery === 0 && (
                      <text
                        x={x + barW / 2}
                        y={chartH - 6}
                        className="fill-gray-400 dark:fill-gray-500"
                        fontSize={10}
                        textAnchor="middle"
                      >
                        {d.label}
                      </text>
                    )}
                  </g>
                )
              })}
            </svg>
          </div>
        )}
      </div>

      {/* ── Middle row: Orders by status + Payment split ────────────────── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Orders by status */}
        <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
          <h2 className="mb-4 text-base font-semibold text-gray-900 dark:text-white">
            Orders by Status
          </h2>

          {statusEntries.length === 0 ? (
            <p className="py-4 text-center text-sm text-gray-400">No orders in this period</p>
          ) : (
            <div className="space-y-3">
              {statusEntries.map(([status, count]) => {
                const cfg = STATUS_COLORS[status] ?? { bar: 'fill-gray-400', text: 'text-gray-500', label: status }
                const pct = Math.round((count / maxStatusCount) * 100)
                return (
                  <div key={status} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className={`font-medium ${cfg.text}`}>{cfg.label}</span>
                      <span className="text-gray-500 dark:text-gray-400">{count}</span>
                    </div>
                    <svg viewBox="0 0 200 12" className="w-full" aria-hidden>
                      <rect x={0} y={0} width={200} height={12} rx={6}
                        className="fill-gray-100 dark:fill-gray-700" />
                      <rect x={0} y={0} width={Math.max(pct * 2, 4)} height={12} rx={6}
                        className={cfg.bar} />
                    </svg>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Payment method split */}
        <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
          <h2 className="mb-4 text-base font-semibold text-gray-900 dark:text-white">
            Payment Methods
          </h2>

          {paymentTotal === 0 ? (
            <p className="py-4 text-center text-sm text-gray-400">No orders in this period</p>
          ) : (
            <div className="space-y-5">
              {/* Stacked bar */}
              <svg viewBox="0 0 300 32" className="w-full" aria-label="COD vs Online payment split">
                <rect x={0} y={0} width={300} height={32} rx={8}
                  className="fill-gray-100 dark:fill-gray-700" />
                {codPct > 0 && (
                  <rect x={0} y={0} width={codPct * 3} height={32}
                    rx={8}
                    className="fill-amber-500" />
                )}
                {onlinePct > 0 && codPct < 100 && (
                  <rect x={codPct * 3} y={0} width={onlinePct * 3} height={32}
                    rx={codPct === 0 ? 8 : 0}
                    className="fill-indigo-500" />
                )}
              </svg>

              {/* Legend */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="inline-block h-3 w-3 rounded-full bg-amber-500" />
                  <span className="text-sm text-gray-600 dark:text-gray-300">
                    COD <span className="font-semibold">{codPct}%</span>
                    <span className="ml-1 text-xs text-gray-400">({codOrders})</span>
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="inline-block h-3 w-3 rounded-full bg-indigo-500" />
                  <span className="text-sm text-gray-600 dark:text-gray-300">
                    Online <span className="font-semibold">{onlinePct}%</span>
                    <span className="ml-1 text-xs text-gray-400">({onlineOrders})</span>
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Bottom row: Top products + Recent orders ───────────────────── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Top 5 Products */}
        <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
          <div className="mb-4 flex items-center gap-2">
            <Package className="h-4 w-4 text-gray-400" />
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">
              Top Products
            </h2>
          </div>

          {topProducts.length === 0 ? (
            <p className="py-4 text-center text-sm text-gray-400">No product data yet</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-gray-700">
                    <th className="pb-2 text-left font-medium text-gray-500 dark:text-gray-400">Product</th>
                    <th className="pb-2 text-right font-medium text-gray-500 dark:text-gray-400">Units</th>
                    <th className="pb-2 text-right font-medium text-gray-500 dark:text-gray-400">Revenue</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
                  {topProducts.map((p, i) => (
                    <tr key={i}>
                      <td className="py-2.5 pr-4">
                        <div className="flex items-center gap-2">
                          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-indigo-50 text-xs font-semibold text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400">
                            {i + 1}
                          </span>
                          <span className="max-w-[180px] truncate font-medium text-gray-900 dark:text-white">
                            {p.name}
                          </span>
                        </div>
                      </td>
                      <td className="py-2.5 text-right text-gray-600 dark:text-gray-300">{fmt(p.units)}</td>
                      <td className="py-2.5 text-right font-medium text-gray-900 dark:text-white">{fmtCurrency(p.revenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Recent Orders */}
        <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShoppingCart className="h-4 w-4 text-gray-400" />
              <h2 className="text-base font-semibold text-gray-900 dark:text-white">
                Recent Orders
              </h2>
            </div>
            <Link
              href="/ai-agent/orders"
              className="text-xs font-medium text-indigo-600 hover:underline dark:text-indigo-400"
            >
              View all
            </Link>
          </div>

          {recentOrders.length === 0 ? (
            <p className="py-4 text-center text-sm text-gray-400">No recent orders</p>
          ) : (
            <div className="divide-y divide-gray-50 dark:divide-gray-700/50">
              {recentOrders.map(o => {
                const statusCfg = STATUS_COLORS[o.order_status]
                return (
                  <div key={o.id} className="flex items-center justify-between py-2.5">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-900 dark:text-white">
                          #{o.id.slice(0, 8).toUpperCase()}
                        </span>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                          statusCfg
                            ? `${statusCfg.text} bg-opacity-10`
                            : 'text-gray-500'
                        }`}>
                          {statusCfg?.label ?? o.order_status}
                        </span>
                      </div>
                      <p className="mt-0.5 truncate text-xs text-gray-500 dark:text-gray-400">
                        {o.contact_name || o.contact_phone} &middot; {shortDate(o.created_at)}
                      </p>
                    </div>
                    <span className="ml-3 whitespace-nowrap text-sm font-semibold text-gray-900 dark:text-white">
                      {fmtCurrency(Number(o.total))}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function KpiCard({
  icon: Icon,
  label,
  value,
  trend,
  period,
}: {
  icon: React.ElementType
  label: string
  value: string
  trend: { value: number; up: boolean }
  period: string
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
      <div className="flex items-center gap-2">
        <div className="rounded-lg bg-indigo-50 p-2 dark:bg-indigo-900/30">
          <Icon className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
      </div>
      <p className="mt-2 text-xl font-bold text-gray-900 dark:text-white">{value}</p>
      <div className="mt-1 flex items-center gap-1">
        {trend.value > 0 ? (
          <>
            <svg width={12} height={12} viewBox="0 0 12 12" className={trend.up ? 'text-green-500' : 'text-red-500'}>
              <path
                d={trend.up ? 'M6 2L10 7H2L6 2Z' : 'M6 10L2 5H10L6 10Z'}
                fill="currentColor"
              />
            </svg>
            <span className={`text-xs font-medium ${trend.up ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
              {trend.value}%
            </span>
          </>
        ) : (
          <span className="text-xs text-gray-400">--</span>
        )}
        <span className="text-[10px] text-gray-400">vs prev</span>
      </div>
    </div>
  )
}
