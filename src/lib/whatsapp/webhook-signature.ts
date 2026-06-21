import crypto from 'node:crypto'

/**
 * Verify the HMAC-SHA256 signature Meta attaches to webhook POSTs.
 *
 * ⚠️ TEMPORARY SETUP MODE — signature failures are LOGGED but NOT
 * blocked. This unblocks inbound messages / replies / flows while you
 * finish configuring META_APP_SECRET. The function still computes the
 * signature and logs whether it matched, so you can confirm the secret
 * is correct from the Vercel logs.
 *
 * 👉 TO RE-ENABLE STRICT SECURITY: once the logs show
 * "[webhook] signature OK", change `RETURN_ON_MISMATCH` to `false`.
 * That restores spoofing protection (rejects bad signatures with 401).
 */

// While true: never block — always let the request through.
// Flip to false once you've confirmed the secret matches.
const SETUP_MODE = true

export function verifyMetaWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
): boolean {
  const secret = process.env.META_APP_SECRET

  if (!secret) {
    console.warn('[webhook] META_APP_SECRET not set.')
    return SETUP_MODE ? true : false
  }

  let matched = false
  if (signatureHeader && signatureHeader.startsWith('sha256=')) {
    const expected =
      'sha256=' +
      crypto.createHmac('sha256', secret).update(rawBody).digest('hex')
    const a = Buffer.from(signatureHeader)
    const b = Buffer.from(expected)
    if (a.length === b.length) {
      matched = crypto.timingSafeEqual(a, b)
    }
  }

  if (matched) {
    console.log('[webhook] signature OK ✅ — safe to disable SETUP_MODE')
  } else {
    console.warn(
      '[webhook] signature MISMATCH — App Secret is wrong or from the ' +
        'wrong app. Allowing through because SETUP_MODE is on.',
    )
  }

  // In setup mode we always allow through, even on mismatch, so the
  // rest of the pipeline (save message, run flows) can work while you
  // fix the secret.
  return SETUP_MODE ? true : matched
}
