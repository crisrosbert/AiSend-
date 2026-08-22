// src/app/api/businesses/route.ts
//
// Creating, renaming and removing a business.
//
// ── WHY THIS IS A ROUTE AND NOT A CLIENT SUPABASE CALL ───────────────
// Everything else in this app writes through the browser client and
// leans on RLS. This one does not, for two reasons.
//
// The default-business flag has an invariant — exactly one per owner —
// that a client cannot hold. Two tabs, or one impatient double click,
// and you get either two defaults or none, and every "which business
// is this?" answer after that is a coin flip.
//
// And deletion here cascades. business_id is declared ON DELETE CASCADE
// across twenty-eight tables, so removing a business removes its
// agents, contacts, conversations and message history with it. That is
// the correct behaviour and far too much to hang off a client call that
// only checked whether a row existed.

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { listBusinesses } from '@/lib/business/server'

/** Names are shown in a switcher, so they stay short and non-empty. */
function cleanName(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const trimmed = raw.trim().replace(/\s+/g, ' ').slice(0, 60)
  return trimmed || null
}

/** Everything this user owns, default first. */
export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  return NextResponse.json({ businesses: await listBusinesses(supabase, user.id) })
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => null)
  const name = cleanName(body?.name)
  if (!name) {
    return NextResponse.json({ error: 'A business name is required' }, { status: 400 })
  }

  const owned = await listBusinesses(supabase, user.id)

  // A soft cap, not a plan limit. Nobody legitimately runs twenty
  // businesses from one login, and without a ceiling a scripted loop
  // can fill the switcher — and the cascade behind it — for free.
  if (owned.length >= 20) {
    return NextResponse.json(
      { error: 'You have reached the maximum of 20 businesses' },
      { status: 400 },
    )
  }

  if (owned.some((b) => b.name.toLowerCase() === name.toLowerCase())) {
    return NextResponse.json(
      { error: 'You already have a business with that name' },
      { status: 409 },
    )
  }

  // Only the first one is the default. The partial unique index in
  // migration 030 enforces this too — this check just produces a
  // sensible message instead of a constraint violation.
  const { data: profile } = await supabase
    .from('profiles')
    .select('org_id')
    .eq('user_id', user.id)
    .maybeSingle()

  const { data, error } = await supabase
    .from('businesses')
    .insert({
      owner_user_id: user.id,
      account_id: profile?.org_id ?? null,
      name,
      is_default: owned.length === 0,
    })
    .select('id, name, is_default')
    .single()

  if (error) {
    console.error('[businesses] create failed:', error.code, error.message)

    // A generic "could not create" sent someone hunting through Vercel
    // logs for a one-line cause. These are the two failures that
    // actually happen, and both have a specific thing to go and do —
    // so they say so instead.
    if (error.code === '42501' || /row-level security/i.test(error.message)) {
      return NextResponse.json(
        {
          error:
            'The database is refusing the write. Run migration 033 — the ' +
            'businesses table has no row-level security policy.',
        },
        { status: 500 },
      )
    }
    if (error.code === '42P01') {
      return NextResponse.json(
        { error: 'The businesses table does not exist. Run migration 030 first.' },
        { status: 500 },
      )
    }

    return NextResponse.json(
      { error: `Could not create the business: ${error.message}` },
      { status: 500 },
    )
  }

  return NextResponse.json({ business: data }, { status: 201 })
}

export async function PATCH(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => null)
  const id = typeof body?.id === 'string' ? body.id : null
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

  const owned = await listBusinesses(supabase, user.id)
  const target = owned.find((b) => b.id === id)
  // Deliberately the same message as a genuinely missing row: telling a
  // caller "that business is not yours" confirms the id exists.
  if (!target) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // ── Renaming ──
  if (body.name !== undefined) {
    const name = cleanName(body.name)
    if (!name) {
      return NextResponse.json({ error: 'A business name is required' }, { status: 400 })
    }
    if (owned.some((b) => b.id !== id && b.name.toLowerCase() === name.toLowerCase())) {
      return NextResponse.json(
        { error: 'You already have a business with that name' },
        { status: 409 },
      )
    }
    const { error } = await supabase
      .from('businesses')
      .update({ name, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('owner_user_id', user.id)
    if (error) {
      return NextResponse.json({ error: 'Could not rename' }, { status: 500 })
    }
  }

  // ── Changing which one is default ──
  //
  // Two writes that must not half-apply: clear the old default, set the
  // new one. Done in this order because the unique index allows zero
  // defaults but not two — so the intermediate state is legal, and a
  // failure between them leaves the account with no default rather than
  // an ambiguous one. resolveBusiness() falls back to the first owned
  // business in that case, which is a wrong-ish answer rather than a
  // broken app.
  if (body.is_default === true && !target.is_default) {
    const { error: clearErr } = await supabase
      .from('businesses')
      .update({ is_default: false })
      .eq('owner_user_id', user.id)
      .eq('is_default', true)
    if (clearErr) {
      return NextResponse.json({ error: 'Could not change the default' }, { status: 500 })
    }

    const { error: setErr } = await supabase
      .from('businesses')
      .update({ is_default: true, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('owner_user_id', user.id)
    if (setErr) {
      console.error('[businesses] left the account with no default:', setErr.message)
      return NextResponse.json({ error: 'Could not change the default' }, { status: 500 })
    }
  }

  const refreshed = await listBusinesses(supabase, user.id)
  return NextResponse.json({ businesses: refreshed })
}

export async function DELETE(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

  const owned = await listBusinesses(supabase, user.id)
  const target = owned.find((b) => b.id === id)
  if (!target) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Refusing to delete the last one is not tidiness. Every read path
  // treats "no business" as "still loading", so an account with none
  // renders empty screens with no explanation and no way back.
  if (owned.length === 1) {
    return NextResponse.json(
      { error: 'You cannot delete your only business' },
      { status: 400 },
    )
  }

  // ── The confirmation ──
  //
  // The cascade takes every agent, contact, conversation and message
  // that belongs to this business. That is not something to do because
  // a DELETE arrived, so the caller has to name what it is deleting.
  // Typing the name is the only step here that is genuinely about the
  // person being sure.
  const { searchParams: sp } = new URL(request.url)
  const confirm = sp.get('confirm')
  if (confirm !== target.name) {
    return NextResponse.json(
      { error: 'Type the business name exactly to confirm' },
      { status: 400 },
    )
  }

  const { error } = await supabase
    .from('businesses')
    .delete()
    .eq('id', id)
    .eq('owner_user_id', user.id)

  if (error) {
    console.error('[businesses] delete failed:', error.message)
    return NextResponse.json({ error: 'Could not delete the business' }, { status: 500 })
  }

  // If the default went with it, promote another — otherwise the next
  // request resolves to owned[0] by accident rather than by choice.
  const remaining = await listBusinesses(supabase, user.id)
  if (remaining.length > 0 && !remaining.some((b) => b.is_default)) {
    await supabase
      .from('businesses')
      .update({ is_default: true })
      .eq('id', remaining[0].id)
      .eq('owner_user_id', user.id)
  }

  return NextResponse.json({ businesses: await listBusinesses(supabase, user.id) })
}
