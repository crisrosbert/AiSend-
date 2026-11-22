import { describe, it, expect } from 'vitest'
import { parseEcho, pickPhoneNumberId, isCoexistenceField, COEXISTENCE_FEATURE_TYPE } from './coexistence'

describe('coexistence helpers', () => {
  it('uses the Meta feature type for Business app onboarding', () => {
    expect(COEXISTENCE_FEATURE_TYPE).toBe('whatsapp_business_app_onboarding')
  })

  it('recognises coexistence webhook fields only', () => {
    expect(isCoexistenceField('smb_message_echoes')).toBe(true)
    expect(isCoexistenceField('history')).toBe(true)
    expect(isCoexistenceField('messages')).toBe(false)
    expect(isCoexistenceField(undefined)).toBe(false)
  })

  it('parses a text echo', () => {
    const e = parseEcho({ id: 'wamid.1', from: '918619751479', to: '+91 98765-43210', timestamp: '1700000000', type: 'text', text: { body: 'Hello' } })
    expect(e).toEqual({ id: 'wamid.1', to: '919876543210', contentType: 'text', contentText: 'Hello', createdAt: new Date(1700000000 * 1000).toISOString() })
  })

  it('labels media echoes and keeps captions', () => {
    expect(parseEcho({ id: 'a', to: '91', type: 'image', image: {} })?.contentText).toBe('[Image sent from phone]')
    expect(parseEcho({ id: 'a', to: '91', type: 'image', image: { caption: 'Offer' } })?.contentText).toBe('Offer')
    expect(parseEcho({ id: 'a', to: '91', type: 'image', image: {} })?.contentType).toBe('image')
  })

  it('rejects unusable echoes without throwing', () => {
    expect(parseEcho(null)).toBeNull()
    expect(parseEcho('x')).toBeNull()
    expect(parseEcho({ to: '91', type: 'text', text: { body: 'x' } })).toBeNull()
    expect(parseEcho({ id: 'a', type: 'text', text: { body: 'x' } })).toBeNull()
    expect(parseEcho({ id: 'a', to: '91', type: 'text', text: {} })).toBeNull()
  })

  it('picks the phone number id', () => {
    expect(pickPhoneNumberId([{ id: '1' }, { id: '2' }], '2')).toBe('2')
    expect(pickPhoneNumberId([{ id: '1' }])).toBe('1')
    expect(pickPhoneNumberId([{ id: '1' }, { id: '2' }])).toBeNull()
    expect(pickPhoneNumberId([], null)).toBeNull()
    expect(pickPhoneNumberId(undefined)).toBeNull()
  })
})
