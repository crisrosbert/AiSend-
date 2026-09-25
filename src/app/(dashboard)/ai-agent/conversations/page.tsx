/**
 * File: src/app/(dashboard)/ai-agent/conversations/page.tsx
 * Purpose: Enhanced conversation management — search, filter, stats, expandable chat threads
 *
 * Shows: customer phone with WhatsApp link, needs-human badge, cart indicator,
 * message count, last active time, filter tabs, search, summary stats,
 * and expandable full conversation threads with color-coded bubbles.
 */

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import {
  MessageSquare, Search, ArrowLeft, Phone, ShoppingCart,
  AlertTriangle, Clock, Users, ExternalLink,
} from 'lucide-react'
import { ChatThread } from './chat-thread'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Message {
  role: 'user' | 'assistant'
  content: string
  timestamp?: string
}

interface CartItem {
  productId: string
  productName: string
  price: number
  quantity: number
}

interface CartState {
  items?: CartItem[]
  [key: string]: unknown
}

interface Session {
  id: string
  contact_phone: string
  messages: Message[]
  cart: CartState | null
  needs_human: boolean
  created_at: string
  updated_at: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function formatPhone(phone: string) {
  if (phone.startsWith('91') && phone.length === 12) {
    return `+91 ${phone.slice(2, 7)} ${phone.slice(7)}`
  }
  return phone.startsWith('+') ? phone : `+${phone}`
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return formatDate(iso)
}

function isActiveSession(session: Session) {
  const dayMs = 24 * 60 * 60 * 1000
  return Date.now() - new Date(session.updated_at).getTime() < dayMs
}

function getCartItemCount(cart: CartState | null): number {
  if (!cart || !cart.items || !Array.isArray(cart.items)) return 0
  return cart.items.reduce((sum, item) => sum + (item.quantity || 1), 0)
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function AiAgentConversationsPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string; search?: string }>
}) {
  const params = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: sessions, error } = await supabase
    .from('ai_agent_sessions')
    .select('*')
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false })

  if (error) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-4 p-6 text-center">
        <AlertTriangle className="h-10 w-10 text-red-500" />
        <p className="text-gray-600 dark:text-gray-400">Failed to load conversations: {error.message}</p>
        <Link href="/ai-agent" className="text-sm text-indigo-600 underline dark:text-indigo-400">Back to AI Agent</Link>
      </div>
    )
  }

  const allSessions = (sessions ?? []) as Session[]

  // ─── Filtering ────────────────────────────────────────────────────────────

  const activeFilter = params.filter || 'all'
  const searchQuery = (params.search || '').toLowerCase().trim()

  let filteredSessions = allSessions

  // Apply tab filter
  switch (activeFilter) {
    case 'active':
      filteredSessions = filteredSessions.filter(isActiveSession)
      break
    case 'needs_human':
      filteredSessions = filteredSessions.filter(s => s.needs_human)
      break
    case 'resolved':
      filteredSessions = filteredSessions.filter(s => !s.needs_human && !isActiveSession(s))
      break
  }

  // Apply search
  if (searchQuery) {
    filteredSessions = filteredSessions.filter(s =>
      s.contact_phone.includes(searchQuery) ||
      formatPhone(s.contact_phone).toLowerCase().includes(searchQuery) ||
      (s.messages ?? []).some(m => m.content.toLowerCase().includes(searchQuery))
    )
  }

  // ─── Stats ────────────────────────────────────────────────────────────────

  const totalConversations = allSessions.length
  const activeToday = allSessions.filter(isActiveSession).length
  const needsHumanCount = allSessions.filter(s => s.needs_human).length
  const totalMessages = allSessions.reduce((sum, s) => sum + (s.messages ?? []).length, 0)

  // ─── Render ───────────────────────────────────────────────────────────────

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
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Conversations</h1>
            <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
              Monitor and manage AI agent customer chats
            </p>
          </div>
        </div>
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard icon={Users} label="Total Conversations" value={String(totalConversations)} />
        <StatCard icon={Clock} label="Active Today" value={String(activeToday)} color="green" />
        <StatCard icon={AlertTriangle} label="Needs Human" value={String(needsHumanCount)} color="orange" />
        <StatCard icon={MessageSquare} label="Total Messages" value={totalMessages.toLocaleString('en-IN')} color="indigo" />
      </div>

      {/* Filter Tabs + Search */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex flex-wrap gap-2">
          {[
            { key: 'all', label: 'All', count: totalConversations },
            { key: 'active', label: 'Active', count: activeToday },
            { key: 'needs_human', label: 'Needs Human', count: needsHumanCount },
            { key: 'resolved', label: 'Resolved', count: allSessions.filter(s => !s.needs_human && !isActiveSession(s)).length },
          ].map(tab => (
            <Link
              key={tab.key}
              href={`/ai-agent/conversations?filter=${tab.key}${searchQuery ? `&search=${searchQuery}` : ''}`}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                activeFilter === tab.key
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700'
              }`}
            >
              {tab.label}
              {tab.count > 0 && (
                <span className={`rounded-full px-1.5 py-0.5 text-[10px] ${
                  activeFilter === tab.key
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
        <form className="relative sm:ml-auto sm:w-72" action="/ai-agent/conversations" method="GET">
          <input type="hidden" name="filter" value={activeFilter} />
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            name="search"
            defaultValue={searchQuery}
            placeholder="Search phone or message..."
            className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-10 pr-4 text-sm text-gray-900 placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:placeholder:text-gray-500"
          />
        </form>
      </div>

      {/* Empty State */}
      {filteredSessions.length === 0 && (
        <div className="flex min-h-[30vh] flex-col items-center justify-center gap-4 text-center">
          <div className="rounded-2xl bg-gray-100 p-6 dark:bg-gray-800">
            <MessageSquare className="mx-auto h-12 w-12 text-gray-400" />
          </div>
          <div>
            <p className="font-semibold text-gray-900 dark:text-white">
              {totalConversations === 0 ? 'No conversations yet' : 'No matching conversations'}
            </p>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {totalConversations === 0
                ? 'Customer chats will appear here once the AI agent starts replying.'
                : 'Try a different filter or search term.'}
            </p>
          </div>
        </div>
      )}

      {/* Conversation Cards */}
      {filteredSessions.length > 0 && (
        <div className="space-y-3">
          {filteredSessions.map((session) => (
            <ConversationCard key={session.id} session={session} />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Sub-components ─────────────────────────────────────────────────────────

function StatCard({ icon: Icon, label, value, color }: {
  icon: React.ElementType; label: string; value: string; color?: string
}) {
  const colorMap: Record<string, string> = {
    green: 'text-green-600 dark:text-green-400',
    orange: 'text-orange-600 dark:text-orange-400',
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

function ConversationCard({ session }: { session: Session }) {
  const msgs = session.messages ?? []
  const msgCount = msgs.length
  const lastMsg = msgs[msgs.length - 1]
  const cartCount = getCartItemCount(session.cart)

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
      {/* Card header */}
      <div className="flex flex-wrap items-start justify-between gap-3 p-4">
        <div className="flex items-center gap-3 min-w-0">
          {/* Avatar */}
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-indigo-100 dark:bg-indigo-900/30">
            <MessageSquare className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
          </div>

          <div className="min-w-0">
            {/* Phone + badges row */}
            <div className="flex flex-wrap items-center gap-2">
              <a
                href={`https://wa.me/${session.contact_phone}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 font-medium text-gray-900 hover:text-indigo-600 dark:text-white dark:hover:text-indigo-400"
              >
                <Phone className="h-3.5 w-3.5" />
                {formatPhone(session.contact_phone)}
                <ExternalLink className="h-3 w-3 text-gray-400" />
              </a>

              {session.needs_human && (
                <span className="inline-flex items-center gap-1 rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">
                  <AlertTriangle className="h-3 w-3" />
                  Needs human
                </span>
              )}

              {cartCount > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                  <ShoppingCart className="h-3 w-3" />
                  {cartCount} {cartCount === 1 ? 'item' : 'items'} in cart
                </span>
              )}
            </div>

            {/* Last message preview */}
            {lastMsg && (
              <p className="mt-1 truncate text-sm text-gray-500 dark:text-gray-400">
                <span className="font-medium">{lastMsg.role === 'user' ? 'Customer' : 'Agent'}:</span>{' '}
                {lastMsg.content}
              </p>
            )}
          </div>
        </div>

        {/* Meta: time + message count */}
        <div className="flex-shrink-0 text-right">
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 whitespace-nowrap">
            {timeAgo(session.updated_at)}
          </p>
          <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
            {msgCount} {msgCount === 1 ? 'message' : 'messages'}
          </p>
          {isActiveSession(session) && (
            <span className="mt-1 inline-block h-2 w-2 rounded-full bg-green-500" title="Active in last 24h" />
          )}
        </div>
      </div>

      {/* Expandable chat thread (client component) */}
      <div className="px-4 pb-4">
        <ChatThread messages={msgs} sessionId={session.id} />
      </div>
    </div>
  )
}
