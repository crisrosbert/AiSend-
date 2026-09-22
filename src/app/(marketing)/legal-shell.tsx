'use client'

import { ReactNode } from 'react'
import { SiteHeader } from '@/components/layout/site-header'
import { SiteFooter } from '@/components/layout/site-footer'

/**
 * Shared chrome (header + footer) for the public legal/contact pages so
 * they match the landing page without duplicating nav markup. Light,
 * on-brand, responsive.
 */

const BRAND = '#1aa260'
const INK = '#0b231a'

export default function LegalShell({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle?: string
  children: ReactNode
}) {
  return (
    <div style={{ fontFamily: 'var(--font-sans)', color: INK, background: '#fff', minHeight: '100vh' }}>
      <style>{`
        .ls-wrap { max-width: 820px; margin: 0 auto; padding: 0 20px; }
        .ls-prose h2 { font-family: var(--font-display); font-size: 20px; font-weight: 700; margin: 32px 0 10px; letter-spacing:-.02em; }
        .ls-prose h3 { font-size: 16px; font-weight: 700; margin: 22px 0 8px; }
        .ls-prose p, .ls-prose li { font-size: 15px; line-height: 1.7; color: #3f5249; }
        .ls-prose ul { padding-left: 20px; margin: 8px 0; }
        .ls-prose li { margin: 6px 0; }
        .ls-prose a { color: ${BRAND}; }
        .ls-prose strong { color: ${INK}; }
      `}</style>

      <SiteHeader />

      {/* title band */}
      <div style={{ background: 'linear-gradient(180deg,#effaf4,#fff)', borderBottom: '1px solid #eef2f0', padding: '48px 0' }}>
        <div className="ls-wrap">
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 36, fontWeight: 800, margin: 0, letterSpacing: '-.025em' }}>{title}</h1>
          {subtitle && <p style={{ fontSize: 15, color: '#6b7c73', margin: '10px 0 0' }}>{subtitle}</p>}
        </div>
      </div>

      {/* body */}
      <main className="ls-wrap ls-prose" style={{ padding: '40px 20px 70px' }}>
        {children}
      </main>

      <SiteFooter />
    </div>
  )
}
