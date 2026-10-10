// src/lib/leads/website-whatsapp.ts
//
// ── WHY THIS EXISTS ──────────────────────────────────────────────────
// A customer taps the WhatsApp chat button on a client's website and sends
// "Hi". WhatsApp tells us their number and nothing else — not the page,
// not the Google Ad, not the campaign. So the click used to be a dead end:
// no lead, and no idea which ad paid for it.
//
// The tracking script (public/aisend.js) fixes that by adding a short
// "(Ref ABC123)" to the pre-filled message and recording the click, with its
// ad/UTM details, in lead_events. When the message arrives we find that
// click by its reference and the new lead inherits where it came from.

import { supabaseAdmin } from '@/lib/automations/admin-client'
import { ingestLead } from '@/lib/leads/ingest'

export const WEBSITE_REF_RE = /\(ref ([A-Z0-9]{6})\)/i

interface LinkInput {
  tenantId: string
  businessId?: string | null
  contactId: string
  conversationId: string
  name?: string | null
  phone: string
  text: string
}

/** Returns true when the message carried a reference we recognised. */
export async function linkWebsiteWhatsAppLead(input: LinkInput): Promise<boolean> {
  const m = input.text.match(WEBSITE_REF_RE)
  if (!m) return false
  const token = m[1].toUpperCase()
  const db = supabaseAdmin()

  // Only an unused click for THIS tenant: a reference typed or forwarded by
  // someone else must not borrow another business's attribution.
  const { data: click } = await db
    .from('lead_events')
    .select('id, page_url, attribution')
    .eq('tenant_id', input.tenantId)
    .eq('token', token)
    .eq('kind', 'whatsapp_click')
    .is('matched_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (!click) return false

  await db.from('lead_events').update({ matched_at: new Date().toISOString() }).eq('id', click.id)

  const a = (click.attribution ?? {}) as Record<string, string | null | undefined>
  const isGoogleAds =
    !!(a.gclid) || (/google/i.test(a.utm_source ?? '') && /cpc|ppc|paid/i.test(a.utm_medium ?? ''))

  let site: string | null = null
  try {
    site = click.page_url ? new URL(click.page_url).hostname.replace(/^www\./, '') : null
  } catch {
    site = null
  }

  await ingestLead({
    tenantId: input.tenantId,
    businessId: input.businessId ?? null,
    contactId: input.contactId,
    conversationId: input.conversationId,
    source: isGoogleAds ? 'google_ads' : 'website_whatsapp',
    name: input.name ?? null,
    phone: input.phone,
    campaign: a.utm_campaign ?? null,
    utmSource: a.utm_source ?? null,
    utmMedium: a.utm_medium ?? null,
    utmCampaign: a.utm_campaign ?? null,
    gclid: a.gclid ?? null,
    lastMessage: input.text.replace(WEBSITE_REF_RE, '').trim() || 'Started a WhatsApp chat from the website',
    extra: {
      site,
      page_url: click.page_url,
      referrer: a.referrer ?? null,
      landing_page: a.landing_page ?? null,
    },
  })
  return true
}
