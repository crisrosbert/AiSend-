// GET ?q=… → up to 20 of this account's contacts matching a name or number,
// for hand-picking recipients. Opted-out and unusable numbers are not offered.
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { currentBusinessId } from '@/lib/business/server'
import { usablePhone } from '@/lib/campaign-agent/audience'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Strip characters that have meaning in a PostgREST filter.
  const q = (new URL(request.url).searchParams.get('q') ?? '').replace(/[^\p{L}\p{N}\s+.'-]/gu, '').trim().slice(0, 40)
  if (q.length < 2) return NextResponse.json({ contacts: [] })

  const businessId = await currentBusinessId(supabase, user.id, request)
  let query = supabase
    .from('contacts')
    .select('id, name, phone, opted_out_at, opt_in_status')
    .eq('user_id', user.id)
    .or(`name.ilike.%${q}%,phone.ilike.%${q}%`)
    .order('created_at', { ascending: false })
    .limit(40)
  if (businessId) query = query.eq('business_id', businessId)
  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const contacts = (data ?? [])
    .filter((c) => !c.opted_out_at && c.opt_in_status !== 'opted_out' && usablePhone(c.phone))
    .slice(0, 20)
    .map((c) => ({ id: c.id, name: c.name, phone: c.phone }))
  return NextResponse.json({ contacts })
}
