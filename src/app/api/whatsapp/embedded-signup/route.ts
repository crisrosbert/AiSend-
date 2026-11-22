import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { encrypt, decrypt } from '@/lib/whatsapp/encryption'
import { choosePin, registerPhoneNumber } from '@/lib/whatsapp/registration-pin'
import { currentBusinessId } from '@/lib/business/server'
import { GRAPH_BASE_URL } from '@/lib/meta/graph-version'
import { resolveSignupMetaUserId } from '@/lib/meta/signup-user'
import { pickPhoneNumberId } from '@/lib/whatsapp/coexistence'

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
 * Coexistence (`coexistence: true`): the number is ALSO live in the owner's
 * WhatsApp Business app. In that case we never call /register (it is already
 * registered, and re-registering would take it away from the phone), we may
 * have to look up the phone_number_id ourselves, and we ask Meta to sync the
 * contacts and recent chat history.
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
    const { code, waba_id, signed_request } = body as {
      code?: string
      waba_id?: string
      signed_request?: string
    }
    let phone_number_id = (body as { phone_number_id?: string }).phone_number_id
    const coexistence = (body as { coexistence?: unknown }).coexistence === true

    if (!code) {
      return NextResponse.json({ error: 'Missing authorization code from Meta.' }, { status: 400 })
    }
    if (!waba_id || (!phone_number_id && !coexistence)) {
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

    // Coexistence: Meta may return only the WABA. Find the number on it.
    if (coexistence && !phone_number_id) {
      try {
        const numRes = await fetch(`${GRAPH}/${waba_id}/phone_numbers?fields=id,display_phone_number`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        })
        const numBody = await numRes.json().catch(() => ({}))
        phone_number_id = pickPhoneNumberId(numBody?.data) ?? undefined
      } catch {
        /* handled below */
      }
      if (!phone_number_id) {
        return NextResponse.json(
          { error: 'Could not find your WhatsApp number on this account. Please try connecting again.' },
          { status: 502 },
        )
      }
    }
    const phoneNumberId: string = phone_number_id as string

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

    const sameNumber = existing?.phone_number_id === phoneNumberId
    const { pin, reused: pinReused } = choosePin(sameNumber ? existing?.two_step_pin : null, decrypt)

    const row: Record<string, unknown> = {
      phone_number_id: phoneNumberId,
      waba_id,
      access_token: encrypt(accessToken),
      verify_token: null,
      // A coexistence number is never registered by us, so it has no PIN of ours.
      ...(coexistence ? {} : { two_step_pin: encrypt(pin) }),
      connection_mode: coexistence ? 'coexistence' : 'cloud',
      // Only written when learned, so a reconnect that cannot resolve the id
      // does not erase the one recorded earlier.
      ...(signupUser.userId ? { meta_user_id: signupUser.userId } : {}),
      status: 'connected',
      connected_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    const businessId = existing?.id ? null : await currentBusinessId(supabase, user.id, request)
    const save = (r: Record<string, unknown>) =>
      existing?.id
        ? supabase.from('whatsapp_config').update(r).eq('user_id', user.id)
        : supabase.from('whatsapp_config').insert({ user_id: user.id, business_id: businessId, ...r })

    let saved = await save(row)
    // Migration 046 (connection_mode) may not be applied yet: save without it.
    if (saved.error && /connection_mode/i.test(saved.error.message)) {
      const { connection_mode: _omit, ...withoutMode } = row
      void _omit
      saved = await save(withoutMode)
    }
    if (saved.error) return NextResponse.json({ error: saved.error.message }, { status: 500 })

    // 5) Newer Embedded Signup flows auto-register the number, so a rejection
    // here is not fatal — but it must not be silent, and a brand-new PIN that
    // Meta did not accept must not stay on file as if it were the real one.
    let registerWarning: string | null = null
    let syncWarning: string | null = null
    const registration = coexistence
      ? ({ ok: true } as const)
      : await registerPhoneNumber({
          graphBase: GRAPH,
          phoneNumberId,
          accessToken,
          pin,
        })

    if (coexistence) {
      // Ask Meta to push contacts + chat history to our webhook. Must happen
      // soon after onboarding (Meta only allows a short window). Best effort.
      for (const syncType of ['smb_app_state_sync', 'history']) {
        try {
          const r = await fetch(`${GRAPH}/${phoneNumberId}/smb_app_data`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ messaging_product: 'whatsapp', sync_type: syncType }),
          })
          if (!r.ok) {
            const e = await r.json().catch(() => ({}))
            console.warn('[embedded-signup] coexistence sync', syncType, 'failed:', e?.error?.message)
            syncWarning = 'Connected, but your old chats could not be imported. New messages will still arrive.'
          }
        } catch {
          syncWarning = 'Connected, but your old chats could not be imported. New messages will still arrive.'
        }
      }
    }

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
      phone_number_id: phoneNumberId,
      connection_mode: coexistence ? 'coexistence' : 'cloud',
      warning: [subscribeWarning, registerWarning, syncWarning].filter(Boolean).join(' ') || null,
    })
  } catch (error) {
    console.error('Embedded Signup exchange error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Embedded Signup failed' },
      { status: 500 },
    )
  }
}
