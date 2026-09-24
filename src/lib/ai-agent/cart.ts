/**
 * File: src/lib/ai-agent/cart.ts
 * Purpose: Shopping cart CRUD operations for AI Ecommerce Agent
 *
 * Cart is stored as a JSONB column inside ai_agent_sessions table.
 * No separate cart table — keeps session state in one row per customer.
 *
 * Cart structure (CartState):
 *   items: CartItem[]   — list of products with quantities
 *   totalAmount: number — sum of (price * quantity) for all items
 *   currency: string    — currency of all items (must match; mixed currencies not supported)
 *
 * Functions exported here are called by engine.ts based on detected intent.
 */

import { SupabaseClient } from '@supabase/supabase-js'
import { RetrievedProduct } from './retriever'

// ─── Types ───────────────────────────────────────────────────────────────────

/** A single product entry in the customer's cart */
export interface CartItem {
  productId: string        // ai_agent_products.id (UUID)
  externalId: string       // Merchant's own product ID (for order creation)
  productName: string
  price: number
  currency: string
  quantity: number
  imageUrl: string | null
  productUrl: string | null
}

/** Full cart state stored in ai_agent_sessions.cart (JSONB) */
export interface CartState {
  items: CartItem[]
  totalAmount: number    // Always re-computed from items on every mutation
  currency: string       // Currency of the cart (taken from first item)
  lastUpdatedAt: string  // ISO timestamp of last cart mutation
}

/** Result returned to engine.ts after a cart operation */
export interface CartOperationResult {
  success: boolean
  updatedCart: CartState
  message: string   // Human-readable confirmation (used in agent's WhatsApp reply)
}

// ─── Cart Helpers ─────────────────────────────────────────────────────────────

/**
 * createEmptyCart
 * Returns a new empty CartState with zeroed totals.
 * Used when a session has no cart yet.
 */
function createEmptyCart(): CartState {
  return {
    items: [],
    totalAmount: 0,
    currency: 'INR',   // Default — overwritten by first item added
    lastUpdatedAt: new Date().toISOString(),
  }
}

/**
 * recalculateCartTotal
 * Recomputes totalAmount from the items array.
 * Called after every add/remove/update so totals are always accurate.
 */
function recalculateCartTotal(cartItems: CartItem[]): number {
  return cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0)
}

/**
 * formatCartSummaryText
 * Generates a human-readable cart summary for the WhatsApp reply.
 * Example: "Your cart: Nike Shoes x2 (₹1,199 each), Adidas Cap x1 (₹499) — Total: ₹2,897"
 */
export function formatCartSummaryText(cart: CartState): string {
  if (cart.items.length === 0) {
    return 'Your cart is empty.'
  }

  const currencySymbol = cart.currency === 'INR' ? '₹' : cart.currency

  const itemLines = cart.items
    .map(
      (item) =>
        `${item.productName} x${item.quantity} (${currencySymbol}${item.price.toFixed(0)} each)`
    )
    .join(', ')

  const totalFormatted = `${currencySymbol}${cart.totalAmount.toFixed(0)}`

  return `Your cart: ${itemLines} — Total: ${totalFormatted}`
}

// ─── Cart Operations ──────────────────────────────────────────────────────────

/**
 * addProductToCart
 * Adds a product to the customer's cart (or increments quantity if already present).
 * If the product is out of stock, returns an error without modifying the cart.
 *
 * @param currentCart     - Existing cart state from the session
 * @param productToAdd    - Product retrieved by retriever.ts
 * @param quantityToAdd   - How many units to add (default: 1)
 * @returns CartOperationResult with updated cart and confirmation message
 */
export function addProductToCart(
  currentCart: CartState,
  productToAdd: RetrievedProduct,
  quantityToAdd: number = 1
): CartOperationResult {
  // Guard: out of stock
  if (!productToAdd.in_stock) {
    return {
      success: false,
      updatedCart: currentCart,
      message: `Sorry, ${productToAdd.name} is currently out of stock.`,
    }
  }

  // Check if product already exists in cart
  const existingItemIndex = currentCart.items.findIndex(
    (cartItem) => cartItem.productId === productToAdd.id
  )

  let updatedCartItems: CartItem[]

  if (existingItemIndex >= 0) {
    // Product already in cart — increment quantity
    updatedCartItems = currentCart.items.map((cartItem, index) => {
      if (index === existingItemIndex) {
        return { ...cartItem, quantity: cartItem.quantity + quantityToAdd }
      }
      return cartItem
    })
  } else {
    // New product — append to cart
    const newCartItem: CartItem = {
      productId: productToAdd.id,
      externalId: productToAdd.external_id,
      productName: productToAdd.name,
      price: productToAdd.price,
      currency: productToAdd.currency,
      quantity: quantityToAdd,
      imageUrl: productToAdd.image_url,
      productUrl: productToAdd.product_url,
    }
    updatedCartItems = [...currentCart.items, newCartItem]
  }

  const updatedCart: CartState = {
    items: updatedCartItems,
    totalAmount: recalculateCartTotal(updatedCartItems),
    currency: updatedCartItems[0]?.currency ?? 'INR',
    lastUpdatedAt: new Date().toISOString(),
  }

  const currencySymbol = productToAdd.currency === 'INR' ? '₹' : productToAdd.currency
  const confirmationMessage =
    existingItemIndex >= 0
      ? `Added ${quantityToAdd} more ${productToAdd.name} to your cart. ${formatCartSummaryText(updatedCart)}`
      : `✅ Added ${productToAdd.name} (${currencySymbol}${productToAdd.price.toFixed(0)}) to your cart! ${formatCartSummaryText(updatedCart)}`

  return {
    success: true,
    updatedCart,
    message: confirmationMessage,
  }
}

/**
 * removeProductFromCart
 * Removes a product entirely from the cart by product name (fuzzy match).
 * Used when customer says "remove X from cart".
 *
 * @param currentCart    - Existing cart state
 * @param productName    - Product name to remove (matched case-insensitively)
 * @returns CartOperationResult
 */
export function removeProductFromCart(
  currentCart: CartState,
  productName: string
): CartOperationResult {
  const normalizedProductName = productName.toLowerCase().trim()

  const matchingItemIndex = currentCart.items.findIndex((cartItem) =>
    cartItem.productName.toLowerCase().includes(normalizedProductName)
  )

  if (matchingItemIndex === -1) {
    return {
      success: false,
      updatedCart: currentCart,
      message: `I couldn't find "${productName}" in your cart.`,
    }
  }

  const removedItem = currentCart.items[matchingItemIndex]
  const updatedCartItems = currentCart.items.filter((_, index) => index !== matchingItemIndex)

  const updatedCart: CartState = {
    items: updatedCartItems,
    totalAmount: recalculateCartTotal(updatedCartItems),
    currency: updatedCartItems[0]?.currency ?? currentCart.currency,
    lastUpdatedAt: new Date().toISOString(),
  }

  return {
    success: true,
    updatedCart,
    message: updatedCartItems.length === 0
      ? `Removed ${removedItem.productName} from your cart. Your cart is now empty.`
      : `Removed ${removedItem.productName}. ${formatCartSummaryText(updatedCart)}`,
  }
}

/**
 * clearEntireCart
 * Empties the cart completely. Called after order is placed (checkout).
 *
 * @param currentCart - Existing cart state
 * @returns New empty CartState
 */
export function clearEntireCart(currentCart: CartState): CartState {
  return {
    ...createEmptyCart(),
    currency: currentCart.currency, // Preserve currency setting
  }
}

/**
 * getCartFromSession
 * Reads the cart JSONB from the session row and returns it as a typed CartState.
 * If session has no cart yet, returns an empty cart.
 *
 * @param sessionCartJsonb - Raw JSONB value from ai_agent_sessions.cart column
 * @returns Typed CartState
 */
export function getCartFromSession(sessionCartJsonb: unknown): CartState {
  if (!sessionCartJsonb || typeof sessionCartJsonb !== 'object') {
    return createEmptyCart()
  }

  // Cast and validate structure — cart must have items array
  const rawCart = sessionCartJsonb as Partial<CartState>
  if (!Array.isArray(rawCart.items)) {
    return createEmptyCart()
  }

  return {
    items: rawCart.items,
    totalAmount: rawCart.totalAmount ?? recalculateCartTotal(rawCart.items),
    currency: rawCart.currency ?? 'INR',
    lastUpdatedAt: rawCart.lastUpdatedAt ?? new Date().toISOString(),
  }
}

/**
 * persistCartToSession
 * Writes the updated cart back to ai_agent_sessions.cart (JSONB column).
 * Called by engine.ts after any cart mutation (add, remove, clear).
 *
 * @param userId         - Merchant's user ID
 * @param contactPhone   - Customer's phone number (session key)
 * @param updatedCart    - New cart state to save
 * @param supabase       - Supabase client
 */
export async function persistCartToSession(
  userId: string,
  contactPhone: string,
  updatedCart: CartState,
  supabase: SupabaseClient
): Promise<void> {
  const { error: updateError } = await supabase
    .from('ai_agent_sessions')
    .update({
      cart: updatedCart,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId)
    .eq('contact_phone', contactPhone)

  if (updateError) {
    throw new Error(
      `[AI Agent Cart] Failed to persist cart to session: ${updateError.message}`
    )
  }

  console.log(
    `[AI Agent Cart] Cart saved for userId=${userId} phone=${contactPhone} — ${updatedCart.items.length} items, total=${updatedCart.totalAmount} ${updatedCart.currency}`
  )
}
