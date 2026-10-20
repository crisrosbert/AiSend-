// Which delivery failures are worth another try, and which never will be.
// Pure, so it is tested without a database.

const PERMANENT = [
  /invalid phone/i,
  /not a valid whatsapp/i,
  /not.*whatsapp (user|account)/i,
  /undeliverable/i,
  /opted.?out/i,
  /unsubscrib/i,
  /blocked/i,
  /recipient.*not.*allowed/i,
  /\b131026\b/,
  /\b131047\b/,
]

const TRANSIENT = [
  /rate.?limit/i,
  /throttl/i,
  /too many/i,
  /temporar/i,
  /time.?out/i,
  /timed out/i,
  /unavailable/i,
  /try again/i,
  /network/i,
  /fetch failed/i,
  /econnreset/i,
  /\b(130429|131056|131016|131000|500|502|503|504)\b/,
]

/** Never going to reach this person: do not retry, do not roll over. */
export function isPermanentFailure(message: string | null | undefined): boolean {
  const m = message ?? ''
  return PERMANENT.some((r) => r.test(m))
}

/** Looks like a temporary problem on the way, so a second attempt may work. */
export function isRetryableFailure(message: string | null | undefined): boolean {
  const m = message ?? ''
  if (!m || isPermanentFailure(m)) return false
  return TRANSIENT.some((r) => r.test(m))
}
