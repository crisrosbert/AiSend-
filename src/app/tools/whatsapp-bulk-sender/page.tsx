import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'WhatsApp Bulk Message Sender — Official API, Zero Ban Risk',
  description:
    'Send WhatsApp messages in bulk through the official Meta Cloud API — no browser automation, no number bans. Delivery tracking, opt-outs, and template approval built in.',
  robots: { index: true, follow: true },
  alternates: { canonical: 'https://app.performancemktg.net/tools/whatsapp-bulk-sender' },
}

const COMPARE: Array<{ label: string; official: string | boolean; unofficial: string | boolean }> = [
  { label: 'Built on Meta’s official Cloud API', official: true, unofficial: false },
  { label: 'Risk of your number getting banned', official: 'None', unofficial: 'Real, and common' },
  { label: 'Delivery / read receipts per recipient', official: true, unofficial: false },
  { label: 'Message templates reviewed by Meta', official: true, unofficial: false },
  { label: 'Automatic opt-out handling (STOP/START)', official: true, unofficial: false },
  { label: 'Per-message pricing is Meta’s own, no markup', official: true, unofficial: 'Varies / hidden' },
  { label: 'Keeps working if WhatsApp changes their app', official: true, unofficial: false },
]

const FAQS = [
  {
    q: 'Why do some bulk WhatsApp senders get numbers banned?',
    a: 'Most cheap "bulk sender" tools work by automating the WhatsApp Web browser session — logging in as if a human were clicking send hundreds of times. WhatsApp actively detects and bans numbers that behave like this. The official Cloud API (what AiSend uses) is a completely different, sanctioned integration — Meta expects and rate-limits it, rather than treating it as abuse.',
  },
  {
    q: 'Is this the same WhatsApp Business API businesses like Amazon and Zomato use?',
    a: 'Yes — the exact same Meta Cloud API. AiSend is the dashboard on top of it: templates, contact lists, scheduling, and delivery tracking, without writing any code.',
  },
  {
    q: 'How much does sending in bulk actually cost?',
    a: 'You pay Meta’s own per-message rate (₹1.09 for a marketing message, ₹0.145 for a utility message as of this writing) with no markup from AiSend. Replies inside an open 24-hour conversation are free.',
  },
  {
    q: 'Do I need a developer to set this up?',
    a: 'No. Connect your WhatsApp number through a guided one-click flow, pick or write a message template, upload your contact list, and send — the whole thing is a dashboard, not an API you integrate yourself.',
  },
  {
    q: 'What happens to contacts who reply STOP?',
    a: 'They’re automatically marked opted-out and excluded from every future broadcast — this is handled for you, not something you have to remember to filter yourself.',
  },
]

export default function WhatsAppBulkSenderPage() {
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

      <main style={{ maxWidth: 1000, margin: '0 auto', padding: '54px 20px 90px' }}>
        {/* Hero */}
        <div style={{ textAlign: 'center', maxWidth: 700, margin: '0 auto 46px' }}>
          <span style={{ display: 'inline-block', fontSize: 12, fontWeight: 700, letterSpacing: '.04em', textTransform: 'uppercase', color: '#0f6e37', background: '#e2f5ea', padding: '5px 12px', borderRadius: 99, marginBottom: 16 }}>
            Official Meta Cloud API
          </span>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(28px,4.5vw,42px)', fontWeight: 800, margin: '0 0 14px', letterSpacing: '-.02em', lineHeight: 1.15 }}>
            Send WhatsApp messages in bulk<br />without risking your number
          </h1>
          <p style={{ fontSize: 16, color: '#5b6b63', margin: '0 0 26px' }}>
            Most &ldquo;bulk WhatsApp sender&rdquo; tools automate a browser session behind your back — and WhatsApp bans
            numbers that do that. AiSend runs on Meta&apos;s own official API, the same one real businesses use.
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="/signup" style={{ background: 'linear-gradient(180deg,#25D366,#1DA851)', color: '#04150f', textDecoration: 'none', fontWeight: 800, fontSize: 15, padding: '13px 26px', borderRadius: 11, boxShadow: '0 10px 24px -10px rgba(29,168,81,.55)' }}>
              Start sending free
            </Link>
            <a href="#compare" style={{ color: '#0f6e37', textDecoration: 'none', fontWeight: 700, fontSize: 15, padding: '13px 10px' }}>
              See why it&apos;s safer ↓
            </a>
          </div>
        </div>

        {/* Why bans happen */}
        <section style={{ background: '#fff', border: '1px solid #e6ece9', borderRadius: 18, padding: 30, marginBottom: 20 }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 800, margin: '0 0 12px' }}>
            Why most bulk senders get numbers banned
          </h2>
          <p style={{ fontSize: 14.5, lineHeight: 1.7, color: '#46584f', margin: 0, maxWidth: 760 }}>
            A lot of cheap &ldquo;WhatsApp sender&rdquo; tools work by remote-controlling a browser logged into WhatsApp
            Web — clicking send over and over, faster than a human ever could. WhatsApp&apos;s systems are built to
            spot exactly that pattern, and the number attached to it gets banned, sometimes permanently, with no
            appeal. AiSend never touches WhatsApp Web. Every message goes through Meta&apos;s official Cloud API —
            the same sanctioned channel Meta itself rate-limits and expects businesses to use.
          </p>
        </section>

        {/* Comparison table */}
        <section id="compare" style={{ marginBottom: 20, scrollMarginTop: 90 }}>
          <style>{`
            .cmp-row { display: grid; grid-template-columns: 1fr 130px 150px; padding: 13px 18px; align-items: center; }
            @media (max-width: 520px) {
              .cmp-row { grid-template-columns: 1fr 76px 88px; padding: 12px 10px; gap: 6px; }
              .cmp-label { font-size: 12.5px !important; }
            }
          `}</style>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 800, margin: '0 0 16px', textAlign: 'center' }}>
            Official API vs. a typical &ldquo;bulk sender&rdquo; tool
          </h2>
          <div style={{ background: '#fff', border: '1px solid #e6ece9', borderRadius: 16, overflow: 'hidden' }}>
            <div className="cmp-row" style={{ background: '#f8faf9', borderBottom: '1px solid #e6ece9', fontSize: 12.5, fontWeight: 700, color: '#5b6b63', textTransform: 'uppercase', letterSpacing: '.02em' }}>
              <span></span>
              <span style={{ textAlign: 'center', color: '#0f6e37' }}>AiSend</span>
              <span style={{ textAlign: 'center' }}>Typical tool</span>
            </div>
            {COMPARE.map((row, i) => (
              <div key={row.label} className="cmp-row" style={{ fontSize: 13.5, borderTop: i === 0 ? 'none' : '1px solid #f0f3f1' }}>
                <span className="cmp-label" style={{ color: '#0c1f17' }}>{row.label}</span>
                <span style={{ textAlign: 'center', fontWeight: 700, color: row.official === true ? '#0f6e37' : '#0c1f17' }}>
                  {row.official === true ? '✓' : row.official === false ? '—' : row.official}
                </span>
                <span style={{ textAlign: 'center', color: row.unofficial === false ? '#c2cac5' : '#b4483c' }}>
                  {row.unofficial === true ? '✓' : row.unofficial === false ? '—' : row.unofficial}
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* How it works */}
        <section style={{ marginBottom: 20 }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 800, margin: '0 0 20px', textAlign: 'center' }}>
            Live in three steps
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
            {[
              { n: '1', t: 'Connect your number', d: 'A guided flow links your WhatsApp number to Meta’s official API — no code, no developer.' },
              { n: '2', t: 'Pick a template & audience', d: 'Write or choose an approved message template, then pick contacts by tag, list, or upload.' },
              { n: '3', t: 'Send & track', d: 'Watch sent, delivered, and read counts update live. Opt-outs are handled automatically.' },
            ].map((s) => (
              <div key={s.n} style={{ background: '#fff', border: '1px solid #e6ece9', borderRadius: 16, padding: 22 }}>
                <div style={{ width: 30, height: 30, borderRadius: 9, background: '#e2f5ea', color: '#0f6e37', fontWeight: 800, fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
                  {s.n}
                </div>
                <h3 style={{ fontSize: 15.5, fontWeight: 700, margin: '0 0 6px' }}>{s.t}</h3>
                <p style={{ fontSize: 13.5, lineHeight: 1.55, color: '#5b6b63', margin: 0 }}>{s.d}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Final CTA */}
        <section style={{ background: 'linear-gradient(135deg, #075E54, #1DA851)', borderRadius: 20, padding: '40px 30px', textAlign: 'center', color: '#fff', marginBottom: 60 }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 800, margin: '0 0 10px' }}>
            Your customers are already on WhatsApp
          </h2>
          <p style={{ fontSize: 14.5, color: 'rgba(255,255,255,.85)', margin: '0 0 20px' }}>
            Start free — 100 contacts, 2 broadcasts a month, no card required.
          </p>
          <Link href="/signup" style={{ display: 'inline-block', background: '#fff', color: '#075E54', textDecoration: 'none', fontWeight: 800, fontSize: 15, padding: '13px 28px', borderRadius: 11 }}>
            Start free trial →
          </Link>
        </section>

        {/* FAQ */}
        <section style={{ maxWidth: 720, margin: '0 auto' }}>
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
