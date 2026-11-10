// src/lib/ads-agent/handler.ts
//
// SEPARATE ADS MODULE — handles Meta-ad WhatsApp leads with the AI agent.
// Fully isolated from the CRM/journey code. The webhook calls handleAdLead()
// only when a client has the ads agent enabled AND the message is an ad lead.
//
// Flow: ad lead messages on WhatsApp → runAgent (tenant's own agent + RAG)
//       → send AI reply via WhatsApp (free-form, inside 24h window = free)
//       → store/tag the lead as source 'meta_ads' with the ad id.
//
// This module reuses NOTHING from the journey/automation code paths.
//
// AI-engineer changes (see CHANGES.md):
//   • honours result.skipped from runAgent(): a conversation a human has
//     taken is NOT answered by the ads agent any more, and a paused or
//     missing agent falls through to normal handling
//   • the fallback line follows the customer's language
//   • a reply that Meta did not accept is stored as 'failed', not 'sent'

import { createClient } from '@supabase/supabase-js'
import { runAgent } from '@/lib/agent/engine'
import { resolveLanguage, t } from '@/lib/agent/reply-language'
import { deliverAgentMedia } from '@/lib/whatsapp-agent/deliver-media'
import { businessIdForAgent } from '@/lib/business/server'
import { ingestLead } from '@/lib/leads/ingest'
import { GRAPH_BASE_URL } from '@/lib/meta/graph-version'

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

/** Meta referral object — present when the user arrived via a
 *  Click-to-WhatsApp ad. Used to detect + tag the lead source. */
export interface MetaReferral {
  source_url?: string
  source_id?: string       // the ad id
  source_type?: string     // 'ad' | 'post' etc.
  headline?: string
  body?: string
  ctwa_clid?: string       // click id
}

export interface AdLeadInput {
  tenantId: string          // config.user_id (the client)
  agentId: string           // config.ads_agent_id (which AI answers)
  conversationId: string
  contactId: string
  customerPhone: string     // sender's wa number
  contactName?: string
  inboundText: string
  phoneNumberId: string
  accessToken: string       // decrypted Meta token for this number
  referral?: MetaReferral | null
}

/**
 * Send a plain free-form WhatsApp text message via Meta Cloud API.
 * Self-contained so this module doesn't depend on meta-api.ts internals.
 */
async function sendWhatsAppText(
  phoneNumberId: string,
  to: string,
  text: string,
  accessToken: string,
): Promise<string | null> {
  try {
    const res = await fetch(
      `${GRAPH_BASE_URL}/${phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to,
          type: 'text',
          text: { body: text.slice(0, 4096) },
        }),
      },
    )
    const json = await res.json().catch(() => ({}))
    if (!res.ok) {
      console.error('[ads-agent] WhatsApp send failed:', JSON.stringify(json).slice(0, 300))
      return null
    }
    // Meta returns messages[0].id
    return json?.messages?.[0]?.id ?? null
  } catch (err) {
    console.error('[ads-agent] WhatsApp send error:', err)
    return null
  }
}

/**
 * Main entry — handle one inbound ad-lead message end to end.
 * Returns true if the AI handled the message (so the webhook can skip
 * the normal journey/automation path for this message).
 */
export async function handleAdLead(input: AdLeadInput): Promise<boolean> {
  const {
    tenantId, agentId, conversationId, contactId,
    customerPhone, inboundText, phoneNumberId, accessToken, referral,
  } = input

  try {
    // 1. Run the tenant's OWN agent (its persona + its RAG knowledge).
    //    runAgent() applies the human-handoff gate and the paused-agent
    //    check, so this path no longer talks over a teammate.
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

    if (result?.skipped === 'human_handling') {
      // A human has this conversation. Handled = true so the webhook does
      // not push the message into journeys either. Nothing is sent.
      return true
    }
    if (result?.skipped) {
      // Paused or missing agent: behave as if the ads agent were not
      // configured and let normal handling continue.
      return false
    }

    const lang = result?.language ?? resolveLanguage(inboundText)
    const reply =
      result?.reply ||
      result?.errorReply ||
      t('thanks_team_follow_up', lang)

    // 2. Send the AI reply back on WhatsApp (free-form service message).
    const sentMsgId = await sendWhatsAppText(
      phoneNumberId, customerPhone, reply, accessToken,
    )

    // 3. Save the AI reply into messages so it shows in the inbox too.
    await db().from('messages').insert({
      conversation_id: conversationId,
      sender_type: 'bot',
      content_type: 'text',
      content_text: reply,
      message_id: sentMsgId,
      status: sentMsgId ? 'sent' : 'failed',
      created_at: new Date().toISOString(),
    })

    // 3b. Send any media the agent chose — property photos, brochures,
    //     price lists.
    let lastPreview = reply
    if (result?.mediaToSend?.length) {
      const delivered = await deliverAgentMedia({
        phoneNumberId,
        accessToken,
        to: customerPhone,
        media: result.mediaToSend,
      })
      for (const d of delivered) {
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

    // 4. Record the lead through the shared intake — same dedupe-by-phone
    //    and cross-source merge as every other channel. `ctwa_clid` and
    //    `source_url` are captured so a merchant can reconcile this lead
    //    against Meta Ads Manager spend.
    const source = referral?.source_type === 'ad' || referral?.source_id
      ? 'meta_ads'
      : 'whatsapp'

    // The agent's business, not the WhatsApp number's.
    const businessId = await businessIdForAgent(db(), agentId)

    const ingestResult = await ingestLead({
      tenantId,
      businessId,
      agentId,
      contactId,
      conversationId,
      source,
      name: input.contactName ?? null,
      phone: customerPhone,
      adId: referral?.source_id ?? null,
      adHeadline: referral?.headline ?? null,
      ctwaClid: referral?.ctwa_clid ?? null,
      lastMessage: inboundText,
      extra: referral?.source_url ? { source_url: referral.source_url } : undefined,
    })

    // 5. If the agent flagged handoff, mark the lead hot for a human.
    if (result?.handoffRequested && ingestResult) {
      await db()
        .from('leads')
        .update({ status: 'hot', updated_at: new Date().toISOString() })
        .eq('id', ingestResult.leadId)
    }

    return true
  } catch (err) {
    console.error('[ads-agent] handleAdLead failed:', err)
    return false // let the webhook fall back to normal handling
  }
}
