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

import { createClient } from '@supabase/supabase-js'
import { runAgent } from '@/lib/agent/engine'

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
 * (If your meta-api.ts already exports a text sender, you can swap it in.)
 */
async function sendWhatsAppText(
  phoneNumberId: string,
  to: string,
  text: string,
  accessToken: string,
): Promise<string | null> {
  try {
    const res = await fetch(
      `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`,
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
 * Returns true if the AI handled + replied (so the webhook can skip
 * the normal journey/automation path for this message).
 */
export async function handleAdLead(input: AdLeadInput): Promise<boolean> {
  const {
    tenantId, agentId, conversationId, contactId,
    customerPhone, inboundText, phoneNumberId, accessToken, referral,
  } = input

  try {
    // 1. Run the tenant's OWN agent (its persona + its RAG knowledge).
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

    const reply =
      result?.reply ||
      'Thanks for reaching out! Someone from our team will get back to you shortly.'

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
      status: 'sent',
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

    // 4. Upsert the lead into the ONE leads store, tagged by source.
    //    meta_ads when we have a referral, else whatsapp.
    const source = referral?.source_type === 'ad' || referral?.source_id
      ? 'meta_ads'
      : 'whatsapp'

    await db().from('leads').upsert(
      {
        tenant_id: tenantId,
        agent_id: agentId,
        contact_id: contactId,
        phone: customerPhone,
        name: input.contactName ?? null,
        source,
        ad_id: referral?.source_id ?? null,
        ad_headline: referral?.headline ?? null,
        last_message: inboundText,
        status: 'new',
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'tenant_id,contact_id' },
    )

    // 5. If the agent flagged handoff, mark the lead hot for a human.
    if (result?.handoffRequested) {
      await db()
        .from('leads')
        .update({ status: 'hot', updated_at: new Date().toISOString() })
        .eq('tenant_id', tenantId)
        .eq('contact_id', contactId)
    }

    return true
  } catch (err) {
    console.error('[ads-agent] handleAdLead failed:', err)
    return false // let the webhook fall back to normal handling
  }
}
