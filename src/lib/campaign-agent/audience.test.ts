import { describe, expect, it } from 'vitest'
import { cleanAudience, firstName, recencyFrom, usablePhone } from './audience'

describe('audience helpers', () => {
  it('uses a safe first name', () => {
    expect(firstName('Priya Sharma')).toBe('Priya')
    expect(firstName('  ')).toBe('there')
    expect(firstName(null)).toBe('there')
    expect(firstName('<script>')).toBe('script')
  })
  it('rejects widget placeholders and short numbers', () => {
    expect(usablePhone('web_abc123')).toBe(false)
    expect(usablePhone('12345')).toBe(false)
    expect(usablePhone('+91 98765 43210')).toBe(true)
    expect(usablePhone(null)).toBe(false)
  })
  it('computes recency bounds', () => {
    const now = new Date('2026-10-20T00:00:00.000Z')
    expect(recencyFrom({ preset: '7d' }, now)).toBe('2026-10-13T00:00:00.000Z')
    expect(recencyFrom(undefined, now)).toBeNull()
  })
  it('cleans untrusted audience input', () => {
    const a = cleanAudience({ type: 'csv', tagIds: ['a', 1, 'b'], lastSeenWithin: { preset: 'forever' } })
    expect(a.type).toBe('all')
    expect(a.tagIds).toEqual(['a', 'b'])
    expect(a.lastSeenWithin).toBeUndefined()
  })
})

import { selectFollowupIds, selectRetryIds } from './audience'

describe('follow-up selection', () => {
  const rows = [
    { contact_id: 'a', status: 'delivered' },
    { contact_id: 'b', status: 'read' },
    { contact_id: 'c', status: 'replied' },
    { contact_id: 'd', status: 'failed', error_message: 'Rate limit hit' },
    { contact_id: 'e', status: 'failed', error_message: 'Invalid phone number format' },
    { contact_id: 'f', status: 'failed', error_message: 'x' },
    { contact_id: 'f', status: 'sent' },
  ]
  it('not_read: only reached and unread', () => {
    expect(selectFollowupIds(rows, 'not_read').sort()).toEqual(['a', 'f'])
  })
  it('no_reply: reached, not replied', () => {
    expect(selectFollowupIds(rows, 'no_reply').sort()).toEqual(['a', 'b', 'f'])
  })
  it('rollover adds unreached people, never permanent failures', () => {
    expect(selectFollowupIds(rows, 'not_read', true).sort()).toEqual(['a', 'd', 'f'])
  })
  it('retry picks temporary failures not reached any other way', () => {
    expect(selectRetryIds(rows)).toEqual(['d'])
  })
  it('hand-picked audience keeps only ids', () => {
    const a = cleanAudience({ type: 'contacts', contactIds: ['x', 'x', 5, 'y'] })
    expect(a.type).toBe('contacts')
    expect(a.contactIds).toEqual(['x', 'y'])
  })
})
