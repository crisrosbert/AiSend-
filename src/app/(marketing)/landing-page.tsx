import Link from 'next/link'
import './landing.css'
import { ImageSlot } from './image-slot'
import { SiteHeader } from '@/components/layout/site-header'
import { SiteFooter } from '@/components/layout/site-footer'
import { WhatsAppVsEmail } from '@/components/marketing/whatsapp-vs-email'
import { PLANS } from '@/lib/billing/plans'
import { MESSAGE_PRICE_INR } from '@/lib/billing/credits'
import { buildPricingCards, limitHighlights, messagePriceRows } from '@/lib/marketing/home-pricing'

/**
 * AiSend — public marketing home page.
 *
 * Static (a Server Component). The header's mobile menu and every picture's
 * load/error fallback are the only client-side pieces, and both are
 * self-contained components.
 *
 * `text-white` is written as `text-[#fff]` throughout — globals.css has a
 * legacy `.text-white{color:var(--ink)!important}` rule left over from
 * the dashboard's re-theme, and the bracket form is a distinct Tailwind
 * class name that isn't caught by it. Same fix as the footer.
 *
 * Every photo is an <ImageSlot>: until a real file exists at the path in
 * its `src` (public/home/...), it shows a clean stand-in card instead of a
 * broken image.
 *
 * TRUTH RULE FOR THIS PAGE: only say what the product can prove today.
 * The first version of this page was copied from another company's site and
 * carried customer logos, named testimonials, "210,000+ businesses", G2
 * awards, a "Meta partner" badge, usage statistics, SEO-agency sections and
 * a fake video player. None of that is verified, so none of it is here. When
 * real customers, ratings or numbers exist, add them back with the proof.
 * Plans and prices come from src/lib/billing/plans.ts and credits.ts.
 */

const ON_GREEN = 'text-[#fff]'

const AT_A_GLANCE = [
  'Free forever plan',
  'No card needed to start',
  'No setup fee',
  'Free WhatsApp link and QR tools',
  'Free website chat button',
]

const BROADCAST_BULLETS = [
  { title: 'Send approved templates', body: 'Create a message template, let Meta review it, then send it to your contacts. We track the approval for you.' },
  { title: 'Know who said yes', body: 'Opt-in and opt-out are tracked for every contact, so you message people who agreed to hear from you.' },
  { title: 'Schedule for later', body: 'Pick a date and time and schedule a broadcast instead of sending it right now.' },
]

const FEATURE_ROWS = [
  {
    title: 'Reply to click-to-WhatsApp ad leads instantly',
    body: ['When someone taps your Facebook or Instagram ad and lands on WhatsApp, your AI agent can answer straight away.', 'Every lead is captured in one place, so nobody is left waiting.'],
    cta: 'Set up the Ads Agent',
    alt: 'Click-to-WhatsApp ad leads answered by an AI agent',
    img: 'home-click-to-whatsapp-ads',
  },
  {
    title: 'Collect payments in the chat',
    body: ['Your AI agent can create a Razorpay payment link and send it right inside the conversation.', 'The money goes to your own Razorpay account.'],
    cta: 'Start collecting payments',
    alt: 'A payment link sent inside a WhatsApp chat',
    img: 'home-whatsapp-payments',
  },
  {
    title: 'Book appointments without leaving WhatsApp',
    body: ['Let the AI agent offer time slots inside your open hours and book them in the chat.', 'Appointment reminders go out automatically to cut no-shows.'],
    cta: 'Try appointment booking',
    alt: 'An appointment booked inside a WhatsApp chat',
    img: 'home-booking',
  },
]

const DASHBOARD_CARDS = [
  { title: 'One shared team inbox', body: ['Several team members can answer customers from the same WhatsApp number.', 'Assign chats, add notes and keep the full history in one place.'], alt: 'Shared team inbox', img: 'home-live-chat' },
  { title: 'Analytics at a glance', body: ['See delivery, replies and conversions for your campaigns.', 'Spot what works and send the next message with more confidence.'], alt: 'Campaign analytics dashboard', img: 'home-analytics' },
  { title: 'Chatbot flows without code', body: ['Build WhatsApp chatbot journeys with a drag-and-drop builder.', 'Set up automations: if this happens, do that.'], alt: 'Drag and drop chatbot flow builder', img: 'home-chatbot-flow' },
  { title: 'Import contacts and broadcast', body: ['Import your contacts from an Excel or CSV file, then send an approved template to them.', 'Pay per message from a prepaid wallet and see every rupee spent.'], alt: 'Import contacts and send a broadcast', img: 'home-import-broadcast' },
]

const PREFOOTER_ITEMS = [
  { title: 'Official WhatsApp Business API', body: 'Set up through Meta, not an unofficial workaround.', d: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z' },
  { title: 'Help with the green tick', body: 'We help you apply for a verified business account.', d: 'M5 13l4 4L19 7' },
  { title: 'Support when you need it', body: 'Reach us on WhatsApp or email from the contact page.', d: 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z' },
]

const CHANNEL_NODES = [
  { title: 'AI agent', pos: 'top-2 left-1/2 -translate-x-1/2', color: 'text-indigo-600', d: 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z' },
  { title: 'Website chat', pos: 'right-1 top-1/2 -translate-y-1/2', color: 'text-blue-600', d: 'M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9' },
  { title: 'Contacts and CRM', pos: 'left-1 top-1/2 -translate-y-1/2', color: 'text-purple-600', d: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z' },
]

const HUB_CHECKS = [
  { strong: 'One shared inbox', rest: ' for WhatsApp chats and website chat.' },
  { strong: 'The same AI agent', rest: ' answers on WhatsApp and on your website.' },
  { strong: 'One team', rest: ', with assignments, notes and history in a single place.' },
]

const AGENT_CHECKS = [
  'Collects the customer’s name, phone and email inside the chat',
  'Answers from your own knowledge: your catalogue, prices and policies',
  'Books appointments in your open hours',
  'Hands over to your team when a person is needed',
]

const FREE_TOOLS = [
  { name: 'WhatsApp Link Generator', desc: 'Create a click-to-chat link with a message already filled in.', href: '/tools/whatsapp-link-generator' },
  { name: 'WhatsApp QR Code Generator', desc: 'Make a scannable QR code for your shop, flyer or website.', href: '/tools/whatsapp-qr-code' },
  { name: 'WhatsApp Template Generator', desc: 'Write a template and check it against common reasons for rejection.', href: '/tools/whatsapp-template-generator' },
  { name: 'WhatsApp ROI Calculator', desc: 'Estimate what WhatsApp campaigns could earn for you.', href: '/tools/whatsapp-roi-calculator' },
]

const MESSAGE_ROWS = messagePriceRows(MESSAGE_PRICE_INR)

// Free plan facts for the FAQ come from plans.ts, so they can never drift from the pricing cards.
const FREE_PLAN = PLANS.find((p) => p.priceMonthly === 0) ?? PLANS[0]
const freeLimits = limitHighlights(FREE_PLAN.limits).map((x) => x.toLowerCase())

const FAQS = [
  { q: 'What does AiSend do?', a: 'AiSend is a WhatsApp CRM for businesses. You can send approved-template broadcasts, answer customers with an AI agent, build chatbot journeys, work from one shared team inbox, and see your results in one dashboard.' },
  { q: 'Does AiSend use the official WhatsApp Business API?', a: 'Yes. AiSend connects to the official WhatsApp Business Platform from Meta. It is not an unofficial workaround.' },
  { q: 'Is there a free plan?', a: `Yes. The ${FREE_PLAN.name} plan costs \u20B90 and needs no card. It includes ${freeLimits.join(', ')}. Upgrade only when you outgrow it.` },
  { q: 'Is there a setup fee?', a: 'No. There is no setup fee. You pay the plan fee (nothing on the free plan) and the per-message prices listed in the pricing section, from a prepaid wallet.' },
  { q: 'What does it cost to send messages?', a: `Messages are charged per delivered message from your prepaid wallet: ₹${MESSAGE_PRICE_INR.marketing} for a marketing message, ₹${MESSAGE_PRICE_INR.utility} for a utility message and ₹${MESSAGE_PRICE_INR.authentication} for an authentication message. Replying to a message your customer sent you is free.` },
  { q: 'Do my broadcast templates need approval?', a: 'Yes. Meta reviews marketing and utility templates before you can send them. AiSend lets you create a template and track its approval status.' },
  { q: 'How do I get help?', a: 'Use the contact page to email us or message us on WhatsApp. We typically reply within one business day.' },
]

function CheckCircleIcon({ d }: { d: string }) {
  return (
    <svg className="w-6 h-6 text-[#1B6B4A] flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path d={d} strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
    </svg>
  )
}

export default function LandingPage() {
  const pricingCards = buildPricingCards(PLANS)

  return (
    <>
      <div className="lp" style={{ fontFamily: "'Inter', sans-serif" }}>
        <SiteHeader />
        <main>
          {/* Hero */}
          <section className="relative pt-12 pb-20 md:pt-16 md:pb-28 overflow-hidden gradient-hero-bg">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-16 relative z-10">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
                <div className="lg:col-span-7 flex flex-col items-start text-left">
                  <div className="inline-flex items-center gap-2.5 px-4 py-2 rounded-full bg-emerald-50 border border-emerald-200 shadow-sm text-xs sm:text-sm font-semibold text-emerald-950 mb-6">
                    <span className="relative flex h-2.5 w-2.5" aria-hidden="true">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#1B6B4A]" />
                    </span>
                    <span>Built on the official WhatsApp Business API</span>
                  </div>
                  <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-[1.12]">
                    Your Customers Are Already on WhatsApp{' '}
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#1B6B4A] to-[#6FD9A0]">Now Your Sales Can Be</span> Too
                  </h1>
                  <p className="mt-6 text-base sm:text-lg text-gray-600 max-w-2xl leading-relaxed">
                    Send approved broadcast campaigns, let an AI agent answer your customers, and manage every chat from one shared team inbox.
                  </p>
                  <div className="mt-8 flex flex-col sm:flex-row items-stretch sm:items-center gap-4 w-full sm:w-auto">
                    <Link className={`inline-flex items-center justify-center bg-[#1B6B4A] hover:bg-[#14523A] ${ON_GREEN} font-bold text-base px-8 py-4 rounded-xl shadow-lg hover:shadow-[#1B6B4A]/25 transition-all duration-200 transform hover:-translate-y-0.5`} href="/signup">
                      Start free <span className="ml-2" aria-hidden="true">→</span>
                    </Link>
                    <Link className="inline-flex items-center justify-center bg-white/90 hover:bg-white text-gray-800 font-semibold text-base px-7 py-4 rounded-xl border border-gray-200 shadow-sm hover:border-emerald-300 transition-all duration-200" href="/tools">
                      Try the free WhatsApp tools
                    </Link>
                  </div>
                  <ul className="mt-6 flex flex-wrap items-center gap-y-2 gap-x-6 text-xs sm:text-sm font-medium text-gray-500">
                    <li><span aria-hidden="true">✓ </span>Free forever plan</li>
                    <li><span aria-hidden="true">✓ </span>No credit card required</li>
                    <li><span aria-hidden="true">✓ </span>No setup fee</li>
                  </ul>
                </div>
                <div className="lg:col-span-5 relative">
                  <div className="absolute -top-12 -left-12 w-72 h-72 bg-[#1B6B4A]/20 rounded-full blur-3xl pointer-events-none" />
                  <div className="absolute -bottom-10 -right-10 w-72 h-72 bg-[#6FD9A0]/25 rounded-full blur-3xl pointer-events-none" />
                  <div className="relative mx-auto max-w-lg lg:max-w-none">
                    <div className="relative rounded-3xl p-2 bg-gradient-to-b from-white/90 to-white/40 backdrop-blur-xl border border-white/60 shadow-2xl">
                      <ImageSlot src="/home/home-hero.webp" alt="AiSend inbox and AI agent answering a customer on WhatsApp" variant="flush" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* At a glance (facts only) */}
          <section aria-label="Why teams start with AiSend" className="py-8 border-y border-gray-100 bg-gray-50/50">
            <ul className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-sm font-semibold text-emerald-900">
              {AT_A_GLANCE.map((item) => (
                <li key={item} className="inline-flex items-center gap-2">
                  <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" /></svg>
                  {item}
                </li>
              ))}
            </ul>
          </section>

          {/* Broadcast feature */}
          <section className="py-20 bg-white">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
                <div>
                  <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight leading-tight">Send WhatsApp broadcasts the official way</h2>
                  <p className="mt-4 text-base sm:text-lg text-gray-600">Reach the customers who opted in, with messages Meta has approved.</p>
                  <div className="mt-8 space-y-6">
                    {BROADCAST_BULLETS.map((b) => (
                      <div key={b.title} className="flex items-start">
                        <div className="flex-shrink-0 mt-1">
                          <div className="w-8 h-8 rounded-full bg-emerald-50 text-[#1B6B4A] flex items-center justify-center font-bold text-sm" aria-hidden="true">✦</div>
                        </div>
                        <div className="ml-4">
                          <h3 className="text-lg font-bold">{b.title}</h3>
                          <p className="text-sm sm:text-base text-gray-600 mt-0.5">{b.body}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-10">
                    <Link className={`inline-flex items-center justify-center bg-[#1B6B4A] hover:bg-[#14523A] ${ON_GREEN} font-semibold text-base px-7 py-3 rounded-lg shadow-sm hover:shadow transition-colors`} href="/signup">
                      Start for free <span className="ml-2" aria-hidden="true">→</span>
                    </Link>
                  </div>
                </div>
                <div className="flex justify-center">
                  <div className="relative w-full max-w-lg">
                    <ImageSlot src="/home/home-broadcast.webp" alt="Preview of a WhatsApp broadcast" variant="plain" />
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Core feature pillars */}
          <section className="py-20 bg-gray-50/60">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="text-center max-w-3xl mx-auto mb-16">
                <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight">Let your AI agent do the busy work</h2>
                <p className="mt-4 text-base sm:text-lg text-gray-600">Answer, capture, collect and book inside the WhatsApp chat.</p>
              </div>
              <div className="space-y-20">
                {FEATURE_ROWS.map((row, i) => (
                  <div key={row.title} className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
                    <div className={i % 2 === 0 ? 'order-2 lg:order-1' : 'order-2'}>
                      <h3 className="text-2xl sm:text-3xl font-bold">{row.title}</h3>
                      {row.body.map((p, j) => (
                        <p key={p} className={`${j === 0 ? 'mt-4' : 'mt-3'} text-base text-gray-600 leading-relaxed`}>{p}</p>
                      ))}
                      <div className="mt-6">
                        <Link className="inline-flex items-center text-[#1B6B4A] hover:text-emerald-700 font-semibold text-base group" href="/signup">
                          {row.cta} <span className="ml-1 group-hover:translate-x-1 transition-transform" aria-hidden="true">→</span>
                        </Link>
                      </div>
                    </div>
                    <div className={`flex justify-center ${i % 2 === 0 ? 'order-1 lg:order-2' : 'order-1'}`}>
                      <ImageSlot src={`/home/${row.img}.webp`} alt={row.alt} variant="plain" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Dashboard features */}
          <section className="py-20 bg-gray-50/50">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="text-center max-w-3xl mx-auto mb-16">
                <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight">Everything your team needs in one dashboard</h2>
                <p className="mt-3 text-base sm:text-lg text-gray-600">From the first message to the follow-up, in one place.</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {DASHBOARD_CARDS.map((c) => (
                  <div key={c.title} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col justify-between hover:shadow-md transition-shadow">
                    <div className="p-6 sm:p-8">
                      <h3 className="text-xl font-bold">{c.title}</h3>
                      {c.body.map((p) => (
                        <p key={p} className="mt-2 text-sm sm:text-base text-gray-600">{p}</p>
                      ))}
                    </div>
                    <div className="px-6 pb-6 pt-2 bg-gradient-to-b from-transparent to-gray-50 flex items-center justify-center">
                      <ImageSlot src={`/home/${c.img}.webp`} alt={c.alt} variant="flush" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Pricing: plans from src/lib/billing/plans.ts, message prices from credits.ts */}
          <section id="pricing" aria-labelledby="pricing-heading" className="py-20 bg-white border-t border-gray-100">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="text-center max-w-3xl mx-auto mb-14">
                <h2 id="pricing-heading" className="text-3xl sm:text-4xl font-extrabold tracking-tight">Simple pricing. Start free.</h2>
                <p className="mt-4 text-base sm:text-lg text-gray-600">Pick a plan for your team and limits. Messages are paid for separately, per delivered message, from a prepaid wallet.</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
                {pricingCards.map((card) => (
                  <div key={card.id} className="flex flex-col rounded-2xl border border-gray-200 bg-white p-7 shadow-sm">
                    <h3 className="text-xl font-bold">{card.name}</h3>
                    <div className="mt-6">
                      <div className="text-4xl font-extrabold text-gray-900">{card.priceLabel}</div>
                      {card.priceNote ? <div className="mt-1 text-sm font-medium text-gray-500">{card.priceNote}</div> : null}
                    </div>
                    <ul className="mt-6 space-y-3 text-sm text-gray-700 flex-1">
                      {card.highlights.map((h) => (
                        <li key={h} className="flex items-start gap-2">
                          <svg className="w-4 h-4 mt-0.5 flex-shrink-0 text-[#1B6B4A]" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" /></svg>
                          {h}
                        </li>
                      ))}
                    </ul>
                    <div className="mt-8">
                      {card.priceKnown ? (
                        <Link className={`inline-flex w-full items-center justify-center bg-[#1B6B4A] hover:bg-[#14523A] ${ON_GREEN} font-semibold text-base px-6 py-3 rounded-lg shadow-sm transition-colors`} href="/signup">
                          {card.isFree ? 'Start free' : `Choose ${card.name}`}
                        </Link>
                      ) : (
                        <Link className="inline-flex w-full items-center justify-center bg-white hover:bg-gray-50 text-gray-800 font-semibold text-base px-6 py-3 rounded-lg border border-gray-300 shadow-sm transition-colors" href="/contact">
                          Ask about {card.name}
                        </Link>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-14 max-w-3xl mx-auto">
                <h3 className="text-xl font-bold text-center">What a message costs</h3>
                <p className="mt-2 text-center text-sm text-gray-600">Charged per delivered message from your prepaid wallet. Prices are in Indian rupees.</p>
                <div className="mt-6 overflow-hidden rounded-2xl border border-gray-200">
                  <table className="w-full text-left text-sm sm:text-base">
                    <caption className="sr-only">Price per delivered WhatsApp message</caption>
                    <thead className="bg-emerald-50">
                      <tr>
                        <th scope="col" className="p-4 font-bold">Message type</th>
                        <th scope="col" className="p-4 font-bold text-right">Price</th>
                      </tr>
                    </thead>
                    <tbody>
                      {MESSAGE_ROWS.map((r) => (
                        <tr key={r.label} className="border-t border-gray-100">
                          <th scope="row" className="p-4 font-medium text-gray-800">{r.label}</th>
                          <td className="p-4 text-right font-semibold text-gray-900">{r.price}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </section>

          {/* Pre-footer CTA */}
          <section className="py-16 bg-gray-50">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="bg-white rounded-3xl border border-gray-200 p-8 sm:p-12 lg:p-16 shadow-lg overflow-hidden grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
                <div className="lg:col-span-7">
                  <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight leading-tight">Start with WhatsApp marketing today</h2>
                  <p className="mt-4 text-base sm:text-lg text-gray-600">AiSend runs on the official WhatsApp Business API, so you can grow on WhatsApp the way Meta expects.</p>
                  <div className="mt-8 space-y-4">
                    {PREFOOTER_ITEMS.map((item) => (
                      <div key={item.title} className="flex items-start">
                        <CheckCircleIcon d={item.d} />
                        <div className="ml-3">
                          <h3 className="font-bold text-base">{item.title}</h3>
                          <p className="text-sm text-gray-500">{item.body}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-8">
                    <Link className={`inline-flex items-center justify-center bg-[#1B6B4A] hover:bg-[#14523A] ${ON_GREEN} font-semibold text-base px-8 py-3.5 rounded-lg shadow transition-colors`} href="/signup">
                      Start now for free <span className="ml-2" aria-hidden="true">→</span>
                    </Link>
                  </div>
                </div>
                <div className="lg:col-span-5 flex justify-center">
                  <ImageSlot src="/home/home-onboarding.webp" alt="AiSend onboarding and setup screen" variant="plain" />
                </div>
              </div>
            </div>
          </section>

          {/* One inbox */}
          <section className="py-24 bg-white border-t border-gray-100 overflow-hidden">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
                <div className="lg:col-span-6 flex flex-col items-start">
                  <div className="inline-flex items-center gap-2 mb-4">
                    <span className="h-1 w-5 rounded-full bg-[#1B6B4A]" aria-hidden="true" />
                    <span className="text-xs font-bold uppercase tracking-widest text-[#1B6B4A]">One inbox</span>
                  </div>
                  <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight leading-[1.18]">WhatsApp and your website chat, in one inbox</h2>
                  <p className="mt-5 text-base sm:text-lg text-gray-600 leading-relaxed">Customers can reach you on WhatsApp or on your website. Every conversation lands in the same inbox, with the same team and the same AI agent.</p>
                  <div className="mt-8 space-y-4 w-full">
                    {HUB_CHECKS.map((c) => (
                      <div key={c.strong} className="flex items-start gap-3.5">
                        <div className="w-6 h-6 rounded-full bg-emerald-50 text-[#1B6B4A] flex items-center justify-center font-bold text-sm flex-shrink-0 mt-0.5 border border-emerald-200" aria-hidden="true">✓</div>
                        <p className="text-gray-700 text-sm sm:text-base leading-relaxed"><strong className="text-gray-900 font-semibold">{c.strong}</strong>{c.rest}</p>
                      </div>
                    ))}
                  </div>
                  <div className="mt-10">
                    <Link className="inline-flex items-center justify-center bg-white hover:bg-gray-50 text-gray-800 font-semibold text-sm sm:text-base px-6 py-3 rounded-xl border border-gray-200 shadow-sm hover:border-emerald-300 transition-all duration-200" href="/tools/whatsapp-chat-widget">
                      Add a chat button to your website <span className="ml-2 text-gray-400" aria-hidden="true">→</span>
                    </Link>
                  </div>
                </div>
                <div className="lg:col-span-6 flex justify-center items-center relative" aria-hidden="true">
                  <div className="relative w-80 h-80 sm:w-96 sm:h-96 flex items-center justify-center">
                    <div className="absolute inset-0 rounded-full border border-emerald-100 bg-emerald-50/30" />
                    <div className="absolute inset-10 rounded-full border border-emerald-200/60 bg-emerald-50/50" />
                    <div className="absolute inset-20 rounded-full border border-emerald-200 bg-white/60 shadow-inner" />
                    <div className={`relative z-10 w-24 h-24 rounded-full bg-gradient-to-tr from-[#1B6B4A] to-[#25D366] ${ON_GREEN} flex items-center justify-center shadow-xl shadow-[#1B6B4A]/25 border-4 border-white`}>
                      <svg className="w-12 h-12 fill-current" viewBox="0 0 24 24"><path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z" /></svg>
                    </div>
                    {CHANNEL_NODES.map((n) => (
                      <div key={n.title} className={`absolute ${n.pos} w-12 h-12 bg-white rounded-2xl shadow-lg border border-gray-100 flex items-center justify-center`}>
                        <svg className={`w-6 h-6 ${n.color}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d={n.d} strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" /></svg>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Campaigns */}
          <section className="py-24 bg-gray-50/60 border-t border-gray-100">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="max-w-3xl mb-12">
                <div className="inline-flex items-center gap-2 mb-4">
                  <span className="h-1 w-5 rounded-full bg-[#1B6B4A]" aria-hidden="true" />
                  <span className="text-xs font-bold uppercase tracking-widest text-[#1B6B4A]">Campaigns</span>
                </div>
                <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight leading-tight">
                  Personal campaigns on <span className="text-[#1B6B4A]">WhatsApp</span>, sent to many people at once
                </h2>
                <p className="mt-4 text-base sm:text-lg text-gray-600 leading-relaxed">Write it once with the customer&apos;s name, order and city filled in automatically. Meta reviews the template, we handle the sending, and every reply lands back in your shared inbox.</p>
                <div className="mt-8 flex flex-wrap items-center gap-4">
                  <Link className={`inline-flex items-center justify-center bg-[#1B6B4A] hover:bg-[#14523A] ${ON_GREEN} font-semibold text-sm sm:text-base px-6 py-3.5 rounded-xl shadow-md transition-colors`} href="/signup">Start free, no card</Link>
                  <Link className="inline-flex items-center justify-center bg-white hover:bg-gray-50 text-gray-800 font-semibold text-sm sm:text-base px-6 py-3.5 rounded-xl border border-gray-200 shadow-sm transition-colors" href="/contact">Talk to us</Link>
                </div>
              </div>
              <div className="rounded-3xl border border-gray-200 bg-white shadow-xl overflow-hidden p-3 sm:p-6">
                <div className="bg-gray-50 rounded-2xl border border-gray-100 p-4 sm:p-6 flex flex-col lg:flex-row gap-6 items-center justify-between">
                  <div className="w-full lg:w-1/2 space-y-4">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-semibold">
                      <span className="w-2 h-2 rounded-full bg-[#1B6B4A]" aria-hidden="true" /> Example template
                    </div>
                    <h3 className="text-xl font-bold">Personalised flash sale broadcast</h3>
                    <div className="bg-white rounded-xl p-4 border border-gray-200 text-sm font-mono text-gray-700 space-y-2 shadow-sm">
                      <p className="text-xs text-gray-500">Each customer gets their own details filled in.</p>
                      <p>Hey <span className="bg-amber-100 text-amber-900 px-1 rounded">{'{{1: First Name}}'}</span>! We noticed you left <span className="bg-amber-100 text-amber-900 px-1 rounded">{'{{2: Product Name}}'}</span> in your cart.</p>
                      <p>Here is an exclusive 15% discount for you in <span className="bg-amber-100 text-amber-900 px-1 rounded">{'{{3: City}}'}</span>: code <span className="font-bold text-[#1B6B4A]">WHATSAPP15</span>.</p>
                    </div>
                    <p className="text-xs text-gray-500 font-medium pt-2">A sample message for illustration. Templates must be approved by Meta before you can send them.</p>
                  </div>
                  <div className="w-full lg:w-1/2 flex justify-center">
                    <ImageSlot src="/home/home-campaign-builder.webp" alt="Campaign builder screen" variant="plain" />
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* AI agent */}
          <section className="py-24 bg-white border-t border-gray-100">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="max-w-3xl mb-12">
                <div className="inline-flex items-center gap-2 mb-4">
                  <span className="h-1 w-5 rounded-full bg-[#1B6B4A]" aria-hidden="true" />
                  <span className="text-xs font-bold uppercase tracking-widest text-[#1B6B4A]">AI agents</span>
                </div>
                <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight leading-tight">An assistant that answers like someone who works there</h2>
                <p className="mt-4 text-base sm:text-lg text-gray-600 leading-relaxed">Trained on your own catalogue, prices and policies, and ready to hand over the moment a person is needed.</p>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center bg-gray-50/70 p-8 sm:p-12 rounded-3xl border border-gray-200">
                <div className="lg:col-span-6 space-y-6">
                  <h3 className="text-2xl sm:text-3xl font-bold">Turns a first message into a lead</h3>
                  <ul className="space-y-4 pt-2">
                    {AGENT_CHECKS.map((c) => (
                      <li key={c} className="flex items-start gap-3">
                        <span className="text-[#1B6B4A] font-bold text-base mt-0.5" aria-hidden="true">✓</span>
                        <span className="text-gray-700 text-sm sm:text-base font-medium">{c}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="pt-4">
                    <Link className="inline-flex items-center justify-center bg-white hover:bg-gray-100 text-gray-900 font-semibold text-sm sm:text-base px-6 py-3 rounded-xl border border-gray-300 shadow-sm transition-colors" href="/signup">Create your AI agent free <span className="ml-2" aria-hidden="true">→</span></Link>
                  </div>
                </div>
                <div className="lg:col-span-6 flex justify-center">
                  <div className="bg-white rounded-2xl border border-gray-200 shadow-lg p-5 max-w-md w-full space-y-4">
                    <div className="flex items-center gap-3 border-b border-gray-100 pb-3">
                      <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-[#1B6B4A] font-bold" aria-hidden="true">AI</div>
                      <div>
                        <div className="text-sm font-bold">Example conversation</div>
                        <div className="text-xs text-gray-500 font-medium">An illustration, not a real chat</div>
                      </div>
                    </div>
                    <div className="space-y-3 text-xs sm:text-sm">
                      <div className="bg-gray-100 text-gray-800 p-3 rounded-2xl rounded-tl-none max-w-[85%]">Hi there! Welcome. What are you looking for today?</div>
                      <div className={`bg-[#1B6B4A] ${ON_GREEN} p-3 rounded-2xl rounded-tr-none ml-auto max-w-[80%]`}>I want to know the price of your premium package.</div>
                      <div className="bg-gray-100 text-gray-800 p-3 rounded-2xl rounded-tl-none max-w-[85%]">Happy to help. May I have your name and email so our team can send the details?</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* WhatsApp vs email */}
          <WhatsAppVsEmail />

          {/* Free tools and blog */}
          <section className="py-20 bg-gray-50/60 border-t border-gray-100">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="text-center max-w-3xl mx-auto mb-12">
                <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight">Free WhatsApp tools, no signup needed</h2>
                <p className="mt-4 text-base sm:text-lg text-gray-600">Useful on their own, and a good way to try AiSend before you sign up.</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {FREE_TOOLS.map((t) => (
                  <Link key={t.href} href={t.href} className="group flex flex-col justify-between rounded-2xl border border-gray-200 bg-white p-6 shadow-sm hover:shadow-lg hover:border-emerald-300 transition-all duration-200">
                    <div>
                      <h3 className="text-lg font-bold group-hover:text-emerald-700 transition-colors leading-snug">{t.name}</h3>
                      <p className="mt-2 text-sm text-gray-500 leading-relaxed">{t.desc}</p>
                    </div>
                    <span className="mt-6 inline-flex items-center text-sm font-bold text-[#1B6B4A]">Open the tool <span className="ml-1.5 group-hover:translate-x-1 transition-transform" aria-hidden="true">→</span></span>
                  </Link>
                ))}
              </div>
              <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
                <Link className={`inline-flex items-center justify-center bg-[#1B6B4A] hover:bg-[#14523A] ${ON_GREEN} font-semibold text-sm sm:text-base px-7 py-3 rounded-full shadow-md transition-colors`} href="/tools">See all free tools</Link>
                <Link className="inline-flex items-center justify-center bg-white hover:bg-gray-50 text-gray-800 font-semibold text-sm sm:text-base px-7 py-3 rounded-full border border-gray-300 shadow-sm transition-colors" href="/blog">Read the WhatsApp marketing blog</Link>
              </div>
            </div>
          </section>

          {/* FAQ */}
          <section id="faq" aria-labelledby="faq-heading" className="py-20 bg-white">
            <div className="max-w-4xl mx-auto px-4 sm:px-6">
              <h2 id="faq-heading" className="text-3xl sm:text-4xl font-extrabold text-center tracking-tight mb-12">Frequently asked questions</h2>
              <div className="divide-y divide-gray-200 border-y border-gray-200">
                {FAQS.map((f) => (
                  <details key={f.q} className="group faq-item py-5 cursor-pointer">
                    <summary className="flex justify-between items-center font-semibold text-gray-900 text-base sm:text-lg list-none focus:outline-none">
                      <span>{f.q}</span>
                      <span className="transition group-open:rotate-180 text-gray-500" aria-hidden="true">
                        <svg fill="none" height="20" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" width="20"><path d="M6 9l6 6 6-6" /></svg>
                      </span>
                    </summary>
                    <p className="text-gray-600 mt-3 text-sm sm:text-base leading-relaxed">{f.a}</p>
                  </details>
                ))}
              </div>
            </div>
          </section>
        </main>

        {/* Floating WhatsApp button */}
        <aside aria-label="Chat on WhatsApp" className="fixed bottom-6 right-6 z-50">
          <a aria-label="Chat with AiSend on WhatsApp" className={`w-14 h-14 bg-[#25D366] hover:bg-[#20ba59] ${ON_GREEN} rounded-full flex items-center justify-center shadow-xl hover:shadow-2xl transition-all duration-200 transform hover:scale-105`} href="https://wa.me/918796437535" target="_blank" rel="noopener noreferrer">
            <svg className="w-8 h-8 fill-current" viewBox="0 0 24 24" aria-hidden="true"><path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z" /></svg>
          </a>
        </aside>
      </div>
      <SiteFooter />
    </>
  )
}
