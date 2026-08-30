import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { decrypt } from '@/lib/whatsapp/encryption'
import { createTemplate, uploadProfilePhoto, type TemplateButton } from '@/lib/whatsapp/meta-api'
import { isValidE164 } from '@/lib/whatsapp/phone-utils'

const MEDIA_HEADER_FORMATS = { image: 'IMAGE', video: 'VIDEO' } as const
type MediaHeaderType = keyof typeof MEDIA_HEADER_FORMATS

/**
 * Create a WhatsApp message template AND submit it to Meta for approval
 * in one step. The client never touches the Meta dashboard.
 *
 * Flow:
 *   1. Submit components to Meta (POST /{waba_id}/message_templates).
 *   2. On success, save the row locally with status 'Pending' (or
 *      'Approved' if Meta auto-approved) so it shows in the UI
 *      immediately.
 *   3. Meta later pushes a message_template_status_update webhook that
 *      flips the local status to Approved/Rejected (see webhook route).
 *
 * Category/status are stored TitleCase to match the existing
 * message_templates CHECK constraints (Marketing / Utility /
 * Authentication, Draft / Pending / Approved / Rejected).
 */

function titleCaseCategory(meta: string): 'Marketing' | 'Utility' | 'Authentication' {
  const u = meta.toUpperCase()
  if (u === 'UTILITY') return 'Utility'
  if (u === 'AUTHENTICATION') return 'Authentication'
  return 'Marketing'
}

function titleCaseStatus(meta: string): 'Draft' | 'Pending' | 'Approved' | 'Rejected' {
  switch (meta.toUpperCase()) {
    case 'APPROVED':
      return 'Approved'
    case 'REJECTED':
    case 'DISABLED':
    case 'PAUSED':
      return 'Rejected'
    default:
      return 'Pending'
  }
}

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

    const body = await request.json()
    const {
      name,
      category,
      language,
      body_text,
      header_type,
      header_text,
      header_media_url,
      footer_text,
      buttons: rawButtons,
    } = body as {
      name?: string
      category?: string
      language?: string
      body_text?: string
      header_type?: string
      header_text?: string
      header_media_url?: string
      footer_text?: string
      buttons?: Array<{ type?: string; text?: string; value?: string }>
    }

    if (!name || !body_text) {
      return NextResponse.json(
        { error: 'name and body_text are required' },
        { status: 400 }
      )
    }

    // Call-to-action buttons — "Visit Website" / "Call Now", the row
    // big brands show under a template message. Meta caps these at 2
    // URL buttons + 1 phone button; anything past that is silently
    // dropped by createTemplate(), so the only thing checked here is
    // that what WAS provided is well-formed enough not to earn a
    // confusing rejection from Meta.
    const buttons: TemplateButton[] = []
    for (const b of rawButtons ?? []) {
      const text = (b.text ?? '').trim()
      const value = (b.value ?? '').trim()
      if (!text || !value) continue
      if (b.type === 'url') {
        if (!/^https?:\/\/.+/i.test(value)) {
          return NextResponse.json(
            { error: `"${text}" button needs a full https:// link.` },
            { status: 400 },
          )
        }
        buttons.push({ type: 'URL', text, url: value })
      } else if (b.type === 'phone') {
        // Meta needs the actual country code. A bare local number (e.g.
        // a 10-digit Indian mobile with no +91) still passes a generic
        // "is this plausibly a phone number" check, so requiring '+'
        // here is what actually catches it — silently prepending '+'
        // to a country-code-less number used to produce a number for
        // no real country, which Meta then rejected with a message
        // that didn't say why.
        if (!value.startsWith('+') || !isValidE164(value)) {
          return NextResponse.json(
            {
              error: `"${text}" button needs the country code too, e.g. +919876543210 — not just 9876543210.`,
            },
            { status: 400 },
          )
        }
        buttons.push({ type: 'PHONE_NUMBER', text, phoneNumber: value })
      }
    }

    const mediaHeaderType =
      header_type && header_type in MEDIA_HEADER_FORMATS
        ? (header_type as MediaHeaderType)
        : null
    if (mediaHeaderType && !header_media_url) {
      return NextResponse.json(
        { error: `Add an ${header_type} for the header, or set Header Type to None.` },
        { status: 400 },
      )
    }

    // Need WABA id + access token from the user's config.
    const { data: config, error: configError } = await supabase
      .from('whatsapp_config')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (configError || !config) {
      return NextResponse.json(
        {
          error:
            'WhatsApp not configured. Connect your WhatsApp Business account in Settings first.',
        },
        { status: 400 }
      )
    }

    if (!config.waba_id) {
      return NextResponse.json(
        { error: 'WABA ID missing. Re-connect your account in Settings.' },
        { status: 400 }
      )
    }

    const accessToken = decrypt(config.access_token)

    // 0) For an image/video header, Meta wants a sample file uploaded
    //    through its resumable upload API (returns a "handle") as the
    //    review example — the actual link is supplied per-send later.
    //    header_media_url may be a Supabase Storage URL (user uploaded a
    //    file) or a URL the user pasted directly; either way we fetch
    //    the bytes ourselves so Meta never has to trust a client-given
    //    handle.
    let headerMediaHandle: string | undefined
    if (mediaHeaderType && header_media_url) {
      const appId = process.env.META_APP_ID
      if (!appId) {
        return NextResponse.json(
          { error: 'Server not configured for media headers (missing META_APP_ID).' },
          { status: 500 },
        )
      }
      let mediaRes: Response
      try {
        mediaRes = await fetch(header_media_url)
      } catch {
        return NextResponse.json(
          { error: 'Could not reach the header media URL.' },
          { status: 400 },
        )
      }
      if (!mediaRes.ok) {
        return NextResponse.json(
          { error: `Header media URL returned ${mediaRes.status}. Check it's public and reachable.` },
          { status: 400 },
        )
      }
      const contentType =
        mediaRes.headers.get('content-type') ||
        (mediaHeaderType === 'image' ? 'image/jpeg' : 'video/mp4')
      const fileBytes = await mediaRes.arrayBuffer()
      try {
        headerMediaHandle = await uploadProfilePhoto({
          appId,
          accessToken,
          fileBytes,
          mimeType: contentType,
          fileName: mediaHeaderType === 'image' ? 'header.jpg' : 'header.mp4',
        })
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Meta rejected the header media'
        return NextResponse.json({ error: `Header media upload failed: ${message}` }, { status: 422 })
      }
    }

    // 1) Submit to Meta. Errors (bad category, duplicate name, button
    //    mismatch, etc.) surface here with Meta's own message so the
    //    user can fix and retry.
    let metaResult
    try {
      metaResult = await createTemplate({
        wabaId: config.waba_id,
        accessToken,
        name,
        category: category || 'Marketing',
        language: language || 'en_US',
        bodyText: body_text,
        headerText: !mediaHeaderType ? header_text || undefined : undefined,
        headerMediaFormat: mediaHeaderType ? MEDIA_HEADER_FORMATS[mediaHeaderType] : undefined,
        headerMediaHandle,
        footerText: footer_text || undefined,
        buttons: buttons.length > 0 ? buttons : undefined,
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Meta rejected the template'
      return NextResponse.json({ error: message }, { status: 422 })
    }

    // 2) Persist locally so it appears in the list right away. Use the
    //    normalized name Meta actually registered (lowercase_underscore).
    const normalizedName = name.trim().toLowerCase().replace(/\s+/g, '_')
    const row = {
      user_id: user.id,
      name: normalizedName,
      category: titleCaseCategory(metaResult.category),
      language: language || 'en_US',
      header_type: mediaHeaderType || (header_text ? 'text' : null),
      header_content: mediaHeaderType ? header_media_url || null : header_text || null,
      body_text,
      footer_text: footer_text || null,
      buttons: buttons.length > 0 ? buttons : null,
      status: titleCaseStatus(metaResult.status),
      meta_template_id: metaResult.id,
      updated_at: new Date().toISOString(),
    }

    // Upsert-by-hand on (user_id, name, language): if a Draft with the
    // same name/language exists (e.g. created before this flow), update
    // it instead of inserting a duplicate.
    const { data: existing } = await supabase
      .from('message_templates')
      .select('id')
      .eq('user_id', user.id)
      .eq('name', normalizedName)
      .eq('language', language || 'en_US')
      .maybeSingle()

    let saveError = null
    if (existing?.id) {
      const { error } = await supabase
        .from('message_templates')
        .update(row)
        .eq('id', existing.id)
      saveError = error
    } else {
      const { error } = await supabase.from('message_templates').insert(row)
      saveError = error
    }

    if (saveError) {
      // Template IS submitted to Meta; only the local mirror failed.
      // Tell the user it's pending and they can Sync to recover.
      return NextResponse.json(
        {
          success: true,
          submitted: true,
          warning: `Submitted to Meta but local save failed: ${saveError.message}. Use "Sync from Meta" to refresh.`,
          meta_template_id: metaResult.id,
          status: metaResult.status,
        },
        { status: 200 }
      )
    }

    return NextResponse.json({
      success: true,
      submitted: true,
      name: normalizedName,
      status: titleCaseStatus(metaResult.status),
      meta_template_id: metaResult.id,
    })
  } catch (error) {
    console.error('Error creating WhatsApp template:', error)
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Failed to create template',
      },
      { status: 500 }
    )
  }
}
