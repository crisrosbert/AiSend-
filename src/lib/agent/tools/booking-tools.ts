// src/lib/agent/tools/booking-tools.ts
//
// Real database functions for capturing appointment/consultation
// requests. The AI agent calls these to book leads autonomously —
// no live human needed during the chat.
//
// Used by: src/lib/agent/engine.ts (registered in TOOLS)
// Table:   agent_appointments

import { createClient } from '@supabase/supabase-js'

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
  contactId: string
  conversationId: string
  customerName: string
  customerPhone: string
  service: string
  preferredDate?: string   // free text like "next Monday" or "29 March"
  notes?: string
}

/**
 * Capture a consultation/appointment request. Saves to agent_appointments
 * with status 'requested' (clinic confirms the exact slot later).
 * Returns a short confirmation string for the AI to relay.
 */
export async function bookAppointment(
  args: BookAppointmentArgs,
): Promise<string> {
  try {
    if (!args.customerName?.trim() || !args.customerPhone?.trim()) {
      return 'Missing name or phone — ask the customer for both before booking.'
    }

    const { data, error } = await db()
      .from('agent_appointments')
      .insert({
        tenant_id: args.tenantId,
        contact_id: args.contactId,
        conversation_id: args.conversationId,
        customer_name: args.customerName.trim(),
        customer_phone: args.customerPhone.trim(),
        service: args.service?.trim() || 'Consultation',
        appointment_at: parsePreferredDate(args.preferredDate),
        notes: args.notes?.trim() || args.preferredDate || null,
        status: 'requested',
      })
      .select('id')
      .single()

    if (error || !data) {
      console.error('[booking-tools] insert failed:', error?.message)
      return 'Could not save the booking right now. Tell the customer the team will reach out, and note their details.'
    }

    // Also update the contact with the real name + phone they provided
    await db()
      .from('contacts')
      .update({
        name: args.customerName.trim(),
        // Don't overwrite the web_ phone with their real one in `phone`
        // (that's the conversation key) — store in notes/metadata instead.
      })
      .eq('id', args.contactId)

    const dateStr = args.preferredDate ? ` for ${args.preferredDate}` : ''
    return `Booking request saved successfully${dateStr}. The customer's name is ${args.customerName} and phone is ${args.customerPhone}. Confirm to them that the team will reach out on their number to finalize the exact time.`
  } catch (err) {
    console.error('[booking-tools] error:', err)
    return 'Could not save the booking. Reassure the customer the team will contact them.'
  }
}

/**
 * Best-effort parse of free-text dates into a timestamp.
 * Falls back to 2 days from now if unparseable — the clinic confirms
 * the real time anyway, so this is just a placeholder.
 */
function parsePreferredDate(text?: string): string {
  if (!text) {
    const d = new Date()
    d.setDate(d.getDate() + 2)
    return d.toISOString()
  }

  // Try native Date parsing first (handles "29 March", "2026-03-29", etc.)
  const parsed = new Date(text)
  if (!isNaN(parsed.getTime()) && parsed.getFullYear() > 2024) {
    return parsed.toISOString()
  }

  // Handle relative terms
  const lower = text.toLowerCase()
  const now = new Date()
  if (lower.includes('today')) return now.toISOString()
  if (lower.includes('tomorrow')) {
    now.setDate(now.getDate() + 1)
    return now.toISOString()
  }

  // Default: 2 days out (placeholder — clinic sets real time)
  now.setDate(now.getDate() + 2)
  return now.toISOString()
}
