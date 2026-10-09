// src/app/api/meta/leadgen/callback/route.ts
//
// Where Facebook sends the merchant back after they approve the app.
// Finishes the one-click connect: verify the signed state, trade the code
// for tokens, then for EVERY Page the merchant granted — subscribe it to
// `leadgen` and save a lead_sources row holding its (encrypted) Page token.
//
// Connecting every granted Page, rather than adding a "pick a Page" step
// here, is deliberate: Facebook's own dialog already lets the merchant
// choose which Pages to share, so a second picker would ask the same
// question twice. They can disconnect any single Page afterwards.

import crypto from 'node:crypto'
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { currentBusinessId } from '@/lib/business/server'
import { encrypt } from '@/lib/whatsapp/encryption'
import {
  exchangeCodeForLongLivedToken,
  listManagedPages,
  redirectUriFor,
  subscribePageToLeadgen,
  checkState,
} from '@/lib/meta/leadgen-oauth'

function backToSources(request: Request, params: Record<string, string>) {
  const url = new URL('/leads/sources', request.url)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  return NextResponse.redirect(url)
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)

  // The merchant pressed "Cancel" in Facebook's dialog — not an error.
  if (searchParams.get('error')) {
    return backToSources(request, { meta: 'error', reason: 'cancelled' })
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.redirect(new URL('/login', request.url))

  const code = searchParams.get('code')
  const stateCheck = checkState(searchParams.get('state'), user.id)
  if (!code || stateCheck !== 'ok') {
    // Say which check failed — "expired" was hiding three different causes.
    console.warn('[meta-leadgen] callback rejected:', {
      hasCode: !!code,
      stateCheck,
      params: [...searchParams.keys()],
      host: new URL(request.url).host,
    })
    const reason = !code
      ? 'no_code'
      : stateCheck === 'expired'
        ? 'invalid_state'
        : stateCheck === 'wrong_user'
          ? 'wrong_user'
          : 'bad_state'
    return backToSources(request, { meta: 'error', reason })
  }

  try {
    const userToken = await exchangeCodeForLongLivedToken(code, redirectUriFor(request.url))
    const pages = await listManagedPages(userToken)

    if (pages.length === 0) {
      return backToSources(request, { meta: 'error', reason: 'no_pages' })
    }

    const businessId = await currentBusinessId(supabase, user.id)
    let connected = 0
    let failedPage: string | null = null

    for (const page of pages) {
      try {
        await subscribePageToLeadgen(page.id, page.accessToken)
      } catch (err) {
        // Most often: the merchant isn't an admin of this Page with
        // "manage leads" access. Skip it and keep going — one bad Page
        // must not stop the others connecting.
        console.warn(`[meta-leadgen] subscribe failed for page ${page.id}:`, err)
        failedPage = failedPage ?? page.name
        continue
      }

      const encryptedToken = encrypt(page.accessToken)

      const { data: existing } = await supabase
        .from('lead_sources')
        .select('id')
        .eq('user_id', user.id)
        .eq('source_type', 'meta_leadgen')
        .eq('meta_page_id', page.id)
        .maybeSingle()

      if (existing) {
        // Reconnecting: refresh the token and switch it back on.
        await supabase
          .from('lead_sources')
          .update({ name: page.name, meta_page_access_token: encryptedToken, is_active: true })
          .eq('id', existing.id)
      } else {
        await supabase.from('lead_sources').insert({
          user_id: user.id,
          business_id: businessId,
          name: page.name,
          source_type: 'meta_leadgen',
          // api_key is NOT NULL UNIQUE for every source; a Page-based
          // source never uses it, so it just gets an unguessable filler.
          api_key: `meta_${crypto.randomBytes(24).toString('hex')}`,
          meta_page_id: page.id,
          meta_page_access_token: encryptedToken,
        })
      }
      connected++
    }

    if (connected === 0) {
      return backToSources(request, { meta: 'error', reason: 'subscribe_failed', page: failedPage ?? '' })
    }
    return backToSources(request, { meta: 'connected', count: String(connected) })
  } catch (err) {
    console.error('[meta-leadgen] callback failed:', err)
    return backToSources(request, {
      meta: 'error',
      reason: 'exchange_failed',
      detail: err instanceof Error ? err.message.slice(0, 160) : '',
    })
  }
}
