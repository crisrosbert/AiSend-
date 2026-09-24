/**
 * File: src/lib/ai-agent/cart.ts
 * Purpose: Shopping cart + checkout state for AI Ecommerce Agent
 * Cart + checkout state stored as JSONB in ai_agent_sessions.cart — no separate table
 *
 * Checkout flow state machine:
 *   null → 'awaiting_address' → 'awaiting_payment_choice' → 'awaiting_payment' → null (order placed)
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { RetrievedProduct } from './retriever'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CartItem {
  productId: string
  externalId: string
  productName: string
  price: number
  currency: string
  quantity: number
  imageUrl: string | null
  productUrl: string | null
}

/** Checkout step tracking — stored in cart JSONB */
export type CheckoutStep =
  | null                        // Not in checkout
  | 'awaiting_address'          // Asked for delivery address
  | 'awaiting_payment_choice'   // Address received, showing payment options
  | 'awaiting_payment'          // Payment link sent, waiting for payment

export interface DeliveryAddress {
  fullAddress: string
  contactName: string
}

export interface CartState {
  items: CartItem[]
  totalAmount: number
  currency: string
  lastUpdatedAt: string
  // Checkout state
  checkoutStep: CheckoutStep
  deliveryAddress: DeliveryAddress | null
  pendingOrderId: string | null   // Set when order is created, cleared after payment
}

export interface CartOperationResult {
  success: boolean
  updatedCart: CartState
  message: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function emptyCart(): CartState {
  return {
    items: [],
    totalAmount: 0,
    currency: 'INR',
    lastUpdatedAt: new Date().toISOString(),
    checkoutStep: null,
    deliveryAddress: null,
    pendingOrderId: null,
  }
}

function recalcTotal(items: CartItem[]): number {
  return items.reduce((sum, item) => sum + item.price * item.quantity, 0)
}

// ─── Main Exports ─────────────────────────────────────────────────────────────

/** Parse raw JSONB from session into typed CartState */
export function getCartFromSession(raw: unknown): CartState {
  if (!raw || typeof raw !== 'object') return emptyCart()
  const r = raw as Partial<CartState>
  if (!Array.isArray(r.items)) return emptyCart()
  return {
    items: r.items,
    totalAmount: r.totalAmount ?? recalcTotal(r.items),
    currency: r.currency ?? 'INR',
    lastUpdatedAt: r.lastUpdatedAt ?? new Date().toISOString(),
    checkoutStep: r.checkoutStep ?? null,
    deliveryAddress: r.deliveryAddress ?? null,
    pendingOrderId: r.pendingOrderId ?? null,
  }
}

/** Human-readable cart summary for WhatsApp reply */
export function formatCartSummaryText(cart: CartState): string {
  if (cart.items.length === 0) return 'Your cart is empty.'
  const sym = cart.currency === 'INR' ? '₹' : cart.currency
  const lines = cart.items.map((i, idx) =>
    `${idx + 1}. ${i.productName} x${i.quantity} — ${sym}${(i.price * i.quantity).toFixed(0)}`
  )
  return `🛒 *Your Cart*\n${lines.join('\n')}\n\n*Total: ${sym}${cart.totalAmount.toFixed(0)}*`
}

/** Add product to cart (increments quantity if already present) */
export function addProductToCart(
  cart: CartState,
  product: RetrievedProduct,
  quantity: number = 1
): CartOperationResult {
  if (!product.in_stock) {
    return { success: false, updatedCart: cart, message: `Sorry, ${product.name} is currently out of stock.` }
  }

  const existingIndex = cart.items.findIndex((i) => i.productId === product.id)
  let updatedItems: CartItem[]

  if (existingIndex >= 0) {
    updatedItems = cart.items.map((item, idx) =>
      idx === existingIndex ? { ...item, quantity: item.quantity + quantity } : item
    )
  } else {
    updatedItems = [
      ...cart.items,
      {
        productId: product.id,
        externalId: product.external_id,
        productName: product.name,
        price: product.price,
        currency: product.currency,
        quantity,
        imageUrl: product.image_url,
        productUrl: product.product_url,
      },
    ]
  }

  const updatedCart: CartState = {
    ...cart,
    items: updatedItems,
    totalAmount: recalcTotal(updatedItems),
    currency: updatedItems[0]?.currency ?? 'INR',
    lastUpdatedAt: new Date().toISOString(),
    // Reset checkout step if adding while in checkout
    checkoutStep: null,
    deliveryAddress: null,
    pendingOrderId: null,
  }

  const sym = product.currency === 'INR' ? '₹' : product.currency
  return {
    success: true,
    updatedCart,
    message: `Added *${product.name}* (${sym}${product.price.toFixed(0)}) to your cart!\n\n${formatCartSummaryText(updatedCart)}\n\nReply *"checkout"* when ready to order.`,
  }
}

/** Remove product from cart by name match */
export function removeProductFromCart(
  cart: CartState,
  productNameQuery: string
): CartOperationResult {
  const query = productNameQuery.toLowerCase()
  const index = cart.items.findIndex((i) => i.productName.toLowerCase().includes(query))

  if (index < 0) {
    return { success: false, updatedCart: cart, message: `Couldn't find "${productNameQuery}" in your cart.` }
  }

  const removed = cart.items[index]
  const updatedItems = cart.items.filter((_, idx) => idx !== index)
  const updatedCart: CartState = {
    ...cart,
    items: updatedItems,
    totalAmount: recalcTotal(updatedItems),
    lastUpdatedAt: new Date().toISOString(),
    checkoutStep: null,
  }

  return {
    success: true,
    updatedCart,
    message: `Removed *${removed.productName}* from your cart.\n\n${updatedItems.length > 0 ? formatCartSummaryText(updatedCart) : 'Your cart is now empty.'}`,
  }
}

/** Set checkout step */
export function setCheckoutStep(cart: CartState, step: CheckoutStep): CartState {
  return { ...cart, checkoutStep: step, lastUpdatedAt: new Date().toISOString() }
}

/** Set delivery address */
export function setDeliveryAddress(cart: CartState, address: DeliveryAddress): CartState {
  return { ...cart, deliveryAddress: address, lastUpdatedAt: new Date().toISOString() }
}

/** Set pending order ID */
export function setPendingOrderId(cart: CartState, orderId: string): CartState {
  return { ...cart, pendingOrderId: orderId, lastUpdatedAt: new Date().toISOString() }
}

/** Clear cart after order is placed */
export function clearEntireCart(cart: CartState): CartState {
  return { ...emptyCart(), currency: cart.currency }
}

/** Persist cart JSONB to ai_agent_sessions table */
export async function persistCartToSession(
  userId: string,
  contactPhone: string,
  updatedCart: CartState,
  supabase: SupabaseClient
): Promise<void> {
  const { error } = await supabase
    .from('ai_agent_sessions')
    .update({ cart: updatedCart, updated_at: new Date().toISOString() })
    .eq('user_id', userId)
    .eq('contact_phone', contactPhone)

  if (error) throw new Error(`[Cart] Failed to persist: ${error.message}`)
}
