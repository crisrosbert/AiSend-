import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/automations/admin-client'

export const dynamic = 'force-dynamic'

/**
 * GET /api/t/click/[token]
 *
 * What a template's "Visit Website" button actually points at when
 * click tracking is turned on for that template — see migration
 * 035_template_click_tracking.sql for the full explanation. Logs one
 * row to template_link_clicks, then 302s to the real destination.
 *
 * Whoever hits this has no Supabase session (they tapped a button
 * inside WhatsApp), so this uses the service-role client rather than
 * the per-request one, same as the cron routes.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params

  const fallback = process.env.NEXT_PUBLIC_SITE_URL || 'https://aisend.app'

  // A malformed or unknown token still needs somewhere to send the
  // visitor — landing them on a 500 (or nothing) just because tracking
  // is broken would turn a stats bug into a lost customer.
  if (!token || !/^[0-9a-f-]{36}$/i.test(token)) {
    return NextResponse.redirect(fallback, 302)
  }

  const admin = supabaseAdmin()

  const { data: template, error } = await admin
    .from('message_templates')
    .select('id, user_id, cta_target_url')
    .eq('click_token', token)
    .maybeSingle()

  if (error || !template || !template.cta_target_url) {
    return NextResponse.redirect(fallback, 302)
  }

  // Awaited (not fire-and-forget): a serverless function can be frozen
  // or torn down the instant it returns, which would silently drop an
  // un-awaited insert. A logging failure here still must never block
  // the visitor's click, so errors are swallowed, not thrown.
  try {
    const { error: insertError } = await admin
      .from('template_link_clicks')
      .insert({ template_id: template.id, user_id: template.user_id })
    if (insertError) console.error('[click-tracking] insert failed:', insertError)
  } catch (err) {
    console.error('[click-tracking] insert threw:', err)
  }

  return NextResponse.redirect(template.cta_target_url, 302)
}
