import Link from 'next/link'
import './landing.css'
import { ImageSlot } from './image-slot'
import { SiteHeader } from '@/components/layout/site-header'
import { SiteFooter } from '@/components/layout/site-footer'

/**
 * AiSend — public marketing home page.
 *
 * Reproduces the user-supplied reference design. Static by default (a
 * Server Component); the header's mobile menu and every picture's
 * load/error fallback are the only client-side pieces, and both are
 * self-contained components.
 *
 * `text-white` is written as `text-[#fff]` throughout — globals.css has a
 * legacy `.text-white{color:var(--ink)!important}` rule left over from
 * the dashboard's re-theme, and the bracket form is a distinct Tailwind
 * class name that isn't caught by it. Same fix as the footer.
 *
 * Every photo is an <ImageSlot> rather than a bare <img>: the reference's
 * image URLs are Google AI Studio demo hotlinks, not AiSend's own assets,
 * so they're left blank (dashed placeholder) until a real image URL is
 * pasted into the relevant `src` prop below.
 *
 * The customer logos, the three named testimonials, the "210,000+
 * Businesses" stat, the G2 award ribbons, and "Meta CTX Growth Champion
 * 2025" are reproduced exactly as given, per explicit instruction — verify
 * these are real before this goes live, since as written they claim named
 * companies and people as AiSend customers/endorsers.
 */

const LOGOS = [
  { text: 'BIKANO', className: 'font-extrabold text-xl tracking-wider text-amber-700' },
  { text: 'wipro)', className: 'font-bold text-2xl tracking-tighter text-indigo-900' },
  { text: 'Fortune', className: 'font-black text-xl italic text-red-600' },
  { text: 'clove:', className: 'font-serif font-bold text-xl tracking-widest text-emerald-950' },
  { text: 'digio', className: 'font-bold text-2xl text-blue-600' },
  { text: 'turtlemint', className: 'font-semibold text-xl tracking-wide text-teal-700' },
  { text: 'WALKER', className: 'font-bold text-lg text-cyan-800' },
]

const BROADCAST_BULLETS = [
  { title: '8+ Powerful Messaging Categories', body: 'Send Promotions, Offers, Coupon codes, Carousels and More- Risk-Free!' },
  { title: 'Add CTAs. Drive 3x Conversions', body: 'Turn conversations into conversions with eye-catching CTA and Quick Reply buttons' },
  { title: 'Schedule your WhatsApp messages', body: 'Streamline your work, Schedule Broadcasts 2 months ahead of time' },
]

const METRICS = [
  { n: '98%', label: 'Open Rates' },
  { n: '45-60%', label: 'Click Rates' },
  { n: '2.6Bn+', label: 'Active Users' },
  { n: '70%', label: 'Engagement Rate' },
]

const ADVANCED_CARDS = [
  { title: 'Multiple Human Live Chat', body: ['Have multiple team members to drive Live Chat Support on the Same WhatsApp Business Number.', 'Filter Chats according to tags, campaigns and attributes for Smart Agent Chat Routing.'], alt: 'Live Chat UI Interface' },
  { title: 'Real-Time Analytics', body: ['Track your campaign results in real-time.', 'Monitor Read, Replied & Clicked rates for each campaign and retarget smartly for higher conversions!'], alt: 'Campaign Analytics UI' },
  { title: 'Build no-code Chatbot in minutes', body: ['Build your Own Chatbot Flows your Way! Easy-to-use Chatbot & Catalog Flow builder to build your conversational journeys'], alt: 'Drag and drop chatbot flow builder' },
  { title: 'Import & Broadcast Instantly', body: ['Simply Import all your Contacts and Broadcast approved messages Instantly.', 'See real-time analytics on the AISEND. Platform for delivered, read rates and more'], alt: 'Import contacts and broadcast console' },
]

const PERKS = [
  'Free Green Tick Verification',
  'Free WhatsApp Business API',
  'Free Onboarding',
  'Zero Setup fee',
  'Free Website Widget',
  'Free QR & Link',
]

const G2_RIBBONS = [
  { text: 'User Love Us', tone: 'border-red-200 bg-red-50/50 text-red-600' },
  { text: 'High Performer', tone: 'border-amber-200 bg-amber-50/50 text-amber-600' },
  { text: 'High Performer', tone: 'border-amber-200 bg-amber-50/50 text-amber-600' },
  { text: 'High Performer', tone: 'border-amber-200 bg-amber-50/50 text-amber-600' },
  { text: 'Momentum Leader', tone: 'border-amber-200 bg-amber-50/50 text-amber-600' },
  { text: 'High Performer', tone: 'border-amber-200 bg-amber-50/50 text-amber-600' },
]

const TESTIMONIALS = [
  { initials: 'PO', ring: 'bg-emerald-100 text-emerald-800 border-emerald-400', name: 'Priyal Ostwal', role: 'Marketing Manager, PhysicsWallah', quote: 'AISEND. team has shown exceptional professionalism, reliability and a true commitment to customer satisfaction.' },
  { initials: 'AJ', ring: 'bg-amber-100 text-amber-800 border-amber-400', name: 'Akash Jain', role: 'Business Executive, Cosco', quote: "AISEND. helped us increase our customer engagement. Our customer engagement increased from 35% to 90% with AISEND.'s Smart Retargeting feature." },
  { initials: 'AM', ring: 'bg-indigo-100 text-indigo-800 border-indigo-400', name: 'Achina Mayya', role: 'Founder & CEO, AevyTV', quote: 'AISEND. has been pivotal for us. The personalised interactions and instant responses greatly improved our engagement rates, and more importantly our sales!' },
]

const PREFOOTER_ITEMS = [
  { title: 'Official Green Tick Verification', body: 'Get Verified Green Tick on your Whatsapp & Broadcast Unlimited Notifications everyday', d: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z' },
  { title: 'Dedicated Live Chat Support', body: 'Priority Chat Support by AISEND. Team over WhatsApp, Phone, Live Chat & Email', d: 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z' },
  { title: 'Blazing Fast Feature launches', body: "We're constantly adding new WhatsApp features, so you can always offer the best experience to your customers.", d: 'M13 10V3L4 14h7v7l9-11h-7z' },
]

const CHANNEL_NODES = [
  { title: 'Email', pos: 'top-2 left-1/2 -translate-x-1/2', color: 'text-indigo-600', d: 'M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z' },
  { title: 'Web Chat', pos: 'right-1 top-1/2 -translate-y-1/2', color: 'text-blue-600', d: 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z' },
  { title: 'SMS', pos: 'bottom-8 right-6', color: 'text-emerald-600', d: 'M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z' },
  { title: 'Website', pos: 'bottom-2 left-1/2 -translate-x-1/2', color: 'text-teal-600', d: 'M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9' },
  { title: 'Phone', pos: 'bottom-8 left-6', color: 'text-amber-600', d: 'M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z' },
  { title: 'Contacts CRM', pos: 'left-1 top-1/2 -translate-y-1/2', color: 'text-purple-600', d: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z' },
]

const HUB_CHECKS = [
  { strong: 'One thread per customer', rest: ', no matter which channel they used last.' },
  { strong: 'The same saved replies', rest: ' and the same assistant across all of them.' },
  { strong: 'Reporting that adds up', rest: ', instead of five dashboards that disagree.' },
]

const CAMPAIGN_STATS = ['98.4% Delivered', '68.2% Opened', '24.8% Click-Through']

const AGENT_TAB_CHECKS = [
  'Asks the two or three things you actually need before a call',
  'Works out what someone wants before pushing a product at them',
  'Drops each person into the right follow-up sequence automatically',
  'Books the demo straight into your calendar, in the chat',
]

const REPORTS = [
  { tag: 'Ecommerce', title: "Women's Wear Market Trends Report", body: 'In-depth analysis of consumer shopping shifts, highest conversion WhatsApp catalog formats, and 2025 seasonal benchmarks.', pages: '24 Pages' },
  { tag: 'Hospitality', title: 'Hotel Industry Market Trends Report', body: 'Direct booking automation, concierge WhatsApp chat experiences, and guest retention strategies for premium boutique chains.', pages: '32 Pages' },
  { tag: 'Investment', title: 'Mutual Funds Market Trends Report', body: 'How FinTech brands accelerate KYC verification, portfolio updates, and advisory consultations over verified WhatsApp APIs.', pages: '28 Pages' },
]

const SEO_TABS = ['AI SEO Services', 'Enterprise SEO Services', 'Ecommerce SEO Services']

const FAQS = [
  { q: 'What does AISEND. do?', a: 'AISEND. provides businesses with a WhatsApp marketing software they can use to Broadcast & automate messages, run Click to WhatsApp Ads, build Chatbots, showcase catalogues, provide multi-agent Live chat support, collect payments within WhatsApp and much more.' },
  { q: 'Is AISEND. an Official WhatsApp Marketing Software?', a: 'Yes, AISEND. is an Official WhatsApp Business Solution Partner (BSP) built on WhatsApp Business APIs.' },
  { q: 'Does AISEND. offer a FREE account?', a: 'Yes. AISEND. offers a FREE forever plan, providing businesses with free access to the WhatsApp Business API. This plan is perfect for small and medium-sized businesses to start their WhatsApp marketing journey with zero upfront costs.' },
  { q: 'Is there any WhatsApp Business API procurement fee for a brand/business?', a: "No. There is no Setup fee, just a subscription fee. AISEND. doesn't charge a single penny to procure the WhatsApp Business API for a Brand/Business. Businesses can procure the API completely free through AISEND.." },
  { q: 'How do you handle Customer Support?', a: 'We have a dedicated customer support team available via Live Chat, Email, Phone, and Zoom, ready to assist our customers with any questions or support they may need.' },
  { q: 'What is the Cost of Broadcasting messages?', a: 'WhatsApp charges are ₹1.09/ message for marketing messages & ₹0.145 for utility and authentication messages. You can recharge this from the AISEND. Dashboard itself. Each message is charged separately by Meta. Service conversations (replies to user messages) are free of cost.' },
  { q: 'How many messages can I Broadcast in a day to my customers?', a: 'You will start with 2000 Messages/day. As you send 500+ Messages, your limit will be upgraded to 10,000 messages/day and as you send 5000 messages within 7 days, your limit will be upgraded to 100,000 messages/day. Last limit is infinite messages/day which can be enabled by sending 50,000 messages within 7 days. The Limit upgrades happen in 24 hours.' },
]

function CheckCircleIcon({ d }: { d: string }) {
  return (
    <svg className="w-6 h-6 text-[#00C675] flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path d={d} strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
    </svg>
  )
}

export default function LandingPage() {
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
                    <span className="relative flex h-2.5 w-2.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#00C675]" />
                    </span>
                    <span>✨ Meta Official Business Solution Partner</span>
                  </div>
                  <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-[1.12]">
                    5X Your Revenue with{' '}
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#00C675] via-emerald-600 to-teal-600">Next-Gen WhatsApp</span> Marketing
                  </h1>
                  <p className="mt-6 text-base sm:text-lg text-gray-600 max-w-2xl leading-relaxed">
                    Broadcast campaigns to millions, automate conversations with intelligent AI agents, collect seamless in-chat payments, and 5X conversions with official Meta WhatsApp APIs.
                  </p>
                  <div className="mt-8 flex flex-col sm:flex-row items-stretch sm:items-center gap-4 w-full sm:w-auto">
                    <Link className="inline-flex items-center justify-center bg-[#00C675] hover:bg-[#00ad66] text-[#fff] font-bold text-base px-8 py-4 rounded-xl shadow-lg hover:shadow-emerald-500/25 transition-all duration-200 transform hover:-translate-y-0.5" href="/signup">
                      Start 14-Day Free Trial <span className="ml-2">→</span>
                    </Link>
                    <a className="inline-flex items-center justify-center bg-white/90 hover:bg-white text-gray-800 font-semibold text-base px-7 py-4 rounded-xl border border-gray-200 shadow-sm hover:border-emerald-300 transition-all duration-200" href="#">
                      <svg className="w-5 h-5 mr-2.5 text-emerald-600 fill-current" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                      ⚡ Watch 2-Min Product Tour
                    </a>
                  </div>
                  <div className="mt-6 flex flex-wrap items-center gap-y-2 gap-x-6 text-xs sm:text-sm font-medium text-gray-500">
                    <span>✓ No credit card required</span>
                    <span>✓ 10-minute setup</span>
                    <span>✓ Official Green Tick Verified</span>
                  </div>
                  <div className="mt-8 pt-6 border-t border-gray-100 flex flex-wrap items-center gap-4 text-xs sm:text-sm text-gray-600">
                    <div className="flex items-center gap-2 bg-amber-50/80 border border-amber-200 px-3.5 py-1.5 rounded-lg text-amber-900 font-semibold">
                      <span>🏆</span>
                      <span>Meta CTX Growth Champion 2025</span>
                    </div>
                    <div className="flex items-center gap-1.5 font-medium text-gray-700">
                      <span className="text-amber-500">★★★★★</span>
                      <span className="font-bold">4.9/5</span>
                      <span className="text-gray-400">(2,500+ G2 &amp; Capterra Reviews)</span>
                    </div>
                  </div>
                </div>
                <div className="lg:col-span-5 relative">
                  <div className="absolute -top-12 -left-12 w-72 h-72 bg-emerald-200/40 rounded-full blur-3xl pointer-events-none" />
                  <div className="absolute -bottom-10 -right-10 w-72 h-72 bg-teal-200/30 rounded-full blur-3xl pointer-events-none" />
                  <div className="relative mx-auto max-w-lg lg:max-w-none">
                    <div className="relative rounded-3xl p-2 bg-gradient-to-b from-white/90 to-white/40 backdrop-blur-xl border border-white/60 shadow-2xl">
                      <ImageSlot alt="WhatsApp AI Marketing & Sales in Action" label="Hero product shot" dimensions="1200 × 900 · PNG, JPG or WebP" variant="flush" />
                      <div className="absolute -top-4 -left-4 sm:-left-6 bg-white/95 backdrop-blur-md px-4 py-3 rounded-2xl shadow-xl border border-gray-100 flex items-center gap-3 animate-pulse">
                        <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold text-lg border border-amber-200">🔥</div>
                        <div>
                          <div className="text-xs text-gray-400 font-medium">Return on Ad Spend</div>
                          <div className="text-sm font-extrabold text-gray-900">10X ROAS Generated</div>
                        </div>
                      </div>
                      <div className="absolute -bottom-5 -left-3 sm:-left-4 bg-white/95 backdrop-blur-md px-4 py-3 rounded-2xl shadow-xl border border-gray-100 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-emerald-50 text-[#00C675] flex items-center justify-center font-bold text-base border border-emerald-200">✓</div>
                        <div>
                          <div className="text-xs text-gray-400 font-medium">Direct WhatsApp Checkout</div>
                          <div className="text-sm font-extrabold text-gray-900">Order Confirmed • ₹1,299</div>
                        </div>
                      </div>
                      <div className="absolute -top-3 -right-3 sm:-right-5 bg-white/95 backdrop-blur-md px-4 py-2.5 rounded-2xl shadow-xl border border-gray-100 flex items-center gap-2">
                        <span className="text-emerald-500 font-bold text-sm">⚡</span>
                        <span className="text-xs font-bold text-gray-900">98% Read Rate</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Social proof marquee */}
          <section className="py-12 border-y border-gray-100 bg-gray-50/50">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
              <h2 className="text-2xl md:text-3xl font-bold tracking-tight">Founders &amp; Marketers Love us</h2>
              <p className="text-sm md:text-base text-gray-500 mt-2">Trusted by 210,000+ Businesses across 68+ Countries</p>
              <div className="mt-8 flex flex-wrap items-center justify-center gap-8 md:gap-14 opacity-75 grayscale hover:grayscale-0 transition-all duration-300">
                {LOGOS.map((logo) => (
                  <span key={logo.text} className={logo.className}>{logo.text}</span>
                ))}
              </div>
            </div>
          </section>

          {/* Broadcast feature */}
          <section className="py-20 bg-white">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
                <div>
                  <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight leading-tight">Broadcast Marketing Messages on WhatsApp (Officially)</h2>
                  <p className="mt-4 text-base sm:text-lg text-gray-600">Enjoy a Limitless Broadcasting experience on WhatsApp</p>
                  <div className="mt-8 space-y-6">
                    {BROADCAST_BULLETS.map((b) => (
                      <div key={b.title} className="flex items-start">
                        <div className="flex-shrink-0 mt-1">
                          <div className="w-8 h-8 rounded-full bg-emerald-50 text-[#00C675] flex items-center justify-center font-bold text-sm">✦</div>
                        </div>
                        <div className="ml-4">
                          <h3 className="text-lg font-bold">{b.title}</h3>
                          <p className="text-sm sm:text-base text-gray-600 mt-0.5">{b.body}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-10">
                    <Link className="inline-flex items-center justify-center bg-[#00C675] hover:bg-[#00ad66] text-[#fff] font-semibold text-base px-7 py-3 rounded-lg shadow-sm hover:shadow transition-colors" href="/signup">
                      Start for FREE <span className="ml-2">→</span>
                    </Link>
                  </div>
                </div>
                <div className="flex justify-center">
                  <div className="relative w-full max-w-lg">
                    <ImageSlot alt="WhatsApp Broadcasting Preview" label="Broadcast preview" dimensions="1000 × 900 · PNG, JPG or WebP" variant="plain" />
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Core feature pillars */}
          <section className="py-20 bg-gray-50/60">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="text-center max-w-3xl mx-auto mb-16">
                <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight">Packed with Powerful WhatsApp Marketing Features</h2>
                <p className="mt-4 text-base sm:text-lg text-gray-600">AISEND. launches latest WhatsApp API and AI Features at Blazing fast speed⚡</p>
              </div>
              <div className="space-y-20">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
                  <div className="order-2 lg:order-1">
                    <h3 className="text-2xl sm:text-3xl font-bold">Run AI powered Ads that Click to WhatsApp</h3>
                    <p className="mt-4 text-base text-gray-600 leading-relaxed">Run Ads on Facebook &amp; Instagram that land on WhatsApp. 5X Your lead generations &amp; 2-3X Conversions Instantly!</p>
                    <p className="mt-3 text-base text-gray-600 leading-relaxed">Run Ads from AISEND., get quality leads with AI &amp; conversions API, smartly segregate your leads and build Chatbot Flows to automate everything!</p>
                    <div className="mt-6">
                      <a className="inline-flex items-center text-[#00C675] hover:text-emerald-700 font-semibold text-base group" href="#">Explore <span className="ml-1 group-hover:translate-x-1 transition-transform">→</span></a>
                    </div>
                  </div>
                  <div className="order-1 lg:order-2 flex justify-center">
                    <ImageSlot alt="Click to WhatsApp Ads illustration" label="Click-to-WhatsApp ads" dimensions="800 × 700" variant="plain" />
                  </div>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
                  <div className="flex justify-center order-1">
                    <ImageSlot alt="WhatsApp Native Forms illustration" label="WhatsApp forms" dimensions="800 × 700" variant="plain" />
                  </div>
                  <div className="order-2">
                    <h3 className="text-2xl sm:text-3xl font-bold">Build WhatsApp Forms</h3>
                    <p className="mt-4 text-base text-gray-600 leading-relaxed">Capture Leads &amp; collect useful information <strong className="font-semibold">Directly in WhatsApp Chats</strong> with WhatsApp Forms.</p>
                    <p className="mt-3 text-base text-gray-600 leading-relaxed">From feedback to gathering user insights, collect it all on WhatsApp.</p>
                    <div className="mt-6">
                      <a className="inline-flex items-center text-[#00C675] hover:text-emerald-700 font-semibold text-base group" href="#">Explore <span className="ml-1 group-hover:translate-x-1 transition-transform">→</span></a>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
                  <div className="order-2 lg:order-1">
                    <h3 className="text-2xl sm:text-3xl font-bold">Collect Payments on WhatsApp</h3>
                    <p className="mt-4 text-base text-gray-600 leading-relaxed">Collect Payments now on WhatsApp seamlessly with WhatsApp Pay and other modes of payment (Razorpay, Payu etc) and grow your revenue.</p>
                    <div className="mt-6">
                      <a className="inline-flex items-center text-[#00C675] hover:text-emerald-700 font-semibold text-base group" href="#">Explore <span className="ml-1 group-hover:translate-x-1 transition-transform">→</span></a>
                    </div>
                  </div>
                  <div className="order-1 lg:order-2 flex justify-center">
                    <ImageSlot alt="WhatsApp Payments feature illustration" label="WhatsApp payments" dimensions="800 × 700" variant="plain" />
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Why WhatsApp metrics */}
          <section className="py-16 bg-white border-y border-gray-100">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
              <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight">Why WhatsApp?</h2>
              <p className="mt-3 text-base sm:text-lg text-gray-600 max-w-2xl mx-auto">WhatsApp is the One Platform that brings together Actionable Notifications &amp; Customer Support!</p>
              <div className="mt-12 grid grid-cols-2 md:grid-cols-4 gap-6 lg:gap-8">
                {METRICS.map((m) => (
                  <div key={m.label} className="p-6 rounded-2xl bg-gray-50 border border-gray-100 hover:border-emerald-200 transition-colors">
                    <div className="text-4xl sm:text-5xl font-extrabold text-gray-900">{m.n}</div>
                    <div className="mt-2 text-sm sm:text-base font-medium text-gray-600">{m.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Advanced features */}
          <section className="py-20 bg-gray-50/50">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="text-center max-w-3xl mx-auto mb-16">
                <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight">Advanced Features that Drive Conversions</h2>
                <p className="mt-3 text-base sm:text-lg text-gray-600">3X Your revenues using AISEND. Marketing Platform</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {ADVANCED_CARDS.map((c) => (
                  <div key={c.title} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col justify-between hover:shadow-md transition-shadow">
                    <div className="p-6 sm:p-8">
                      <h3 className="text-xl font-bold">{c.title}</h3>
                      {c.body.map((p) => (
                        <p key={p} className="mt-2 text-sm sm:text-base text-gray-600">{p}</p>
                      ))}
                    </div>
                    <div className="px-6 pb-6 pt-2 bg-gradient-to-b from-transparent to-gray-50 flex items-center justify-center">
                      <ImageSlot alt={c.alt} label={c.alt} dimensions="900 × 600" variant="flush" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Perks ticker */}
          <div className="bg-emerald-50/70 border-y border-emerald-100 overflow-hidden py-3 text-emerald-900 font-medium text-sm">
            <div className="animate-marquee whitespace-nowrap flex gap-8">
              {[...PERKS, ...PERKS].map((perk, i) => (
                <span key={`${perk}-${i}`} className="inline-flex items-center gap-2">
                  <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" /></svg>
                  {perk}
                </span>
              ))}
            </div>
          </div>

          {/* Testimonials */}
          <section className="py-20 bg-white">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="text-center max-w-3xl mx-auto">
                <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight">#1 WhatsApp Marketing &amp; Engagement Platform for startups &amp; growing businesses</h2>
                <div className="mt-8 flex flex-wrap items-center justify-center gap-3 sm:gap-4">
                  {G2_RIBBONS.map((r, i) => (
                    <div key={`${r.text}-${i}`} className={`border rounded-lg p-2 px-3 text-center text-xs font-bold ${r.tone}`}>{r.text}</div>
                  ))}
                </div>
              </div>
              <div className="mt-14 grid grid-cols-1 md:grid-cols-3 gap-8">
                {TESTIMONIALS.map((t) => (
                  <div key={t.name} className="bg-white p-7 rounded-2xl border border-gray-200 shadow-sm flex flex-col justify-between hover:border-emerald-300 transition-colors">
                    <div className="flex items-center gap-4 mb-5">
                      <div className={`w-14 h-14 rounded-full flex items-center justify-center font-bold text-lg overflow-hidden border-2 ${t.ring}`}>{t.initials}</div>
                      <div>
                        <h4 className="font-bold text-base">{t.name}</h4>
                        <p className="text-xs text-gray-500 font-medium">{t.role}</p>
                      </div>
                    </div>
                    <p className="text-gray-600 text-sm leading-relaxed italic">&quot;{t.quote}&quot;</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Pre-footer CTA */}
          <section className="py-16 bg-gray-50">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="bg-white rounded-3xl border border-gray-200 p-8 sm:p-12 lg:p-16 shadow-lg overflow-hidden grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
                <div className="lg:col-span-7">
                  <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight leading-tight">Start WhatsApp Marketing in 10 Minutes</h2>
                  <p className="mt-4 text-base sm:text-lg text-gray-600">AISEND. Platform is powered by Official Whatsapp Business APIs and is in alignment with all Whatsapp Rules.</p>
                  <div className="mt-8 space-y-4">
                    {PREFOOTER_ITEMS.map((item) => (
                      <div key={item.title} className="flex items-start">
                        <CheckCircleIcon d={item.d} />
                        <div className="ml-3">
                          <h4 className="font-bold text-base">{item.title}</h4>
                          <p className="text-sm text-gray-500">{item.body}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-8">
                    <Link className="inline-flex items-center justify-center bg-[#00C675] hover:bg-[#00ad66] text-[#fff] font-semibold text-base px-8 py-3.5 rounded-lg shadow transition-colors" href="/signup">
                      Start Now for FREE <span className="ml-2">→</span>
                    </Link>
                  </div>
                </div>
                <div className="lg:col-span-5 flex justify-center">
                  <ImageSlot alt="AISEND. Onboarding and Features Console" label="Onboarding console" dimensions="900 × 900" variant="plain" />
                </div>
              </div>
            </div>
          </section>

          {/* Multi-channel hub */}
          <section className="py-24 bg-white border-t border-gray-100 overflow-hidden">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
                <div className="lg:col-span-6 flex flex-col items-start">
                  <div className="inline-flex items-center gap-2 mb-4">
                    <span className="h-1 w-5 rounded-full bg-[#00C675]" />
                    <span className="text-xs font-bold uppercase tracking-widest text-[#00C675]">ONE INBOX</span>
                  </div>
                  <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight leading-[1.18]">WhatsApp first — and everywhere else your customers turn up</h2>
                  <p className="mt-5 text-base sm:text-lg text-gray-600 leading-relaxed">Start where the conversations already happen, then add the other channels when you&apos;re ready. They all land in the same inbox, with the same history and the same team.</p>
                  <div className="mt-8 space-y-4 w-full">
                    {HUB_CHECKS.map((c) => (
                      <div key={c.strong} className="flex items-start gap-3.5">
                        <div className="w-6 h-6 rounded-full bg-emerald-50 text-[#00C675] flex items-center justify-center font-bold text-sm flex-shrink-0 mt-0.5 border border-emerald-200">✓</div>
                        <p className="text-gray-700 text-sm sm:text-base leading-relaxed"><strong className="text-gray-900 font-semibold">{c.strong}</strong>{c.rest}</p>
                      </div>
                    ))}
                  </div>
                  <div className="mt-10">
                    <a className="inline-flex items-center justify-center bg-white hover:bg-gray-50 text-gray-800 font-semibold text-sm sm:text-base px-6 py-3 rounded-xl border border-gray-200 shadow-sm hover:border-emerald-300 transition-all duration-200" href="#">
                      See every channel <span className="ml-2 text-gray-400">→</span>
                    </a>
                  </div>
                </div>
                <div className="lg:col-span-6 flex justify-center items-center relative">
                  <div className="relative w-80 h-80 sm:w-96 sm:h-96 flex items-center justify-center">
                    <div className="absolute inset-0 rounded-full border border-emerald-100 bg-emerald-50/30" />
                    <div className="absolute inset-10 rounded-full border border-emerald-200/60 bg-emerald-50/50" />
                    <div className="absolute inset-20 rounded-full border border-emerald-200 bg-white/60 shadow-inner" />
                    <div className="relative z-10 w-24 h-24 rounded-full bg-gradient-to-tr from-[#00C675] to-[#25D366] text-[#fff] flex items-center justify-center shadow-xl shadow-emerald-500/25 border-4 border-white transform hover:scale-105 transition-transform">
                      <svg className="w-12 h-12 fill-current" viewBox="0 0 24 24"><path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z" /></svg>
                    </div>
                    {CHANNEL_NODES.map((n) => (
                      <div key={n.title} title={n.title} className={`absolute ${n.pos} w-12 h-12 bg-white rounded-2xl shadow-lg border border-gray-100 flex items-center justify-center hover:scale-110 transition-transform`}>
                        <svg className={`w-6 h-6 ${n.color}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d={n.d} strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" /></svg>
                      </div>
                    ))}
                    <div title="Instagram" className="absolute top-10 right-6 w-12 h-12 bg-white rounded-2xl shadow-lg border border-gray-100 flex items-center justify-center text-pink-600 hover:scale-110 transition-transform">
                      <svg className="w-6 h-6 fill-current" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" /></svg>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Personal campaigns */}
          <section className="py-24 bg-gray-50/60 border-t border-gray-100">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="max-w-3xl mb-12">
                <div className="inline-flex items-center gap-2 mb-4">
                  <span className="h-1 w-5 rounded-full bg-[#00C675]" />
                  <span className="text-xs font-bold uppercase tracking-widest text-[#00C675]">CAMPAIGNS</span>
                </div>
                <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight leading-tight">
                  Personal campaigns on <span className="text-[#00C675]">WhatsApp</span>, sent to thousands at once
                </h2>
                <p className="mt-4 text-base sm:text-lg text-gray-600 leading-relaxed">Write it once with the customer&apos;s name, order and city filled in automatically. Meta reviews the template, we handle the sending, and every reply lands back in your shared inbox.</p>
                <div className="mt-8 flex flex-wrap items-center gap-4">
                  <Link className="inline-flex items-center justify-center bg-[#00C675] hover:bg-[#00ad66] text-[#fff] font-semibold text-sm sm:text-base px-6 py-3.5 rounded-xl shadow-md transition-colors" href="/signup">Start free — no card</Link>
                  <Link className="inline-flex items-center justify-center bg-white hover:bg-gray-50 text-gray-800 font-semibold text-sm sm:text-base px-6 py-3.5 rounded-xl border border-gray-200 shadow-sm transition-colors" href="/contact">Book a 15-min demo</Link>
                </div>
              </div>
              <div className="rounded-3xl border border-gray-200 bg-white shadow-xl overflow-hidden p-3 sm:p-6">
                <div className="bg-gray-50 rounded-2xl border border-gray-100 p-4 sm:p-6 flex flex-col lg:flex-row gap-6 items-center justify-between">
                  <div className="w-full lg:w-1/2 space-y-4">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-semibold">
                      <span className="w-2 h-2 rounded-full bg-[#00C675]" /> Template Approved by Meta
                    </div>
                    <h3 className="text-xl font-bold">Personalised Flash Sale Broadcast</h3>
                    <div className="bg-white rounded-xl p-4 border border-gray-200 text-sm font-mono text-gray-700 space-y-2 shadow-sm">
                      <p className="text-xs text-gray-400">{'// Template with dynamic variable mapping'}</p>
                      <p>Hey <span className="bg-amber-100 text-amber-900 px-1 rounded">{'{{1: First Name}}'}</span>! 👋 We noticed you left <span className="bg-amber-100 text-amber-900 px-1 rounded">{'{{2: Product Name}}'}</span> in your cart.</p>
                      <p>Here is an exclusive 15% discount for you in <span className="bg-amber-100 text-amber-900 px-1 rounded">{'{{3: City}}'}</span>: code <span className="font-bold text-[#00C675]">WHATSAPP15</span>.</p>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-gray-500 font-medium pt-2">
                      {CAMPAIGN_STATS.map((s) => (
                        <span key={s} className="flex items-center gap-1"><span className="text-[#00C675]">✓</span> {s}</span>
                      ))}
                    </div>
                  </div>
                  <div className="w-full lg:w-1/2 flex justify-center">
                    <ImageSlot alt="Campaign builder interface" label="Campaign builder" dimensions="900 × 700" variant="plain" />
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* AI agents */}
          <section className="py-24 bg-white border-t border-gray-100">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="max-w-3xl mb-12">
                <div className="inline-flex items-center gap-2 mb-4">
                  <span className="h-1 w-5 rounded-full bg-[#00C675]" />
                  <span className="text-xs font-bold uppercase tracking-widest text-[#00C675]">AI AGENTS</span>
                </div>
                <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight leading-tight">An assistant for each part of the conversation</h2>
                <p className="mt-4 text-base sm:text-lg text-gray-600 leading-relaxed">Trained on your catalogue, your prices and your policies — so it answers like someone who works there, and hands over the moment a person is needed.</p>
              </div>
              <div className="border-b border-gray-200 mb-10 flex space-x-8 text-sm sm:text-base font-semibold">
                <button className="pb-4 text-[#00C675] border-b-2 border-[#00C675] flex items-center gap-2" type="button">Capturing leads</button>
                <button className="pb-4 text-gray-500 flex items-center gap-2" type="button">Helping people buy</button>
                <button className="pb-4 text-gray-500 flex items-center gap-2" type="button">After the order</button>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center bg-gray-50/70 p-8 sm:p-12 rounded-3xl border border-gray-200">
                <div className="lg:col-span-6 space-y-6">
                  <h3 className="text-2xl sm:text-3xl font-bold">Turns a first message into a qualified lead</h3>
                  <div className="space-y-4 pt-2">
                    {AGENT_TAB_CHECKS.map((c) => (
                      <div key={c} className="flex items-start gap-3">
                        <span className="text-[#00C675] font-bold text-base mt-0.5">✓</span>
                        <span className="text-gray-700 text-sm sm:text-base font-medium">{c}</span>
                      </div>
                    ))}
                  </div>
                  <div className="pt-4">
                    <a className="inline-flex items-center justify-center bg-white hover:bg-gray-100 text-gray-900 font-semibold text-sm sm:text-base px-6 py-3 rounded-xl border border-gray-300 shadow-sm transition-colors" href="#">See it in action <span className="ml-2">→</span></a>
                  </div>
                </div>
                <div className="lg:col-span-6 flex justify-center">
                  <div className="bg-white rounded-2xl border border-gray-200 shadow-lg p-5 max-w-md w-full space-y-4">
                    <div className="flex items-center gap-3 border-b border-gray-100 pb-3">
                      <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-[#00C675] font-bold">🤖</div>
                      <div>
                        <div className="text-sm font-bold">AISEND. LeadBot</div>
                        <div className="text-xs text-emerald-600 font-medium">Online • Instant Reply</div>
                      </div>
                    </div>
                    <div className="space-y-3 text-xs sm:text-sm">
                      <div className="bg-gray-100 text-gray-800 p-3 rounded-2xl rounded-tl-none max-w-[85%]">Hi there! Welcome to AISEND. How many contacts do you plan to message monthly?</div>
                      <div className="bg-[#00C675] text-[#fff] p-3 rounded-2xl rounded-tr-none ml-auto max-w-[80%]">Around 50,000 customers for our upcoming festive promotion.</div>
                      <div className="bg-gray-100 text-gray-800 p-3 rounded-2xl rounded-tl-none max-w-[85%]">Perfect! Based on your volume, you qualify for our Enterprise API tier with unlimited broadcast speed. Would you like to schedule a quick 10-minute demo today?</div>
                      <div className="flex gap-2 pt-2">
                        <button className="flex-1 bg-emerald-50 text-[#00C675] border border-emerald-200 py-2 rounded-lg font-semibold text-xs" type="button">📅 Book 2:30 PM Demo</button>
                        <button className="flex-1 bg-white text-gray-700 border border-gray-200 py-2 rounded-lg font-semibold text-xs" type="button">💬 Talk to Human</button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Video walkthrough */}
          <section className="py-24 bg-gray-50/50 border-t border-gray-100">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="max-w-3xl mb-12">
                <div className="inline-flex items-center gap-2 mb-4">
                  <span className="h-1 w-5 rounded-full bg-[#00C675]" />
                  <span className="text-xs font-bold uppercase tracking-widest text-[#00C675]">SEE IT WORKING</span>
                </div>
                <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight leading-tight">From a customer list to a sent broadcast, in one sitting</h2>
                <p className="mt-4 text-base sm:text-lg text-gray-600 leading-relaxed">A three-minute walkthrough: import contacts, pick an approved template, send, and watch replies land in the shared inbox.</p>
              </div>
              <div className="relative rounded-3xl bg-[#092b1f] border border-emerald-900/60 shadow-2xl overflow-hidden w-full aspect-[16/9] md:h-[500px] flex items-center justify-center p-6">
                <div className="absolute inset-0 bg-radial from-emerald-600/20 via-transparent to-transparent pointer-events-none" />
                <div className="relative z-10 flex flex-col items-center cursor-pointer group">
                  <div className="relative flex items-center justify-center w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-[#00C675] text-[#fff] shadow-2xl group-hover:scale-110 transition-transform duration-300">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#00C675] opacity-40" />
                    <svg className="w-8 h-8 sm:w-10 sm:h-10 ml-1 fill-current" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                  </div>
                  <div className="mt-4 text-center">
                    <div className="text-[#fff] font-bold text-base sm:text-lg">Product walkthrough</div>
                    <div className="text-emerald-300 text-xs sm:text-sm font-medium">Watch how AISEND. works in 3 minutes</div>
                  </div>
                </div>
                <div className="absolute bottom-4 right-4 sm:bottom-6 sm:right-6 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-lg text-xs font-mono text-[#fff] flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" /> 3:12
                </div>
              </div>
            </div>
          </section>

          {/* Industry trend reports */}
          <section className="py-24 bg-white border-t border-gray-100">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="text-center max-w-4xl mx-auto mb-16">
                <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight leading-tight">Search Trends &amp; Industry Benchmark Reports</h2>
                <p className="mt-4 text-base sm:text-lg text-gray-600 leading-relaxed max-w-3xl mx-auto">At AISEND., we frequently release trend reports for various industries that we work closely with. Our reports highlight evolving trends in customer behavior, top-ranking keywords and categories, search volumes, market insights, and a lot more. Our reports are the starting point for top brands towards creating a strong digital roadmap and presence.</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {REPORTS.map((r) => (
                  <div key={r.title} className="bg-white rounded-2xl border border-gray-200 p-6 flex flex-col justify-between shadow-sm hover:shadow-lg hover:border-emerald-300 transition-all duration-200 group">
                    <div>
                      <span className="inline-block px-3.5 py-1 rounded-full text-xs font-semibold bg-[#e8f4fc] text-[#0066A2] mb-5">{r.tag}</span>
                      <h3 className="text-xl font-bold group-hover:text-emerald-700 transition-colors leading-snug">{r.title}</h3>
                      <p className="mt-3 text-sm text-gray-500 leading-relaxed">{r.body}</p>
                    </div>
                    <div className="mt-8 pt-4 border-t border-gray-100 flex items-center justify-between">
                      <a className="inline-flex items-center text-sm font-bold text-[#0066A2] group-hover:text-[#00C675] transition-colors" href="#">Download PDF <span className="ml-1.5 group-hover:translate-x-1 transition-transform">→</span></a>
                      <span className="text-xs text-gray-400 font-medium">{r.pages}</span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-12 text-center">
                <a className="inline-flex items-center justify-center bg-amber-500 hover:bg-amber-600 text-[#fff] font-bold text-sm sm:text-base px-8 py-3.5 rounded-full shadow-md hover:shadow-lg transition-all duration-200 transform hover:-translate-y-0.5" href="#">View All <span className="ml-2">→</span></a>
              </div>
            </div>
          </section>

          {/* SEO growth banner */}
          <section className="py-16 bg-gray-50/60 border-t border-gray-100">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="bg-[#e8f4fc] rounded-3xl border border-blue-100 p-8 sm:p-12 lg:p-14 shadow-sm grid grid-cols-1 lg:grid-cols-12 gap-10 items-center overflow-hidden">
                <div className="lg:col-span-6 space-y-6">
                  <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight leading-tight">Search Engine Optimization &amp; Visibility</h2>
                  <p className="text-base sm:text-lg text-gray-700 leading-relaxed">Greater visibility. Higher rankings. Higher traffic. Better quality leads.</p>
                  <div>
                    <a className="inline-flex items-center justify-center bg-amber-500 hover:bg-amber-600 text-[#fff] font-bold text-sm sm:text-base px-8 py-3.5 rounded-full shadow-md hover:shadow-lg transition-all duration-200 transform hover:-translate-y-0.5" href="#">Discover SEO Services <span className="ml-2 font-bold">→</span></a>
                  </div>
                </div>
                <div className="lg:col-span-6 flex flex-col sm:flex-row items-center justify-end gap-6">
                  <div className="w-full sm:w-64 space-y-3">
                    {SEO_TABS.map((tab, i) => (
                      <div key={tab} className={i === 1 ? 'bg-[#0066A2] text-[#fff] px-4 py-3 rounded-xl shadow-md font-semibold text-sm flex items-center justify-between cursor-pointer' : 'bg-white/90 backdrop-blur-sm px-4 py-3 rounded-xl border border-blue-200 shadow-sm font-semibold text-gray-800 text-sm flex items-center justify-between hover:bg-white transition-colors cursor-pointer'}>
                        <span>{tab}</span>
                        <span className={i === 1 ? 'text-[#fff]' : 'text-[#0066A2]'}>→</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* FAQ */}
          <section className="py-20 bg-white">
            <div className="max-w-4xl mx-auto px-4 sm:px-6">
              <h2 className="text-3xl sm:text-4xl font-extrabold text-center tracking-tight mb-12">FAQ</h2>
              <div className="divide-y divide-gray-200 border-y border-gray-200">
                {FAQS.map((f) => (
                  <details key={f.q} className="group py-5 cursor-pointer">
                    <summary className="flex justify-between items-center font-semibold text-gray-900 text-base sm:text-lg list-none focus:outline-none">
                      <span>{f.q}</span>
                      <span className="transition group-open:rotate-180 text-gray-500">
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

        {/* Floating WhatsApp widget */}
        <aside aria-label="Customer Support Chat" className="fixed bottom-6 right-6 z-50">
          <a aria-label="Chat on WhatsApp" className="w-14 h-14 bg-[#25D366] hover:bg-[#20ba59] text-[#fff] rounded-full flex items-center justify-center shadow-xl hover:shadow-2xl transition-all duration-200 transform hover:scale-105" href="https://wa.me/918796437535">
            <svg className="w-8 h-8 fill-current" viewBox="0 0 24 24"><path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z" /></svg>
          </a>
        </aside>
      </div>
      <SiteFooter />
    </>
  )
}
