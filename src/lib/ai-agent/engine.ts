/**
 * ============================================================================
 * File: src/lib/ai-agent/engine.ts
 * Purpose: Main orchestrator for AI Ecommerce Agent
 * ============================================================================
 *
 * This is the BRAIN of the AI agent — called by the WhatsApp webhook for every
 * inbound message. It coordinates all other ai-agent files to process the message
 * and generate the right response.
 *
 * ┌─────────────────────────────────────────────────────────────────────┐
 * │                        MESSAGE FLOW                                 │
 * │                                                                     │
 * │  WhatsApp Message                                                   │
 * │       ↓                                                             │
 * │  Kill switch check (AI_AGENT_DISABLED env var)                      │
 * │       ↓                                                             │
 * │  Load merchant config (ai_agent_configs → store name, voice, etc.)  │
 * │       ↓                                                             │
 * │  Load WhatsApp credentials (whatsapp_config → decrypt access token) │
 * │       ↓                                                             │
 * │  Load customer session (ai_agent_sessions → history, cart, state)   │
 * │       ↓                                                             │
 * │  ┌── CHECKOUT FLOW ACTIVE? ──────────────────────────────┐          │
 * │  │ YES → Handle checkout step (address / payment choice) │          │
 * │  └── NO ─────────────────────────────────────────────────┘          │
 * │       ↓                                                             │
 * │  Detect intent (GPT-4o-mini → SHOPPING_QUERY / CART_ADD / etc.)     │
 * │       ↓                                                             │
 * │  Route to handler based on intent:                                  │
 * │    GREETING       → Generate welcome message                        │
 * │    SHOPPING_QUERY → Vector search → Product cards + text reply      │
 * │    CART_ADD       → Find product → Add to cart → Confirm            │
 * │    CART_REMOVE    → Find item in cart → Remove → Confirm            │
 * │    CART_VIEW      → Show cart contents                              │
 * │    CHECKOUT       → Start multi-step checkout flow                  │
 * │    HUMAN_NEEDED   → Flag session → Handoff message                  │
 * │    OUT_OF_SCOPE   → Gentle redirect to shopping                     │
 * │       ↓                                                             │
 * │  Send reply via WhatsApp                                            │
 * │       ↓                                                             │
 * │  Save messages to session (rolling window of last 10 turns)         │
 * └─────────────────────────────────────────────────────────────────────┘
 *
 * Checkout flow state machine (stored in cart.checkoutStep):
 *   null → 'awaiting_address' → 'awaiting_payment_choice' → 'awaiting_payment' → null
 *
 * Error handling:
 *   - Every handler catches its own errors
 *   - Agent never crashes — worst case sends "sorry, try again" message
 *   - All errors logged with [Engine] prefix for Vercel log search
 * ============================================================================
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { decrypt } from '@/lib/whatsapp/encryption'
import { detectIntent } from './intent'
import { getOrCreateSession, appendMessageToSession, type ConversationMessage } from './memory'
import { retrieveProductsForQuery } from './retriever'
import { generateAgentReply, generateGreetingReply, type AgentResponderConfig } from './responder'
import {
  sendProductCardsToCustomer, sendTextMessage, sendInteractiveButtons,
  type WhatsAppCredentials,
} from './product-response'
import {
  getCartFromSession, addProductToCart, removeProductFromCart,
  formatCartSummaryText, persistCartToSession, setCheckoutStep,
} from './cart'
import { initiateCheckout, processDeliveryAddress, processPaymentChoice } from './checkout'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AiAgentInput {
  userId: string           // Merchant's Supabase user ID
  contactPhone: string     // Customer's WhatsApp phone number
  inboundMessage: string   // The customer's message text
  supabase: SupabaseClient // Supabase client (service role — bypasses RLS)
}

// ─── Constants ────────────────────────────────────────────────────────────────

const WA_API_URL = 'https://graph.facebook.com/v21.0'

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Creates a ConversationMessage with timestamp (for saving to session) */
function msg(role: 'user' | 'assistant', content: string): ConversationMessage {
  return { role, content, timestamp: new Date().toISOString() }
}

/**
 * Load merchant's AI agent configuration.
 * Only returns config if agent is enabled (is_enabled = true).
 * Returns null if disabled or not found — message gets skipped.
 */
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

/**
 * Load and DECRYPT WhatsApp credentials.
 * IMPORTANT: access_token is stored encrypted in DB — must decrypt before use!
 * The webhook route.ts decrypts separately, but engine reads fresh from DB.
 */
async function loadWaCredentials(userId: string, supabase: SupabaseClient): Promise<WhatsAppCredentials | null> {
  const { data, error } = await supabase
    .from('whatsapp_config')
    .select('phone_number_id, access_token')
    .eq('user_id', userId)
    .single()
  if (error || !data) return null
  return {
    phoneNumberId: data.phone_number_id,
    accessToken: decrypt(data.access_token),  // DECRYPT! Raw encrypted token won't work
  }
}

/**
 * Load all image URLs for products (for carousel display).
 * Returns a Map of product_id → image_urls array.
 */
async function loadProductImages(
  userId: string,
  productIds: string[],
  supabase: SupabaseClient
): Promise<Map<string, string[]>> {
  if (productIds.length === 0) return new Map()

  const { data } = await supabase
    .from('ai_agent_products')
    .select('id, image_urls')
    .eq('user_id', userId)
    .in('id', productIds)

  const map = new Map<string, string[]>()
  if (data) {
    for (const row of data) {
      // image_urls is JSONB — could be array or null
      const urls = Array.isArray(row.image_urls) ? row.image_urls : []
      if (urls.length > 0) map.set(row.id, urls)
    }
  }
  return map
}

/** Send text reply via WhatsApp API (direct send, not through product-response.ts) */
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
  if (!res.ok) {
    const errorBody = await res.text().catch(() => '')
    throw new Error(`[Engine] WA send failed: ${res.status} — ${errorBody}`)
  }
}

/** Log analytics event (non-blocking — fire and forget) */
function logEvent(
  userId: string,
  phone: string,
  type: string,
  data: Record<string, unknown>,
  supabase: SupabaseClient
) {
  void supabase.from('ai_agent_events').insert({
    user_id: userId,
    contact_phone: phone,
    event_type: type,
    event_data: data,
  })
}

// ─── Checkout Flow Handlers ──────────────────────────────────────────────────

/**
 * Handle messages when customer is in the middle of checkout.
 * Returns null if not in checkout flow (so normal intent detection runs).
 * Returns reply text if checkout step was handled.
 *
 * Checkout state machine:
 *   'awaiting_address'        → Customer sends address → show payment options
 *   'awaiting_payment_choice' → Customer picks Online/COD → process payment
 *   'awaiting_payment'        → Waiting for Razorpay → remind or timeout
 */
async function handleCheckoutFlow(
  userId: string,
  contactPhone: string,
  inboundMessage: string,
  cart: ReturnType<typeof getCartFromSession>,
  waCreds: WhatsAppCredentials,
  supabase: SupabaseClient
): Promise<string | null> {
  const step = cart.checkoutStep

  // Not in checkout flow — return null so normal intent detection runs
  if (!step) return null

  // ── Customer wants to cancel checkout ──
  if (/cancel|back|stop|nevermind/i.test(inboundMessage)) {
    const updatedCart = setCheckoutStep(cart, null)
    await persistCartToSession(userId, contactPhone, updatedCart, supabase)
    return `No worries! Checkout cancelled. Your cart is still saved.\n\n${formatCartSummaryText(cart)}\n\nReply *"checkout"* when you're ready to order.`
  }

  switch (step) {
    // ── Step: Waiting for delivery address ──
    case 'awaiting_address': {
      // Customer should have sent their address as free text
      // Minimum length check — too short is probably not an address
      if (inboundMessage.trim().length < 5) {
        return `Please share your full delivery address.\n\n_Example: John, 123 MG Road, Near City Mall, Mumbai 400001_`
      }

      const { message, updatedCart } = await processDeliveryAddress(
        cart, inboundMessage, contactPhone, waCreds
      )
      await persistCartToSession(userId, contactPhone, updatedCart, supabase)
      logEvent(userId, contactPhone, 'checkout_address', { address: inboundMessage }, supabase)

      // processDeliveryAddress sends interactive buttons directly
      // If message is empty, buttons were sent successfully
      return message || null  // null = buttons sent, no additional text needed
    }

    // ── Step: Waiting for payment choice (Online / COD) ──
    case 'awaiting_payment_choice': {
      // Detect payment choice from message or button reply
      const msg = inboundMessage.toLowerCase()
      let paymentMethod: 'ONLINE' | 'COD' | null = null

      if (/online|pay now|upi|card|pay_online|razorpay/i.test(msg)) {
        paymentMethod = 'ONLINE'
      } else if (/cod|cash|pay_cod|cash on delivery/i.test(msg)) {
        paymentMethod = 'COD'
      }

      if (!paymentMethod) {
        // Customer sent something else — remind them of the options
        await sendInteractiveButtons(
          contactPhone,
          `Please choose a payment method:`,
          [
            { id: 'pay_online', title: 'Pay Online' },
            { id: 'pay_cod', title: 'Cash on Delivery' },
          ],
          waCreds
        )
        return null  // Buttons sent
      }

      // Process the payment choice
      const result = await processPaymentChoice(
        userId, contactPhone, cart, paymentMethod, waCreds, supabase
      )
      logEvent(userId, contactPhone, 'checkout_payment', {
        method: paymentMethod,
        orderId: result.orderId,
        success: result.success,
      }, supabase)

      // processPaymentChoice sends CTA card or confirmation directly
      return result.message || null
    }

    // ── Step: Waiting for payment completion ──
    case 'awaiting_payment': {
      // Customer is waiting for Razorpay payment to complete
      // They might message asking about status
      return `Your payment link has been sent! Please click the payment button above to complete your order.\n\nIf you need a new link, type *"checkout"* again.`
    }

    default:
      // Unknown step — reset and let normal flow handle it
      const resetCart = setCheckoutStep(cart, null)
      await persistCartToSession(userId, contactPhone, resetCart, supabase)
      return null
  }
}

// ─── Main Export ──────────────────────────────────────────────────────────────

/**
 * handleAiAgentMessage
 * Main entry point — called from WhatsApp webhook for every inbound message.
 *
 * Called via: webhook route.ts → after() → await handleAiAgentMessage(...)
 * Note: Changed from `void` to `await` to properly catch and log errors.
 *
 * Returns true if agent handled the message, false if skipped (not enabled, etc.)
 *
 * @param input - AiAgentInput (userId, contactPhone, inboundMessage, supabase)
 * @returns boolean — true if message was handled by the AI agent
 */
export async function handleAiAgentMessage(input: AiAgentInput): Promise<boolean> {
  const { userId, contactPhone, inboundMessage, supabase } = input

  // ── Kill switch (set AI_AGENT_DISABLED=true in env to stop all AI agents) ──
  if (process.env.AI_AGENT_DISABLED === 'true') return false

  // ── Load merchant config (returns null if agent not enabled) ──
  const config = await loadAgentConfig(userId, supabase)
  if (!config) return false

  // ── Load WhatsApp credentials (returns null if not configured) ──
  const waCreds = await loadWaCredentials(userId, supabase)
  if (!waCreds) return false

  // ── Load or create customer session ──
  const session = await getOrCreateSession(userId, contactPhone, supabase)

  // If human agent took over, don't respond with AI
  if (session.needs_human) return false

  const isFirstMessage = session.messages.length === 0

  // ── Parse cart state from session ──
  const cart = getCartFromSession(session.cart)

  // ── Check if customer is in checkout flow ──
  // This runs BEFORE intent detection because checkout steps
  // should not be re-classified (e.g., address text would be classified as OUT_OF_SCOPE)
  const checkoutReply = await handleCheckoutFlow(
    userId, contactPhone, inboundMessage, cart, waCreds, supabase
  )
  if (checkoutReply !== null) {
    // Checkout handler generated a text reply — send it
    await sendText(contactPhone, checkoutReply, waCreds)
    await appendMessageToSession({
      userId, contactPhone,
      newMessages: [msg('user', inboundMessage), msg('assistant', checkoutReply)],
      needsHuman: false, supabase,
    })
    return true
  }
  // If checkoutReply is null AND we were in checkout, it means buttons/cards were sent
  // directly by the handler — still need to save the user message
  if (cart.checkoutStep) {
    await appendMessageToSession({
      userId, contactPhone,
      newMessages: [msg('user', inboundMessage)],
      needsHuman: false, supabase,
    })
    return true
  }

  // ── Detect customer intent ──
  const intent = await detectIntent(inboundMessage, session.messages)
  logEvent(userId, contactPhone, 'message_received', {
    intent: intent.intent,
    confidence: intent.confidence,
    keywords: intent.productKeywords,
  }, supabase)

  // ── Build responder config from merchant settings ──
  const responderConfig: AgentResponderConfig = {
    store_name: config.store_name,
    brand_voice_prompt: config.brand_voice_prompt,
    language: config.language,
  }

  let replyText: string

  // ── Route to handler based on detected intent ──
  switch (intent.intent) {

    // ── GREETING: "Hello" / "Hi" / "Namaste" ──
    case 'GREETING': {
      replyText = await generateGreetingReply(responderConfig, isFirstMessage)
      break
    }

    // ── SHOPPING_QUERY: "Show me tea" / "Do you have green tea?" ──
    case 'SHOPPING_QUERY': {
      const query = intent.productKeywords || inboundMessage
      const products = await retrieveProductsForQuery(userId, query, supabase)

      // Generate text reply with product context
      replyText = await generateAgentReply(responderConfig, inboundMessage, session.messages, products)

      // Send text reply first
      await sendText(contactPhone, replyText, waCreds)

      // Then send product cards with images (carousel style)
      if (products.length > 0) {
        // Load all images for matched products (for multi-image carousel)
        const productIds = products.map((p) => p.id)
        const imageMap = await loadProductImages(userId, productIds, supabase)
        await sendProductCardsToCustomer(contactPhone, products, waCreds, imageMap)
      }

      // Save to conversation history
      await appendMessageToSession({
        userId, contactPhone,
        newMessages: [msg('user', inboundMessage), msg('assistant', replyText)],
        needsHuman: false, supabase,
      })
      logEvent(userId, contactPhone, 'shopping_query', {
        query,
        productsFound: products.length,
      }, supabase)
      return true  // Early return — already sent + saved
    }

    // ── CART_ADD: "Add green tea to cart" / "I want 2 of these" ──
    case 'CART_ADD': {
      const query = intent.productKeywords || inboundMessage
      const products = await retrieveProductsForQuery(userId, query, supabase)

      if (products.length === 0) {
        replyText = `I couldn't find that product. Can you describe it differently? Or type *"products"* to browse our catalog.`
        break
      }

      // Add best matching product to cart
      const cartResult = addProductToCart(
        getCartFromSession(session.cart),
        products[0],
        intent.quantity ?? 1
      )

      if (cartResult.success) {
        await persistCartToSession(userId, contactPhone, cartResult.updatedCart, supabase)
        logEvent(userId, contactPhone, 'cart_add', {
          productName: products[0].name,
          quantity: intent.quantity ?? 1,
          cartTotal: cartResult.updatedCart.totalAmount,
        }, supabase)
      }

      replyText = cartResult.message
      break
    }

    // ── CART_REMOVE: "Remove tea from cart" / "Delete the last item" ──
    case 'CART_REMOVE': {
      const currentCart = getCartFromSession(session.cart)

      if (currentCart.items.length === 0) {
        replyText = `Your cart is already empty! Browse our products by telling me what you're looking for.`
        break
      }

      const query = intent.productKeywords || inboundMessage
      const removeResult = removeProductFromCart(currentCart, query)

      if (removeResult.success) {
        await persistCartToSession(userId, contactPhone, removeResult.updatedCart, supabase)
        logEvent(userId, contactPhone, 'cart_remove', {
          query,
          itemsRemaining: removeResult.updatedCart.items.length,
        }, supabase)
      }

      replyText = removeResult.message
      break
    }

    // ── CART_VIEW: "Show my cart" / "What's in my cart?" ──
    case 'CART_VIEW': {
      const currentCart = getCartFromSession(session.cart)
      if (currentCart.items.length === 0) {
        replyText = `Your cart is empty! Tell me what you're looking for and I'll help you find it 🛍️`
      } else {
        replyText = `${formatCartSummaryText(currentCart)}\n\nReply *"checkout"* to place your order, or keep shopping!`
      }
      break
    }

    // ── CHECKOUT: "Checkout" / "I want to pay" / "Place order" ──
    case 'CHECKOUT': {
      const currentCart = getCartFromSession(session.cart)
      const { message, updatedCart } = initiateCheckout(currentCart)
      await persistCartToSession(userId, contactPhone, updatedCart, supabase)
      logEvent(userId, contactPhone, 'checkout_started', {
        items: currentCart.items.length,
        total: currentCart.totalAmount,
      }, supabase)
      replyText = message
      break
    }

    // ── HUMAN_NEEDED: Customer wants to talk to a person ──
    case 'HUMAN_NEEDED': {
      await appendMessageToSession({
        userId, contactPhone,
        newMessages: [msg('user', inboundMessage)],
        needsHuman: true, supabase,  // Flag session — AI stops responding
      })
      replyText = `I'm connecting you with our team now. Someone will be with you shortly! 🙏`
      logEvent(userId, contactPhone, 'human_takeover', { trigger: inboundMessage }, supabase)
      // Send reply and return (don't save again — already saved above)
      await sendText(contactPhone, replyText, waCreds)
      return true
    }

    // ── OUT_OF_SCOPE / DEFAULT: Unrelated message ──
    case 'OUT_OF_SCOPE':
    default: {
      // Use LLM to generate a polite redirect to shopping
      replyText = await generateAgentReply(responderConfig, inboundMessage, session.messages, [])
      break
    }
  }

  // ── Send reply and save to conversation memory ──
  await sendText(contactPhone, replyText, waCreds)
  await appendMessageToSession({
    userId, contactPhone,
    newMessages: [msg('user', inboundMessage), msg('assistant', replyText)],
    needsHuman: false, supabase,
  })

  return true
}
