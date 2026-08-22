// src/lib/agent/tools/booking-tools.ts
//
// Captures appointment/consultation requests from the AI agent.
//
// Saved as status 'requested' — a lead needing a callback, NOT a
// confirmed diary entry — so staff can tell an AI-captured request apart
// from an appointment a human actually agreed. Requires migration 019.
//
// ── WHAT CHANGED, AND WHY ────────────────────────────────────────────
// This tool used to accept whatever date string the model handed it and
// coerce it into an instant. "today" at 23:30 became `new Date()` — a
// midnight consultation, written to the table as a genuine request. The
// customer was told it was booked. Nobody was ever going to turn up.
//
// Times now go through resolveSlot(), which only ever returns an instant
// inside the business's opening hours. When the customer's preference
// cannot be honoured we still save the lead — a lead with an awkward
// time is worth far more than no lead — but we save the next real slot
// and tell the model, in the tool result, to say plainly that we moved
// it. The one thing we never do is claim a time we cannot keep.
//
// Used by: src/lib/agent/engine.ts
// Table:   agent_appointments

import { createClient } from '@supabase/supabase-js'
import {
  resolveSlot,
  parseBusinessHours,
  type BusinessHours,
} from '@/lib/agent/business-hours'

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
   * parameter, in which case the sensible default applies — which is
   * still an enormous improvement on no hours at all.
   */
  hours?: BusinessHours
  /**
   * Where to send the customer when the system cannot take the booking.
   * Previously a single clinic's number was hardcoded here, which meant
   * every other tenant's agent would read out a stranger's phone number
   * during their worst moment. Now it comes from the caller, and when
   * there isn't one we simply promise a callback instead.
   */
  fallbackContact?: string | null
}

export async function bookAppointment(
  args: BookAppointmentArgs,
): Promise<string> {
  try {
    if (!args.customerName?.trim() || !args.customerPhone?.trim()) {
      return 'Missing name or phone — ask the customer for both before booking.'
    }

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

    const { data, error } = await db()
      .from('agent_appointments')
      .insert({
        tenant_id: args.tenantId,
        business_id: args.businessId ?? null,
        contact_id: args.contactId,
        conversation_id: args.conversationId,
        customer_name: args.customerName.trim(),
        customer_phone: args.customerPhone.trim(),
        service: args.service?.trim() || 'Consultation',
        appointment_at: slot.iso,
        // Keep the customer's own words alongside the resolved slot.
        // When staff ring back, "they asked for tonight" is the context
        // that makes the call make sense.
        notes: buildNotes(args.notes, args.preferredDate, slot.adjusted ? slot.note : undefined),
        status: 'requested',
      })
      .select('id')
      .single()

    if (error || !data) {
      console.error('[booking-tools] insert failed:', error?.message, error?.details)
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

    await db()
      .from('contacts')
      .update({ name: args.customerName.trim() })
      .eq('id', args.contactId)

    // ── What the model is told to say ──
    // Two different scripts, because the honest thing to say depends on
    // whether we could keep the customer's time.
    if (slot.adjusted) {
      return [
        `Saved, but the time was changed to ${slot.label}.`,
        slot.note ?? '',
        `Tell the customer clearly that the time they asked for is not available and why, then offer ${slot.label} and ask if that works.`,
        'Do not pretend their original time was accepted.',
      ].filter(Boolean).join(' ')
    }

    return [
      `Booking saved for ${slot.label}.`,
      `Customer: ${args.customerName}, phone: ${args.customerPhone}.`,
      `Confirm ${slot.label} warmly and say the team will call to finalise the details.`,
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
): string | null {
  const parts: string[] = []
  if (notes?.trim()) parts.push(notes.trim())
  if (preferred?.trim()) parts.push(`Customer asked for: "${preferred.trim()}"`)
  if (adjustment) parts.push(`Moved: ${adjustment}`)
  return parts.length ? parts.join(' — ') : null
}
