// src/lib/agent/fallback.ts
//
// Bridge between the journey runner and the AI agent engine.
//
// When a customer's message does NOT match any keyword journey, the
// runner calls runAgentFallback(). This function:
//   1. Checks the journey has AI enabled (persona configured)
//   2. Calls runAgent() — the brain loop
//   3. Sends the AI's reply to WhatsApp
//   4. Saves the reply to the messages table
//   5. Deducts credits
//
// BOUNDARY: this file is the ONLY place the runner touches the agent.
// It imports runAgent() from engine.ts and nothing else from the agent
// internals.

import { createClient } from '@supabase/supabase-js'
import { sendTextMessage } from '@/lib/whatsapp/meta-api'
import { runAgent } from '@/lib/agent/engine'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _client: any = null
function db() {
  if (!_client) {
    _client = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )
  }
  return _client
}

export interface AgentFallbackArgs {
  userId: string
  journeyId: string
  conversationId: string
  contactId: string
  customerPhone: string
  inboundText: string
  phoneNumberId: string
  accessToken: string
}

/**
 * Run the AI agent as a fallback when no keyword journey matched.
 * Returns true if the agent replied, false otherwise.
 *
 * Never throws — logs and returns false on any error so the webhook
 * pipeline is never broken by an AI failure.
 */
export async function runAgentFallback(
  args: AgentFallbackArgs,
): Promise<boolean> {
  try {
    // Only run the agent if this journey has a persona configured.
    // A persona row = the business owner has set up the AI agent.
    const { data: persona } = await db()
      .from('personas')
      .select('raw_prompt')
      .eq('journey_id', args.journeyId)
      .maybeSingle()

    if (!persona) {
      // No persona = AI agent not configured for this journey. Skip.
      console.log('[agent/fallback] no persona configured — skipping AI')
      return false
    }

    console.log('[agent/fallback] running AI agent for:', args.inboundText)

    // Call the brain loop
    const result = await runAgent({
      tenantId: args.userId,
      orgId: null,
      verticalConfigId: null,
      conversationId: args.conversationId,
      contactId: args.contactId,
      customerPhone: args.customerPhone,
      inboundText: args.inboundText,
      journeyId: args.journeyId,
      systemPromptOverride: persona.raw_prompt ?? undefined,
    })

    if (!result.reply) {
      console.log('[agent/fallback] agent returned empty reply')
      return false
    }

    // Send the reply to WhatsApp
    let metaMessageId: string | null = null
    try {
      const sendResult = await sendTextMessage({
        phoneNumberId: args.phoneNumberId,
        accessToken: args.accessToken,
        to: args.customerPhone,
        text: result.reply,
      })
      metaMessageId = sendResult?.messageId ?? null
    } catch (err) {
      console.error('[agent/fallback] sendTextMessage failed:', err)
    }

    // Save the bot reply to messages
    await db().from('messages').insert({
      conversation_id: args.conversationId,
      sender_type: 'bot',
      content_type: 'text',
      content_text: result.reply,
      message_id: metaMessageId,
      status: metaMessageId ? 'sent' : 'failed',
      created_at: new Date().toISOString(),
    })

    // Update conversation preview
    await db()
      .from('conversations')
      .update({
        last_message_text: result.reply,
        last_message_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', args.conversationId)

    console.log(
      `[agent/fallback] replied (tools: ${result.toolsUsed.join(', ') || 'none'}, handoff: ${result.handoffRequested})`,
    )

    return true
  } catch (err) {
    console.error('[agent/fallback] error:', err)
    return false
  }
}
