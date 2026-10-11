// src/lib/tools/lead-form.test.ts
//
// The lead form on the free-tool pages is the point of the page: SEO brings
// the visitor, this form (or the WhatsApp button next to it) turns them into
// a lead. A form that rejects good numbers loses the lead; one that accepts
// junk fills the CRM with it; one that fails silently loses it without anyone
// knowing. These tests pin down all three.

import { describe, it, expect, vi } from 'vitest'
import { validateLeadForm, submitLead, buildWhatsAppLeadLink, type LeadFormInput } from './lead-form'

const good: LeadFormInput = {
  name: '  Riya Verma ',
  countryCode: '91',
  phone: '98765 43210',
  email: ' riya@shop.example ',
  interest: 'WhatsApp broadcasts',
  message: ' Need to message 2,000 customers ',
  consent: true,
}

describe('validateLeadForm', () => {
  it('cleans a good submission: trimmed text, full international number, blank optionals as null', () => {
    const r = validateLeadForm(good)
    expect(r).toEqual({
      ok: true,
      value: {
        name: 'Riya Verma',
        phone: '919876543210',
        email: 'riya@shop.example',
        interest: 'WhatsApp broadcasts',
        message: 'Need to message 2,000 customers',
      },
    })

    const minimal = validateLeadForm({ ...good, email: '  ', interest: '', message: '' })
    expect(minimal.ok && minimal.value).toMatchObject({ email: null, interest: null, message: null })
  })

  it.each([
    ['no name', { name: '   ' }, 'name'],
    ['a one-letter name', { name: 'R' }, 'name'],
    ['no phone', { phone: '' }, 'phone'],
    ['a phone that is too short', { phone: '12345' }, 'phone'],
    ['a malformed email', { email: 'riya@' }, 'email'],
    ['no consent', { consent: false }, 'consent'],
  ] as const)('flags %s on the %s field and nothing else', (_label, patch, field) => {
    const r = validateLeadForm({ ...good, ...patch })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(Object.keys(r.errors)).toEqual([field])
  })

  it('reports every problem at once so the visitor fixes the form in one pass', () => {
    const r = validateLeadForm({ ...good, name: '', phone: '1', consent: false })
    expect(!r.ok && Object.keys(r.errors).sort()).toEqual(['consent', 'name', 'phone'])
  })
})

describe('submitLead', () => {
  const lead = {
    name: 'Riya Verma',
    phone: '919876543210',
    email: 'riya@shop.example',
    interest: 'WhatsApp broadcasts',
    message: 'Need to message 2,000 customers',
  }
  const ctx = { key: 'pk_test_123', pageUrl: 'https://aisend.example/tools/whatsapp-link-generator', form: 'tool-link-generator' }

  function jsonReply(body: unknown, status = 200) {
    return vi.fn<typeof fetch>(async () => new Response(JSON.stringify(body), { status }))
  }

  it('posts the lead to the capture endpoint as text/plain JSON with the public key and page context', async () => {
    const fetchFn = jsonReply({ ok: true })
    const result = await submitLead({ lead, honeypot: '', ...ctx, fetchFn })

    expect(result).toEqual({ ok: true })
    const [url, init] = fetchFn.mock.calls[0]
    expect(url).toBe('/api/leads/capture')
    expect(init?.method).toBe('POST')
    // text/plain keeps this a "simple" request: no CORS preflight, and the
    // lead still goes out if the visitor navigates away right after tapping.
    expect((init?.headers as Record<string, string>)['Content-Type']).toBe('text/plain')
    expect(JSON.parse(init?.body as string)).toMatchObject({
      key: 'pk_test_123',
      name: 'Riya Verma',
      phone: '+919876543210',
      email: 'riya@shop.example',
      interest: 'WhatsApp broadcasts',
      message: 'Need to message 2,000 customers',
      form: 'tool-link-generator',
      page_url: 'https://aisend.example/tools/whatsapp-link-generator',
    })
  })

  it('drops the optional fields it does not have instead of sending nulls', async () => {
    const fetchFn = jsonReply({ ok: true })
    await submitLead({ lead: { ...lead, email: null, interest: null, message: null }, honeypot: '', ...ctx, fetchFn })
    const body = JSON.parse(fetchFn.mock.calls[0][1]?.body as string)
    expect(body).not.toHaveProperty('email')
    expect(body).not.toHaveProperty('interest')
    expect(body).not.toHaveProperty('message')
  })

  it('pretends to succeed for a bot that filled the hidden field, without contacting the server', async () => {
    const fetchFn = jsonReply({ ok: true })
    expect(await submitLead({ lead, honeypot: 'http://spam.example', ...ctx, fetchFn })).toEqual({ ok: true })
    expect(fetchFn).not.toHaveBeenCalled()
  })

  it('surfaces the server\'s own reason when it rejects the lead', async () => {
    const fetchFn = jsonReply({ ok: false, error: 'Too many requests' }, 429)
    expect(await submitLead({ lead, honeypot: '', ...ctx, fetchFn })).toEqual({ ok: false, error: 'Too many requests' })
  })

  it('fails with a usable message — never throws — on a network error or a non-JSON reply', async () => {
    const offline = await submitLead({
      lead, honeypot: '', ...ctx,
      fetchFn: vi.fn<typeof fetch>(async () => { throw new Error('socket hang up') }),
    })
    expect(offline.ok).toBe(false)

    const html = await submitLead({
      lead, honeypot: '', ...ctx,
      fetchFn: vi.fn<typeof fetch>(async () => new Response('<html>502</html>', { status: 502 })),
    })
    expect(html.ok).toBe(false)
    if (!html.ok) expect(html.error.length).toBeGreaterThan(10)
  })
})

describe('buildWhatsAppLeadLink', () => {
  it('opens a chat with the team number, carrying the visitor\'s details and where they came from', () => {
    const link = buildWhatsAppLeadLink({
      to: '918707879485',
      lead: { name: 'Riya Verma', phone: '919876543210', email: null, interest: 'WhatsApp broadcasts', message: 'Need 2,000 sends' },
      source: 'WhatsApp Link Generator page',
    })
    expect(link.startsWith('https://wa.me/918707879485?text=')).toBe(true)
    const text = decodeURIComponent(link.split('?text=')[1])
    expect(text).toContain('Riya Verma')
    expect(text).toContain('+919876543210')
    expect(text).toContain('WhatsApp broadcasts')
    expect(text).toContain('Need 2,000 sends')
    expect(text).toContain('WhatsApp Link Generator page')
  })
})
