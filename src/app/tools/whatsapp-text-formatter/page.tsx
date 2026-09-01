import type { Metadata } from 'next'
import Link from 'next/link'
import { FormatterTool } from './formatter-tool'
import { PromoBanner } from '@/components/tools/promo-banner'

export const metadata: Metadata = {
  title: 'Free WhatsApp Text Formatter — Bold, Italic, Strikethrough',
  description:
    'Format WhatsApp text with bold, italic, strikethrough, monospace, bullets, and quotes — with a live preview that looks like a real WhatsApp chat. Free, no signup.',
  robots: { index: true, follow: true },
  alternates: { canonical: 'https://app.performancemktg.net/tools/whatsapp-text-formatter' },
}

const USE_CASES = [
  { t: 'Order confirmations', d: 'Bold the order number and delivery window so the customer sees what matters without reading the whole message.' },
  { t: 'Product catalogs sent by hand', d: 'Bullet a list of items and prices before pasting into a chat, instead of a wall of plain text.' },
  { t: 'Support replies', d: 'Quote the customer\'s original question, then bold the fix — a pattern lifted straight from email, now on WhatsApp.' },
  { t: 'Broadcast announcements', d: 'A bold headline and a bulleted list of what\'s new reads like an announcement, not a text dump.' },
  { t: 'Invoices and payment reminders', d: 'Strike through a paid amount, bold the outstanding balance — the eye goes straight to what\'s owed.' },
  { t: 'Scripts your team reuses', d: 'Format a reply once, save it as a canned response, and every agent sends the same clean formatting.' },
]

const FAQS = [
  {
    q: 'How do I make WhatsApp text bold, italic, or strikethrough?',
    a: 'Wrap the word or phrase in symbols: *bold* for bold, _italic_ for italic, ~strikethrough~ for strikethrough, and ```monospace``` for monospace. This tool does the wrapping for you — select text and click a button.',
  },
  {
    q: 'Do these formatting symbols work on every phone?',
    a: 'Yes — this is WhatsApp\'s own formatting syntax, built into the app on Android, iPhone, and WhatsApp Web. It renders identically wherever the recipient reads it.',
  },
  {
    q: 'Why does my message show the asterisks instead of bold text?',
    a: 'Usually one of the marker pairs isn\'t matched — check for a stray single * or _ elsewhere in the message. WhatsApp only renders the pair as formatting when both symbols are present with no space right after the opening one.',
  },
  {
    q: 'Can I number a list in WhatsApp?',
    a: 'You can type 1. 2. 3. and it reads as a numbered list, but WhatsApp doesn\'t give numbers any special rendering the way it does bold or bullets — they just stay plain text with a number in front.',
  },
  {
    q: 'Is there a way to underline text on WhatsApp?',
    a: 'No. WhatsApp supports bold, italic, strikethrough, and monospace — underline isn\'t part of its formatting syntax on any platform.',
  },
  {
    q: 'Does this tool save or send my message anywhere?',
    a: 'No. Everything happens in your browser — typing, formatting, and the preview. Nothing is saved, logged, or sent to a server. Copy the result and paste it straight into WhatsApp.',
  },
  {
    q: 'Can I use this for WhatsApp Business broadcasts and templates?',
    a: 'Yes for regular broadcasts sent from the app. Official template messages (submitted for Meta approval) have their own formatting rules — bold and italic work, but check your provider\'s template editor for what it supports.',
  },
  {
    q: 'Will this formatting show up correctly to someone without WhatsApp Business?',
    a: 'Yes — bold, italic, strikethrough, and monospace are part of standard WhatsApp, not a Business-only feature. They render the same for personal and Business accounts alike.',
  },
]

export default function WhatsAppTextFormatterPage() {
  return (
    <div style={{ fontFamily: 'var(--font-sans)', color: '#0b231a', background: '#f4f8f6', minHeight: '100vh' }}>
      <header style={{ borderBottom: '1px solid #eef2f0', background: 'rgba(255,255,255,.92)', backdropFilter: 'blur(10px)', position: 'sticky', top: 0, zIndex: 30 }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 64 }}>
          <Link href="/tools" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', color: '#0b231a' }}>
            <div style={{ width: 32, height: 32, borderRadius: 9, background: '#1DA851', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700 }}>A</div>
            <span style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700 }}>AiSend <span style={{ color: '#1DA851' }}>Tools</span></span>
          </Link>
          <Link href="/signup" style={{ background: '#075E54', color: '#fff', textDecoration: 'none', fontSize: 13.5, fontWeight: 700, padding: '9px 16px', borderRadius: 9 }}>
            Try AiSend free
          </Link>
        </div>
      </header>

      <main style={{ maxWidth: 1000, margin: '0 auto', padding: '56px 20px 90px' }}>
        <div style={{ textAlign: 'center', maxWidth: 700, margin: '0 auto 36px' }}>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(30px,4.6vw,44px)', fontWeight: 800, margin: '0 0 14px', letterSpacing: '-.025em', lineHeight: 1.15 }}>
            WhatsApp Text Formatter ✨
          </h1>
          <p style={{ fontSize: 16, lineHeight: 1.6, color: '#5b6b63', margin: 0 }}>
            Write bold, italic, strikethrough, lists, and quotes in a real editor — then copy the message
            or send it straight to WhatsApp. Free, no signup.
          </p>
        </div>

        <FormatterTool />

        <PromoBanner />

        {/* What is it */}
        <section style={{ marginTop: 30, background: '#fff', border: '1px solid #e6ece9', borderRadius: 18, padding: 30 }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 800, margin: '0 0 12px' }}>
            How WhatsApp text formatting actually works
          </h2>
          <p style={{ fontSize: 14.5, lineHeight: 1.7, color: '#46584f', margin: '0 0 12px', maxWidth: 760 }}>
            WhatsApp doesn&apos;t have a formatting toolbar — it reads plain-text symbols typed around a word and
            renders them as styling. Put a word between two asterisks (<code>*like this*</code>) and it shows up
            bold; between underscores (<code>_like this_</code>) and it&apos;s italic. The symbols never appear to
            the person reading the message — only the styled result does.
          </p>
          <p style={{ fontSize: 14.5, lineHeight: 1.7, color: '#46584f', margin: 0, maxWidth: 760 }}>
            That&apos;s useful, but easy to get wrong by hand — a missing closing asterisk, or a symbol sitting next
            to a space, and WhatsApp shows the raw symbols instead of formatting. The editor above skips the symbols
            entirely: you format the text the way you would in any document, and the correct WhatsApp syntax is
            generated only at the moment you copy or send.
          </p>
        </section>

        {/* Use cases */}
        <section style={{ marginTop: 40 }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 800, margin: '0 0 20px', textAlign: 'center' }}>
            Where formatted WhatsApp messages actually help
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 16 }}>
            {USE_CASES.map((u) => (
              <div key={u.t} style={{ background: '#fff', border: '1px solid #e6ece9', borderRadius: 14, padding: 20 }}>
                <h3 style={{ fontSize: 14.5, fontWeight: 700, margin: '0 0 6px' }}>{u.t}</h3>
                <p style={{ fontSize: 13, lineHeight: 1.55, color: '#5b6b63', margin: 0 }}>{u.d}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Cheat sheet */}
        <section style={{ marginTop: 40, background: '#fff', border: '1px solid #e6ece9', borderRadius: 18, padding: 30 }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 800, margin: '0 0 16px' }}>
            The syntax, if you&apos;d rather type it yourself
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
            {[
              { sym: '*bold*', out: 'bold' },
              { sym: '_italic_', out: 'italic' },
              { sym: '~strikethrough~', out: 'strikethrough' },
              { sym: '```monospace```', out: 'monospace' },
              { sym: '- item', out: '• item (bulleted)' },
              { sym: '> quoted', out: 'a quoted line' },
            ].map((c) => (
              <div key={c.sym} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, border: '1px solid #eef2f0', borderRadius: 10, padding: '10px 14px' }}>
                <code style={{ fontSize: 13, background: '#f1f5f3', padding: '3px 8px', borderRadius: 6 }}>{c.sym}</code>
                <span style={{ fontSize: 12.5, color: '#5b6b63' }}>→ {c.out}</span>
              </div>
            ))}
          </div>
        </section>

        <section style={{ marginTop: 50, maxWidth: 720, marginLeft: 'auto', marginRight: 'auto' }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 800, margin: '0 0 22px' }}>
            Common questions
          </h2>
          {FAQS.map((f) => (
            <div key={f.q} style={{ borderTop: '1px solid #e6ece9', padding: '18px 0' }}>
              <h3 style={{ fontSize: 15.5, fontWeight: 700, margin: '0 0 6px' }}>{f.q}</h3>
              <p style={{ fontSize: 14, lineHeight: 1.6, color: '#5b6b63', margin: 0 }}>{f.a}</p>
            </div>
          ))}
        </section>
      </main>

      <footer style={{ borderTop: '1px solid #eef2f0', padding: '26px 0' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 20px', display: 'flex', flexWrap: 'wrap', gap: 16, justifyContent: 'space-between', fontSize: 13, color: '#9aa8a0' }}>
          <span>© {new Date().getFullYear()} AiSend — a WE3 Media product.</span>
          <span style={{ display: 'flex', gap: 20 }}>
            <Link href="/tools" style={{ color: '#46584f', textDecoration: 'none' }}>All tools</Link>
            <Link href="/privacy" style={{ color: '#46584f', textDecoration: 'none' }}>Privacy</Link>
            <Link href="/" style={{ color: '#46584f', textDecoration: 'none' }}>AiSend home</Link>
          </span>
        </div>
      </footer>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'FAQPage',
            mainEntity: FAQS.map((f) => ({
              '@type': 'Question',
              name: f.q,
              acceptedAnswer: { '@type': 'Answer', text: f.a },
            })),
          }),
        }}
      />
    </div>
  )
}
