/**
 * File: src/app/(dashboard)/ai-agent/page.tsx
 * Purpose: AI Ecommerce Agent dashboard — shows config status, quick stats, setup CTA
 */

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Bot, Package, ShoppingCart, Users, Zap, AlertCircle, CheckCircle2, ChevronRight } from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface AgentStats {
  totalProducts: number
  totalSessions: number
  totalOrders: number
  totalRevenue: number
  currency: string
}

// ─── Data Fetchers ────────────────────────────────────────────────────────────

async function getAgentConfig(userId: string, supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data } = await supabase
    .from('ai_agent_configs')
    .select('*')
    .eq('user_id', userId)
    .single()
  return data
}

async function getAgentStats(userId: string, supabase: Awaited<ReturnType<typeof createClient>>): Promise<AgentStats> {
  const [products, sessions, orders] = await Promise.all([
    supabase.from('ai_agent_products').select('id', { count: 'exact', head: true }).eq('user_id', userId),
    supabase.from('ai_agent_sessions').select('id', { count: 'exact', head: true }).eq('user_id', userId),
    supabase.from('ai_agent_orders').select('total_amount, currency').eq('user_id', userId).eq('payment_status', 'confirmed'),
  ])

  const confirmedOrders = orders.data ?? []
  const totalRevenue = confirmedOrders.reduce((sum, o) => sum + Number(o.total_amount), 0)
  const currency = confirmedOrders[0]?.currency ?? 'INR'

  return {
    totalProducts: products.count ?? 0,
    totalSessions: sessions.count ?? 0,
    totalOrders: confirmedOrders.length,
    totalRevenue,
    currency,
  }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({ icon: Icon, label, value, href }: { icon: React.ElementType; label: string; value: string; href?: string }) {
  const inner = (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="rounded-lg bg-indigo-50 p-2 dark:bg-indigo-900/30">
          <Icon className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
        </div>
        <div>
          <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
          <p className="text-xl font-semibold text-gray-900 dark:text-white">{value}</p>
        </div>
      </div>
      {href && <ChevronRight className="h-4 w-4 text-gray-400 group-hover:text-indigo-500" />}
    </div>
  )
  if (href) {
    return (
      <Link href={href} className="group rounded-xl border border-gray-200 bg-white p-5 transition hover:border-indigo-300 hover:shadow-sm dark:border-gray-700 dark:bg-gray-800 dark:hover:border-indigo-700">
        {inner}
      </Link>
    )
  }
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
      {inner}
    </div>
  )
}

function StatusBadge({ enabled, scrapeStatus, embedStatus }: { enabled: boolean; scrapeStatus: string; embedStatus: string }) {
  if (!enabled) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-3 py-1 text-sm font-medium text-gray-600 dark:bg-gray-700 dark:text-gray-300">
        <span className="h-2 w-2 rounded-full bg-gray-400" />
        Disabled
      </span>
    )
  }
  if (scrapeStatus !== 'done' || embedStatus !== 'done') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-yellow-100 px-3 py-1 text-sm font-medium text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">
        <span className="h-2 w-2 animate-pulse rounded-full bg-yellow-500" />
        Setting up…
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-green-100 px-3 py-1 text-sm font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
      <span className="h-2 w-2 rounded-full bg-green-500" />
      Active
    </span>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function AiAgentPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [config, stats] = await Promise.all([
    getAgentConfig(user.id, supabase),
    getAgentStats(user.id, supabase),
  ])

  const sym = stats.currency === 'INR' ? '₹' : stats.currency

  // No config yet — show setup CTA
  if (!config) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 px-4 text-center">
        <div className="rounded-2xl bg-indigo-50 p-6 dark:bg-indigo-900/20">
          <Bot className="mx-auto h-14 w-14 text-indigo-600 dark:text-indigo-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">AI Ecommerce Agent</h1>
          <p className="mt-2 max-w-md text-gray-500 dark:text-gray-400">
            Let your customers shop via WhatsApp — product search, cart, and checkout fully automated by AI.
          </p>
        </div>
        <Link
          href="/ai-agent/settings"
          className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700"
        >
          <Zap className="h-4 w-4" />
          Set up AI Agent
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">AI Ecommerce Agent</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{config.store_name}</p>
        </div>
        <div className="flex items-center gap-3">
          <StatusBadge
            enabled={config.is_enabled}
            scrapeStatus={config.scrape_status ?? 'pending'}
            embedStatus={config.embed_status ?? 'pending'}
          />
          <Link
            href="/ai-agent/settings"
            className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            Settings
          </Link>
        </div>
      </div>

      {/* Setup warnings */}
      {config.scrape_status !== 'done' && (
        <div className="flex items-start gap-3 rounded-xl border border-yellow-200 bg-yellow-50 p-4 dark:border-yellow-800 dark:bg-yellow-900/20">
          <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-yellow-600 dark:text-yellow-400" />
          <div className="text-sm">
            <p className="font-medium text-yellow-800 dark:text-yellow-300">Product catalog not synced yet</p>
            <p className="mt-0.5 text-yellow-700 dark:text-yellow-400">
              Go to <Link href="/ai-agent/settings" className="underline">Settings</Link> → Sync Products to import your catalog.
            </p>
          </div>
        </div>
      )}

      {config.scrape_status === 'done' && config.embed_status !== 'done' && (
        <div className="flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-900/20">
          <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-blue-600 dark:text-blue-400" />
          <p className="text-sm text-blue-700 dark:text-blue-300">
            Embedding products for AI search… This takes a few minutes. Refresh to check status.
          </p>
        </div>
      )}

      {config.is_enabled && config.scrape_status === 'done' && config.embed_status === 'done' && (
        <div className="flex items-center gap-3 rounded-xl border border-green-200 bg-green-50 p-4 dark:border-green-800 dark:bg-green-900/20">
          <CheckCircle2 className="h-5 w-5 flex-shrink-0 text-green-600 dark:text-green-400" />
          <p className="text-sm font-medium text-green-700 dark:text-green-300">
            Agent is live — replying to customers on WhatsApp
          </p>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard icon={Package}      label="Products"         value={stats.totalProducts.toLocaleString()} href="/ai-agent/products" />
        <StatCard icon={Users}        label="Conversations"    value={stats.totalSessions.toLocaleString()} href="/ai-agent/conversations" />
        <StatCard icon={ShoppingCart} label="Orders Confirmed" value={stats.totalOrders.toLocaleString()}   href="/ai-agent/orders" />
        <StatCard icon={Zap}          label="Revenue"          value={`${sym}${stats.totalRevenue.toLocaleString()}`} />
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Link href="/ai-agent/settings" className="group rounded-xl border border-gray-200 bg-white p-5 hover:border-indigo-300 hover:shadow-sm dark:border-gray-700 dark:bg-gray-800 dark:hover:border-indigo-700">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-gray-900 group-hover:text-indigo-600 dark:text-white dark:group-hover:text-indigo-400">Agent Settings</h3>
            <ChevronRight className="h-4 w-4 text-gray-400 group-hover:text-indigo-500" />
          </div>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Brand voice, language, enable/disable, product sync</p>
        </Link>
        <Link href="/ai-agent/products" className="group rounded-xl border border-gray-200 bg-white p-5 hover:border-indigo-300 hover:shadow-sm dark:border-gray-700 dark:bg-gray-800 dark:hover:border-indigo-700">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-gray-900 group-hover:text-indigo-600 dark:text-white dark:group-hover:text-indigo-400">Product Catalog</h3>
            <ChevronRight className="h-4 w-4 text-gray-400 group-hover:text-indigo-500" />
          </div>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">View all {stats.totalProducts} synced products</p>
        </Link>
        <Link href="/ai-agent/orders" className="group rounded-xl border border-gray-200 bg-white p-5 hover:border-indigo-300 hover:shadow-sm dark:border-gray-700 dark:bg-gray-800 dark:hover:border-indigo-700">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-gray-900 group-hover:text-indigo-600 dark:text-white dark:group-hover:text-indigo-400">Orders</h3>
            <ChevronRight className="h-4 w-4 text-gray-400 group-hover:text-indigo-500" />
          </div>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">View all orders placed through the AI agent</p>
        </Link>
        <Link href="/ai-agent/conversations" className="group rounded-xl border border-gray-200 bg-white p-5 hover:border-indigo-300 hover:shadow-sm dark:border-gray-700 dark:bg-gray-800 dark:hover:border-indigo-700">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-gray-900 group-hover:text-indigo-600 dark:text-white dark:group-hover:text-indigo-400">Conversations</h3>
            <ChevronRight className="h-4 w-4 text-gray-400 group-hover:text-indigo-500" />
          </div>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">View customer chats handled by the AI agent</p>
        </Link>
      </div>
    </div>
  )
}
