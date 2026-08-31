import type { Metadata } from 'next'
import Link from 'next/link'
import { LinkGeneratorTool } from './link-generator-tool'

export const metadata: Metadata = {
  title: 'Free WhatsApp Link Generator (Click to Chat)',
  description:
    'Create a free wa.me WhatsApp link with a pre-filled message and QR code — no signup, no app install. Share it on your bio, website, or storefront.',
  robots: { index: true, follow: true },
  alternates: { canonical: 'https://app.performancemktg.net/tools/whatsapp-link-generator' },
}

const PLACES = [
  { t: 'Instagram / Facebook bio', d: 'The one link you get in your bio — send it straight to a chat instead of a generic contact page.' },
  { t: 'Website "Chat with us" button', d: 'Skip building a contact form; a button linking here opens a real conversation in one tap.' },
  { t: 'Google Business Profile', d: 'Add it as your website or a custom link so people searching for you locally can message immediately.' },
  { t: 'Email signature', d: 'Under your name and title — a faster reply channel than "please call the office."' },
  { t: 'Online marketplace listings', d: 'Justdial, IndiaMART, Etsy — anywhere a buyer wants to ask something before they order.' },
  { t: 'WhatsApp Status / broadcast', d: 'Forward it to prospects who’ve messaged before, so they can share it onward with a friend.' },
]

const FAQS = [
  {
    q: 'What is a WhatsApp click-to-chat link?',
    a: 'It\'s a link (wa.me/919876543210) that opens a chat with a specific number directly — the person clicking it doesn\'t need to save your number first, and can optionally see a pre-filled message ready to send.',
  },
  {
    q: 'Do I need to install anything or sign up?',
    a: 'No. This tool runs entirely in your browser — type your number, get your link. Nothing is saved or sent to a server.',
  },
  {
    q: 'Can I put this link on my Instagram bio or website?',
    a: 'Yes — that\'s exactly what it\'s for. Paste it as your bio link, a website button, or print the QR code on packaging or a storefront sign.',
  },
  {
    q: 'Can I edit the link later without breaking it?',
    a: 'A plain wa.me link is fixed to one number and message — regenerate a new one if either changes. If you need an editable, trackable branded link, that\'s a feature we\'re adding to AiSend.',
  },
  {
    q: 'Why does the link start with wa.me and not whatsapp.com?',
    a: 'wa.me is WhatsApp\'s own official short domain for click-to-chat links, owned and operated by Meta — the same company behind WhatsApp. It isn\'t a third-party redirect.',
  },
  {
    q: 'Does the pre-filled message get sent automatically?',
    a: 'No — it only fills the text box. The person opening the chat still has to tap send themselves, so nothing goes out without them choosing to.',
  },
  {
    q: 'Will this work if the person doesn\'t have my number saved?',
    a: 'Yes, that\'s the entire point — a wa.me link opens a chat with a number regardless of whether it\'s already in the other person\'s contacts.',
  },
  {
    q: 'Can I use this for a WhatsApp Business number?',
    a: 'Yes, wa.me links work identically for personal and WhatsApp Business numbers — there\'s no separate format for business accounts.',
  },
]

export default function WhatsAppLinkGeneratorPage() {
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
        <div style={{ textAlign: 'center', maxWidth: 620, margin: '0 auto 40px' }}>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(28px,4vw,40px)', fontWeight: 800, margin: '0 0 12px', letterSpacing: '-.02em' }}>
            Create your free WhatsApp link
          </h1>
          <p style={{ fontSize: 15.5, color: '#5b6b63', margin: 0 }}>
            No signup. No app. Just your number, a message, and a link people can click to chat with you instantly.
          </p>
        </div>

        <LinkGeneratorTool />

        {/* What is it */}
        <section style={{ marginTop: 70, background: '#fff', border: '1px solid #e6ece9', borderRadius: 18, padding: 30 }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 800, margin: '0 0 12px' }}>
            How a WhatsApp link actually works
          </h2>
          <p style={{ fontSize: 14.5, lineHeight: 1.7, color: '#46584f', margin: '0 0 12px', maxWidth: 760 }}>
            A normal phone number, on its own, isn&apos;t clickable into a chat — someone has to save it as a
            contact first, then find it, then open WhatsApp, then start typing. A wa.me link skips every one of
            those steps: it&apos;s a single URL (<code>https://wa.me/&lt;countrycode&gt;&lt;number&gt;</code>) that,
            when tapped, opens a chat with that exact number directly, with an optional message already sitting in
            the box.
          </p>
          <p style={{ fontSize: 14.5, lineHeight: 1.7, color: '#46584f', margin: 0, maxWidth: 760 }}>
            It&apos;s an official WhatsApp feature (the <code>wa.me</code> domain belongs to Meta), not a
            third-party workaround — which is why it works the same way everywhere it&apos;s placed: a bio, a
            button, a QR code, a text message.
          </p>
        </section>

        {/* Where to use it */}
        <section style={{ marginTop: 40 }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 800, margin: '0 0 20px', textAlign: 'center' }}>
            Where this link actually gets used
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 16 }}>
            {PLACES.map((p) => (
              <div key={p.t} style={{ background: '#fff', border: '1px solid #e6ece9', borderRadius: 14, padding: 20 }}>
                <h3 style={{ fontSize: 14.5, fontWeight: 700, margin: '0 0 6px' }}>{p.t}</h3>
                <p style={{ fontSize: 13, lineHeight: 1.55, color: '#5b6b63', margin: 0 }}>{p.d}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Need a physical version */}
        <section style={{ marginTop: 40, background: '#fff', border: '1px solid #e6ece9', borderRadius: 18, padding: 30, display: 'flex', flexWrap: 'wrap', gap: 20, alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ maxWidth: 560 }}>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 19, fontWeight: 800, margin: '0 0 6px' }}>
              Putting this somewhere printed instead?
            </h2>
            <p style={{ fontSize: 13.5, lineHeight: 1.6, color: '#5b6b63', margin: 0 }}>
              A link needs something to tap. For posters, packaging, or a storefront, generate the same link as a
              scannable QR code instead.
            </p>
          </div>
          <Link href="/tools/whatsapp-qr-code" style={{ background: '#075E54', color: '#fff', textDecoration: 'none', fontSize: 14, fontWeight: 700, padding: '11px 20px', borderRadius: 10, whiteSpace: 'nowrap' }}>
            Get a QR code →
          </Link>
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
