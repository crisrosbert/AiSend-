// src/lib/hiring-agent/handler.ts
//
// PURPOSE: The orchestration layer for the hiring agent. For each inbound
// WhatsApp message from a candidate it: (1) runs the AI recruiter, (2) sends
// the reply, (3) extracts the structured <profile> the model emitted and
// upserts it into the candidates table, (4) advances the pipeline stage, and
// (5) when the candidate is ready, sends a niche-matched trial assignment.
//
// This is isolated from the CRM/journey code — same pattern as the ads module.

import { createClient } from '@supabase/supabase-js'
import { runAgent } from '@/lib/agent/engine'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _db: any = null
function db() {
  if (!_db) _db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  return _db
}

/** Self-contained WhatsApp text sender (no dependency on meta-api internals). */
async function sendWhatsAppText(phoneNumberId: string, to: string, text: string, accessToken: string): Promise<string | null> {
  try {
    const res = await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ messaging_product: 'whatsapp', to, type: 'text', text: { body: text.slice(0, 4096) } }),
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) { console.error('[hiring] send failed:', JSON.stringify(json).slice(0, 200)); return null }
    return json?.messages?.[0]?.id ?? null
  } catch (err) { console.error('[hiring] send error:', err); return null }
}

// The structured snapshot the model emits inside <profile>...</profile>.
interface ProfileSnapshot {
  full_name: string | null
  email: string | null
  niches: string[]
  experience_years: number | null
  portfolio_url: string | null
  sample_links: string[]
  availability: string | null
  expected_rate: string | null
  ready_for_assignment: boolean
  not_a_fit: boolean
  wants_human: boolean
}

/**
 * PURPOSE: pull the <profile>{...}</profile> JSON out of the model's reply,
 * and return BOTH the clean candidate-facing text (profile stripped) and the
 * parsed snapshot. Fail-safe: if parsing fails, we still send the reply.
 */
function extractProfile(raw: string): { reply: string; profile: ProfileSnapshot | null } {
  const m = raw.match(/<profile>([\s\S]*?)<\/profile>/)
  if (!m) return { reply: raw.trim(), profile: null }
  const reply = raw.replace(m[0], '').trim()
  try { return { reply, profile: JSON.parse(m[1]) as ProfileSnapshot } }
  catch { return { reply, profile: null } }
}

export interface HiringLeadInput {
  tenantId: string
  agentId: string
  conversationId: string
  contactId: string
  customerPhone: string
  contactName?: string
  inboundText: string
  phoneNumberId: string
  accessToken: string
}

/**
 * PURPOSE: main entry — handle one inbound candidate message end to end.
 * Returns true if handled (so the webhook skips other processing).
 */
export async function handleHiringLead(input: HiringLeadInput): Promise<boolean> {
  const { tenantId, agentId, conversationId, contactId, customerPhone, inboundText, phoneNumberId, accessToken } = input
  try {
    // 1. Run the AI recruiter (its persona + role knowledge live on the agent).
    const result = await runAgent({
      tenantId, orgId: null, verticalConfigId: null,
      conversationId, contactId, customerPhone, inboundText, agentId,
    })

    // 2. Split the model output into candidate-facing text + structured profile.
    const { reply, profile } = extractProfile(result?.reply || '')
    const outText = reply || 'Thanks! Someone from our team will get back to you shortly.'

    // 3. Send the reply on WhatsApp.
    await sendWhatsAppText(phoneNumberId, customerPhone, outText, accessToken)

    // 4. Upsert the structured candidate record + advance the stage.
    //    We only overwrite fields the model actually filled (COALESCE-style),
    //    so later turns enrich the record instead of wiping it.
    const patch: Record<string, unknown> = {
      user_id: tenantId, agent_id: agentId, contact_id: contactId,
      conversation_id: conversationId, phone: customerPhone,
      name: input.contactName ?? undefined, updated_at: new Date().toISOString(),
    }
    if (profile) {
      if (profile.full_name) patch.full_name = profile.full_name
      if (profile.email) patch.email = profile.email
      if (profile.niches?.length) patch.niches = profile.niches
      if (profile.experience_years != null) patch.experience_years = profile.experience_years
      if (profile.portfolio_url) patch.portfolio_url = profile.portfolio_url
      if (profile.sample_links?.length) patch.sample_links = profile.sample_links
      if (profile.availability) patch.availability = profile.availability
      if (profile.expected_rate) patch.expected_rate = profile.expected_rate

      // Stage transitions driven by the model's assessment.
      if (profile.wants_human) patch.stage = 'in_review'
      else if (profile.not_a_fit) patch.stage = 'rejected'
      else if (profile.ready_for_assignment) patch.stage = 'assignment_sent'
      else patch.stage = 'screened'
    }

    // Upsert on (user_id, contact_id) so re-messages enrich one row.
    await db().from('candidates').upsert(patch, { onConflict: 'user_id,contact_id' })

    // 5. If the candidate just became ready, send a niche-matched assignment.
    if (profile?.ready_for_assignment) {
      await sendAssignment({
        tenantId, contactId, customerPhone, phoneNumberId, accessToken,
        niches: profile.niches ?? [],
      })
    }

    return true
  } catch (err) {
    console.error('[hiring] handleHiringLead failed:', err)
    return false
  }
}

/**
 * PURPOSE: pick a topic matching the candidate's niche (fallback to 'general')
 * and send the trial assignment, then record it on the candidate row.
 */
async function sendAssignment(a: {
  tenantId: string; contactId: string; customerPhone: string
  phoneNumberId: string; accessToken: string; niches: string[]
}): Promise<void> {
  // Try a niche-matched topic first, else general.
  const niche = a.niches?.[0] ?? 'general'
  let { data: topics } = await db().from('assignment_topics')
    .select('topic').eq('user_id', a.tenantId).eq('niche', niche).limit(1)
  if (!topics || topics.length === 0) {
    ({ data: topics } = await db().from('assignment_topics')
      .select('topic').eq('user_id', a.tenantId).eq('niche', 'general').limit(1))
  }
  const topic = topics?.[0]?.topic
    ?? 'Write an 800-word original article on a topic of your choice in your niche.'

  const dueAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000) // 3 days
  const msg = `Great — here is your trial assignment 📝\n\nTopic: ${topic}\n\nLength: ~800 words, original work only.\nDeadline: ${dueAt.toDateString()}.\n\nReply here with your article (or a link). Our team reviews and pays for approved, original work. Good luck!`

  await sendWhatsAppText(a.phoneNumberId, a.customerPhone, msg, a.accessToken)
  await db().from('candidates').update({
    assignment_topic: topic,
    assignment_sent_at: new Date().toISOString(),
    assignment_due_at: dueAt.toISOString(),
    originality_flag: 'pending',
    stage: 'assignment_sent',
    updated_at: new Date().toISOString(),
  }).eq('user_id', a.tenantId).eq('contact_id', a.contactId)
}
