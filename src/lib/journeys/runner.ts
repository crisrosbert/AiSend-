// src/lib/journeys/runner.ts
//
// Journey execution engine. Called from the webhook AFTER the inbound
// message has been saved. Looks up active journeys for the user,
// matches the inbound text against trigger keywords, walks the canvas
// graph, and dispatches each node (send message, tag contact, webhook
// call, etc).
//
// Design notes:
//   - User-scoped: every query filters by user_id. Multi-tenant safe.
//   - Schema-correct: writes to messages with (conversation_id,
//     sender_type, content_type, content_text) — never invents columns.
//   - Tag handling goes through the tags + contact_tags join, not a
//     non-existent contacts.tag column.
//   - Recursive graph walk: handles multi-step flows (Trigger → A → B → C),
//     with a depth cap to prevent runaway loops.
//   - Credits deducted AFTER each successful Meta send (same pattern as
//     /api/whatsapp/send and /api/whatsapp/broadcast).
//   - Gemini fallback is opt-in per user via env. Never hardcoded.
//   - A journey is a script, not a speaker: when no keyword trigger
//     matches, this returns false and lets the caller's own AI agent
//     (the one the merchant assigned to the WhatsApp number, with its
//     real persona and tools) answer instead. Journeys used to run a
//     second, thinner AI reply of their own here — a separate persona
//     scoped to whichever journey happened to be first, with no tools
//     — which meant the assigned agent never got a turn as long as any
//     journey existed. Matches how AiSensy splits the two: Flows are
//     pure trigger+script, one Orchestrator answers everything else.

import { createClient } from '@supabase/supabase-js'
import {
  sendTextMessage,
  sendButtonMessage,
  sendListMessage,
  sendCatalogueMessage,
  sendSingleProductMessage,
  sendMultiProductMessage,
  type InteractiveHeader,
  type MetaSendResult,
} from '@/lib/whatsapp/meta-api'
import {
  getOrgIdForUser,
  deductCredits,
  MESSAGE_PRICE_INR,
} from '@/lib/billing/credits'
import { callLLM, hasProviderKey } from '@/lib/agent/llm-provider'

// Lazy admin client — same pattern as the webhook to avoid build-time
// crashes when env vars are missing.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _adminClient: any = null
function admin() {
  if (!_adminClient) {
    _adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )
  }
  return _adminClient
}

// ── Types matching src/types/journey.ts ──

interface JourneyNode {
  id: string
  type: string
  position?: { x: number; y: number }
  data?: Record<string, unknown>
}

interface JourneyEdge {
  id: string
  source: string
  target: string
  /** Which outlet of a branching node this edge leaves from.
   *  Absent means "the default path" — see walk(). */
  sourceHandle?: string
}

interface JourneyTrigger {
  type: 'keyword' | 'regex' | 'template_start' | 'ad_click'
  keywords?: string[]
  regex?: { pattern: string; caseSensitive: boolean }
}

interface JourneyRow {
  id: string
  user_id: string
  name: string
  status: 'draft' | 'active' | 'paused'
  trigger: JourneyTrigger
  nodes: JourneyNode[]
  edges: JourneyEdge[]
}

// ── Public entry point ──

export interface RunJourneysArgs {
  userId: string
  /** Needed only to check whether AI Routing is turned on for this
   *  business. Absent (e.g. legacy callers) just skips that check. */
  businessId?: string | null
  conversationId: string
  contactId: string
  customerPhone: string
  inboundText: string
  phoneNumberId: string
  accessToken: string
}

/**
 * Try to execute any active journey for this user whose trigger matches
 * the inbound text. Returns true when a journey ran. Returns false when
 * nothing matched — the caller then falls through to the assigned AI
 * agent, which is deliberate: journeys don't speak for themselves.
 *
 * Errors are logged and swallowed — never throws.
 */
export async function runJourneysForInbound(
  args: RunJourneysArgs,
): Promise<boolean> {
  try {
    console.log('[journeys.runner] CALLED with text:', args.inboundText)
    const text = (args.inboundText || '').trim()
    if (!text) return false

    // Fetch ALL active journeys for THIS user. Filtering by user_id is
    // mandatory — without it we'd run another tenant's journey.
    const { data: journeys, error } = await admin()
      .from('journeys')
      .select('id, user_id, name, status, trigger, nodes, edges')
      .eq('user_id', args.userId)
      .eq('status', 'active')

    console.log('[journeys.runner] journeys found:', journeys?.length ?? 0)
    if (error) console.error('[journeys.runner] fetch error:', error.message)

    if (error) {
      console.error('[journeys.runner] fetch failed:', error.message)
      return false
    }
    if (!journeys || journeys.length === 0) return false

    // Resolve org_id for billing (best-effort — if no org, we still send
    // but skip credit deduction so the message isn't blocked).
    const orgId = await getOrgIdForUser(admin(), args.userId)

    for (const journey of journeys as JourneyRow[]) {
      if (triggerMatches(journey.trigger, text)) {
        await executeJourney(journey, args, orgId)
        return true
      }
    }

    // No keyword matched. If this business has AI Routing on, let a
    // model pick the best-fitting journey by intent before giving up —
    // this is the one place a journey is chosen without an exact
    // keyword, matching how AiSensy's AI Routing sits above its Flows.
    const routed = await routeByIntent(journeys as JourneyRow[], args)
    if (routed) {
      await executeJourney(routed, args, orgId)
      return true
    }

    // Nothing matched, keyword or AI-routed. Not this layer's job to
    // answer — the caller falls through to the assigned AI agent.
    return false
  } catch (err) {
    console.error('[journeys.runner] unhandled error:', err)
    return false
  }
}

// ── Trigger matching ──

function triggerMatches(trigger: JourneyTrigger, inbound: string): boolean {
  if (!trigger || !trigger.type) return false
  const lower = inbound.toLowerCase().trim()

  if (trigger.type === 'keyword') {
    const keywords = (trigger.keywords || [])
      .map((k) => k.trim().toLowerCase())
      .filter(Boolean)
    if (keywords.length === 0) return false
    return keywords.some((kw) => containsWord(lower, kw))
  }

  if (trigger.type === 'regex' && trigger.regex?.pattern) {
    try {
      const flags = trigger.regex.caseSensitive ? '' : 'i'
      return new RegExp(trigger.regex.pattern, flags).test(inbound)
    } catch (err) {
      console.warn('[journeys.runner] invalid regex:', err)
      return false
    }
  }

  return false
}

/**
 * Does `haystack` contain `needle` as a whole word?
 * Handles unicode by treating non-letter chars as boundaries.
 */
function containsWord(haystack: string, needle: string): boolean {
  if (!needle) return false
  if (needle.includes(' ')) return haystack.includes(needle)

  const idx = haystack.indexOf(needle)
  if (idx === -1) return false
  const before = idx === 0 ? '' : haystack[idx - 1]
  const after = idx + needle.length >= haystack.length
    ? ''
    : haystack[idx + needle.length]
  const isBoundary = (c: string) => !c || !/[\p{L}\p{N}]/u.test(c)
  return isBoundary(before) && isBoundary(after)
}

// ── AI Routing ──
//
// Off by default (businesses.ai_routing_enabled), and only even
// attempted once no exact keyword matched — a merchant who wrote
// "book" as a trigger gets exactly that script; AI Routing only
// covers what nobody predicted. A journey's name and its own trigger
// keywords are the only description the model gets of what it does;
// there is no separate "purpose" field to write yet, so those double
// as the hint.

/**
 * Is AI Routing turned on for this business? False (and silent) for
 * every reason it might not apply — no businessId, no row, the column
 * not existing yet on an unmigrated database — so a missing setting
 * degrades to "off" rather than breaking the webhook.
 */
async function aiRoutingEnabled(businessId: string | null | undefined): Promise<boolean> {
  if (!businessId) return false
  try {
    const { data } = await admin()
      .from('businesses')
      .select('ai_routing_enabled')
      .eq('id', businessId)
      .maybeSingle()
    return data?.ai_routing_enabled === true
  } catch {
    return false
  }
}

/**
 * When no keyword matched, ask the model which active journey (if any)
 * the inbound message was actually trying to reach. Returns null on
 * anything short of a confident, valid match — a wrong guess sends the
 * customer into the wrong script, which is worse than the plain agent
 * reply this falls back to.
 */
async function routeByIntent(
  journeys: JourneyRow[],
  args: RunJourneysArgs,
): Promise<JourneyRow | null> {
  if (journeys.length === 0) return null
  if (!(await aiRoutingEnabled(args.businessId))) return null
  if (!hasProviderKey()) return null

  // Only journeys that actually describe themselves are worth offering
  // to the model — an untitled draft with no keywords gives it nothing
  // to match against and is more likely to be guessed into by mistake.
  const candidates = journeys.filter(
    (j) => j.name && j.name.trim() && j.name.trim().toLowerCase() !== 'untitled journey',
  )
  if (candidates.length === 0) return null

  const menu = candidates
    .map((j, i) => {
      const kw = (j.trigger?.keywords || []).filter(Boolean).join(', ')
      return `${i + 1}. id=${j.id} — "${j.name}"${kw ? ` (also triggers on: ${kw})` : ''}`
    })
    .join('\n')

  const system =
    'You route an inbound WhatsApp message to the ONE existing automated flow that best ' +
    "matches what the customer wants, using only the flow names/keywords below — never invent " +
    'a flow. Reply with ONLY the id of the best match, nothing else. If none of them are a ' +
    'confident match for this specific message, reply with exactly: NONE.\n\nFlows:\n' + menu

  try {
    const resp = await callLLM(system, [{ role: 'user', text: args.inboundText }], [])
    const answer = resp.text.trim()
    if (!answer || /^none$/i.test(answer)) return null

    // The model is asked to answer with only the id — but is not
    // trusted to. Anything other than an exact id from the menu we
    // actually offered is treated as no match.
    const picked = candidates.find((j) => answer === j.id || answer.includes(j.id))
    return picked ?? null
  } catch (err) {
    console.warn('[journeys.runner] AI routing call failed:', err)
    return null
  }
}

// ── Graph execution ──

const MAX_DEPTH = 20

async function executeJourney(
  journey: JourneyRow,
  args: RunJourneysArgs,
  orgId: string | null,
): Promise<void> {
  const triggerNode = journey.nodes.find(
    (n) => n.type === 'TRIGGER' || n.id === 'trigger',
  )
  const startId = triggerNode?.id || 'trigger'
  const visited = new Set<string>()
  await walk(journey, startId, visited, args, orgId, 0)
}

/**
 * What a node tells the walker to do next.
 *
 * `handle` is how CONDITION branches: it names which outgoing edge to
 * follow, matched against JourneyEdge.sourceHandle. Without it every
 * outgoing edge is followed, which is correct for ordinary send nodes
 * and was previously (wrongly) also what CONDITION did — meaning both
 * branches of every condition executed.
 */
interface NodeResult {
  continue: boolean
  handle?: string
}

async function walk(
  journey: JourneyRow,
  fromId: string,
  visited: Set<string>,
  args: RunJourneysArgs,
  orgId: string | null,
  depth: number,
  handleFilter?: string,
): Promise<void> {
  if (depth > MAX_DEPTH) {
    console.warn('[journeys.runner] max depth exceeded for journey', journey.id)
    return
  }

  let outgoing = (journey.edges || []).filter((e) => e.source === fromId)

  // A branching node restricts which edges may be taken. Edges drawn
  // without an explicit handle count as the "true" path, so a condition
  // wired with a single unlabelled edge still behaves sensibly.
  if (handleFilter !== undefined) {
    outgoing = outgoing.filter((e) => (e.sourceHandle ?? 'true') === handleFilter)
  }

  for (const edge of outgoing) {
    if (visited.has(edge.target)) continue
    visited.add(edge.target)

    const node = journey.nodes.find((n) => n.id === edge.target)
    if (!node) continue

    const result = await executeNode(node, args, orgId)
    if (result.continue) {
      await walk(journey, node.id, visited, args, orgId, depth + 1, result.handle)
    }
  }
}

async function executeNode(
  node: JourneyNode,
  args: RunJourneysArgs,
  orgId: string | null,
): Promise<NodeResult> {
  const data = node.data || {}
  const type = node.type

  try {
    switch (type) {
      // Buttons are what let a flow branch on a CHOICE rather than on
      // parsed free text. Sending the body without them (the old
      // behaviour) silently turned every menu into a dead end.
      case 'TEXT_BUTTONS': {
        const text = String(data.text || '').trim()
        if (!text) return { continue: true }
        const buttons = buttonsFrom(data.buttons)

        if (buttons.length === 0) {
          await sendBotMessage(args, text, orgId)
          return { continue: true }
        }

        await deliver(args, orgId, text, () =>
          sendButtonMessage({
            phoneNumberId: args.phoneNumberId,
            accessToken: args.accessToken,
            to: args.customerPhone,
            body: text,
            buttons,
          }),
        )
        return { continue: true }
      }

      case 'MEDIA_BUTTONS': {
        const caption = String(data.caption || data.text || '').trim()
        const mediaUrl = String(data.mediaUrl || '').trim()
        const mediaType = String(data.mediaType || 'image')
        const buttons = buttonsFrom(data.buttons)

        // Meta requires a body on interactive messages, so a media node
        // with no caption cannot be sent as one.
        if (!caption) {
          if (mediaUrl) console.warn('[journeys.runner] MEDIA_BUTTONS needs a caption')
          return { continue: true }
        }

        if (buttons.length === 0) {
          await sendBotMessage(args, caption, orgId)
          return { continue: true }
        }

        const header: InteractiveHeader | undefined = mediaUrl
          ? mediaType === 'video'
            ? { type: 'video', link: mediaUrl }
            : mediaType === 'document'
              ? { type: 'document', link: mediaUrl }
              : { type: 'image', link: mediaUrl }
          : undefined

        await deliver(args, orgId, caption, () =>
          sendButtonMessage({
            phoneNumberId: args.phoneNumberId,
            accessToken: args.accessToken,
            to: args.customerPhone,
            body: caption,
            buttons,
            header,
          }),
        )
        return { continue: true }
      }

      case 'LIST': {
        const body = String(data.body || data.text || '').trim()
        if (!body) return { continue: true }

        const sections = listSectionsFrom(data)
        if (sections.length === 0) {
          await sendBotMessage(args, body, orgId)
          return { continue: true }
        }

        const headerText = String(data.header || '').trim()
        await deliver(args, orgId, body, () =>
          sendListMessage({
            phoneNumberId: args.phoneNumberId,
            accessToken: args.accessToken,
            to: args.customerPhone,
            body,
            buttonText: String(data.buttonText || 'Choose'),
            sections,
            header: headerText ? { type: 'text', text: headerText } : undefined,
          }),
        )
        return { continue: true }
      }

      case 'CATALOGUE': {
        const body = String(data.body || data.text || 'Browse our catalogue').trim()
        await deliver(args, orgId, body, () =>
          sendCatalogueMessage({
            phoneNumberId: args.phoneNumberId,
            accessToken: args.accessToken,
            to: args.customerPhone,
            body,
            thumbnailProductRetailerId: productIdsFrom(data.productIds)[0],
          }),
        )
        return { continue: true }
      }

      case 'SINGLE_PRODUCT': {
        const body = String(data.body || data.text || '').trim()
        const catalogId = String(data.catalogId || '').trim()
        const productId = productIdsFrom(data.productIds)[0]

        if (!catalogId || !productId) {
          console.warn('[journeys.runner] SINGLE_PRODUCT needs catalogId + one product')
          return { continue: true }
        }

        await deliver(args, orgId, body || 'Product', () =>
          sendSingleProductMessage({
            phoneNumberId: args.phoneNumberId,
            accessToken: args.accessToken,
            to: args.customerPhone,
            body: body || 'Have a look at this',
            catalogId,
            productRetailerId: productId,
          }),
        )
        return { continue: true }
      }

      case 'MULTI_PRODUCT': {
        const body = String(data.body || data.text || '').trim()
        const catalogId = String(data.catalogId || '').trim()
        const productIds = productIdsFrom(data.productIds)

        if (!catalogId || productIds.length === 0) {
          console.warn('[journeys.runner] MULTI_PRODUCT needs catalogId + products')
          return { continue: true }
        }

        await deliver(args, orgId, body || 'Products', () =>
          sendMultiProductMessage({
            phoneNumberId: args.phoneNumberId,
            accessToken: args.accessToken,
            to: args.customerPhone,
            body: body || 'Have a look at these',
            catalogId,
            sections: [
              {
                title: String(data.header || 'Products'),
                productRetailerIds: productIds,
              },
            ],
          }),
        )
        return { continue: true }
      }

      case 'TEMPLATE': {
        console.log('[journeys.runner] TEMPLATE node skipped (Phase 3)')
        return { continue: true }
      }

      case 'TAG_CONTACT': {
        const tagName = String(data.tagName || '').trim()
        const operation = (data.operation as string) || 'add'
        if (tagName) {
          await applyTagToContact(args.userId, args.contactId, tagName, operation === 'remove')
        }
        return { continue: true }
      }

      case 'WEBHOOK_CALL': {
        const endpoint = String(data.endpoint || '').trim()
        const method = (data.method as string) || 'POST'
        if (endpoint) {
          await callWebhook(endpoint, method, args)
        }
        return { continue: true }
      }

      // Evaluate, then tell the walker which branch to take. Previously
      // this returned "continue" with no handle, so BOTH branches ran and
      // the customer received every outcome at once.
      case 'CONDITION': {
        const passed = evaluateCondition(data, args)
        return { continue: true, handle: passed ? 'true' : 'false' }
      }

      case 'HANDOFF_TO_HUMAN': {
        const msg = String(data.customerMessage || 'An agent will reply shortly.').trim()
        if (msg) {
          await sendBotMessage(args, msg, orgId)
        }
        await admin()
          .from('conversations')
          .update({ status: 'pending', updated_at: new Date().toISOString() })
          .eq('id', args.conversationId)
        // Stop the flow — a human owns this conversation now.
        return { continue: false }
      }

      case 'CONVERSION_EVENT': {
        console.log('[journeys.runner] CONVERSION_EVENT skipped (Phase 3)')
        return { continue: true }
      }

      default:
        console.warn('[journeys.runner] unknown node type:', type)
        return { continue: true }
    }
  } catch (err) {
    // One broken node must not silently kill the rest of the flow, but
    // it must not branch either — carry on down every edge.
    console.error(`[journeys.runner] node ${node.id} (${type}) failed:`, err)
    return { continue: true }
  }
}

// ── Node config readers ──
//
// The canvas stores node config as loose JSON, so every read is
// defensive: a half-configured node should degrade to a plain message
// or a skipped step, never throw inside a customer conversation.

/** Button titles are stored as a plain string[]; Meta needs {id,title}. */
function buttonsFrom(raw: unknown): { id: string; title: string }[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map((title, index) => ({ id: `btn_${index}`, title: String(title ?? '').trim() }))
    .filter((b) => b.title.length > 0)
    .slice(0, 3)
}

/** Product ids may arrive as an array or a comma-separated string. */
function productIdsFrom(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.map((id) => String(id ?? '').trim()).filter(Boolean)
  }
  if (typeof raw === 'string') {
    return raw.split(',').map((id) => id.trim()).filter(Boolean)
  }
  return []
}

/**
 * Read list sections from node config, accepting either a structured
 * `sections` array or a flat `rows` array (which becomes one section).
 */
function listSectionsFrom(
  data: Record<string, unknown>,
): { title: string; rows: { id: string; title: string; description?: string }[] }[] {
  const toRow = (row: unknown, index: number) => {
    if (typeof row === 'string') {
      return { id: `row_${index}`, title: row.trim() }
    }
    const obj = (row ?? {}) as Record<string, unknown>
    return {
      id: String(obj.id ?? `row_${index}`),
      title: String(obj.title ?? '').trim(),
      description: obj.description ? String(obj.description) : undefined,
    }
  }

  if (Array.isArray(data.sections)) {
    return (data.sections as unknown[])
      .map((section) => {
        const obj = (section ?? {}) as Record<string, unknown>
        const rows = Array.isArray(obj.rows)
          ? (obj.rows as unknown[]).map(toRow).filter((r) => r.title)
          : []
        return { title: String(obj.title ?? 'Options'), rows }
      })
      .filter((s) => s.rows.length > 0)
  }

  if (Array.isArray(data.rows)) {
    const rows = (data.rows as unknown[]).map(toRow).filter((r) => r.title)
    return rows.length ? [{ title: String(data.header ?? 'Options'), rows }] : []
  }

  return []
}

/**
 * Evaluate a CONDITION node.
 *
 * Only variables the runner actually holds are resolvable today — the
 * inbound text and the customer's phone. Anything else resolves to an
 * empty string rather than throwing, so an unrecognised variable takes
 * the "false" branch instead of breaking the conversation. Richer
 * variables (contact fields, tags) need a context object passed through
 * the walker; that is a deliberate next step, not an oversight.
 */
function evaluateCondition(
  data: Record<string, unknown>,
  args: RunJourneysArgs,
): boolean {
  const variable = String(data.variable ?? '').trim().toLowerCase()
  const operator = String(data.operator ?? 'equals')
  const compare = String(data.value ?? '').trim()

  let actual = ''
  if (['last_message', 'message', 'text', 'inbound', 'last_message_text'].includes(variable)) {
    actual = (args.inboundText || '').trim()
  } else if (['phone', 'contact.phone', 'customer_phone'].includes(variable)) {
    actual = args.customerPhone || ''
  } else if (variable) {
    console.warn('[journeys.runner] CONDITION: unresolvable variable', variable)
  }

  const left = actual.toLowerCase()
  const right = compare.toLowerCase()

  switch (operator) {
    case 'exists':
      return actual.length > 0
    case 'contains':
      return right.length > 0 && left.includes(right)
    case 'starts_with':
      return right.length > 0 && left.startsWith(right)
    case 'greater_than':
      return Number(actual) > Number(compare)
    case 'less_than':
      return Number(actual) < Number(compare)
    case 'equals':
    default:
      return left === right
  }
}

// ── Helpers ──

/**
 * Send a text message to the customer, save it to the messages table,
 * and deduct credits from the org wallet.
 *
 * Credit deduction follows the same pattern as /api/whatsapp/send:
 *   - Deduct AFTER Meta accepts the message (never charge for failed sends)
 *   - Journey bot replies are priced as 'service' messages (₹0) by default
 *     since they're inbound-triggered replies within the 24h window.
 *   - If we ever send TEMPLATE nodes (Phase 3), price them as 'marketing'.
 */
/**
 * Send anything to the customer, then record and bill it identically.
 *
 * Every outbound message from a journey — plain text, buttons, a list,
 * a product carousel — must land in `messages`, refresh the inbox
 * preview, and go through the same credit path. Passing the send call in
 * keeps that lifecycle in exactly one place, so a new message type can
 * never quietly skip logging or billing.
 *
 * `preview` is what gets stored and shown in the inbox. For interactive
 * messages that is the body text; the buttons themselves are not part of
 * the transcript.
 */
async function deliver(
  args: RunJourneysArgs,
  orgId: string | null,
  preview: string,
  send: () => Promise<MetaSendResult>,
): Promise<void> {
  let metaMessageId: string | null = null
  try {
    const result = await send()
    metaMessageId = result?.messageId ?? null
  } catch (err) {
    console.error('[journeys.runner] send failed:', err)
  }
  await recordAndBill(args, orgId, preview, metaMessageId)
}

/** Plain-text convenience wrapper — the common case. */
async function sendBotMessage(
  args: RunJourneysArgs,
  text: string,
  orgId: string | null,
): Promise<void> {
  await deliver(args, orgId, text, () =>
    sendTextMessage({
      phoneNumberId: args.phoneNumberId,
      accessToken: args.accessToken,
      to: args.customerPhone,
      text,
    }),
  )
}

async function recordAndBill(
  args: RunJourneysArgs,
  orgId: string | null,
  text: string,
  metaMessageId: string | null,
): Promise<void> {

  // Save to messages with the REAL schema.
  const { error: msgErr } = await admin().from('messages').insert({
    conversation_id: args.conversationId,
    sender_type: 'bot',
    content_type: 'text',
    content_text: text,
    message_id: metaMessageId,
    status: metaMessageId ? 'sent' : 'failed',
    created_at: new Date().toISOString(),
  })

  if (msgErr) {
    console.error('[journeys.runner] message insert failed:', msgErr.message)
    return
  }

  // Update conversation last_message preview.
  await admin()
    .from('conversations')
    .update({
      last_message_text: text,
      last_message_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', args.conversationId)

  // Deduct credits — only if Meta accepted the message AND we have an org.
  // Journey bot replies are priced as 'service' (₹0) since they fire within
  // the 24h customer-initiated window. This mirrors WhatsApp's own pricing
  // where service conversations are free. If you want to charge for journey
  // replies, change 'service' to 'marketing' here.
  if (metaMessageId && orgId) {
    const price = MESSAGE_PRICE_INR['service'] // ₹0 for inbound-triggered replies
    if (price > 0) {
      const deb = await deductCredits(admin(), {
        orgId,
        userId: args.userId,
        amount: price,
        description: `Journey bot reply`,
        reference: metaMessageId,
      })
      if (!deb.ok) {
        console.warn('[journeys.runner] credit deduction failed:', deb.message)
      }
    }
  }
}

/**
 * Add or remove a tag for a contact. Uses the tags + contact_tags join
 * table, never a non-existent contacts.tag column.
 */
async function applyTagToContact(
  userId: string,
  contactId: string,
  tagName: string,
  remove: boolean,
): Promise<void> {
  const { data: existingTag } = await admin()
    .from('tags')
    .select('id')
    .eq('user_id', userId)
    .ilike('name', tagName)
    .maybeSingle()

  let tagId: string | null = existingTag?.id ?? null

  if (!tagId && !remove) {
    const { data: newTag, error: createErr } = await admin()
      .from('tags')
      .insert({ user_id: userId, name: tagName })
      .select('id')
      .single()
    if (createErr || !newTag) {
      console.error('[journeys.runner] tag create failed:', createErr?.message)
      return
    }
    tagId = newTag.id
  }

  if (!tagId) return

  if (remove) {
    await admin()
      .from('contact_tags')
      .delete()
      .eq('contact_id', contactId)
      .eq('tag_id', tagId)
  } else {
    const { error: linkErr } = await admin()
      .from('contact_tags')
      .upsert(
        { contact_id: contactId, tag_id: tagId },
        { onConflict: 'contact_id,tag_id' },
      )
    if (linkErr) {
      console.error('[journeys.runner] tag link failed:', linkErr.message)
    }
  }
}

/**
 * Fire an outbound HTTP request. Best-effort — failures are logged but
 * don't break the flow.
 */
async function callWebhook(
  endpoint: string,
  method: string,
  args: RunJourneysArgs,
): Promise<void> {
  try {
    await fetch(endpoint, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: method === 'GET' ? undefined : JSON.stringify({
        phone: args.customerPhone,
        message: args.inboundText,
        conversation_id: args.conversationId,
        contact_id: args.contactId,
      }),
    })
  } catch (err) {
    console.error('[journeys.runner] webhook call failed:', err)
  }
}
