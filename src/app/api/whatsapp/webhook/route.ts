export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const mode = searchParams.get('hub.mode')
  const challenge = searchParams.get('hub.challenge')
  const verifyToken = searchParams.get('hub.verify_token')
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * POST /api/contacts/opt-out
 * Body: { contact_id: string, action: 'opt_in' | 'opt_out' }
 *
 * Lets agents manually toggle a contact's opt-out status from the UI.
 * The webhook handles automatic opt-outs; this endpoint handles the
 * "re-subscribe" case and manual overrides.
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { contact_id, action } = body

    if (!contact_id) {
      return NextResponse.json({ error: 'contact_id is required' }, { status: 400 })
    }
    if (action !== 'opt_in' && action !== 'opt_out') {
      return NextResponse.json({ error: 'action must be opt_in or opt_out' }, { status: 400 })
    }

    // Verify contact belongs to this user
    const { data: contact, error: fetchErr } = await supabase
      .from('contacts')
      .select('id, opted_out_at')
      .eq('id', contact_id)
      .eq('user_id', user.id)
      .single()

    if (fetchErr || !contact) {
      return NextResponse.json({ error: 'Contact not found' }, { status: 404 })
    }

    if (action === 'opt_out') {
      const { error } = await supabase
        .from('contacts')
        .update({
          opted_out_at: new Date().toISOString(),
          opt_out_keyword: 'MANUAL',
          updated_at: new Date().toISOString(),
        })
        .eq('id', contact_id)
        .eq('user_id', user.id)

      if (error) return NextResponse.json({ error: error.message }, { status: 500 })

      // Audit log
      await supabase.from('opt_out_log').insert({
        user_id: user.id,
        contact_id,
        action: 'opt_out',
        keyword: 'MANUAL',
        source: 'manual',
        actor_id: user.id,
      })
    } else {
      // opt_in — clear the opt-out flag
      const { error } = await supabase
        .from('contacts')
        .update({
          opted_out_at: null,
          opt_out_keyword: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', contact_id)
        .eq('user_id', user.id)

      if (error) return NextResponse.json({ error: error.message }, { status: 500 })

      // Audit log
      await supabase.from('opt_out_log').insert({
        user_id: user.id,
        contact_id,
        action: 'opt_in',
        keyword: null,
        source: 'manual',
        actor_id: user.id,
      })
    }

    return NextResponse.json({ success: true, action })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

/**
 * GET /api/contacts/opt-out?contact_id=<id>
 * Returns the opt-out log for a specific contact.
 */
export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const contact_id = searchParams.get('contact_id')
    if (!contact_id) {
      return NextResponse.json({ error: 'contact_id is required' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('opt_out_log')
      .select('*')
      .eq('contact_id', contact_id)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ log: data ?? [] })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
