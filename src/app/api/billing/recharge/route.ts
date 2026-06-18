// src/app/api/billing/recharge/route.ts
//
// Wallet top-up endpoint for the "Buy More" credit purchase modal.
//
// MODES:
//  • Manual-fallback (DEFAULT, no keys): immediately credits the wallet
//    via the add_credits RPC and returns { mode: 'manual', newBalance }.
//    This lets you take "payments" / test the whole flow before Razorpay
//    is set up. (You can later restrict this to admins.)
//  • Razorpay (AUTO, when RAZORPAY_KEY_ID + RAZORPAY_KEY_SECRET are set):
//    creates a Razorpay order and returns { mode: 'razorpay', order, keyId }
//    for the client to open Razorpay Checkout. Actual crediting then
//    happens in /api/billing/verify after payment succeeds.
//
// Body: { amount: number, bonus?: number }
// Returns 401 if not signed in, 400 on bad amount, 200 otherwise.

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getOrgIdForUser } from '@/lib/billing/credits';

const MIN_RECHARGE = 100; // keep low for testing; raise for production

export async function POST(req: Request) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { amount?: number; bonus?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  const amount = Math.floor(Number(body.amount));
  const bonus = Math.max(0, Math.floor(Number(body.bonus) || 0));

  if (!Number.isFinite(amount) || amount < MIN_RECHARGE) {
    return NextResponse.json(
      { error: `Minimum recharge is ₹${MIN_RECHARGE}` },
      { status: 400 },
    );
  }

  const orgId = await getOrgIdForUser(supabase, user.id);
  if (!orgId) {
    return NextResponse.json({ error: 'No organization found' }, { status: 400 });
  }

  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  // ── RAZORPAY MODE ──────────────────────────────────────────────
  if (keyId && keySecret) {
    try {
      const auth = Buffer.from(`${keyId}:${keySecret}`).toString('base64');
      const res = await fetch('https://api.razorpay.com/v1/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Basic ${auth}`,
        },
        body: JSON.stringify({
          amount: amount * 100, // paise
          currency: 'INR',
          receipt: `cr_${orgId}_${Date.now()}`,
          notes: { org_id: orgId, user_id: user.id, bonus: String(bonus) },
        }),
      });
      const order = await res.json();
      if (!res.ok) {
        return NextResponse.json(
          { error: order?.error?.description || 'Razorpay order failed' },
          { status: 502 },
        );
      }
      return NextResponse.json({ mode: 'razorpay', order, keyId });
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : 'Razorpay error' },
        { status: 502 },
      );
    }
  }

  // ── MANUAL FALLBACK MODE ───────────────────────────────────────
  // No keys configured → credit the wallet directly so the flow works.
  const { data, error } = await supabase.rpc('add_credits', {
    p_org_id: orgId,
    p_user_id: user.id,
    p_amount: amount,
    p_bonus: bonus,
    p_type: 'recharge',
    p_description: `Manual recharge ₹${amount}${bonus ? ` (+₹${bonus} bonus)` : ''}`,
    p_reference: null,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ mode: 'manual', newBalance: Number(data) });
}
