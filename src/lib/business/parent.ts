// src/lib/business/parent.ts
//
// Reading a row's business off the thing it belongs to.
//
// ── WHY THIS IS NOT THE SWITCHER'S JOB ───────────────────────────────
// The switcher says which business the person is *looking at*. That is
// the right answer when they create something new, and the wrong answer
// for everything else.
//
// A journey opened from a bookmark may belong to a different business
// than the one currently selected. An agent-scoped widget can fall back
// to the tenant's org-wide config row, whose business is the tenant
// default. An inbound WhatsApp message has no selection at all. In each
// case there is exactly one correct source — the parent row — and
// reaching for the switcher instead produces a row that is filed
// plausibly and wrongly.
//
// Isomorphic on purpose: the same rule has to hold on a dashboard page,
// in an API route, and in a webhook, so it takes the client rather than
// creating one.

/* eslint-disable @typescript-eslint/no-explicit-any */

/** Minimal shape so this works with both the browser and admin clients. */
type AnyClient = {
  from: (table: string) => any
}

async function businessIdFrom(
  supabase: AnyClient,
  table: string,
  id: string | null | undefined,
  label: string,
): Promise<string | null> {
  if (!id) return null
  const { data, error } = await supabase
    .from(table)
    .select('business_id')
    .eq('id', id)
    .maybeSingle()
  if (error) {
    console.error(`[business] ${label} lookup failed:`, error.message)
    return null
  }
  return (data?.business_id as string | null) ?? null
}

/**
 * Which business an agent belongs to.
 *
 * For the paths with no signed-in user to ask — inbound WhatsApp, the
 * website widget, ad leads — and for anything an agent writes on a
 * customer's behalf.
 *
 * Returns null when the agent is untagged (created before migration
 * 030), which callers pass straight through. An untagged row is
 * honest and fixable; a wrongly tagged one is neither.
 */
export function businessIdForAgent(
  supabase: AnyClient,
  agentId: string | null | undefined,
): Promise<string | null> {
  return businessIdFrom(supabase, 'agents', agentId, 'agent')
}

/**
 * Which business a journey belongs to.
 *
 * Personas and knowledge sources hang off a journey and are reached by
 * a URL that carries its id, so the journey — not the switcher — is
 * what says where they belong.
 */
export function businessIdForJourney(
  supabase: AnyClient,
  journeyId: string | null | undefined,
): Promise<string | null> {
  // Journeys created before their first save carry a temp_ id and have
  // no row yet. Asking for one returns nothing rather than erroring.
  if (!journeyId || journeyId.startsWith('temp_')) return Promise.resolve(null)
  return businessIdFrom(supabase, 'journeys', journeyId, 'journey')
}
