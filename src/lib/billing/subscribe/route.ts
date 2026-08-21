// src/app/api/billing/subscribe/route.ts
//
// Starts a plan change. Free plans apply immediately; paid plans get a
// Razorpay order that the browser opens in Checkout, and the plan is
// activated only by /api/billing/subscribe/verify once the money lands.
//
// ── WHAT THIS REPLACES ───────────────────────────────────────────────
// The route had the payment branch written as a comment:
//
//     if (price > 0 && hasRazorpay) {
//       // TODO: create Razorpay order, return checkout_url
//     }
//     // ...falls straight through...
//     .update({ plan_id, plan_status: 'active' })
//     .insert({ status: 'paid', gateway: 'manual' })
//
// An empty `if` does not stop anything. So a POST here granted the plan
// outright — Enterprise included — and wrote a `subscription_payments`
// row saying it was paid. The books recorded revenue that never existed,
// which is worse than the free plan itself: it is wrong in a way you
// would not notice until you reconciled against the bank.
//
// Body:    { plan_id, cycle: 'monthly' | 'yearly' }
// Returns: { mode: 'applied' }                       — free plan, done
//          { mode: 'razorpay', order, keyId, ... }   — open Checkout

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getPlan } from '@/lib/billing/plans'
import { createOrder, isRazorpayEnabled, isTestMode } from '@/lib/billing/razorpay'

export const dynamic = 'force-dynamic'

/**
 * Downgrading to free, or re-selecting the plan you already have, needs
 * no money to change hands.
 */
function isFree(price: number): boolean {
  return price <= 0
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authErr } = await supabase.auth.getUser()
    if (authErr || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const planId = typeof body?.plan_id === 'string' ? body.plan_id : ''
    const cycle = body?.cycle === 'yearly' ? 'yearly' : 'monthly'

    const plan = getPlan(planId)
    if (!plan || plan.id !== planId) {
      return NextResponse.json({ error: 'Invalid plan' }, { status: 400 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('org_id')
      .eq('user_id', user.id)
      .maybeSingle()

    if (!profile?.org_id) {
      return NextResponse.json({ error: 'No organization' }, { status: 400 })
    }

    // Read from the plan table, never from the request. A price sent by
    // the browser is a price chosen by the customer.
    const price = cycle === 'yearly' ? plan.priceYearly : plan.priceMonthly

    /* ── Free plan: nothing to charge ──────────────────────────────── */
    if (isFree(price)) {
      const { error } = await supabase
        .from('organizations')
        .update({
          plan_id: plan.id,
          plan_status: 'active',
          plan_renews_at: null,
        })
        .eq('id', profile.org_id)

      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ mode: 'applied', plan: plan.id })
    }

    /* ── Paid plan: it has to be paid for ──────────────────────────── */
    if (!isRazorpayEnabled()) {
      // Deliberately a refusal rather than the old silent grant.
      //
      // "Apply it anyway so the flow can be tested" is exactly how the
      // previous version behaved in production, where it was not a test.
      // If the gateway is not configured, a paid plan cannot be sold —
      // say so, and let an admin set it manually if they mean to.
      console.error('[billing/subscribe] paid plan requested but Razorpay is not configured')
      return NextResponse.json(
        {
          error:
            'Card payments are not available right now. Please contact support to activate this plan.',
        },
        { status: 503 },
      )
    }

    const order = await createOrder({
      amountInr: price,
      receipt: `sub_${plan.id}_${Date.now()}`,
      // Read back by subscribe/verify to confirm this payment is for
      // this org and this plan — so a cheap plan's payment cannot be
      // replayed to activate an expensive one.
      notes: {
        kind: 'subscription',
        org_id: profile.org_id,
        user_id: user.id,
        plan_id: plan.id,
        cycle,
      },
    })

    return NextResponse.json({
      mode: 'razorpay',
      order,
      keyId: process.env.RAZORPAY_KEY_ID,
      testMode: isTestMode(),
      plan: { id: plan.id, name: plan.name, price, cycle },
    })
  } catch (err) {
    console.error('[billing/subscribe] failed:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Server error' },
      { status: 500 },
    )
  }
}
