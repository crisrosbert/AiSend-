// src/lib/leads/ingest.ts
//
// ── WHY THIS EXISTS ──────────────────────────────────────────────────
// Every lead source — a Meta Lead Form, a Click-to-WhatsApp ad, a
// website contact form, a website chatbot, a Google Ads lead extension
// — used to write (or not write at all) to the `leads` table in its
// own way, with its own dedupe (usually none). A person who clicked a
// Meta ad and later filled the website form became two leads, and the
// coordinator called them twice about the same enquiry.
//
// This module is the one reception desk every source goes through,
// whether it calls in-process (the WhatsApp webhook, for a
// Click-to-WhatsApp lead) or over HTTP (src/app/api/leads/ingest,
// for a merchant's own website form or a Google Ads webhook).
//
// ── WHAT IT GUARANTEES ──────────────────────────────────────────────
//   1. One lead per phone number per tenant. A second touch from a
//      different channel updates the existing row (bumps
//      `touchpoints`, records `latest_source`) instead of creating a
//      duplicate.
//   2. `first_source` is written once and never overwritten — "where
//      did this person originally come from" has to survive every
//      later touch.
//   3. The lead is linked to a `contacts` row (created if needed) so
//      the merchant's AI agent, inbox and automations all see the same
//      person, not a lead floating disconnected from the CRM.
//   4. Fires the `lead_created` automation trigger so a merchant's
//      "send a welcome template within 2 minutes" automation can act on
//      ANY source, not just WhatsApp-native ones.

import { supabaseAdmin } from '@/lib/automations/admin-client'
import { normalizePhone, PRECISION_LOST } from '@/lib/contacts/import-parse'
import { runAutomationsForTrigger } from '@/lib/automations/engine'
import { syncLeadToGoogleSheet } from '@/lib/integrations/google-sheets'

export interface IngestLeadInput {
  tenantId: string
  businessId?: string | null
  /** 'website_form' | 'google_ads' | 'meta_leadgen' | 'meta_ads' | 'whatsapp' | 'website_widget' | 'manual' | ... */
  source: string
  agentId?: string | null
  contactId?: string | null
  conversationId?: string | null
  firstName?: string | null
  lastName?: string | null
  /** Used when the caller has one combined name rather than first/last. */
  name?: string | null
  /** Raw, unnormalized — this function normalizes it. */
  phone?: string | null
  email?: string | null
  companyName?: string | null
  campaign?: string | null
  adset?: string | null
  adId?: string | null
  adHeadline?: string | null
  adName?: string | null
  interest?: string | null
  utmSource?: string | null
  utmMedium?: string | null
  utmCampaign?: string | null
  gclid?: string | null
  ctwaClid?: string | null
  consent?: boolean | null
  lastMessage?: string | null
  /** Freeform extras that don't warrant their own column yet. */
  extra?: Record<string, unknown>
  /**
   * Skip firing the `lead_created` automation trigger. Set this when the
   * caller fires its own more specific trigger right after (the
   * WhatsApp webhook already fires `new_contact_created`), to avoid a
   * merchant's automation running twice for one event.
   */
  suppressAutomation?: boolean
}

export interface IngestLeadResult {
  leadId: string
  wasNewLead: boolean
  contactId: string | null
  wasNewContact: boolean
}

function clean(value: string | null | undefined, max = 300): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim().slice(0, max)
  return trimmed || null
}

/** Loose match used only to find a contact to attach a lead to — same
 *  approach as the WhatsApp webhook's own dedupe, kept local so this
 *  module has no dependency on route.ts internals. */
function phonesMatch(a: string | null, b: string | null): boolean {
  if (!a || !b) return false
  const da = a.replace(/\D/g, '').slice(-10)
  const db_ = b.replace(/\D/g, '').slice(-10)
  return da.length === 10 && da === db_
}

async function findOrCreateContactByPhone(
  tenantId: string,
  businessId: string | null | undefined,
  phoneE164: string,
  name: string | null,
): Promise<{ id: string; wasNew: boolean } | null> {
  const db = supabaseAdmin()

  const { data: contacts, error } = await db
    .from('contacts')
    .select('id, name, phone')
    .eq('user_id', tenantId)

  if (error) {
    console.error('[leads/ingest] contact lookup failed:', error.message)
    return null
  }

  const existing = contacts?.find((c) => phonesMatch(c.phone, phoneE164))
  if (existing) {
    if (name && name !== existing.name) {
      await db.from('contacts').update({ name, updated_at: new Date().toISOString() }).eq('id', existing.id)
    }
    return { id: existing.id, wasNew: false }
  }

  const { data: created, error: createError } = await db
    .from('contacts')
    .insert({
      user_id: tenantId,
      business_id: businessId ?? null,
      phone: phoneE164,
      name: name || phoneE164,
    })
    .select('id')
    .single()

  if (createError) {
    console.error('[leads/ingest] contact create failed:', createError.message)
    return null
  }

  return { id: created.id, wasNew: true }
}

/**
 * Ingest one lead event from any source. Dedupes by phone (falling back
 * to email when no phone is given), links/creates a contact, and fires
 * the `lead_created` automation trigger.
 */
export async function ingestLead(input: IngestLeadInput): Promise<IngestLeadResult | null> {
  const db = supabaseAdmin()

  const rawPhone = clean(input.phone, 24)
  let phoneE164: string | null = null
  if (rawPhone) {
    const normalized = normalizePhone(rawPhone)
    if (normalized && normalized !== PRECISION_LOST) phoneE164 = normalized
  }

  const email = clean(input.email, 160)?.toLowerCase() ?? null

  // A lead with no way to reach the person is worthless, and usually a
  // bot or a mistyped form field.
  if (!phoneE164 && !email) {
    console.warn('[leads/ingest] dropped — no usable phone or email', input.source)
    return null
  }

  const name =
    clean(input.name, 160) ||
    [clean(input.firstName, 80), clean(input.lastName, 80)].filter(Boolean).join(' ') ||
    null

  // ── Link (or create) the contact this lead belongs to ──
  // Only possible when we have a phone: `contacts.phone` is NOT NULL,
  // so an email-only lead (e.g. a Meta Lead Form with no phone field)
  // stays a lead with no linked contact until a phone shows up later.
  let contactId = input.contactId ?? null
  let wasNewContact = false
  if (!contactId && phoneE164) {
    const contact = await findOrCreateContactByPhone(input.tenantId, input.businessId, phoneE164, name)
    if (contact) {
      contactId = contact.id
      wasNewContact = contact.wasNew
    }
  }

  // ── Find an existing lead for this person ──
  // Phone first (the reliable identifier); email only when there is no
  // phone to match on, since phone is what every channel eventually
  // shares once a conversation starts on WhatsApp.
  let existingQuery = db.from('leads').select('*').eq('tenant_id', input.tenantId)
  existingQuery = phoneE164 ? existingQuery.eq('phone_e164', phoneE164) : existingQuery.eq('email', email)
  const { data: existing } = await existingQuery.maybeSingle()

  const now = new Date().toISOString()

  // Attribution fields: only overwrite when the new event actually
  // supplies a value, so a later touch with less information (e.g. a
  // plain WhatsApp reply after a rich Meta Lead Form submission) doesn't
  // blank out campaign data the merchant already has.
  const attribution = {
    campaign: clean(input.campaign, 200),
    adset: clean(input.adset, 200),
    ad_id: clean(input.adId, 200),
    ad_headline: clean(input.adHeadline, 300),
    ad_name: clean(input.adName, 300),
    interest: clean(input.interest, 300),
    utm_source: clean(input.utmSource, 200),
    utm_medium: clean(input.utmMedium, 200),
    utm_campaign: clean(input.utmCampaign, 200),
    gclid: clean(input.gclid, 300),
    ctwa_clid: clean(input.ctwaClid, 300),
  }
  const attributionUpdates = Object.fromEntries(
    Object.entries(attribution).filter(([, v]) => v !== null),
  )

  let leadId: string
  let wasNewLead: boolean

  if (existing) {
    wasNewLead = false
    leadId = existing.id
    const update: Record<string, unknown> = {
      latest_source: input.source,
      touchpoints: (existing.touchpoints ?? 1) + 1,
      updated_at: now,
      ...attributionUpdates,
    }
    // Fill in anything the existing row is missing; never clobber a
    // value a previous, richer touch already captured.
    if (!existing.name && name) update.name = name
    if (!existing.first_name && input.firstName) update.first_name = clean(input.firstName, 80)
    if (!existing.last_name && input.lastName) update.last_name = clean(input.lastName, 80)
    if (!existing.email && email) update.email = email
    if (!existing.phone && rawPhone) update.phone = rawPhone
    if (!existing.phone_e164 && phoneE164) update.phone_e164 = phoneE164
    if (!existing.company_name && input.companyName) update.company_name = clean(input.companyName, 120)
    if (!existing.contact_id && contactId) update.contact_id = contactId
    if (input.consent !== undefined && input.consent !== null) update.consent = input.consent
    if (input.lastMessage) update.last_message = clean(input.lastMessage, 500)
    // Merge, don't replace: a booking's details must not erase the ad
    // click details an earlier touch stored, and vice versa.
    if (input.extra && Object.keys(input.extra).length) {
      update.extra = { ...((existing.extra as Record<string, unknown> | null) ?? {}), ...input.extra }
    }
    if (existing.business_id == null && input.businessId) update.business_id = input.businessId
    if (existing.agent_id == null && input.agentId) update.agent_id = input.agentId

    const { error } = await db.from('leads').update(update).eq('id', existing.id)
    if (error) console.error('[leads/ingest] update failed:', error.message)
  } else {
    wasNewLead = true
    const record = {
      tenant_id: input.tenantId,
      business_id: input.businessId ?? null,
      agent_id: input.agentId ?? null,
      contact_id: contactId,
      conversation_id: input.conversationId ?? null,
      first_name: clean(input.firstName, 80),
      last_name: clean(input.lastName, 80),
      name,
      phone: rawPhone,
      phone_e164: phoneE164,
      email,
      company_name: clean(input.companyName, 120),
      source: input.source,
      first_source: input.source,
      latest_source: input.source,
      touchpoints: 1,
      consent: input.consent ?? null,
      last_message: clean(input.lastMessage, 500),
      status: 'new',
      extra: input.extra ?? {},
      created_at: now,
      updated_at: now,
      ...attributionUpdates,
    }
    const { data, error } = await db.from('leads').insert(record).select('id').single()
    if (error || !data) {
      console.error('[leads/ingest] insert failed:', error?.message)
      return null
    }
    leadId = data.id
  }

  // Mirror into the merchant's Google Sheet, if they've connected one.
  // Fire-and-forget on purpose: a Sheets outage or a merchant who never
  // shared the sheet with the service account must never block or fail
  // the lead write itself — Supabase is the source of truth, the Sheet
  // is a convenience.
  void syncLeadToGoogleSheet(input.tenantId, {
    name,
    phone: phoneE164 ?? rawPhone,
    source: input.source,
    campaign: attribution.campaign,
    interest: attribution.interest,
    status: existing ? existing.status : 'new',
    lastMessage: input.lastMessage ?? null,
  })

  if (!input.suppressAutomation) {
    try {
      await runAutomationsForTrigger({
        userId: input.tenantId,
        businessId: input.businessId ?? null,
        triggerType: 'lead_created',
        contactId,
        context: {
          vars: {
            lead_id: leadId,
            source: input.source,
            name,
            phone: phoneE164 ?? rawPhone ?? undefined,
            email: email ?? undefined,
            interest: attribution.interest ?? undefined,
            campaign: attribution.campaign ?? undefined,
          },
        },
      })
    } catch (err) {
      // Automations are a side effect of a successful ingest, not a
      // precondition for one — a misconfigured automation must never
      // make the lead itself disappear.
      console.error('[leads/ingest] automation dispatch failed:', err)
    }
  }

  return { leadId, wasNewLead, contactId, wasNewContact }
}
