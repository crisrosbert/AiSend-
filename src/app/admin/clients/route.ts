import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = await createClient()

    // Verify logged in
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify admin
    const { data: adminCheck } = await supabase
      .from('admin_users')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle()

    if (!adminCheck) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Fetch all orgs — RLS policy allows admin users to see all
    const { data: orgs, error: orgsError } = await supabase
      .from('organizations')
      .select('id, name, slug, plan, status, created_at, owner_id')
      .order('created_at', { ascending: false })

    if (orgsError) {
      console.error('orgs error:', orgsError.message)
      return NextResponse.json({ error: orgsError.message }, { status: 500 })
    }

    if (!orgs || orgs.length === 0) {
      return NextResponse.json({ clients: [] })
    }

    const ownerIds = orgs.map((o) => o.owner_id)

    // Fetch profiles — RLS policy allows admin to see all
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('user_id, full_name, email')
      .in('user_id', ownerIds)

    if (profilesError) {
      console.error('profiles error:', profilesError.message)
    }

    // Fetch whatsapp configs
    const { data: waConfigs } = await supabase
      .from('whatsapp_config')
      .select('user_id, status')
      .in('user_id', ownerIds)

    const clients = orgs.map((org) => {
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
  } catch (err) {
    console.error('Admin GET error:', err)
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

    const { error } = await supabase
      .from('organizations')
      .update({ status })
      .eq('id', org_id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Admin PATCH error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
