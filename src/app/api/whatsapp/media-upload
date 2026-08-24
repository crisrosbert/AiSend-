// src/app/api/whatsapp/media-upload/route.ts
//
// Put a file somewhere WhatsApp can fetch it, and hand back the URL.
//
// ── WHY THIS FILE DID NOT EXIST ──────────────────────────────────────
// The inbox has always called POST /api/whatsapp/media-upload when
// someone attaches a file. Nothing was listening. Every attachment got
// a 404, which the client turned into "Failed to distribute file
// attachment" — a message that names neither the cause nor anything to
// do about it, so the feature looked flaky rather than absent.
//
// ── WHY IT ONLY UPLOADS ──────────────────────────────────────────────
// It would be easy to make this do the whole job: upload, then send the
// WhatsApp message too. That means duplicating what /api/whatsapp/send
// already does — token decryption, the Meta call, the phone-number
// correction, the message row, the conversation preview — and the copy
// starts drifting the day one of them is fixed.
//
// So this returns a URL, and the client sends it through /send like any
// other media message. Two steps, each with one job, both already
// covered by the code that exists.

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { checkRateLimit, rateLimitResponse, RATE_LIMITS } from '@/lib/rate-limit'

export const maxDuration = 30

const BUCKET = 'whatsapp-media'

/**
 * What Meta actually accepts, per content type.
 *
 * Checked here rather than left to the send call, because a rejection
 * from Meta arrives after the file is already stored and the customer
 * is already waiting. The limits are Meta's own, minus nothing — a file
 * this route accepts is one the Cloud API will take.
 */
const RULES: Record<string, { mime: RegExp; maxBytes: number; label: string }> = {
  image: { mime: /^image\/(jpeg|png|webp)$/, maxBytes: 5 * 1024 * 1024, label: 'JPEG, PNG or WebP up to 5 MB' },
  video: { mime: /^video\/(mp4|3gpp)$/, maxBytes: 16 * 1024 * 1024, label: 'MP4 or 3GP up to 16 MB' },
  audio: { mime: /^audio\/(aac|mp4|mpeg|amr|ogg)$/, maxBytes: 16 * 1024 * 1024, label: 'AAC, MP3, AMR or OGG up to 16 MB' },
  document: { mime: /./, maxBytes: 100 * 1024 * 1024, label: 'any file up to 100 MB' },
}

/** Strip anything that would make a storage path ambiguous. */
function safeName(raw: string): string {
  const cleaned = raw.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-80)
  return cleaned || 'file'
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser()
  if (authErr || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Same budget shape as /send. Uploads are heavier than texts, so
  // sharing the send bucket would let a few large files starve normal
  // replies; this gets its own.
  const limit = checkRateLimit(`media-upload:${user.id}`, RATE_LIMITS.send)
  if (!limit.success) return rateLimitResponse(limit)

  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return NextResponse.json({ error: 'Expected a file upload' }, { status: 400 })
  }

  const file = form.get('file')
  const conversationId = form.get('conversation_id')
  const contentType = String(form.get('content_type') || 'document')

  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'No file was attached' }, { status: 400 })
  }
  if (typeof conversationId !== 'string' || !conversationId) {
    return NextResponse.json({ error: 'conversation_id is required' }, { status: 400 })
  }

  const rule = RULES[contentType]
  if (!rule) {
    return NextResponse.json({ error: `Unsupported content type: ${contentType}` }, { status: 400 })
  }

  // ── Is this conversation actually theirs? ──
  //
  // The path below is keyed by the conversation, so without this check
  // anyone signed in could write files into another tenant's folder and
  // hand out URLs under their business's name.
  const { data: conversation } = await supabase
    .from('conversations')
    .select('id, business_id')
    .eq('id', conversationId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!conversation) {
    return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
  }

  if (file.size === 0) {
    return NextResponse.json({ error: 'That file is empty' }, { status: 400 })
  }
  if (file.size > rule.maxBytes) {
    return NextResponse.json(
      { error: `That file is too large. WhatsApp accepts ${rule.label}.` },
      { status: 400 },
    )
  }
  if (!rule.mime.test(file.type)) {
    return NextResponse.json(
      { error: `WhatsApp cannot send that as ${contentType}. It accepts ${rule.label}.` },
      { status: 400 },
    )
  }

  // Path carries the owner first so the storage policies can check it
  // with storage.foldername(name)[1], the same convention as avatars.
  const path = `${user.id}/${conversationId}/${Date.now()}-${safeName(file.name)}`

  const { error: uploadErr } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false })

  if (uploadErr) {
    console.error('[media-upload] failed:', uploadErr.message)
    // Name the one failure that has a specific fix, rather than making
    // someone read the logs to find out a bucket is missing.
    if (/bucket/i.test(uploadErr.message) && /not found|does not exist/i.test(uploadErr.message)) {
      return NextResponse.json(
        { error: 'Media storage is not set up. Run migration 034.' },
        { status: 500 },
      )
    }
    return NextResponse.json({ error: `Upload failed: ${uploadErr.message}` }, { status: 500 })
  }

  const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path)

  return NextResponse.json({
    media_url: pub.publicUrl,
    // Echoed back so the caller does not have to remember what it sent
    // when it turns round and calls /send.
    content_type: contentType,
    filename: file.name,
  })
}
