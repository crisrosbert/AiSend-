import { describe, expect, it } from 'vitest'
import {
  BUSINESS_COOKIE,
  businessFromCookieHeader,
  resolveBusiness,
  resolveBusinessId,
  type BusinessRef,
} from './resolve'

const biz = (id: string, is_default = false): BusinessRef => ({
  id,
  name: `Business ${id}`,
  is_default,
  logo_url: null,
})

describe('resolveBusiness', () => {
  it('returns null when the user owns nothing', () => {
    expect(resolveBusiness('anything', [])).toBeNull()
    expect(resolveBusiness(null, [])).toBeNull()
  })

  it('returns the requested business when the user owns it', () => {
    const owned = [biz('a', true), biz('b')]
    expect(resolveBusiness('b', owned)?.id).toBe('b')
  })

  // The one that matters: a stale cookie from another account must not
  // become a cross-account read.
  it('falls back to the default when the requested id is not owned', () => {
    const owned = [biz('a', true), biz('b')]
    const got = resolveBusiness('someone-elses-id', owned)
    expect(got?.id).toBe('a')
    expect(got?.id).not.toBe('someone-elses-id')
  })

  it('returns the default when nothing is requested', () => {
    const owned = [biz('a'), biz('b', true)]
    expect(resolveBusiness(null, owned)?.id).toBe('b')
    expect(resolveBusiness(undefined, owned)?.id).toBe('b')
    expect(resolveBusiness('', owned)?.id).toBe('b')
  })

  // A broken is_default flag should degrade to the wrong-ish business,
  // not to a dead app.
  it('returns the first owned business when none is flagged default', () => {
    const owned = [biz('a'), biz('b')]
    expect(resolveBusiness(null, owned)?.id).toBe('a')
  })

  it('survives a missing owned list', () => {
    expect(resolveBusiness('a', undefined as unknown as BusinessRef[])).toBeNull()
  })
})

describe('resolveBusinessId', () => {
  it('returns the id, or null when there is nothing to resolve', () => {
    expect(resolveBusinessId('b', [biz('a', true), biz('b')])).toBe('b')
    expect(resolveBusinessId('b', [])).toBeNull()
  })
})

describe('businessFromCookieHeader', () => {
  it('returns null when there is no header or no cookie', () => {
    expect(businessFromCookieHeader(null)).toBeNull()
    expect(businessFromCookieHeader(undefined)).toBeNull()
    expect(businessFromCookieHeader('')).toBeNull()
    expect(businessFromCookieHeader('sb-access-token=xyz')).toBeNull()
  })

  it('reads the value when it is the only cookie', () => {
    expect(businessFromCookieHeader(`${BUSINESS_COOKIE}=abc123`)).toBe('abc123')
  })

  it('reads the value from among other cookies, in any position', () => {
    expect(businessFromCookieHeader(`a=1; ${BUSINESS_COOKIE}=abc123; b=2`)).toBe('abc123')
    expect(businessFromCookieHeader(`a=1;${BUSINESS_COOKIE}=abc123`)).toBe('abc123')
    expect(businessFromCookieHeader(`${BUSINESS_COOKIE}=abc123; a=1`)).toBe('abc123')
  })

  it('does not match a cookie that merely ends with the name', () => {
    expect(businessFromCookieHeader(`not_${BUSINESS_COOKIE}=abc123`)).toBeNull()
  })

  it('decodes percent-encoded values', () => {
    expect(businessFromCookieHeader(`${BUSINESS_COOKIE}=a%20b`)).toBe('a b')
  })

  // Base64-ish ids contain '=' padding; splitting on '=' must not lose it.
  it('keeps everything after the first = sign', () => {
    expect(businessFromCookieHeader(`${BUSINESS_COOKIE}=abc==`)).toBe('abc==')
  })

  // "absent" and "empty" must not diverge — both mean "nothing requested",
  // which resolveBusiness reads as "give me the default".
  it('treats an empty value as absent', () => {
    expect(businessFromCookieHeader(`${BUSINESS_COOKIE}=`)).toBeNull()
    expect(businessFromCookieHeader(`${BUSINESS_COOKIE}=   `)).toBeNull()
  })
})

describe('the cookie round-trip', () => {
  // The two halves of the boundary, exercised together: what the browser
  // sends is what resolution acts on.
  it('resolves a business from a raw Cookie header', () => {
    const owned = [biz('a', true), biz('b')]
    const header = `sb-access-token=xyz; ${BUSINESS_COOKIE}=b; theme=dark`
    expect(resolveBusiness(businessFromCookieHeader(header), owned)?.id).toBe('b')
  })

  it('falls back to the default when the cookie is stale', () => {
    const owned = [biz('a', true), biz('b')]
    const header = `${BUSINESS_COOKIE}=deleted-business`
    expect(resolveBusiness(businessFromCookieHeader(header), owned)?.id).toBe('a')
  })
})
