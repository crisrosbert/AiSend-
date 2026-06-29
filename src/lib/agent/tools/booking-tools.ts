// src/lib/agent/tools/booking-tools.ts
//
// Captures appointment/consultation requests from the AI agent.
// Saves as status 'requested' (a lead needing a callback) — NOT
// 'confirmed', so clinic staff can tell real appointments apart from
// AI-captured leads. Requires migration 019 to allow 'requested'.
//
// Used by: src/lib/agent/engine.ts
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
  preferredDate?: string
  notes?: string
}

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
      console.error('[booking-tools] insert failed:', error?.message, error?.details)
      // Return a string that signals failure to the AI so it does NOT
      // falsely tell the customer the booking succeeded.
      return 'BOOKING_FAILED: Could not save the booking to the system. Apologize briefly and give the customer the clinic WhatsApp +91 9818816485 to reach out directly. Do NOT claim the booking was saved.'
    }

    await db()
      .from('contacts')
      .update({ name: args.customerName.trim() })
      .eq('id', args.contactId)

    const dateStr = args.preferredDate ? ` for ${args.preferredDate}` : ''
    return `Booking saved successfully${dateStr}. Customer: ${args.customerName}, phone: ${args.customerPhone}. Now confirm warmly that the team will reach out on their number to finalize the exact time.`
  } catch (err) {
    console.error('[booking-tools] error:', err)
    return 'BOOKING_FAILED: A technical error occurred. Apologize and give the customer the clinic WhatsApp +91 9818816485 to reach out directly.'
  }
}

function parsePreferredDate(text?: string): string {
  if (!text) {
    const d = new Date()
    d.setDate(d.getDate() + 2)
    return d.toISOString()
  }
  const parsed = new Date(text)
  if (!isNaN(parsed.getTime()) && parsed.getFullYear() > 2024) {
    return parsed.toISOString()
  }
  const lower = text.toLowerCase()
  const now = new Date()
  if (lower.includes('today')) return now.toISOString()
  if (lower.includes('tomorrow')) {
    now.setDate(now.getDate() + 1)
    return now.toISOString()
  }
  now.setDate(now.getDate() + 2)
  return now.toISOString()
}
