import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { checkWaRedirect, waRedirectView, isMissingWaRedirectColumnError, withoutWaRedirectColumns } from './wa-redirect'

describe('direct-to-WhatsApp settings', () => {
  it('blocks saving ON without a valid number', () => {
    expect(checkWaRedirect({ enabled: true, number: '', fallback: '' }).ok).toBe(false)
    expect(checkWaRedirect({ enabled: true, number: 'abc', fallback: '' }).ok).toBe(false)
  })
  it('stores digits; OFF never blocks', () => {
    expect(checkWaRedirect({ enabled: true, number: '+91 87078 79485', fallback: '' })).toEqual({ ok: true, number: '918707879485' })
    expect(checkWaRedirect({ enabled: true, number: '', fallback: '918707879485' })).toEqual({ ok: true, number: '' })
    expect(checkWaRedirect({ enabled: false, number: 'abc', fallback: '' }).ok).toBe(true)
  })
  it('visitor config: ON only with switch AND valid number, falls back to business_phone', () => {
    expect(waRedirectView({})).toEqual({ wa_redirect_enabled: false, wa_redirect_number: '' })
    expect(waRedirectView({ wa_redirect_enabled: true })).toEqual({ wa_redirect_enabled: false, wa_redirect_number: '' })
    expect(waRedirectView({ wa_redirect_enabled: true, wa_redirect_number: '8707879485' })).toEqual({ wa_redirect_enabled: true, wa_redirect_number: '918707879485' })
    expect(waRedirectView({ wa_redirect_enabled: true, business_phone: '918707879485' }).wa_redirect_enabled).toBe(true)
  })
  it('missing-column helpers', () => {
    expect(isMissingWaRedirectColumnError({ code: '42703', message: 'column "wa_redirect_enabled" does not exist' })).toBe(true)
    expect(isMissingWaRedirectColumnError({ code: '42703', message: 'column "x" does not exist' })).toBe(false)
    expect(withoutWaRedirectColumns({ a: 1, wa_redirect_enabled: true, wa_redirect_number: '' })).toEqual({ a: 1 })
  })
  it('widget.js sends to wa.me and skips the AI call in this mode', () => {
    const src = readFileSync(join(process.cwd(), 'public', 'widget.js'), 'utf8')
    expect(src).toMatch(/function deliver\(text\) \{\s*\/\/ Direct-to-WhatsApp mode[\s\S]*?redirectToWhatsapp\(text\);\s*return;/)
    expect(src).toContain("'https://wa.me/' + digits + '?text='")
  })
})
