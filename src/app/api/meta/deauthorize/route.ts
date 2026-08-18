// src/app/api/meta/deauthorize/route.ts
//
// Meta's Deauthorize callback.
//
// Called when a business removes our app from their Facebook settings,
// or revokes its permissions. Meta requires the URL to exist; App
// Review asks for it alongside the data deletion callback.
//
// ── DEAUTHORIZE IS NOT DELETION ──────────────────────────────────────
// This is the distinction that matters, and conflating the two would be
// the most damaging bug in the product.
//
//   Deauthorize → "stop acting on my behalf."   Keep their data.
//   Data deletion → "erase everything."          Remove their data.
//
// A business might disconnect to switch numbers, to pause over a
// holiday, or by accident. If they reconnect next week their contacts,
// conversations and campaign history must all still be there. So this
// route closes the connection and nothing else. Erasure has its own
// callback, its own confirmation code, and its own audit trail.
//
// ── WHAT IT ACTUALLY DOES ────────────────────────────────────────────
// Marks the WhatsApp connection disconnected and drops the stored
// access token. The token is already dead — Meta revoked it the moment
// they deauthorised — so keeping it buys nothing and leaves a
// credential lying in the database. Reconnecting runs Embedded Signup
// again and issues a fresh one.
//
// Configure in the Meta app dashboard:
//   Deauthorize Callback URL → https://<your-domain>/api/meta/deauthorize

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifySignedRequest } from '@/lib/meta/signed-request'
import { findTenantByFacebookId } from '@/lib/meta/tenant-lookup'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _db: any = null
function db() {
  if (!_db) {
    _db = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )
  }
  return _db
}

export async function POST(request: Request) {
  try {
    // Meta posts this form-encoded; JSON is accepted too, at no cost.
    let signedRequest: string | null = null
    const contentType = request.headers.get('content-type') || ''

    if (contentType.includes('application/json')) {
      const body = await request.json().catch(() => ({}))
      signedRequest = typeof body?.signed_request === 'string' ? body.signed_request : null
    } else {
      const form = await request.formData().catch(() => null)
      const value = form?.get('signed_request')
      signedRequest = typeof value === 'string' ? value : null
    }

    const verified = verifySignedRequest(signedRequest, process.env.META_APP_SECRET)

    if (!verified.ok) {
      // The URL is public. Without this check, anyone could disconnect
      // any business's WhatsApp number by guessing a user id.
      console.error('[deauthorize] rejected:', verified.reason)
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
    }

    const metaUserId = verified.payload.userId
    const tenantId = await findTenantByFacebookId(db(), metaUserId)

    if (!tenantId) {
      // Genuine request, nobody to act on — someone who signed in with
      // Facebook once and never connected a number. Acknowledged, not
      // retried: there is nothing a retry would achieve.
      console.log('[deauthorize] no account matched Meta user', metaUserId)
      return NextResponse.json({ success: true, matched: false })
    }

    // Close the connection. Deliberately narrow: status, token, and
    // nothing else. No contacts, no conversations, no agents.
    const { error } = await db()
      .from('whatsapp_config')
      .update({
        status: 'disconnected',
        // NOT NULL on this column, so it is emptied rather than nulled.
        access_token: '',
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', tenantId)

    if (error) {
      console.error('[deauthorize] could not disconnect:', error.message)
      // A 500 makes Meta retry, which is right: until this succeeds we
      // are holding a revoked token and showing the business as
      // connected when they are not.
      return NextResponse.json({ error: 'Could not disconnect' }, { status: 500 })
    }

    console.log('[deauthorize] disconnected WhatsApp for tenant', tenantId)

    return NextResponse.json({ success: true, matched: true })
  } catch (err) {
    console.error('[deauthorize] unhandled:', err)
    return NextResponse.json({ error: 'Could not disconnect' }, { status: 500 })
  }
}

/**
 * Meta probes the URL with a GET before saving it in the dashboard.
 * A plain answer beats a 405 that reads as a missing endpoint.
 */
export async function GET() {
  return NextResponse.json({
    message:
      'This endpoint receives deauthorization notices from Meta. Removing the app disconnects WhatsApp but keeps your account and data — to erase your data, use the data deletion request in your Facebook settings.',
  })
}
