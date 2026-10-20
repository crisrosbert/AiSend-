import { describe, expect, it } from 'vitest'
import { isPermanentFailure, isRetryableFailure } from './retry'

describe('failure classification', () => {
  it('retries temporary problems', () => {
    expect(isRetryableFailure('(#130429) Rate limit hit')).toBe(true)
    expect(isRetryableFailure('Service temporarily unavailable')).toBe(true)
    expect(isRetryableFailure('fetch failed')).toBe(true)
  })
  it('never retries permanent ones', () => {
    expect(isRetryableFailure('Invalid phone number format')).toBe(false)
    expect(isPermanentFailure('Invalid phone number format')).toBe(true)
    expect(isRetryableFailure('Recipient is not a valid WhatsApp user')).toBe(false)
  })
  it('does not retry unknown or empty errors', () => {
    expect(isRetryableFailure('')).toBe(false)
    expect(isRetryableFailure(null)).toBe(false)
    expect(isRetryableFailure('Insufficient wallet balance')).toBe(false)
  })
})
