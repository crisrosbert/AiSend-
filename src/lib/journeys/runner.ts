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
//   - When no keyword trigger matches, falls back to the AI agent
//     (runAgentFallback) so conversations aren't left unanswered.

import { createClient } from '@supabase/supabase-js'
import { sendTextMessage } from '@/lib/whatsapp/meta-api'
import {
  getOrgIdForUser,
  deductCredits,
  MESSAGE_PRICE_INR,
} from '@/lib/billing/credits'
import { runAgentFallback } from '@/lib/agent/fallback'

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
 * nothing matched.
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

    // No keyword matched. Try the AI agent fallback on the first active
    // journey (the one most likely to have a persona configured).
    const firstJourney = (journeys as JourneyRow[])[0]
    if (firstJourney) {
      const agentReplied = await runAgentFallback({
        userId: args.userId,
        journeyId: firstJourney.id,
        conversationId: args.conversationId,
        contactId: args.contactId,
        customerPhone: args.customerPhone,
        inboundText: args.inboundText,
        phoneNumberId: args.phoneNumberId,
        accessToken: args.accessToken,
      })
      if (agentReplied) return true
    }

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

async function walk(
  journey: JourneyRow,
  fromId: string,
  visited: Set<string>,
  args: RunJourneysArgs,
  orgId: string | null,
  depth: number,
): Promise<void> {
  if (depth > MAX_DEPTH) {
    console.warn('[journeys.runner] max depth exceeded for journey', journey.id)
    return
  }

  const outgoing = (journey.edges || []).filter((e) => e.source === fromId)

  for (const edge of outgoing) {
    if (visited.has(edge.target)) continue
    visited.add(edge.target)

    const node = journey.nodes.find((n) => n.id === edge.target)
    if (!node) continue

    const cont = await executeNode(node, args, orgId)
    if (cont) {
      await walk(journey, node.id, visited, args, orgId, depth + 1)
    }
  }
}

async function executeNode(
  node: JourneyNode,
  args: RunJourneysArgs,
  orgId: string | null,
): Promise<boolean> {
  const data = node.data || {}
  const type = node.type

  try {
    switch (type) {
      case 'TEXT_BUTTONS': {
        const text = String(data.text || '').trim()
        if (text) {
          await sendBotMessage(args, text, orgId)
        }
        return true
      }

      case 'MEDIA_BUTTONS': {
        const caption = String(data.caption || data.text || '').trim()
        if (caption) {
          await sendBotMessage(args, caption, orgId)
        }
        return true
      }

      case 'TEMPLATE': {
        console.log('[journeys.runner] TEMPLATE node skipped (Phase 3)')
        return true
      }

      case 'TAG_CONTACT': {
        const tagName = String(data.tagName || '').trim()
        const operation = (data.operation as string) || 'add'
        if (tagName) {
          await applyTagToContact(args.userId, args.contactId, tagName, operation === 'remove')
        }
        return true
      }

      case 'WEBHOOK_CALL': {
        const endpoint = String(data.endpoint || '').trim()
        const method = (data.method as string) || 'POST'
        if (endpoint) {
          await callWebhook(endpoint, method, args)
        }
        return true
      }

      case 'CONDITION': {
        return true
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
        return false
      }

      case 'CONVERSION_EVENT': {
        console.log('[journeys.runner] CONVERSION_EVENT skipped (Phase 3)')
        return true
      }

      default:
        console.warn('[journeys.runner] unknown node type:', type)
        return true
    }
  } catch (err) {
    console.error(`[journeys.runner] node ${node.id} (${type}) failed:`, err)
    return true
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
async function sendBotMessage(
  args: RunJourneysArgs,
  text: string,
  orgId: string | null,
): Promise<void> {
  let metaMessageId: string | null = null
  try {
    const result = await sendTextMessage({
      phoneNumberId: args.phoneNumberId,
      accessToken: args.accessToken,
      to: args.customerPhone,
      text,
    })
    metaMessageId = result?.messageId ?? null
  } catch (err) {
    console.error('[journeys.runner] sendTextMessage failed:', err)
  }

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
