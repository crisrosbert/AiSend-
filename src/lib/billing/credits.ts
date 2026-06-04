// src/lib/billing/credits.ts
//
// Per-message wallet deduction helpers. The send routes
// (whatsapp/send, whatsapp/broadcast) call into here AFTER Meta has
// accepted a message, to debit the org wallet and write a ledger row.
//
// Pricing is per-message (Meta moved off per-conversation pricing on
// 2026-01-01). Rates below are what you CHARGE the client (Meta base +
// your margin), matching the cost-calculator / PROJECT_CONTEXT:
//
//   marketing      ₹1.09
//   utility        ₹0.145
//   authentication ₹0.145
//   service        free
//
// Keep this table as the single source of truth for send-side pricing.

import type { SupabaseClient } from '@supabase/supabase-js'

export type MessageCategory =
  | 'marketing'
  | 'utility'
  | 'authentication'
  | 'service'

/** What the client is charged per delivered message, in INR. */
export const MESSAGE_PRICE_INR: Record<MessageCategory, number> = {
  marketing: 1.09,
  utility: 0.145,
  authentication: 0.145,
  service: 0,
}

/**
 * Normalize whatever category string we have (template row is TitleCase
 * 'Marketing'; Meta is 'MARKETING'; callers may pass lowercase) down to
 * our pricing key. Unknown → 'marketing' (the most expensive) so we never
 * accidentally undercharge.
 */
export function normalizeCategory(raw: string | null | undefined): MessageCategory {
  switch ((raw ?? '').toLowerCase()) {
    case 'utility':
      return 'utility'
    case 'authentication':
    case 'auth':
      return 'authentication'
    case 'service':
      return 'service'
    default:
      return 'marketing'
  }
}

export function priceForCategory(raw: string | null | undefined): number {
  return MESSAGE_PRICE_INR[normalizeCategory(raw)]
}

/**
 * Resolve a user's org_id via their profile. Returns null if the user has
 * no organization (e.g. legacy account not yet migrated to multi-tenant).
 */
export async function getOrgIdForUser(
  supabase: SupabaseClient,
  userId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from('profiles')
    .select('org_id')
    .eq('user_id', userId)
    .maybeSingle()
  return data?.org_id ?? null
}

/**
 * Look up a template's category by name (+ optional language) for this
 * user so we can price it. Falls back to 'marketing' if not found.
 */
export async function getTemplateCategory(
  supabase: SupabaseClient,
  userId: string,
  templateName: string,
  language?: string,
): Promise<MessageCategory> {
  let q = supabase
    .from('message_templates')
    .select('category, language')
    .eq('user_id', userId)
    .eq('name', templateName)
  if (language) q = q.eq('language', language)

  const { data } = await q.limit(1).maybeSingle()
  return normalizeCategory(data?.category)
}

export interface OrgBalance {
  orgId: string
  balance: number
}

/** Read the current wallet balance for an org. */
export async function getOrgBalance(
  supabase: SupabaseClient,
  orgId: string,
): Promise<number> {
  const { data } = await supabase
    .from('organizations')
    .select('credit_balance')
    .eq('id', orgId)
    .maybeSingle()
  return Number(data?.credit_balance ?? 0)
}

export interface DeductResult {
  ok: boolean
  newBalance?: number
  /** Set when ok=false: 'insufficient' | 'no_org' | 'error' */
  reason?: 'insufficient' | 'no_org' | 'error'
  message?: string
}

/**
 * Atomically debit `amount` INR from the org wallet via the
 * deduct_credits RPC, writing a ledger row. Safe to call inside a
 * broadcast loop — the RPC row-locks the org.
 *
 * A zero amount (service messages) is a no-op success: nothing to debit,
 * no ledger noise.
 */
export async function deductCredits(
  supabase: SupabaseClient,
  opts: {
    orgId: string
    userId: string
    amount: number
    description?: string
    reference?: string
  },
): Promise<DeductResult> {
  if (opts.amount <= 0) {
    const balance = await getOrgBalance(supabase, opts.orgId)
    return { ok: true, newBalance: balance }
  }

  const { data, error } = await supabase.rpc('deduct_credits', {
    p_org_id: opts.orgId,
    p_user_id: opts.userId,
    p_amount: opts.amount,
    p_type: 'debit',
    p_description: opts.description ?? 'Message charge',
    p_reference: opts.reference ?? null,
  })

  if (error) {
    const msg = error.message || ''
    if (msg.includes('INSUFFICIENT_CREDITS')) {
      return { ok: false, reason: 'insufficient', message: 'Insufficient wallet balance' }
    }
    return { ok: false, reason: 'error', message: msg }
  }

  return { ok: true, newBalance: Number(data) }
}
