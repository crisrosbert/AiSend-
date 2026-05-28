// src/app/api/billing/subscribe/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getPlan } from '@/lib/billing/plans';

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { plan_id, cycle } = await request.json();
    const plan = getPlan(plan_id);
    if (!plan) return NextResponse.json({ error: 'Invalid plan' }, { status: 400 });

    // Find the user's org
    const { data: profile } = await supabase
      .from('profiles').select('org_id').eq('user_id', user.id).maybeSingle();
    if (!profile?.org_id) return NextResponse.json({ error: 'No organization' }, { status: 400 });

    const price = cycle === 'yearly' ? plan.priceYearly : plan.priceMonthly;

    // ── RAZORPAY HOOK ──
    // When you add RAZORPAY_KEY_ID + RAZORPAY_KEY_SECRET env vars, create a
    // Razorpay order here and return checkout_url. For now (no keys), we
    // apply the plan directly in "manual" mode.
    const hasRazorpay = !!process.env.RAZORPAY_KEY_ID;

    if (price > 0 && hasRazorpay) {
      // TODO: create Razorpay order, return checkout_url
      // const order = await createRazorpayOrder(price, profile.org_id, plan_id);
      // return NextResponse.json({ checkout_url: `/billing/checkout?order=${order.id}` });
    }

    // Manual mode — apply plan immediately and log the payment
    const periodStart = new Date();
    const periodEnd = new Date();
    if (cycle === 'yearly') periodEnd.setFullYear(periodEnd.getFullYear() + 1);
    else periodEnd.setMonth(periodEnd.getMonth() + 1);

    const { error: orgErr } = await supabase
      .from('organizations')
      .update({
        plan_id: plan.id,
        plan_status: 'active',
        plan_renews_at: price > 0 ? periodEnd.toISOString() : null,
      })
      .eq('id', profile.org_id);
    if (orgErr) return NextResponse.json({ error: orgErr.message }, { status: 500 });

    if (price > 0) {
      await supabase.from('subscription_payments').insert({
        org_id: profile.org_id,
        user_id: user.id,
        plan_id: plan.id,
        amount: price,
        currency: 'INR',
        status: 'paid',
        gateway: 'manual',
        period_start: periodStart.toISOString(),
        period_end: periodEnd.toISOString(),
      });
    }

    return NextResponse.json({ success: true, plan: plan.id });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Server error' }, { status: 500 });
  }
}
