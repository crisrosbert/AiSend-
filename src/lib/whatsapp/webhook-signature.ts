import crypto from 'node:crypto'

/**
 * Verify the HMAC-SHA256 signature Meta attaches to webhook POSTs.
 *
 * ── WHY THIS MATTERS ─────────────────────────────────────────────────
 * This endpoint is public and its URL is known to Meta, to anyone who
 * has ever seen a config screen, and to anyone who guesses it. Without
 * the signature check, a stranger can POST whatever they like and the
 * app will treat it as a real customer message: create contacts, open
 * conversations, run automations, spend model credits, and send replies
 * to phone numbers of their choosing. The signature is the only thing
 * separating "a message from Meta" from "a message from anyone".
 *
 * ── SETUP MODE ───────────────────────────────────────────────────────
 * There is a real chicken-and-egg problem when first connecting a
 * number: until META_APP_SECRET is correct, strict checking rejects
 * every inbound message and the integration looks broken. Setup mode
 * exists for exactly that window — it lets requests through while
 * logging whether the signature would have matched.
 *
 * It now defaults to OFF, and is turned on by an environment variable
 * rather than by editing this file. Two reasons:
 *
 *   1. Secure by default. A deployment nobody has thought about is
 *      protected, instead of being open until someone remembers to
 *      flip a constant. This file shipped to production with the
 *      constant still set to true, which is exactly the failure mode
 *      a default is supposed to prevent.
 *
 *   2. Reversible without a deploy. If flipping to strict breaks
 *      inbound messages at a bad moment, setting WEBHOOK_SETUP_MODE=true
 *      in Vercel restores traffic in about thirty seconds — no commit,
 *      no build, no waiting.
 *
 * To use it: set WEBHOOK_SETUP_MODE=true in the environment, watch the
 * logs until they show "signature OK", then remove the variable. Leave
 * it set and you have no spoofing protection at all.
 */

/**
 * Off unless explicitly requested. Compared against the exact string
 * 'true' so that a stray '1', 'yes' or 'false' leaves protection on —
 * an ambiguous value should fail closed, not open.
 *
 * Read per call rather than once at import: a serverless instance can
 * outlive an environment change, and "turn it on without a deploy" is
 * the whole point of the variable.
 */
function setupMode(): boolean {
  return process.env.WEBHOOK_SETUP_MODE === 'true'
}

export function verifyMetaWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
): boolean {
  const SETUP_MODE = setupMode()
  const secret = process.env.META_APP_SECRET

  if (!secret) {
    // Loud, and specific about the consequence. A missing secret is a
    // configuration mistake, and in production it stops inbound
    // messages entirely — that is worth saying plainly in the logs
    // rather than leaving someone to guess why WhatsApp went quiet.
    if (SETUP_MODE) {
      console.warn(
        '[webhook] META_APP_SECRET not set — allowing through because ' +
          'WEBHOOK_SETUP_MODE=true. This endpoint is UNPROTECTED.',
      )
      return true
    }
    console.error(
      '[webhook] META_APP_SECRET not set — rejecting. Inbound WhatsApp ' +
        'messages will not be received until it is configured.',
    )
    return false
  }

  let matched = false
  if (signatureHeader && signatureHeader.startsWith('sha256=')) {
    const expected =
      'sha256=' +
      crypto.createHmac('sha256', secret).update(rawBody).digest('hex')
    const a = Buffer.from(signatureHeader)
    const b = Buffer.from(expected)
    // Length check first: timingSafeEqual throws on a mismatch rather
    // than returning false, and a wrong-length header is attacker
    // controlled.
    if (a.length === b.length) {
      matched = crypto.timingSafeEqual(a, b)
    }
  }

  if (matched) return true

  if (SETUP_MODE) {
    console.warn(
      '[webhook] signature MISMATCH — allowing through because ' +
        'WEBHOOK_SETUP_MODE=true. Check that META_APP_SECRET is the App ' +
        'Secret of the SAME Meta app the webhook is subscribed to, then ' +
        'remove WEBHOOK_SETUP_MODE.',
    )
    return true
  }

  console.warn('[webhook] rejected: signature mismatch')
  return false
}
