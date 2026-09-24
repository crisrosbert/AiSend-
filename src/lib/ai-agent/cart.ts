/**
 * File: src/lib/ai-agent/cart.ts
 * Purpose: Shopping cart operations for AI Ecommerce Agent
 * Cart is stored as JSONB in ai_agent_sessions.cart — no separate table
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

export interface CartState {
  items: CartItem[]
  totalAmount: number
  currency: string
  lastUpdatedAt: string
}

export interface CartOperationResult {
  success: boolean
  updatedCart: CartState
  message: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function emptyCart(): CartState {
  return { items: [], totalAmount: 0, currency: 'INR', lastUpdatedAt: new Date().toISOString() }
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
  }
}

/** Human-readable cart summary for WhatsApp reply */
export function formatCartSummaryText(cart: CartState): string {
  if (cart.items.length === 0) return 'Your cart is empty.'
  const sym = cart.currency === 'INR' ? '₹' : cart.currency
  const lines = cart.items.map((i) => `${i.productName} x${i.quantity} (${sym}${i.price.toFixed(0)})`)
  return `Cart: ${lines.join(', ')} — Total: ${sym}${cart.totalAmount.toFixed(0)}`
}

/** Add product to cart (increments quantity if already present) */
export function addProductToCart(
  cart: CartState,
  product: RetrievedProduct,
  quantity: number = 1
): CartOperationResult {
  if (!product.in_stock) {
    return { success: false, updatedCart: cart, message: `Sorry, ${product.name} is out of stock.` }
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
    items: updatedItems,
    totalAmount: recalcTotal(updatedItems),
    currency: updatedItems[0]?.currency ?? 'INR',
    lastUpdatedAt: new Date().toISOString(),
  }

  const sym = product.currency === 'INR' ? '₹' : product.currency
  return {
    success: true,
    updatedCart,
    message: `✅ Added ${product.name} (${sym}${product.price.toFixed(0)}) to cart! ${formatCartSummaryText(updatedCart)}`,
  }
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
