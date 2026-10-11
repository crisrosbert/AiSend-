// src/lib/whatsapp/verify-token.ts
//
// Webhook verification (Meta's GET handshake) for /api/whatsapp/webhook.
//
// Two kinds of token can be valid:
//   1. The PLATFORM token — env WHATSAPP_WEBHOOK_VERIFY_TOKEN. This is what
//      the SaaS owner types into the Meta app dashboard (one callback URL for
//      the whole Tech Provider app). It must work with no database rows.
//   2. A TENANT token — stored encrypted in whatsapp_config.verify_token by
//      clients who connect their own Meta app manually.
//
// There is deliberately NO built-in default token: if the env var is not
// set, the platform check matches nothing.

import crypto from 'node:crypto'

function sha256(value: string): Buffer {
  return crypto.createHash('sha256').update(value, 'utf8').digest()
}

/** Constant-time string comparison that is safe for different lengths. */
function safeEqual(a: string, b: string): boolean {
  return crypto.timingSafeEqual(sha256(a), sha256(b))
}

export function platformTokenMatches(provided: string, configured: string | undefined): boolean {
  const expected = configured?.trim()
  if (!expected) return false
  return safeEqual(provided, expected)
}

export function findTenantByVerifyToken<T extends { verify_token: string | null }>(
  provided: string,
  rows: readonly T[],
  decrypt: (ciphertext: string) => string,
): (T & { verify_token: string }) | null {
  if (!provided) return null
  for (const row of rows) {
    if (!row.verify_token) continue
    try {
      if (safeEqual(decrypt(row.verify_token), provided)) return row as T & { verify_token: string }
    } catch {
      // Malformed / wrong-key token row — skip it and keep checking.
    }
  }
  return null
}
