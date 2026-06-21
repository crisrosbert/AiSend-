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
//   - Fire-and-forget from the webhook: errors here log but never break
//     the inbound message pipeline.
//   - Gemini fallback is opt-in per user via env. Never hardcoded.

import { createClient } from '@supabase/supabase-js'
import { sendTextMessage } from '@/lib/whatsapp/meta-api'

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
 * the inbound text. Returns true when a journey ran (so the caller can
 * skip the older automations engine for this message if it wants to
 * avoid double-replies). Returns false when nothing matched.
 *
 * Errors are logged and swallowed — never throws.
 */
export async function runJourneysForInbound(
  args: RunJourneysArgs,
): Promise<boolean> {
  try {
    try {                                                          ← DELETE
    console.log('[journeys.runner] CALLED with text:', args.inboundText)
    const text = (args.inboundText || '').trim()
    const text = (args.inboundText || '').trim()                   ← DELETE
    if (!text) return false

    // Fetch ALL active journeys for THIS user. Filtering by user_id is
    // mandatory — without it we'd run another tenant's journey.
    const { data: journeys, error } = await admin()
      .from('journeys')
      .select('id, user_id, name, status, trigger, nodes, edges')
      .eq('user_id', args.userId)
      .eq('status', 'active')
console.log('[journeys.runner] userId:', args.userId)
console.log('[journeys.runner] journeys found:', journeys?.length ?? 0)
console.log('[journeys.runner] inboundText:', args.inboundText)
if (error) console.error('[journeys.runner] fetch error:', error.message)
    if (error) {
      console.error('[journeys.runner] fetch failed:', error.message)
      return false
    }
    if (!journeys || journeys.length === 0) return false

    // Walk every active journey and run the first one whose trigger
    // matches. We stop after the first match to avoid sending multiple
    // bot replies for one customer message (which would feel spammy).
    for (const journey of journeys as JourneyRow[]) {
      if (triggerMatches(journey.trigger, text)) {
        await executeJourney(journey, args)
        return true
      }
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

    // Match when the inbound message CONTAINS any configured keyword.
    // Whole-word boundary check so "hi" doesn't match "this" — that
    // was a real bug in the previous attempt.
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

  // template_start and ad_click are NOT inbound-message triggers; they
  // fire from other code paths (broadcast sends, ad-click webhook).
  return false
}

/**
 * Does `haystack` contain `needle` as a whole word?
 * Handles unicode by treating non-letter chars as boundaries.
 */
function containsWord(haystack: string, needle: string): boolean {
  if (!needle) return false
  // Multi-word keywords: just use substring (whole-phrase boundary check
  // gets tricky and substring is correct here — "track my order" should
  // match "i want to track my order").
  if (needle.includes(' ')) return haystack.includes(needle)

  // Single word: enforce boundaries so "hi" doesn't match "this".
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

const MAX_DEPTH = 20 // safety cap against accidental loops

async function executeJourney(
  journey: JourneyRow,
  args: RunJourneysArgs,
): Promise<void> {
  // Find the trigger node — it's either type === 'TRIGGER' or id === 'trigger'
  const triggerNode = journey.nodes.find(
    (n) => n.type === 'TRIGGER' || n.id === 'trigger',
  )
  const startId = triggerNode?.id || 'trigger'

  const visited = new Set<string>()
  await walk(journey, startId, visited, args, 0)
}

async function walk(
  journey: JourneyRow,
  fromId: string,
  visited: Set<string>,
  args: RunJourneysArgs,
  depth: number,
): Promise<void> {
  if (depth > MAX_DEPTH) {
    console.warn('[journeys.runner] max depth exceeded for journey', journey.id)
    return
  }

  // Find every edge leaving fromId.
  const outgoing = (journey.edges || []).filter((e) => e.source === fromId)

  for (const edge of outgoing) {
    if (visited.has(edge.target)) continue // already executed in this run
    visited.add(edge.target)

    const node = journey.nodes.find((n) => n.id === edge.target)
    if (!node) continue

    // Execute this node and decide whether to walk past it.
    const cont = await executeNode(node, args)

    // CONDITION nodes branch — for now we walk both outputs (Phase 3
    // adds the yes/no handle routing). Most other nodes just continue.
    if (cont) {
      await walk(journey, node.id, visited, args, depth + 1)
    }
  }
}

/**
 * Execute one node. Returns true if downstream nodes should also run.
 */
async function executeNode(
  node: JourneyNode,
  args: RunJourneysArgs,
): Promise<boolean> {
  const data = node.data || {}
  const type = node.type

  try {
    switch (type) {
      case 'TEXT_BUTTONS': {
        const text = String(data.text || '').trim()
        if (text) {
          await sendBotMessage(args, text)
        }
        return true
      }

      case 'MEDIA_BUTTONS': {
        // For now send the caption as a plain text message. Phase 3
        // adds proper media sending via sendImageMessage / etc.
        const caption = String(data.caption || data.text || '').trim()
        if (caption) {
          await sendBotMessage(args, caption)
        }
        return true
      }

      case 'TEMPLATE': {
        // Real template send via Meta API will come in Phase 3.
        // For now we just log — silently skipping keeps the flow moving.
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
        // Phase 3 will evaluate the condition and pick yes/no branch.
        // For now we just continue and let walk() take all outputs.
        return true
      }

      case 'HANDOFF_TO_HUMAN': {
        const msg = String(data.customerMessage || 'An agent will reply shortly.').trim()
        if (msg) {
          await sendBotMessage(args, msg)
        }
        // Mark the conversation as pending so a human picks it up.
        await admin()
          .from('conversations')
          .update({ status: 'pending', updated_at: new Date().toISOString() })
          .eq('id', args.conversationId)
        // Stop the flow — humans take over from here.
        return false
      }

      case 'CONVERSION_EVENT': {
        // Phase 3 wires this to Meta Conversions API.
        console.log('[journeys.runner] CONVERSION_EVENT skipped (Phase 3)')
        return true
      }

      default:
        // Unknown node type — log and continue so one bad node doesn't
        // brick the rest of the flow.
        console.warn('[journeys.runner] unknown node type:', type)
        return true
    }
  } catch (err) {
    console.error(`[journeys.runner] node ${node.id} (${type}) failed:`, err)
    return true // continue to other nodes even on failure
  }
}

// ── Helpers ──

/**
 * Send a text message to the customer AND save it to the messages table
 * so it shows up in the inbox like any other bot reply.
 */
async function sendBotMessage(args: RunJourneysArgs, text: string): Promise<void> {
  // 1. Send via Meta. Capture the returned message_id for status tracking.
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
    // Still save the attempt to the DB so the agent can see what was tried.
  }

  // 2. Save to messages with the REAL schema.
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

  // 3. Update conversation last_message preview.
  await admin()
    .from('conversations')
    .update({
      last_message_text: text,
      last_message_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', args.conversationId)
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
  // Find or create the tag.
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
    // Upsert into the join — unique(contact_id, tag_id) prevents dupes.
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
 * Fire an outbound HTTP request. Best-effort: failures are logged but
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
