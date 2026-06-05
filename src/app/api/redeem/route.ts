// src/app/api/billing/redeem/route.ts
//
// Redeem an offer/access code → credits the wallet via redeem_promo_code
// RPC (which reuses add_credits). One redemption per org, enforced in SQL.
//
// Body: { code: string }

import { NextResponse } from 'next/server';
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

  let body: { code?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  const code = (body.code ?? '').trim();
  if (!code) {
    return NextResponse.json({ error: 'Enter a code' }, { status: 400 });
  }

  const orgId = await getOrgIdForUser(supabase, user.id);
  if (!orgId) {
    return NextResponse.json({ error: 'No organization found' }, { status: 400 });
  }

  const { data, error } = await supabase.rpc('redeem_promo_code', {
    p_org_id: orgId,
    p_user_id: user.id,
    p_code: code,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // RPC returns { ok, error?, credited?, newBalance? }
  const result = data as {
    ok: boolean;
    error?: string;
    credited?: number;
    newBalance?: number;
  };

  if (!result.ok) {
    return NextResponse.json({ error: result.error ?? 'Could not redeem code' }, { status: 400 });
  }

  return NextResponse.json({
    credited: result.credited ?? 0,
    newBalance: result.newBalance ?? 0,
  });
}
