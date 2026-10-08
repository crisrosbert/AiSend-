// src/lib/meta/leadgen-oauth.ts
//
// ── WHY THIS EXISTS ──────────────────────────────────────────────────
// A merchant should connect Meta Lead Ads the way they connect anything
// else in a SaaS: press "Connect with Facebook", tick their Page, done.
// No API key, no Zapier, no webhook URL pasted into Meta.
//
// What "done" has to mean underneath:
//   1. The merchant authorises OUR Meta app (Facebook Login dialog) for
//      the Pages they choose, with the lead-retrieval permissions.
//   2. We trade the one-time `code` for a long-lived user token, and
//      from it get a Page Access Token for every Page they granted
//      (Page tokens derived from a long-lived user token don't expire).
//   3. We subscribe each Page to OUR app's `leadgen` field. Without this
//      call Meta never sends us that Page's leads, however correctly
//      everything else is configured — it is the step people forget.
//   4. We store the Page token (encrypted) so /api/meta/leadgen can
//      fetch the lead's answers when Meta's webhook fires.
//
// ── ONE-TIME SETUP BY THE SAAS OWNER (not each merchant) ────────────
//   • Meta app → Facebook Login → Valid OAuth Redirect URI:
//       {SITE_URL}/api/meta/leadgen/callback
//   • Meta app → Webhooks → Page → callback URL {SITE_URL}/api/meta/leadgen,
//       verify token = META_LEADGEN_VERIFY_TOKEN, subscribe to `leadgen`.
//   • Permissions leads_retrieval, pages_show_list, pages_manage_metadata,
//     pages_read_engagement need Advanced Access (Meta App Review) before
//     ordinary merchants can use this. While the app is in Development
//     mode it works for the app's own admins/testers — enough to demo.

import crypto from 'node:crypto'

export const GRAPH = 'https://graph.facebook.com/v21.0'

export const LEADGEN_SCOPES = [
  'pages_show_list',
  'pages_read_engagement',
  'pages_manage_metadata',
  'leads_retrieval',
].join(',')

const STATE_TTL_MS = 10 * 60 * 1000

function stateSecret(): string {
  const secret = process.env.META_APP_SECRET
  if (!secret) throw new Error('META_APP_SECRET is not configured')
  return secret
}

/**
 * Signed `state` for the OAuth round trip. It carries the user id so the
 * callback can confirm the person finishing the flow is the person who
 * started it — otherwise a crafted callback link could attach someone
 * else's Facebook Pages to a victim's account (classic OAuth CSRF).
 */
export function signState(userId: string): string {
  const payload = Buffer.from(JSON.stringify({ u: userId, t: Date.now() })).toString('base64url')
  const sig = crypto.createHmac('sha256', stateSecret()).update(payload).digest('base64url')
  return `${payload}.${sig}`
}

export function verifyState(state: string | null, expectedUserId: string): boolean {
  if (!state) return false
  const [payload, sig] = state.split('.')
  if (!payload || !sig) return false

  const expected = crypto.createHmac('sha256', stateSecret()).update(payload).digest('base64url')
  const a = Buffer.from(sig)
  const b = Buffer.from(expected)
  // timingSafeEqual throws on unequal lengths, so compare lengths first.
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return false

  try {
    const { u, t } = JSON.parse(Buffer.from(payload, 'base64url').toString())
    return u === expectedUserId && typeof t === 'number' && Date.now() - t < STATE_TTL_MS
  } catch {
    return false
  }
}

export function redirectUriFor(requestUrl: string): string {
  const base = process.env.NEXT_PUBLIC_SITE_URL || new URL(requestUrl).origin
  return `${base.replace(/\/$/, '')}/api/meta/leadgen/callback`
}

export function buildAuthUrl(redirectUri: string, state: string): string {
  const appId = process.env.META_APP_ID
  if (!appId) throw new Error('META_APP_ID is not configured')
  const params = new URLSearchParams({
    client_id: appId,
    redirect_uri: redirectUri,
    state,
    scope: LEADGEN_SCOPES,
    response_type: 'code',
  })
  return `https://www.facebook.com/v21.0/dialog/oauth?${params.toString()}`
}

async function graphJson(url: string, init?: RequestInit): Promise<Record<string, unknown>> {
  const res = await fetch(url, init)
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>
  if (!res.ok) {
    const message = (json.error as { message?: string } | undefined)?.message || `Graph API ${res.status}`
    throw new Error(message)
  }
  return json
}

/** code → short-lived user token → long-lived user token. */
export async function exchangeCodeForLongLivedToken(code: string, redirectUri: string): Promise<string> {
  const appId = process.env.META_APP_ID
  const appSecret = process.env.META_APP_SECRET
  if (!appId || !appSecret) throw new Error('META_APP_ID / META_APP_SECRET are not configured')

  const short = await graphJson(
    `${GRAPH}/oauth/access_token?` +
      new URLSearchParams({ client_id: appId, client_secret: appSecret, redirect_uri: redirectUri, code }),
  )
  if (typeof short.access_token !== 'string') throw new Error('Meta did not return an access token')

  const long = await graphJson(
    `${GRAPH}/oauth/access_token?` +
      new URLSearchParams({
        grant_type: 'fb_exchange_token',
        client_id: appId,
        client_secret: appSecret,
        fb_exchange_token: short.access_token,
      }),
  )
  return typeof long.access_token === 'string' ? long.access_token : short.access_token
}

export interface ManagedPage {
  id: string
  name: string
  accessToken: string
}

/** Every Page the merchant granted us, each with its own Page token. */
export async function listManagedPages(userToken: string): Promise<ManagedPage[]> {
  const pages: ManagedPage[] = []
  let url: string | null =
    `${GRAPH}/me/accounts?` + new URLSearchParams({ fields: 'id,name,access_token', limit: '100', access_token: userToken })

  // Bounded loop: a merchant with hundreds of Pages shouldn't hang the callback.
  for (let i = 0; url && i < 5; i++) {
    const json: Record<string, unknown> = await graphJson(url)
    for (const p of (json.data as Array<{ id: string; name: string; access_token?: string }>) ?? []) {
      if (p.access_token) pages.push({ id: p.id, name: p.name, accessToken: p.access_token })
    }
    url = (json.paging as { next?: string } | undefined)?.next ?? null
  }
  return pages
}

/** The step that makes Meta start sending this Page's leads to our webhook. */
export async function subscribePageToLeadgen(pageId: string, pageToken: string): Promise<void> {
  await graphJson(`${GRAPH}/${pageId}/subscribed_apps`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ subscribed_fields: 'leadgen', access_token: pageToken }),
  })
}

export async function unsubscribePage(pageId: string, pageToken: string): Promise<void> {
  await graphJson(`${GRAPH}/${pageId}/subscribed_apps?` + new URLSearchParams({ access_token: pageToken }), {
    method: 'DELETE',
  })
}
