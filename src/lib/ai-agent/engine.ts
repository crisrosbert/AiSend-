// ============================================================
// File: src/lib/ai-agent/engine.ts
// Purpose: Main entry point for the AI Ecommerce Agent.
//          Called by the WhatsApp webhook after existing journey
//          and broadcast handlers have had their turn.
//
// Flow:
//   1. Guard checks (agent enabled? human already handling?)
//   2. Load agent config + conversation session from DB
//   3. Detect customer intent (shopping / cart / checkout / etc.)
//   4. Route to the correct handler based on intent
//   5. Send WhatsApp reply
//   6. Persist updated session (messages + cart)
//   7. Log analytics event
// ============================================================

import { createClient } from '@supabase/supabase-js'
import type { SupabaseClient } from '@supabase/supabase-js'

import { detectIntent }         from '@/lib/ai-agent/intent'
import { getOrCreateSession, appendMessageToSession } from '@/lib/ai-agent/memory'
import { retrieveProducts }     from '@/lib/ai-agent/retriever'
import { generateAgentReply }   from '@/lib/ai-agent/responder'
import { sendProductCards }     from '@/lib/ai-agent/product-response'
import { addItemToCart, getCartSummary } from '@/lib/ai-agent/cart'
import { initiateCheckout }     from '@/lib/ai-agent/checkout'
import { logAgentEvent }        from '@/lib/ai-agent/analytics'

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

/**
 * Input passed from the WhatsApp webhook handler.
 * All fields come from the verified inbound message payload.
 */
export interface AiAgentInput {
  /** The AiSend tenant (business account) who owns this agent */
  userId: string
  /** End customer's WhatsApp phone number (without leading +) */
  contactPhone: string
  /** Raw text of the customer's inbound message */
  inboundMessage: string
  /** Supabase client already initialised by the webhook handler */
  supabase: SupabaseClient
}

// ─────────────────────────────────────────────────────────────
// Kill Switch
// ─────────────────────────────────────────────────────────────

/**
 * Returns true when the AI agent feature is globally disabled
 * via environment variable. Used as an emergency kill switch
 * without needing a code deployment.
 *
 * To disable: set AI_AGENT_DISABLED=true in Vercel env vars.
 * To re-enable: remove the variable and redeploy.
 */
function isAgentGloballyDisabled(): boolean {
  return process.env.AI_AGENT_DISABLED === 'true'
}

// ─────────────────────────────────────────────────────────────
// Guard: Check if agent is configured and active for this user
// ─────────────────────────────────────────────────────────────

/**
 * Loads the ai_agent_configs row for this business.
 * Returns null if:
 *  - No config exists (agent was never set up)
 *  - Agent is disabled (is_enabled = false)
 *  - Product catalog has not been embedded yet
 */
async function loadActiveAgentConfig(
  userId: string,
  supabase: SupabaseClient,
) {
  const { data: agentConfig, error } = await supabase
    .from('ai_agent_configs')
    .select(
      'id, user_id, brand_name, brand_voice_prompt, language, is_enabled, embed_status',
    )
    .eq('user_id', userId)
    .single()

  if (error || !agentConfig) {
    // No ecommerce agent configured for this business — skip silently
    return null
  }

  if (!agentConfig.is_enabled) {
    // Business has not activated the agent yet
    return null
  }

  if (agentConfig.embed_status !== 'done') {
    // Product catalog not embedded — agent cannot search products yet
    console.log(`[ai-agent] embed not ready for user=${userId}, status=${agentConfig.embed_status}`)
    return null
  }

  return agentConfig
}

// ─────────────────────────────────────────────────────────────
// Main Handler
// ─────────────────────────────────────────────────────────────

/**
 * handleAiAgentMessage
 *
 * Called from the WhatsApp webhook after journeys and broadcasts
 * have been processed. Uses `void` at the call site so the webhook
 * returns 200 immediately — this function runs asynchronously.
 *
 * Returns true if the agent sent a reply, false if it skipped.
 */
export async function handleAiAgentMessage(
  input: AiAgentInput,
): Promise<boolean> {
  const { userId, contactPhone, inboundMessage, supabase } = input

  // ── Guard 1: Global kill switch ──────────────────────────
  if (isAgentGloballyDisabled()) {
    console.log('[ai-agent] globally disabled via AI_AGENT_DISABLED env var')
    return false
  }

  // ── Guard 2: Agent must be configured and active ─────────
  const agentConfig = await loadActiveAgentConfig(userId, supabase)
  if (!agentConfig) return false

  // ── Guard 3: Skip if a human operator has taken over ─────
  const session = await getOrCreateSession(userId, contactPhone, supabase)
  if (session.needs_human) {
    console.log(`[ai-agent] human operator active for user=${userId} phone=${contactPhone}`)
    return false
  }

  // ── Step 1: Detect what the customer wants ────────────────
  const intentResult = await detectIntent(
    inboundMessage,
    session.messages,
  )

  // Log that we received and processed this message
  await logAgentEvent({
    userId,
    contactPhone,
    eventType: 'message_received',
    payload: {
      intent: intentResult.intent,
      message_preview: inboundMessage.slice(0, 100),
    },
    supabase,
  })

  // ── Step 2: Route based on detected intent ────────────────
  let agentReplyText = ''
  let handoffToHuman = false

  switch (intentResult.intent) {

    // Customer is looking for products
    case 'SHOPPING_QUERY': {
      const matchedProducts = await retrieveProducts({
        query: inboundMessage,
        userId,
        supabase,
      })

      if (matchedProducts.length === 0) {
        agentReplyText = await generateAgentReply({
          prompt: inboundMessage,
          context: 'No matching products found in catalog.',
          agentConfig,
          conversationHistory: session.messages,
        })
      } else {
        // Generate natural language intro before sending product cards
        agentReplyText = await generateAgentReply({
          prompt: inboundMessage,
          context: matchedProducts
            .map((p) => `${p.name} — ₹${p.price} — ${p.description ?? ''}`)
            .join('\n'),
          agentConfig,
          conversationHistory: session.messages,
        })

        // Send product image cards after the text reply
        await sendProductCards({
          userId,
          contactPhone,
          products: matchedProducts,
          supabase,
        })
      }
      break
    }

    // Customer wants to add something to cart
    case 'CART_ADD': {
      const cartResult = await addItemToCart({
        userId,
        contactPhone,
        intentResult,
        supabase,
      })
      agentReplyText = cartResult.confirmationMessage
      break
    }

    // Customer wants to see their cart
    case 'CART_VIEW': {
      agentReplyText = await getCartSummary(userId, contactPhone, supabase)
      break
    }

    // Customer is ready to pay
    case 'CHECKOUT': {
      agentReplyText = await initiateCheckout({
        userId,
        contactPhone,
        agentConfig,
        supabase,
      })
      break
    }

    // Customer said hi / general greeting
    case 'GREETING': {
      agentReplyText = await generateAgentReply({
        prompt: inboundMessage,
        context: `Greet the customer warmly. Business name: ${agentConfig.brand_name ?? 'our store'}.`,
        agentConfig,
        conversationHistory: session.messages,
      })
      break
    }

    // Agent cannot help — escalate to human
    case 'HUMAN_NEEDED': {
      handoffToHuman = true
      agentReplyText = await generateAgentReply({
        prompt: inboundMessage,
        context: 'Customer needs human assistance. Apologise and say a team member will be in touch shortly.',
        agentConfig,
        conversationHistory: session.messages,
      })

      await logAgentEvent({
        userId,
        contactPhone,
        eventType: 'human_handoff',
        payload: { reason: 'intent=HUMAN_NEEDED', message: inboundMessage },
        supabase,
      })
      break
    }

    // Out of scope — politely decline
    case 'OUT_OF_SCOPE':
    default: {
      agentReplyText = await generateAgentReply({
        prompt: inboundMessage,
        context: 'Customer asked something outside your scope. Politely redirect to shopping.',
        agentConfig,
        conversationHistory: session.messages,
      })
      break
    }
  }

  // ── Step 3: Send the text reply via WhatsApp ──────────────
  if (agentReplyText) {
    const { accessToken, phoneNumberId } = await getWhatsAppCredentials(
      userId,
      supabase,
    )
    await sendWhatsAppTextMessage({
      accessToken,
      phoneNumberId,
      toPhone: contactPhone,
      messageText: agentReplyText,
    })
  }

  // ── Step 4: Update session memory ─────────────────────────
  await appendMessageToSession({
    userId,
    contactPhone,
    newMessages: [
      { role: 'user',      content: inboundMessage,  timestamp: new Date().toISOString() },
      { role: 'assistant', content: agentReplyText,   timestamp: new Date().toISOString() },
    ],
    needsHuman: handoffToHuman,
    supabase,
  })

  return true
}

// ─────────────────────────────────────────────────────────────
// WhatsApp Credentials Helper
// ─────────────────────────────────────────────────────────────

/**
 * Fetches the WhatsApp access token and phone number ID
 * for this business from the whatsapp_config table.
 * These are set when the user connects their WhatsApp account.
 */
async function getWhatsAppCredentials(
  userId: string,
  supabase: SupabaseClient,
): Promise<{ accessToken: string; phoneNumberId: string }> {
  const { data, error } = await supabase
    .from('whatsapp_config')
    .select('access_token, phone_number_id')
    .eq('user_id', userId)
    .single()

  if (error || !data) {
    throw new Error(`[ai-agent] WhatsApp credentials not found for user=${userId}`)
  }

  return {
    accessToken:   data.access_token,
    phoneNumberId: data.phone_number_id,
  }
}

// ─────────────────────────────────────────────────────────────
// WhatsApp Text Message Sender
// ─────────────────────────────────────────────────────────────

/**
 * Sends a plain text message via the WhatsApp Cloud API.
 * preview_url: false — prevents WhatsApp from expanding
 * any links inside the message text into link previews.
 */
async function sendWhatsAppTextMessage(params: {
  accessToken:   string
  phoneNumberId: string
  toPhone:       string
  messageText:   string
}): Promise<void> {
  const { accessToken, phoneNumberId, toPhone, messageText } = params

  const response = await fetch(
    `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`,
    {
      method: 'POST',
      headers: {
        Authorization:  `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to:   toPhone,
        type: 'text',
        text: {
          body:        messageText,
          preview_url: false,
        },
      }),
    },
  )

  if (!response.ok) {
    const errorBody = await response.json()
    console.error('[ai-agent] WhatsApp text send failed:', errorBody)
    throw new Error(`WhatsApp API error: ${response.status}`)
  }
}
