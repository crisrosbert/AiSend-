import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { decrypt } from '@/lib/whatsapp/encryption'
import {
  getBusinessProfile,
  updateBusinessProfile,
  uploadProfilePhoto,
} from '@/lib/whatsapp/meta-api'

/**
 * Business profile management for the connected WhatsApp number.
 *
 * GET   → load current profile (about, address, website, category, photo)
 * POST  (application/json)      → update text fields
 * POST  (multipart/form-data)   → upload a new profile photo (needs META_APP_ID env)
 *
 * Text editing works regardless of app id; photo upload requires the
 * META_APP_ID env var (your Meta App ID, e.g. 2098631657716952) because
 * Meta's resumable upload session is created on the App.
 */

async function getConfig() {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) return { error: 'Unauthorized', status: 401 as const }

  const { data: config, error: configError } = await supabase
    .from('whatsapp_config')
    .select('*')
    .eq('user_id', user.id)
    .single()
  if (configError || !config) {
    return { error: 'WhatsApp not configured. Connect your account in Settings first.', status: 400 as const }
  }
  if (!config.phone_number_id) {
    return { error: 'Phone Number ID missing. Re-connect your account in Settings.', status: 400 as const }
  }
  return { config, accessToken: decrypt(config.access_token) }
}

export async function GET() {
  try {
    const c = await getConfig()
    if ('error' in c) return NextResponse.json({ error: c.error }, { status: c.status })

    const profile = await getBusinessProfile({
      phoneNumberId: c.config.phone_number_id,
      accessToken: c.accessToken,
    })
    return NextResponse.json({ success: true, profile })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load profile'
    return NextResponse.json({ error: message }, { status: 502 })
  }
}

export async function POST(request: Request) {
  try {
    const c = await getConfig()
    if ('error' in c) return NextResponse.json({ error: c.error }, { status: c.status })

    const contentType = request.headers.get('content-type') || ''

    // ── Photo upload (multipart) ──────────────────────────────────
    if (contentType.includes('multipart/form-data')) {
      const appId = process.env.META_APP_ID
      if (!appId) {
        return NextResponse.json(
          { error: 'Photo upload not configured: set META_APP_ID in environment variables.' },
          { status: 400 },
        )
      }
      const form = await request.formData()
      const file = form.get('photo')
      if (!(file instanceof File)) {
        return NextResponse.json({ error: 'No photo file provided' }, { status: 400 })
      }
      const bytes = await file.arrayBuffer()
      const handle = await uploadProfilePhoto({
        appId,
        accessToken: c.accessToken,
        fileBytes: bytes,
        mimeType: file.type || 'image/jpeg',
        fileName: file.name || 'logo.jpg',
      })
      await updateBusinessProfile({
        phoneNumberId: c.config.phone_number_id,
        accessToken: c.accessToken,
        profilePictureHandle: handle,
      })
      return NextResponse.json({ success: true, updated: 'photo' })
    }

    // ── Text fields (JSON) ────────────────────────────────────────
    const body = await request.json()
    const { about, address, description, email, vertical, websites } = body

    await updateBusinessProfile({
      phoneNumberId: c.config.phone_number_id,
      accessToken: c.accessToken,
      about,
      address,
      description,
      email,
      vertical,
      websites: Array.isArray(websites) ? websites.filter(Boolean) : undefined,
    })
    return NextResponse.json({ success: true, updated: 'profile' })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update profile'
    return NextResponse.json({ error: message }, { status: 422 })
  }
}
