// src/app/api/lead-sources/[id]/route.ts
//
// Revoke (delete) or toggle one lead source. RLS already scopes every
// query to auth.uid() = user_id, so a stranger's id simply matches zero
// rows — there's nothing extra to check here.

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { decrypt } from '@/lib/whatsapp/encryption'
import { unsubscribePage } from '@/lib/meta/leadgen-oauth'

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => null)
  if (typeof body?.is_active !== 'boolean') {
    return NextResponse.json({ error: 'is_active (boolean) is required' }, { status: 400 })
  }

  const { error } = await supabase.from('lead_sources').update({ is_active: body.is_active }).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // A disconnected Facebook Page must also stop sending us its leads.
  // Deleting only our row would leave Meta still firing webhooks for a
  // Page the merchant believes they've disconnected. Best-effort: a
  // revoked token or already-removed Page must not block the delete.
  const { data: row } = await supabase
    .from('lead_sources')
    .select('source_type, meta_page_id, meta_page_access_token')
    .eq('id', id)
    .maybeSingle()

  if (row?.source_type === 'meta_leadgen' && row.meta_page_id && row.meta_page_access_token) {
    try {
      await unsubscribePage(row.meta_page_id, decrypt(row.meta_page_access_token))
    } catch (err) {
      console.warn(`[lead-sources] unsubscribe failed for page ${row.meta_page_id}:`, err)
    }
  }

  const { error } = await supabase.from('lead_sources').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
