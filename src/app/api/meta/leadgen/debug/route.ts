// src/app/api/meta/leadgen/debug/route.ts
//
// Temporary diagnostic — shows exactly what auth URL would be built,
// without redirecting. Hit /api/meta/leadgen/debug while logged in.
// DELETE THIS FILE before going to production.

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { buildAuthUrl, redirectUriFor, LEADGEN_SCOPES } from '@/lib/meta/leadgen-oauth'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'not logged in' }, { status: 401 })

  const redirectUri = redirectUriFor(request.url)

  const diagnostic = {
    env: {
      META_APP_ID: process.env.META_APP_ID ? `${process.env.META_APP_ID.slice(0, 6)}...` : '❌ NOT SET',
      META_APP_SECRET: process.env.META_APP_SECRET ? '✅ set (hidden)' : '❌ NOT SET',
      META_LOGIN_CONFIG_ID: process.env.META_LOGIN_CONFIG_ID || '❌ NOT SET — this is likely the problem',
      NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL || '❌ NOT SET',
      META_LEADGEN_VERIFY_TOKEN: process.env.META_LEADGEN_VERIFY_TOKEN ? '✅ set (hidden)' : '❌ NOT SET',
    },
    computed: {
      redirectUri,
      requestOrigin: new URL(request.url).origin,
    },
    authUrl: '(see below)',
    checklist: [
      `redirect_uri = ${redirectUri}`,
      'This EXACT URL must be in: Facebook App → Facebook Login → Settings → Valid OAuth Redirect URIs',
      `App Domains must include: ${new URL(redirectUri).hostname}`,
      process.env.META_LOGIN_CONFIG_ID
        ? `✅ Using Facebook Login for Business (config_id: ${process.env.META_LOGIN_CONFIG_ID})`
        : '⚠️ Using classic scope-based login. If your Meta app uses "Facebook Login for Business", you MUST set META_LOGIN_CONFIG_ID in Vercel env vars.',
    ],
  }

  try {
    const authUrl = buildAuthUrl(redirectUri, 'TEST_STATE')
    diagnostic.authUrl = authUrl
  } catch (err) {
    diagnostic.authUrl = `ERROR: ${err instanceof Error ? err.message : String(err)}`
  }

  return NextResponse.json(diagnostic, {
    headers: { 'Cache-Control': 'no-store' },
  })
}
