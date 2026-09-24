/**
 * File: src/lib/ai-agent/checkout.ts
 * Purpose: Order placement and payment for AI Ecommerce Agent
 *
 * Supports two payment modes:
 *   1. ONLINE  — Creates a Razorpay Payment Link and sends it to the customer via WhatsApp
 *   2. COD     — Cash on Delivery; confirms order directly, no payment link needed
 *
 * On success:
 *   - Inserts a row into ai_agent_orders table
 *   - Clears the customer's cart in ai_agent_sessions
 *   - Logs an 'order_placed' event in ai_agent_events
 *
 * Env vars required:
 *   RAZORPAY_KEY_ID       — Razorpay API key (for online payment links)
 *   RAZORPAY_KEY_SECRET   — Razorpay API secret
 */

import { SupabaseClient } from '@supabase/supabase-js'
import { CartState, clearEntireCart, persistCartToSession } from './cart'

// ─── Types ───────────────────────────────────────────────────────────────────

/** Payment method chosen by the customer */
export type PaymentMethod = 'ONLINE' | 'COD'

/** Razorpay Payment Link API response (partial — only fields we use) */
interface RazorpayPaymentLinkResponse {
  id: string         // Razorpay payment link ID (e.g. "plink_xxxx")
  short_url: string  // Short URL sent to customer (e.g. "https://rzp.io/l/xxxxx")
  status: string     // "created" | "paid" | "cancelled"
}

/** Input for creating an order */
export interface CheckoutInput {
  userId: string           // Merchant's user ID
  contactPhone: string     // Customer's phone number (used for RazorPay + order record)
  contactName: string      // Customer's name (if known from session)
  cart: CartState          // Current cart to check out
  paymentMethod: PaymentMethod
  deliveryAddress?: string // Optional; required for COD confirmation text
  supabase: SupabaseClient
}

/** Result returned to engine.ts after checkout attempt */
export interface CheckoutResult {
  success: boolean
  paymentLink?: string   // Razorpay short URL (only for ONLINE payment)
  orderId: string        // ai_agent_orders.id (UUID) — for tracking
  message: string        // WhatsApp message to send to the customer
}

// ─── Razorpay Integration ──────────────────────────────────────────────────────

/**
 * createRazorpayPaymentLink
 * Calls Razorpay Payment Links API to generate a checkout URL.
 * The link expires in 24 hours and accepts UPI/cards/net-banking.
 *
 * Docs: https://razorpay.com/docs/payments/payment-links/
 *
 * @param cart            - Cart to generate the payment link for
 * @param contactPhone    - Customer's phone (pre-fills in Razorpay form)
 * @param contactName     - Customer's name (pre-fills in Razorpay form)
 * @param merchantOrderId - Our internal order UUID (sent as reference_id)
 * @returns Razorpay payment link short URL
 */
async function createRazorpayPaymentLink(
  cart: CartState,
  contactPhone: string,
  contactName: string,
  merchantOrderId: string
): Promise<string> {
  const razorpayKeyId = process.env.RAZORPAY_KEY_ID
  const razorpayKeySecret = process.env.RAZORPAY_KEY_SECRET

  if (!razorpayKeyId || !razorpayKeySecret) {
    throw new Error(
      '[AI Agent Checkout] RAZORPAY_KEY_ID or RAZORPAY_KEY_SECRET environment variable is not set'
    )
  }

  // Razorpay requires amount in paise (smallest currency unit) — multiply INR by 100
  const amountInPaise = Math.round(cart.totalAmount * 100)

  // Build description from cart items (shown on Razorpay checkout page)
  const orderDescription = cart.items
    .map((item) => `${item.productName} x${item.quantity}`)
    .join(', ')
    .substring(0, 255) // Razorpay description limit

  // Razorpay payment link expires 24 hours from now
  const expiryTimestamp = Math.floor(Date.now() / 1000) + 24 * 60 * 60

  const razorpayRequestBody = {
    amount: amountInPaise,
    currency: cart.currency,
    description: orderDescription,
    reference_id: merchantOrderId,   // Our order ID — appears in Razorpay dashboard
    expire_by: expiryTimestamp,
    customer: {
      name: contactName || 'Customer',
      contact: contactPhone.startsWith('+') ? contactPhone : `+${contactPhone}`,
    },
    notify: {
      sms: false,    // We send the link via WhatsApp ourselves
      email: false,
    },
    reminder_enable: false,
    callback_url: process.env.NEXT_PUBLIC_APP_URL
      ? `${process.env.NEXT_PUBLIC_APP_URL}/api/ai-agent/payment-callback`
      : undefined,
    callback_method: 'get',
  }

  // Razorpay uses HTTP Basic Auth: Key_Id:Key_Secret
  const razorpayAuthHeader = Buffer.from(`${razorpayKeyId}:${razorpayKeySecret}`).toString(
    'base64'
  )

  const razorpayResponse = await fetch('https://api.razorpay.com/v1/payment_links', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${razorpayAuthHeader}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(razorpayRequestBody),
  })

  if (!razorpayResponse.ok) {
    const errorBody = await razorpayResponse.text()
    throw new Error(
      `[AI Agent Checkout] Razorpay API error ${razorpayResponse.status}: ${errorBody}`
    )
  }

  const paymentLinkData: RazorpayPaymentLinkResponse = await razorpayResponse.json()

  console.log(
    `[AI Agent Checkout] Razorpay payment link created: ${paymentLinkData.short_url} for order ${merchantOrderId}`
  )

  return paymentLinkData.short_url
}

// ─── Order Creation ────────────────────────────────────────────────────────────

/**
 * insertOrderRecord
 * Creates a row in ai_agent_orders table to track the placed order.
 * Returns the generated order UUID.
 *
 * @param userId           - Merchant's user ID
 * @param contactPhone     - Customer's phone
 * @param cart             - Cart state at time of order
 * @param paymentMethod    - 'ONLINE' or 'COD'
 * @param razorpayLinkId   - Razorpay payment link ID (null for COD)
 * @param supabase         - Supabase client
 * @returns New order's UUID
 */
async function insertOrderRecord(
  userId: string,
  contactPhone: string,
  cart: CartState,
  paymentMethod: PaymentMethod,
  razorpayLinkId: string | null,
  supabase: SupabaseClient
): Promise<string> {
  const orderStatus = paymentMethod === 'COD' ? 'confirmed' : 'pending_payment'

  const { data: newOrderRow, error: insertError } = await supabase
    .from('ai_agent_orders')
    .insert({
      user_id: userId,
      contact_phone: contactPhone,
      items: cart.items,           // JSONB — full cart items array
      total_amount: cart.totalAmount,
      currency: cart.currency,
      payment_method: paymentMethod,
      payment_status: orderStatus,
      razorpay_link_id: razorpayLinkId,
    })
    .select('id')
    .single()

  if (insertError || !newOrderRow) {
    throw new Error(
      `[AI Agent Checkout] Failed to insert order record: ${insertError?.message ?? 'No row returned'}`
    )
  }

  console.log(
    `[AI Agent Checkout] Order created: ${newOrderRow.id} for userId=${userId} phone=${contactPhone} method=${paymentMethod} total=${cart.totalAmount} ${cart.currency}`
  )

  return newOrderRow.id as string
}

// ─── Analytics Event ──────────────────────────────────────────────────────────

/**
 * logOrderPlacedEvent
 * Writes an immutable event to ai_agent_events for analytics.
 * Non-blocking — failure here should NOT fail the checkout.
 */
async function logOrderPlacedEvent(
  userId: string,
  contactPhone: string,
  orderId: string,
  totalAmount: number,
  paymentMethod: PaymentMethod,
  supabase: SupabaseClient
): Promise<void> {
  const { error } = await supabase.from('ai_agent_events').insert({
    user_id: userId,
    contact_phone: contactPhone,
    event_type: 'order_placed',
    event_data: { orderId, totalAmount, paymentMethod },
  })

  if (error) {
    // Log but don't throw — analytics failure should not break checkout
    console.error(`[AI Agent Checkout] Failed to log order_placed event: ${error.message}`)
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * processCheckout
 * Main entry point called by engine.ts when intent is CHECKOUT.
 *
 * Flow:
 *   1. Validate cart is not empty
 *   2. Insert order record (get order ID)
 *   3. If ONLINE: create Razorpay payment link
 *   4. Clear cart from session
 *   5. Log analytics event
 *   6. Return result with message for WhatsApp reply
 *
 * @param input - CheckoutInput with all required context
 * @returns CheckoutResult with payment link (if online) and WhatsApp message
 */
export async function processCheckout(input: CheckoutInput): Promise<CheckoutResult> {
  const { userId, contactPhone, contactName, cart, paymentMethod, supabase } = input

  // Guard: empty cart
  if (cart.items.length === 0) {
    return {
      success: false,
      orderId: '',
      message: 'Your cart is empty! Please add some products before checking out.',
    }
  }

  const currencySymbol = cart.currency === 'INR' ? '₹' : cart.currency
  const totalFormatted = `${currencySymbol}${cart.totalAmount.toFixed(0)}`

  try {
    // Step 1: Insert order record to get a stable order ID
    // We insert first so we can pass our order ID to Razorpay as reference_id
    const newOrderId = await insertOrderRecord(
      userId,
      contactPhone,
      cart,
      paymentMethod,
      null,            // Razorpay link ID filled in next step for ONLINE orders
      supabase
    )

    let paymentLinkUrl: string | undefined
    let customerMessage: string

    if (paymentMethod === 'ONLINE') {
      // Step 2a: Create Razorpay payment link
      paymentLinkUrl = await createRazorpayPaymentLink(
        cart,
        contactPhone,
        contactName,
        newOrderId
      )

      // Update order record with the Razorpay link (non-critical — don't fail checkout)
      await supabase
        .from('ai_agent_orders')
        .update({ razorpay_link_id: paymentLinkUrl })
        .eq('id', newOrderId)

      customerMessage =
        `🎉 Your order is ready! Total: ${totalFormatted}\n\n` +
        `Click here to pay securely:\n${paymentLinkUrl}\n\n` +
        `This link expires in 24 hours. Your order will be confirmed once payment is received.`
    } else {
      // Step 2b: COD — confirm immediately
      customerMessage =
        `✅ Your order is confirmed! (Cash on Delivery)\n\n` +
        `Order total: ${totalFormatted}\n` +
        `Please keep cash ready at delivery. ` +
        `We'll send you an update once your order is shipped!`
    }

    // Step 3: Clear cart from session (order is now placed)
    const emptyCart = clearEntireCart(cart)
    await persistCartToSession(userId, contactPhone, emptyCart, supabase)

    // Step 4: Log analytics event (non-blocking)
    void logOrderPlacedEvent(userId, contactPhone, newOrderId, cart.totalAmount, paymentMethod, supabase)

    return {
      success: true,
      paymentLink: paymentLinkUrl,
      orderId: newOrderId,
      message: customerMessage,
    }
  } catch (checkoutError) {
    console.error('[AI Agent Checkout] Checkout failed:', checkoutError)

    return {
      success: false,
      orderId: '',
      message:
        `Sorry, I couldn't complete your order right now. Please try again or type "help" to reach our team.`,
    }
  }
}
