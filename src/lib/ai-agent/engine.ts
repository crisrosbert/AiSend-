/**
 * File: src/lib/ai-agent/engine.ts
 * Purpose: Main orchestrator for AI Ecommerce Agent
 * Entry point called by WhatsApp webhook — coordinates all other ai-agent files
 *
 * Flow: kill switch → load config → load session → detect intent → route → reply → save memory
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { detectIntent } from './intent'
import { getOrCreateSession, appendMessageToSession, type ConversationMessage } from './memory'
import { retrieveProductsForQuery } from './retriever'
import { generateAgentReply, generateGreetingReply, type AgentResponderConfig } from './responder'
import { sendProductCardsToCustomer, type WhatsAppCredentials } from './product-response'
import { getCartFromSession, addProductToCart, formatCartSummaryText, persistCartToSession } from './cart'
import { processCheckout } from './checkout'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AiAgentInput {
  userId: string
  contactPhone: string
  inboundMessage: string
  supabase: SupabaseClient
}

// ─── Constants ────────────────────────────────────────────────────────────────

const WA_API_URL = 'https://graph.facebook.com/v21.0'

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Creates a ConversationMessage with required timestamp field */
function msg(role: 'user' | 'assistant', content: string): ConversationMessage {
  return { role, content, timestamp: new Date().toISOString() }
}

async function loadAgentConfig(userId: string, supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from('ai_agent_configs')
    .select('id, store_name, brand_voice_prompt, language, is_enabled')
    .eq('user_id', userId)
    .eq('is_enabled', true)
    .single()
  if (error || !data) return null
  return data
}

async function loadWaCredentials(userId: string, supabase: SupabaseClient): Promise<WhatsAppCredentials | null> {
  const { data, error } = await supabase
    .from('whatsapp_config')
    .select('phone_number_id, access_token')
    .eq('user_id', userId)
    .single()
  if (error || !data) return null
  return { phoneNumberId: data.phone_number_id, accessToken: data.access_token }
}

async function sendText(phone: string, text: string, creds: WhatsAppCredentials): Promise<void> {
  const res = await fetch(`${WA_API_URL}/${creds.phoneNumberId}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${creds.accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: phone,
      type: 'text',
      text: { body: text },
    }),
  })
  if (!res.ok) throw new Error(`[Engine] WA send failed: ${res.status}`)
}

function logEvent(userId: string, phone: string, type: string, data: Record<string, unknown>, supabase: SupabaseClient) {
  void supabase.from('ai_agent_events').insert({ user_id: userId, contact_phone: phone, event_type: type, event_data: data })
}

// ─── Main Export ──────────────────────────────────────────────────────────────

/**
 * handleAiAgentMessage
 * Called from WhatsApp webhook route via Next.js after() (non-blocking).
 * Returns true if agent handled the message, false if skipped.
 */
export async function handleAiAgentMessage(input: AiAgentInput): Promise<boolean> {
  const { userId, contactPhone, inboundMessage, supabase } = input

  // Kill switch
  if (process.env.AI_AGENT_DISABLED === 'true') return false

  // Load merchant config
  const config = await loadAgentConfig(userId, supabase)
  if (!config) return false

  // Load WhatsApp credentials
  const waCreds = await loadWaCredentials(userId, supabase)
  if (!waCreds) return false

  // Load customer session
  const session = await getOrCreateSession(userId, contactPhone, supabase)
  if (session.needs_human) return false

  const isFirstMessage = session.messages.length === 0

  // Detect intent
  const intent = await detectIntent(inboundMessage, session.messages)
  logEvent(userId, contactPhone, 'message_received', { intent: intent.intent, confidence: intent.confidence }, supabase)

  const responderConfig: AgentResponderConfig = {
    store_name: config.store_name,
    brand_voice_prompt: config.brand_voice_prompt,
    language: config.language,
  }

  let replyText: string

  switch (intent.intent) {

    case 'GREETING': {
      replyText = await generateGreetingReply(responderConfig, isFirstMessage)
      break
    }

    case 'SHOPPING_QUERY': {
      const query = intent.productKeywords || inboundMessage
      const products = await retrieveProductsForQuery(userId, query, supabase)
      replyText = await generateAgentReply(responderConfig, inboundMessage, session.messages, products)

      await sendText(contactPhone, replyText, waCreds)
      if (products.length > 0) void sendProductCardsToCustomer(contactPhone, products, waCreds)

      await appendMessageToSession({
        userId, contactPhone,
        newMessages: [msg('user', inboundMessage), msg('assistant', replyText)],
        needsHuman: false, supabase,
      })
      logEvent(userId, contactPhone, 'shopping_query', { query, productsFound: products.length }, supabase)
      return true
    }

    case 'CART_ADD': {
      const query = intent.productKeywords || inboundMessage
      const products = await retrieveProductsForQuery(userId, query, supabase)
      if (products.length === 0) {
        replyText = `I couldn't find that product. Can you describe it differently?`
        break
      }
      const cartResult = addProductToCart(getCartFromSession(session.cart), products[0], intent.quantity ?? 1)
      if (cartResult.success) {
        await persistCartToSession(userId, contactPhone, cartResult.updatedCart, supabase)
        logEvent(userId, contactPhone, 'cart_add', { productName: products[0].name, quantity: intent.quantity ?? 1 }, supabase)
      }
      replyText = cartResult.message
      break
    }

    case 'CART_VIEW': {
      const cart = getCartFromSession(session.cart)
      replyText = cart.items.length === 0
        ? `Your cart is empty! Tell me what you're looking for 🛍️`
        : `${formatCartSummaryText(cart)}\n\nReply "checkout online" to pay now or "checkout COD" for cash on delivery.`
      break
    }

    case 'CHECKOUT': {
      const cart = getCartFromSession(session.cart)
      const isCod = /cod|cash/i.test(inboundMessage)
      const result = await processCheckout({
        userId, contactPhone, contactName: '', cart,
        paymentMethod: isCod ? 'COD' : 'ONLINE', supabase,
      })
      replyText = result.message
      break
    }

    case 'HUMAN_NEEDED': {
      await appendMessageToSession({
        userId, contactPhone,
        newMessages: [msg('user', inboundMessage)],
        needsHuman: true, supabase,
      })
      replyText = `Connecting you with our team now. Someone will be with you shortly! 🙏`
      logEvent(userId, contactPhone, 'human_takeover', { trigger: inboundMessage }, supabase)
      break
    }

    case 'OUT_OF_SCOPE':
    default: {
      replyText = await generateAgentReply(responderConfig, inboundMessage, session.messages, [])
      break
    }
  }

  // Send reply and save to memory
  await sendText(contactPhone, replyText, waCreds)
  await appendMessageToSession({
    userId, contactPhone,
    newMessages: [msg('user', inboundMessage), msg('assistant', replyText)],
    needsHuman: false, supabase,
  })

  return true
}
