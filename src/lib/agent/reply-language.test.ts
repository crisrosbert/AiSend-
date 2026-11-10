// src/lib/agent/reply-language.test.ts
import { describe, it, expect } from 'vitest'
import {
  detectLanguage,
  emergencyReply,
  languageInstruction,
  resolveLanguage,
  t,
  type ReplyLanguage,
  type TextKey,
} from './reply-language'

describe('detectLanguage', () => {
  it('English', () => {
    expect(detectLanguage('What are the clinic timings on Saturday?')).toEqual({ lang: 'en', confident: true })
  })
  it('Hindi in Devanagari', () => {
    expect(detectLanguage('मुझे अपॉइंटमेंट चाहिए').lang).toBe('hi')
  })
  it('Hinglish', () => {
    expect(detectLanguage('mujhe consultation ka price batao').lang).toBe('hinglish')
    expect(detectLanguage('kya aap kal available hain').lang).toBe('hinglish')
  })
  it('a single Hindi word in a very short message is Hinglish', () => {
    expect(detectLanguage('haan').lang).toBe('hinglish')
  })
  it('very short English is not a confident call', () => {
    expect(detectLanguage('ok thanks').confident).toBe(false)
    expect(detectLanguage('3pm').confident).toBe(false)
  })
  it('empty input is English, unconfident', () => {
    expect(detectLanguage('')).toEqual({ lang: 'en', confident: false })
  })
})

describe('resolveLanguage', () => {
  it('uses the current message when conclusive', () => {
    expect(resolveLanguage('price kya hai', ['hello how are you doing today'])).toBe('hinglish')
  })
  it('falls back to the recent conversation for a short reply', () => {
    expect(resolveLanguage('ok thanks', ['mujhe appointment chahiye', 'kal subah'])).toBe('hinglish')
  })
  it('defaults to English with no signal', () => {
    expect(resolveLanguage('ok')).toBe('en')
  })
})

describe('canned texts', () => {
  const keys: TextKey[] = [
    'handoff', 'not_sure_handoff', 'no_info', 'ai_error', 'ai_error_handoff', 'empty_input',
    'human_active', 'thanks_team_follow_up', 'unavailable', 'cannot_share', 'slot_offer',
    'emergency', 'emergency_with_contact',
  ]
  const langs: ReplyLanguage[] = ['en', 'hinglish', 'hi']

  it('every key exists in every language and is non-empty', () => {
    for (const k of keys) for (const l of langs) expect(t(k, l).length).toBeGreaterThan(10)
  })

  it('Hindi lines are in Devanagari, Hinglish lines are not', () => {
    for (const k of keys) {
      expect(/[ऀ-ॿ]/.test(t(k, 'hi'))).toBe(true)
      expect(/[ऀ-ॿ]/.test(t(k, 'hinglish'))).toBe(false)
    }
  })

  it('fills placeholders and leaves none behind', () => {
    expect(t('slot_offer', 'en', { label: 'Monday 3/8 at 10 AM' })).toContain('Monday 3/8 at 10 AM')
    for (const l of langs) expect(t('slot_offer', l, { label: 'X' })).not.toContain('{')
  })

  it('emergency text names 112 and the business contact when known', () => {
    expect(emergencyReply('en', null)).toContain('112')
    expect(emergencyReply('en', '+91 98765 43210')).toContain('+91 98765 43210')
    expect(emergencyReply('hinglish', '  ')).toContain('112')
  })

  it('the language instruction names the detected language', () => {
    expect(languageInstruction('hinglish')).toContain('Hinglish')
    expect(languageInstruction('hi')).toContain('Devanagari')
    expect(languageInstruction('en')).toContain('English')
  })
})
