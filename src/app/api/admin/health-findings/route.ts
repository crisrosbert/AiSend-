// src/app/api/admin/health-findings/route.ts
//
// Health findings for the platform operator, across every tenant.
//
// ── WHY THIS IS NOT A CUSTOMER-FACING PAGE ───────────────────────────
// These findings are diagnostics: "the widget is not passing an agent
// id", "migration 023 has not been applied", "the access token has
// expired". A business owner cannot act on any of that, and showing
// them a page listing everything wrong with the platform undermines
// confidence without helping anybody.
//
// Worse, the findings name conversations and campaigns. Rendered
// without care that becomes one tenant reading another's activity.
//
// So it lives behind the admin_users check, reads with the service role
// so it can see across tenants, and never reaches the browser except
// for somebody who is already an operator.

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _service: any = null
function serviceDb() {
  if (!_service) {
    _service = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )
  }
  return _service
}

/**
 * Returns the caller's user id if they are an operator, otherwise null.
 * The service client is never touched until this has passed.
 */
async function requireAdmin(): Promise<string | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: admin } = await supabase
    .from('admin_users')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle()

  return admin ? user.id : null
}

export async function GET() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const { data, error } = await serviceDb()
      .from('health_findings')
      .select('id, tenant_id, code, severity, title, detail, count, detected_at')
      .is('resolved_at', null)
      .order('detected_at', { ascending: false })
      .limit(100)

    if (error) {
      // Almost always the migration not having been run. Say which one
      // rather than returning an empty list that reads as good news.
      const missing = /does not exist|schema cache/i.test(error.message)
      return NextResponse.json(
        { error: missing ? 'Run migration 025 to enable health checks' : error.message },
        { status: missing ? 503 : 500 },
      )
    }

    // Tenant names, so a finding is readable without looking up a uuid.
    const tenantIds = [...new Set((data ?? []).map((f: { tenant_id: string | null }) => f.tenant_id).filter(Boolean))]
    const names = new Map<string, string>()
    if (tenantIds.length > 0) {
      const { data: profiles } = await serviceDb()
        .from('profiles')
        .select('user_id, full_name, email')
        .in('user_id', tenantIds)
      for (const p of profiles ?? []) {
        names.set(p.user_id, p.full_name || p.email || p.user_id.slice(0, 8))
      }
    }

    return NextResponse.json({
      findings: (data ?? []).map((f: Record<string, unknown>) => ({
        ...f,
        tenant_name: f.tenant_id ? names.get(f.tenant_id as string) ?? 'Unknown' : 'Platform',
      })),
    })
  } catch (err) {
    console.error('[admin/health-findings] failed:', err)
    return NextResponse.json({ error: 'Could not load findings' }, { status: 500 })
  }
}

/** Mark one finding handled. */
export async function PATCH(request: Request) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const body = await request.json().catch(() => ({}))
    const id = typeof body?.id === 'string' ? body.id : null
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

    const { error } = await serviceDb()
      .from('health_findings')
      .update({ resolved_at: new Date().toISOString() })
      .eq('id', id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Could not update' }, { status: 500 })
  }
}
