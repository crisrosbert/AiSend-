import type { Metadata } from 'next'
import Link from 'next/link'
import { QrCodeTool } from './qr-code-tool'

export const metadata: Metadata = {
  title: 'Free WhatsApp QR Code Generator',
  description:
    'Turn your WhatsApp number into a downloadable QR code — for posters, business cards, packaging, or a storefront sign. No signup, generated in your browser, free forever.',
  robots: { index: true, follow: true },
  alternates: { canonical: 'https://app.performancemktg.net/tools/whatsapp-qr-code' },
}

const USE_CASES = [
  { t: 'Storefront window or door', d: 'A passerby scans on their way in — or without ever walking in — and starts a chat before you’ve said a word. Works for shops, salons, and clinics alike.' },
  { t: 'Business cards', d: 'One scan beats reading a phone number out loud at a networking event, and it never gets mistyped into someone’s contacts.' },
  { t: 'Product packaging & inserts', d: 'Every box you ship becomes a support and reorder channel — no app to install, no form to fill in.' },
  { t: 'Restaurant table tents & menus', d: 'Guests order, ask about allergens, or leave feedback without waving down a waiter or downloading an app.' },
  { t: 'Print ads, flyers & hoardings', d: 'An offline campaign finally gets a measurable response channel — every scan is a lead, not a guess.' },
  { t: 'Instagram/Facebook story stickers', d: 'Screenshot-friendly, and works in places a tappable link can’t go — a static image, a printed catalogue, a video thumbnail.' },
  { t: 'Event badges & registration desks', d: 'Attendees message the organiser instantly for directions, schedule changes, or support — no queue at an info desk.' },
  { t: 'Vehicle decals for delivery/service fleets', d: 'Anyone who sees your van on the road can reach you the same second, instead of remembering a number for later (and forgetting it).' },
]

const FAQS = [
  {
    q: 'What happens when someone scans this QR code?',
    a: 'Their phone’s camera recognises the code, shows a notification, and tapping it opens WhatsApp with a chat to your number already started — with your optional pre-filled message sitting in the text box, ready to send with one tap.',
  },
  {
    q: 'Is the QR code free to use commercially — packaging, print ads, storefronts?',
    a: 'Yes. It’s a standard QR code encoding a wa.me link; there’s no license fee, no attribution requirement, and no expiry date. Print it as many times as you like.',
  },
  {
    q: 'Will the QR code stop working if I change my number?',
    a: 'Yes — the code is tied to the exact number (and message) you generated it with. If your number changes, come back and generate a fresh one, then replace the old print material.',
  },
  {
    q: 'What size should I print it at?',
    a: 'The downloaded PNG is generated at a high resolution suitable for most posters, table tents, and packaging. For very large prints — banners, hoardings, vehicle wraps — regenerate the code immediately before printing rather than stretching an old file, since re-scaling a small image blurs the fine squares a scanner needs to read.',
  },
  {
    q: 'Do I need a plain background, or can I put this on a colourful design?',
    a: 'QR scanners need clear contrast between the code and its background, plus a quiet margin (blank space) around all four sides — at least the width of one module. Placing it on a busy photo or a low-contrast colour is the single most common reason a printed QR code fails to scan.',
  },
  {
    q: 'How do I know the QR code actually works before I print 500 copies?',
    a: 'Print one test copy first (or scan it straight off your screen) with two or three different phones — iPhone’s camera and a couple of Android phones from different brands, since camera QR readers vary slightly in how much blur or glare they tolerate.',
  },
  {
    q: 'Can I track how many people scanned it?',
    a: 'A plain QR code like this one can’t report scans back to you — it’s just an image encoding a link. If you need scan counts (to measure whether a print campaign is working), that requires a trackable/dynamic QR code, which is on our roadmap for AiSend.',
  },
  {
    q: 'Does this work for WhatsApp Business accounts too, or only personal numbers?',
    a: 'Both. A WhatsApp Business number and a personal WhatsApp number use the exact same wa.me link format, so the QR code works identically either way.',
  },
]

export default function WhatsAppQrCodePage() {
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

      <main style={{ maxWidth: 1000, margin: '0 auto', padding: '48px 20px 90px' }}>
        <div style={{ textAlign: 'center', maxWidth: 660, margin: '0 auto 40px' }}>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(28px,4vw,40px)', fontWeight: 800, margin: '0 0 12px', letterSpacing: '-.02em' }}>
            Free WhatsApp QR code generator
          </h1>
          <p style={{ fontSize: 15.5, color: '#5b6b63', margin: 0 }}>
            Print it, post it, package it — anyone who scans it lands straight in a chat with you on WhatsApp.
            No app, no signup, nothing saved.
          </p>
        </div>

        <QrCodeTool />

        {/* What is it */}
        <section style={{ marginTop: 70, background: '#fff', border: '1px solid #e6ece9', borderRadius: 18, padding: 30 }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 800, margin: '0 0 12px' }}>
            What is a WhatsApp QR code?
          </h2>
          <p style={{ fontSize: 14.5, lineHeight: 1.7, color: '#46584f', margin: '0 0 12px', maxWidth: 760 }}>
            It’s an ordinary QR code — the same square, black-and-white pattern used for menus and payments —
            except the link it encodes is a WhatsApp &ldquo;click-to-chat&rdquo; address (<code>wa.me/&lt;number&gt;</code>).
            Point any phone camera at it, and instead of opening a website, it opens a WhatsApp conversation with
            that number, with a message already typed in if you’ve set one.
          </p>
          <p style={{ fontSize: 14.5, lineHeight: 1.7, color: '#46584f', margin: 0, maxWidth: 760 }}>
            The advantage over just printing your number is obvious the moment someone tries it: nobody has to
            manually save a contact, switch apps, and remember to type in the right country code. It’s the
            difference between a customer thinking about messaging you and actually doing it.
          </p>
        </section>

        {/* Use cases */}
        <section style={{ marginTop: 40 }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 800, margin: '0 0 20px', textAlign: 'center' }}>
            Where businesses actually put this
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

        {/* How to scan */}
        <section style={{ marginTop: 40, background: '#fff', border: '1px solid #e6ece9', borderRadius: 18, padding: 30 }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 800, margin: '0 0 16px' }}>
            How to scan a WhatsApp QR code
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 20 }}>
            <div>
              <h3 style={{ fontSize: 14.5, fontWeight: 700, margin: '0 0 8px' }}>On an iPhone</h3>
              <p style={{ fontSize: 13.5, lineHeight: 1.65, color: '#5b6b63', margin: 0 }}>
                Open the built-in Camera app (no third-party scanner needed) and point it at the code. A
                notification banner appears at the top — tap it to open WhatsApp.
              </p>
            </div>
            <div>
              <h3 style={{ fontSize: 14.5, fontWeight: 700, margin: '0 0 8px' }}>On Android</h3>
              <p style={{ fontSize: 13.5, lineHeight: 1.65, color: '#5b6b63', margin: 0 }}>
                Most Android phones scan QR codes directly from the Camera app the same way as iPhone. If yours
                doesn’t, open WhatsApp itself → Settings → the camera icon next to your name → Scan Code.
              </p>
            </div>
          </div>
        </section>

        {/* QR vs link */}
        <section style={{ marginTop: 40 }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 800, margin: '0 0 16px', textAlign: 'center' }}>
            QR code or plain link — which one do you need?
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 }}>
            <div style={{ background: '#fff', border: '1px solid #e6ece9', borderRadius: 14, padding: 20 }}>
              <h3 style={{ fontSize: 14.5, fontWeight: 700, margin: '0 0 8px', color: '#0f6e37' }}>Use a QR code when…</h3>
              <p style={{ fontSize: 13.5, lineHeight: 1.65, color: '#5b6b63', margin: 0 }}>
                Someone will encounter your number somewhere physical — a shop, a printed page, packaging, a
                signboard — where there’s nothing to tap, only something to point a camera at.
              </p>
            </div>
            <div style={{ background: '#fff', border: '1px solid #e6ece9', borderRadius: 14, padding: 20 }}>
              <h3 style={{ fontSize: 14.5, fontWeight: 700, margin: '0 0 8px', color: '#0f6e37' }}>Use a plain link when…</h3>
              <p style={{ fontSize: 13.5, lineHeight: 1.65, color: '#5b6b63', margin: 0 }}>
                Someone is already looking at a screen — your Instagram bio, a website button, an email signature.
                A tap is faster there than opening a camera. Our{' '}
                <Link href="/tools/whatsapp-link-generator" style={{ color: '#0f6e37', fontWeight: 700 }}>link generator</Link>{' '}
                covers that case.
              </p>
            </div>
          </div>
        </section>

        {/* Printing tips */}
        <section style={{ marginTop: 40, background: '#fff', border: '1px solid #e6ece9', borderRadius: 18, padding: 30 }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 800, margin: '0 0 14px' }}>
            Before you print — 4 things that make a QR code fail
          </h2>
          <ul style={{ margin: 0, paddingLeft: 20, fontSize: 14, lineHeight: 1.85, color: '#46584f' }}>
            <li><strong>Too small.</strong> Under roughly 2 cm (0.8&Prime;) square, most phone cameras struggle at normal reading distance.</li>
            <li><strong>Low contrast.</strong> Placing it on a busy photo, a gradient, or a colour close to the code’s own black/white breaks most scanners.</li>
            <li><strong>No quiet margin.</strong> The blank border around the code needs to stay blank — text or graphics crowding right up to the edge confuses the scanner.</li>
            <li><strong>Stretched from a small file.</strong> Enlarging a small saved image blurs the fine squares. Regenerate at the size you actually need instead.</li>
          </ul>
        </section>

        {/* FAQ */}
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

        <p style={{ marginTop: 40, textAlign: 'center', fontSize: 13, color: '#6b7c73' }}>
          Want to know how many people actually scanned it, and reply to them automatically?{' '}
          <Link href="/signup" style={{ color: '#0f6e37', fontWeight: 700 }}>Try AiSend free →</Link>
        </p>
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
