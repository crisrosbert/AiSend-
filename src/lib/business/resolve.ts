// src/lib/business/resolve.ts
//
// Deciding which business a request belongs to.
//
// ── WHY THIS IS ITS OWN FILE, AND PURE ───────────────────────────────
// This one decision is the whole boundary. Every leak fixed this week
// came from a variant of it being made ad hoc — a config row falling
// back to the tenant's org-wide one, a journey id read off the wrong
// record, an undefined filter meaning "everything". Ad hoc decisions
// cannot be tested; this one can, and is.
//
// The rules below are deliberately boring, because the interesting
// version is what caused the bugs.

/** A business as far as resolution cares. */
export interface BusinessRef {
  id: string
  name: string
  is_default: boolean
  logo_url: string | null
}

/**
 * Which business should this request act on?
 *
 * `requested` is what the caller asked for — a cookie, a query param, a
 * header. It is untrusted: the caller can put anything there.
 * `owned` is what the signed-in user actually has.
 *
 * The rules, in order:
 *
 *   1. Own nothing → null. Not an error: a brand-new account has no
 *      business until one is created, and callers must handle that.
 *   2. Asked for one you own → that one.
 *   3. Asked for one you do NOT own → your default, never the asked-for
 *      one. A stale cookie after switching accounts is ordinary; a
 *      cross-account read is not.
 *   4. Asked for nothing → your default.
 *   5. No default → the first you own, so a broken flag degrades to the
 *      wrong-ish business rather than to no app at all.
 */
export function resolveBusiness(
  requested: string | null | undefined,
  owned: BusinessRef[],
): BusinessRef | null {
  if (!owned || owned.length === 0) return null

  if (requested) {
    const match = owned.find((b) => b.id === requested)
    if (match) return match
    // Deliberately silent about the miss. Telling a caller "that
    // business is not yours" confirms the id exists, which is a probe
    // worth not answering.
  }

  return owned.find((b) => b.is_default) ?? owned[0]
}

/**
 * Same decision, id only — the shape most callers want.
 */
export function resolveBusinessId(
  requested: string | null | undefined,
  owned: BusinessRef[],
): string | null {
  return resolveBusiness(requested, owned)?.id ?? null
}

/**
 * The cookie the switcher writes and the server reads.
 *
 * A cookie rather than a header because it survives a full page load
 * and reaches API routes without every fetch remembering to attach it —
 * and a forgotten header would silently mean "default business", which
 * is the quiet kind of wrong.
 */
export const BUSINESS_COOKIE = 'aisend_business'

/**
 * Pull the cookie out of a raw Cookie header.
 *
 * Hand-parsed because API routes receive a plain Request; pulling in
 * next/headers would make this unusable from the edge and from tests.
 * Returns null rather than '' so "absent" and "empty" cannot diverge.
 */
export function businessFromCookieHeader(header: string | null | undefined): string | null {
  if (!header) return null
  for (const part of header.split(';')) {
    const [rawName, ...rest] = part.split('=')
    if (rawName?.trim() !== BUSINESS_COOKIE) continue
    const value = decodeURIComponent(rest.join('=').trim())
    return value || null
  }
  return null
}
