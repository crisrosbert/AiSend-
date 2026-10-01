/**
 * src/lib/agent-router/router.ts
 *
 * ── THE AGENT ROUTER ────────────────────────────────────────────────────
 * Decides which agent (or agent system) handles each inbound WhatsApp
 * message. Exactly ONE agent responds per message — no double-replies,
 * no silent drops.
 *
 * ── ARCHITECTURE ────────────────────────────────────────────────────────
 *
 *   1. AGENT REGISTRY  — A live snapshot of every active agent, built
 *      fresh on each routing call from the agents + ai_agent_configs
 *      tables. This is the SINGLE SOURCE OF TRUTH for "which agents
 *      exist and are turned on right now." Nothing else is trusted.
 *
 *   2. ROUTING CONFIG   — Merchant preferences only: keyword overrides,
 *      LLM routing toggle. NOT a source of truth for active agents.
 *
 *   3. ROUTING PIPELINE — Runs in strict priority order:
 *        1. Sticky session (conversation already assigned)
 *        2. Ads agent (click-to-WhatsApp ad lead)
 *        3. Broadcast reply (replying to a campaign)
 *        4. Keyword match (merchant-defined or built-in ecommerce)
 *       4.5. Product catalog match (bare product name → ecommerce)
 *        5. LLM intent (GPT-4o-mini classification)
 *        6. Fallback (first active agent)
 *
 *   4. AGENT ISOLATION  — Every routing stage filters candidates through
 *      the live registry. An agent of type X can never be confused with
 *      type Y. A paused/deleted agent is invisible to the entire pipeline.
 *      Sticky sessions pointing at dead agents are auto-expired.
 */

import { createClient } from '@supabase/supabase-js'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _db: any = null
function db() {
  if (!_db) {
    _db = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )
  }
  return _db
}

// ── Types ────────────────────────────────────────────────────────────────

/**
 * The two "agent systems" in the codebase:
 * - 'ecommerce'       → src/lib/ai-agent/engine.ts (own tables, own sessions)
 * - 'general:<type>'  → src/lib/agent/engine.ts via whatsapp-agent/handler.ts
 *                        where <type> is the agents.agent_type (sales, support, realestate, etc.)
 */
export type AgentSystem = 'ecommerce' | `general:${string}`

export interface RoutingDecision {
  /** Which agent system should handle this message */
  system: AgentSystem
  /** The specific agent row ID (for general system) */
  agentId: string | null
  /** Why this agent was chosen */
  method: 'sticky' | 'ads' | 'broadcast' | 'keyword' | 'intent' | 'fallback'
  /** The detected intent label (if LLM was used) */
  intentLabel?: string
  /** Confidence 0-1 (if LLM was used) */
  confidence?: number
  /** How long routing took in ms */
  latencyMs: number
}

export interface RouteInput {
  tenantId: string
  conversationId: string
  contactPhone: string
  inboundText: string
  /** Is this from a click-to-WhatsApp ad? */
  isAdLead: boolean
  /** The tenant's ads agent (from whatsapp_config) */
  adsAgentId?: string | null
  adsAgentEnabled?: boolean
}

// ═══════════════════════════════════════════════════════════════════════
// SECTION 1: AGENT REGISTRY — Live snapshot of active agents
// ═══════════════════════════════════════════════════════════════════════
//
// The registry is built fresh on every routing call. It replaces the old
// approach of reading `agent_routing_config.active_agent_types` once and
// trusting it forever — which meant newly activated agents were invisible
// and paused agents kept getting routed to.
//
// TWO INDEPENDENT AGENT SYSTEMS exist:
//   • Ecommerce  — lives in `ai_agent_configs`, gated by `is_enabled`
//   • General    — lives in `agents`, gated by `is_active`
// They have different tables, different columns, and different handlers.
// The registry queries both in parallel and builds one clean map.

/** A single active agent in the registry. */
interface RegisteredAgent {
  id: string
  type: string           // 'sales', 'support', 'realestate', 'ecommerce', etc.
  system: AgentSystem    // 'ecommerce' | 'general:sales' | etc.
  createdAt: string      // For deterministic ordering (oldest = default)
}

/**
 * Immutable snapshot of every active agent for a tenant at a point in time.
 *
 * Built once per routeMessage() call — every routing stage uses this
 * instead of the persisted config, so a toggle on the Agents page takes
 * effect on the very next inbound message with zero delay.
 */
interface AgentRegistry {
  /** All active agents, grouped by type. Each group is ordered oldest-first. */
  byType: Map<string, RegisteredAgent[]>

  /** Every active agent ID → its RegisteredAgent, for O(1) lookup. */
  byId: Map<string, RegisteredAgent>

  /** Ordered list of active types (deterministic: ecommerce first if present, then by earliest agent). */
  activeTypes: string[]

  /** Is the ecommerce agent specifically enabled? */
  ecommerceEnabled: boolean
}

/**
 * Build a live AgentRegistry for this tenant by querying the source-of-truth
 * tables directly. Both queries run in parallel for minimal latency.
 *
 * This is the ONLY function that decides which agents are active.
 * Nothing else in the router makes that judgment.
 */
async function buildAgentRegistry(tenantId: string): Promise<AgentRegistry> {
  // Query both agent systems in parallel — one DB round-trip each
  const [generalResult, ecommerceResult] = await Promise.all([
    // General agents: sales, support, realestate, creative, etc.
    // Column: agents.is_active (boolean)
    db()
      .from('agents')
      .select('id, agent_type, created_at')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .order('created_at', { ascending: true }),

    // Ecommerce agent: product catalog agent
    // Column: ai_agent_configs.is_enabled (boolean) — NOT is_active (dead column)
    db()
      .from('ai_agent_configs')
      .select('id')
      .eq('user_id', tenantId)
      .eq('is_enabled', true)
      .maybeSingle(),
  ])

  const byType = new Map<string, RegisteredAgent[]>()
  const byId = new Map<string, RegisteredAgent>()

  // ── Register general agents ──
  for (const row of generalResult.data ?? []) {
    const type = row.agent_type || 'other'
    const agent: RegisteredAgent = {
      id: row.id,
      type,
      system: `general:${type}` as AgentSystem,
      createdAt: row.created_at,
    }

    if (!byType.has(type)) byType.set(type, [])
    byType.get(type)!.push(agent)
    byId.set(row.id, agent)
  }

  // ── Register ecommerce agent ──
  const ecommerceEnabled = !!ecommerceResult.data
  if (ecommerceEnabled) {
    const ecommerceAgent: RegisteredAgent = {
      id: ecommerceResult.data.id,
      type: 'ecommerce',
      system: 'ecommerce',
      createdAt: '1970-01-01T00:00:00Z', // Always first in priority
    }
    byType.set('ecommerce', [ecommerceAgent])
    byId.set(ecommerceResult.data.id, ecommerceAgent)
  }

  // ── Build ordered active types list ──
  // Ecommerce first (if present), then other types ordered by their
  // earliest agent's created_at — gives deterministic fallback priority.
  const typeOrder: { type: string; earliest: string }[] = []
  for (const [type, agents] of byType.entries()) {
    typeOrder.push({ type, earliest: agents[0].createdAt })
  }
  typeOrder.sort((a, b) => {
    // Ecommerce always first
    if (a.type === 'ecommerce') return -1
    if (b.type === 'ecommerce') return 1
    return a.earliest.localeCompare(b.earliest)
  })

  return {
    byType,
    byId,
    activeTypes: typeOrder.map((t) => t.type),
    ecommerceEnabled,
  }
}

// ── Registry query helpers ──────────────────────────────────────────────

/** Is this agent type currently active (has at least one live agent)? */
function isTypeActive(registry: AgentRegistry, type: string): boolean {
  return registry.byType.has(type)
}

/** Is this specific agent ID currently active? */
function isAgentActive(registry: AgentRegistry, agentId: string): boolean {
  return registry.byId.has(agentId)
}

/**
 * Get the default (oldest active) agent ID for a type.
 * Returns null if no active agent of that type exists.
 */
function getDefaultAgent(registry: AgentRegistry, type: string): string | null {
  const agents = registry.byType.get(type)
  return agents?.[0]?.id ?? null
}

/**
 * Resolve a specific agent for a type. Checks in order:
 *   1. If a specific agentId is given AND it's active → use it
 *   2. Otherwise → default (oldest active) agent of that type
 *   3. If no agent of that type → null
 *
 * This replaces the old resolveAgentId() that trusted default_agents
 * blindly and could silently target dead/paused agents.
 */
function resolveAgent(
  registry: AgentRegistry,
  type: string,
  preferredAgentId?: string | null,
): string | null {
  // Preferred agent is valid only if it's still active AND of the right type
  if (preferredAgentId && registry.byId.has(preferredAgentId)) {
    const agent = registry.byId.get(preferredAgentId)!
    if (agent.type === type) return preferredAgentId
  }

  // Fall back to the default (oldest active) agent of this type
  return getDefaultAgent(registry, type)
}

/**
 * When routing picks a general agent type but no agent of that type exists,
 * fall back to ecommerce (if active) rather than dropping the message.
 *
 * This prevents the silent-drop scenario where the LLM classifies a
 * message as "sales" but the merchant only has an ecommerce agent.
 */
function withEcommerceFallback(
  registry: AgentRegistry,
  system: AgentSystem,
  agentId: string | null,
): { system: AgentSystem; agentId: string | null } {
  if (system.startsWith('general:') && !agentId && registry.ecommerceEnabled) {
    return { system: 'ecommerce', agentId: null }
  }
  return { system, agentId }
}

// ═══════════════════════════════════════════════════════════════════════
// SECTION 2: ROUTING CONFIG — Merchant preferences only
// ═══════════════════════════════════════════════════════════════════════

interface RoutingConfig {
  keyword_overrides: Record<string, string>
  llm_routing_enabled: boolean
}

const DEFAULT_CONFIG: RoutingConfig = {
  keyword_overrides: {},
  llm_routing_enabled: true,
}

async function loadRoutingConfig(tenantId: string): Promise<RoutingConfig> {
  const { data } = await db()
    .from('agent_routing_config')
    .select('keyword_overrides, llm_routing_enabled')
    .eq('tenant_id', tenantId)
    .maybeSingle()

  if (!data) return DEFAULT_CONFIG

  return {
    keyword_overrides:
      typeof data.keyword_overrides === 'object' && data.keyword_overrides
        ? data.keyword_overrides
        : DEFAULT_CONFIG.keyword_overrides,
    llm_routing_enabled: data.llm_routing_enabled ?? true,
  }
}

// ═══════════════════════════════════════════════════════════════════════
// SECTION 3: ROUTING PIPELINE STAGES
// ═══════════════════════════════════════════════════════════════════════

// ── Sticky session ──────────────────────────────────────────────────────

const STICKY_SESSION_TTL_MS = 6 * 60 * 60 * 1000 // 6 hours

/**
 * Resolve a phone number to this tenant's contact row.
 * Shared by sticky-override and broadcast-reply checks.
 */
async function resolveContactId(
  tenantId: string,
  contactPhone: string,
): Promise<string | null> {
  const { data } = await db()
    .from('contacts')
    .select('id')
    .eq('user_id', tenantId)
    .eq('phone', contactPhone)
    .maybeSingle()
  return data?.id ?? null
}

/**
 * Was this contact sent a broadcast AFTER the given timestamp?
 *
 * A broadcast sent after a sticky session was set represents the
 * merchant's fresh, explicit choice of agent for this contact — it
 * should override the stale sticky routing so replies to the new
 * campaign go to the new campaign's agent.
 */
async function hasNewerBroadcast(
  tenantId: string,
  contactPhone: string,
  sinceIso: string,
): Promise<boolean> {
  const contactId = await resolveContactId(tenantId, contactPhone)
  if (!contactId) return false

  const { data } = await db()
    .from('broadcast_recipients')
    .select('id')
    .eq('contact_id', contactId)
    .gt('created_at', sinceIso)
    .limit(1)
    .maybeSingle()

  return !!data
}

/**
 * Check if this conversation has a valid sticky session.
 *
 * AGENT ISOLATION: The sticky session is validated against the live
 * registry. If the sticky agent was paused or deleted since routing
 * was set, the sticky session is treated as expired and the message
 * is re-routed from scratch — preventing replies from going to a
 * dead agent.
 */
async function checkStickySession(
  conversationId: string,
  tenantId: string,
  contactPhone: string,
  registry: AgentRegistry,
): Promise<{ system: AgentSystem; agentId: string | null } | null> {
  const { data } = await db()
    .from('conversations')
    .select('routed_agent_type, routed_agent_id, status, routed_at')
    .eq('id', conversationId)
    .maybeSingle()

  if (!data?.routed_agent_type || data.status === 'pending') return null

  // ── Time-based expiry ──
  if (data.routed_at) {
    const age = Date.now() - new Date(data.routed_at).getTime()
    if (age > STICKY_SESSION_TTL_MS) return null

    // A campaign sent after this sticky was set overrides it
    if (await hasNewerBroadcast(tenantId, contactPhone, data.routed_at)) {
      return null
    }
  }

  // ── Agent liveness validation ──
  // If the sticky agent is no longer active, expire this session so
  // the message gets re-routed to a live agent instead of silently
  // targeting a dead one.
  const stickySystem = data.routed_agent_type as AgentSystem
  const stickyAgentId = data.routed_agent_id ?? null

  if (stickySystem === 'ecommerce') {
    // Ecommerce agent was turned off → expire sticky
    if (!registry.ecommerceEnabled) return null
  } else if (stickySystem.startsWith('general:')) {
    if (stickyAgentId) {
      // Specific agent was paused/deleted → expire sticky
      if (!isAgentActive(registry, stickyAgentId)) return null
    } else {
      // Type has no active agents → expire sticky
      const type = stickySystem.replace('general:', '')
      if (!isTypeActive(registry, type)) return null
    }
  }

  return { system: stickySystem, agentId: stickyAgentId }
}

// ── Broadcast reply detection ───────────────────────────────────────────

interface BroadcastReplyTarget {
  system: AgentSystem
  agentId: string | null
}

async function checkBroadcastReply(
  tenantId: string,
  contactPhone: string,
): Promise<BroadcastReplyTarget | null> {
  const contactId = await resolveContactId(tenantId, contactPhone)
  if (!contactId) return null

  const { data } = await db()
    .from('broadcast_recipients')
    .select('broadcast_id')
    .eq('contact_id', contactId)
    .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!data?.broadcast_id) return null

  const { data: broadcast } = await db()
    .from('broadcasts')
    .select('agent_type, agent_id, user_id')
    .eq('id', data.broadcast_id)
    .eq('user_id', tenantId)
    .maybeSingle()

  if (!broadcast?.agent_type) return null

  const system: AgentSystem =
    broadcast.agent_type === 'ecommerce'
      ? 'ecommerce'
      : (`general:${broadcast.agent_type}` as AgentSystem)

  return {
    system,
    agentId: system === 'ecommerce' ? null : (broadcast.agent_id ?? null),
  }
}

// ── Keyword matching ────────────────────────────────────────────────────

function matchKeywords(
  text: string,
  overrides: Record<string, string>,
): AgentSystem | null {
  const lower = text.toLowerCase().trim()

  // Built-in ecommerce keywords (always checked)
  const ecommerceKeywords = [
    'price', 'buy', 'order', 'cart', 'checkout', 'product', 'shop',
    'delivery', 'shipping', 'discount', 'offer', 'deal', 'stock',
    'available', 'cost', 'payment', 'cod', 'cash on delivery',
    // Hindi/Hinglish
    'khareedna', 'keemat', 'daam', 'rate', 'kitna', 'mangwana',
  ]

  for (const kw of ecommerceKeywords) {
    if (lower.includes(kw)) return 'ecommerce'
  }

  // Merchant-defined keyword → agent type
  for (const [keyword, agentType] of Object.entries(overrides)) {
    if (lower.includes(keyword.toLowerCase())) {
      if (agentType === 'ecommerce') return 'ecommerce'
      return `general:${agentType}` as AgentSystem
    }
  }

  return null
}

// ── Product catalog match ───────────────────────────────────────────────

async function matchProductCatalog(
  tenantId: string,
  text: string,
): Promise<boolean> {
  const lower = text.toLowerCase().trim()
  if (!lower) return false

  const { data: products, error } = await db()
    .from('ai_agent_products')
    .select('name')
    .eq('user_id', tenantId)
    .limit(1000)

  if (error || !products?.length) return false

  for (const p of products as { name: string | null }[]) {
    const name = String(p.name || '').toLowerCase().trim()
    if (!name) continue

    if (lower.includes(name)) return true

    const nameWords = name.split(/\s+/).filter((w) => w.length > 2)
    if (nameWords.length > 0 && nameWords.every((w) => lower.includes(w))) {
      return true
    }
  }

  return false
}

// ── LLM intent classification ───────────────────────────────────────────

interface IntentResult {
  system: AgentSystem
  label: string
  confidence: number
}

async function classifyIntent(
  text: string,
  activeTypes: string[],
): Promise<IntentResult> {
  const typeDescriptions: Record<string, string> = {
    ecommerce: 'Shopping, products, prices, orders, cart, checkout, delivery, returns',
    sales: 'Sales inquiries, pricing, deals, negotiations, quotes, proposals',
    marketing: 'Marketing campaigns, promotions, brand awareness, content',
    support: 'Customer support, complaints, issues, troubleshooting, help',
    realestate: 'Properties, apartments, houses, rent, buy, real estate, location, BHK, sqft',
    creative: 'Design, creative work, content creation, media',
    social: 'Social media, engagement, community, posts',
    other: 'General inquiries that don\'t fit other categories',
  }

  const activeDescriptions = activeTypes
    .map((t) => `- ${t}: ${typeDescriptions[t] || 'General'}`)
    .join('\n')

  try {
    const openaiApiKey = process.env.OPENAI_API_KEY
    if (!openaiApiKey) {
      console.error('[agent-router] OPENAI_API_KEY not set — skipping LLM classification')
      const fallbackType = activeTypes[0] || 'support'
      return {
        system: fallbackType === 'ecommerce' ? 'ecommerce' : `general:${fallbackType}`,
        label: fallbackType,
        confidence: 0.1,
      }
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${openaiApiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        temperature: 0,
        max_tokens: 60,
        messages: [
          {
            role: 'system',
            content: `You are an intent classifier for a WhatsApp business. Classify the customer's message into exactly ONE of these agent types:\n${activeDescriptions}\n\nIMPORTANT: if "ecommerce" is one of the listed types, strongly prefer it for anything that could plausibly be a customer trying to buy, browse, or ask about a product — including a bare product name, a product category (e.g. "biscuit", "snacks", "tea"), quantities, or short messages with little context. Only choose a different type when the message is CLEARLY about something else — e.g. asking about a marketing campaign or promotion content (marketing), negotiating a bulk/business deal or asking for a sales quote (sales), reporting a problem or complaint (support). When in doubt between ecommerce and another type, choose ecommerce.\n\nRespond with JSON: {"type": "<agent_type>", "confidence": 0.0-1.0}\nOnly use types from the list above.`,
          },
          { role: 'user', content: text },
        ],
      }),
    })

    if (!response.ok) {
      throw new Error(`OpenAI API ${response.status}: ${await response.text()}`)
    }

    const data = await response.json()
    const raw = data.choices?.[0]?.message?.content?.trim() ?? ''
    const jsonStr = raw.replace(/```json?\n?/g, '').replace(/```/g, '').trim()
    const parsed = JSON.parse(jsonStr)

    const chosenType = String(parsed.type || activeTypes[0])
    const confidence = Math.min(1, Math.max(0, Number(parsed.confidence) || 0.5))

    return {
      system: chosenType === 'ecommerce' ? 'ecommerce' : `general:${chosenType}`,
      label: chosenType,
      confidence,
    }
  } catch (err) {
    console.error('[agent-router] LLM classification failed:', err)
    const fallbackType = activeTypes[0] || 'support'
    return {
      system: fallbackType === 'ecommerce' ? 'ecommerce' : `general:${fallbackType}`,
      label: fallbackType,
      confidence: 0.1,
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════
// SECTION 4: PERSISTENCE & LOGGING
// ═══════════════════════════════════════════════════════════════════════

async function persistRouting(
  conversationId: string,
  decision: RoutingDecision,
): Promise<void> {
  await db()
    .from('conversations')
    .update({
      routed_agent_type: decision.system,
      routed_agent_id: decision.agentId,
      routing_reason: decision.method,
      routed_at: new Date().toISOString(),
    })
    .eq('id', conversationId)
}

async function logRouting(
  tenantId: string,
  conversationId: string,
  contactPhone: string,
  inboundText: string,
  decision: RoutingDecision,
): Promise<void> {
  try {
    await db().from('agent_routing_log').insert({
      tenant_id: tenantId,
      conversation_id: conversationId,
      contact_phone: contactPhone,
      inbound_text: inboundText.slice(0, 500),
      chosen_agent_type: decision.system,
      chosen_agent_id: decision.agentId,
      routing_method: decision.method,
      intent_detected: decision.intentLabel ?? null,
      confidence: decision.confidence ?? null,
      latency_ms: decision.latencyMs,
    })
  } catch (err) {
    // Logging failure must never block the reply
    console.error('[agent-router] log insert failed:', err)
  }
}

// ═══════════════════════════════════════════════════════════════════════
// SECTION 5: THE MAIN ROUTER
// ═══════════════════════════════════════════════════════════════════════

/**
 * Route an inbound WhatsApp message to the right agent.
 *
 * Returns a RoutingDecision the webhook uses to call exactly one agent
 * system. Returns null when no agent is configured at all.
 *
 * AGENT ISOLATION GUARANTEE:
 * - The registry is built fresh from live DB state on every call
 * - Every routing stage validates its pick against the registry
 * - A paused/deleted agent can never be selected
 * - Agents of different types are cleanly separated — type X routing
 *   can never accidentally invoke a type Y agent
 * - Stale sticky sessions pointing at dead agents are auto-expired
 */
export async function routeMessage(input: RouteInput): Promise<RoutingDecision | null> {
  const start = Date.now()
  const {
    tenantId, conversationId, contactPhone, inboundText,
    isAdLead, adsAgentId, adsAgentEnabled,
  } = input

  // ── Build live agent registry + load merchant config in parallel ──
  // This is the foundational step: from here on, the registry is the
  // single source of truth for which agents are active. No other
  // table, column, or cached value overrides it.
  const [registry, config] = await Promise.all([
    buildAgentRegistry(tenantId),
    loadRoutingConfig(tenantId),
  ])

  // No active agents at all? Nothing to route to.
  if (registry.activeTypes.length === 0) return null

  // ── 1. STICKY SESSION ─────────────────────────────────────────────
  // If this conversation was already routed to a LIVE agent, keep it.
  // Dead/paused agents are auto-expired by the registry validation.
  const sticky = await checkStickySession(conversationId, tenantId, contactPhone, registry)
  if (sticky) {
    const decision: RoutingDecision = {
      system: sticky.system,
      agentId: sticky.agentId,
      method: 'sticky',
      latencyMs: Date.now() - start,
    }
    await logRouting(tenantId, conversationId, contactPhone, inboundText, decision)
    return decision
  }

  // ── 2. ADS AGENT ──────────────────────────────────────────────────
  // Validate the ads agent is still active before routing to it
  if (adsAgentEnabled && adsAgentId && isAdLead && isAgentActive(registry, adsAgentId)) {
    const decision: RoutingDecision = {
      system: 'general:sales',
      agentId: adsAgentId,
      method: 'ads',
      latencyMs: Date.now() - start,
    }
    await persistRouting(conversationId, decision)
    await logRouting(tenantId, conversationId, contactPhone, inboundText, decision)
    return decision
  }

  // ── 3. BROADCAST REPLY ────────────────────────────────────────────
  const broadcastTarget = await checkBroadcastReply(tenantId, contactPhone)
  if (broadcastTarget) {
    const agentType = broadcastTarget.system === 'ecommerce'
      ? 'ecommerce'
      : broadcastTarget.system.replace('general:', '')

    // Validate broadcast's agent against the live registry
    const agentId = broadcastTarget.system === 'ecommerce'
      ? null
      : resolveAgent(registry, agentType, broadcastTarget.agentId)
    const resolved = withEcommerceFallback(registry, broadcastTarget.system, agentId)

    const decision: RoutingDecision = {
      system: resolved.system,
      agentId: resolved.agentId,
      method: 'broadcast',
      latencyMs: Date.now() - start,
    }
    await persistRouting(conversationId, decision)
    await logRouting(tenantId, conversationId, contactPhone, inboundText, decision)
    return decision
  }

  // ── 4. KEYWORD MATCH ──────────────────────────────────────────────
  const keywordMatch = matchKeywords(inboundText, config.keyword_overrides)
  if (keywordMatch) {
    const matchedType = keywordMatch === 'ecommerce'
      ? 'ecommerce'
      : keywordMatch.replace('general:', '')

    // Only route to the keyword match if that type is actually active
    if (isTypeActive(registry, matchedType)) {
      const rawAgentId = keywordMatch === 'ecommerce'
        ? null
        : resolveAgent(registry, matchedType)
      const resolved = withEcommerceFallback(registry, keywordMatch, rawAgentId)

      const decision: RoutingDecision = {
        system: resolved.system,
        agentId: resolved.agentId,
        method: 'keyword',
        latencyMs: Date.now() - start,
      }
      await persistRouting(conversationId, decision)
      await logRouting(tenantId, conversationId, contactPhone, inboundText, decision)
      return decision
    }
  }

  // ── 4.5 PRODUCT CATALOG MATCH ─────────────────────────────────────
  if (registry.ecommerceEnabled) {
    const productMatch = await matchProductCatalog(tenantId, inboundText)
    if (productMatch) {
      const decision: RoutingDecision = {
        system: 'ecommerce',
        agentId: null,
        method: 'keyword',
        intentLabel: 'product_catalog_match',
        latencyMs: Date.now() - start,
      }
      await persistRouting(conversationId, decision)
      await logRouting(tenantId, conversationId, contactPhone, inboundText, decision)
      return decision
    }
  }

  // ── 5. LLM INTENT CLASSIFICATION ─────────────────────────────────
  if (config.llm_routing_enabled && registry.activeTypes.length > 1) {
    const rawIntent = await classifyIntent(inboundText, registry.activeTypes)

    // Low-confidence non-ecommerce guesses default to ecommerce when active
    const intent: IntentResult =
      registry.ecommerceEnabled &&
      rawIntent.system !== 'ecommerce' &&
      rawIntent.confidence < 0.75
        ? { system: 'ecommerce', label: `${rawIntent.label}_low_confidence`, confidence: rawIntent.confidence }
        : rawIntent

    const agentType = intent.system === 'ecommerce'
      ? 'ecommerce'
      : intent.system.replace('general:', '')

    // LLM might hallucinate a type that doesn't exist — validate it
    const validatedType = isTypeActive(registry, agentType) ? agentType : registry.activeTypes[0]
    const validatedSystem: AgentSystem = validatedType === 'ecommerce'
      ? 'ecommerce'
      : `general:${validatedType}`

    const rawAgentId = validatedSystem === 'ecommerce'
      ? null
      : resolveAgent(registry, validatedType)
    const resolved = withEcommerceFallback(registry, validatedSystem, rawAgentId)

    const decision: RoutingDecision = {
      system: resolved.system,
      agentId: resolved.agentId,
      method: 'intent',
      intentLabel: intent.label,
      confidence: intent.confidence,
      latencyMs: Date.now() - start,
    }
    await persistRouting(conversationId, decision)
    await logRouting(tenantId, conversationId, contactPhone, inboundText, decision)
    return decision
  }

  // ── 6. FALLBACK ───────────────────────────────────────────────────
  // First active type in priority order (ecommerce first if present)
  const fallbackType = registry.activeTypes[0]
  const fallbackSystem: AgentSystem = fallbackType === 'ecommerce'
    ? 'ecommerce'
    : `general:${fallbackType}`
  const rawFallbackAgentId = fallbackType === 'ecommerce'
    ? null
    : resolveAgent(registry, fallbackType)
  const resolvedFallback = withEcommerceFallback(registry, fallbackSystem, rawFallbackAgentId)

  const decision: RoutingDecision = {
    system: resolvedFallback.system,
    agentId: resolvedFallback.agentId,
    method: 'fallback',
    latencyMs: Date.now() - start,
  }
  await persistRouting(conversationId, decision)
  await logRouting(tenantId, conversationId, contactPhone, inboundText, decision)
  return decision
}

// ═══════════════════════════════════════════════════════════════════════
// SECTION 6: PUBLIC UTILITIES
// ═══════════════════════════════════════════════════════════════════════

/**
 * Clear a conversation's routing assignment.
 * Call this when:
 * - A human agent takes over (status → 'pending')
 * - The merchant manually reassigns
 * - The conversation is resolved and a new topic starts
 */
export async function clearRouting(conversationId: string): Promise<void> {
  await db()
    .from('conversations')
    .update({
      routed_agent_type: null,
      routed_agent_id: null,
      routing_reason: null,
      routed_at: null,
    })
    .eq('id', conversationId)
}

/**
 * Manually assign a conversation to a specific agent.
 * Used by the dashboard when a merchant drags a conversation to an agent.
 */
export async function manualRoute(
  conversationId: string,
  tenantId: string,
  agentId: string,
  agentType: string,
): Promise<void> {
  const system: AgentSystem = agentType === 'ecommerce'
    ? 'ecommerce'
    : `general:${agentType}`

  await db()
    .from('conversations')
    .update({
      routed_agent_type: system,
      routed_agent_id: agentId,
      routing_reason: 'manual',
      routed_at: new Date().toISOString(),
    })
    .eq('id', conversationId)

  await logRouting(tenantId, conversationId, '', '[manual assignment]', {
    system,
    agentId,
    method: 'sticky',
    latencyMs: 0,
  })
}
