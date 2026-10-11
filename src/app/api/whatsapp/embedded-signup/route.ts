import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { encrypt, decrypt } from '@/lib/whatsapp/encryption'
import { choosePin, registerPhoneNumber } from '@/lib/whatsapp/registration-pin'
import { currentBusinessId } from '@/lib/business/server'
import { GRAPH_BASE_URL } from '@/lib/meta/graph-version'
import { resolveSignupMetaUserId } from '@/lib/meta/signup-user'

/**
 * Embedded Signup — token exchange + auto-connect.
 *
 * This is the "Connect WhatsApp" flow. The client clicks the
 * button, completes Meta's hosted popup (picks/creates their WABA and
 * phone number), and Meta hands the browser a short-lived `code` plus
 * the selected `waba_id` / `phone_number_id`. The browser POSTs those
 * here; we:
 *
 *   1. Exchange the code for a business-scoped access token
 *      (Meta returns a long-lived token for the client's WABA).
 *   2. Save the client's waba_id, phone_number_id, and (encrypted)
 *      token into THIS user's whatsapp_config row.
 *   3. Subscribe our app to the client's WABA so webhooks flow.
 *   4. Record which Facebook user signed up (meta_user_id), so Meta's
 *      deauthorize / data-deletion callbacks can find this client.
 *   5. Register the phone number on Cloud API so it can send, using a
 *      random per-number two-step PIN that is stored encrypted.
 *
 * Requires env: META_APP_ID, META_APP_SECRET.
 *
 * NOTE: Meta only returns a usable token here once the app is published
 * and approved as a Tech Provider with Advanced Access. Until then this
 * route returns Meta's error, which the UI surfaces.
 */

const GRAPH = GRAPH_BASE_URL

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const appId = process.env.META_APP_ID
    const appSecret = process.env.META_APP_SECRET
    if (!appId || !appSecret) {
      return NextResponse.json(
        { error: 'Server not configured for Embedded Signup (missing META_APP_ID / META_APP_SECRET).' },
        { status: 500 },
      )
    }

    const body = await request.json()
    const { code, waba_id, phone_number_id, signed_request } = body as {
      code?: string
      waba_id?: string
      phone_number_id?: string
      signed_request?: string
    }

    if (!code) {
      return NextResponse.json({ error: 'Missing authorization code from Meta.' }, { status: 400 })
    }
    if (!waba_id || !phone_number_id) {
      return NextResponse.json(
        { error: 'Meta did not return a WABA / phone number. Please complete the signup again.' },
        { status: 400 },
      )
    }

    // 1) Exchange the code for an access token.
    const tokenUrl =
      `${GRAPH}/oauth/access_token` +
      `?client_id=${encodeURIComponent(appId)}` +
      `&client_secret=${encodeURIComponent(appSecret)}` +
      `&code=${encodeURIComponent(code)}`

    const tokenRes = await fetch(tokenUrl)
    const tokenData = await tokenRes.json()
    if (!tokenRes.ok || !tokenData.access_token) {
      const msg = tokenData?.error?.message || 'Token exchange failed.'
      return NextResponse.json({ error: msg }, { status: 502 })
    }
    const accessToken: string = tokenData.access_token

    // 2) Subscribe our app to the client's WABA so inbound messages +
    //    template status updates reach our webhook. Best-effort: if this
    //    fails we still save creds (the user can retry), but report it.
    let subscribeWarning: string | null = null
    try {
      const subRes = await fetch(`${GRAPH}/${waba_id}/subscribed_apps`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      if (!subRes.ok) {
        const e = await subRes.json().catch(() => ({}))
        subscribeWarning = e?.error?.message || 'Could not subscribe app to WABA.'
      }
    } catch {
      subscribeWarning = 'Could not subscribe app to WABA (network).'
    }

    // 3) Learn which Facebook user completed the signup. Meta's deauthorize
    //    and data-deletion callbacks identify a person ONLY by this id, so
    //    without it an e-mail-signup client's deletion request would match
    //    nobody. Best effort: never blocks the connection.
    const signupUser = await resolveSignupMetaUserId({
      signedRequest: signed_request,
      accessToken,
      appId,
      appSecret,
      graphBase: GRAPH,
    })
    if (signupUser.userId !== null) {
      console.log('[embedded-signup] recorded Meta user id via', signupUser.source)
    } else {
      console.warn('[embedded-signup] could not learn Meta user id:', signupUser.reason)
    }

    // 4) Save the connection, THEN register the number.
    //
    //    Meta keeps whatever two-step PIN we register with, and only we know
    //    it — so the PIN is written to the database first and can never be
    //    lost. Each number gets its own random PIN; reconnecting the same
    //    number reuses its stored PIN (a new one would be rejected). The
    //    client's access token is stored encrypted. Embedded Signup clients
    //    share the platform webhook, which the GET handshake verifies against
    //    WHATSAPP_WEBHOOK_VERIFY_TOKEN directly — so no per-client verify
    //    token is stored (and there is no built-in default).
    const { data: existing, error: lookupError } = await supabase
      .from('whatsapp_config')
      .select('id, phone_number_id, two_step_pin')
      .eq('user_id', user.id)
      .maybeSingle()
    if (lookupError) {
      return NextResponse.json({ error: lookupError.message }, { status: 500 })
    }

    const sameNumber = existing?.phone_number_id === phone_number_id
    const { pin, reused: pinReused } = choosePin(sameNumber ? existing?.two_step_pin : null, decrypt)

    const row = {
      phone_number_id,
      waba_id,
      access_token: encrypt(accessToken),
      verify_token: null,
      two_step_pin: encrypt(pin),
      // Only written when learned, so a reconnect that cannot resolve the id
      // does not erase the one recorded earlier.
      ...(signupUser.userId ? { meta_user_id: signupUser.userId } : {}),
      status: 'connected',
      connected_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    if (existing?.id) {
      const { error } = await supabase.from('whatsapp_config').update(row).eq('user_id', user.id)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    } else {
      const { error } = await supabase
        .from('whatsapp_config')
        .insert({
          user_id: user.id,
          business_id: await currentBusinessId(supabase, user.id, request),
          ...row,
        })
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // 5) Newer Embedded Signup flows auto-register the number, so a rejection
    // here is not fatal — but it must not be silent, and a brand-new PIN that
    // Meta did not accept must not stay on file as if it were the real one.
    let registerWarning: string | null = null
    const registration = await registerPhoneNumber({
      graphBase: GRAPH,
      phoneNumberId: phone_number_id,
      accessToken,
      pin,
    })
    if (!registration.ok) {
      console.warn('[embedded-signup] register failed:', registration.error)
      registerWarning = `Number registration did not complete: ${registration.error}`
      if (!pinReused) {
        await supabase.from('whatsapp_config').update({ two_step_pin: null }).eq('user_id', user.id)
      }
    }

    return NextResponse.json({
      success: true,
      waba_id,
      phone_number_id,
      warning: [subscribeWarning, registerWarning].filter(Boolean).join(' ') || null,
    })
  } catch (error) {
    console.error('Embedded Signup exchange error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Embedded Signup failed' },
      { status: 500 },
    )
  }
}
