'use client'

import Link from 'next/link'
import { ReactNode } from 'react'

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

      {/* header */}
      <header style={{ borderBottom: '1px solid #eef2f0', background: 'rgba(255,255,255,.9)', backdropFilter: 'blur(10px)', position: 'sticky', top: 0, zIndex: 30 }}>
        <div className="ls-wrap" style={{ maxWidth: 1180, display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 64 }}>
          <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', color: INK }}>
            <div style={{ width: 32, height: 32, borderRadius: 9, background: BRAND, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700 }}>C</div>
            <span style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700 }}>AiSend <span style={{ color: BRAND }}>WA</span></span>
          </Link>
          <Link href="/" style={{ color: '#46584f', textDecoration: 'none', fontSize: 14, fontWeight: 600 }}>← Back to home</Link>
        </div>
      </header>

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

      {/* footer */}
      <footer style={{ borderTop: '1px solid #eef2f0', padding: '28px 0' }}>
        <div className="ls-wrap" style={{ maxWidth: 1180, display: 'flex', flexWrap: 'wrap', gap: 18, justifyContent: 'space-between', alignItems: 'center', fontSize: 13, color: '#9aa8a0' }}>
          <span>© {new Date().getFullYear()} AiSend. Made in India.</span>
          <span style={{ display: 'flex', gap: 22 }}>
            <Link href="/privacy" style={{ color: '#46584f', textDecoration: 'none' }}>Privacy</Link>
            <Link href="/terms" style={{ color: '#46584f', textDecoration: 'none' }}>Terms</Link>
            <Link href="/contact" style={{ color: '#46584f', textDecoration: 'none' }}>Contact</Link>
          </span>
        </div>
      </footer>
    </div>
  )
}
