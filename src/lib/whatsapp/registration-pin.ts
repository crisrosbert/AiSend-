// src/lib/whatsapp/registration-pin.ts
//
// Cloud API registration for Embedded Signup numbers.
//
// The PIN passed to POST /{phone-number-id}/register becomes that number's
// two-step-verification PIN. It must therefore be (a) random per number —
// never a shared constant — and (b) stored (encrypted, by the caller) so the
// number can be re-registered or recovered later. If the number already has
// a PIN of ours, we must send that same PIN again rather than a new one.

import crypto from 'node:crypto'

const PIN_PATTERN = /^\d{6}$/

/** A uniformly random six-digit PIN (leading zeros allowed). */
export function generateRegistrationPin(
  randomInt: (min: number, max: number) => number = crypto.randomInt,
): string {
  return String(randomInt(0, 1_000_000)).padStart(6, '0')
}

/**
 * The PIN to register with: the one already stored for this number if it can
 * be read back (`reused: true`), otherwise a new random one.
 */
export function choosePin(
  storedEncryptedPin: string | null | undefined,
  decrypt: (ciphertext: string) => string,
  generate: () => string = generateRegistrationPin,
): { pin: string; reused: boolean } {
  if (storedEncryptedPin) {
    try {
      const pin = decrypt(storedEncryptedPin)
      if (PIN_PATTERN.test(pin)) return { pin, reused: true }
    } catch {
      // Unreadable (wrong key / corrupted) — fall through to a new PIN.
    }
  }
  return { pin: generate(), reused: false }
}

export type RegisterResult = { ok: true } | { ok: false; error: string }

export async function registerPhoneNumber(opts: {
  graphBase: string
  phoneNumberId: string
  accessToken: string
  pin: string
  fetchFn?: typeof fetch
}): Promise<RegisterResult> {
  const { graphBase, phoneNumberId, accessToken, pin, fetchFn = fetch } = opts
  try {
    const res = await fetchFn(`${graphBase}/${phoneNumberId}/register`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ messaging_product: 'whatsapp', pin }),
    })
    if (res.ok) return { ok: true }
    const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null
    return { ok: false, error: body?.error?.message || `Meta returned HTTP ${res.status}` }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Network error contacting Meta' }
  }
}
