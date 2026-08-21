// src/lib/billing/razorpay.test.ts
//
// The billing path had two faults worth remembering, because both
// passed every check that existed at the time.
//
//   1. /api/billing/subscribe had its payment branch written as an empty
//      `if` with a TODO inside. An empty if does not stop anything, so a
//      POST granted the plan outright and wrote a "paid" row for money
//      that never moved.
//
//   2. /api/billing/verify credited `body.amount` — a number from the
//      browser. Razorpay signs `order_id|payment_id` and nothing else,
//      so paying ₹100 for real and posting `amount: 100000` produced a
//      valid signature and a ₹1,00,000 credit.
//
// Both are the same mistake in different clothes: trusting the client
// about money. These pin the rules that replaced them.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { signatureValid, isTestMode, razorpayKeys, isRazorpayEnabled } from './razorpay'
import crypto from 'crypto'

const saved = { ...process.env }
const SECRET = 'test_secret_value'

beforeEach(() => {
  process.env.RAZORPAY_KEY_ID = 'rzp_test_ABC123'
  process.env.RAZORPAY_KEY_SECRET = SECRET
})

afterEach(() => {
  process.env = { ...saved }
  vi.restoreAllMocks()
})

/** What Razorpay's checkout would send back for a genuine payment. */
function realSignature(orderId: string, paymentId: string, secret = SECRET): string {
  return crypto.createHmac('sha256', secret).update(`${orderId}|${paymentId}`).digest('hex')
}

describe('signatureValid', () => {
  it('accepts a genuine signature', () => {
    const sig = realSignature('order_ABC', 'pay_XYZ')
    expect(signatureValid('order_ABC', 'pay_XYZ', sig)).toBe(true)
  })

  it('rejects a signature signed with the wrong secret', () => {
    // Someone with your key_id but not your key_secret.
    const sig = realSignature('order_ABC', 'pay_XYZ', 'not_the_secret')
    expect(signatureValid('order_ABC', 'pay_XYZ', sig)).toBe(false)
  })

  it('rejects a signature reused for a different order', () => {
    // Replaying yesterday's ₹100 payment against today's order.
    const sig = realSignature('order_OLD', 'pay_XYZ')
    expect(signatureValid('order_NEW', 'pay_XYZ', sig)).toBe(false)
  })

  it('rejects a signature reused for a different payment', () => {
    const sig = realSignature('order_ABC', 'pay_ONE')
    expect(signatureValid('order_ABC', 'pay_TWO', sig)).toBe(false)
  })

  it('rejects an empty or truncated signature without throwing', () => {
    // timingSafeEqual throws on a length mismatch, so the guard has to
    // come first — otherwise an empty string is a 500 rather than a 400,
    // and an attacker learns the difference.
    expect(() => signatureValid('order_ABC', 'pay_XYZ', '')).not.toThrow()
    expect(signatureValid('order_ABC', 'pay_XYZ', '')).toBe(false)
    expect(signatureValid('order_ABC', 'pay_XYZ', 'abc')).toBe(false)
  })

  it('rejects everything when no secret is configured', () => {
    // Fails closed. The alternative — treating "no gateway" as "no
    // checks" — is how a misconfigured deployment gives things away.
    delete process.env.RAZORPAY_KEY_SECRET
    const sig = realSignature('order_ABC', 'pay_XYZ')
    expect(signatureValid('order_ABC', 'pay_XYZ', sig)).toBe(false)
  })

  it('does not depend on the amount, which is why it cannot vouch for one', () => {
    // The heart of fault #2, stated as a test: the same signature is
    // valid no matter what amount a caller claims alongside it. Any
    // amount must therefore come from Razorpay, not the request.
    const sig = realSignature('order_ABC', 'pay_XYZ')
    expect(signatureValid('order_ABC', 'pay_XYZ', sig)).toBe(true)
    // Nothing about ₹100 or ₹100000 changes the result — there is no
    // amount parameter to change.
  })
})

describe('gateway configuration', () => {
  it('needs both keys before it is enabled', () => {
    expect(isRazorpayEnabled()).toBe(true)

    delete process.env.RAZORPAY_KEY_SECRET
    expect(isRazorpayEnabled()).toBe(false)

    process.env.RAZORPAY_KEY_SECRET = SECRET
    delete process.env.RAZORPAY_KEY_ID
    expect(isRazorpayEnabled()).toBe(false)
  })

  it('returns null keys rather than a half-filled object', () => {
    delete process.env.RAZORPAY_KEY_ID
    expect(razorpayKeys()).toBeNull()
  })

  it('knows it is in test mode', () => {
    // Surfaced in the UI so nobody demos with live money, or ships
    // believing test keys are live ones.
    expect(isTestMode()).toBe(true)

    process.env.RAZORPAY_KEY_ID = 'rzp_live_ABC123'
    expect(isTestMode()).toBe(false)
  })
})

// ── The conversion that eats companies ───────────────────────────────
//
// Razorpay works in paise. A missed ×100 charges a hundredth of the
// price; a doubled one charges a hundred times. Neither throws, and
// both look plausible in a log.

describe('rupees to paise', () => {
  const toPaise = (inr: number) => Math.round(inr * 100)

  it('converts whole rupees', () => {
    expect(toPaise(499)).toBe(49_900)
    expect(toPaise(4999)).toBe(499_900)
  })

  it('rounds rather than truncates on fractional rupees', () => {
    // A yearly price divided by 12 lands on things like 416.6666.
    // Math.floor would quietly undercharge every single time.
    expect(toPaise(416.666)).toBe(41_667)
    expect(toPaise(0.015)).toBe(2)
  })

  it('never produces a fractional paise', () => {
    for (const inr of [99.99, 1234.567, 0.001]) {
      expect(Number.isInteger(toPaise(inr))).toBe(true)
    }
  })
})
