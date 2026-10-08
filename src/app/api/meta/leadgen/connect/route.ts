// src/app/api/meta/leadgen/connect/route.ts
//
// "Connect with Facebook" button target. Signed-in merchants only; sends
// them to Meta's login dialog with a signed state, and returns them to
// /api/meta/leadgen/callback. Failures redirect back to the Lead Sources
// page with a readable reason instead of showing raw JSON in the browser.

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { buildAuthUrl, redirectUriFor, signState } from '@/lib/meta/leadgen-oauth'

function backToSources(request: Request, reason: string) {
  const url = new URL('/leads/sources', request.url)
  url.searchParams.set('meta', 'error')
  url.searchParams.set('reason', reason)
  return NextResponse.redirect(url)
}

export async function GET(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.redirect(new URL('/login', request.url))

  if (!process.env.META_APP_ID || !process.env.META_APP_SECRET) {
    return backToSources(request, 'not_configured')
  }

  const authUrl = buildAuthUrl(redirectUriFor(request.url), signState(user.id))
  return NextResponse.redirect(authUrl)
}
