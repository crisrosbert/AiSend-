/**
 * File: src/lib/ai-agent/checkout.ts
 * Purpose: Multi-step checkout flow for AI Ecommerce Agent
 *
 * Full checkout flow on WhatsApp:
 *   1. Customer says "checkout" → Show cart summary + ask for delivery address
 *   2. Customer sends address → Save address + show payment options (Online / COD) as interactive buttons
 *   3. Customer picks payment → Create order + send Razorpay CTA button (or confirm COD)
 *   4. Razorpay webhook confirms payment → Send confirmation (handled separately)
 *
 * Supports: Razorpay Payment Links (ONLINE) and Cash on Delivery (COD)
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import {
  clearEntireCart, persistCartToSession, formatCartSummaryText,
  setCheckoutStep, setDeliveryAddress, setPendingOrderId,
  type CartState, type DeliveryAddress,
} from './cart'
import {
  sendPaymentLinkCard, sendInteractiveButtons,
  type WhatsAppCredentials,
} from './product-response'

// ─── Types ────────────────────────────────────────────────────────────────────

export type PaymentMethod = 'ONLINE' | 'COD'

export interface CheckoutInput {
  userId: string
  contactPhone: string
  contactName: string
  cart: CartState
  paymentMethod: PaymentMethod
  supabase: SupabaseClient
}

export interface CheckoutResult {
  success: boolean
  orderId: string
  paymentLink?: string
  message: string
  updatedCart?: CartState  // Return updated cart so engine can persist
}

// ─── Step 1: Start Checkout (ask for address) ────────────────────────────────

/**
 * initiateCheckout
 * Shows cart summary and asks for delivery address.
 * Returns updated cart with checkoutStep = 'awaiting_address'
 */
export function initiateCheckout(cart: CartState): { message: string; updatedCart: CartState } {
  if (cart.items.length === 0) {
    return { message: 'Your cart is empty! Add some products first.', updatedCart: cart }
  }

  const summary = formatCartSummaryText(cart)
  const updatedCart = setCheckoutStep(cart, 'awaiting_address')

  return {
    message: `${summary}\n\nPlease share your *delivery address* to proceed.\n\n_Example: John, 123 Main St, Mumbai 400001_`,
    updatedCart,
  }
}

// ─── Step 2: Process Address → Show Payment Options ──────────────────────────

/**
 * processDeliveryAddress
 * Saves the address and sends interactive payment option buttons.
 * Returns updated cart with checkoutStep = 'awaiting_payment_choice'
 */
export async function processDeliveryAddress(
  cart: CartState,
  addressText: string,
  contactPhone: string,
  waCreds: WhatsAppCredentials,
): Promise<{ message: string; updatedCart: CartState }> {
  // Parse address (keep it simple — full text + optional name extraction)
  const address: DeliveryAddress = {
    fullAddress: addressText.trim(),
    contactName: extractName(addressText) || 'Customer',
  }

  let updatedCart = setDeliveryAddress(cart, address)
  updatedCart = setCheckoutStep(updatedCart, 'awaiting_payment_choice')

  const sym = cart.currency === 'INR' ? '₹' : cart.currency
  const total = `${sym}${cart.totalAmount.toFixed(0)}`

  // Send interactive buttons for payment choice
  await sendInteractiveButtons(
    contactPhone,
    `📦 Delivery to: ${address.fullAddress}\n\n💰 Total: *${total}*\n\nHow would you like to pay?`,
    [
      { id: 'pay_online', title: 'Pay Online' },
      { id: 'pay_cod', title: 'Cash on Delivery' },
    ],
    waCreds
  )

  return {
    message: '', // Message sent via interactive buttons above
    updatedCart,
  }
}

/** Try to extract a name from address text (first word before comma, if looks like a name) */
function extractName(text: string): string {
  const parts = text.split(',').map((s) => s.trim())
  const first = parts[0]
  // If first part is short and doesn't contain numbers, it's likely a name
  if (first && first.length < 30 && !/\d/.test(first)) return first
  return ''
}

// ─── Step 3: Process Payment Choice → Create Order ───────────────────────────

/**
 * processPaymentChoice
 * Creates order and either sends Razorpay payment link (CTA button) or confirms COD.
 */
export async function processPaymentChoice(
  userId: string,
  contactPhone: string,
  cart: CartState,
  paymentMethod: PaymentMethod,
  waCreds: WhatsAppCredentials,
  supabase: SupabaseClient,
): Promise<CheckoutResult> {
  if (cart.items.length === 0) {
    return { success: false, orderId: '', message: 'Your cart is empty!' }
  }

  const sym = cart.currency === 'INR' ? '₹' : cart.currency
  const total = `${sym}${cart.totalAmount.toFixed(0)}`
  const contactName = cart.deliveryAddress?.contactName || 'Customer'

  try {
    // Insert order record
    const { data: order, error: orderError } = await supabase
      .from('ai_agent_orders')
      .insert({
        user_id: userId,
        contact_phone: contactPhone,
        contact_name: contactName,
        delivery_address: cart.deliveryAddress?.fullAddress || '',
        items: cart.items,
        total_amount: cart.totalAmount,
        currency: cart.currency,
        payment_method: paymentMethod,
        payment_status: paymentMethod === 'COD' ? 'confirmed' : 'pending_payment',
        razorpay_link_id: null,
      })
      .select('id')
      .single()

    if (orderError || !order) throw new Error(orderError?.message ?? 'Order insert failed')

    const orderId = order.id as string
    let message: string
    let paymentLink: string | undefined

    if (paymentMethod === 'ONLINE') {
      // Create Razorpay payment link
      paymentLink = await createRazorpayLink(cart, contactPhone, contactName, orderId)

      // Save payment link to order
      await supabase.from('ai_agent_orders')
        .update({ razorpay_link_id: paymentLink })
        .eq('id', orderId)

      // Send payment link as CTA button card
      await sendPaymentLinkCard(contactPhone, paymentLink, total, orderId, waCreds)

      // Update cart with pending order
      let updatedCart = setPendingOrderId(cart, orderId)
      updatedCart = setCheckoutStep(updatedCart, 'awaiting_payment')
      await persistCartToSession(userId, contactPhone, updatedCart, supabase)

      message = '' // Message sent via CTA card above
      return { success: true, orderId, paymentLink, message, updatedCart }

    } else {
      // COD — order confirmed immediately
      message = `✅ *Order Confirmed!*\n\n📦 Order #${orderId.slice(0, 8)}\n💰 Total: ${total} (Cash on Delivery)\n📍 Delivery: ${cart.deliveryAddress?.fullAddress || 'Address provided'}\n\nPlease keep cash ready. We'll notify you when it ships! 🚚`

      // Clear cart
      const clearedCart = clearEntireCart(cart)
      await persistCartToSession(userId, contactPhone, clearedCart, supabase)

      // Log event
      void supabase.from('ai_agent_events').insert({
        user_id: userId,
        contact_phone: contactPhone,
        event_type: 'order_placed',
        event_data: { orderId, totalAmount: cart.totalAmount, paymentMethod: 'COD' },
      })

      return { success: true, orderId, message, updatedCart: clearedCart }
    }
  } catch (err) {
    console.error('[Checkout] Error:', err)
    return {
      success: false,
      orderId: '',
      message: 'Sorry, something went wrong placing your order. Please try again or type *"help"* for assistance.',
    }
  }
}

// ─── Razorpay ────────────────────────────────────────────────────────────────

async function createRazorpayLink(
  cart: CartState,
  contactPhone: string,
  contactName: string,
  orderId: string
): Promise<string> {
  const keyId = process.env.RAZORPAY_KEY_ID
  const keySecret = process.env.RAZORPAY_KEY_SECRET
  if (!keyId || !keySecret) throw new Error('[Checkout] Razorpay keys not set')

  const auth = Buffer.from(`${keyId}:${keySecret}`).toString('base64')
  const description = cart.items.map((i) => `${i.productName} x${i.quantity}`).join(', ').slice(0, 255)

  const response = await fetch('https://api.razorpay.com/v1/payment_links', {
    method: 'POST',
    headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      amount: Math.round(cart.totalAmount * 100), // paise
      currency: cart.currency,
      description,
      reference_id: orderId,
      expire_by: Math.floor(Date.now() / 1000) + 86400, // 24 hours
      customer: {
        name: contactName || 'Customer',
        contact: contactPhone.startsWith('+') ? contactPhone : `+${contactPhone}`,
      },
      notify: { sms: false, email: false },
      reminder_enable: false,
      callback_url: `${process.env.NEXT_PUBLIC_APP_URL || ''}/api/ai-agent/razorpay-webhook`,
      callback_method: 'get',
    }),
  })

  if (!response.ok) {
    const errorBody = await response.text().catch(() => '')
    throw new Error(`[Checkout] Razorpay error: ${response.status} — ${errorBody}`)
  }

  const data = await response.json()
  return data.short_url as string
}

// ─── Legacy Export (backward compat) ─────────────────────────────────────────

/**
 * processCheckout — Legacy function kept for backward compatibility.
 * New flow uses initiateCheckout → processDeliveryAddress → processPaymentChoice
 */
export async function processCheckout(input: CheckoutInput): Promise<CheckoutResult> {
  const { userId, contactPhone, contactName, cart, paymentMethod, supabase } = input

  if (cart.items.length === 0) {
    return { success: false, orderId: '', message: 'Your cart is empty! Add products first.' }
  }

  const sym = cart.currency === 'INR' ? '₹' : cart.currency
  const total = `${sym}${cart.totalAmount.toFixed(0)}`

  try {
    const { data: order, error: orderError } = await supabase
      .from('ai_agent_orders')
      .insert({
        user_id: userId,
        contact_phone: contactPhone,
        items: cart.items,
        total_amount: cart.totalAmount,
        currency: cart.currency,
        payment_method: paymentMethod,
        payment_status: paymentMethod === 'COD' ? 'confirmed' : 'pending_payment',
        razorpay_link_id: null,
      })
      .select('id')
      .single()

    if (orderError || !order) throw new Error(orderError?.message ?? 'Order insert failed')

    const orderId = order.id as string
    let message: string
    let paymentLink: string | undefined

    if (paymentMethod === 'ONLINE') {
      paymentLink = await createRazorpayLink(cart, contactPhone, contactName, orderId)
      await supabase.from('ai_agent_orders').update({ razorpay_link_id: paymentLink }).eq('id', orderId)
      message = `🎉 Order ready! Total: ${total}\n\nPay securely here:\n${paymentLink}\n\nLink expires in 24 hours.`
    } else {
      message = `✅ Order confirmed (Cash on Delivery)!\n\nTotal: ${total}\nPlease keep cash ready. We'll notify you when it ships!`
    }

    await persistCartToSession(userId, contactPhone, clearEntireCart(cart), supabase)

    void supabase.from('ai_agent_events').insert({
      user_id: userId,
      contact_phone: contactPhone,
      event_type: 'order_placed',
      event_data: { orderId, totalAmount: cart.totalAmount, paymentMethod },
    })

    return { success: true, orderId, paymentLink, message }
  } catch (err) {
    console.error('[Checkout] Error:', err)
    return { success: false, orderId: '', message: 'Sorry, could not place your order. Please try again or type "help".' }
  }
}
