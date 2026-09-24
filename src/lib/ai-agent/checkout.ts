/**
 * File: src/lib/ai-agent/checkout.ts
 * Purpose: Order placement for AI Ecommerce Agent
 * Supports ONLINE (Razorpay Payment Link) and COD payment methods
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { clearEntireCart, persistCartToSession, type CartState } from './cart'

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
    }),
  })

  if (!response.ok) throw new Error(`[Checkout] Razorpay error: ${response.status}`)
  const data = await response.json()
  return data.short_url as string
}

// ─── Main Export ──────────────────────────────────────────────────────────────

/**
 * processCheckout
 * Creates order record → generates payment link (ONLINE) or confirms COD → clears cart
 */
export async function processCheckout(input: CheckoutInput): Promise<CheckoutResult> {
  const { userId, contactPhone, contactName, cart, paymentMethod, supabase } = input

  if (cart.items.length === 0) {
    return { success: false, orderId: '', message: 'Your cart is empty! Add products first.' }
  }

  const sym = cart.currency === 'INR' ? '₹' : cart.currency
  const total = `${sym}${cart.totalAmount.toFixed(0)}`

  try {
    // Insert order record
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

      // Save payment link to order
      await supabase.from('ai_agent_orders').update({ razorpay_link_id: paymentLink }).eq('id', orderId)

      message = `🎉 Order ready! Total: ${total}\n\nPay securely here:\n${paymentLink}\n\nLink expires in 24 hours.`
    } else {
      message = `✅ Order confirmed (Cash on Delivery)!\n\nTotal: ${total}\nPlease keep cash ready. We'll notify you when it ships!`
    }

    // Clear cart
    await persistCartToSession(userId, contactPhone, clearEntireCart(cart), supabase)

    // Log analytics event (non-blocking)
    void supabase.from('ai_agent_events').insert({
      user_id: userId,
      contact_phone: contactPhone,
      event_type: 'order_placed',
      event_data: { orderId, totalAmount: cart.totalAmount, paymentMethod },
    })

    return { success: true, orderId, paymentLink, message }
  } catch (err) {
    console.error('[Checkout] Error:', err)
    return {
      success: false,
      orderId: '',
      message: 'Sorry, could not place your order. Please try again or type "help".',
    }
  }
}
