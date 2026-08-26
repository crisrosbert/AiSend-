// src/app/api/billing/recharge/route.ts
//
// Wallet top-up. Creates a Razorpay order; the credit is added by
// /api/billing/verify once Razorpay confirms the payment.
//
// ── WHAT THIS FILE USED TO DO ────────────────────────────────────────
// It had a "manual fallback": when RAZORPAY_KEY_ID and
// RAZORPAY_KEY_SECRET were unset, it called add_credits directly and
// returned { mode: 'manual' }. The comment described it as a way to
// test the flow before the gateway was set up.
//
// In production that is not a test. It is an endpoint that hands out
// wallet credit — the thing every message is billed against — to anyone
// signed in, for free, on request. No payment, no record of one, and
// nothing in the response to suggest anything was missing. The balance
// simply went up.
//
// The subscribe route had the same shape and lost it for the same
// reason. This is the other half.
//
// If the gateway is not configured, a top-up cannot be sold. Say so.
// An admin who genuinely wants to grant credit can do it against the
// wallet directly, deliberately, with a record of who did it.
//
// ── WHY IT NO LONGER BUILDS ITS OWN ORDER ────────────────────────────
// It used to call Razorpay's API inline with its own fetch, its own
// paise conversion and its own notes. lib/billing/razorpay.ts already
// does all three, and /api/billing/verify reads the notes that library
// writes. Two writers and one reader is how the two halves of a payment
// stop agreeing about what was bought.
//
// Body: { amount: number, bonus?: number }

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getOrgIdForUser } from '@/lib/billing/credits';
import { createOrder, isRazorpayEnabled, razorpayKeys } from '@/lib/billing/razorpay';

/**
 * Low enough for a real customer to try the product, high enough that
 * the gateway fee is not most of the transaction.
 */
const MIN_RECHARGE = 100;

/**
 * A ceiling on a single top-up. Not a business rule — a typo guard. A
 * misplaced keypress turning ₹5,000 into ₹500,000 should fail here
 * rather than at a bank.
 */
const MAX_RECHARGE = 500_000;

export async function POST(req: Request) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { amount?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  const amount = Math.floor(Number(body.amount));

  if (!Number.isFinite(amount) || amount < MIN_RECHARGE) {
    return NextResponse.json(
      { error: `Minimum recharge is ₹${MIN_RECHARGE}` },
      { status: 400 },
    );
  }
  if (amount > MAX_RECHARGE) {
    return NextResponse.json(
      { error: `Maximum recharge is ₹${MAX_RECHARGE.toLocaleString('en-IN')}` },
      { status: 400 },
    );
  }

  const orgId = await getOrgIdForUser(supabase, user.id);
  if (!orgId) {
    return NextResponse.json({ error: 'No organization found' }, { status: 400 });
  }

  // Deliberately a refusal, not a grant. See the note at the top.
  if (!isRazorpayEnabled()) {
    console.error('[billing/recharge] top-up requested but Razorpay is not configured');
    return NextResponse.json(
      {
        error:
          'Card payments are not available right now. Please contact support to add credits.',
      },
      { status: 503 },
    );
  }

  try {
    const order = await createOrder({
      amountInr: amount,
      receipt: `cr_${orgId}_${Date.now()}`,
      // Read back by /api/billing/verify to confirm the payment belongs
      // to this org. The bonus is deliberately NOT carried here — verify
      // recomputes it from the amount Razorpay says was actually paid,
      // so a tampered request cannot buy ₹100 of credit and claim the
      // bonus for ₹50,000.
      notes: {
        kind: 'recharge',
        org_id: orgId,
        user_id: user.id,
      },
    });

    return NextResponse.json({
      mode: 'razorpay',
      order,
      // The publishable half of the pair. Safe in a browser — it is what
      // Razorpay Checkout is opened with. The secret never leaves here.
      keyId: razorpayKeys()!.keyId,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Could not start the payment';
    console.error('[billing/recharge] order failed:', message);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
