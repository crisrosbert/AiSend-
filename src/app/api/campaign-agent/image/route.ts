// POST { prompt } (JSON)      → generates a campaign image with OpenAI.
// POST multipart { file }     → uploads the owner's own image.
// Both store it in the whatsapp-media bucket and return a public URL.
// Images are a paid-plan feature; the file must be JPEG/PNG, up to 5 MB.

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/automations/admin-client'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { getAccess } from '@/lib/campaign-agent/access'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const BUCKET = 'whatsapp-media'
const MAX_BYTES = 5 * 1024 * 1024

const STYLE_GUARD =
  'Clean, professional marketing image for a WhatsApp message header, landscape. No text, no letters, no logos, no watermarks, no real people\'s faces or celebrities, no brand marks.'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const access = await getAccess(supabaseAdmin(), user.id)
  if (!access.allowed) return NextResponse.json({ error: access.reason }, { status: 403 })
  if (!access.images) return NextResponse.json({ error: 'Campaign images are available on the Premium and Agent plans.' }, { status: 403 })

  const limit = checkRateLimit(`campaign:image:${user.id}`, { limit: 8, windowMs: 10 * 60_000 })
  if (!limit.success) return rateLimitResponse(limit)

  let bytes: Uint8Array
  let contentType: string
  const ct = request.headers.get('content-type') ?? ''
  if (ct.includes('multipart/form-data')) {
    const form = await request.formData().catch(() => null)
    const file = form?.get('file')
    if (!(file instanceof File)) return NextResponse.json({ error: 'No file received.' }, { status: 400 })
    if (!/^image\/(jpeg|png)$/.test(file.type)) return NextResponse.json({ error: 'Use a JPEG or PNG image.' }, { status: 400 })
    if (file.size === 0 || file.size > MAX_BYTES) return NextResponse.json({ error: 'The image must be under 5 MB.' }, { status: 400 })
    bytes = new Uint8Array(await file.arrayBuffer())
    contentType = file.type
  } else {
    const b = await request.json().catch(() => ({}))
    const prompt = typeof b?.prompt === 'string' ? b.prompt.replace(/\s+/g, ' ').trim().slice(0, 400) : ''
    if (prompt.length < 5) return NextResponse.json({ error: 'Describe the image you want (a few words).' }, { status: 400 })
    const key = process.env.OPENAI_API_KEY
    if (!key) return NextResponse.json({ error: 'Image generation is not set up on this server.' }, { status: 503 })

    const res = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: process.env.CAMPAIGN_IMAGE_MODEL || 'gpt-image-1',
        prompt: `${prompt}. ${STYLE_GUARD}`,
        size: '1536x1024',
        quality: 'medium',
        output_format: 'jpeg',
        output_compression: 85,
        n: 1,
      }),
    })
    const j = (await res.json().catch(() => ({}))) as { data?: Array<{ b64_json?: string }>; error?: { message?: string; code?: string } }
    if (!res.ok || !j.data?.[0]?.b64_json) {
      console.error('[campaign-agent/image] openai failed', res.status, j.error?.message)
      const blocked = j.error?.code === 'moderation_blocked'
      return NextResponse.json(
        { error: blocked ? 'That image request was not allowed. Describe it differently.' : 'Could not create the image right now. Try again.' },
        { status: blocked ? 422 : 502 },
      )
    }
    bytes = Uint8Array.from(Buffer.from(j.data[0].b64_json, 'base64'))
    contentType = 'image/jpeg'
    if (bytes.length > MAX_BYTES) return NextResponse.json({ error: 'The generated image was too large. Try again.' }, { status: 502 })
  }

  // Path starts with the owner id, like the other media uploads (storage policies read it).
  const path = `${user.id}/campaign/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${contentType === 'image/png' ? 'png' : 'jpg'}`
  const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, bytes, { contentType, upsert: false })
  if (upErr) {
    console.error('[campaign-agent/image] upload failed', upErr.message)
    return NextResponse.json({ error: `Could not save the image: ${upErr.message}` }, { status: 500 })
  }
  const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path)
  return NextResponse.json({ url: pub.publicUrl })
}
