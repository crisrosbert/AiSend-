'use client'

// src/components/settings/webhook-manager.tsx
//
// Settings tab for outbound webhooks: register an endpoint, see its
// recent deliveries, replay a failed one, rotate/delete. The signing
// secret is shown exactly once — on create and on rotate — in a
// copyable box, never again after that, matching how the backend
// stores it (encrypted, never returned by GET).

import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Plus, Trash2, RefreshCw, ChevronDown, ChevronUp, Copy, Check, Send, Search, Unlink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

const EVENT_TYPES = [
  { value: 'message.received', label: 'Message received' },
  { value: 'message.sent', label: 'Message sent' },
  { value: 'message.status_updated', label: 'Message status updated' },
  { value: 'conversation.created', label: 'Conversation created' },
] as const

interface Endpoint {
  id: string
  url: string
  description: string | null
  events: string[]
  is_active: boolean
  consecutive_failures: number
  disabled_at: string | null
  created_at: string
}

interface Delivery {
  id: string
  event_type: string
  status: 'pending' | 'succeeded' | 'failed' | 'abandoned'
  attempt_count: number
  next_attempt_at: string
  last_attempt_at: string | null
  last_status_code: number | null
  last_error: string | null
  created_at: string
}

const EMPTY_FORM = { url: '', description: '', events: [] as string[] }

function StatusPill({ status }: { status: Delivery['status'] }) {
  const styles: Record<Delivery['status'], string> = {
    succeeded: 'bg-emerald-50 text-emerald-700',
    pending: 'bg-amber-50 text-amber-700',
    failed: 'bg-amber-50 text-amber-700',
    abandoned: 'bg-red-50 text-red-700',
  }
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${styles[status]}`}>
      {status}
    </span>
  )
}

function SecretReveal({ secret, onClose }: { secret: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false)
  return (
    <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-4">
      <p className="text-sm font-semibold text-amber-800">
        Save this signing secret now — it won&apos;t be shown again.
      </p>
      <div className="mt-2 flex items-center gap-2">
        <code className="flex-1 truncate rounded-md bg-white px-3 py-2 text-xs text-slate-700 border border-amber-200">
          {secret}
        </code>
        <button
          type="button"
          onClick={() => {
            navigator.clipboard.writeText(secret).then(() => {
              setCopied(true)
              setTimeout(() => setCopied(false), 2000)
            }).catch(() => {})
          }}
          className="shrink-0 rounded-md border border-amber-200 bg-white p-2 text-amber-700 hover:bg-amber-100"
        >
          {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
        </button>
      </div>
      <button type="button" onClick={onClose} className="mt-2 text-xs font-semibold text-amber-700 hover:underline">
        Done, I&apos;ve saved it
      </button>
    </div>
  )
}

function DeliveryLog({ endpointId }: { endpointId: string }) {
  const [deliveries, setDeliveries] = useState<Delivery[]>([])
  const [loading, setLoading] = useState(true)
  const [replayingId, setReplayingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/webhooks/deliveries?endpoint_id=${endpointId}&limit=15`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setDeliveries(data.deliveries ?? [])
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load deliveries')
    } finally {
      setLoading(false)
    }
  }, [endpointId])

  useEffect(() => { load() }, [load])

  async function replay(id: string) {
    setReplayingId(id)
    try {
      const res = await fetch(`/api/webhooks/deliveries/${id}/replay`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast.success(data.delivery?.status === 'succeeded' ? 'Redelivered successfully' : 'Redelivery attempted')
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Replay failed')
    } finally {
      setReplayingId(null)
    }
  }

  if (loading) return <p className="px-4 py-3 text-xs text-slate-400">Loading deliveries…</p>
  if (deliveries.length === 0) return <p className="px-4 py-3 text-xs text-slate-400">No deliveries yet.</p>

  return (
    <div className="divide-y divide-slate-100 border-t border-slate-100">
      {deliveries.map((d) => (
        <div key={d.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-700">{d.event_type}</span>
              <StatusPill status={d.status} />
              {d.last_status_code != null && (
                <span className="text-xs text-slate-400">HTTP {d.last_status_code}</span>
              )}
            </div>
            <p className="mt-0.5 text-xs text-slate-400">
              {new Date(d.created_at).toLocaleString()} · {d.attempt_count} attempt{d.attempt_count === 1 ? '' : 's'}
              {d.last_error ? ` · ${d.last_error}` : ''}
            </p>
          </div>
          {(d.status === 'failed' || d.status === 'abandoned') && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={replayingId === d.id}
              onClick={() => replay(d.id)}
            >
              <RefreshCw className={`size-3.5 ${replayingId === d.id ? 'animate-spin' : ''}`} />
              Replay
            </Button>
          )}
        </div>
      ))}
    </div>
  )
}

export function WebhookManager() {
  const [endpoints, setEndpoints] = useState<Endpoint[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [revealSecret, setRevealSecret] = useState<{ id: string; secret: string } | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/webhooks/endpoints')
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setEndpoints(data.endpoints ?? [])
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load webhook endpoints')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  function toggleEvent(value: string) {
    setForm((f) => ({
      ...f,
      events: f.events.includes(value) ? f.events.filter((e) => e !== value) : [...f.events, value],
    }))
  }

  async function createEndpoint() {
    if (!form.url.trim()) {
      toast.error('URL is required')
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/webhooks/endpoints', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setForm(EMPTY_FORM)
      setShowForm(false)
      setRevealSecret({ id: data.endpoint.id, secret: data.secret })
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create endpoint')
    } finally {
      setSaving(false)
    }
  }

  async function rotateSecret(id: string) {
    try {
      const res = await fetch(`/api/webhooks/endpoints/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rotate_secret: true }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setRevealSecret({ id, secret: data.secret })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to rotate secret')
    }
  }

  const [testingId, setTestingId] = useState<string | null>(null)

  async function sendTestEvent(id: string) {
    setTestingId(id)
    try {
      const res = await fetch(`/api/webhooks/endpoints/${id}/test`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      const status = data.delivery?.status
      if (status === 'succeeded') toast.success('Test event delivered')
      else toast.error(`Test event ${status ?? 'not delivered'} — check the delivery log below`)
      if (expandedId === id) setExpandedId(null) // force remount so the log refetches
      setTimeout(() => setExpandedId(id), 0)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to send test event')
    } finally {
      setTestingId(null)
    }
  }

  async function toggleActive(endpoint: Endpoint) {
    try {
      const res = await fetch(`/api/webhooks/endpoints/${endpoint.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !endpoint.is_active }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update endpoint')
    }
  }

  async function deleteEndpoint(id: string) {
    try {
      const res = await fetch(`/api/webhooks/endpoints/${id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setConfirmDeleteId(null)
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete endpoint')
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-[#e7ece9] bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-[#0c1f17]">Webhooks</h2>
            <p className="mt-1 text-sm text-slate-500">
              Notify your own systems the moment something happens on WhatsApp — a message arrives, an
              ad lead lands, a template gets approved. Signed with HMAC-SHA256, retried automatically.
            </p>
          </div>
          {!showForm && (
            <Button type="button" onClick={() => setShowForm(true)}>
              <Plus className="size-4" /> Add endpoint
            </Button>
          )}
        </div>

        {revealSecret && (
          <SecretReveal secret={revealSecret.secret} onClose={() => setRevealSecret(null)} />
        )}

        {showForm && (
          <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50 p-4">
            <label className="block text-xs font-semibold text-slate-600 mb-1">Endpoint URL (https only)</label>
            <Input
              value={form.url}
              onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
              placeholder="https://your-server.com/webhooks/aisend"
            />
            <label className="block text-xs font-semibold text-slate-600 mt-3 mb-1">Description (optional)</label>
            <Input
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="e.g. Order-sync backend"
            />
            <label className="block text-xs font-semibold text-slate-600 mt-3 mb-1">
              Events (leave all unchecked to receive everything)
            </label>
            <div className="flex flex-wrap gap-2">
              {EVENT_TYPES.map((e) => (
                <button
                  key={e.value}
                  type="button"
                  onClick={() => toggleEvent(e.value)}
                  className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
                    form.events.includes(e.value)
                      ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                      : 'border-slate-200 bg-white text-slate-500 hover:border-emerald-200'
                  }`}
                >
                  {e.label}
                </button>
              ))}
            </div>
            <div className="mt-4 flex gap-2">
              <Button type="button" onClick={createEndpoint} disabled={saving}>
                {saving ? 'Creating…' : 'Create endpoint'}
              </Button>
              <Button type="button" variant="outline" onClick={() => { setShowForm(false); setForm(EMPTY_FORM) }}>
                Cancel
              </Button>
            </div>
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-[#e7ece9] bg-white shadow-sm overflow-hidden">
        {loading ? (
          <p className="px-6 py-8 text-center text-sm text-slate-400">Loading…</p>
        ) : endpoints.length === 0 ? (
          <p className="px-6 py-8 text-center text-sm text-slate-400">
            No endpoints yet — add one to start receiving events.
          </p>
        ) : (
          <div className="divide-y divide-slate-100">
            {endpoints.map((ep) => {
              const expanded = expandedId === ep.id
              return (
                <div key={ep.id}>
                  <div className="flex items-center justify-between gap-3 px-6 py-4">
                    <button
                      type="button"
                      onClick={() => setExpandedId(expanded ? null : ep.id)}
                      className="flex min-w-0 items-center gap-2 text-left"
                    >
                      {expanded ? <ChevronUp className="size-4 shrink-0 text-slate-400" /> : <ChevronDown className="size-4 shrink-0 text-slate-400" />}
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-800">{ep.url}</p>
                        <p className="text-xs text-slate-400">
                          {ep.description || 'No description'} ·{' '}
                          {ep.events.length === 0 ? 'All events' : ep.events.join(', ')}
                        </p>
                      </div>
                    </button>
                    <div className="flex shrink-0 items-center gap-2">
                      {!ep.is_active && (
                        <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-700">
                          Disabled{ep.consecutive_failures >= 20 ? ' (auto)' : ''}
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => toggleActive(ep)}
                        className="text-xs font-semibold text-slate-500 hover:text-emerald-700"
                      >
                        {ep.is_active ? 'Disable' : 'Enable'}
                      </button>
                      <button
                        type="button"
                        onClick={() => sendTestEvent(ep.id)}
                        disabled={testingId === ep.id || !ep.is_active}
                        title="Send test event"
                        className="rounded-md p-1.5 text-slate-400 hover:bg-slate-50 hover:text-slate-700 disabled:opacity-40"
                      >
                        <Send className={`size-4 ${testingId === ep.id ? 'animate-pulse' : ''}`} />
                      </button>
                      <button
                        type="button"
                        onClick={() => rotateSecret(ep.id)}
                        title="Rotate secret"
                        className="rounded-md p-1.5 text-slate-400 hover:bg-slate-50 hover:text-slate-700"
                      >
                        <RefreshCw className="size-4" />
                      </button>
                      {confirmDeleteId === ep.id ? (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => deleteEndpoint(ep.id)}
                            className="rounded-md bg-red-50 px-2 py-1 text-xs font-semibold text-red-700"
                          >
                            Confirm
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(null)}
                            className="text-xs text-slate-400"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(ep.id)}
                          className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      )}
                    </div>
                  </div>
                  {expanded && <DeliveryLog endpointId={ep.id} />}
                </div>
              )
            })}
          </div>
        )}
      </div>

      <ConversationRouting endpoints={endpoints.filter((e) => e.is_active)} />
    </div>
  )
}

interface RoutedConversation {
  id: string
  routing_mode: 'agent' | 'webhook'
  routing_endpoint_id: string | null
  contacts: { name: string | null; phone: string } | { name: string | null; phone: string }[]
}

function contactOf(c: RoutedConversation) {
  return Array.isArray(c.contacts) ? c.contacts[0] : c.contacts
}

/**
 * BYOA handoff — Wassist's `conversations.subscribe`/`unsubscribe`.
 * Routes one conversation to a developer's own backend: AiSend's own
 * agent/journey/automation replies stop for it (see the routing check
 * in src/app/api/whatsapp/webhook/route.ts), and the developer's
 * endpoint gets subscription.message.received instead of the normal
 * message.received fan-out.
 */
function ConversationRouting({ endpoints }: { endpoints: Endpoint[] }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<RoutedConversation[]>([])
  const [searching, setSearching] = useState(false)
  const [subscribed, setSubscribed] = useState<RoutedConversation[]>([])
  const [loadingSubscribed, setLoadingSubscribed] = useState(true)
  const [pickedEndpoint, setPickedEndpoint] = useState<Record<string, string>>({})
  const [busyId, setBusyId] = useState<string | null>(null)

  const loadSubscribed = useCallback(async () => {
    setLoadingSubscribed(true)
    try {
      const res = await fetch('/api/webhooks/conversations')
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setSubscribed(data.conversations ?? [])
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load subscribed conversations')
    } finally {
      setLoadingSubscribed(false)
    }
  }, [])

  useEffect(() => { loadSubscribed() }, [loadSubscribed])

  async function search() {
    if (!query.trim()) return
    setSearching(true)
    try {
      const res = await fetch(`/api/webhooks/conversations?q=${encodeURIComponent(query.trim())}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setResults(data.conversations ?? [])
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Search failed')
    } finally {
      setSearching(false)
    }
  }

  async function subscribe(conversationId: string) {
    const endpointId = pickedEndpoint[conversationId]
    if (!endpointId) {
      toast.error('Pick an endpoint first')
      return
    }
    setBusyId(conversationId)
    try {
      const res = await fetch(`/api/webhooks/conversations/${conversationId}/subscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint_id: endpointId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast.success('Conversation handed off — AiSend will no longer auto-reply on it')
      setResults((r) => r.map((c) => (c.id === conversationId ? { ...c, routing_mode: 'webhook', routing_endpoint_id: endpointId } : c)))
      await loadSubscribed()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to subscribe')
    } finally {
      setBusyId(null)
    }
  }

  async function unsubscribe(conversationId: string) {
    setBusyId(conversationId)
    try {
      const res = await fetch(`/api/webhooks/conversations/${conversationId}/unsubscribe`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast.success('Conversation handed back to AiSend')
      setResults((r) => r.map((c) => (c.id === conversationId ? { ...c, routing_mode: 'agent', routing_endpoint_id: null } : c)))
      await loadSubscribed()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to unsubscribe')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="rounded-2xl border border-[#e7ece9] bg-white p-6 shadow-sm">
      <h2 className="text-base font-bold text-[#0c1f17]">Conversation routing (BYOA)</h2>
      <p className="mt-1 text-sm text-slate-500">
        Hand one conversation entirely to your own backend — AiSend&apos;s agent, journeys and
        automations stop replying on it, and your endpoint gets every message instead.
      </p>

      <div className="mt-4 flex gap-2">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && search()}
          placeholder="Search by contact name or phone"
        />
        <Button type="button" variant="outline" onClick={search} disabled={searching}>
          <Search className="size-4" /> Search
        </Button>
      </div>

      {results.length > 0 && (
        <div className="mt-3 divide-y divide-slate-100 rounded-lg border border-slate-100">
          {results.map((c) => {
            const contact = contactOf(c)
            const isWebhook = c.routing_mode === 'webhook'
            return (
              <div key={c.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-800">{contact?.name || contact?.phone}</p>
                  <p className="text-xs text-slate-400">{contact?.phone}</p>
                </div>
                {isWebhook ? (
                  <Button type="button" variant="outline" size="sm" disabled={busyId === c.id} onClick={() => unsubscribe(c.id)}>
                    <Unlink className="size-3.5" /> Unsubscribe
                  </Button>
                ) : (
                  <div className="flex shrink-0 items-center gap-2">
                    <select
                      value={pickedEndpoint[c.id] ?? ''}
                      onChange={(e) => setPickedEndpoint((p) => ({ ...p, [c.id]: e.target.value }))}
                      className="rounded-md border border-slate-200 px-2 py-1.5 text-xs"
                    >
                      <option value="">Choose endpoint…</option>
                      {endpoints.map((ep) => (
                        <option key={ep.id} value={ep.id}>{ep.url}</option>
                      ))}
                    </select>
                    <Button type="button" size="sm" disabled={busyId === c.id} onClick={() => subscribe(c.id)}>
                      Subscribe
                    </Button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      <div className="mt-5">
        <p className="text-xs font-semibold text-slate-500 mb-2">Currently handed off</p>
        {loadingSubscribed ? (
          <p className="text-xs text-slate-400">Loading…</p>
        ) : subscribed.length === 0 ? (
          <p className="text-xs text-slate-400">No conversations are routed to a webhook right now.</p>
        ) : (
          <div className="divide-y divide-slate-100 rounded-lg border border-slate-100">
            {subscribed.map((c) => {
              const contact = contactOf(c)
              return (
                <div key={c.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-800">{contact?.name || contact?.phone}</p>
                    <p className="text-xs text-slate-400">{contact?.phone}</p>
                  </div>
                  <Button type="button" variant="outline" size="sm" disabled={busyId === c.id} onClick={() => unsubscribe(c.id)}>
                    <Unlink className="size-3.5" /> Unsubscribe
                  </Button>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
