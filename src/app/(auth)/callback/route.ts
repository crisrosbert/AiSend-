// src/app/(auth)/callback/route.ts
//
// ── NOTE ON THE PATH ─────────────────────────────────────────────────
// This file lives inside the (auth) route GROUP. Parentheses mean the
// folder name is dropped from the URL, so this handler serves
//
//     /callback          ← not /auth/callback
//
// That is a perfectly good endpoint; it just has to match what we tell
// Google, Facebook and Supabase to redirect back to. Every redirectTo in
// the app points at /callback, and Supabase's redirect allow-list must
// list it too. Change one and you must change all of them.
//
// OAuth landing strip. Google/Facebook send the browser back here with a
// one-time `code`; this route trades it for a session cookie and then
// forwards the user into the app.
//
// Without this handler the social buttons would bounce the user to a URL
// that sets no session, and they would silently end up back on /login —
// which reads as "my Google account doesn't work here".

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/** Only allow same-site relative paths — never redirect to a foreign host. */
function safeNext(raw: string | null): string {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//')) return '/dashboard'
  return raw
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const next = safeNext(searchParams.get('next'))

  // The provider reports user-facing failures (consent denied, app
  // misconfigured) as query params rather than an HTTP error.
  const providerError =
    searchParams.get('error_description') || searchParams.get('error')
  if (providerError) {
    return redirectTo(request, `/login?error=${encodeURIComponent(providerError)}`)
  }

  const code = searchParams.get('code')
  if (!code) {
    return redirectTo(
      request,
      `/login?error=${encodeURIComponent('Sign-in link was incomplete. Please try again.')}`,
    )
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.exchangeCodeForSession(code)
  if (error) {
    return redirectTo(request, `/login?error=${encodeURIComponent(error.message)}`)
  }

  // Tenants with their own slug get their branded dashboard; everyone
  // else (including every fresh OAuth signup, which has no slug yet)
  // falls back to /dashboard, matching what middleware.ts does.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user && next === '/dashboard') {
    const { data: profile } = await supabase
      .from('profiles')
      .select('slug')
      .eq('user_id', user.id)
      .maybeSingle()
    if (profile?.slug) {
      return redirectTo(request, `/${profile.slug}/dashboard`)
    }
  }

  return redirectTo(request, next)
}

/**
 * Build an absolute redirect that survives a reverse proxy.
 *
 * On Vercel the request URL's origin is the internal host, so redirecting
 * to `origin` would drop the user on a URL their browser can't reach.
 * `x-forwarded-host` carries the real one.
 */
function redirectTo(request: Request, path: string) {
  const { origin } = new URL(request.url)
  const forwardedHost = request.headers.get('x-forwarded-host')
  const isLocal = process.env.NODE_ENV === 'development'

  if (!isLocal && forwardedHost) {
    const proto = request.headers.get('x-forwarded-proto') ?? 'https'
    return NextResponse.redirect(`${proto}://${forwardedHost}${path}`)
  }
  return NextResponse.redirect(`${origin}${path}`)
}
