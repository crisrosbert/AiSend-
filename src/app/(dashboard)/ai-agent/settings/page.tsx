'use client'

/**
 * File: src/app/(dashboard)/ai-agent/settings/page.tsx
 * Purpose: AI Agent configuration — brand voice, language, enable/disable, product sync
 */

import { useEffect, useState, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Bot, Save, RefreshCw, ToggleLeft, ToggleRight, AlertCircle, CheckCircle2, Loader2, Timer } from 'lucide-react'

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

const LANGUAGE_OPTIONS = ['English', 'Hindi', 'Hinglish', 'Tamil', 'Telugu', 'Marathi', 'Bengali', 'Gujarati']

function statusLabel(scrape: string, embed: string): { text: string; color: string } {
  if (scrape === 'running') return { text: 'Scraping products…', color: 'text-blue-600' }
  if (scrape === 'failed')  return { text: 'Scrape failed', color: 'text-red-600' }
  if (embed === 'running')  return { text: 'Embedding products…', color: 'text-blue-600' }
  if (embed === 'failed')   return { text: 'Embed failed', color: 'text-red-600' }
  if (scrape === 'done' && embed === 'done') return { text: 'Catalog ready ✓', color: 'text-green-600' }
  return { text: 'Not synced', color: 'text-gray-500' }
}

function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return m > 0 ? `${m}m ${s}s` : `${s}s`
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AiAgentSettingsPage() {
  const supabase = createClient()

  const [config, setConfig]     = useState<AgentConfig | null>(null)
  const [loading, setLoading]   = useState(true)
  const [saving, setSaving]     = useState(false)
  const [syncing, setSyncing]   = useState(false)
  const [saveMsg, setSaveMsg]   = useState<string | null>(null)
  const [error, setError]       = useState<string | null>(null)
  const [elapsed, setElapsed]   = useState(0)
  const timerRef                = useRef<ReturnType<typeof setInterval> | null>(null)

  // Form state
  const [storeName, setStoreName]   = useState('')
  const [storeUrl, setStoreUrl]     = useState('')
  const [brandVoice, setBrandVoice] = useState('')
  const [language, setLanguage]     = useState('English')
  const [isEnabled, setIsEnabled]   = useState(false)

  // ── Get auth user id (always matches RLS auth.uid()) ─────────────────────────
  async function getAuthUserId(): Promise<string | null> {
    const { data: { user } } = await supabase.auth.getUser()
    return user?.id ?? null
  }

  // ── Load config ───────────────────────────────────────────────────────────────
  const loadConfig = useCallback(async () => {
    const userId = await getAuthUserId()
    if (!userId) { setLoading(false); return }

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
      setStoreName(data.store_name ?? '')
      setStoreUrl(data.store_url ?? '')
      setBrandVoice(data.brand_voice_prompt ?? '')
      setLanguage(data.language ?? 'English')
      setIsEnabled(data.is_enabled ?? false)
    }
    setLoading(false)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { void loadConfig() }, [loadConfig])

  // ── Poll sync status while running ───────────────────────────────────────────
  useEffect(() => {
    if (!config?.id) return
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
          stopTimer()
        }
      }
    }, 4000)

    return () => clearInterval(interval)
  }, [config?.id, config?.scrape_status, config?.embed_status]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Stopwatch helpers ─────────────────────────────────────────────────────────
  function startTimer() {
    setElapsed(0)
    timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000)
  }

  function stopTimer() {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
  }

  useEffect(() => () => stopTimer(), [])

  // ── Save settings ─────────────────────────────────────────────────────────────
  async function handleSave() {
    setSaving(true)
    setError(null)
    setSaveMsg(null)

    const userId = await getAuthUserId()
    if (!userId) { setError('Not logged in.'); setSaving(false); return }

    const payload = {
      user_id:            userId,
      store_name:         storeName.trim() || 'My Store',
      store_url:          storeUrl.trim() || null,
      brand_voice_prompt: brandVoice.trim() || 'Be helpful, friendly and professional.',
      language,
      is_enabled:         isEnabled,
      updated_at:         new Date().toISOString(),
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
    if (!storeUrl.trim()) { setError('Add your store URL before syncing.'); return }

    setSyncing(true)
    setError(null)
    startTimer()

    const userId = await getAuthUserId()
    if (!userId) { setError('Not logged in.'); setSyncing(false); stopTimer(); return }

    // Upsert config first so the row definitely exists
    await supabase.from('ai_agent_configs').upsert({
      user_id:            userId,
      store_name:         storeName.trim() || 'My Store',
      store_url:          storeUrl.trim(),
      brand_voice_prompt: brandVoice.trim() || 'Be helpful, friendly and professional.',
      language,
      is_enabled:         isEnabled,
      scrape_status:      'running',
      embed_status:       'pending',
      updated_at:         new Date().toISOString(),
    }, { onConflict: 'user_id' })

    setConfig((prev) => prev ? { ...prev, scrape_status: 'running', embed_status: 'pending' } : prev)

    const res = await fetch('/api/ai-agent/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ storeUrl: storeUrl.trim() }),
    })

    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      setError('Sync failed: ' + (body.error ?? res.statusText))
      setSyncing(false)
      stopTimer()
    }
    // On success: polling useEffect updates config + stops timer when done
  }

  // ── Render ────────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    )
  }

  const syncSt = config
    ? statusLabel(config.scrape_status, config.embed_status)
    : { text: 'Not synced', color: 'text-gray-500' }

  const isSyncRunning = syncing || config?.scrape_status === 'running' || config?.embed_status === 'running'

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

      {/* Banners */}
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

      {/* Store Info */}
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

      {/* Agent Personality */}
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
              {LANGUAGE_OPTIONS.map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Enable / disable */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium text-gray-900 dark:text-white">AI Agent</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {isEnabled ? 'Agent is replying to customers on WhatsApp' : 'Agent is paused — messages go to manual inbox'}
            </p>
          </div>
          <button onClick={() => setIsEnabled((v) => !v)} className="flex-shrink-0" aria-label="Toggle agent">
            {isEnabled
              ? <ToggleRight className="h-9 w-9 text-indigo-600" />
              : <ToggleLeft  className="h-9 w-9 text-gray-400" />}
          </button>
        </div>
      </div>

      {/* Product sync */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <p className="font-medium text-gray-900 dark:text-white">Product Catalog</p>
            <p className={`mt-0.5 text-sm ${syncSt.color}`}>{syncSt.text}</p>
            {config?.last_synced_at && (
              <p className="mt-0.5 text-xs text-gray-400">
                Last synced: {new Date(config.last_synced_at).toLocaleString()}
              </p>
            )}

            {/* ── Stopwatch ── */}
            {isSyncRunning && (
              <div className="mt-3 flex items-center gap-2 rounded-lg bg-indigo-50 px-3 py-2 dark:bg-indigo-900/20">
                <Timer className="h-4 w-4 text-indigo-500 animate-pulse" />
                <span className="text-sm font-mono font-medium text-indigo-700 dark:text-indigo-300">
                  {formatElapsed(elapsed)}
                </span>
                <span className="text-xs text-indigo-500">
                  {config?.scrape_status === 'running'
                    ? '— fetching products from store…'
                    : '— building AI search index…'}
                </span>
              </div>
            )}
          </div>

          <button
            onClick={handleSync}
            disabled={isSyncRunning || !storeUrl.trim()}
            className="inline-flex flex-shrink-0 items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${isSyncRunning ? 'animate-spin' : ''}`} />
            {isSyncRunning ? 'Syncing…' : 'Sync Products'}
          </button>
        </div>
      </div>

      {/* Save */}
      <button
        onClick={handleSave}
        disabled={saving || isSyncRunning}
        className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-6 py-3 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
      >
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        {saving ? 'Saving…' : 'Save Settings'}
      </button>
    </div>
  )
}
