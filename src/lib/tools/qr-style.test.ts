import { describe, expect, it } from 'vitest'
import { contrastRatio, normalizeHex, parseWhatsAppShareLink, qrReadability } from './qr-style'

describe('normalizeHex', () => {
  it('accepts 6-digit colours and lowercases them', () => {
    expect(normalizeHex('#1B6B4A')).toBe('#1b6b4a')
  })

  it('expands 3-digit colours', () => {
    expect(normalizeHex('#0fa')).toBe('#00ffaa')
  })

  it('adds a missing #', () => {
    expect(normalizeHex('0c1f17')).toBe('#0c1f17')
  })

  it('rejects anything that is not a hex colour', () => {
    expect(normalizeHex('green')).toBeNull()
    expect(normalizeHex('#12345')).toBeNull()
    expect(normalizeHex('')).toBeNull()
    expect(normalizeHex('#gg0000')).toBeNull()
  })
})

describe('contrastRatio', () => {
  it('is 21 for black on white and 1 for identical colours', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 5)
    expect(contrastRatio('#336699', '#336699')).toBeCloseTo(1, 5)
  })

  it('does not depend on the order of the colours', () => {
    expect(contrastRatio('#1b6b4a', '#ffffff')).toBeCloseTo(contrastRatio('#ffffff', '#1b6b4a'), 10)
  })
})

describe('qrReadability', () => {
  it('passes a dark code on a light background', () => {
    expect(qrReadability('#0c1f17', '#ffffff')).toEqual({ status: 'ok' })
    expect(qrReadability('#1b6b4a', '#ffffff')).toEqual({ status: 'ok' })
  })

  it('blocks colours that are too close together', () => {
    expect(qrReadability('#7fd9a0', '#ffffff')).toEqual({ status: 'low-contrast' })
    expect(qrReadability('#25d366', '#ffffff')).toEqual({ status: 'low-contrast' })
  })

  it('warns when the code is lighter than its background', () => {
    expect(qrReadability('#ffffff', '#0c1f17')).toEqual({ status: 'inverted' })
  })

  it('treats an unreadable colour as low contrast instead of throwing', () => {
    expect(qrReadability('nonsense', '#ffffff')).toEqual({ status: 'low-contrast' })
  })
})

describe('parseWhatsAppShareLink', () => {
  it('accepts a group invite link', () => {
    expect(parseWhatsAppShareLink('https://chat.whatsapp.com/Abc123XyZ')).toEqual({
      ok: true,
      kind: 'group',
      url: 'https://chat.whatsapp.com/Abc123XyZ',
    })
  })

  it('accepts a channel link', () => {
    expect(parseWhatsAppShareLink('https://whatsapp.com/channel/0029VaAbC')).toEqual({
      ok: true,
      kind: 'channel',
      url: 'https://whatsapp.com/channel/0029VaAbC',
    })
    expect(parseWhatsAppShareLink('https://www.whatsapp.com/channel/0029VaAbC').ok).toBe(true)
  })

  it('adds https:// when it was left off and trims spaces', () => {
    expect(parseWhatsAppShareLink('  chat.whatsapp.com/Abc123XyZ ')).toEqual({
      ok: true,
      kind: 'group',
      url: 'https://chat.whatsapp.com/Abc123XyZ',
    })
  })

  it('drops tracking parameters that are not needed', () => {
    const r = parseWhatsAppShareLink('https://chat.whatsapp.com/Abc123XyZ?mode=r_t&utm_source=x')
    expect(r).toEqual({ ok: true, kind: 'group', url: 'https://chat.whatsapp.com/Abc123XyZ' })
  })

  it('reports an empty box', () => {
    expect(parseWhatsAppShareLink('   ')).toEqual({ ok: false, reason: 'empty' })
  })

  it('rejects links that are not WhatsApp group or channel links', () => {
    expect(parseWhatsAppShareLink('https://example.com/Abc')).toEqual({ ok: false, reason: 'not-whatsapp' })
    expect(parseWhatsAppShareLink('https://chat.whatsapp.com.evil.example/Abc')).toEqual({ ok: false, reason: 'not-whatsapp' })
    expect(parseWhatsAppShareLink('javascript:alert(1)')).toEqual({ ok: false, reason: 'not-whatsapp' })
    expect(parseWhatsAppShareLink('http://chat.whatsapp.com/Abc123')).toEqual({ ok: false, reason: 'not-whatsapp' })
  })

  it('rejects a WhatsApp address that is missing the invite code', () => {
    expect(parseWhatsAppShareLink('https://chat.whatsapp.com/')).toEqual({ ok: false, reason: 'missing-code' })
    expect(parseWhatsAppShareLink('https://whatsapp.com/channel/')).toEqual({ ok: false, reason: 'missing-code' })
  })
})
