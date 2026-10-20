// Who may use AI Campaigns, and how much.
//
// Accounts have a single role today (profiles.role is always 'user'), so the
// account owner is the only person who can run campaigns. Paid plans get the
// full feature; every other plan gets a small trial. All limits live here.

import type { SupabaseClient } from '@supabase/supabase-js'
import { getOrgIdForUser } from '@/lib/billing/credits'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = SupabaseClient<any, any, any>

export const FULL_PLANS = ['premium', 'agent']
export const TRIAL_LIMITS = { contacts: 10, steps: 2 }
export const FULL_LIMITS = { contacts: 50_000, steps: 5 }

export interface CampaignAccess {
  allowed: boolean
  /** Why access is denied (shown to the user). */
  reason?: string
  tier: 'full' | 'trial'
  maxContacts: number
  maxSteps: number
  /** AI image generation is a paid-plan feature. */
  images: boolean
}

export function accessFor(input: {
  userId: string
  ownerId?: string | null
  plan?: string | null
  planId?: string | null
}): CampaignAccess {
  const full = [input.plan, input.planId].some((p) => FULL_PLANS.includes((p ?? '').toLowerCase().trim()))
  const lim = full ? FULL_LIMITS : TRIAL_LIMITS
  const base = { tier: full ? ('full' as const) : ('trial' as const), maxContacts: lim.contacts, maxSteps: lim.steps, images: full }
  if (input.ownerId && input.ownerId !== input.userId) {
    return { ...base, allowed: false, reason: 'Only the account owner can use AI Campaigns.' }
  }
  return { ...base, allowed: true }
}

export async function getAccess(db: Db, userId: string): Promise<CampaignAccess> {
  const orgId = await getOrgIdForUser(db, userId)
  if (!orgId) return accessFor({ userId })
  const { data } = await db.from('organizations').select('owner_id, plan, plan_id').eq('id', orgId).maybeSingle()
  return accessFor({ userId, ownerId: data?.owner_id, plan: data?.plan, planId: data?.plan_id })
}

/** Returns an error message when the request is over the plan's limits, else null. */
export function limitError(a: CampaignAccess, contacts: number, steps: number, hasImage: boolean): string | null {
  if (contacts > a.maxContacts) {
    return a.tier === 'trial'
      ? `Your plan allows ${a.maxContacts} contacts per campaign (this one has ${contacts}). Upgrade to the Premium or Agent plan to send to everyone.`
      : `A campaign can have up to ${a.maxContacts.toLocaleString('en-IN')} contacts.`
  }
  if (steps > a.maxSteps) {
    return a.tier === 'trial'
      ? `Your plan allows ${a.maxSteps} messages per campaign (this one has ${steps}). Upgrade to the Premium or Agent plan for more.`
      : `A campaign can have up to ${a.maxSteps} messages.`
  }
  if (hasImage && !a.images) return 'Campaign images are available on the Premium and Agent plans.'
  return null
}
