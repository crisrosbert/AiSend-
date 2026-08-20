// src/lib/widget/identity-sync.test.ts
//
// An agent's identity lives on `agents`; the widget reads
// `widget_configs`. The Agents drawer only ever wrote the first, so
// renaming an agent and retraining it on a different website left the
// widget introducing itself as the old business — a real-estate agent
// retrained from skyline onto sobha.com kept saying "I'm Aarav from
// Skyline Properties" to every visitor.
//
// Saving now copies identity across. The whole difficulty is deciding
// WHICH fields may be overwritten, because the same columns also hold
// wording typed by hand on the /widget page: "Kalosa Assistant" reads
// better than the legal name the crawl found, and a sync that flattened
// it would trade one bug report for another.
//
// The rule: overwrite only a field that was blank, or that still holds
// the agent's PREVIOUS value — it was mirroring the agent, so it should
// go on mirroring it. Anything else was a deliberate choice.

import { describe, it, expect } from 'vitest'

/** Mirrors wasFollowing() in the agents page. */
function wasFollowing(current: unknown, before: string | null | undefined): boolean {
  const now = typeof current === 'string' ? current.trim() : ''
  return !now || now === (before ?? '').trim()
}

describe('wasFollowing', () => {
  it('updates a widget name that still shows the old agent name', () => {
    // The reported case: agent renamed Skyline Properties -> Sobha
    // Projects, while the widget row still said Skyline.
    expect(wasFollowing('Skyline Properties', 'Skyline Properties')).toBe(true)
  })

  it('leaves a hand-written name alone', () => {
    // "Kalosa Assistant" was never the agent's name — someone chose it.
    expect(wasFollowing('Kalosa Assistant', 'Kalosa Aesthetics')).toBe(false)
  })

  it('fills a blank field', () => {
    expect(wasFollowing('', 'anything')).toBe(true)
    expect(wasFollowing('   ', 'anything')).toBe(true)
    expect(wasFollowing(null, 'anything')).toBe(true)
    expect(wasFollowing(undefined, 'anything')).toBe(true)
  })

  it('ignores whitespace when comparing', () => {
    // The drawer trims on save; older rows may not be trimmed. Without
    // this, a trailing space would make a mirroring field look
    // deliberate and freeze the widget on the old name forever.
    expect(wasFollowing('  Skyline Properties  ', 'Skyline Properties')).toBe(true)
  })

  it('treats a field set while the agent had no value as deliberate', () => {
    // The agent's greeting was null and the widget still has wording:
    // someone must have typed it, so it stands.
    expect(wasFollowing("Hey! I'm Riya from Kalosa Aesthetics.", null)).toBe(false)
  })

  it('is case-sensitive', () => {
    // Deliberately strict. "SOBHA LIMITED" vs "Sobha Limited" is a
    // styling choice someone made; guessing otherwise would undo it.
    expect(wasFollowing('SOBHA LIMITED', 'Sobha Limited')).toBe(false)
  })
})

describe('the sync as a whole', () => {
  /** Mirrors syncWidgetIdentity()'s patch construction. */
  function buildPatch(
    cfg: { bot_name?: unknown; welcome_message?: unknown; avatar_url?: unknown },
    previous: { name?: string | null; greeting?: string | null; avatar_url?: string | null },
    next: { name?: string; greeting?: string | null; avatar_url?: string | null },
  ): Record<string, unknown> {
    const patch: Record<string, unknown> = {}
    const name = next.name?.trim()
    if (name && wasFollowing(cfg.bot_name, previous.name)) patch.bot_name = name
    const greeting = next.greeting?.trim()
    if (greeting && wasFollowing(cfg.welcome_message, previous.greeting)) {
      patch.welcome_message = greeting
    }
    const avatar = next.avatar_url?.trim()
    if (avatar && wasFollowing(cfg.avatar_url, previous.avatar_url)) {
      patch.avatar_url = avatar
    }
    return patch
  }

  it('renames the widget when the agent is retrained onto a new business', () => {
    const patch = buildPatch(
      {
        bot_name: 'Skyline Properties',
        welcome_message: "Hi! I'm Aarav from Skyline Properties. Looking for a new home?",
        avatar_url: 'https://skyline.example/logo.png',
      },
      {
        name: 'Skyline Properties',
        greeting: "Hi! I'm Aarav from Skyline Properties. Looking for a new home?",
        avatar_url: 'https://skyline.example/logo.png',
      },
      {
        name: 'Sobha Projects',
        greeting: 'Hello! Welcome to SOBHA Limited. How can I help you today?',
        avatar_url: 'https://www.sobha.com/logo.png',
      },
    )

    expect(patch.bot_name).toBe('Sobha Projects')
    expect(patch.welcome_message).toContain('SOBHA')
    expect(patch.avatar_url).toBe('https://www.sobha.com/logo.png')
  })

  it('does not touch a widget the merchant styled by hand', () => {
    // Kalosa, which the merchant said was working perfectly. Saving its
    // agent for an unrelated reason must not restyle its widget.
    const patch = buildPatch(
      {
        bot_name: 'Kalosa Assistant',
        welcome_message: "Hey! I'm Riya from Kalosa Aesthetics. How can I help you today?",
      },
      { name: 'Kalosa Aesthetics', greeting: null },
      { name: 'Kalosa Aesthetics', greeting: 'Hello! How can I help you with Kalosa today?' },
    )

    expect(patch).toEqual({})
  })

  it('writes nothing when the agent has nothing to offer', () => {
    // An untrained agent has no greeting or avatar. Syncing empties over
    // a working widget would blank the greeting on a live site.
    const patch = buildPatch(
      { bot_name: 'Kalosa Assistant', welcome_message: 'Hi there' },
      { name: 'Kalosa', greeting: 'Hi there' },
      { name: '   ', greeting: null, avatar_url: null },
    )

    expect(patch).toEqual({})
  })
})
