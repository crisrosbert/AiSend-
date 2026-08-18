// src/lib/meta/signed-request.ts
//
// Parses and verifies the `signed_request` Meta sends to callbacks —
// the Data Deletion Request callback and the Deauthorize callback both
// use it.
//
// ── WHY VERIFICATION IS THE WHOLE POINT ──────────────────────────────
// The callback URL is public. Anyone can POST to it. The only thing
// separating a genuine deletion request from someone typing a curl
// command is this signature, which is an HMAC computed with our app
// secret — a value only Meta and we hold.
//
// Get this wrong and a stranger can delete a business's entire account
// by guessing a user id. So the parsing is deliberately strict: wrong
// shape, wrong algorithm, wrong signature, missing user — all refused,
// with no attempt to be helpful about which.
//
// ── THE FORMAT ───────────────────────────────────────────────────────
//   signed_request = "<signature>.<payload>"
//
// Both halves are base64url. The signature is HMAC-SHA256 over the
// payload EXACTLY as it arrived — the encoded string, not the decoded
// JSON. Re-encoding before hashing is the classic way to break this,
// because base64 has more than one valid encoding of the same bytes.

import crypto from 'crypto'

export interface SignedRequestPayload {
  /** Meta's id for the person, scoped to our app. */
  userId: string
  /** Unix seconds, as Meta issued it. */
  issuedAt: number
  /** Anything else Meta included, untouched. */
  raw: Record<string, unknown>
}

export type SignedRequestResult =
  | { ok: true; payload: SignedRequestPayload }
  | { ok: false; reason: string }

/**
 * Verify a signed_request and return its payload.
 *
 * `reason` is for our logs only. It is never shown to the caller: a
 * message distinguishing "bad signature" from "unknown user" tells an
 * attacker which half of their guess was right.
 */
export function verifySignedRequest(
  signedRequest: string | null | undefined,
  appSecret: string | undefined,
): SignedRequestResult {
  if (!appSecret) return { ok: false, reason: 'META_APP_SECRET is not configured' }
  if (!signedRequest || typeof signedRequest !== 'string') {
    return { ok: false, reason: 'missing signed_request' }
  }

  const parts = signedRequest.split('.')
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    return { ok: false, reason: 'malformed signed_request' }
  }

  const [encodedSignature, encodedPayload] = parts

  let expected: Buffer
  let provided: Buffer
  try {
    provided = base64UrlToBuffer(encodedSignature)
    // Hash the payload string as received. Decoding and re-encoding it
    // first would change the bytes for any non-canonical encoding and
    // reject requests that are actually valid.
    expected = crypto.createHmac('sha256', appSecret).update(encodedPayload).digest()
  } catch {
    return { ok: false, reason: 'signature is not valid base64url' }
  }

  // Length must match before timingSafeEqual, which throws otherwise.
  if (provided.length !== expected.length) {
    return { ok: false, reason: 'signature length mismatch' }
  }
  // Constant time: a plain === leaks how much of the signature was
  // correct through timing, which is enough to forge one byte at a time.
  if (!crypto.timingSafeEqual(provided, expected)) {
    return { ok: false, reason: 'signature mismatch' }
  }

  let parsed: Record<string, unknown>
  try {
    parsed = JSON.parse(base64UrlToBuffer(encodedPayload).toString('utf8'))
  } catch {
    return { ok: false, reason: 'payload is not valid JSON' }
  }

  if (typeof parsed !== 'object' || parsed === null) {
    return { ok: false, reason: 'payload is not an object' }
  }

  // Meta states the algorithm in the payload. Accepting whatever it
  // claims would let a forged request nominate a weaker one.
  const algorithm = String(parsed.algorithm || '').toUpperCase()
  if (algorithm !== 'HMAC-SHA256') {
    return { ok: false, reason: `unsupported algorithm: ${algorithm || 'none'}` }
  }

  const userId = typeof parsed.user_id === 'string' ? parsed.user_id.trim() : ''
  if (!userId) return { ok: false, reason: 'payload has no user_id' }

  const issuedAt = Number(parsed.issued_at)

  return {
    ok: true,
    payload: {
      userId,
      issuedAt: Number.isFinite(issuedAt) ? issuedAt : 0,
      raw: parsed,
    },
  }
}

/** base64url → Buffer. Meta omits padding; Node needs it restored. */
function base64UrlToBuffer(value: string): Buffer {
  const normalised = value.replace(/-/g, '+').replace(/_/g, '/')
  const padded = normalised + '='.repeat((4 - (normalised.length % 4)) % 4)
  return Buffer.from(padded, 'base64')
}

/**
 * Build a signed_request the way Meta does.
 *
 * Exported for the tests: verification code that has only ever been fed
 * hand-written strings has not been shown to accept a real request.
 */
export function buildSignedRequest(
  payload: Record<string, unknown>,
  appSecret: string,
): string {
  const encodedPayload = bufferToBase64Url(Buffer.from(JSON.stringify(payload), 'utf8'))
  const signature = crypto.createHmac('sha256', appSecret).update(encodedPayload).digest()
  return `${bufferToBase64Url(signature)}.${encodedPayload}`
}

function bufferToBase64Url(buffer: Buffer): string {
  return buffer.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/**
 * A short, unambiguous code the person can quote when checking on
 * their request.
 *
 * Crockford base32 — no I, L, O or U, so it cannot be misread down a
 * phone line and cannot accidentally spell anything. Random rather than
 * sequential, because a guessable code would let anyone read anyone
 * else's deletion status.
 */
export function newConfirmationCode(): string {
  const alphabet = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'
  const bytes = crypto.randomBytes(12)
  let code = ''
  for (let i = 0; i < 12; i++) code += alphabet[bytes[i] % alphabet.length]
  return `DEL-${code.slice(0, 4)}-${code.slice(4, 8)}-${code.slice(8, 12)}`
}
