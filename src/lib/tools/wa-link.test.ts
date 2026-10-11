// src/lib/tools/wa-link.test.ts
//
// A wrong WhatsApp link fails silently: it opens a chat with a stranger or
// "this number isn't on WhatsApp", and the visitor blames the business, not the
// tool. The classic ways people feed it wrong input are all covered here:
// typing the country code again, a leading 0, a "+" or "00" prefix, and
// punctuation.

import { describe, it, expect } from 'vitest'
import { buildWhatsAppLink } from './wa-link'

function link(countryCode: string, phone: string, message?: string) {
  const r = buildWhatsAppLink({ countryCode, phone, message })
  return r.ok ? r.link : r
}

describe('buildWhatsAppLink — the number', () => {
  it.each([
    ['plain national number', '91', '98765 43210', 'https://wa.me/919876543210'],
    ['punctuation and spaces', '1', '(415) 555-2671', 'https://wa.me/14155552671'],
    ['trunk 0 typed in front', '91', '098765 43210', 'https://wa.me/919876543210'],
    ['country code typed again', '91', '91 98765 43210', 'https://wa.me/919876543210'],
    ['country code typed again with +', '91', '+91 98765 43210', 'https://wa.me/919876543210'],
    ['US number typed with its leading 1', '1', '1 (415) 555-2671', 'https://wa.me/14155552671'],
    ['00 international prefix', '91', '0091 98765 43210', 'https://wa.me/919876543210'],
  ])('%s', (_label, cc, phone, want) => {
    expect(link(cc, phone)).toBe(want)
  })

  it('does not mistake an Indian mobile that happens to start with 91 for a country code', () => {
    // 9123456789 is a genuine 10-digit Indian mobile number.
    expect(link('91', '9123456789')).toBe('https://wa.me/919123456789')
  })

  it('keeps a national number that merely starts with the country code when it is not long enough to include one', () => {
    // Indonesian numbers vary from 8 to 12 digits; 6281234567 can be a national number.
    expect(link('62', '6281234567')).toBe('https://wa.me/626281234567')
    // The same leading digits on a long number do carry a repeated country code.
    expect(link('62', '6281234567890')).toBe('https://wa.me/6281234567890')
  })

  it('trusts a "+" number over the selected country', () => {
    // Someone left the dropdown on India but pasted a UK number.
    expect(link('91', '+44 7911 123456')).toBe('https://wa.me/447911123456')
  })
})

describe('buildWhatsAppLink — the message', () => {
  it('adds no text parameter when the message is empty or blank', () => {
    expect(link('91', '9876543210', '')).toBe('https://wa.me/919876543210')
    expect(link('91', '9876543210', '   \n ')).toBe('https://wa.me/919876543210')
    expect(link('91', '9876543210')).toBe('https://wa.me/919876543210')
  })

  it('trims and URL-encodes the message, including characters that would break a URL', () => {
    expect(link('91', '9876543210', '  Hi & bye #1\nline two 🙂 ')).toBe(
      'https://wa.me/919876543210?text=Hi%20%26%20bye%20%231%0Aline%20two%20%F0%9F%99%82',
    )
  })
})

describe('buildWhatsAppLink — rejecting what cannot work', () => {
  it('says why when there is no number', () => {
    expect(link('91', '')).toEqual({ ok: false, reason: 'empty' })
    expect(link('91', ' - ( ) ')).toEqual({ ok: false, reason: 'empty' })
  })

  it('says when the number is too short', () => {
    expect(link('91', '12345')).toEqual({ ok: false, reason: 'too-short' })
  })

  it('says when the number is longer than any phone number can be (15 digits with country code)', () => {
    expect(link('91', '98765432101234')).toEqual({ ok: false, reason: 'too-long' })
    expect(link('91', '+9198765432101234')).toEqual({ ok: false, reason: 'too-long' })
  })

  it('accepts the longest valid number (15 digits in total)', () => {
    expect(link('91', '+123456789012345')).toBe('https://wa.me/123456789012345')
  })
})
