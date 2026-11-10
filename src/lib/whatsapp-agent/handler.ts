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
// replies inside it are free.
//
// ── AI-engineer changes (see CHANGES.md) ─────────────────────────────
// The "never speak over a human" check used to live here and only here.
// It is now in runAgent() (src/lib/agent/handoff-gate.ts) so the widget
// and ads paths get it too; this handler just honours result.skipped.
// An AI error no longer parks the chat by itself: the engine decides
// (one error = apology only, repeated errors = handoff) and this handler
// only chooses the wording.

import { createClient } from '@supabase/supabase-js'
import { runAgent } from '@/lib/agent/engine'
import { resolveLanguage, t } from '@/lib/agent/reply-language'
import { sendTextMessage } from '@/lib/whatsapp/meta-api'
import { deliverAgentMedia } from '@/lib/whatsapp-agent/deliver-media'

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
    // "Paused" has to mean paused everywhere. (runAgent enforces the
    // same rule for the widget and ads paths; this early check just
    // saves a model-free round trip here.)
    const { data: agent } = await db()
      .from('agents')
      .select('id, is_active')
      .eq('id', agentId)
      .eq('tenant_id', tenantId)
      .maybeSingle()

    if (!agent?.is_active) return false

    // ── Ask the agent ──
    // runAgent() applies the human-handoff gate itself. A conversation a
    // teammate has taken comes back as result.skipped and we stay quiet.
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

    if (result?.skipped) return false

    let reply = result?.reply?.trim()

    if (!reply) {
      if (result?.error) {
        // ── The agent broke ──
        // Say one honest line in the customer's language. Whether the
        // conversation is also handed to a human was already decided
        // (and recorded) by the engine: result.escalate.
        console.error('[whatsapp-agent] engine failed:', result.error)
        reply =
          result.errorReply ??
          t('ai_error', result.language ?? resolveLanguage(inboundText))
      } else {
        // A genuine, deliberate silence from the engine. Let the rest of
        // the pipeline proceed rather than sending filler the merchant
        // never wrote.
        return false
      }
    }

    // ── Send it ──
    // Free-form text, valid because the customer messaged first and the
    // 24-hour service window is open.
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
    await db().from('messages').insert({
      conversation_id: conversationId,
      sender_type: 'bot',
      content_type: 'text',
      content_text: reply,
      message_id: sentMessageId,
      status: sentMessageId ? 'sent' : 'failed',
      created_at: new Date().toISOString(),
    })

    // ── Send whatever the agent chose to show them ──
    let lastPreview = reply
    if (result?.mediaToSend?.length) {
      const delivered = await deliverAgentMedia({
        phoneNumberId,
        accessToken,
        to: customerPhone,
        media: result.mediaToSend,
      })

      for (const d of delivered) {
        // Log failures too, so a merchant can see a brochure did not go out.
        await db().from('messages').insert({
          conversation_id: conversationId,
          sender_type: 'bot',
          content_type: d.contentType,
          content_text: d.item.title,
          media_url: d.item.url,
          message_id: d.messageId,
          status: d.messageId ? 'sent' : 'failed',
          created_at: new Date().toISOString(),
        })
        if (d.messageId) lastPreview = d.item.title
      }
    }

    await db()
      .from('conversations')
      .update({
        last_message_text: lastPreview,
        last_message_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', conversationId)

    // ── Handoff bookkeeping ──
    // Nothing to do here any more. When the agent asked for a human, or
    // AI errors escalated, runAgent() already set status 'pending',
    // needs_attention and the SPECIFIC handoff_reason (for example an
    // emergency). This handler used to overwrite that reason with a
    // generic one, and used to park the chat after a single AI error.

    return true
  } catch (err) {
    console.error('[whatsapp-agent] handleWhatsAppMessage failed:', err)
    return false
  }
}
