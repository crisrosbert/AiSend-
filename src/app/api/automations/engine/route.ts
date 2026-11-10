import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/automations/admin-client'
import { runAutomationsForTrigger } from '@/lib/automations/engine'
import { currentBusinessId } from '@/lib/business/server'
import { getOrgIdForUser } from '@/lib/billing/credits'
import {
  parseEngineBody,
  allowedOwnerIds,
  decideEngineAccess,
  type ScopedContactRow,
  type ScopedConversationRow,
} from '@/lib/automations/engine-access'
import type { AutomationTriggerType } from '@/types'

/**
 * Manual trigger for testing or for external integrations that want
 * to fire automations. Auth is required — the caller's user_id is
 * used so RLS-safe data remains per-user.
 *
 * Tenant check: the engine runs with the service-role client (no row
 * level security), so a contact_id / conversation_id from the request
 * body is only accepted if it belongs to the caller's organisation.
 * Missing and foreign ids both answer 404 "Not found" (no probing).
 *
 * No server job calls this URL (they import runAutomationsForTrigger
 * directly), so there is no cron/service-key path here.
 */
export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const parsed = parseEngineBody(await request.json().catch(() => null))
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: parsed.status })
  }
  const { triggerType, contactId, conversationId, context } = parsed.body

  // Ownership check, only needed when the body references records.
  if (contactId || conversationId) {
    const admin = supabaseAdmin()

    const orgId = await getOrgIdForUser(admin, user.id)
    let memberIds: string[] = []
    if (orgId) {
      const { data: members, error: memErr } = await admin
        .from('profiles')
        .select('user_id')
        .eq('org_id', orgId)
      if (memErr) {
        console.error('[automations/engine] org member lookup failed:', memErr.message)
        return NextResponse.json({ error: 'Lookup failed' }, { status: 500 })
      }
      memberIds = ((members ?? []) as { user_id: string }[]).map((m) => m.user_id)
    }
    const owners = allowedOwnerIds(user.id, orgId, memberIds)

    let contact: ScopedContactRow | null = null
    if (contactId) {
      const { data, error } = await admin
        .from('contacts')
        .select('id, user_id')
        .eq('id', contactId)
        .in('user_id', owners)
        .maybeSingle()
      if (error) {
        console.error('[automations/engine] contact lookup failed:', error.message)
        return NextResponse.json({ error: 'Lookup failed' }, { status: 500 })
      }
      contact = (data as ScopedContactRow | null) ?? null
    }

    let conversation: ScopedConversationRow | null = null
    if (conversationId) {
      const { data, error } = await admin
        .from('conversations')
        .select('id, user_id, contact_id')
        .eq('id', conversationId)
        .in('user_id', owners)
        .maybeSingle()
      if (error) {
        console.error('[automations/engine] conversation lookup failed:', error.message)
        return NextResponse.json({ error: 'Lookup failed' }, { status: 500 })
      }
      conversation = (data as ScopedConversationRow | null) ?? null
    }

    const decision = decideEngineAccess({
      contactId,
      conversationId,
      contact,
      conversation,
      allowedOwners: owners,
    })
    if (!decision.ok) {
      return NextResponse.json({ error: decision.error }, { status: decision.status })
    }
  }

  await runAutomationsForTrigger({
    userId: user.id,
    businessId: await currentBusinessId(supabase, user.id, request),
    triggerType: triggerType as AutomationTriggerType,
    contactId,
    context,
  })

  return NextResponse.json({ ok: true })
}
