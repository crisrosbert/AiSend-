'use client'

// src/components/tools/promo-banner.tsx
//
// The "ad block" for every /tools/* page — a dedicated, always-present
// slot promoting AiSend itself. Content below is TEMPORARY placeholder
// copy: swap the props (or these defaults) for real campaign creative
// once it's ready — the slot and its styling don't need to change.

import Link from 'next/link'

interface PromoBannerProps {
  headline?: string
  sub?: string
  ctaLabel?: string
  ctaHref?: string
}

export function PromoBanner({
  headline = 'You just did this once. AiSend does it for every customer, automatically.',
  sub = 'Broadcasts, auto-replies, and an AI agent that answers on WhatsApp while you\'re offline — free to start, no card required.',
  ctaLabel = 'Try AiSend free',
  ctaHref = '/signup',
}: PromoBannerProps) {
  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 20,
        background: 'linear-gradient(135deg, #075E54, #1DA851)',
        borderRadius: 18,
        padding: '26px 30px',
        margin: '40px 0',
        color: '#fff',
        boxShadow: '0 14px 30px -16px rgba(7,94,84,.45)',
      }}
    >
      <div style={{ maxWidth: 560 }}>
        <span
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            fontSize: 11, fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase',
            color: '#0b231a', background: 'rgba(255,255,255,.92)', padding: '3px 10px', borderRadius: 99,
            marginBottom: 10,
          }}
        >
          AiSend
        </span>
        <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 19, fontWeight: 800, margin: '0 0 6px', lineHeight: 1.3, color: '#fff' }}>
          {headline}
        </h3>
        <p style={{ fontSize: 13.5, lineHeight: 1.55, color: 'rgba(255,255,255,.85)', margin: 0 }}>
          {sub}
        </p>
      </div>
      <Link
        href={ctaHref}
        style={{
          flexShrink: 0, background: '#fff', color: '#075E54', textDecoration: 'none',
          fontWeight: 800, fontSize: 14.5, padding: '12px 22px', borderRadius: 11, whiteSpace: 'nowrap',
        }}
      >
        {ctaLabel} →
      </Link>
    </div>
  )
}
