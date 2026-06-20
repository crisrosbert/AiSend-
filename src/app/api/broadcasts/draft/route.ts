import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * POST /api/broadcasts/draft
 *
 * Upserts a broadcast draft. Accepts the full wizard state so the
 * resume page can rehydrate every step exactly. Returns the broadcast
 * id so the client can keep the same draft across saves.
 *
 * Body:
 *   id?             — existing draft id to update (omit to create new)
 *   name            — broadcast name
 *   template        — full MessageTemplate object
 *   audience        — audience config (type + tagIds + customField + csvContacts + excludeTagIds)
 *   variables       — variable mapping record
 *   current_step    — which step the user is on (0-3)
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { id, name, template, audience, variables, current_step } = body

    if (!name?.trim()) {
      return NextResponse.json({ error: 'name is required' }, { status: 400 })
    }

    const payload = {
      user_id: user.id,
      name: name.trim(),
      template_name: template?.name ?? '',
      template_language: template?.language ?? 'en_US',
      // Store the full wizard state in audience_filter & template_variables
      // so the resume page can rehydrate completely.
      template_variables: variables ?? {},
      audience_filter: {
        ...(audience ?? {}),
        // Stash the full template object so step 1 can be rehydrated
        _template: template ?? null,
        _current_step: current_step ?? 0,
      },
      status: 'draft',
      total_recipients: 0,
      sent_count: 0,
      delivered_count: 0,
      read_count: 0,
      replied_count: 0,
      failed_count: 0,
      updated_at: new Date().toISOString(),
    }

    let broadcastId: string

    if (id) {
      // Update existing draft — verify ownership first
      const { data: existing } = await supabase
        .from('broadcasts')
        .select('id, status')
        .eq('id', id)
        .eq('user_id', user.id)
        .single()

      if (!existing) {
        return NextResponse.json({ error: 'Draft not found' }, { status: 404 })
      }
      if (existing.status !== 'draft') {
        return NextResponse.json(
          { error: 'Only draft broadcasts can be updated' },
          { status: 400 },
        )
      }

      const { error } = await supabase
        .from('broadcasts')
        .update(payload)
        .eq('id', id)
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
      broadcastId = id
    } else {
      // Create new draft
      const { data, error } = await supabase
        .from('broadcasts')
        .insert(payload)
        .select('id')
        .single()
      if (error || !data) {
        return NextResponse.json(
          { error: error?.message ?? 'Failed to create draft' },
          { status: 500 },
        )
      }
      broadcastId = data.id
    }

    return NextResponse.json({ id: broadcastId })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

/**
 * DELETE /api/broadcasts/draft?id=<broadcastId>
 * Deletes a draft broadcast. Guards against deleting non-draft rows.
 */
export async function DELETE(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 })
    }

    const { data: existing } = await supabase
      .from('broadcasts')
      .select('id, status')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (!existing) {
      return NextResponse.json({ error: 'Draft not found' }, { status: 404 })
    }
    if (existing.status !== 'draft') {
      return NextResponse.json(
        { error: 'Only drafts can be deleted via this endpoint' },
        { status: 400 },
      )
    }

    const { error } = await supabase.from('broadcasts').delete().eq('id', id)
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
