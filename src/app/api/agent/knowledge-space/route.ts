// src/app/api/agent/knowledge-space/route.ts
//
// POST { agent_id } -> { journey_id }
//
// Gives an agent its OWN knowledge space (a journey) if it has none yet, and
// returns its id. Safe to call twice: an agent that already has one just gets
// it back.
//
// Why: knowledge is scoped by agents.journey_id, and an agent used to get its
// journey only when "Train from your website" ran. The Brain button on an
// untrained agent opened the Chat Flows list, so owners typed FAQs into some
// other journey and the agent answered "I don't have that information".
//
// Same journey shape as api/agent/train-from-url (name "<agent> knowledge",
// status draft, no nodes). The agent must belong to the signed-in user.

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authErr } = await supabase.auth.getUser()
    if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json().catch(() => ({}))
    const agentId: unknown = body?.agent_id
    if (typeof agentId !== 'string' || !agentId) {
      return NextResponse.json({ error: 'agent_id is required' }, { status: 400 })
    }

    const { data: agent, error: agentErr } = await supabase
      .from('agents')
      .select('id, name, journey_id, business_id')
      .eq('id', agentId)
      .eq('tenant_id', user.id)
      .maybeSingle()
    if (agentErr || !agent) return NextResponse.json({ error: 'Agent not found' }, { status: 404 })

    if (agent.journey_id) {
      return NextResponse.json({ journey_id: agent.journey_id, created: false })
    }

    const { data: journey, error: journeyErr } = await supabase
      .from('journeys')
      .insert({
        user_id: user.id,
        business_id: agent.business_id ?? null,
        name: `${agent.name || 'Agent'} knowledge`,
        status: 'draft',
        trigger: { type: 'keyword', keywords: [] },
        nodes: [],
        edges: [],
      })
      .select('id')
      .single()
    if (journeyErr || !journey) {
      return NextResponse.json({ error: 'Could not create a knowledge space for this agent.' }, { status: 500 })
    }

    // Only fill it in if nobody else did meanwhile (double click, two tabs).
    await supabase
      .from('agents')
      .update({ journey_id: journey.id })
      .eq('id', agent.id)
      .eq('tenant_id', user.id)
      .is('journey_id', null)

    const { data: after } = await supabase
      .from('agents')
      .select('journey_id')
      .eq('id', agent.id)
      .eq('tenant_id', user.id)
      .maybeSingle()

    if (after?.journey_id && after.journey_id !== journey.id) {
      // Lost the race: drop the empty journey we just made and use the winner.
      await supabase.from('journeys').delete().eq('id', journey.id).eq('user_id', user.id)
      return NextResponse.json({ journey_id: after.journey_id, created: false })
    }
    if (!after?.journey_id) {
      return NextResponse.json({ error: 'Could not link the knowledge space to this agent.' }, { status: 500 })
    }
    return NextResponse.json({ journey_id: journey.id, created: true })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Server error' }, { status: 500 })
  }
}
