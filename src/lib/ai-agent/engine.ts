/**
 * File: src/lib/ai-agent/engine.ts
 * Purpose: Main orchestrator for AI Ecommerce Agent
 *
 * This is the single entry point called by the WhatsApp webhook handler.
 * It coordinates: intent detection → product retrieval → reply generation → cart/checkout ops
 *
 * Called from: src/app/api/whatsapp/webhook/route.ts
 * Completely separate from existing agent systems (src/lib/agent/, src/lib/whatsapp-agent/)
 *
 * Flow:
 *   1. Check kill switch (AI_AGENT_DISABLED env var)
 *   2. Load merchant's agent config from ai_agent_configs table
 *   3. Load/create customer session (conversation memory + cart)
 *   4. Detect customer intent using GPT-4o-mini
 *   5. Route to appropriate handler (shopping / cart / checkout / greeting)
 *   6. Send WhatsApp reply
 */

import type { SupabaseClient } from '@supabase/supabase-js'

import { detectIntent }                               from '@/lib/ai-agent/intent'
import { getOrCreateSession, appendMessageToSession } from '@/lib/ai-agent/memory'
import { retrieveProductsForQuery }                   from '@/lib/ai-agent/retriever'
import { generateAgentReply, generateGreetingReply }  from '@/lib/ai-agent/responder'
import { sendProductCardsToCustomer }                 from '@/lib/ai-agent/product-response'
import {
  getCartFromSession,
  addProductToCart,
  formatCartSummaryText,
  persistCartToSession,
} from '@/lib/ai-agent/cart'
import { processCheckout } from '@/lib/ai-agent/checkout'

// ─── Types ────────────────────────────────────────────────────────────────────

/** Input received from the WhatsApp webhook handler */
export interface AiAgentInput {
  userId: string          // Merchant's Supabase user ID
  contactPhone: string    // Customer's WhatsApp phone number (with country code)
  inboundMessage: string  // Text message sent by the customer
  supabase: SupabaseClient
}

/** Shape of a row from ai_agent_configs table */
interface AiAgentConfig {
  id: string
  user_id: string
  store_name: string
  brand_voice_prompt: string
  language: string
  is_enabled: boolean
}

/** WhatsApp credentials read from whatsapp_config table */
interface WhatsAppCredentials {
  phoneNumberId: string
  accessToken: string
}

// ─── Constants ─────────────────────────────────────────────────────────────────

/** WhatsApp Cloud API base URL */
const WHATSAPP_GRAPH_API_URL = 'https://graph.facebook.com/v21.0'

// ─── Helper: build a timestamped message object ────────────────────────────────

/**
 * makeMessage
 * Creates a ConversationMessage with the required timestamp field.
 * memory.ts requires { role, content, timestamp } — this helper ensures
 * we never forget the field when constructing messages in engine.ts.
 */
function makeMessage(role: 'user' | 'assistant', content: string) {
  return { role, content, timestamp: new Date().toISOString() }
}

// ─── Guard: Kill Switch ────────────────────────────────────────────────────────

/**
 * isAgentGloballyDisabled
 * Checks the AI_AGENT_DISABLED environment variable kill switch.
 * Set AI_AGENT_DISABLED=true in Vercel to stop the agent without a deployment.
 */
function isAgentGloballyDisabled(): boolean {
  return process.env.AI_AGENT_DISABLED === 'true'
}

// ─── Config Loader ─────────────────────────────────────────────────────────────

/**
 * loadActiveAgentConfig
 * Reads the merchant's AI agent configuration from ai_agent_configs table.
 * Returns null if no config exists or if the agent is disabled for this merchant.
 */
async function loadActiveAgentConfig(
  userId: string,
  supabase: SupabaseClient
): Promise<AiAgentConfig | null> {
  const { data: agentConfig, error: configError } = await supabase
    .from('ai_agent_configs')
    .select('id, user_id, store_name, brand_voice_prompt, language, is_enabled')
    .eq('user_id', userId)
    .eq('is_enabled', true)
    .single()

  if (configError || !agentConfig) {
    console.log(`[AI Agent Engine] No active config for userId=${userId} — agent skipped`)
    return null
  }

  return agentConfig as AiAgentConfig
}

// ─── WhatsApp Helpers ──────────────────────────────────────────────────────────

/**
 * getWhatsAppCredentials
 * Reads WhatsApp Business API credentials from the whatsapp_config table.
 */
async function getWhatsAppCredentials(
  userId: string,
  supabase: SupabaseClient
): Promise<WhatsAppCredentials | null> {
  const { data: waConfig, error: waError } = await supabase
    .from('whatsapp_config')
    .select('phone_number_id, access_token')
    .eq('user_id', userId)
    .single()

  if (waError || !waConfig) {
    console.error(`[AI Agent Engine] WhatsApp config not found for userId=${userId}`)
    return null
  }

  return {
    phoneNumberId: waConfig.phone_number_id,
    accessToken: waConfig.access_token,
  }
}

/**
 * sendWhatsAppTextMessage
 * Sends a plain text reply to the customer via WhatsApp Cloud API.
 */
async function sendWhatsAppTextMessage(
  recipientPhone: string,
  messageText: string,
  credentials: WhatsAppCredentials
): Promise<void> {
  const apiUrl = `${WHATSAPP_GRAPH_API_URL}/${credentials.phoneNumberId}/messages`

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${credentials.accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: recipientPhone,
      type: 'text',
      text: { body: messageText },
    }),
  })

  if (!response.ok) {
    const errorBody = await response.text()
    throw new Error(
      `[AI Agent Engine] WhatsApp text send failed (${response.status}): ${errorBody}`
    )
  }
}

// ─── Analytics Logger ──────────────────────────────────────────────────────────

/**
 * logAgentEvent
 * Writes an event to ai_agent_events for analytics (non-blocking).
 */
async function logAgentEvent(
  userId: string,
  contactPhone: string,
  eventType: string,
  eventData: Record<string, unknown>,
  supabase: SupabaseClient
): Promise<void> {
  const { error } = await supabase.from('ai_agent_events').insert({
    user_id: userId,
    contact_phone: contactPhone,
    event_type: eventType,
    event_data: eventData,
  })

  if (error) {
    console.error(`[AI Agent Engine] Failed to log event "${eventType}": ${error.message}`)
  }
}

// ─── Main Entry Point ──────────────────────────────────────────────────────────

/**
 * handleAiAgentMessage
 * Called by the WhatsApp webhook route for every inbound message.
 * Returns true if the AI agent handled the message, false if skipped.
 */
export async function handleAiAgentMessage(input: AiAgentInput): Promise<boolean> {
  const { userId, contactPhone, inboundMessage, supabase } = input

  // ── Guard 1: Global kill switch ──
  if (isAgentGloballyDisabled()) {
    console.log('[AI Agent Engine] Agent globally disabled via AI_AGENT_DISABLED env var')
    return false
  }

  // ── Guard 2: Merchant config check ──
  const agentConfig = await loadActiveAgentConfig(userId, supabase)
  if (!agentConfig) return false

  // ── Guard 3: WhatsApp credentials ──
  const waCredentials = await getWhatsAppCredentials(userId, supabase)
  if (!waCredentials) return false

  // ── Step 1: Load or create customer session (memory + cart) ──
  const customerSession = await getOrCreateSession(userId, contactPhone, supabase)

  // ── Guard 4: Human takeover mode ──
  if (customerSession.needs_human) {
    console.log(
      `[AI Agent Engine] Session flagged needs_human — skipping AI for phone=${contactPhone}`
    )
    return false
  }

  const isFirstMessage = customerSession.messages.length === 0

  // ── Step 2: Detect customer intent ──
  const intentResult = await detectIntent(inboundMessage, customerSession.messages)

  console.log(
    `[AI Agent Engine] Intent=${intentResult.intent} confidence=${intentResult.confidence} for phone=${contactPhone}`
  )

  void logAgentEvent(userId, contactPhone, 'message_received', {
    intent: intentResult.intent,
    confidence: intentResult.confidence,
    messageLength: inboundMessage.length,
  }, supabase)

  // ── Step 3: Route by intent ──
  const responderConfig = {
    store_name: agentConfig.store_name,
    brand_voice_prompt: agentConfig.brand_voice_prompt,
    language: agentConfig.language,
  }

  let replyText: string

  switch (intentResult.intent) {

    // ── GREETING ──────────────────────────────────────────────────────────────
    case 'GREETING': {
      replyText = await generateGreetingReply(responderConfig, isFirstMessage)
      break
    }

    // ── SHOPPING QUERY → RAG retrieval + LLM reply + product cards ───────────
    case 'SHOPPING_QUERY': {
      const searchQuery = intentResult.productKeywords || inboundMessage
      const retrievedProducts = await retrieveProductsForQuery(userId, searchQuery, supabase)

      replyText = await generateAgentReply(
        responderConfig,
        inboundMessage,
        customerSession.messages,
        retrievedProducts
      )

      // Send text reply first, then product image cards
      await sendWhatsAppTextMessage(contactPhone, replyText, waCredentials)

      if (retrievedProducts.length > 0) {
        void sendProductCardsToCustomer(contactPhone, retrievedProducts, {
          phoneNumberId: waCredentials.phoneNumberId,
          accessToken: waCredentials.accessToken,
        })
      }

      // Update session memory
      await appendMessageToSession({
        userId,
        contactPhone,
        newMessages: [
          makeMessage('user', inboundMessage),
          makeMessage('assistant', replyText),
        ],
        supabase,
      })

      void logAgentEvent(userId, contactPhone, 'shopping_query', {
        query: searchQuery,
        productsFound: retrievedProducts.length,
      }, supabase)

      return true // Already sent reply above
    }

    // ── CART ADD ──────────────────────────────────────────────────────────────
    case 'CART_ADD': {
      const searchQuery = intentResult.productKeywords || inboundMessage
      const retrievedProducts = await retrieveProductsForQuery(userId, searchQuery, supabase)

      if (retrievedProducts.length === 0) {
        replyText = `I couldn't find that product. Could you describe what you're looking for?`
        break
      }

      const topProduct = retrievedProducts[0]
      const currentCart = getCartFromSession(customerSession.cart)
      const cartResult = addProductToCart(currentCart, topProduct, intentResult.quantity ?? 1)

      if (cartResult.success) {
        await persistCartToSession(userId, contactPhone, cartResult.updatedCart, supabase)
        void logAgentEvent(userId, contactPhone, 'cart_add', {
          productId: topProduct.id,
          productName: topProduct.name,
          quantity: intentResult.quantity ?? 1,
        }, supabase)
      }

      replyText = cartResult.message
      break
    }

    // ── CART VIEW ─────────────────────────────────────────────────────────────
    case 'CART_VIEW': {
      const currentCart = getCartFromSession(customerSession.cart)
      const cartSummary = formatCartSummaryText(currentCart)

      if (currentCart.items.length === 0) {
        replyText = `Your cart is empty! Tell me what you're looking for and I'll help you find it. 🛍️`
      } else {
        replyText = `${cartSummary}\n\nReply "checkout online" to pay now, or "checkout COD" for cash on delivery.`
      }
      break
    }

    // ── CHECKOUT ──────────────────────────────────────────────────────────────
    case 'CHECKOUT': {
      const currentCart = getCartFromSession(customerSession.cart)

      const isCodRequested =
        inboundMessage.toLowerCase().includes('cod') ||
        inboundMessage.toLowerCase().includes('cash')

      const checkoutResult = await processCheckout({
        userId,
        contactPhone,
        contactName: '',
        cart: currentCart,
        paymentMethod: isCodRequested ? 'COD' : 'ONLINE',
        supabase,
      })

      replyText = checkoutResult.message
      break
    }

    // ── HUMAN NEEDED ──────────────────────────────────────────────────────────
    case 'HUMAN_NEEDED': {
      await appendMessageToSession({
        userId,
        contactPhone,
        newMessages: [makeMessage('user', inboundMessage)],
        needsHuman: true,
        supabase,
      })

      replyText = `I'm connecting you with our team right away. Someone will be with you shortly! 🙏`

      void logAgentEvent(userId, contactPhone, 'human_takeover_requested', {
        triggerMessage: inboundMessage,
      }, supabase)
      break
    }

    // ── OUT OF SCOPE / DEFAULT ────────────────────────────────────────────────
    case 'OUT_OF_SCOPE':
    default: {
      replyText = await generateAgentReply(
        responderConfig,
        inboundMessage,
        customerSession.messages,
        []
      )
      break
    }
  }

  // ── Step 4: Send reply ──
  await sendWhatsAppTextMessage(contactPhone, replyText, waCredentials)

  // ── Step 5: Save exchange to session memory ──
  await appendMessageToSession({
    userId,
    contactPhone,
    newMessages: [
      makeMessage('user', inboundMessage),
      makeMessage('assistant', replyText),
    ],
    supabase,
  })

  return true
}
