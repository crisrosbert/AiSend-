import { describe, it, expect } from 'vitest'
import { checkPhone, looksLikeJunkDigits, phoneProblemForModel } from '@/lib/phone/validate'

describe('Indian numbers', () => {
  it.each([
    ['9810055123', '+919810055123'],
    ['98100 55123', '+919810055123'],
    ['098100-55123', '+919810055123'],
    ['919810055123', '+919810055123'],
    ['+91 98100 55123', '+919810055123'],
    ['+91-(98100) 55123', '+919810055123'],
    ['0091 98100 55123', '+919810055123'],
    ['7664435475', '+917664435475'],
    ['6000012345', '+916000012345'],
  ])('accepts %s', (input, e164) => {
    const r = checkPhone(input)
    expect(r.ok).toBe(true)
    if (r.ok) { expect(r.e164).toBe(e164); expect(r.country).toBe('IN') }
  })

  it('rejects the 11-digit number from the Kalosa test', () => {
    const r = checkPhone('76644354756')
    expect(r.ok).toBe(false)
  })

  it('rejects 000000000 and other junk', () => {
    for (const j of ['000000000', '0000000000', '9999999999', '9876543210', '1234567890', '9898989898', '9000000000', '8888888888']) {
      expect(checkPhone(j).ok).toBe(false)
    }
  })

  it.each([
    ['5876543201', 'indian_format'],   // starts with 5
    ['1234567899', 'indian_format'],
    ['98765432', 'too_short'],
    ['987654320', 'too_short'],        // 9 digits
    ['98100551230', 'indian_format'],  // 11 digits, not a 0 prefix
    ['9810055123023', 'too_long'],
    ['+91 98765 4320', 'too_short'],   // +91 + 9 digits = 11 digits total: international length ok, Indian rule fails
  ])('rejects %s', (input) => {
    expect(checkPhone(input).ok).toBe(false)
  })

  it('+91 with a bad national part is an Indian-format problem', () => {
    const r = checkPhone('+91 5876543201')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.problem).toBe('indian_format')
  })
})

describe('international numbers keep working', () => {
  it.each([
    ['+44 7911 123456', '+447911123456'],
    ['+1 (415) 555-2671', '+14155552671'],
    ['+971 50 765 4321', '+971507654321'],
    ['0044 7911 123456', '+447911123456'],
    ['+65 9123 4567', '+6591234567'],
  ])('accepts %s', (input, e164) => {
    const r = checkPhone(input)
    expect(r.ok).toBe(true)
    if (r.ok) { expect(r.e164).toBe(e164); expect(r.country).toBe('OTHER') }
  })

  it('rejects international junk and wrong lengths', () => {
    expect(checkPhone('+1111111111').ok).toBe(false)
    expect(checkPhone('+44 123').ok).toBe(false)
    expect(checkPhone('+1234567890123456').ok).toBe(false)
    expect(checkPhone('+0123456789').ok).toBe(false)
  })

  it('a foreign number without + is not guessed', () => {
    expect(checkPhone('447911123456').ok).toBe(false)
  })
})

describe('bad input', () => {
  it.each([undefined, null, 42, '', '   ', 'none', 'call me', 'abc123'])('rejects %s', (v) => {
    expect(checkPhone(v as unknown).ok).toBe(false)
  })
  it('letters are named as such', () => {
    const r = checkPhone('call me')
    expect(!r.ok && r.problem).toBe('letters')
  })
})

describe('looksLikeJunkDigits', () => {
  it('flags repeats and runs but not ordinary numbers', () => {
    expect(looksLikeJunkDigits('0000000000')).toBe(true)
    expect(looksLikeJunkDigits('9876543210')).toBe(true)
    expect(looksLikeJunkDigits('9812345678')).toBe(true)
    expect(looksLikeJunkDigits('9812345670')).toBe(false) // a 7-run alone is not enough
    expect(looksLikeJunkDigits('9810055123')).toBe(false)
    expect(looksLikeJunkDigits('7664435475')).toBe(false)
    expect(looksLikeJunkDigits('9810055555')).toBe(false) // 5 in a row is fine
  })
})

describe('phoneProblemForModel', () => {
  it('tells the model not to book and what to ask for', () => {
    const r = checkPhone('76644354756')
    if (r.ok) throw new Error('expected failure')
    const text = phoneProblemForModel('76644354756', r)
    expect(text).toContain('PHONE_INVALID')
    expect(text).toContain('Do NOT book')
    expect(text).toContain('10-digit')
  })
})
