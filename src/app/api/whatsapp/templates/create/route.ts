import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { decrypt } from '@/lib/whatsapp/encryption'
import { createTemplate } from '@/lib/whatsapp/meta-api'

/**
 * Create a WhatsApp message template AND submit it to Meta for approval
 * — the AiSensy "create template" flow. The client never touches the
 * Meta dashboard.
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
      header_text,
      footer_text,
    } = body

    if (!name || !body_text) {
      return NextResponse.json(
        { error: 'name and body_text are required' },
        { status: 400 }
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
        headerText: header_text || undefined,
        footerText: footer_text || undefined,
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
      header_type: header_text ? 'text' : null,
      header_content: header_text || null,
      body_text,
      footer_text: footer_text || null,
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
