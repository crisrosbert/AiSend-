'use client'

import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Plus, Trash2, Pencil, X, Check, Zap } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface CannedReply {
  id: string
  shortcode: string
  title: string
  content: string
  category: string
  created_at: string
}

const EMPTY = { shortcode: '', title: '', content: '', category: 'General' }
const CATEGORIES = ['General', 'Greetings', 'Sales', 'Support', 'Payments', 'Shipping']

const DEFAULT_SEEDS: Omit<CannedReply, 'id' | 'created_at'>[] = [
  { shortcode: 'hello',    title: 'Welcome greeting',      category: 'Greetings', content: 'Hi! 👋 Welcome to our store. How can I help you today?' },
  { shortcode: 'hours',    title: 'Business hours',        category: 'General',   content: 'We\'re open Monday–Saturday, 10am to 7pm IST. Sundays we\'re closed.' },
  { shortcode: 'delivery', title: 'Delivery charges',      category: 'Shipping',  content: 'Delivery is ₹49 for orders under ₹499 and FREE above ₹499! 🚚' },
  { shortcode: 'track',    title: 'Track order',           category: 'Shipping',  content: 'You can track your order here: {tracking_link}. It usually takes 3–5 business days.' },
  { shortcode: 'payment',  title: 'Payment methods',       category: 'Payments',  content: 'We accept UPI, debit/credit cards, net banking, and Cash on Delivery. 💳' },
  { shortcode: 'return',   title: 'Return policy',         category: 'Support',   content: 'We have a 7-day easy return policy. Just reply here and we\'ll arrange a pickup. 📦' },
  { shortcode: 'thanks',   title: 'Thank you',             category: 'General',   content: 'Thank you so much! 🙏 It was a pleasure helping you. Have a great day!' },
  { shortcode: 'soon',     title: 'We\'ll reply soon',     category: 'Support',   content: 'Thanks for reaching out! Our team will get back to you within a few hours. ⏰' },
]

export default function CannedRepliesPage() {
  const [replies, setReplies] = useState<CannedReply[]>([])
  const [loading, setLoading] = useState(true)
  const [seeding, setSeeding] = useState(false)
  const [editingId, setEditingId] = useState<string | 'new' | null>(null)
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [catFilter, setCatFilter] = useState('All')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/canned-replies')
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setReplies(data.replies ?? [])
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  async function seedDefaults() {
    setSeeding(true)
    let created = 0
    for (const seed of DEFAULT_SEEDS) {
      try {
        const res = await fetch('/api/canned-replies', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(seed),
        })
        if (res.ok) created++
      } catch { /* skip duplicates */ }
    }
    toast.success(`Added ${created} default replies`)
    setSeeding(false)
    load()
  }

  async function handleSave() {
    if (!form.shortcode.trim() || !form.title.trim() || !form.content.trim()) {
      toast.error('Shortcode, title and message are required')
      return
    }
    setSaving(true)
    try {
      const isNew = editingId === 'new'
      const res = await fetch('/api/canned-replies', {
        method: isNew ? 'POST' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(isNew ? form : { id: editingId, ...form }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast.success(isNew ? 'Reply created' : 'Reply updated')
      setEditingId(null)
      setForm(EMPTY)
      load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    setDeletingId(id)
    try {
      const res = await fetch(`/api/canned-replies?id=${id}`, { method: 'DELETE' })
      if (!res.ok) { const d = await res.json(); throw new Error(d.error) }
      toast.success('Reply deleted')
      setReplies((prev) => prev.filter((r) => r.id !== id))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Delete failed')
    } finally {
      setDeletingId(null)
      setConfirmDeleteId(null)
    }
  }

  function startEdit(r: CannedReply) {
    setEditingId(r.id)
    setForm({ shortcode: r.shortcode, title: r.title, content: r.content, category: r.category })
  }

  function cancelEdit() { setEditingId(null); setForm(EMPTY) }

  const categories = ['All', ...Array.from(new Set(replies.map((r) => r.category))).sort()]

  const filtered = replies.filter((r) => {
    const matchCat = catFilter === 'All' || r.category === catFilter
    const q = search.toLowerCase()
    const matchSearch = !q || r.shortcode.includes(q) || r.title.toLowerCase().includes(q) || r.content.toLowerCase().includes(q)
    return matchCat && matchSearch
  })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-[#0c1f17]">Canned Replies</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            Type <span className="font-mono font-semibold text-emerald-600">/</span> in the chat to instantly insert a saved reply.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {replies.length === 0 && !loading && (
            <Button
              variant="outline"
              onClick={seedDefaults}
              disabled={seeding}
              className="border-emerald-200 text-emerald-700 hover:bg-emerald-50"
            >
              <Zap className="size-4" />
              {seeding ? 'Adding…' : 'Add defaults'}
            </Button>
          )}
          <Button
            onClick={() => { setEditingId('new'); setForm(EMPTY) }}
            className="bg-emerald-500 hover:bg-emerald-600 text-white"
          >
            <Plus className="size-4" /> New reply
          </Button>
        </div>
      </div>

      {/* New / Edit form */}
      {editingId !== null && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-5 space-y-4">
          <p className="text-sm font-semibold text-[#0c1f17]">
            {editingId === 'new' ? 'New canned reply' : 'Edit reply'}
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-600">Shortcode</label>
              <div className="flex items-center gap-1">
                <span className="text-sm font-bold text-emerald-600">/</span>
                <Input
                  value={form.shortcode}
                  onChange={(e) => setForm({ ...form, shortcode: e.target.value.toLowerCase().replace(/\s/g, '-') })}
                  placeholder="e.g. hello"
                  className="border-[#e7ece9] focus-visible:border-emerald-500 focus-visible:ring-emerald-500/20"
                />
              </div>
              <p className="text-[11px] text-slate-400">Type this after / in the inbox to find this reply</p>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-600">Title</label>
              <Input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="e.g. Welcome greeting"
                className="border-[#e7ece9] focus-visible:border-emerald-500 focus-visible:ring-emerald-500/20"
              />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-600">Category</label>
            <div className="flex flex-wrap gap-1.5">
              {CATEGORIES.map((c) => (
                <button
                  key={c}
                  onClick={() => setForm({ ...form, category: c })}
                  className={`rounded-full px-3 py-1 text-xs font-medium border transition-colors ${
                    form.category === c
                      ? 'bg-emerald-500 text-white border-emerald-500'
                      : 'border-[#e7ece9] text-slate-500 hover:border-emerald-300'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-600">Message</label>
            <textarea
              value={form.content}
              onChange={(e) => setForm({ ...form, content: e.target.value })}
              placeholder="Type the full message that will be inserted…"
              rows={3}
              className="w-full resize-none rounded-lg border border-[#e7ece9] bg-white px-3 py-2 text-sm text-[#0c1f17] placeholder-slate-400 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20"
            />
          </div>
          <div className="flex gap-2">
            <Button
              onClick={handleSave}
              disabled={saving}
              className="bg-emerald-500 hover:bg-emerald-600 text-white"
            >
              {saving ? 'Saving…' : editingId === 'new' ? 'Create' : 'Save changes'}
            </Button>
            <Button variant="outline" onClick={cancelEdit} className="border-[#e7ece9]">
              <X className="size-4" /> Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Search + filter */}
      {replies.length > 0 && (
        <div className="flex flex-wrap items-center gap-3">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search replies…"
            className="max-w-xs border-[#e7ece9] focus-visible:border-emerald-500 focus-visible:ring-emerald-500/20"
          />
          <div className="flex flex-wrap gap-1.5">
            {categories.map((c) => (
              <button
                key={c}
                onClick={() => setCatFilter(c)}
                className={`rounded-full px-3 py-1 text-xs font-medium border transition-colors ${
                  catFilter === c
                    ? 'bg-emerald-500 text-white border-emerald-500'
                    : 'border-[#e7ece9] text-slate-500 hover:border-emerald-300'
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Replies list */}
      {loading ? (
        <div className="flex h-32 items-center justify-center text-sm text-slate-400">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="flex h-40 flex-col items-center justify-center rounded-xl border border-dashed border-[#e7ece9] text-center">
          <p className="text-sm font-medium text-slate-600">No replies yet</p>
          <p className="mt-1 text-xs text-slate-400">Create your first canned reply or add the defaults to get started.</p>
        </div>
      ) : (
        <div className="divide-y divide-[#f0f4f2] rounded-xl border border-[#e7ece9] bg-white overflow-hidden">
          {filtered.map((r) => {
            const isConfirming = confirmDeleteId === r.id
            const isDeleting = deletingId === r.id
            return (
              <div key={r.id} className="flex items-start gap-3 px-4 py-3 hover:bg-slate-50 transition-colors">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-sm font-bold text-emerald-600">/{r.shortcode}</span>
                    <span className="text-sm font-medium text-[#0c1f17]">{r.title}</span>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-500">{r.category}</span>
                  </div>
                  <p className="mt-0.5 truncate text-xs text-slate-500">{r.content}</p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  {isConfirming ? (
                    <div className="flex items-center gap-1 rounded-md border border-red-200 bg-red-50 px-2 py-1">
                      <span className="text-xs text-red-600">Delete?</span>
                      <button onClick={() => setConfirmDeleteId(null)} className="text-xs text-slate-400 hover:text-slate-700 px-1">No</button>
                      <button
                        onClick={() => handleDelete(r.id)}
                        disabled={isDeleting}
                        className="text-xs text-red-500 hover:text-red-700 px-1 disabled:opacity-50"
                      >
                        {isDeleting ? '…' : 'Yes'}
                      </button>
                    </div>
                  ) : (
                    <>
                      <button
                        onClick={() => startEdit(r)}
                        className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                      >
                        <Pencil className="size-3.5" />
                      </button>
                      <button
                        onClick={() => setConfirmDeleteId(r.id)}
                        className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-500"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      <p className="text-xs text-slate-400">
        {replies.length} {replies.length === 1 ? 'reply' : 'replies'} total
      </p>
    </div>
  )
}
