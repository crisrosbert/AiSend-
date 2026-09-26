import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * POST /api/broadcasts/schedule
 *
 * Saves a broadcast with status='scheduled' and a scheduled_at timestamp.
 * The cron endpoint /api/cron/fire-scheduled-broadcasts picks it up at
 * the right time and fires the actual send.
 *
 * Body:
 *   id?          — existing draft id to convert (omit to create new)
 *   name         — broadcast name
 *   template     — full MessageTemplate object
 *   audience     — audience config
 *   variables    — variable mapping record
 *   agentType    — agent type or null
 *   agentId      — agent id or null
 *   scheduledAt  — ISO 8601 string for when to send (must be future)
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { id, name, template, audience, variables, agentType, agentId, scheduledAt } = body

    if (!name?.trim()) {
      return NextResponse.json({ error: 'name is required' }, { status: 400 })
    }
    if (!scheduledAt) {
      return NextResponse.json({ error: 'scheduledAt is required' }, { status: 400 })
    }

    const scheduledDate = new Date(scheduledAt)
    if (isNaN(scheduledDate.getTime())) {
      return NextResponse.json({ error: 'scheduledAt is not a valid date' }, { status: 400 })
    }
    if (scheduledDate < new Date(Date.now() + 60_000)) {
      return NextResponse.json(
        { error: 'scheduledAt must be at least 1 minute in the future' },
        { status: 400 },
      )
    }

    const payload = {
      user_id: user.id,
      name: name.trim(),
      template_name: template?.name ?? '',
      template_language: template?.language ?? 'en_US',
      template_variables: variables ?? {},
      audience_filter: {
        ...(audience ?? {}),
        _template: template ?? null,
        _current_step: 3,
      },
      agent_type: agentType ?? null,
      agent_id: agentType === 'ecommerce' ? null : (agentId ?? null),
      status: 'scheduled',
      scheduled_at: scheduledDate.toISOString(),
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
      // Convert existing draft → scheduled
      const { data: existing } = await supabase
        .from('broadcasts')
        .select('id, status')
        .eq('id', id)
        .eq('user_id', user.id)
        .single()

      if (!existing) {
        return NextResponse.json({ error: 'Broadcast not found' }, { status: 404 })
      }
      if (!['draft', 'scheduled'].includes(existing.status)) {
        return NextResponse.json(
          { error: 'Only draft or scheduled broadcasts can be rescheduled' },
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
      const { data, error } = await supabase
        .from('broadcasts')
        .insert(payload)
        .select('id')
        .single()
      if (error || !data) {
        return NextResponse.json(
          { error: error?.message ?? 'Failed to schedule broadcast' },
          { status: 500 },
        )
      }
      broadcastId = data.id
    }

    return NextResponse.json({
      success: true,
      id: broadcastId,
      scheduled_at: scheduledDate.toISOString(),
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
