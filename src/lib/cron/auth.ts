// src/lib/cron/auth.ts
//
// One place that decides whether a scheduled request is genuine.
//
// ── WHY THIS IS SHARED ───────────────────────────────────────────────
// The automations queue had this logic inline and read only
// `x-cron-secret`. Vercel Cron sends `Authorization: Bearer <secret>`.
// So the endpoint meant to drain that queue could not be reached by the
// platform meant to call it, and every automation containing a `wait`
// ran its first half and stopped forever — the log showing it started,
// nothing showing it never finished.
//
// That bug was possible because each route invented its own check. Now
// they share one, and a route that needs scheduling gets the same
// answer as every other.

/** Both names are accepted, so one shared secret is enough to set up. */
export function cronSecret(): string | null {
  return process.env.AUTOMATION_CRON_SECRET || process.env.CRON_SECRET || null
}

/**
 * The secret this request is presenting, from any of the three places a
 * scheduler might put it.
 *
 * Vercel Cron uses the Authorization header. External pingers vary —
 * some only allow custom headers, some only a query string. All three
 * are read because the alternative is an endpoint that silently is not
 * called, which is exactly the failure this file exists to prevent.
 */
export function suppliedSecret(request: Request): string | null {
  const auth = request.headers.get('authorization')
  if (auth) {
    // `\s+` alone is not enough: a header of "Bearer " arrives with the
    // trailing space stripped, so the regex misses and the scheme name
    // itself is returned as if it were the secret. Harmless against a
    // real secret, confusing in a log, and trivially avoided.
    const bare = auth.replace(/^Bearer\s*/i, '').trim()
    if (bare) return bare
  }
  const header = request.headers.get('x-cron-secret')
  if (header) return header.trim()

  try {
    return new URL(request.url).searchParams.get('secret')
  } catch {
    return null
  }
}

export type CronAuth =
  | { ok: true }
  | { ok: false; status: 401 | 503; error: string }

/**
 * Is this a scheduled call we should act on?
 *
 * 503 rather than 401 when no secret is configured at all: the caller
 * did nothing wrong, the deployment is incomplete, and the two need
 * different responses or nobody can tell them apart from the outside.
 */
export function verifyCron(request: Request): CronAuth {
  const expected = cronSecret()
  if (!expected) {
    return { ok: false, status: 503, error: 'Cron is not configured (set CRON_SECRET)' }
  }
  const supplied = suppliedSecret(request)
  if (!supplied || supplied !== expected) {
    return { ok: false, status: 401, error: 'Unauthorized' }
  }
  return { ok: true }
}
