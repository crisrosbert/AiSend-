// src/lib/webhooks/sign.ts
//
// HMAC-SHA256 signing for outbound webhook deliveries, in the same
// shape Stripe (and Wassist's documented webhook product) use:
//
//   X-AiSend-Signature: t=<unix seconds>,v1=<hex hmac>
//
// where the signed payload is `${timestamp}.${rawBody}` — the
// timestamp is folded INTO the signed bytes, not sent alongside it
// unverified, so a receiver can reject a replayed-but-otherwise-valid
// request once it's older than the tolerance window.

import crypto from 'node:crypto'

const DEFAULT_TOLERANCE_SECONDS = 5 * 60

export function signPayload(secret: string, rawBody: string, timestamp: number): string {
  const signedPayload = `${timestamp}.${rawBody}`
  const hex = crypto.createHmac('sha256', secret).update(signedPayload).digest('hex')
  return `t=${timestamp},v1=${hex}`
}

interface ParsedSignatureHeader {
  timestamp: number
  signature: string
}

function parseSignatureHeader(header: string): ParsedSignatureHeader | null {
  const parts = new Map<string, string>()
  for (const segment of header.split(',')) {
    const [key, value] = segment.split('=')
    if (key && value) parts.set(key.trim(), value.trim())
  }
  const t = parts.get('t')
  const v1 = parts.get('v1')
  if (!t || !v1) return null
  const timestamp = Number(t)
  if (!Number.isFinite(timestamp)) return null
  return { timestamp, signature: v1 }
}

/**
 * Verify a signature a receiver would compute on their end — exported
 * mainly so our own tests (and any internal consumer we build that
 * receives AiSend's own webhooks) can check round-trip correctness
 * without duplicating the parsing logic.
 */
export function verifySignature(
  secret: string,
  rawBody: string,
  header: string | null,
  toleranceSeconds = DEFAULT_TOLERANCE_SECONDS,
): boolean {
  if (!header) return false
  const parsed = parseSignatureHeader(header)
  if (!parsed) return false

  const nowSeconds = Math.floor(Date.now() / 1000)
  if (Math.abs(nowSeconds - parsed.timestamp) > toleranceSeconds) return false

  const expected = crypto
    .createHmac('sha256', secret)
    .update(`${parsed.timestamp}.${rawBody}`)
    .digest('hex')

  const a = Buffer.from(parsed.signature)
  const b = Buffer.from(expected)
  if (a.length !== b.length) return false
  return crypto.timingSafeEqual(a, b)
}

/** A fresh per-endpoint signing secret — 32 random bytes, hex-encoded. */
export function generateSecret(): string {
  return `whsec_${crypto.randomBytes(32).toString('hex')}`
}
