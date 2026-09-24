'use client'

/**
 * File: src/app/(dashboard)/ai-agent/settings/page.tsx
 * Purpose: AI Agent configuration — brand voice, language, enable/disable, product sync
 */

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/useAuth'
import { useBusiness } from '@/hooks/useBusiness'
import { Bot, Save, RefreshCw, ToggleLeft, ToggleRight, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface AgentConfig {
  id: string
  store_name: string
  store_url: string | null
  brand_voice_prompt: string
  language: string
  is_enabled: boolean
  scrape_status: string
  embed_status: string
  last_synced_at: string | null
}

type SyncStatus = 'idle' | 'scraping' | 'embedding' | 'done' | 'failed'

const LANGUAGE_OPTIONS = ['English', 'Hindi', 'Hinglish', 'Tamil', 'Telugu', 'Marathi', 'Bengali', 'Gujarati']

// ─── Helpers ──────────────────────────────────────────────────────────────────

function statusLabel(scrape: string, embed: string): { text: string; color: string } {
  if (scrape === 'running') return { text: 'Scraping products…', color: 'text-blue-600' }
  if (scrape === 'failed')  return { text: 'Scrape failed', color: 'text-red-600' }
  if (embed === 'running')  return { text: 'Embedding products…', color: 'text-blue-600' }
  if (embed === 'failed')   return { text: 'Embed failed', color: 'text-red-600' }
  if (scrape === 'done' && embed === 'done') return { text: 'Catalog ready', color: 'text-green-600' }
  return { text: 'Not synced', color: 'text-gray-500' }
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AiAgentSettingsPage() {
  const supabase = createClient()
  const { profile } = useAuth()
  const { businessId, loading: businessLoading } = useBusiness()

  const [config, setConfig] = useState<AgentConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [saveMsg, setSaveMsg] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Form state
  const [storeName, setStoreName] = useState('')
  const [storeUrl, setStoreUrl] = useState('')
  const [brandVoice, setBrandVoice] = useState('')
  const [language, setLanguage] = useState('English')
  const [isEnabled, setIsEnabled] = useState(false)

  // ── Load config ──────────────────────────────────────────────────────────────
  const loadConfig = useCallback(async (userId: string) => {
    const { data, error } = await supabase
      .from('ai_agent_configs')
      .select('*')
      .eq('user_id', userId)
      .single()

    if (error && error.code !== 'PGRST116') {
      setError('Failed to load config')
      setLoading(false)
      return
    }

    if (data) {
      setConfig(data)
      setStoreName(data.store_name)
      setStoreUrl(data.store_url ?? '')
      setBrandVoice(data.brand_voice_prompt)
      setLanguage(data.language)
      setIsEnabled(data.is_enabled)
    }
    setLoading(false)
  }, [supabase])

  useEffect(() => {
    if (!businessLoading && businessId) {
      void loadConfig(businessId)
    }
  }, [businessId, businessLoading, loadConfig])

  // Poll sync status while running
  useEffect(() => {
    if (!config) return
    const isRunning = config.scrape_status === 'running' || config.embed_status === 'running'
    if (!isRunning) return

    const interval = setInterval(async () => {
      const { data } = await supabase
        .from('ai_agent_configs')
        .select('scrape_status, embed_status, last_synced_at')
        .eq('id', config.id)
        .single()

      if (data) {
        setConfig((prev) => prev ? { ...prev, ...data } : prev)
        if (data.scrape_status !== 'running' && data.embed_status !== 'running') {
          clearInterval(interval)
          setSyncing(false)
        }
      }
    }, 4000)

    return () => clearInterval(interval)
  }, [config?.id, config?.scrape_status, config?.embed_status, supabase])

  // ── Save settings ────────────────────────────────────────────────────────────
  async function handleSave() {
    if (!businessId) return
    setSaving(true)
    setError(null)
    setSaveMsg(null)

    const payload = {
      user_id: businessId,
      store_name: storeName.trim(),
      store_url: storeUrl.trim() || null,
      brand_voice_prompt: brandVoice.trim(),
      language,
      is_enabled: isEnabled,
      updated_at: new Date().toISOString(),
    }

    const { data, error } = await supabase
      .from('ai_agent_configs')
      .upsert(payload, { onConflict: 'user_id' })
      .select()
      .single()

    if (error) {
      setError('Save failed: ' + error.message)
    } else {
      setConfig(data)
      setSaveMsg('Settings saved!')
      setTimeout(() => setSaveMsg(null), 3000)
    }
    setSaving(false)
  }

  // ── Trigger product sync ──────────────────────────────────────────────────────
  async function handleSync() {
    if (!businessId || !storeUrl.trim()) {
      setError('Add your store URL before syncing.')
      return
    }
    setSyncing(true)
    setError(null)

    // Save URL first, then kick off scrape
    await supabase
      .from('ai_agent_configs')
      .update({ scrape_status: 'running', embed_status: 'pending', updated_at: new Date().toISOString() })
      .eq('user_id', businessId)

    setConfig((prev) => prev ? { ...prev, scrape_status: 'running', embed_status: 'pending' } : prev)

    const res = await fetch('/api/ai-agent/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ storeUrl: storeUrl.trim() }),
    })

    if (!res.ok) {
      setError('Sync trigger failed. Try again.')
      setSyncing(false)
    }
    // Status updates come via the polling useEffect above
  }

  // ── Render ───────────────────────────────────────────────────────────────────
  if (loading || businessLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    )
  }

  const syncSt = config ? statusLabel(config.scrape_status, config.embed_status) : { text: 'Not synced', color: 'text-gray-500' }

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="rounded-xl bg-indigo-50 p-2.5 dark:bg-indigo-900/30">
          <Bot className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">AI Agent Settings</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Configure how the agent talks to your customers</p>
        </div>
      </div>

      {/* Error / success banners */}
      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          {error}
        </div>
      )}
      {saveMsg && (
        <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700 dark:border-green-800 dark:bg-green-900/20 dark:text-green-400">
          <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
          {saveMsg}
        </div>
      )}

      {/* Card: Basic info */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Store Info</h2>
        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">Store Name</label>
            <input
              value={storeName}
              onChange={(e) => setStoreName(e.target.value)}
              placeholder="My Store"
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">Store URL</label>
            <input
              value={storeUrl}
              onChange={(e) => setStoreUrl(e.target.value)}
              placeholder="https://yourstore.myshopify.com"
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            />
            <p className="mt-1 text-xs text-gray-400">Shopify, WooCommerce or any product catalog URL</p>
          </div>
        </div>
      </div>

      {/* Card: Agent personality */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Agent Personality</h2>
        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">Brand Voice</label>
            <textarea
              value={brandVoice}
              onChange={(e) => setBrandVoice(e.target.value)}
              rows={3}
              placeholder="Be friendly, helpful and professional. Always offer alternatives if a product is out of stock."
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">Reply Language</label>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            >
              {LANGUAGE_OPTIONS.map((l) => (
                <option key={l} value={l}>{l}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Card: Enable / disable */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium text-gray-900 dark:text-white">AI Agent</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {isEnabled ? 'Agent is replying to customers on WhatsApp' : 'Agent is paused — messages go to manual inbox'}
            </p>
          </div>
          <button
            onClick={() => setIsEnabled((v) => !v)}
            className="flex-shrink-0"
            aria-label="Toggle agent"
          >
            {isEnabled
              ? <ToggleRight className="h-9 w-9 text-indigo-600" />
              : <ToggleLeft className="h-9 w-9 text-gray-400" />
            }
          </button>
        </div>
      </div>

      {/* Card: Product sync */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-medium text-gray-900 dark:text-white">Product Catalog</p>
            <p className={`mt-0.5 text-sm ${syncSt.color}`}>{syncSt.text}</p>
            {config?.last_synced_at && (
              <p className="mt-0.5 text-xs text-gray-400">
                Last synced: {new Date(config.last_synced_at).toLocaleString()}
              </p>
            )}
          </div>
          <button
            onClick={handleSync}
            disabled={syncing || !storeUrl.trim()}
            className="inline-flex flex-shrink-0 items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Syncing…' : 'Sync Products'}
          </button>
        </div>
      </div>

      {/* Save button */}
      <button
        onClick={handleSave}
        disabled={saving}
        className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-6 py-3 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
      >
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        {saving ? 'Saving…' : 'Save Settings'}
      </button>
    </div>
  )
}
