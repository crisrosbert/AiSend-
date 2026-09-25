/**
 * src/lib/agent-router/router.ts
 *
 * ── THE AGENT ROUTER ────────────────────────────────────────────────────
 * Decides which agent (or agent system) handles each inbound WhatsApp
 * message. Replaces the old sequential chain where every agent tried in
 * order and the first one to reply won — which meant real-estate agents
 * answering product queries.
 *
 * ── ROUTING ORDER ───────────────────────────────────────────────────────
 *   1. STICKY SESSION — conversation already assigned? Same agent answers.
 *   2. ADS AGENT     — click-to-WhatsApp ad lead? Ads agent.
 *   3. BROADCAST REPLY — replying to a broadcast? The broadcasting agent.
 *   4. KEYWORD MATCH  — merchant-defined keyword → agent type mapping.
 *   5. LLM INTENT    — GPT-4o-mini classifies the message (fast, cheap).
 *   6. FALLBACK      — first active agent in the tenant's priority list.
 *
 * ── GUARANTEE ───────────────────────────────────────────────────────────
 * Exactly ONE agent responds per message. The router picks the agent,
 * the webhook executes it. No more double-replies.
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

// ── Routing config (cached per request) ──────────────────────────────────

interface RoutingConfig {
  active_agent_types: string[]
  default_agents: Record<string, string>
  keyword_overrides: Record<string, string>
  llm_routing_enabled: boolean
}

const DEFAULT_CONFIG: RoutingConfig = {
  active_agent_types: [],
  default_agents: {},
  keyword_overrides: {},
  llm_routing_enabled: true,
}

async function loadRoutingConfig(tenantId: string): Promise<RoutingConfig> {
  const { data } = await db()
    .from('agent_routing_config')
    .select('active_agent_types, default_agents, keyword_overrides, llm_routing_enabled')
    .eq('tenant_id', tenantId)
    .maybeSingle()

  if (!data) return DEFAULT_CONFIG

  return {
    active_agent_types: Array.isArray(data.active_agent_types)
      ? data.active_agent_types
      : DEFAULT_CONFIG.active_agent_types,
    default_agents:
      typeof data.default_agents === 'object' && data.default_agents
        ? data.default_agents
        : DEFAULT_CONFIG.default_agents,
    keyword_overrides:
      typeof data.keyword_overrides === 'object' && data.keyword_overrides
        ? data.keyword_overrides
        : DEFAULT_CONFIG.keyword_overrides,
    llm_routing_enabled: data.llm_routing_enabled ?? true,
  }
}

// ── Sticky session check ─────────────────────────────────────────────────

// A sticky routing decision that's more than this old is treated as stale
// and re-evaluated from scratch. Without an expiry, one misrouted message
// (e.g. an LLM guessing "marketing" for a bare product name) would lock a
// customer's conversation to the wrong agent forever, since every later
// message short-circuits straight to the sticky system before keyword
// match, product-catalog match, or the LLM ever runs again.
const STICKY_SESSION_TTL_MS = 6 * 60 * 60 * 1000 // 6 hours

async function checkStickySession(
  conversationId: string,
): Promise<{ system: AgentSystem; agentId: string | null } | null> {
  const { data } = await db()
    .from('conversations')
    .select('routed_agent_type, routed_agent_id, status, routed_at')
    .eq('id', conversationId)
    .maybeSingle()

  // No routing yet, or conversation was handed to a human
  if (!data?.routed_agent_type || data.status === 'pending') return null

  // Stale — let the message be re-routed (keyword/product/LLM) instead of
  // permanently repeating whatever agent answered hours/days ago.
  if (data.routed_at) {
    const age = Date.now() - new Date(data.routed_at).getTime()
    if (age > STICKY_SESSION_TTL_MS) return null
  }

  return {
    system: data.routed_agent_type as AgentSystem,
    agentId: data.routed_agent_id ?? null,
  }
}

// ── Broadcast reply detection ────────────────────────────────────────────

async function checkBroadcastReply(
  tenantId: string,
  contactPhone: string,
): Promise<AgentSystem | null> {
  // This previously queried tables that don't exist in the schema
  // ("broadcast_contacts", "broadcast_histories") — see 001_initial_schema.sql,
  // where broadcast sends live in "broadcasts" and recipients in
  // "broadcast_recipients" (keyed by contact_id, not phone). Every call
  // silently returned null, so broadcast-reply routing has never actually
  // fired. Resolve the contact first, since that's what broadcast_recipients
  // is keyed on.
  const { data: contact } = await db()
    .from('contacts')
    .select('id')
    .eq('user_id', tenantId)
    .eq('phone', contactPhone)
    .maybeSingle()

  if (!contact?.id) return null

  // Check if this contact received a broadcast recently (within 24h window)
  // and the broadcast had an agent_type tag.
  const { data } = await db()
    .from('broadcast_recipients')
    .select('broadcast_id')
    .eq('contact_id', contact.id)
    .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!data?.broadcast_id) return null

  // Check if the broadcast had an agent_type
  const { data: broadcast } = await db()
    .from('broadcasts')
    .select('agent_type, user_id')
    .eq('id', data.broadcast_id)
    .eq('user_id', tenantId)
    .maybeSingle()

  if (!broadcast?.agent_type) return null

  // Map broadcast agent_type to system
  if (broadcast.agent_type === 'ecommerce') return 'ecommerce'
  return `general:${broadcast.agent_type}` as AgentSystem
}

// ── Keyword matching ─────────────────────────────────────────────────────

function matchKeywords(
  text: string,
  overrides: Record<string, string>,
): AgentSystem | null {
  const lower = text.toLowerCase().trim()

  // Built-in ecommerce keywords (always active if ecommerce is in the list)
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

// ── Product catalog match ────────────────────────────────────────────────
//
// A bare product name ("Green tea", "Organic ragi") has none of the
// generic buy/price/shop words above, so it falls through to the LLM —
// which, with no purchase-intent cue in the text, can easily guess
// "marketing" or "sales" instead of "ecommerce". If the tenant has
// actually synced a product with (or containing) that name, the message
// is unambiguous: route straight to ecommerce, no LLM call, no risk of
// misclassification.
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

    // Whole product name appears in the message verbatim
    // ("I need green tea" contains "green tea").
    if (lower.includes(name)) return true

    // Or every significant word of the product name appears somewhere
    // in the message, in any order (tolerates punctuation/word-order
    // differences like "ragi organic" vs "Organic Ragi").
    const nameWords = name.split(/\s+/).filter((w) => w.length > 2)
    if (nameWords.length > 0 && nameWords.every((w) => lower.includes(w))) {
      return true
    }
  }

  return false
}

// ── LLM intent classification ────────────────────────────────────────────

interface IntentResult {
  system: AgentSystem
  label: string
  confidence: number
}

async function classifyIntent(
  text: string,
  activeTypes: string[],
): Promise<IntentResult> {
  // Build the agent type descriptions for the LLM
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
            content: `You are an intent classifier for a WhatsApp business. Classify the customer's message into exactly ONE of these agent types:\n${activeDescriptions}\n\nRespond with JSON: {"type": "<agent_type>", "confidence": 0.0-1.0}\nIf unsure, pick the closest match with lower confidence. Only use types from the list above.`,
          },
          {
            role: 'user',
            content: text,
          },
        ],
      }),
    })

    if (!response.ok) {
      throw new Error(`OpenAI API ${response.status}: ${await response.text()}`)
    }

    const data = await response.json()
    const raw = data.choices?.[0]?.message?.content?.trim() ?? ''
    // Parse JSON from the response (handle markdown code blocks)
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
    // Fallback: return first active type with low confidence
    const fallbackType = activeTypes[0] || 'support'
    return {
      system: fallbackType === 'ecommerce' ? 'ecommerce' : `general:${fallbackType}`,
      label: fallbackType,
      confidence: 0.1,
    }
  }
}

// ── Resolve agent ID for a general:<type> system ─────────────────────────

async function resolveAgentId(
  tenantId: string,
  agentType: string,
  config: RoutingConfig,
): Promise<string | null> {
  // Check default_agents mapping first
  const defaultId = config.default_agents[agentType]
  if (defaultId) return defaultId

  // Find the first active agent of this type for this tenant
  const { data } = await db()
    .from('agents')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('agent_type', agentType)
    .eq('is_active', true)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  return data?.id ?? null
}

// If routing picks a general:<type> agent but no active agent of that
// type exists for this tenant (e.g. the merchant only ever set up the
// ecommerce/product agent, never a dedicated Sales/Support bot),
// resolveAgentId returns null. The webhook only calls the general-agent
// handler when agentId is truthy (routing.system.startsWith('general:')
// && routing.agentId) — so a null agentId here silently drops the reply
// entirely, with no error and no fallback, which is why messages that
// get classified as "sales"/"support"/etc. sometimes get NO WhatsApp
// reply at all. Fall back to the ecommerce agent (if active) instead of
// leaving the customer unanswered.
function withAgentFallback(
  system: AgentSystem,
  agentId: string | null,
  config: RoutingConfig,
): { system: AgentSystem; agentId: string | null } {
  if (system.startsWith('general:') && !agentId && config.active_agent_types.includes('ecommerce')) {
    return { system: 'ecommerce', agentId: null }
  }
  return { system, agentId }
}

// ── Persist routing decision ─────────────────────────────────────────────

async function persistRouting(
  conversationId: string,
  decision: RoutingDecision,
): Promise<void> {
  // Update conversation with sticky session
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
      inbound_text: inboundText.slice(0, 500), // Trim for storage
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

// ── THE MAIN ROUTER ──────────────────────────────────────────────────────

/**
 * Route an inbound WhatsApp message to the right agent.
 *
 * Returns a RoutingDecision the webhook uses to call exactly one agent
 * system. Returns null when no agent is configured at all (the webhook
 * should fall through to automations only).
 */
export async function routeMessage(input: RouteInput): Promise<RoutingDecision | null> {
  const start = Date.now()
  const {
    tenantId, conversationId, contactPhone, inboundText,
    isAdLead, adsAgentId, adsAgentEnabled,
  } = input

  // ── 1. STICKY SESSION ─────────────────────────────────────────────
  // If this conversation was already routed, keep it there.
  const sticky = await checkStickySession(conversationId)
  if (sticky) {
    const decision: RoutingDecision = {
      system: sticky.system,
      agentId: sticky.agentId,
      method: 'sticky',
      latencyMs: Date.now() - start,
    }
    // Log but don't update — it's already persisted
    await logRouting(tenantId, conversationId, contactPhone, inboundText, decision)
    return decision
  }

  // ── 2. ADS AGENT ──────────────────────────────────────────────────
  if (adsAgentEnabled && adsAgentId && isAdLead) {
    const decision: RoutingDecision = {
      system: `general:sales`, // Ads leads are sales
      agentId: adsAgentId,
      method: 'ads',
      latencyMs: Date.now() - start,
    }
    await persistRouting(conversationId, decision)
    await logRouting(tenantId, conversationId, contactPhone, inboundText, decision)
    return decision
  }

  // ── Load tenant routing config ────────────────────────────────────
  const config = await loadRoutingConfig(tenantId)

  // If the tenant has no routing config, check if they have the old-style
  // whatsapp_agent_id or ecommerce agent — build a fallback config.
  if (config.active_agent_types.length === 0) {
    // Auto-detect: check if ecommerce agent is configured
    const { data: aiConfig } = await db()
      .from('ai_agent_configs')
      .select('id')
      .eq('user_id', tenantId)
      .eq('is_active', true)
      .maybeSingle()

    if (aiConfig) {
      config.active_agent_types.push('ecommerce')
    }

    // Check for general agents
    const { data: agents } = await db()
      .from('agents')
      .select('id, agent_type')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .order('created_at', { ascending: true })

    if (agents?.length) {
      for (const a of agents) {
        const type = a.agent_type || 'other'
        if (!config.active_agent_types.includes(type)) {
          config.active_agent_types.push(type)
        }
        // First agent of each type becomes the default
        if (!config.default_agents[type]) {
          config.default_agents[type] = a.id
        }
      }
    }

    // Still nothing? No agent at all.
    if (config.active_agent_types.length === 0) return null
  }

  // ── 3. BROADCAST REPLY ────────────────────────────────────────────
  const broadcastSystem = await checkBroadcastReply(tenantId, contactPhone)
  if (broadcastSystem) {
    const agentType = broadcastSystem === 'ecommerce'
      ? 'ecommerce'
      : broadcastSystem.replace('general:', '')
    const agentId = broadcastSystem === 'ecommerce'
      ? null
      : await resolveAgentId(tenantId, agentType, config)

    const decision: RoutingDecision = {
      system: broadcastSystem,
      agentId,
      method: 'broadcast',
      latencyMs: Date.now() - start,
    }
    await persistRouting(conversationId, decision)
    await logRouting(tenantId, conversationId, contactPhone, inboundText, decision)
    return decision
  }

  // ── 4. KEYWORD MATCH ──────────────────────────────────────────────
  const keywordMatch = matchKeywords(inboundText, config.keyword_overrides)
  if (keywordMatch && config.active_agent_types.includes(
    keywordMatch === 'ecommerce' ? 'ecommerce' : keywordMatch.replace('general:', ''),
  )) {
    const agentType = keywordMatch === 'ecommerce'
      ? 'ecommerce'
      : keywordMatch.replace('general:', '')
    const rawAgentId = keywordMatch === 'ecommerce'
      ? null
      : await resolveAgentId(tenantId, agentType, config)
    const resolved = withAgentFallback(keywordMatch, rawAgentId, config)

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

  // ── 4.5 PRODUCT CATALOG MATCH ─────────────────────────────────────
  // Deterministic and cheap — checked before the LLM so a plain product
  // name never gets misclassified as "marketing"/"sales" for lack of a
  // generic buy/price keyword.
  if (config.active_agent_types.includes('ecommerce')) {
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
  if (config.llm_routing_enabled && config.active_agent_types.length > 1) {
    const intent = await classifyIntent(inboundText, config.active_agent_types)
    const agentType = intent.system === 'ecommerce'
      ? 'ecommerce'
      : intent.system.replace('general:', '')
    const rawAgentId = intent.system === 'ecommerce'
      ? null
      : await resolveAgentId(tenantId, agentType, config)
    const resolved = withAgentFallback(intent.system, rawAgentId, config)

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
  // Use the first active agent type in priority order.
  const fallbackType = config.active_agent_types[0]
  const fallbackSystem: AgentSystem = fallbackType === 'ecommerce'
    ? 'ecommerce'
    : `general:${fallbackType}`
  const rawFallbackAgentId = fallbackType === 'ecommerce'
    ? null
    : await resolveAgentId(tenantId, fallbackType, config)
  const resolvedFallback = withAgentFallback(fallbackSystem, rawFallbackAgentId, config)

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
    method: 'sticky', // logged as sticky since it's a manual override
    latencyMs: 0,
  })
}
