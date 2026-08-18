// src/app/api/meta/data-deletion/route.ts
//
// Meta's Data Deletion Request callback.
//
// When someone removes our app from their Facebook settings and asks
// for their data to be deleted, Meta POSTs here. Meta requires this
// callback to exist — App Review rejects an app without one.
//
// ── WHAT MUST HAPPEN, IN ORDER ───────────────────────────────────────
//   1. Verify the signature. The URL is public; the HMAC is the only
//      thing making a request trustworthy.
//   2. Record the request and answer immediately with a confirmation
//      code and a URL where progress can be checked.
//   3. Delete the data separately, driven by cron.
//
// Step 3 is separate on purpose. Deleting a tenant means removing every
// contact, conversation and message they have — potentially hundreds of
// thousands of rows. Doing that inline would risk the request timing
// out, and a callback that times out is a callback Meta considers
// broken. Answering fast and working afterwards is the shape Meta's own
// design expects, which is why they ask for a status URL at all.
//
// Configure in the Meta app dashboard:
//   Data Deletion Request URL → https://<your-domain>/api/meta/data-deletion

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifySignedRequest, newConfirmationCode } from '@/lib/meta/signed-request'
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
    // Meta sends this form-encoded, but accept JSON too — it costs
    // nothing and saves an afternoon if they ever change it.
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
      // Logged in full for us; the caller gets nothing back that would
      // tell them which part of a forgery attempt was wrong.
      console.error('[data-deletion] rejected:', verified.reason)
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
    }

    const metaUserId = verified.payload.userId
    const confirmationCode = newConfirmationCode()

    // Which of our tenants is this person? A Facebook sign-in stores the
    // provider id against the Supabase user, so that is what we match.
    const tenantId = await findTenantByFacebookId(db(), metaUserId)

    const { error } = await db().from('data_deletion_requests').insert({
      meta_user_id: metaUserId,
      tenant_id: tenantId,
      confirmation_code: confirmationCode,
      // No tenant means nothing to delete. Recorded as its own status so
      // the audit trail shows the request was honoured rather than lost.
      status: tenantId ? 'received' : 'no_data',
      completed_at: tenantId ? null : new Date().toISOString(),
    })

    if (error) {
      console.error('[data-deletion] could not record request:', error.message)
      // Returning 500 makes Meta retry, which is what we want — losing a
      // deletion request silently is the one outcome to avoid.
      return NextResponse.json({ error: 'Could not record request' }, { status: 500 })
    }

    // Exactly the shape Meta expects back.
    return NextResponse.json({
      url: `${originFor(request)}/data-deletion?code=${encodeURIComponent(confirmationCode)}`,
      confirmation_code: confirmationCode,
    })
  } catch (err) {
    console.error('[data-deletion] unhandled:', err)
    return NextResponse.json({ error: 'Could not record request' }, { status: 500 })
  }
}

/**
 * The public origin, taken from the proxy headers Vercel sets. Using
 * request.url would return the internal hostname, and Meta would show
 * the person a status link that does not resolve.
 */
function originFor(request: Request): string {
  const host = request.headers.get('x-forwarded-host') || request.headers.get('host')
  const proto = request.headers.get('x-forwarded-proto') || 'https'
  if (host) return `${proto}://${host}`
  return new URL(request.url).origin
}

/**
 * Meta sometimes probes the URL with a GET before saving it. Answering
 * plainly beats a 405 that looks like the endpoint is missing.
 */
export async function GET() {
  return NextResponse.json({
    message:
      'This endpoint receives data deletion requests from Meta. To check the status of a request, use the link and confirmation code you were given.',
  })
}
