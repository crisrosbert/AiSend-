// src/app/api/billing/verify/route.ts
//
// Confirms a wallet top-up with Razorpay and credits it.
// Called by the purchase modal's Razorpay success handler.
//
// ── WHAT CHANGED AND WHY ─────────────────────────────────────────────
// This used to credit `body.amount` — a number sent by the browser.
// Razorpay's signature covers `order_id|payment_id` and nothing else,
// so every check still passed if you altered it: pay ₹100 for real,
// post the real order id, real payment id, real signature, and
// `amount: 100000`, and the wallet gained ₹1,00,000.
//
// The amount now comes from confirmPayment(), which reads it back from
// Razorpay. The body's amount is ignored entirely.
//
// Body: { razorpay_order_id, razorpay_payment_id, razorpay_signature }

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getOrgIdForUser } from '@/lib/billing/credits'
import { confirmPayment, isRazorpayEnabled } from '@/lib/billing/razorpay'
import { bonusForAmount } from '@/lib/billing/plans'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!isRazorpayEnabled()) {
    return NextResponse.json({ error: 'Payment gateway not configured' }, { status: 500 })
  }

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }

  let payment
  try {
    payment = await confirmPayment(body)
  } catch (err) {
    // Deliberately the same shape for "bad signature" and "not paid":
    // a caller probing the difference learns which half of a forged
    // callback they got right.
    console.warn('[billing/verify] rejected:', err instanceof Error ? err.message : err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Payment verification failed' },
      { status: 400 },
    )
  }

  const orgId = await getOrgIdForUser(supabase, user.id)
  if (!orgId) {
    return NextResponse.json({ error: 'No organization found' }, { status: 400 })
  }

  // ── The order must belong to this org ──
  //
  // Without this, any signed-in user could take another org's payment
  // details — from a shared screen, a support ticket, a browser history
  // — and credit their own wallet with someone else's money.
  const orderOrg = payment.notes.org_id
  if (orderOrg && orderOrg !== orgId) {
    console.warn(`[billing/verify] org mismatch: order ${orderOrg} vs caller ${orgId}`)
    return NextResponse.json({ error: 'This payment belongs to another account.' }, { status: 403 })
  }

  // ── Has this payment already been credited? ──
  //
  // Razorpay's handler fires again on a flaky connection, and a customer
  // can refresh mid-callback. Both replay the same payment id, and
  // without a guard each replay credits the wallet again.
  //
  // add_credits() stores what we pass as p_reference in
  // wallet_transactions.reference_id. Note that column is shared: manual
  // top-ups write a credit-pack id there ('pack_1000'), and the same
  // pack bought twice is perfectly normal. Only the 'pay_' form — a
  // Razorpay payment id — is unique, which is why migration 029's index
  // is partial rather than covering the whole column.
  //
  // Still wrapped in an error check: this runs against deployments that
  // may not have applied 029 yet, and refusing money that already left
  // the customer's account is worse than losing the guard.
  //
  // Best-effort on its own — two simultaneous callbacks could both read
  // "not found". The partial unique index is what actually closes that,
  // by making the second insert fail at the database.
  const { data: already, error: dupeErr } = await supabase
    .from('wallet_transactions')
    .select('id')
    .eq('org_id', orgId)
    .eq('reference_id', payment.paymentId)
    .maybeSingle()

  if (dupeErr) {
    console.warn(
      '[billing/verify] replay check unavailable, crediting anyway:',
      dupeErr.message,
    )
  } else if (already) {
    const { data: balance } = await supabase
      .from('organizations')
      .select('credit_balance')
      .eq('id', orgId)
      .maybeSingle()
    return NextResponse.json({
      newBalance: Number(balance?.credit_balance ?? 0),
      alreadyApplied: true,
    })
  }

  const amount = payment.amountInr

  // The bonus is recomputed from the paid amount rather than taken from
  // the browser, for the same reason as the amount itself.
  const bonus = bonusForAmount(amount)

  const { data, error } = await supabase.rpc('add_credits', {
    p_org_id: orgId,
    p_user_id: user.id,
    p_amount: amount,
    p_bonus: bonus,
    p_type: 'recharge',
    p_description: `Recharge ₹${amount}${bonus ? ` (+₹${bonus} bonus)` : ''}`,
    p_reference: payment.paymentId,
  })

  if (error) {
    console.error('[billing/verify] add_credits failed:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ newBalance: Number(data), credited: amount, bonus })
}
