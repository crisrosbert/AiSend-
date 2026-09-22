import type { CSSProperties } from 'react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { SiteHeader } from '@/components/layout/site-header'
import { SiteFooter } from '@/components/layout/site-footer'

export const metadata: Metadata = {
  title: 'Free WhatsApp Tools',
  description:
    'Free WhatsApp tools for businesses — link generators, QR codes, and more. No signup required.',
  robots: { index: true, follow: true },
  alternates: { canonical: 'https://app.performancemktg.net/tools' },
}

const TOOLS: Array<{ href: string; name: string; desc: string; live: boolean }> = [
  {
    href: '/tools/whatsapp-link-generator',
    name: 'WhatsApp Link Generator',
    desc: 'Create a free click-to-chat wa.me link with a QR code, in your browser.',
    live: true,
  },
  {
    href: '/tools/whatsapp-bulk-sender',
    name: 'WhatsApp Bulk Sender',
    desc: 'Send templated WhatsApp messages to thousands of contacts, officially.',
    live: true,
  },
  {
    href: '/tools/whatsapp-qr-code',
    name: 'WhatsApp QR Code',
    desc: 'Download a scannable QR code for your WhatsApp number.',
    live: true,
  },
  {
    href: '/tools/whatsapp-text-formatter',
    name: 'WhatsApp Text Formatter',
    desc: 'Bold, italic, strikethrough, and bullets — with a live chat preview.',
    live: true,
  },
]

export default function ToolsIndexPage() {
  return (
    <div style={{ fontFamily: 'var(--font-sans)', color: '#0b231a', background: '#f4f8f6', minHeight: '100vh' }}>
      <SiteHeader />

      <main style={{ maxWidth: 900, margin: '0 auto', padding: '56px 20px 90px' }}>
        <div style={{ textAlign: 'center', maxWidth: 560, margin: '0 auto 44px' }}>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(28px,4vw,38px)', fontWeight: 800, margin: '0 0 12px', letterSpacing: '-.02em' }}>
            Free WhatsApp tools
          </h1>
          <p style={{ fontSize: 15.5, color: '#5b6b63', margin: 0 }}>
            No signup, no app install — just useful things for a business running on WhatsApp.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 18 }}>
          {TOOLS.map((t) => {
            const cardStyle: CSSProperties = {
              display: 'block', background: '#fff', border: '1px solid #e6ece9', borderRadius: 16,
              padding: 22, textDecoration: 'none', color: '#0b231a',
              opacity: t.live ? 1 : 0.55, cursor: t.live ? 'pointer' : 'default',
              boxShadow: '0 8px 20px -14px rgba(11,35,26,.14)',
            }
            const card = (
              <>
                <h2 style={{ fontSize: 16.5, fontWeight: 700, margin: '0 0 6px' }}>{t.name}</h2>
                <p style={{ fontSize: 13.5, lineHeight: 1.55, color: '#5b6b63', margin: 0 }}>{t.desc}</p>
                {!t.live && (
                  <span style={{ display: 'inline-block', marginTop: 12, fontSize: 11, fontWeight: 700, letterSpacing: '.04em', textTransform: 'uppercase', color: '#a7b3ac' }}>
                    Coming soon
                  </span>
                )}
              </>
            )
            return t.live ? (
              <Link key={t.name} href={t.href} style={cardStyle}>{card}</Link>
            ) : (
              <div key={t.name} aria-disabled style={cardStyle}>{card}</div>
            )
          })}
        </div>
      </main>

      <SiteFooter />
    </div>
  )
}
