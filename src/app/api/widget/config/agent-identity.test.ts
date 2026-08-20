// src/app/api/widget/config/agent-identity.test.ts
//
// One tenant, three businesses: a cosmetic surgery clinic, a fashion
// label, an estate agency. Each has its own agent and its own embed.
//
// ── THE SHAPE OF THE BUG THIS PREVENTS ───────────────────────────────
// Nothing in the app creates a widget_configs row per agent — /widget
// writes one org-wide row. So an agent-scoped embed falls back to that
// row, which describes whichever business was configured first. Every
// field a visitor reads before typing a word — the header name, the
// opening line, the logo — came from that row.
//
// The result was an estate agency's widget opening as the clinic. Not
// a subtle failure: it is the first thing on screen, and a visitor who
// sees the wrong business name has no reason to believe anything that
// follows.
//
// The rule these tests hold in place: a BORROWED row may style the
// widget, but it may never name it. Identity comes from the agent.

import { describe, it, expect } from 'vitest'
import { mergeAgentProfile, agentBubble } from './route'

/** The clinic, set up first — so its row is the one everyone borrows. */
const sharedClinicRow = {
  bot_name: 'Kalosa Assistant',
  welcome_message: "Hey! I'm Riya from Kalosa Aesthetics. How can I help you today?",
  primary_color: '#F5A623',
  avatar_url: 'https://kalosa.in/logo.png',
}

/** The estate agency, which never got a row of its own. */
const skyline = {
  name: 'Skyline Properties',
  avatar_url: 'https://skyline.example/logo.png',
  greeting: "Hi! I'm Aarav from Skyline Properties. Looking for a new home?",
  suggested_questions: ['What areas do you cover?', 'Do you have 3BHK?', 'Can I book a viewing?'],
}

describe('a borrowed config row never names the agent', () => {
  const out = mergeAgentProfile(sharedClinicRow, skyline, { shared: true })

  it('shows the agent’s name in the header, not the clinic’s', () => {
    expect(out.bot_name).toBe('Skyline Properties')
    expect(out.bot_name).not.toBe('Kalosa Assistant')
  })

  it('opens with the agent’s own greeting', () => {
    // The precise failure from the screenshots: an estate agency
    // introducing itself as Riya from a cosmetic surgery clinic.
    expect(out.welcome_message).toContain('Skyline')
    expect(out.welcome_message).not.toContain('Kalosa')
    expect(out.welcome_message).not.toContain('Riya')
  })

  it('shows the agent’s own logo', () => {
    expect(out.avatar_url).toBe('https://skyline.example/logo.png')
  })

  it('shows the agent’s own suggested questions', () => {
    expect(out.suggested_questions).toEqual(skyline.suggested_questions)
  })

  it('still inherits pure styling from the borrowed row', () => {
    // Colour says nothing about WHICH business this is, so borrowing it
    // is merely a default worth having rather than a lie. Identity and
    // styling are deliberately treated differently.
    expect(out.primary_color).toBe('#F5A623')
  })

  it('leaves the borrowed row itself untouched', () => {
    // Same object is reused across requests in a warm lambda; mutating
    // it would leak the previous visitor's agent into the next one.
    expect(sharedClinicRow.bot_name).toBe('Kalosa Assistant')
  })
})

describe("an agent's OWN config row keeps what the merchant typed", () => {
  // Kalosa's own row, hand-written. Here the merchant configured this
  // exact agent on purpose, so their wording outranks a drafted one.
  const ownRow = {
    bot_name: 'Kalosa Assistant',
    welcome_message: "Hey! I'm Riya from Kalosa Aesthetics. How can I help you today?",
  }
  const kalosaAgent = {
    name: 'Kalosa Aesthetics & Cosmetic Gynaecology',
    avatar_url: 'https://kalosa.in/logo.png',
    greeting: 'Hello! How can I help you with Kalosa today?',
    suggested_questions: ['What treatments?', 'How to book?', 'Where are you?'],
  }

  const out = mergeAgentProfile(ownRow, kalosaAgent, { shared: false })

  it('keeps the hand-written header', () => {
    // "Kalosa Assistant" is friendlier than the legal-sounding full
    // name the crawl found. The merchant chose it; we keep it.
    expect(out.bot_name).toBe('Kalosa Assistant')
  })

  it('keeps the hand-written greeting', () => {
    expect(out.welcome_message).toBe(ownRow.welcome_message)
  })

  it('still takes the logo and questions, which the row has no version of', () => {
    expect(out.avatar_url).toBe('https://kalosa.in/logo.png')
    expect(out.suggested_questions).toHaveLength(3)
  })
})

describe('filling blanks', () => {
  it('uses the agent’s name and greeting when its own row left them empty', () => {
    const out = mergeAgentProfile(
      { bot_name: '   ', welcome_message: '' },
      skyline,
      { shared: false },
    )
    expect(out.bot_name).toBe('Skyline Properties')
    expect(out.welcome_message).toBe(skyline.greeting)
  })

  it('changes nothing on its OWN row for an agent with no profile yet', () => {
    // Every agent looks like this until a site is crawled. A blank
    // profile must not blank out a widget the merchant configured.
    //
    // Only true for the agent's own row. On a borrowed one the wording
    // being preserved would belong to another business — see the
    // half-configured case below.
    const view = { bot_name: 'Assistant', welcome_message: 'Hi' }
    const bare = { name: null, avatar_url: null, greeting: null, suggested_questions: null }
    expect(mergeAgentProfile(view, bare, { shared: false })).toEqual(view)
  })

  it('changes nothing when there is no agent at all', () => {
    const view = { bot_name: 'Assistant' }
    expect(mergeAgentProfile(view, null, { shared: true })).toEqual(view)
  })
})

// ── The pop-up teaser ────────────────────────────────────────────────
//
// The line shown before the chat is opened lives on widget_configs,
// which holds ONE row's worth of wording for the whole tenant. So a
// clinic, a fashion label and an estate agency all greeted their
// visitors with "Questions about gynecomastia treatment? Ask me
// anything." — whichever business was set up first wrote the line every
// other business then showed to its own customers.
//
// It is built from the agent now, and unlike the name and greeting it
// overrides the stored value outright. Nothing in the app can author a
// teaser per agent, so a stored line is not evidence anyone chose it
// for THIS agent.

describe('agentBubble', () => {
  it('describes what this agent actually does', () => {
    const bubble = agentBubble({
      name: 'Sobha Projects',
      role: 'Real estate consultant for luxury properties',
      avatar_url: null, greeting: null, suggested_questions: null,
    })
    expect(bubble).toBe('Hi! 👋 Real estate consultant for luxury properties — ask me anything.')
  })

  it('never shows one business the teaser written for another', () => {
    // The reported symptom, stated as an assertion.
    const skyline = agentBubble({
      name: 'Skyline Properties', role: 'Real estate consultant',
      avatar_url: null, greeting: null, suggested_questions: null,
    })
    expect(skyline).not.toContain('gynecomastia')
  })

  it('falls back to the name when there is no role', () => {
    // Every agent has a name; role only arrives once a site is crawled.
    expect(
      agentBubble({
        name: 'Kalosa Aesthetics', role: null,
        avatar_url: null, greeting: null, suggested_questions: null,
      }),
    ).toBe('Hi! 👋 Questions about Kalosa Aesthetics? Ask me anything.')
  })

  it('falls back to the name when the role is too long for the bubble', () => {
    // The bubble is 260px wide. A role that wraps to five lines is
    // worse than a generic line, so length is a real constraint here
    // rather than a stylistic preference.
    const wordy =
      'Real estate consultant specialising in luxury residential and ' +
      'commercial projects across India since 1976'
    const bubble = agentBubble({
      name: 'SOBHA Limited', role: wordy,
      avatar_url: null, greeting: null, suggested_questions: null,
    })
    expect(bubble).toBe('Hi! 👋 Questions about SOBHA Limited? Ask me anything.')
  })

  it('treats a whitespace-only role as absent', () => {
    expect(
      agentBubble({
        name: 'Asort', role: '   ',
        avatar_url: null, greeting: null, suggested_questions: null,
      }),
    ).toBe('Hi! 👋 Questions about Asort? Ask me anything.')
  })

  it('returns null when the agent has neither', () => {
    // Nothing to say is better than "Questions about null?".
    expect(
      agentBubble({
        name: null, role: null,
        avatar_url: null, greeting: null, suggested_questions: null,
      }),
    ).toBeNull()
  })

  it('replaces a stored teaser even on the agent’s own row', () => {
    const out = mergeAgentProfile(
      { bubble_message: 'Hi! 👋 Questions about gynecomastia treatment? Ask me anything.' },
      {
        name: 'Sobha Projects', role: 'Real estate consultant',
        avatar_url: null, greeting: null, suggested_questions: null,
      },
      { shared: false },
    )
    expect(out.bubble_message).toBe('Hi! 👋 Real estate consultant — ask me anything.')
  })
})

// ── An agent that has been trained but not yet approved ──────────────
//
// The gap the first version of the shared-row rule left open. Training
// drafts a name, greeting and questions into the review panel, but
// nothing is saved until Use and Save agent are pressed. In between,
// the agent row has a name and NOTHING else.
//
// The rule only replaced fields the agent could supply, so the greeting
// fell through to the borrowed row — and a sports-venue booking site
// opened with "Hey! I'm Riya from Kalosa Aesthetics." The header was
// right, which made it worse: it looked configured.

describe('a half-configured agent on a borrowed row', () => {
  const hudle = {
    name: 'hudle',
    greeting: null,          // drafted, not yet approved
    avatar_url: null,        // the crawl only found a favicon
    suggested_questions: null,
    role: null,
  }

  const out = mergeAgentProfile(sharedClinicRow, hudle, { shared: true })

  it('never greets one business’s visitors as another business', () => {
    expect(out.welcome_message).not.toContain('Kalosa')
    expect(out.welcome_message).not.toContain('Riya')
  })

  it('falls back to a neutral greeting built from the agent’s name', () => {
    // Blank would be safe but wasteful — the opening line is the one
    // message every visitor definitely reads.
    expect(out.welcome_message).toBe('Hi! How can I help you with hudle today?')
  })

  it('does not show another company’s logo', () => {
    // The borrowed row has one; wearing it is using their trademark.
    // Empty makes widget.js draw its own neutral chat icon.
    expect(out.avatar_url).toBeNull()
  })

  it('offers no suggested questions rather than another site’s', () => {
    // Chips answerable only out of the clinic's pages, on a sports site.
    expect(out.suggested_questions).toBeUndefined()
  })

  it('still shows the agent’s own name', () => {
    expect(out.bot_name).toBe('hudle')
  })

  it('keeps inheriting pure styling', () => {
    expect(out.primary_color).toBe('#F5A623')
  })
})

describe('a borrowed row with an agent that has no name either', () => {
  it('says something neutral rather than nothing', () => {
    const out = mergeAgentProfile(sharedClinicRow, {
      name: null, greeting: null, avatar_url: null,
      suggested_questions: null, role: null,
    }, { shared: true })

    expect(out.bot_name).toBe('Assistant')
    expect(out.welcome_message).toBe('Hi! How can I help you today?')
    expect(out.welcome_message).not.toContain('Kalosa')
  })
})
