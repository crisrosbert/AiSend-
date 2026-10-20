// POST { id, action: 'pause' | 'resume' | 'cancel' } — the user's kill switch.
// Runs as the user (row-level security), never with the service role.

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const id = typeof body?.id === 'string' ? body.id : ''
  const action = body?.action
  if (!id || !['pause', 'resume', 'cancel'].includes(action)) return NextResponse.json({ error: 'Invalid request' }, { status: 400 })

  const { data: c } = await supabase.from('campaign_agents').select('id, status').eq('id', id).eq('user_id', user.id).maybeSingle()
  if (!c) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
  if (['completed', 'cancelled', 'failed'].includes(c.status)) return NextResponse.json({ error: 'This campaign has finished.' }, { status: 400 })

  const { data: steps } = await supabase.from('campaign_steps').select('id, status, broadcast_id').eq('campaign_id', id)
  const live = (steps ?? []).filter((s) => s.status === 'sending' && s.broadcast_id)
  const now = new Date().toISOString()

  if (action === 'pause') {
    // 'draft' is ignored by the sweep, so sending stops at the next batch.
    for (const s of live) await supabase.from('broadcasts').update({ status: 'draft', updated_at: now }).eq('id', s.broadcast_id).eq('status', 'sending')
    await supabase.from('campaign_agents').update({ status: 'paused', error: null, updated_at: now }).eq('id', id)
  } else if (action === 'resume') {
    const back = new Date(Date.now() - 6 * 60_000).toISOString()
    for (const s of live) await supabase.from('broadcasts').update({ status: 'sending', updated_at: back }).eq('id', s.broadcast_id).eq('status', 'draft')
    await supabase.from('campaign_agents').update({ status: 'running', error: null, updated_at: now }).eq('id', id)
  } else {
    for (const s of live) {
      await supabase.from('broadcast_recipients').update({ status: 'failed', error_message: 'Campaign cancelled' }).eq('broadcast_id', s.broadcast_id).eq('status', 'pending')
      await supabase.from('broadcasts').update({ status: 'sent', updated_at: now }).eq('id', s.broadcast_id)
    }
    for (const s of (steps ?? []).filter((x) => !['done', 'failed', 'skipped'].includes(x.status))) {
      await supabase.from('campaign_steps').update({ status: 'skipped', error: 'Cancelled', completed_at: now, updated_at: now }).eq('id', s.id)
    }
    await supabase.from('campaign_agents').update({ status: 'cancelled', updated_at: now }).eq('id', id)
  }
  return NextResponse.json({ ok: true })
}
