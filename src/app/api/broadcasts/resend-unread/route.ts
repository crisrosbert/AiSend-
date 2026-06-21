import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * POST /api/broadcasts/resend-unread
 * Body: { broadcast_id: string }
 *
 * Creates a NEW broadcast that targets only the recipients of the
 * original who received the message but did NOT read it
 * (status = 'sent' or 'delivered'). Returns the new broadcast id so
 * the client can open it and run the send via the existing pipeline.
 *
 * The new broadcast is created as a 'draft' with a pre-filled
 * recipient set; the client send hook picks it up.
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { broadcast_id } = body as { broadcast_id?: string }
    if (!broadcast_id) {
      return NextResponse.json({ error: 'broadcast_id is required' }, { status: 400 })
    }

    // 1. Load the original broadcast (verify ownership)
    const { data: original, error: origErr } = await supabase
      .from('broadcasts')
      .select('*')
      .eq('id', broadcast_id)
      .eq('user_id', user.id)
      .single()

    if (origErr || !original) {
      return NextResponse.json({ error: 'Broadcast not found' }, { status: 404 })
    }

    // 2. Find recipients who received but did NOT read
    //    (status 'sent' or 'delivered'). Exclude read/replied/failed/pending.
    const { data: unreadRecipients, error: recErr } = await supabase
      .from('broadcast_recipients')
      .select('contact_id')
      .eq('broadcast_id', broadcast_id)
      .in('status', ['sent', 'delivered'])
      .not('contact_id', 'is', null)

    if (recErr) {
      return NextResponse.json({ error: recErr.message }, { status: 500 })
    }

    const contactIds = [...new Set(
      (unreadRecipients ?? [])
        .map((r) => r.contact_id)
        .filter((id): id is string => Boolean(id)),
    )]

    if (contactIds.length === 0) {
      return NextResponse.json(
        { error: 'No unread recipients — everyone already read this broadcast.' },
        { status: 400 },
      )
    }

    // 3. Filter out any contacts who have since opted out
    const { data: activeContacts, error: contactErr } = await supabase
      .from('contacts')
      .select('id')
      .in('id', contactIds)
      .is('opted_out_at', null)

    if (contactErr) {
      return NextResponse.json({ error: contactErr.message }, { status: 500 })
    }

    const finalContactIds = (activeContacts ?? []).map((c) => c.id)
    if (finalContactIds.length === 0) {
      return NextResponse.json(
        { error: 'All unread recipients have opted out. Nothing to resend.' },
        { status: 400 },
      )
    }

    // 4. Create the new broadcast row (draft, status sending happens on send)
    const { data: newBroadcast, error: createErr } = await supabase
      .from('broadcasts')
      .insert({
        user_id: user.id,
        name: `${original.name} (Resend to unread)`,
        template_name: original.template_name,
        template_language: original.template_language,
        template_variables: original.template_variables,
        audience_filter: {
          type: 'resend_unread',
          source_broadcast_id: broadcast_id,
        },
        status: 'sending',
        total_recipients: finalContactIds.length,
        sent_count: 0,
        delivered_count: 0,
        read_count: 0,
        replied_count: 0,
        failed_count: 0,
      })
      .select()
      .single()

    if (createErr || !newBroadcast) {
      return NextResponse.json(
        { error: createErr?.message ?? 'Failed to create resend broadcast' },
        { status: 500 },
      )
    }

    // 5. Insert recipient rows for the new broadcast
    const recipientRows = finalContactIds.map((cid) => ({
      broadcast_id: newBroadcast.id,
      contact_id: cid,
      status: 'pending' as const,
    }))

    const INSERT_CHUNK = 200
    for (let i = 0; i < recipientRows.length; i += INSERT_CHUNK) {
      const chunk = recipientRows.slice(i, i + INSERT_CHUNK)
      const { error: insErr } = await supabase
        .from('broadcast_recipients')
        .insert(chunk)
      if (insErr) {
        return NextResponse.json({ error: insErr.message }, { status: 500 })
      }
    }

    return NextResponse.json({
      id: newBroadcast.id,
      recipients: finalContactIds.length,
      skipped_opted_out: contactIds.length - finalContactIds.length,
    })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
