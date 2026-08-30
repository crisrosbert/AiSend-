import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { decrypt } from '@/lib/whatsapp/encryption'
import { getWhatsAppUsername, setWhatsAppUsername } from '@/lib/whatsapp/meta-api'

/**
 * Read or set the WhatsApp @username for the signed-in user's connected
 * number — Meta's 2026 feature that lets a customer message a number
 * without ever seeing its phone number. See meta-api.ts for why this
 * surfaces Meta's raw error message rather than a generic one: the
 * endpoint is new enough that the exact accepted format is worth
 * showing verbatim the first time someone hits it.
 */

// Meta's own rules aren't published in enough detail to enforce
// precisely, so this only blocks the shapes that can never be valid —
// Meta's response is the real authority on anything more specific.
function cleanUsername(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const trimmed = raw.trim().replace(/^@/, '')
  if (trimmed.length < 3 || trimmed.length > 30) return null
  if (!/^[a-zA-Z0-9._]+$/.test(trimmed)) return null
  return trimmed
}

async function loadConfig(userId: string) {
  const supabase = await createClient()
  const { data } = await supabase
    .from('whatsapp_config')
    .select('phone_number_id, access_token')
    .eq('user_id', userId)
    .maybeSingle()
  return data
}

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const config = await loadConfig(user.id)
  if (!config?.phone_number_id || !config?.access_token) {
    return NextResponse.json(
      { error: 'Connect your WhatsApp Business account in Settings first.' },
      { status: 400 },
    )
  }

  try {
    const accessToken = decrypt(config.access_token)
    const { username } = await getWhatsAppUsername({
      phoneNumberId: config.phone_number_id,
      accessToken,
    })
    return NextResponse.json({ username: username ?? null })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not read the username'
    return NextResponse.json({ error: message }, { status: 502 })
  }
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => null)
  const username = cleanUsername(body?.username)
  if (!username) {
    return NextResponse.json(
      { error: 'Username must be 3-30 characters: letters, numbers, dots or underscores only.' },
      { status: 400 },
    )
  }

  const config = await loadConfig(user.id)
  if (!config?.phone_number_id || !config?.access_token) {
    return NextResponse.json(
      { error: 'Connect your WhatsApp Business account in Settings first.' },
      { status: 400 },
    )
  }

  try {
    const accessToken = decrypt(config.access_token)
    await setWhatsAppUsername({
      phoneNumberId: config.phone_number_id,
      accessToken,
      username,
    })
    return NextResponse.json({ success: true, username })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Meta rejected the username'
    return NextResponse.json({ error: message }, { status: 422 })
  }
}
