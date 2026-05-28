import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/automations/admin-client'

export async function GET() {
  try {
    // 1. Verify the caller is logged in (normal auth client)
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 2. Verify the caller is an admin
    const { data: adminCheck } = await supabase
      .from('admin_users')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle()
    if (!adminCheck) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // 3. Use SERVICE ROLE client to read ALL orgs (bypasses RLS)
    const admin = supabaseAdmin()

    const { data: orgs, error } = await admin
      .from('organizations')
      .select('id, name, slug, plan, status, created_at, owner_id')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Admin orgs fetch error:', error.message)
      return NextResponse.json({ error: 'Failed to fetch clients' }, { status: 500 })
    }

    const ownerIds = (orgs || []).map((o) => o.owner_id)

    // Fetch profiles + whatsapp configs with service role too
    const { data: profiles } = await admin
      .from('profiles')
      .select('user_id, full_name, email')
      .in('user_id', ownerIds.length ? ownerIds : ['00000000-0000-0000-0000-000000000000'])

    const { data: waConfigs } = await admin
      .from('whatsapp_config')
      .select('user_id, status')
      .in('user_id', ownerIds.length ? ownerIds : ['00000000-0000-0000-0000-000000000000'])

    const clients = (orgs || []).map((org) => {
      const profile = profiles?.find((p) => p.user_id === org.owner_id)
      const wa = waConfigs?.find((w) => w.user_id === org.owner_id)
      return {
        id: org.id,
        name: org.name,
        slug: org.slug,
        plan: org.plan,
        status: org.status,
        whatsapp_connected: wa?.status === 'connected',
        created_at: org.created_at,
        owner_id: org.owner_id,
        full_name: profile?.full_name || null,
        email: profile?.email || null,
      }
    })

    return NextResponse.json({ clients })
  } catch (error) {
    console.error('Admin clients error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: adminCheck } = await supabase
      .from('admin_users')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle()
    if (!adminCheck) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { org_id, status } = await request.json()
    if (!org_id || !status) {
      return NextResponse.json({ error: 'org_id and status required' }, { status: 400 })
    }

    // Use service role to update (bypasses RLS)
    const admin = supabaseAdmin()
    const { error } = await admin
      .from('organizations')
      .update({ status })
      .eq('id', org_id)

    if (error) {
      return NextResponse.json({ error: 'Failed to update status' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Admin patch error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
