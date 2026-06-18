// src/app/api/billing/verify/route.ts
//
// Verifies a Razorpay payment signature, then credits the wallet via
// add_credits. Called by the purchase modal's Razorpay success handler.
//
// Only used in Razorpay mode (when keys are set). In manual-fallback mode
// the recharge route already credits directly, so this is never hit.
//
// Body: { razorpay_order_id, razorpay_payment_id, razorpay_signature,
//         amount, bonus }

import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { createClient } from '@/lib/supabase/server';
import { getOrgIdForUser } from '@/lib/billing/credits';

export async function POST(req: Request) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keySecret) {
    return NextResponse.json({ error: 'Payment gateway not configured' }, { status: 500 });
  }

  let body: {
    razorpay_order_id?: string;
    razorpay_payment_id?: string;
    razorpay_signature?: string;
    amount?: number;
    bonus?: number;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = body;
  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return NextResponse.json({ error: 'Missing payment fields' }, { status: 400 });
  }

  // Verify the signature: HMAC_SHA256(order_id|payment_id, key_secret)
  const expected = crypto
    .createHmac('sha256', keySecret)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest('hex');

  if (expected !== razorpay_signature) {
    return NextResponse.json({ error: 'Payment verification failed' }, { status: 400 });
  }

  const amount = Math.floor(Number(body.amount));
  const bonus = Math.max(0, Math.floor(Number(body.bonus) || 0));
  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: 'Invalid amount' }, { status: 400 });
  }

  const orgId = await getOrgIdForUser(supabase, user.id);
  if (!orgId) {
    return NextResponse.json({ error: 'No organization found' }, { status: 400 });
  }

  // Credit the wallet. reference_id = payment id for traceability.
  const { data, error } = await supabase.rpc('add_credits', {
    p_org_id: orgId,
    p_user_id: user.id,
    p_amount: amount,
    p_bonus: bonus,
    p_type: 'recharge',
    p_description: `Recharge ₹${amount}${bonus ? ` (+₹${bonus} bonus)` : ''}`,
    p_reference: razorpay_payment_id,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ newBalance: Number(data) });
}
