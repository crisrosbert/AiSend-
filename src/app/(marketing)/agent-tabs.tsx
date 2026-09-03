'use client'

import { useState } from 'react'
import { ImageSlot } from './image-slot'

/**
 * The "AI agents" section: three tabs, each with its own bullet list and
 * picture. Arrow keys move between tabs as well as clicks, which is what
 * the tablist role promises a screen reader.
 */

const TABS = [
  {
    id: 'lead',
    tab: 'Capturing leads',
    heading: 'Turns a first message into a qualified lead',
    points: [
      'Asks the two or three things you actually need before a call',
      'Works out what someone wants before pushing a product at them',
      'Drops each person into the right follow-up sequence automatically',
      "Books the demo straight into your calendar, in the chat",
    ],
    alt: 'A lead qualification conversation',
  },
  {
    id: 'shop',
    tab: 'Helping people buy',
    heading: 'Helps people choose without a phone call',
    points: [
      'Recommends from your real catalogue, with live stock and price',
      'Compares two products side by side when someone is torn',
      'Answers sizing, material and delivery questions instantly',
      "Sends a payment link the moment they've decided",
    ],
    alt: 'Product recommendations inside a chat',
  },
  {
    id: 'order',
    tab: 'After the order',
    heading: 'Handles the questions that come after payment',
    points: [
      '“Where is my order?” answered from live tracking, not a guess',
      'Cancellations, exchanges and returns without a support ticket',
      'Confirms the address and delivery window, so fewer parcels come back',
      'Asks for the review a few days after it arrives',
    ],
    alt: 'Order tracking updates in a chat',
  },
] as const

function Tick() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  )
}

export function AgentTabs() {
  const [active, setActive] = useState(0)

  function onKeyDown(e: React.KeyboardEvent, index: number) {
    const step = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0
    if (!step) return
    e.preventDefault()
    const next = (index + step + TABS.length) % TABS.length
    setActive(next)
    document.getElementById(`tab-${TABS[next].id}`)?.focus()
  }

  return (
    <>
      <div className="tabs__nav" role="tablist" aria-label="AI agent use cases">
        {TABS.map((t, i) => (
          <button
            key={t.id}
            className="tabs__btn"
            role="tab"
            id={`tab-${t.id}`}
            aria-controls={`panel-${t.id}`}
            aria-selected={active === i}
            tabIndex={active === i ? 0 : -1}
            onClick={() => setActive(i)}
            onKeyDown={(e) => onKeyDown(e, i)}
          >
            {t.tab}
          </button>
        ))}
      </div>

      {TABS.map((t, i) => (
        <div
          key={t.id}
          className="tabs__panel"
          role="tabpanel"
          id={`panel-${t.id}`}
          aria-labelledby={`tab-${t.id}`}
          hidden={active !== i}
        >
          <div>
            <h3 style={{ fontSize: 22, fontFamily: 'var(--display)' }}>{t.heading}</h3>
            <ul className="tabs__list">
              {t.points.map((p) => (
                <li key={p}>
                  <Tick />
                  {p}
                </li>
              ))}
            </ul>
            <a className="btn btn--ghost" href="#">
              See it in action
            </a>
          </div>
          <div>
            <ImageSlot label="Tab image" dimensions="1000 × 760 · PNG, JPG or WebP" alt={t.alt} />
          </div>
        </div>
      ))}
    </>
  )
}
