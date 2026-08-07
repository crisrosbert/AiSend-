// src/lib/whatsapp-agent/handler.ts
//
// ── WHY THIS EXISTS ──────────────────────────────────────────────────
// Until now an AI agent could only answer on the website widget. On
// WhatsApp — the product's main channel — inbound messages went to
// keyword-matched journeys, and anything the keywords missed got no
// reply at all. So the best feature in the product did not work on the
// channel it is sold for.
//
// This is the general WhatsApp agent: the tenant picks one agent, and it
// answers whatever the deterministic layers did not.
//
// ── WHERE IT SITS IN THE ORDER ───────────────────────────────────────
// The webhook tries, in order:
//
//   1. Ads agent          — only for click-to-WhatsApp ad leads
//   2. Journeys           — keyword/regex matched flows
//   3. THIS               — the fallback that answers everything else
//   4. Automations        — background actions (sends suppressed if 2 or
//                           3 already replied)
//
// Deterministic paths win. A merchant who scripted "ORDER STATUS" gets
// exactly that script; the model only handles what nobody predicted.
//
// ── ON BROADCAST REPLIES ─────────────────────────────────────────────
// This is also what finally answers them. A marketing template costs
// ₹1.09; when the recipient replies, a 24-hour service window opens and
// replies inside it are free. Sending 1,000 broadcasts and dropping the
// 80 conversations they produce is the expensive option — the money is
// already spent by then.

import { createClient } from '@supabase/supabase-js'
import { runAgent } from '@/lib/agent/engine'
import { sendTextMessage } from '@/lib/whatsapp/meta-api'

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

export interface WhatsAppAgentInput {
  /** whatsapp_config.user_id — the tenant who owns this number. */
  tenantId: string
  /** whatsapp_config.whatsapp_agent_id — which agent answers here. */
  agentId: string
  conversationId: string
  contactId: string
  customerPhone: string
  contactName?: string | null
  inboundText: string
  phoneNumberId: string
  accessToken: string
}

/**
 * Answer one inbound WhatsApp message with the tenant's chosen agent.
 *
 * Returns true when a reply was actually sent, so the webhook can
 * suppress automation sends and avoid answering the same message twice.
 * Returns false on any failure — the caller then carries on as if this
 * layer were not configured, which is the safe direction: a broken agent
 * should degrade to silence, never to a wrong answer.
 */
export async function handleWhatsAppMessage(
  input: WhatsAppAgentInput,
): Promise<boolean> {
  const {
    tenantId, agentId, conversationId, contactId,
    customerPhone, inboundText, phoneNumberId, accessToken,
  } = input

  try {
    // ── The agent must be active ──
    // "Paused" has to mean paused everywhere. Without this check a
    // merchant could switch an agent off on the Agents page and have it
    // keep talking to customers on WhatsApp — the worst possible
    // failure for a control they believe they just used.
    const { data: agent } = await db()
      .from('agents')
      .select('id, is_active')
      .eq('id', agentId)
      .eq('tenant_id', tenantId)
      .maybeSingle()

    if (!agent?.is_active) return false

    // ── Never speak over a human ──
    // Once a teammate takes a conversation (status 'pending'), the bot
    // stays out of it. Two voices answering one customer is worse than
    // a slow reply.
    const { data: conversation } = await db()
      .from('conversations')
      .select('status')
      .eq('id', conversationId)
      .maybeSingle()

    if (conversation?.status === 'pending') return false

    // ── Ask the agent ──
    const result = await runAgent({
      tenantId,
      orgId: null,
      verticalConfigId: null,
      conversationId,
      contactId,
      customerPhone,
      inboundText,
      agentId,
    })

    const reply = result?.reply?.trim()

    // No reply is a legitimate outcome — the engine may decide silence
    // is right. Returning false lets the rest of the pipeline proceed
    // rather than sending filler the merchant never wrote.
    if (!reply) return false

    // ── Send it ──
    // Free-form text, valid because the customer messaged first and the
    // 24-hour service window is open. Service messages cost ₹0, which is
    // why answering is close to free once the inbound has arrived.
    let sentMessageId: string | null = null
    try {
      const sent = await sendTextMessage({
        phoneNumberId,
        accessToken,
        to: customerPhone,
        text: reply,
      })
      sentMessageId = sent?.messageId ?? null
    } catch (err) {
      console.error('[whatsapp-agent] send failed:', err)
      return false
    }

    // ── Record it so the inbox shows the whole conversation ──
    // A merchant reading the thread must see what the bot said; an
    // invisible reply makes handover impossible.
    await db().from('messages').insert({
      conversation_id: conversationId,
      sender_type: 'bot',
      content_type: 'text',
      content_text: reply,
      message_id: sentMessageId,
      status: sentMessageId ? 'sent' : 'failed',
      created_at: new Date().toISOString(),
    })

    await db()
      .from('conversations')
      .update({
        last_message_text: reply,
        last_message_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', conversationId)

    // ── Hand off if the agent asked to ──
    // Setting the conversation to 'pending' both flags it for the team
    // and stops this handler replying again on the next message, via
    // the status check at the top.
    if (result?.handoffRequested) {
      await db()
        .from('conversations')
        .update({ status: 'pending', updated_at: new Date().toISOString() })
        .eq('id', conversationId)
    }

    return true
  } catch (err) {
    console.error('[whatsapp-agent] handleWhatsAppMessage failed:', err)
    return false
  }
}
