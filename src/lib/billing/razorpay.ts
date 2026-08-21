// src/lib/billing/razorpay.ts
//
// Everything that talks to Razorpay, in one place.
//
// ── WHY THIS FILE EXISTS ─────────────────────────────────────────────
// Order creation was written inline in the recharge route, signature
// checking inline in the verify route, and the subscribe route had
// neither — just a comment where the payment should have been. Three
// different shapes for one integration is how a money path ends up with
// a hole in it, and it did (see confirmPayment below).
//
// ── THE RULE THAT MATTERS ────────────────────────────────────────────
// A payment's amount is whatever RAZORPAY says it is. Never what the
// browser says it is.
//
// This is not theoretical. The old verify route read `amount` straight
// from the request body and credited that. Razorpay's signature covers
// `order_id|payment_id` and nothing else — so a customer could pay ₹100,
// let the real payment succeed, then post the real order id, the real
// payment id, the real signature, and `amount: 100000`. Every check
// passed. The wallet gained ₹1,00,000 for ₹100.
//
// confirmPayment() closes that by fetching the order back from Razorpay
// and returning the amount THEY recorded. Callers cannot opt out: it is
// the only thing they get.

import crypto from 'crypto'

const API = 'https://api.razorpay.com/v1'

export interface RazorpayOrder {
  id: string
  /** In paise. Razorpay works in the currency's smallest unit. */
  amount: number
  currency: string
  receipt?: string
  status: string
  notes?: Record<string, string>
}

/** Both keys, or null when the gateway is not configured. */
export function razorpayKeys(): { keyId: string; keySecret: string } | null {
  const keyId = process.env.RAZORPAY_KEY_ID
  const keySecret = process.env.RAZORPAY_KEY_SECRET
  if (!keyId || !keySecret) return null
  return { keyId, keySecret }
}

export function isRazorpayEnabled(): boolean {
  return razorpayKeys() !== null
}

/** Are we pointed at test keys? Shown in the UI so nobody demos live money. */
export function isTestMode(): boolean {
  return (process.env.RAZORPAY_KEY_ID || '').startsWith('rzp_test_')
}

function authHeader(keyId: string, keySecret: string): string {
  return 'Basic ' + Buffer.from(`${keyId}:${keySecret}`).toString('base64')
}

/**
 * Create an order.
 *
 * `amountInr` is rupees; Razorpay wants paise, and the conversion is
 * done here so no caller has to remember it. Getting that wrong by a
 * factor of 100 is the classic payments bug and it is silent in both
 * directions — either the customer is charged 100× or you are.
 *
 * `notes` are stored on the order by Razorpay and come back on fetch,
 * which is what lets confirmPayment check that a payment belongs to the
 * org and plan the caller thinks it does.
 */
export async function createOrder(args: {
  amountInr: number
  receipt: string
  notes: Record<string, string>
}): Promise<RazorpayOrder> {
  const keys = razorpayKeys()
  if (!keys) throw new Error('Payment gateway is not configured.')

  const amountPaise = Math.round(args.amountInr * 100)
  if (!Number.isFinite(amountPaise) || amountPaise <= 0) {
    throw new Error('Invalid amount.')
  }

  const res = await fetch(`${API}/orders`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: authHeader(keys.keyId, keys.keySecret),
    },
    body: JSON.stringify({
      amount: amountPaise,
      currency: 'INR',
      // Razorpay caps receipts at 40 characters and rejects longer ones
      // with a validation error that does not mention the length.
      receipt: args.receipt.slice(0, 40),
      notes: args.notes,
    }),
  })

  const data = await res.json()
  if (!res.ok) {
    throw new Error(data?.error?.description || `Razorpay order failed (${res.status})`)
  }
  return data as RazorpayOrder
}

/** Read an order back. This is the authority on what was actually paid. */
export async function fetchOrder(orderId: string): Promise<RazorpayOrder> {
  const keys = razorpayKeys()
  if (!keys) throw new Error('Payment gateway is not configured.')

  const res = await fetch(`${API}/orders/${encodeURIComponent(orderId)}`, {
    headers: { Authorization: authHeader(keys.keyId, keys.keySecret) },
  })

  const data = await res.json()
  if (!res.ok) {
    throw new Error(data?.error?.description || `Could not read order (${res.status})`)
  }
  return data as RazorpayOrder
}

/**
 * Is this signature genuinely Razorpay's?
 *
 * HMAC_SHA256(order_id|payment_id) with the key secret. Compared with
 * timingSafeEqual rather than `===`: string comparison exits at the
 * first differing byte, and that timing difference is enough to
 * reconstruct a signature one byte at a time given enough attempts.
 */
export function signatureValid(
  orderId: string,
  paymentId: string,
  signature: string,
): boolean {
  const keys = razorpayKeys()
  if (!keys) return false

  const expected = crypto
    .createHmac('sha256', keys.keySecret)
    .update(`${orderId}|${paymentId}`)
    .digest('hex')

  const a = Buffer.from(expected)
  const b = Buffer.from(signature)
  if (a.length !== b.length) return false
  return crypto.timingSafeEqual(a, b)
}

export interface ConfirmedPayment {
  orderId: string
  paymentId: string
  /** Rupees, as recorded by Razorpay — never as claimed by the caller. */
  amountInr: number
  notes: Record<string, string>
}

export interface ConfirmInput {
  razorpay_order_id?: unknown
  razorpay_payment_id?: unknown
  razorpay_signature?: unknown
}

/**
 * Turn a checkout callback into a payment you can act on, or throw.
 *
 * Three things must hold, and all three are checked here so no route
 * can accidentally skip one:
 *
 *   1. the fields are present and are strings
 *   2. the signature is Razorpay's
 *   3. the order is actually paid, and its amount comes from Razorpay
 *
 * Point 3 is the one that was missing. A valid signature proves a
 * payment happened; it says nothing about how much, because the amount
 * is not part of what is signed.
 */
export async function confirmPayment(body: ConfirmInput): Promise<ConfirmedPayment> {
  const orderId = typeof body.razorpay_order_id === 'string' ? body.razorpay_order_id : ''
  const paymentId = typeof body.razorpay_payment_id === 'string' ? body.razorpay_payment_id : ''
  const signature = typeof body.razorpay_signature === 'string' ? body.razorpay_signature : ''

  if (!orderId || !paymentId || !signature) {
    throw new Error('Missing payment details.')
  }

  if (!signatureValid(orderId, paymentId, signature)) {
    throw new Error('Payment verification failed.')
  }

  const order = await fetchOrder(orderId)

  // 'paid' is Razorpay's own word for "the money moved". A signature on
  // an order still 'created' or 'attempted' means someone replayed a
  // callback for a payment that never completed.
  if (order.status !== 'paid') {
    throw new Error(`Payment is not complete (status: ${order.status}).`)
  }

  return {
    orderId,
    paymentId,
    amountInr: order.amount / 100,
    notes: order.notes ?? {},
  }
}
