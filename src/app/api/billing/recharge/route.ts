// src/app/api/billing/recharge/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCreditPack } from '@/lib/billing/plans';

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { pack_id } = await request.json();
    const pack = getCreditPack(pack_id);
    if (!pack) return NextResponse.json({ error: 'Invalid pack' }, { status: 400 });

    const { data: profile } = await supabase
      .from('profiles').select('org_id').eq('user_id', user.id).maybeSingle();
    if (!profile?.org_id) return NextResponse.json({ error: 'No organization' }, { status: 400 });

    const totalCredits = pack.amount + pack.bonus;

    // ── RAZORPAY HOOK ──
    const hasRazorpay = !!process.env.RAZORPAY_KEY_ID;
    if (hasRazorpay) {
      // TODO: create Razorpay order for pack.amount, return checkout_url.
      // Credits get added in the payment webhook after success.
    }

    // Manual mode — add credits immediately using the DB function
    const { data, error } = await supabase.rpc('add_credits', {
      p_org_id: profile.org_id,
      p_user_id: user.id,
      p_amount: totalCredits,
      p_type: 'recharge',
      p_description: `Wallet recharge ${pack.label}`,
      p_reference: pack.id,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ success: true, new_balance: data });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Server error' }, { status: 500 });
  }
}
