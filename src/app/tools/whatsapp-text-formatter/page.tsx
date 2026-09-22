import type { Metadata } from 'next'
import { FormatterTool } from './formatter-tool'
import { PromoBanner } from '@/components/tools/promo-banner'
import { SiteHeader } from '@/components/layout/site-header'
import { SiteFooter } from '@/components/layout/site-footer'
import '../../(marketing)/landing.css'

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

const CHEAT_SHEET = [
  { sym: '*bold*', out: 'bold' },
  { sym: '_italic_', out: 'italic' },
  { sym: '~strikethrough~', out: 'strikethrough' },
  { sym: '```monospace```', out: 'monospace' },
  { sym: '- item', out: '• item (bulleted)' },
  { sym: '> quoted', out: 'a quoted line' },
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
    <>
      <div className="lp" style={{ fontFamily: "'Inter', sans-serif" }}>
        <SiteHeader />

        <section className="relative pt-16 pb-8 overflow-hidden gradient-hero-bg">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
            <span className="inline-block px-3.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-[#14523A] mb-5">
              Live editor
            </span>
            <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight">WhatsApp Text Formatter ✨</h1>
            <p className="mt-4 text-base sm:text-lg text-gray-600 leading-relaxed">
              Write bold, italic, strikethrough, lists, and quotes in a real editor — then copy the message
              or send it straight to WhatsApp. Free, no signup.
            </p>
          </div>
        </section>

        <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pb-24">
          <div className="-mt-4 relative z-10">
            <FormatterTool />
          </div>

          <PromoBanner />

          <section className="mt-6 bg-white rounded-2xl border border-gray-100 shadow-sm p-8 sm:p-10">
            <h2 className="text-2xl font-bold">How WhatsApp text formatting actually works</h2>
            <p className="mt-4 text-base text-gray-600 leading-relaxed max-w-3xl">
              WhatsApp doesn&apos;t have a formatting toolbar — it reads plain-text symbols typed around a word and
              renders them as styling. Put a word between two asterisks (<code className="bg-gray-100 px-1.5 py-0.5 rounded text-sm">*like this*</code>) and it shows up
              bold; between underscores (<code className="bg-gray-100 px-1.5 py-0.5 rounded text-sm">_like this_</code>) and it&apos;s italic. The symbols never appear to
              the person reading the message — only the styled result does.
            </p>
            <p className="mt-4 text-base text-gray-600 leading-relaxed max-w-3xl">
              That&apos;s useful, but easy to get wrong by hand — a missing closing asterisk, or a symbol sitting next
              to a space, and WhatsApp shows the raw symbols instead of formatting. The editor above skips the symbols
              entirely: you format the text the way you would in any document, and the correct WhatsApp syntax is
              generated only at the moment you copy or send.
            </p>
          </section>

          <section className="mt-16">
            <h2 className="text-3xl font-extrabold tracking-tight text-center mb-10">Where formatted WhatsApp messages actually help</h2>
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
            <h2 className="text-2xl font-bold mb-6">The syntax, if you&apos;d rather type it yourself</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {CHEAT_SHEET.map((c) => (
                <div key={c.sym} className="flex items-center justify-between gap-3 border border-gray-100 rounded-lg px-4 py-3">
                  <code className="text-sm bg-gray-100 px-2 py-1 rounded">{c.sym}</code>
                  <span className="text-sm text-gray-600">→ {c.out}</span>
                </div>
              ))}
            </div>
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
