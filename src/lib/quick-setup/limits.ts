// src/lib/quick-setup/limits.ts
//
// Every number that caps cost or abuse on the Quick Setup screen, in one
// place. Pure constants: no imports, safe to load anywhere.

/** Shortest setup text that can describe a business. */
export const MIN_SETUP_CHARS = 20
/** Longest setup text. Rejected (not cut) above this so the owner knows. */
export const MAX_SETUP_CHARS = 1500

/** Test chat: longest single message the "Try it" box accepts. */
export const MAX_TEST_MESSAGE_CHARS = 500
/** Test chat: how many earlier turns are sent back to the model. */
export const MAX_TEST_HISTORY_TURNS = 10
/** Test chat: longest earlier turn kept. */
export const MAX_TEST_HISTORY_CHARS = 600
/** Test chat: model calls allowed for one message (tool loop cap). */
export const MAX_DRY_RUN_STEPS = 3

/** Requests per minute per signed-in user (in-memory limiter). */
export const QUICK_SETUP_RATE_LIMITS = {
  analyze: { limit: 10, windowMs: 60_000 },
  save: { limit: 10, windowMs: 60_000 },
  testChat: { limit: 20, windowMs: 60_000 },
} as const
