// src/lib/monitoring/checks.test.ts
//
// Each of these mirrors a bug that actually shipped. If a check stops
// catching its own bug, the test fails.

import { describe, it, expect } from 'vitest'
import {
  findUnanswered,
  findDuplicateReplies,
  findOutOfHoursBookings,
  checkWhatsAppAgentAssigned,
  checkStalledBroadcasts,
  checkFailedMessages,
  checkAgentErrors,
  rankFindings,
  type MessageStub,
} from './checks'
import { DEFAULT_BUSINESS_HOURS, instantFromLocal } from '@/lib/agent/business-hours'

const NOW = new Date('2026-08-13T12:00:00.000Z')
const ago = (min: number) => new Date(NOW.getTime() - min * 60_000).toISOString()

describe('findUnanswered — the silent-agent bug', () => {
  it('flags a customer left waiting past the grace period', () => {
    const messages: MessageStub[] = [
      { conversationId: 'c1', senderType: 'customer', createdAt: ago(30) },
    ]
    const found = findUnanswered(messages, NOW, 5)
    expect(found).toHaveLength(1)
    expect(found[0].code).toBe('unanswered_conversation')
    expect(found[0].severity).toBe('critical')
  })

  it('does not flag one that was answered', () => {
    const messages: MessageStub[] = [
      { conversationId: 'c1', senderType: 'customer', createdAt: ago(30) },
      { conversationId: 'c1', senderType: 'bot', createdAt: ago(29) },
    ]
    expect(findUnanswered(messages, NOW, 5)).toHaveLength(0)
  })

  it('does not flag a message that just arrived', () => {
    const messages: MessageStub[] = [
      { conversationId: 'c1', senderType: 'customer', createdAt: ago(1) },
    ]
    expect(findUnanswered(messages, NOW, 5)).toHaveLength(0)
  })

  it('counts a human reply as answered', () => {
    const messages: MessageStub[] = [
      { conversationId: 'c1', senderType: 'customer', createdAt: ago(40) },
      { conversationId: 'c1', senderType: 'agent', createdAt: ago(35) },
    ]
    expect(findUnanswered(messages, NOW, 5)).toHaveLength(0)
  })

  it('flags a customer who wrote again after being answered', () => {
    // The follow-up is now the last word, and nothing came after it.
    const messages: MessageStub[] = [
      { conversationId: 'c1', senderType: 'customer', createdAt: ago(40) },
      { conversationId: 'c1', senderType: 'bot', createdAt: ago(39) },
      { conversationId: 'c1', senderType: 'customer', createdAt: ago(20) },
    ]
    expect(findUnanswered(messages, NOW, 5)).toHaveLength(1)
  })

  it('counts each stranded conversation once', () => {
    const messages: MessageStub[] = [
      { conversationId: 'c1', senderType: 'customer', createdAt: ago(30) },
      { conversationId: 'c1', senderType: 'customer', createdAt: ago(25) },
      { conversationId: 'c2', senderType: 'customer', createdAt: ago(30) },
    ]
    expect(findUnanswered(messages, NOW, 5)[0].count).toBe(2)
  })

  it('is not confused by rows arriving out of order', () => {
    const messages: MessageStub[] = [
      { conversationId: 'c1', senderType: 'bot', createdAt: ago(29) },
      { conversationId: 'c1', senderType: 'customer', createdAt: ago(30) },
    ]
    expect(findUnanswered(messages, NOW, 5)).toHaveLength(0)
  })
})

describe('findDuplicateReplies — the webhook-retry bug', () => {
  it('flags the same reply sent twice within seconds', () => {
    const found = findDuplicateReplies(
      [
        { conversationId: 'c1', senderType: 'bot', createdAt: '2026-08-13T10:00:00Z', text: 'Sure! What is your name?' },
        { conversationId: 'c1', senderType: 'bot', createdAt: '2026-08-13T10:00:03Z', text: 'Sure! What is your name?' },
      ],
      10,
    )
    expect(found).toHaveLength(1)
    expect(found[0].severity).toBe('critical')
  })

  it('allows two different replies in quick succession', () => {
    // A text plus its follow-up is normal behaviour, not a duplicate.
    const found = findDuplicateReplies(
      [
        { conversationId: 'c1', senderType: 'bot', createdAt: '2026-08-13T10:00:00Z', text: 'Here are the photos' },
        { conversationId: 'c1', senderType: 'bot', createdAt: '2026-08-13T10:00:02Z', text: '2BHK living room' },
      ],
      10,
    )
    expect(found).toHaveLength(0)
  })

  it('allows the same reply much later in the conversation', () => {
    const found = findDuplicateReplies(
      [
        { conversationId: 'c1', senderType: 'bot', createdAt: '2026-08-13T10:00:00Z', text: 'How can I help?' },
        { conversationId: 'c1', senderType: 'bot', createdAt: '2026-08-13T14:00:00Z', text: 'How can I help?' },
      ],
      10,
    )
    expect(found).toHaveLength(0)
  })

  it('ignores the customer repeating themselves', () => {
    const found = findDuplicateReplies(
      [
        { conversationId: 'c1', senderType: 'customer', createdAt: '2026-08-13T10:00:00Z', text: 'hello' },
        { conversationId: 'c1', senderType: 'customer', createdAt: '2026-08-13T10:00:01Z', text: 'hello' },
      ],
      10,
    )
    expect(found).toHaveLength(0)
  })

  it('does not treat two empty messages as duplicates', () => {
    const found = findDuplicateReplies(
      [
        { conversationId: 'c1', senderType: 'bot', createdAt: '2026-08-13T10:00:00Z', text: '' },
        { conversationId: 'c1', senderType: 'bot', createdAt: '2026-08-13T10:00:01Z', text: null },
      ],
      10,
    )
    expect(found).toHaveLength(0)
  })
})

describe('findOutOfHoursBookings — the midnight-consultation bug', () => {
  const ist = (d: number, h: number, m = 0) =>
    instantFromLocal(2026, 8, d, h, m, 'Asia/Kolkata').toISOString()

  it('flags a midnight appointment', () => {
    const found = findOutOfHoursBookings(
      [{ id: 'a1', appointmentAt: ist(11, 0, 0), customerName: 'Test' }],
      DEFAULT_BUSINESS_HOURS,
    )
    expect(found).toHaveLength(1)
    expect(found[0].code).toBe('out_of_hours_booking')
  })

  it('accepts one inside opening hours', () => {
    const found = findOutOfHoursBookings(
      [{ id: 'a1', appointmentAt: ist(11, 14, 30), customerName: 'Test' }],
      DEFAULT_BUSINESS_HOURS,
    )
    expect(found).toHaveLength(0)
  })

  it('flags a Sunday booking', () => {
    const found = findOutOfHoursBookings(
      [{ id: 'a1', appointmentAt: ist(9, 12, 0), customerName: 'Test' }],
      DEFAULT_BUSINESS_HOURS,
    )
    expect(found).toHaveLength(1)
  })

  it('ignores an unparseable date rather than crashing the run', () => {
    const found = findOutOfHoursBookings(
      [{ id: 'a1', appointmentAt: 'not a date', customerName: null }],
      DEFAULT_BUSINESS_HOURS,
    )
    expect(found).toHaveLength(0)
  })
})

describe('threshold checks', () => {
  it('flags WhatsApp connected with no agent — the Kalosa silence', () => {
    expect(checkWhatsAppAgentAssigned(true, null)).toHaveLength(1)
    expect(checkWhatsAppAgentAssigned(true, 'agent-1')).toHaveLength(0)
    expect(checkWhatsAppAgentAssigned(false, null)).toHaveLength(0)
  })

  it('flags a stalled campaign and names the largest', () => {
    const found = checkStalledBroadcasts([
      { id: 'b1', name: 'Diwali offer', pending: 40 },
      { id: 'b2', name: 'Reminder', pending: 900 },
    ])
    expect(found).toHaveLength(1)
    expect(found[0].count).toBe(940)
    expect(found[0].subjectId).toBe('b2')
    expect(found[0].detail).toContain('Reminder')
  })

  it('ignores campaigns with nothing outstanding', () => {
    expect(checkStalledBroadcasts([{ id: 'b1', name: 'Done', pending: 0 }])).toHaveLength(0)
  })

  it('escalates failed messages once they spike', () => {
    expect(checkFailedMessages(3, 10)).toHaveLength(0)
    expect(checkFailedMessages(12, 10)[0].severity).toBe('warning')
    expect(checkFailedMessages(60, 10)[0].severity).toBe('critical')
  })

  it('groups agent errors so one fault is not a hundred alerts', () => {
    const found = checkAgentErrors([
      { error: 'GEMINI_API_KEY not set' },
      { error: 'GEMINI_API_KEY not set' },
      { error: 'GEMINI_API_KEY not set' },
      { error: 'timeout' },
      { error: null },
    ])
    expect(found).toHaveLength(1)
    expect(found[0].count).toBe(4)
    expect(found[0].detail).toContain('GEMINI_API_KEY not set')
    expect(found[0].detail).toContain('3×')
  })

  it('says nothing when nothing is wrong', () => {
    expect(checkAgentErrors([{ error: null }])).toHaveLength(0)
  })
})

describe('rankFindings', () => {
  it('puts critical first, then the biggest', () => {
    const ranked = rankFindings([
      { code: 'a', severity: 'warning', title: '', detail: '', count: 100 },
      { code: 'b', severity: 'critical', title: '', detail: '', count: 1 },
      { code: 'c', severity: 'critical', title: '', detail: '', count: 9 },
      { code: 'd', severity: 'info', title: '', detail: '', count: 50 },
    ])
    expect(ranked.map((f) => f.code)).toEqual(['c', 'b', 'a', 'd'])
  })
})
