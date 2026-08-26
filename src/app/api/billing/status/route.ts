// src/app/api/billing/status/route.ts
//
// Is the payment gateway actually configured, in the deployment that is
// running right now?
//
// ── WHY THIS EXISTS ──────────────────────────────────────────────────
// "Card payments are not available right now" is a correct and
// deliberate refusal: the routes will not sell a plan or a top-up
// without RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET. But from the outside
// it looks identical whether the variables were never set, were set
// with a typo, were set on the wrong environment, or were set correctly
// and the deployment simply has not been rebuilt since — and Vercel
// does not apply environment changes to a deployment that already
// exists, which makes that last one by far the most common.
//
// Four different problems, one message, no way to tell them apart. This
// answers the question directly.
//
// ── WHAT IT DELIBERATELY DOES NOT RETURN ─────────────────────────────
// No key values, not even partial ones. Whether a secret is present is
// something an owner needs to know; what the secret is, they can read
// from Razorpay. A "first six characters" convenience here would be a
// credential-shaped thing in a URL people paste into chats.
//
// The key ID's prefix is the one exception — `rzp_test_` versus
// `rzp_live_` decides whether a demo spends real money, and it is
// already sent to every browser that opens Checkout.

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isRazorpayEnabled, isTestMode } from '@/lib/billing/razorpay'

export const dynamic = 'force-dynamic'

export async function GET() {
  // Signed in only. The answer is not secret, but it describes the
  // deployment's configuration and there is no reason to hand that to
  // anyone who asks.
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const hasKeyId = !!process.env.RAZORPAY_KEY_ID
  const hasKeySecret = !!process.env.RAZORPAY_KEY_SECRET
  const enabled = isRazorpayEnabled()

  return NextResponse.json({
    enabled,
    hasKeyId,
    hasKeySecret,
    mode: !enabled ? 'unconfigured' : isTestMode() ? 'test' : 'live',

    // Says what to do, so the answer does not need interpreting.
    diagnosis: !hasKeyId && !hasKeySecret
      ? 'Neither variable is visible to this deployment. If you have already added them in Vercel, redeploy — environment changes do not apply to a deployment that already exists.'
      : !hasKeyId
        ? 'RAZORPAY_KEY_SECRET is set but RAZORPAY_KEY_ID is not. Check the key name for a typo.'
        : !hasKeySecret
          ? 'RAZORPAY_KEY_ID is set but RAZORPAY_KEY_SECRET is not. Check the key name for a typo.'
          : isTestMode()
            ? 'Configured with TEST keys. Payments will not charge real money.'
            : 'Configured with LIVE keys. Payments will charge real money.',
  })
}
