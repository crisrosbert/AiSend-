// src/lib/quick-setup/save-helpers.ts
//
// Pure helpers for the Quick Setup "Save & Activate" route: what to write
// to the agents row, how to degrade when an optional column is missing,
// and when it is safe to point the WhatsApp number at the new agent.
// No database access in this file.

import { agentNameFor, industryForKind } from '@/lib/quick-setup/prompt'
import { factsToBusinessHours, type ExtractedFacts } from '@/lib/quick-setup/facts'

/**
 * Columns that may not exist on every tenant's database. If a write fails
 * because of one of these, the route retries without them (the agent still
 * works; it just keeps default hours / no fallback phone).
 */
export const OPTIONAL_COLUMNS = ['business_hours', 'fallback_contact'] as const

/** Postgres "undefined column" (42703) or PostgREST "not in schema cache" (PGRST204). */
export function isMissingColumnError(err: { code?: string | null; message?: string | null } | null | undefined): boolean {
  if (!err) return false
  if (err.code === '42703' || err.code === 'PGRST204') return true
  return /column .* (?:does not exist|of relation)|could not find the .* column/i.test(err.message ?? '')
}

export function stripOptionalColumns(row: Record<string, unknown>): Record<string, unknown> {
  const out = { ...row }
  for (const c of OPTIONAL_COLUMNS) delete out[c]
  return out
}

export interface AgentRowInput {
  userId: string
  businessId: string
  facts: ExtractedFacts
  persona: string
  activate: boolean
}

/**
 * A brand-new agent. Every capability flag is written explicitly (the same
 * habit as agentRowFromTemplate). Booking is ON; lead forms, media and
 * payments are OFF so the first version does exactly one job.
 */
export function buildNewAgentRow(i: AgentRowInput): Record<string, unknown> {
  const hours = factsToBusinessHours(i.facts)
  return {
    tenant_id: i.userId,
    business_id: i.businessId,
    name: agentNameFor(i.facts),
    agent_type: 'support',
    industry: industryForKind(i.facts.business_kind),
    persona: i.persona,
    quick_replies_enabled: false,
    booking_enabled: true,
    media_enabled: false,
    lead_form_enabled: false,
    lead_form_mode: 'progressive',
    payment_enabled: false,
    is_active: i.activate,
    ...(hours ? { business_hours: hours } : {}),
    ...(i.facts.phone ? { fallback_contact: i.facts.phone } : {}),
  }
}

/**
 * Changes for an agent that Quick Setup created earlier. The name is left
 * alone (the owner may have renamed it), and business_hours / fallback_contact
 * are only written when the new text actually contains them, so hours the
 * owner edited in AI Agents are not wiped by a text that does not mention them.
 */
export function buildAgentUpdate(i: AgentRowInput): Record<string, unknown> {
  const hours = factsToBusinessHours(i.facts)
  return {
    persona: i.persona,
    industry: industryForKind(i.facts.business_kind),
    booking_enabled: true,
    is_active: i.activate,
    ...(hours ? { business_hours: hours } : {}),
    ...(i.facts.phone ? { fallback_contact: i.facts.phone } : {}),
  }
}

export type WhatsAppOutcome = 'assigned' | 'not_connected' | 'kept_other' | 'skipped'

/**
 * May the WhatsApp number be pointed at this agent?
 * Never silently replaces a different agent: that needs `replace`.
 */
export function decideWhatsAppAssignment(input: {
  activate: boolean
  assign: boolean
  replace: boolean
  /** null = no whatsapp_config row (WhatsApp not connected). */
  config: { whatsapp_agent_id: string | null } | null
  agentId: string
}): { action: 'update' | 'none'; outcome: WhatsAppOutcome } {
  if (!input.activate || !input.assign) return { action: 'none', outcome: 'skipped' }
  if (!input.config) return { action: 'none', outcome: 'not_connected' }
  const current = input.config.whatsapp_agent_id
  if (!current || current === input.agentId) return { action: 'update', outcome: 'assigned' }
  return input.replace ? { action: 'update', outcome: 'assigned' } : { action: 'none', outcome: 'kept_other' }
}

/** Read an optional boolean from a JSON body. Anything but a real boolean gives the default. */
export function readBool(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback
}
