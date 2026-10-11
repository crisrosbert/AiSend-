// src/lib/meta/signup-user.test.ts
//
// Meta's deauthorize / data-deletion callbacks identify a person only by
// their Facebook user id. We have to learn that id when they complete
// Embedded Signup and store it, or an e-mail-signup client's deletion
// request finds nobody ("no_data") and nothing gets erased.
//
// The id may only come from something Meta vouches for. A plain `userID`
// typed into the request body by the browser is NOT acceptable: anyone could
// claim someone else's id and hijack — or pre-empt — their deletion request.

import { describe, it, expect, vi } from 'vitest'
import { resolveSignupMetaUserId } from './signup-user'
import { buildSignedRequest } from './signed-request'

const APP_ID = '1234500000'
const SECRET = 'app-secret-xyz'
const GRAPH = 'https://graph.facebook.com/v23.0'

function signed(userId: string, secret = SECRET) {
  return buildSignedRequest(
    { algorithm: 'HMAC-SHA256', issued_at: 1786000000, user_id: userId },
    secret,
  )
}

function debugTokenReply(data: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify({ data }), { status })
}

function fakeFetch(reply: Response | Error) {
  return vi.fn<typeof fetch>(async () => {
    if (reply instanceof Error) throw reply
    return reply
  })
}

const base = { accessToken: 'client-token', appId: APP_ID, appSecret: SECRET, graphBase: GRAPH }

describe('resolveSignupMetaUserId', () => {
  it('uses the user id from a signed_request that Meta signed with our app secret', async () => {
    const fetchFn = fakeFetch(new Error('should not be needed'))
    const result = await resolveSignupMetaUserId({ ...base, signedRequest: signed('777'), fetchFn })
    expect(result).toEqual({ userId: '777', source: 'signed_request' })
    expect(fetchFn).not.toHaveBeenCalled()
  })

  it('never trusts a signed_request signed with a different secret — it falls back to Meta\'s own answer', async () => {
    const fetchFn = fakeFetch(debugTokenReply({ is_valid: true, type: 'USER', user_id: '999' }))
    const result = await resolveSignupMetaUserId({
      ...base,
      signedRequest: signed('666-claimed-by-attacker', 'some-other-secret'),
      fetchFn,
    })
    expect(result).toEqual({ userId: '999', source: 'debug_token' })
  })

  it('asks Meta who owns the token (debug_token with our app token) when there is no signed_request', async () => {
    const fetchFn = fakeFetch(debugTokenReply({ is_valid: true, type: 'USER', user_id: '999' }))
    const result = await resolveSignupMetaUserId({ ...base, fetchFn })

    expect(result).toEqual({ userId: '999', source: 'debug_token' })
    const url = new URL(String(fetchFn.mock.calls[0][0]))
    expect(url.origin + url.pathname).toBe('https://graph.facebook.com/v23.0/debug_token')
    expect(url.searchParams.get('input_token')).toBe('client-token')
    expect(url.searchParams.get('access_token')).toBe(`${APP_ID}|${SECRET}`)
  })

  it.each([
    ['a system-user token (its id is not the person who signed up)', { is_valid: true, type: 'SYSTEM_USER', user_id: '42' }],
    ['a token Meta says is invalid', { is_valid: false, type: 'USER', user_id: '42' }],
    ['a reply with no user id', { is_valid: true, type: 'USER' }],
  ])('returns no id for %s', async (_label, data) => {
    const result = await resolveSignupMetaUserId({ ...base, fetchFn: fakeFetch(debugTokenReply(data)) })
    expect(result.userId).toBeNull()
  })

  it('returns no id — and does not throw — when Meta answers with an error status', async () => {
    const result = await resolveSignupMetaUserId({
      ...base,
      fetchFn: fakeFetch(debugTokenReply({}, 400)),
    })
    expect(result.userId).toBeNull()
  })

  it('returns no id — and does not leak the app secret — when the request itself fails', async () => {
    const result = await resolveSignupMetaUserId({
      ...base,
      // A transport error whose message embeds the full request URL.
      fetchFn: fakeFetch(new Error(`request to ${GRAPH}/debug_token?access_token=${APP_ID}|${SECRET} failed`)),
    })
    expect(result.userId).toBeNull()
    expect(JSON.stringify(result)).not.toContain(SECRET)
  })
})
