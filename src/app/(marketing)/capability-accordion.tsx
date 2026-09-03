'use client'

import { useState } from 'react'
import { ImageSlot } from './image-slot'

/**
 * "What you can send": a list of capabilities on the left, with the
 * picture for the open one alongside.
 *
 * On a narrow screen the side-by-side layout has nowhere to go, so the
 * picture moves inside the open item instead — same content, rendered in
 * the place that still has room for it (the CSS decides which one shows).
 */

const ITEMS = [
  {
    id: 'templates',
    title: 'Rich message templates',
    body: 'Quick-reply buttons, call buttons and link buttons, so the next step is one tap instead of a typed reply.',
    alt: 'A message with quick reply buttons',
  },
  {
    id: 'forms',
    title: 'In-chat forms',
    body: 'Collect a booking, an address or a claim through a proper form inside the chat — nothing to download, no separate website.',
    alt: 'A form filled in inside the chat',
  },
  {
    id: 'catalogue',
    title: 'Product catalogue',
    body: 'Show what you sell with images, prices and stock, and let people add to a cart without leaving the conversation.',
    alt: 'A product catalogue inside the chat',
  },
  {
    id: 'payments',
    title: 'Payments in the thread',
    body: 'Send an invoice and take the money in the same chat, through the payment provider you already use.',
    alt: 'An invoice and payment confirmation in chat',
  },
  {
    id: 'ads',
    title: 'Click-to-chat ads',
    body: 'Ads that open a conversation instead of a landing page, so a lead form is replaced by an actual reply you can answer.',
    alt: 'An ad that opens a chat conversation',
  },
  {
    id: 'handover',
    title: 'Assistant, then a person',
    body: 'The assistant covers the night shift and the repeat questions, and hands anything unusual to a teammate with the history attached.',
    alt: 'An assistant handing a chat to a teammate',
  },
] as const

export function CapabilityAccordion() {
  const [open, setOpen] = useState(0)

  return (
    <div className="acc__grid">
      <div className="acc">
        {ITEMS.map((item, i) => (
          <div className="acc__item" key={item.id}>
            <h3>
              <button
                className="acc__btn"
                aria-expanded={open === i}
                aria-controls={`acc-body-${item.id}`}
                onClick={() => setOpen(i)}
              >
                {item.title}
              </button>
            </h3>
            <div className="acc__body" id={`acc-body-${item.id}`} hidden={open !== i}>
              {item.body}
              {/* only rendered on narrow screens, where the side panel is hidden */}
              <div className="acc__inline">
                <ImageSlot
                  label="Capability image"
                  dimensions="1200 × 860 · PNG, JPG or WebP"
                  alt={item.alt}
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="acc__stage">
        <div className="acc__stage-in">
          {ITEMS.map((item, i) => (
            <div key={item.id} className={`acc__pane${open === i ? ' is-on' : ''}`}>
              <ImageSlot
                label="Capability image"
                dimensions="1200 × 860 · PNG, JPG or WebP"
                alt={item.alt}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
