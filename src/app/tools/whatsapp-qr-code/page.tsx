import type { Metadata } from 'next'
import Link from 'next/link'
import { QrCodeTool } from './qr-code-tool'
import { SiteHeader } from '@/components/layout/site-header'
import { SiteFooter } from '@/components/layout/site-footer'
import '../../(marketing)/landing.css'

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
    <>
      <div className="lp" style={{ fontFamily: "'Inter', sans-serif" }}>
        <SiteHeader />

        <section className="relative pt-16 pb-8 overflow-hidden gradient-hero-bg">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
            <span className="inline-block px-3.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-[#14523A] mb-5">
              Print-ready QR code
            </span>
            <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight">Free WhatsApp QR code generator</h1>
            <p className="mt-4 text-base sm:text-lg text-gray-600 leading-relaxed">
              Print it, post it, package it — anyone who scans it lands straight in a chat with you on WhatsApp.
              No app, no signup, nothing saved.
            </p>
          </div>
        </section>

        <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pb-24">
          <div className="-mt-4 relative z-10">
            <QrCodeTool />
          </div>

          <section className="mt-16 bg-white rounded-2xl border border-gray-100 shadow-sm p-8 sm:p-10">
            <h2 className="text-2xl font-bold">What is a WhatsApp QR code?</h2>
            <p className="mt-4 text-base text-gray-600 leading-relaxed max-w-3xl">
              It&apos;s an ordinary QR code — the same square, black-and-white pattern used for menus and payments —
              except the link it encodes is a WhatsApp &ldquo;click-to-chat&rdquo; address (<code className="bg-gray-100 px-1.5 py-0.5 rounded text-sm">wa.me/&lt;number&gt;</code>).
              Point any phone camera at it, and instead of opening a website, it opens a WhatsApp conversation with
              that number, with a message already typed in if you&apos;ve set one.
            </p>
            <p className="mt-4 text-base text-gray-600 leading-relaxed max-w-3xl">
              The advantage over just printing your number is obvious the moment someone tries it: nobody has to
              manually save a contact, switch apps, and remember to type in the right country code. It&apos;s the
              difference between a customer thinking about messaging you and actually doing it.
            </p>
          </section>

          <section className="mt-16">
            <h2 className="text-3xl font-extrabold tracking-tight text-center mb-10">Where businesses actually put this</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {USE_CASES.map((u) => (
                <div key={u.t} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                  <h3 className="text-base font-bold">{u.t}</h3>
                  <p className="mt-2 text-sm text-gray-600 leading-relaxed">{u.d}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="mt-16 bg-white rounded-2xl border border-gray-100 shadow-sm p-8 sm:p-10">
            <h2 className="text-2xl font-bold mb-6">How to scan a WhatsApp QR code</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
              <div>
                <h3 className="text-base font-bold">On an iPhone</h3>
                <p className="mt-2 text-sm text-gray-600 leading-relaxed">
                  Open the built-in Camera app (no third-party scanner needed) and point it at the code. A
                  notification banner appears at the top — tap it to open WhatsApp.
                </p>
              </div>
              <div>
                <h3 className="text-base font-bold">On Android</h3>
                <p className="mt-2 text-sm text-gray-600 leading-relaxed">
                  Most Android phones scan QR codes directly from the Camera app the same way as iPhone. If yours
                  doesn&apos;t, open WhatsApp itself → Settings → the camera icon next to your name → Scan Code.
                </p>
              </div>
            </div>
          </section>

          <section className="mt-16">
            <h2 className="text-3xl font-extrabold tracking-tight text-center mb-10">QR code or plain link — which one do you need?</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-7">
                <h3 className="text-base font-bold text-[#14523A]">Use a QR code when…</h3>
                <p className="mt-2 text-sm text-gray-600 leading-relaxed">
                  Someone will encounter your number somewhere physical — a shop, a printed page, packaging, a
                  signboard — where there&apos;s nothing to tap, only something to point a camera at.
                </p>
              </div>
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-7">
                <h3 className="text-base font-bold text-[#14523A]">Use a plain link when…</h3>
                <p className="mt-2 text-sm text-gray-600 leading-relaxed">
                  Someone is already looking at a screen — your Instagram bio, a website button, an email signature.
                  A tap is faster there than opening a camera. Our{' '}
                  <Link href="/tools/whatsapp-link-generator" className="text-[#1B6B4A] font-bold">link generator</Link>{' '}
                  covers that case.
                </p>
              </div>
            </div>
          </section>

          <section className="mt-16 bg-white rounded-2xl border border-gray-100 shadow-sm p-8 sm:p-10">
            <h2 className="text-2xl font-bold mb-4">Before you print — 4 things that make a QR code fail</h2>
            <ul className="space-y-3 text-base text-gray-600 leading-relaxed list-disc pl-5">
              <li><strong className="text-gray-900 font-semibold">Too small.</strong> Under roughly 2 cm (0.8&Prime;) square, most phone cameras struggle at normal reading distance.</li>
              <li><strong className="text-gray-900 font-semibold">Low contrast.</strong> Placing it on a busy photo, a gradient, or a colour close to the code&apos;s own black/white breaks most scanners.</li>
              <li><strong className="text-gray-900 font-semibold">No quiet margin.</strong> The blank border around the code needs to stay blank — text or graphics crowding right up to the edge confuses the scanner.</li>
              <li><strong className="text-gray-900 font-semibold">Stretched from a small file.</strong> Enlarging a small saved image blurs the fine squares. Regenerate at the size you actually need instead.</li>
            </ul>
          </section>

          <section className="mt-16 max-w-3xl mx-auto">
            <h2 className="text-3xl font-extrabold tracking-tight text-center mb-10">Common questions</h2>
            <div className="divide-y divide-gray-200 border-y border-gray-200">
              {FAQS.map((f) => (
                <details key={f.q} className="group py-5">
                  <summary className="flex justify-between items-center font-semibold text-base sm:text-lg list-none cursor-pointer focus:outline-none">
                    <span>{f.q}</span>
                    <span className="transition group-open:rotate-180 text-gray-500">
                      <svg fill="none" height="20" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" width="20"><path d="M6 9l6 6 6-6" /></svg>
                    </span>
                  </summary>
                  <p className="text-gray-600 mt-3 text-sm sm:text-base leading-relaxed">{f.a}</p>
                </details>
              ))}
            </div>
          </section>

          <p className="mt-12 text-center text-sm text-gray-500">
            Want to know how many people actually scanned it, and reply to them automatically?{' '}
            <Link href="/signup" className="text-[#1B6B4A] font-bold">Try AiSend free →</Link>
          </p>
        </main>
      </div>
      <SiteFooter />

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
    </>
  )
}
