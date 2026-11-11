// src/lib/agent/tools/booking-tools.ts
//
// Captures appointment/consultation requests from the AI agent.
//
// Saved as status 'requested' — a lead needing a callback, NOT a
// confirmed diary entry — so staff can tell an AI-captured request apart
// from an appointment a human actually agreed. Requires migration 019.
//
// ── History ──────────────────────────────────────────────────────────
// 1. This tool used to accept whatever date string the model handed it
//    and coerce it into an instant ("today" at 23:30 became a midnight
//    consultation). Times now go through resolveSlot(), which only ever
//    returns an instant inside the business's opening hours. When the
//    customer's preference cannot be honoured we still save the lead and
//    tell the model to say plainly that we moved it.
//
// 2. (this change) It inserted a NEW row on every call, and the prompt
//    tells the model to call it again to correct a time, so one customer
//    produced several "requested" appointments. Now:
//      • a call in the same conversation whose name matches a recent
//        'requested' row UPDATES that row (booking for a different
//        person still inserts);
//      • a slot that overlaps a CONFIRMED appointment (same tenant and
//        business) is moved to the next free slot, and the model is told
//        so; overlaps with other unconfirmed requests are only noted for
//        staff, because a request is not a commitment.
//    Everything is read/insert/update on agent_appointments, which this
//    file already used. No schema change.
//
// Used by: src/lib/agent/engine.ts
// Table:   agent_appointments

import { createClient } from '@supabase/supabase-js'
import { ingestLead } from '@/lib/leads/ingest'
import {
  resolveSlot,
  parseBusinessHours,
  labelFor,
  type BusinessHours,
} from '@/lib/agent/business-hours'
import { findRequestToUpdate, overlaps, pickFreeSlot, RECENT_REQUEST_MS } from '@/lib/agent/tools/booking-logic'
import { checkPhone, phoneProblemForModel } from '@/lib/phone/validate'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _client: any = null
function db() {
  if (!_client) {
    _client = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )
  }
  return _client
}

export interface BookAppointmentArgs {
  tenantId: string
  /** The agent's business — see the note on Agent.business_id. */
  businessId?: string | null
  contactId: string
  conversationId: string
  customerName: string
  customerPhone: string
  service: string
  preferredDate?: string
  notes?: string
  /**
   * The agent's opening hours. Omitted only by callers that predate this
   * parameter, in which case the sensible default applies.
   */
  hours?: BusinessHours
  /**
   * Where to send the customer when the system cannot take the booking.
   * Comes from the caller; when there isn't one we simply promise a
   * callback instead of inventing a number.
   */
  fallbackContact?: string | null
}

interface NearbyRow {
  appointment_at: string
  conversation_id: string | null
  status: string | null
}

export async function bookAppointment(
  args: BookAppointmentArgs,
): Promise<string> {
  try {
    if (!args.customerName?.trim() || !args.customerPhone?.trim()) {
      return 'Missing name or phone — ask the customer for both before booking.'
    }

    // A booking with a number nobody can ring is worse than no booking: the
    // team finds out only when they dial it. Indian mobiles are 10 digits;
    // other countries need "+" and the country code (see lib/phone/validate).
    // The model is told what to ask for, and nothing is saved.
    const phoneCheck = checkPhone(args.customerPhone)
    if (!phoneCheck.ok) return phoneProblemForModel(args.customerPhone, phoneCheck)
    const customerPhone = phoneCheck.e164

    const hours = args.hours ?? parseBusinessHours(null)

    // ── The guard rail ──
    // Everything the customer said about timing goes through here, and
    // only an instant inside opening hours comes out.
    const slot = resolveSlot(args.preferredDate, hours)

    if (!slot.ok) {
      return [
        'BOOKING_NOT_SAVED:',
        slot.reason,
        'Tell the customer you cannot confirm a time right now, take their preferred time in their own words, and say the team will call to confirm.',
      ].join(' ')
    }

    // ── Overlap check ──
    // Look at this tenant's/business's appointments within a day of the
    // slot. Rows from THIS conversation are ignored so correcting your
    // own request never collides with its previous time.
    let finalIso = slot.iso
    let adjusted = slot.adjusted
    let adjustNote = slot.note
    let nearbyRequests = 0

    try {
      const slotMs = new Date(slot.iso).getTime()
      let q = db()
        .from('agent_appointments')
        .select('appointment_at, conversation_id, status')
        .eq('tenant_id', args.tenantId)
        .in('status', ['requested', 'confirmed'])
        .gte('appointment_at', new Date(slotMs - 86_400_000).toISOString())
        .lte('appointment_at', new Date(slotMs + 86_400_000).toISOString())
      if (args.businessId) q = q.eq('business_id', args.businessId)
      const { data: nearby } = await q

      const others: NearbyRow[] = ((nearby ?? []) as NearbyRow[]).filter(
        (r) => r.conversation_id !== args.conversationId,
      )
      const confirmed = others.filter((r) => r.status === 'confirmed').map((r) => r.appointment_at)

      const free = pickFreeSlot(slot.iso, hours, confirmed)
      if (!free) {
        return [
          'BOOKING_NOT_SAVED:',
          'That time is already taken and no free slot was found nearby.',
          'Tell the customer you cannot confirm a time right now, take their preferred time in their own words, and say the team will call to confirm.',
        ].join(' ')
      }
      if (free.moved) {
        finalIso = free.iso
        adjusted = true
        adjustNote = 'That time is already booked by someone else.'
      }
      nearbyRequests = others.filter(
        (r) => r.status === 'requested' && overlaps(finalIso, r.appointment_at, hours.slotMinutes),
      ).length
    } catch (err) {
      // No overlap data is not a reason to lose the lead.
      console.error('[booking-tools] overlap check failed (continuing):', err)
    }

    const label = labelFor(new Date(finalIso), hours)

    const notes = buildNotes(
      args.notes,
      args.preferredDate,
      adjusted ? adjustNote : undefined,
      nearbyRequests > 0
        ? `${nearbyRequests} other unconfirmed request${nearbyRequests > 1 ? 's' : ''} near this time`
        : undefined,
    )

    const row = {
      tenant_id: args.tenantId,
      business_id: args.businessId ?? null,
      contact_id: args.contactId,
      conversation_id: args.conversationId,
      customer_name: args.customerName.trim(),
      customer_phone: customerPhone,
      service: args.service?.trim() || 'Consultation',
      appointment_at: finalIso,
      // Keep the customer's own words alongside the resolved slot.
      // When staff ring back, "they asked for tonight" is the context
      // that makes the call make sense.
      notes,
      status: 'requested',
    }

    // ── Update-in-place on correction ──
    let existingId: string | null = null
    try {
      const sinceIso = new Date(Date.now() - RECENT_REQUEST_MS).toISOString()
      const { data: candidates } = await db()
        .from('agent_appointments')
        .select('id, customer_name, created_at')
        .eq('conversation_id', args.conversationId)
        .eq('status', 'requested')
        .gte('created_at', sinceIso)
        .order('created_at', { ascending: false })
        .limit(5)
      existingId = findRequestToUpdate(candidates ?? [], args.customerName)?.id ?? null
    } catch (err) {
      console.error('[booking-tools] existing-request lookup failed (inserting):', err)
    }

    let saved: { id: string } | null = null
    let saveError: { message?: string; details?: string } | null = null
    let wasUpdated = false

    if (existingId) {
      const upd = await db()
        .from('agent_appointments')
        .update({
          customer_name: row.customer_name,
          customer_phone: row.customer_phone,
          service: row.service,
          appointment_at: row.appointment_at,
          notes: row.notes,
        })
        .eq('id', existingId)
        .select('id')
        .single()
      saved = upd.data
      saveError = upd.error
      wasUpdated = true
    } else {
      const ins = await db().from('agent_appointments').insert(row).select('id').single()
      saved = ins.data
      saveError = ins.error
    }

    if (saveError || !saved) {
      console.error('[booking-tools] save failed:', saveError?.message, saveError?.details)
      // Signals failure to the model so it does NOT falsely tell the
      // customer the booking succeeded.
      return [
        'BOOKING_FAILED: Could not save the booking.',
        'Apologise briefly and',
        args.fallbackContact
          ? `give the customer this number to reach the team directly: ${args.fallbackContact}.`
          : 'promise that someone from the team will call them back shortly.',
        'Do NOT claim the booking was saved.',
      ].join(' ')
    }

    // Only name the contact when it has no real name yet. The booking name
    // lives on the appointment. Overwriting here renamed the whole WhatsApp
    // chat whenever someone booked FOR another person ("Neetu" became
    // "Amit Shah"), so the original customer vanished from the inbox.
    const { data: contactRow } = await db()
      .from('contacts')
      .select('name, phone')
      .eq('id', args.contactId)
      .maybeSingle()
    const currentName = String(contactRow?.name ?? '').trim()
    const looksLikePlaceholder =
      !currentName ||
      /^unknown$/i.test(currentName) ||
      /^[+\d\s()-]{6,}$/.test(currentName) ||
      /^website visitor\b/i.test(currentName)
    if (looksLikePlaceholder) {
      await db()
        .from('contacts')
        .update({ name: args.customerName.trim() })
        .eq('id', args.contactId)
    }

    // ── Show it in All leads ──
    // ingestLead finds the person by phone: someone who came in through
    // an ad stays ONE lead (touchpoints +1), a walk-in gets a new one.
    // Failure here must never undo or hide the booking itself.
    try {
      await ingestLead({
        tenantId: args.tenantId,
        businessId: args.businessId ?? null,
        contactId: args.contactId,
        conversationId: args.conversationId,
        source: 'whatsapp',
        name: args.customerName.trim(),
        phone: customerPhone,
        interest: args.service?.trim() || 'Consultation',
        lastMessage: `Booking requested: ${args.service?.trim() || 'Consultation'}`,
        extra: {
          appointment_id: saved.id,
          appointment_at: finalIso,
        },
      })
    } catch (err) {
      console.error('[booking-tools] lead capture failed (booking was saved):', err)
    }

    // ── What the model is told to say ──
    if (adjusted) {
      return [
        `Saved, but the time was changed to ${label}.`,
        adjustNote ?? '',
        `Tell the customer clearly that the time they asked for is not available and why, then offer ${label} and ask if that works.`,
        'Do not pretend their original time was accepted.',
      ].filter(Boolean).join(' ')
    }

    if (wasUpdated) {
      return [
        `Existing request updated to ${label} (no second booking was created).`,
        `Customer: ${args.customerName}, phone: ${customerPhone}.`,
        `Confirm the new time ${label} warmly and say the team will call to finalise the details.`,
      ].join(' ')
    }

    return [
      `Booking saved for ${label}.`,
      `Customer: ${args.customerName}, phone: ${customerPhone}.`,
      `Confirm ${label} warmly and say the team will call to finalise the details.`,
    ].join(' ')
  } catch (err) {
    console.error('[booking-tools] error:', err)
    return [
      'BOOKING_FAILED: A technical error occurred.',
      'Apologise and',
      args.fallbackContact
        ? `give the customer this number: ${args.fallbackContact}.`
        : 'promise a callback from the team shortly.',
    ].join(' ')
  }
}

/** Staff read this on the callback. Their words first, ours after. */
function buildNotes(
  notes: string | undefined,
  preferred: string | undefined,
  adjustment: string | undefined,
  nearby: string | undefined,
): string | null {
  const parts: string[] = []
  if (notes?.trim()) parts.push(notes.trim())
  if (preferred?.trim()) parts.push(`Customer asked for: "${preferred.trim()}"`)
  if (adjustment) parts.push(`Moved: ${adjustment}`)
  if (nearby) parts.push(nearby)
  return parts.length ? parts.join(' — ') : null
}
