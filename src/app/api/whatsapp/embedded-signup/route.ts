import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { encrypt } from '@/lib/whatsapp/encryption'

/**
 * Embedded Signup — token exchange + auto-connect.
 *
 * This is the AiSensy "Connect WhatsApp" flow. The client clicks the
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
 *   4. Register the phone number on Cloud API so it can send.
 *
 * Requires env: META_APP_ID, META_APP_SECRET.
 *
 * NOTE: Meta only returns a usable token here once the app is published
 * and approved as a Tech Provider with Advanced Access. Until then this
 * route returns Meta's error, which the UI surfaces.
 */

const GRAPH = 'https://graph.facebook.com/v21.0'

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
    const { code, waba_id, phone_number_id } = body as {
      code?: string
      waba_id?: string
      phone_number_id?: string
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

    // 3) Register the phone number on Cloud API. Newer Embedded Signup
    //    flows auto-register; we attempt it and ignore "already
    //    registered" responses. A PIN of 000000 is the documented
    //    default for cloud-hosted numbers without 2FA set.
    try {
      await fetch(`${GRAPH}/${phone_number_id}/register`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ messaging_product: 'whatsapp', pin: '000000' }),
      })
    } catch {
      // non-fatal — number may already be registered
    }

    // 4) Persist into this user's config (encrypted token + verify token).
    const verifyToken = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || 'clickstream2026'
    const encToken = encrypt(accessToken)
    const encVerify = encrypt(verifyToken)

    const { data: existing } = await supabase
      .from('whatsapp_config')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle()

    const row = {
      phone_number_id,
      waba_id,
      access_token: encToken,
      verify_token: encVerify,
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
        .insert({ user_id: user.id, ...row })
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      waba_id,
      phone_number_id,
      warning: subscribeWarning,
    })
  } catch (error) {
    console.error('Embedded Signup exchange error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Embedded Signup failed' },
      { status: 500 },
    )
  }
}
