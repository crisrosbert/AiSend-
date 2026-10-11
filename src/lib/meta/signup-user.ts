// src/lib/meta/signup-user.ts
//
// Who is the PERSON behind an Embedded Signup?
//
// Meta's deauthorize and data-deletion callbacks name a person only by their
// Facebook user id. A client who registered with e-mail + password has no
// Facebook identity in our auth tables, so unless we record the id at signup
// their deletion request matches nobody. This module finds that id from
// sources Meta vouches for, in order:
//
//   1. A `signed_request` from the Facebook SDK login response, verified
//      with our app secret (same HMAC check as the callbacks).
//   2. Meta's own answer to "who owns this token?" (/debug_token), accepted
//      only for a real person's token — a system-user token's id is the
//      system user, which would never match a callback.
//
// A bare user id sent by the browser is never used: anyone could claim
// someone else's id and divert that person's deletion request.
//
// Best effort by design: failing to learn the id must not block a client
// from connecting WhatsApp, so every failure resolves to `userId: null` with
// a fixed, secret-free reason for the logs.

import { verifySignedRequest } from './signed-request'

export type SignupUserResult =
  | { userId: string; source: 'signed_request' | 'debug_token' }
  | { userId: null; reason: string }

export async function resolveSignupMetaUserId(opts: {
  signedRequest?: string | null
  accessToken: string
  appId: string
  appSecret: string
  graphBase: string
  fetchFn?: typeof fetch
}): Promise<SignupUserResult> {
  const { signedRequest, accessToken, appId, appSecret, graphBase, fetchFn = fetch } = opts

  if (signedRequest) {
    const verified = verifySignedRequest(signedRequest, appSecret)
    if (verified.ok) return { userId: verified.payload.userId, source: 'signed_request' }
    // Not trusted — fall through to asking Meta directly.
  }

  try {
    const url =
      `${graphBase}/debug_token` +
      `?input_token=${encodeURIComponent(accessToken)}` +
      `&access_token=${encodeURIComponent(`${appId}|${appSecret}`)}`
    const res = await fetchFn(url)
    if (!res.ok) return { userId: null, reason: `debug_token returned HTTP ${res.status}` }

    const body = (await res.json().catch(() => null)) as {
      data?: { is_valid?: boolean; type?: string; user_id?: string | number }
    } | null
    const data = body?.data
    if (!data || data.is_valid === false) return { userId: null, reason: 'debug_token: token not valid' }
    if (data.type !== 'USER') {
      return { userId: null, reason: `debug_token: token type is ${String(data.type)}, not a person` }
    }
    const userId = data.user_id == null ? '' : String(data.user_id).trim()
    if (!userId) return { userId: null, reason: 'debug_token: no user_id in reply' }
    return { userId, source: 'debug_token' }
  } catch {
    // Deliberately not echoing the error: transport errors can embed the
    // request URL, which carries the app secret.
    return { userId: null, reason: 'debug_token request failed' }
  }
}
