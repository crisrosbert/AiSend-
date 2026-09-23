// src/app/api/webhooks/conversations/route.ts
//
// GET without ?q — currently webhook-routed conversations (the
// "Subscribed conversations" panel).
// GET with ?q=<text> — search contacts by name/phone to find a
// conversation to subscribe (BYOA handoff).

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const rawQ = searchParams.get('q')?.trim()
    // Strip characters that have meaning in a PostgREST .or() filter
    // string (comma separates conditions, parens/percent are
    // structural) so a search term can't inject extra conditions.
    const q = rawQ?.replace(/[,()%]/g, ' ').trim()

    if (q) {
      const { data, error } = await supabase
        .from('conversations')
        .select('id, routing_mode, routing_endpoint_id, contacts!inner(name, phone)')
        .or(`name.ilike.%${q}%,phone.ilike.%${q}%`, { referencedTable: 'contacts' })
        .limit(10)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ conversations: data ?? [] })
    }

    const { data, error } = await supabase
      .from('conversations')
      .select('id, routing_mode, routing_endpoint_id, contacts!inner(name, phone)')
      .eq('routing_mode', 'webhook')
      .order('updated_at', { ascending: false })
      .limit(50)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ conversations: data ?? [] })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
