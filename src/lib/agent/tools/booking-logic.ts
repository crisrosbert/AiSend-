// src/lib/agent/tools/booking-logic.ts
//
// The pure decisions behind book_appointment, split out so they can be
// tested without a database:
//
//   • is this call a CORRECTION of a request already saved in this chat?
//   • does a proposed slot collide with an appointment a human confirmed?
//   • if so, which is the next slot that does not?
//
// booking-tools.ts does the I/O and calls these.

import { nextOpenSlot, type BusinessHours } from '@/lib/agent/business-hours'

/** A saved request older than this is a different booking, not a correction. */
export const RECENT_REQUEST_MS = 24 * 60 * 60 * 1000

function norm(s: string | null | undefined): string {
  return (s ?? '').toLowerCase().replace(/\s+/g, ' ').trim()
}

/**
 * Do these two names plausibly belong to the same person?
 * "Amit" and "Amit Shah" do; "Amit" and "Neetu" do not. Booking FOR
 * someone else in the same chat must create a second request, not
 * overwrite the first.
 */
export function namesCompatible(a: string | null | undefined, b: string | null | undefined): boolean {
  const x = norm(a)
  const y = norm(b)
  if (!x || !y) return false
  return x === y || x.startsWith(`${y} `) || y.startsWith(`${x} `)
}

export interface ExistingRequest {
  id: string
  customer_name: string | null
  created_at?: string | null
}

/**
 * Pick the saved request this call is correcting, if any. `candidates`
 * must already be this conversation's 'requested' rows, newest first.
 */
export function findRequestToUpdate(
  candidates: ExistingRequest[],
  incomingName: string,
  now: Date = new Date(),
): ExistingRequest | null {
  for (const c of candidates) {
    if (c.created_at) {
      const age = now.getTime() - new Date(c.created_at).getTime()
      if (Number.isFinite(age) && age > RECENT_REQUEST_MS) continue
    }
    if (namesCompatible(c.customer_name, incomingName)) return c
  }
  return null
}

/** Two appointments of `slotMinutes` each overlap when starts are closer than one slot. */
export function overlaps(aIso: string, bIso: string, slotMinutes: number): boolean {
  const a = new Date(aIso).getTime()
  const b = new Date(bIso).getTime()
  if (Number.isNaN(a) || Number.isNaN(b)) return false
  return Math.abs(a - b) < slotMinutes * 60_000
}

export interface FreeSlot {
  iso: string
  /** True when the requested slot was taken and a later one was chosen. */
  moved: boolean
}

/**
 * First slot at or after `startIso` that does not overlap any CONFIRMED
 * appointment. Steps forward one slot at a time through real opening
 * hours (nextOpenSlot), at most `maxTries` times, then returns null.
 */
export function pickFreeSlot(
  startIso: string,
  hours: BusinessHours,
  confirmedIsos: string[],
  maxTries = 8,
): FreeSlot | null {
  let candidate = startIso
  let moved = false
  const slotMs = hours.slotMinutes * 60_000
  const leadMs = hours.minLeadMinutes * 60_000

  for (let i = 0; i < maxTries; i++) {
    if (!confirmedIsos.some((c) => overlaps(candidate, c, hours.slotMinutes))) {
      return { iso: candidate, moved }
    }
    // nextOpenSlot() adds the lead time to its input, so back it out to
    // ask for "the first slot after this one ends".
    const from = new Date(new Date(candidate).getTime() + slotMs - leadMs)
    const next = nextOpenSlot(from, hours)
    if (!next) return null
    candidate = next.toISOString()
    moved = true
  }
  return null
}
