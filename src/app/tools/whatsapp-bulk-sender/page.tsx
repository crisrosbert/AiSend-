import type { Metadata } from 'next'
import Link from 'next/link'
import { SiteHeader } from '@/components/layout/site-header'
import { SiteFooter } from '@/components/layout/site-footer'
import '../../(marketing)/landing.css'

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

const STEPS = [
  { n: '1', t: 'Connect your number', d: 'A guided flow links your WhatsApp number to Meta’s official API — no code, no developer.' },
  { n: '2', t: 'Pick a template & audience', d: 'Write or choose an approved message template, then pick contacts by tag, list, or upload.' },
  { n: '3', t: 'Send & track', d: 'Watch sent, delivered, and read counts update live. Opt-outs are handled automatically.' },
]

const WHO_FOR = [
  { t: 'E-commerce & D2C', d: 'Order confirmations, shipping updates, abandoned-cart nudges, and flash-sale drops to your whole list at once.' },
  { t: 'Real estate & property', d: 'New-listing alerts and price-drop notices to every buyer who’s enquired, segmented by budget or locality.' },
  { t: 'Coaching, courses & education', d: 'Batch reminders, assignment nudges, and enrolment offers to students and leads without a group-chat mess.' },
  { t: 'Clinics & healthcare', d: 'Appointment reminders and health-camp announcements — utility templates, not marketing, so open rates stay high.' },
  { t: 'Agencies managing multiple clients', d: 'Run separate broadcasts per client number from one dashboard instead of juggling logins.' },
  { t: 'Events & webinars', d: 'Registration confirmations, day-before reminders, and post-event follow-ups to everyone who signed up.' },
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
  {
    q: 'How many people can I actually message in one broadcast?',
    a: 'There’s no hard cap in AiSend itself — the limit is Meta’s own messaging tier for your number, which starts at 250 unique recipients per rolling 24 hours for a new number and rises automatically as you send quality messages with good delivery and low block rates.',
  },
  {
    q: 'What is a message template, and why can’t I just send free text to everyone?',
    a: 'Outside a 24-hour conversation window, WhatsApp only allows pre-approved "template" messages — this is a platform-wide anti-spam rule, not an AiSend limitation. You write the template once, Meta reviews it (usually within minutes to a few hours), and you reuse it for every broadcast.',
  },
  {
    q: 'Can I schedule a broadcast for later, or send it right now?',
    a: 'Both — send immediately or schedule for a specific date and time, useful for time-zone-sensitive offers or coordinating with a launch.',
  },
]

export default function WhatsAppBulkSenderPage() {
  return (
    <>
      <div className="lp" style={{ fontFamily: "'Inter', sans-serif" }}>
        <SiteHeader />

        <section className="relative pt-16 pb-16 overflow-hidden gradient-hero-bg">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
            <span className="inline-block px-3.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-[#14523A] mb-5">
              Official Meta Cloud API
            </span>
            <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight leading-[1.12]">
              Send WhatsApp messages in bulk without risking your number
            </h1>
            <p className="mt-5 text-base sm:text-lg text-gray-600 leading-relaxed">
              Most &ldquo;bulk WhatsApp sender&rdquo; tools automate a browser session behind your back — and WhatsApp bans
              numbers that do that. AiSend runs on Meta&apos;s own official API, the same one real businesses use.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/signup"
                className="inline-flex items-center justify-center bg-[#1B6B4A] hover:bg-[#14523A] text-[#fff] font-bold text-base px-8 py-4 rounded-xl shadow-lg transition-all duration-200 transform hover:-translate-y-0.5"
              >
                Start sending free <span className="ml-2">→</span>
              </Link>
              <a href="#compare" className="inline-flex items-center text-[#14523A] font-semibold text-base">
                See why it&apos;s safer ↓
              </a>
            </div>
          </div>
        </section>

        <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pb-24">
          <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 sm:p-10">
            <h2 className="text-2xl font-bold">Why most bulk senders get numbers banned</h2>
            <p className="mt-4 text-base text-gray-600 leading-relaxed max-w-3xl">
              A lot of cheap &ldquo;WhatsApp sender&rdquo; tools work by remote-controlling a browser logged into WhatsApp
              Web — clicking send over and over, faster than a human ever could. WhatsApp&apos;s systems are built to
              spot exactly that pattern, and the number attached to it gets banned, sometimes permanently, with no
              appeal. AiSend never touches WhatsApp Web. Every message goes through Meta&apos;s official Cloud API —
              the same sanctioned channel Meta itself rate-limits and expects businesses to use.
            </p>
          </section>

          <section id="compare" className="mt-16 scroll-mt-24">
            <h2 className="text-3xl font-extrabold tracking-tight text-center mb-10">
              Official API vs. a typical &ldquo;bulk sender&rdquo; tool
            </h2>
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="grid grid-cols-[1fr_110px_130px] sm:grid-cols-[1fr_140px_160px] bg-gray-50 border-b border-gray-100 px-4 sm:px-6 py-3 text-[11px] sm:text-xs font-bold uppercase tracking-wide text-gray-500">
                <span />
                <span className="text-center text-[#14523A]">AiSend</span>
                <span className="text-center">Typical tool</span>
              </div>
              {COMPARE.map((row, i) => (
                <div
                  key={row.label}
                  className={`grid grid-cols-[1fr_110px_130px] sm:grid-cols-[1fr_140px_160px] items-center px-4 sm:px-6 py-3.5 text-xs sm:text-sm ${i === 0 ? '' : 'border-t border-gray-100'}`}
                >
                  <span className="text-gray-800">{row.label}</span>
                  <span className={`text-center font-bold ${row.official === true ? 'text-[#14523A]' : 'text-gray-800'}`}>
                    {row.official === true ? '✓' : row.official === false ? '—' : row.official}
                  </span>
                  <span className={`text-center ${row.unofficial === false ? 'text-gray-300' : 'text-red-600'}`}>
                    {row.unofficial === true ? '✓' : row.unofficial === false ? '—' : row.unofficial}
                  </span>
                </div>
              ))}
            </div>
          </section>

          <section className="mt-16">
            <h2 className="text-3xl font-extrabold tracking-tight text-center mb-10">Live in three steps</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              {STEPS.map((s) => (
                <div key={s.n} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-7">
                  <div className="w-9 h-9 rounded-lg bg-emerald-50 text-[#14523A] font-extrabold text-sm flex items-center justify-center mb-4">
                    {s.n}
                  </div>
                  <h3 className="text-base font-bold">{s.t}</h3>
                  <p className="mt-2 text-sm text-gray-600 leading-relaxed">{s.d}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="mt-16">
            <h2 className="text-3xl font-extrabold tracking-tight text-center mb-10">Built for the businesses actually sending in bulk</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {WHO_FOR.map((v) => (
                <div key={v.t} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                  <h3 className="text-base font-bold">{v.t}</h3>
                  <p className="mt-2 text-sm text-gray-600 leading-relaxed">{v.d}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="mt-16 bg-[#1B6B4A] rounded-3xl px-8 py-12 sm:px-14 sm:py-14 text-center">
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#fff]">Your customers are already on WhatsApp</h2>
            <p className="mt-3 text-sm sm:text-base text-emerald-100">
              Start free — 100 contacts, 2 broadcasts a month, no card required.
            </p>
            <Link
              href="/signup"
              className="mt-7 inline-flex items-center justify-center bg-[#fff] hover:bg-emerald-50 text-[#1B6B4A] font-bold text-base px-8 py-3.5 rounded-xl shadow-lg transition-colors"
            >
              Start free trial <span className="ml-2">→</span>
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
