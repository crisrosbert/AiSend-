import { describe, it, expect, vi } from 'vitest'

// If the phone check works, the database is never touched for a bad number.
// (If the database were touched, the tool would answer BOOKING_FAILED and the asserts below would fail.)
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => { throw new Error('database must not be used for an invalid phone') },
}))
vi.mock('@/lib/leads/ingest', () => ({ ingestLead: vi.fn() }))

import { bookAppointment } from '@/lib/agent/tools/booking-tools'

const base = {
  tenantId: 't1', contactId: 'c1', conversationId: 'v1',
  customerName: 'Test User', service: 'Consultation', preferredDate: 'tomorrow 6 pm',
}

describe('bookAppointment refuses an unusable phone number', () => {
  it.each(['76644354756', '000000000', '9999999999', '12345', 'call me'])('%s', async (phone) => {
    const out = await bookAppointment({ ...base, customerPhone: phone })
    expect(out).toContain('PHONE_INVALID')
    expect(out).toContain('Do NOT book')
    expect(out).not.toContain('Booking saved')
  })

  it('still asks for a missing phone the old way', async () => {
    const out = await bookAppointment({ ...base, customerPhone: '  ' })
    expect(out).toContain('Missing name or phone')
  })
})
