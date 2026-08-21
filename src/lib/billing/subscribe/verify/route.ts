// src/app/api/billing/subscribe/verify/route.ts
//
// Activates a plan, and is the only thing that can. /api/billing/subscribe
// creates an order; nothing there changes what the customer has. The plan
// moves only when Razorpay confirms the money arrived.
//
// ── WHY THE ORDER'S OWN NOTES ARE CHECKED ────────────────────────────
// A valid signature proves *a* payment happened. It does not say which
// plan it was for, or whose it was — none of that is signed.
//
// So the order carries notes written when it was created, and they are
// read back from Razorpay here. Without that check, the ₹499 plan's
// payment details could be posted against a request to activate the
// ₹4,999 plan and every signature check would still pass.
//
// Body: { razorpay_order_id, razorpay_payment_id, razorpay_signature }

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getPlan } from '@/lib/billing/plans'
import { confirmPayment, isRazorpayEnabled } from '@/lib/billing/razorpay'

export const dynamic = 'force-dynamic'

/** Renewal date for a cycle, from the moment the payment cleared. */
function periodEnd(from: Date, cycle: string): Date {
  const end = new Date(from)
  if (cycle === 'yearly') end.setFullYear(end.getFullYear() + 1)
  else end.setMonth(end.getMonth() + 1)
  return end
}

export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!isRazorpayEnabled()) {
      return NextResponse.json({ error: 'Payment gateway not configured' }, { status: 500 })
    }

    const body = await req.json().catch(() => ({}))

    let payment
    try {
      payment = await confirmPayment(body)
    } catch (err) {
      console.warn('[subscribe/verify] rejected:', err instanceof Error ? err.message : err)
      return NextResponse.json(
        { error: err instanceof Error ? err.message : 'Payment verification failed' },
        { status: 400 },
      )
    }

    const notes = payment.notes

    // ── This must be a subscription payment ──
    //
    // A wallet top-up is also a real, correctly signed Razorpay payment.
    // Without this, ₹100 of credits could be posted here and activate a
    // ₹4,999 plan.
    if (notes.kind !== 'subscription') {
      return NextResponse.json(
        { error: 'This payment was not for a subscription.' },
        { status: 400 },
      )
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('org_id')
      .eq('user_id', user.id)
      .maybeSingle()

    if (!profile?.org_id) {
      return NextResponse.json({ error: 'No organization' }, { status: 400 })
    }

    // ── And it must be this org's payment ──
    if (notes.org_id !== profile.org_id) {
      console.warn(
        `[subscribe/verify] org mismatch: order ${notes.org_id} vs caller ${profile.org_id}`,
      )
      return NextResponse.json(
        { error: 'This payment belongs to another account.' },
        { status: 403 },
      )
    }

    // ── The plan comes from the ORDER, not the request ──
    const plan = getPlan(notes.plan_id)
    if (!plan || plan.id !== notes.plan_id) {
      return NextResponse.json({ error: 'Unknown plan on this payment.' }, { status: 400 })
    }

    const cycle = notes.cycle === 'yearly' ? 'yearly' : 'monthly'
    const expected = cycle === 'yearly' ? plan.priceYearly : plan.priceMonthly

    // ── And the amount paid must match that plan's price ──
    //
    // Belt and braces: the order was created from the same table, so
    // this should never fire. If it does, either the price changed
    // between order and payment, or something is being replayed —
    // both are worth refusing rather than guessing at.
    if (payment.amountInr !== expected) {
      console.error(
        `[subscribe/verify] amount mismatch: paid ₹${payment.amountInr}, ` +
          `${plan.id}/${cycle} costs ₹${expected}`,
      )
      return NextResponse.json(
        { error: 'The amount paid does not match this plan. Please contact support.' },
        { status: 400 },
      )
    }

    // ── Already applied? ──
    //
    // A refresh or a retried callback replays the same payment id. The
    // plan change is idempotent on its own, but the payment row is not:
    // without this, one payment appears twice in the revenue table.
    const { data: existing, error: dupeErr } = await supabase
      .from('subscription_payments')
      .select('id')
      .eq('gateway_payment_id', payment.paymentId)
      .maybeSingle()

    if (dupeErr) {
      // Column may predate this route. Log and carry on rather than
      // refuse a payment the customer has already made.
      console.warn('[subscribe/verify] replay check unavailable:', dupeErr.message)
    } else if (existing) {
      return NextResponse.json({ success: true, plan: plan.id, alreadyApplied: true })
    }

    const start = new Date()
    const end = periodEnd(start, cycle)

    const { error: orgErr } = await supabase
      .from('organizations')
      .update({
        plan_id: plan.id,
        plan_status: 'active',
        plan_renews_at: end.toISOString(),
      })
      .eq('id', profile.org_id)

    if (orgErr) {
      // The money is taken but the plan did not change. Loud, because
      // this is the case that needs a human today, not in the morning.
      console.error(
        `[subscribe/verify] PAID BUT NOT ACTIVATED — payment ${payment.paymentId}, ` +
          `org ${profile.org_id}, plan ${plan.id}: ${orgErr.message}`,
      )
      return NextResponse.json(
        {
          error:
            'Your payment succeeded but the plan could not be activated. ' +
            'Contact support with this reference: ' + payment.paymentId,
        },
        { status: 500 },
      )
    }

    // Recorded after activation, so a failure here leaves the customer
    // with what they paid for and us with a reconciliation job — rather
    // than the reverse.
    const { error: payErr } = await supabase.from('subscription_payments').insert({
      org_id: profile.org_id,
      user_id: user.id,
      plan_id: plan.id,
      amount: payment.amountInr,
      currency: 'INR',
      status: 'paid',
      gateway: 'razorpay',
      gateway_payment_id: payment.paymentId,
      gateway_order_id: payment.orderId,
      period_start: start.toISOString(),
      period_end: end.toISOString(),
    })

    if (payErr) {
      console.error('[subscribe/verify] payment row not written:', payErr.message)
    }

    return NextResponse.json({
      success: true,
      plan: plan.id,
      cycle,
      renewsAt: end.toISOString(),
    })
  } catch (err) {
    console.error('[subscribe/verify] failed:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Server error' },
      { status: 500 },
    )
  }
}
