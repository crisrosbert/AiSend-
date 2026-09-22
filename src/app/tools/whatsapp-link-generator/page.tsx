import type { Metadata } from 'next'
import Link from 'next/link'
import { LinkGeneratorTool } from './link-generator-tool'
import { SiteHeader } from '@/components/layout/site-header'
import { SiteFooter } from '@/components/layout/site-footer'
import '../../(marketing)/landing.css'

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
    <>
      <div className="lp" style={{ fontFamily: "'Inter', sans-serif" }}>
        <SiteHeader />

        <section className="relative pt-16 pb-8 overflow-hidden gradient-hero-bg">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
            <span className="inline-block px-3.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-[#14523A] mb-5">
              Click-to-chat link
            </span>
            <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight">Create your free WhatsApp link</h1>
            <p className="mt-4 text-base sm:text-lg text-gray-600 leading-relaxed">
              No signup. No app. Just your number, a message, and a link people can click to chat with you instantly.
            </p>
          </div>
        </section>

        <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pb-24">
          <div className="-mt-4 relative z-10">
            <LinkGeneratorTool />
          </div>

          <section className="mt-16 bg-white rounded-2xl border border-gray-100 shadow-sm p-8 sm:p-10">
            <h2 className="text-2xl font-bold">How a WhatsApp link actually works</h2>
            <p className="mt-4 text-base text-gray-600 leading-relaxed max-w-3xl">
              A normal phone number, on its own, isn&apos;t clickable into a chat — someone has to save it as a
              contact first, then find it, then open WhatsApp, then start typing. A wa.me link skips every one of
              those steps: it&apos;s a single URL (<code className="bg-gray-100 px-1.5 py-0.5 rounded text-sm">https://wa.me/&lt;countrycode&gt;&lt;number&gt;</code>) that,
              when tapped, opens a chat with that exact number directly, with an optional message already sitting in
              the box.
            </p>
            <p className="mt-4 text-base text-gray-600 leading-relaxed max-w-3xl">
              It&apos;s an official WhatsApp feature (the <code className="bg-gray-100 px-1.5 py-0.5 rounded text-sm">wa.me</code> domain belongs to Meta), not a
              third-party workaround — which is why it works the same way everywhere it&apos;s placed: a bio, a
              button, a QR code, a text message.
            </p>
          </section>

          <section className="mt-16">
            <h2 className="text-3xl font-extrabold tracking-tight text-center mb-10">Where this link actually gets used</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {PLACES.map((p) => (
                <div key={p.t} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                  <h3 className="text-base font-bold">{p.t}</h3>
                  <p className="mt-2 text-sm text-gray-600 leading-relaxed">{p.d}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="mt-16 bg-emerald-50/70 border border-emerald-100 rounded-2xl p-8 sm:p-10 flex flex-wrap gap-6 items-center justify-between">
            <div className="max-w-lg">
              <h2 className="text-xl font-bold">Putting this somewhere printed instead?</h2>
              <p className="mt-2 text-sm sm:text-base text-gray-600 leading-relaxed">
                A link needs something to tap. For posters, packaging, or a storefront, generate the same link as a
                scannable QR code instead.
              </p>
            </div>
            <Link
              href="/tools/whatsapp-qr-code"
              className="inline-flex items-center justify-center bg-[#1B6B4A] hover:bg-[#14523A] text-[#fff] font-semibold text-sm px-6 py-3 rounded-lg shadow-sm transition-colors whitespace-nowrap"
            >
              Get a QR code <span className="ml-2">→</span>
            </Link>
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
