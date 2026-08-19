// src/lib/widget/origin.test.ts

import { describe, it, expect, afterEach } from 'vitest'
import {
  normaliseDomain,
  parseDomainList,
  originAllowed,
  corsHeaders,
  allowlistFromConfig,
} from './origin'

afterEach(() => {
  delete process.env.WIDGET_REQUIRE_ALLOWLIST
})

describe('normaliseDomain', () => {
  it('reduces every way a merchant might type their site to one hostname', () => {
    for (const input of [
      'example.com',
      'EXAMPLE.COM',
      '  example.com  ',
      'https://example.com',
      'http://example.com/',
      'https://example.com/contact?x=1#top',
      'https://example.com:8443/',
      'https://user:pass@example.com/',
    ]) {
      expect(normaliseDomain(input), input).toBe('example.com')
    }
  })

  it('keeps a wildcard subdomain pattern', () => {
    expect(normaliseDomain('*.example.com')).toBe('*.example.com')
  })

  it('rejects a bare wildcard', () => {
    // Allowing everything is what an empty list already means; typing
    // `*` is far more likely a mistake.
    expect(normaliseDomain('*')).toBeNull()
    expect(normaliseDomain('*.')).toBeNull()
  })

  it('rejects things that are not hostnames', () => {
    for (const input of ['', '   ', 'not a domain', 'javascript:alert(1)', '...', '-bad.com']) {
      expect(normaliseDomain(input), input).toBeNull()
    }
  })
})

describe('parseDomainList', () => {
  it('splits on the separators a person actually uses', () => {
    expect(parseDomainList('a.com, b.com\nc.com;  d.com')).toEqual([
      'a.com', 'b.com', 'c.com', 'd.com',
    ])
  })

  it('deduplicates after normalising', () => {
    expect(parseDomainList('https://a.com/, a.com, A.COM')).toEqual(['a.com'])
  })

  it('drops junk rather than storing it', () => {
    expect(parseDomainList('a.com, not a domain, b.com')).toEqual(['a.com', 'b.com'])
  })

  it('accepts an array as well as a string', () => {
    expect(parseDomainList(['a.com', 'https://b.com'])).toEqual(['a.com', 'b.com'])
  })

  it('treats null and empty as an empty list', () => {
    expect(parseDomainList(null)).toEqual([])
    expect(parseDomainList('')).toEqual([])
  })
})

describe('originAllowed', () => {
  it('allows anything when no allowlist is configured', () => {
    // Widgets are live with no allowlist today. Denying here would take
    // them down on deploy.
    expect(originAllowed('https://anyone.com', [])).toBe(true)
    expect(originAllowed(null, [])).toBe(true)
  })

  it('denies an unconfigured widget when the env flag demands a list', () => {
    process.env.WIDGET_REQUIRE_ALLOWLIST = 'true'
    expect(originAllowed('https://anyone.com', [])).toBe(false)
  })

  it('allows the listed domain and its www form', () => {
    const list = ['kalosa.in']
    expect(originAllowed('https://kalosa.in', list)).toBe(true)
    expect(originAllowed('https://www.kalosa.in', list)).toBe(true)
  })

  it('allows the bare domain when the merchant listed the www form', () => {
    expect(originAllowed('https://kalosa.in', ['www.kalosa.in'])).toBe(true)
  })

  it('ignores the port and path in the Origin', () => {
    expect(originAllowed('http://kalosa.in:3000', ['kalosa.in'])).toBe(true)
  })

  it('blocks a different site', () => {
    expect(originAllowed('https://attacker.com', ['kalosa.in'])).toBe(false)
  })

  it('blocks a lookalike that merely ends with the domain', () => {
    // The bug this catches: a naive endsWith() lets
    // `kalosa.in.attacker.com` through.
    expect(originAllowed('https://kalosa.in.attacker.com', ['kalosa.in'])).toBe(false)
    expect(originAllowed('https://notkalosa.in', ['kalosa.in'])).toBe(false)
  })

  it('does not allow a random subdomain unless a wildcard was stated', () => {
    // On a platform that hands out subdomains, shop.example.com can
    // belong to someone else.
    expect(originAllowed('https://shop.kalosa.in', ['kalosa.in'])).toBe(false)
  })

  it('allows subdomains when the merchant asked for a wildcard', () => {
    const list = ['*.kalosa.in']
    expect(originAllowed('https://shop.kalosa.in', list)).toBe(true)
    expect(originAllowed('https://kalosa.in', list)).toBe(true)
    expect(originAllowed('https://kalosa.in.attacker.com', list)).toBe(false)
  })

  it('denies a missing Origin once a list exists', () => {
    // curl sends no Origin. That is exactly the caller we are stopping.
    expect(originAllowed(null, ['kalosa.in'])).toBe(false)
    expect(originAllowed('', ['kalosa.in'])).toBe(false)
  })

  it('denies a non-http origin', () => {
    expect(originAllowed('null', ['kalosa.in'])).toBe(false)
    expect(originAllowed('file://', ['kalosa.in'])).toBe(false)
  })
})

describe('corsHeaders', () => {
  it('echoes a validated origin and marks the response as varying by it', () => {
    const headers = corsHeaders('https://kalosa.in', ['kalosa.in'])
    expect(headers['Access-Control-Allow-Origin']).toBe('https://kalosa.in')
    expect(headers['Vary']).toBe('Origin')
  })

  it('never echoes an origin that failed the check', () => {
    const headers = corsHeaders('https://attacker.com', ['kalosa.in'])
    expect(headers['Access-Control-Allow-Origin']).toBe('*')
  })

  it('falls back to a wildcard when nothing is configured', () => {
    expect(corsHeaders('https://anyone.com', [])['Access-Control-Allow-Origin']).toBe('*')
  })
})

describe('allowlistFromConfig', () => {
  it('reads a Postgres text[]', () => {
    expect(allowlistFromConfig({ allowed_domains: ['a.com', 'b.com'] })).toEqual([
      'a.com', 'b.com',
    ])
  })

  it('reads a JSON string, as older rows may hold', () => {
    expect(allowlistFromConfig({ allowed_domains: '["a.com"]' })).toEqual(['a.com'])
  })

  it('reads a comma-separated string', () => {
    expect(allowlistFromConfig({ allowed_domains: 'a.com, b.com' })).toEqual(['a.com', 'b.com'])
  })

  it('returns empty for a row that has no such column', () => {
    expect(allowlistFromConfig({ id: 1 })).toEqual([])
    expect(allowlistFromConfig(null)).toEqual([])
  })
})
