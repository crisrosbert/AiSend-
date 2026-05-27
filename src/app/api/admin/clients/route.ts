import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET /api/admin/clients — returns all organizations with profile info
export async function GET() {
  try {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check admin
    const { data: adminCheck } = await supabase
      .from('admin_users')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle()

    if (!adminCheck) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Get all organizations with profile + whatsapp status
    const { data: orgs, error } = await supabase
      .from('organizations')
      .select(`
        id,
        name,
        slug,
        plan,
        status,
        whatsapp_connected,
        created_at,
        owner_id,
        profiles!organizations_owner_id_fkey (
          full_name,
          email,
          avatar_url
        )
      `)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching orgs:', error)
      return NextResponse.json({ error: 'Failed to fetch clients' }, { status: 500 })
    }

    // Get whatsapp connection status for each org owner
    const ownerIds = (orgs || []).map((o: any) => o.owner_id)
    const { data: waConfigs } = await supabase
      .from('whatsapp_config')
      .select('user_id, status, phone_number_id')
      .in('user_id', ownerIds)

    // Merge whatsapp status
    const clients = (orgs || []).map((org: any) => {
      const waConfig = waConfigs?.find((w: any) => w.user_id === org.owner_id)
      return {
        id: org.id,
        name: org.name,
        slug: org.slug,
        plan: org.plan,
        status: org.status,
        whatsapp_connected: waConfig?.status === 'connected',
        phone_number_id: waConfig?.phone_number_id || null,
        created_at: org.created_at,
        owner_id: org.owner_id,
        full_name: org.profiles?.full_name || null,
        email: org.profiles?.email || null,
      }
    })

    return NextResponse.json({ clients })
  } catch (error) {
    console.error('Admin clients error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH /api/admin/clients — toggle client status
export async function PATCH(request: Request) {
  try {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check admin
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
      return NextResponse.json({ error: 'Failed to update status' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Admin patch error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
