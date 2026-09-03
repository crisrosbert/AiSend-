import Link from 'next/link'
import './landing.css'
import { ImageSlot } from './image-slot'
import { AgentTabs } from './agent-tabs'
import { CapabilityAccordion } from './capability-accordion'

/**
 * AiSend — public marketing landing page.
 *
 * Static by default: this is a Server Component, so the whole page ships
 * as HTML with no JavaScript. Only the three genuinely interactive bits
 * (tabs, capability accordion, image slots) are Client Components.
 *
 * Every picture is an <ImageSlot>. To use a real image, pass `src` — the
 * dashed stand-in disappears on its own once one loads.
 *
 * Styling lives in ./landing.css, scoped under `.lp` so it cannot reach
 * the dashboard and so it outranks the global Sora heading rule.
 */

const MENU_PRODUCT = [
  { t: 'WhatsApp Business API', d: 'Get verified on the official API', href: '#', tone: '' },
  { t: 'Broadcast campaigns', d: 'Reach every opted-in contact at once', href: '#', tone: '' },
  { t: 'Shared team inbox', d: 'Every chat, assigned to a real person', href: '#', tone: 'teal' },
  { t: 'Template manager', d: 'Draft, submit and track Meta approvals', href: '#', tone: 'teal' },
  { t: 'Payments in chat', d: 'Send a secure link, get paid in the thread', href: '#', tone: '' },
  { t: 'Automations', d: 'Auto-replies, away hours and follow-ups', href: '#', tone: '' },
  { t: 'Analytics', d: 'See which campaign actually earned', href: '#', tone: 'amber' },
  { t: 'Free WhatsApp tools', d: 'Link, QR and message formatter', href: '/tools', tone: 'amber' },
]

const MENU_INDUSTRIES = [
  { t: 'D2C & retail', d: 'Drops, carts and order updates', tone: '' },
  { t: 'Clinics & wellness', d: 'Appointments and reminders', tone: 'teal' },
  { t: 'Coaching & institutes', d: 'Batches, fees and parent updates', tone: 'amber' },
  { t: 'Real estate', d: 'Site visits and lead follow-ups', tone: '' },
]

const FEATURES = [
  { t: 'Bulk broadcasts', d: 'Send an approved campaign to thousands of opted-in contacts at once, segmented by tag, city or last order.' },
  { t: 'Smart automations', d: 'Abandoned-cart nudges, delivery updates and welcome flows fire on their own — no one has to remember.' },
  { t: 'Payments in chat', d: 'Drop a secure payment link into the conversation and let customers pay without leaving the thread.' },
  { t: 'Template library', d: "Pre-written message templates by category, built to clear Meta's review the first time you submit them." },
  { t: 'Team inbox', d: 'Your whole team answers from one number, with assignment, internal notes and no shared password.' },
  { t: 'Live analytics', d: 'Delivered, read, replied and revenue per campaign — so you know which message actually paid for itself.' },
]

const STATS = [
  { n: '98%', l: 'of WhatsApp messages get opened, usually within minutes of arriving.' },
  { n: '45×', l: 'higher reply rate than a marketing email sent to the same list.' },
  { n: '24h', l: 'service window after any customer message — reply freely, no template needed.' },
]

const MORE = [
  { t: 'Keep using your phone', d: 'Run the same number on the app and here at once — the team answers from the dashboard, you answer from your pocket.', tone: '' },
  { t: 'Assistant trained on you', d: 'Point it at your website, price list or a PDF and it answers from that — not from whatever it guessed.', tone: 'teal' },
  { t: 'Fast broadcasting', d: "The full send rate the official API allows, so a campaign to fifty thousand people doesn't trickle out all afternoon.", tone: '' },
  { t: 'Live reporting', d: 'Delivered, read, replied and earned — updating while the campaign is still going out, not the next morning.', tone: 'amber' },
  { t: 'Drip sequences', d: 'A series of messages spaced over days, so a quiet lead gets a nudge without anyone setting a reminder.', tone: 'teal' },
  { t: 'Step-by-step questions', d: 'Collect a name, a pincode and a preferred slot one question at a time, the way a person would ask.', tone: '' },
  { t: 'Native forms', d: 'A real form inside WhatsApp — no redirect to a website where half the people drop off.', tone: 'amber' },
  { t: 'Automatic routing', d: 'Send billing questions to accounts and sizing questions to the shop floor, by rules you set once.', tone: 'teal' },
  { t: 'Number masking', d: "Agents can answer a conversation without ever seeing the customer's personal phone number.", tone: '' },
  { t: 'Custom fields', d: 'Store the things that matter to your business — plan, renewal date, last size ordered — not just a name.', tone: 'amber' },
  { t: 'Segments', d: 'Message the people who bought last month, or never opened anything — targeted sends beat blasting the list.', tone: 'teal' },
  { t: 'API and webhooks', d: 'Send messages and sync contacts from your own store or CRM, and get a webhook back when something happens.', tone: '' },
]

const QUOTES = [
  { txt: "We used to post a drop on Instagram and wait. Now the broadcast goes out and the first orders land before I've finished my chai.", nm: 'Ritika Mehra', co: 'Founder · Studio Vaani', av: 'RM' },
  { txt: 'Appointment reminders on WhatsApp cut our no-shows by more than half. That alone paid for the year.', nm: 'Dr. Anand Kulkarni', co: 'Kora Clinics', av: 'AK' },
  { txt: 'Four people answering one number, and nothing falls through. Before this we were forwarding screenshots to each other.', nm: 'Sana Nadeem', co: 'Northbay Foods', av: 'SN' },
]

const STEPS = [
  { n: 'STEP 01', t: 'Connect your number', d: "Use a number that isn't on the WhatsApp app today. We'll walk you through the Meta business verification." },
  { n: 'STEP 02', t: 'We set you up', d: 'Templates submitted, contacts imported, team invited. Most accounts are sending on the same day.' },
  { n: 'STEP 03', t: 'Broadcast and sell', d: 'Send your first campaign, answer the replies in the shared inbox, take payment in the same thread.' },
]

const PLANS = [
  {
    nm: 'Starter', pr: '₹0', d: 'For trying it properly — runs on your own number with a 100-contact limit.',
    feats: ['Up to 100 contacts', '1 team member', 'Basic templates'],
    cta: 'Start free', href: '/signup', highlight: false,
  },
  {
    nm: 'Growth', pr: '₹999', d: 'The official API, unlimited contacts, and the whole team in one inbox.',
    feats: ['Unlimited contacts', 'Unlimited team members', 'Automations & payments in chat', 'Green tick application support'],
    cta: 'Choose Growth', href: '/signup', highlight: true,
  },
  {
    nm: 'Scale', pr: '₹2,499', d: 'For teams sending at volume — with an API, roles, and someone who picks up the phone.',
    feats: ['Everything in Growth', 'Multiple WhatsApp numbers', 'Developer API & webhooks', 'Roles, permissions & audit log', 'Dedicated account manager'],
    cta: 'Talk to sales', href: '/contact', highlight: false,
  },
]

const FAQS = [
  { q: 'Is this the official WhatsApp Business API?', a: "Yes. AiSend is built on Meta's official WhatsApp Business Platform, so your number is verified, your templates go through Meta's review, and there's no automation of the consumer WhatsApp app — which is what gets numbers banned." },
  { q: 'Can I use my existing WhatsApp number?', a: "Only if it isn't currently active on the WhatsApp or WhatsApp Business app. A number can live on one or the other, not both. Most businesses move to a fresh number, and we help you migrate the conversations that matter." },
  { q: 'Is there really a free plan?', a: "Yes — Starter is ₹0 per month, runs on your own number, and is capped at 100 contacts. It's meant to be enough to see whether this fits how you sell, not a seven-day trial that expires before you've set it up." },
  { q: 'What does a message actually cost?', a: 'Meta bills per conversation by category: ₹1.09 for marketing, ₹0.145 for utility and authentication. We pass that through at cost. When a customer messages you first, you can reply free for 24 hours.' },
  { q: 'How many messages can I broadcast in a day?', a: "New numbers start at 1,000 unique customers per day. That tier rises automatically as you send quality messages people don't block — up to 10,000, 100,000, and eventually unlimited." },
  { q: 'Will I get the green tick?', a: "The green tick is Meta's decision, not ours, and it depends on how notable your brand is online. We prepare and submit the application with you, and plenty of accounts get it on the second attempt after we fix the supporting links." },
  { q: 'How do you handle support?', a: 'On WhatsApp, naturally — same number, real people, and an onboarding call in the first week. Growth accounts get help with template rejections and verification for as long as it takes.' },
]

function Tick({ size = 17, style }: { size?: number; style?: React.CSSProperties }) {
  return (
    <svg className="tick" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" style={style}>
      <path d="M20 6 9 17l-5-5" />
    </svg>
  )
}

function Caret() {
  return (
    <svg className="nav__caret" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
      <path d="m6 9 6 6 6-6" />
    </svg>
  )
}

function Mark() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.4A10 10 0 1 0 12 2Zm5.3 14.1c-.2.6-1.2 1.2-1.7 1.2-.4 0-1 .1-3-.8a11 11 0 0 1-4.5-4c-.3-.5-1-1.5-1-2.9s.7-2 1-2.3c.2-.3.5-.3.7-.3h.5c.2 0 .4 0 .6.5l.8 2c.1.2.1.4 0 .5l-.3.5-.4.4c-.1.2-.3.3-.1.6a9 9 0 0 0 4 3.4c.3.2.5.1.6 0l1-1.2c.2-.2.4-.2.6-.1l2 1c.2 0 .3.2.3.3v.2c0 .3 0 .7-.1 1Z" />
    </svg>
  )
}

/** Generic glyph for the channel ring — swap for real brand marks later. */
function RingBadge({ cx, cy, r, drift, children }: { cx: number; cy: number; r: number; drift: string; children: React.ReactNode }) {
  return (
    <g className={`ring__badge ring__badge--${drift}`}>
      <circle cx={cx} cy={cy} r={r} fill="var(--surface)" stroke="var(--line)" />
      <g transform={`translate(${cx} ${cy})`} strokeWidth="2" fill="none">
        {children}
      </g>
    </g>
  )
}

export default function LandingPage() {
  const year = new Date().getFullYear()

  return (
    <div className="lp">
      <div className="promo">
        <span className="tag">New</span>
        <span>
          <b>Click-to-WhatsApp ads</b> now connect straight to your inbox.
        </span>
        <a href="#">See what changed</a>
      </div>

      <header className="hdr">
        <div className="wrap hdr__in">
          <Link className="logo" href="/">
            <span className="logo__mark" aria-hidden="true">
              <Mark />
            </span>
            AiSend
          </Link>

          <nav className="nav">
            {/* opens on hover and on keyboard focus — no JavaScript */}
            <div className="nav__item">
              <button className="nav__trigger" aria-expanded="false" aria-haspopup="true">
                Product
                <Caret />
              </button>
              <div className="menu menu--wide" role="menu">
                {MENU_PRODUCT.map((m) => (
                  <Link className="menu__row" href={m.href} role="menuitem" key={m.t}>
                    <span className={`menu__ico${m.tone ? ` menu__ico--${m.tone}` : ''}`}>
                      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="3" y="4" width="18" height="14" rx="2" />
                        <path d="m3 8 9 5 9-5" />
                      </svg>
                    </span>
                    <span>
                      <b className="menu__t">{m.t}</b>
                      <em className="menu__d">{m.d}</em>
                    </span>
                  </Link>
                ))}
                <div className="menu__foot">
                  <span>Not sure where to start? We&apos;ll set it up with you.</span>
                  <Link href="/contact">Book a demo →</Link>
                </div>
              </div>
            </div>

            <div className="nav__item">
              <button className="nav__trigger" aria-expanded="false" aria-haspopup="true">
                Industries
                <Caret />
              </button>
              <div className="menu menu--single" role="menu">
                {MENU_INDUSTRIES.map((m) => (
                  <a className="menu__row" href="#" role="menuitem" key={m.t}>
                    <span className={`menu__ico${m.tone ? ` menu__ico--${m.tone}` : ''}`}>
                      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
                        <path d="M3 6h18M16 10a4 4 0 0 1-8 0" />
                      </svg>
                    </span>
                    <span>
                      <b className="menu__t">{m.t}</b>
                      <em className="menu__d">{m.d}</em>
                    </span>
                  </a>
                ))}
              </div>
            </div>

            <a href="#pricing">Pricing</a>
            <Link href="/tools">Free tools</Link>
            <a href="#faq">FAQ</a>
          </nav>

          <div className="hdr__cta">
            <Link className="linklike" href="/login">
              Sign in
            </Link>
            <Link className="btn btn--primary" href="/signup">
              Start free
            </Link>
          </div>
        </div>
      </header>

      <main>
        {/* ---------------- hero ---------------- */}
        <section className="hero">
          <div className="wrap hero__grid">
            <div>
              <p className="eyebrow">Official WhatsApp Business API</p>
              <h1>
                Sell on the app your customers <em>already have open</em>.
              </h1>
              <p className="lede">
                AiSend puts your broadcasts, order updates, payments and support in one WhatsApp
                inbox — on a verified business number, with templates Meta actually approves.
              </p>
              <div className="hero__cta">
                <Link className="btn btn--primary btn--lg" href="/signup">
                  Start free — no card
                </Link>
                <Link className="btn btn--ghost btn--lg" href="/contact">
                  Book a 15-min demo
                </Link>
              </div>
              <div className="hero__trust">
                <span>
                  <Tick size={15} /> Green tick verification support
                </span>
                <span>
                  <Tick size={15} /> Live in 10 minutes
                </span>
                <span>
                  <Tick size={15} /> No setup fee
                </span>
              </div>
            </div>

            <ImageSlot
              label="Hero image"
              dimensions="1200 × 900 · PNG, JPG or WebP"
              alt="AiSend in use — an automation flow and the WhatsApp chat it sends"
              minHeight={320}
            />
          </div>

          <div className="wrap strip">
            <p className="strip__label">
              Trusted by growing D2C brands, clinics and institutes across India
            </p>
            <div className="strip__row">
              {['Meridian Retail', 'Kora Clinics', 'Northbay Foods', 'Studio Vaani', 'Peak Tutorials', 'Anvi Living'].map((c) => (
                <span className="clogo" key={c}>
                  {c}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* ---------------- dashboard band ---------------- */}
        <section className="shot">
          <div className="wrap shot__in">
            <div>
              <p className="eyebrow">One dashboard</p>
              <h2>Every campaign, chat and rupee in a single screen</h2>
              <p className="shot__lede">
                Stop stitching together a spreadsheet, a personal phone and three people forwarding
                screenshots. It all lives in one place your whole team can open.
              </p>
              <ul className="shot__pts">
                <li>
                  <Tick /> See delivered, read and replied counts as a broadcast goes out
                </li>
                <li>
                  <Tick /> Assign a chat to a teammate so nobody answers twice
                </li>
                <li>
                  <Tick /> Track revenue back to the exact message that started it
                </li>
              </ul>
              <div className="shot__cta">
                <Link className="btn btn--primary btn--lg" href="/signup">
                  Start free — no card
                </Link>
                <Link className="btn btn--ghost btn--lg" href="/contact">
                  See a live demo
                </Link>
              </div>
            </div>

            <div className="shot__media">
              <ImageSlot
                label="Dashboard image"
                dimensions="1600 × 1000 · PNG, JPG or WebP"
                alt="The AiSend dashboard"
                variant="bleed"
                minHeight={340}
              />
            </div>
          </div>
        </section>

        {/* ---------------- video ---------------- */}
        <section className="sec sec--tight">
          <div className="wrap">
            <div className="sec__head sec__head--center">
              <p className="eyebrow eyebrow--center">See it working</p>
              <h2>From a customer list to a sent broadcast, in one sitting</h2>
              <p className="lede">
                A three-minute walkthrough: import contacts, pick an approved template, send, and
                watch replies land in the shared inbox.
              </p>
            </div>

            {/*
              To use a real video, replace this whole block with:
              <div className="video">
                <iframe src="https://www.youtube-nocookie.com/embed/VIDEO_ID"
                  title="Product walkthrough" allowFullScreen loading="lazy"
                  style={{ width: '100%', height: '100%', border: 0 }} />
              </div>
            */}
            <div className="video">
              <div className="video__poster" />
              <div className="video__inner">
                <div className="video__play">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M8 5v14l11-7-11-7Z" />
                  </svg>
                </div>
                <div className="video__ttl">Product walkthrough</div>
                <div className="video__sub">Paste your YouTube embed here</div>
              </div>
              <span className="video__len num">3:12</span>
            </div>
          </div>
        </section>

        {/* ---------------- features ---------------- */}
        <section className="sec" id="features">
          <div className="wrap">
            <div className="sec__head">
              <p className="eyebrow">The platform</p>
              <h2>Everything you need to run a business on WhatsApp</h2>
              <p className="lede">Six tools that each do a real job — not a wall of feature names.</p>
            </div>

            <div className="feats">
              {FEATURES.map((f) => (
                <div className="feat" key={f.t}>
                  <span className="feat__ico">
                    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M3 11v2a1 1 0 0 0 1 1h3l5 4V6L7 10H4a1 1 0 0 0-1 1Z" />
                      <path d="M16 9a4 4 0 0 1 0 6" />
                    </svg>
                  </span>
                  <h3>{f.t}</h3>
                  <p>{f.d}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ---------------- AI agents (interactive) ---------------- */}
        <section className="sec sec--tight" id="agents">
          <div className="wrap">
            <div className="sec__head">
              <p className="eyebrow">AI agents</p>
              <h2>An assistant for each part of the conversation</h2>
              <p className="lede">
                Trained on your catalogue, your prices and your policies — so it answers like someone
                who works there, and hands over the moment a person is needed.
              </p>
            </div>
            <AgentTabs />
          </div>
        </section>

        {/* ---------------- stats ---------------- */}
        <section className="band" id="why">
          <div className="wrap">
            <div className="sec__head">
              <p className="eyebrow">Why WhatsApp</p>
              <h2>Email gets ignored. WhatsApp gets answered.</h2>
              <p className="lede">
                Your customer already checks this app forty times a day. You don&apos;t have to teach
                them anything new, ask them to install something, or hope your message clears a spam
                filter.
              </p>
            </div>
            <div className="stats">
              {STATS.map((s) => (
                <div className="stat" key={s.n}>
                  <div className="stat__n num">{s.n}</div>
                  <p className="stat__l">{s.l}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ---------------- campaigns ---------------- */}
        <section className="stage">
          <div className="wrap stage__in">
            <p className="eyebrow eyebrow--center">Campaigns</p>
            <h2>
              Personal campaigns on <em>WhatsApp</em>, sent to thousands at once
            </h2>
            <p className="stage__lede">
              Write it once with the customer&apos;s name, order and city filled in automatically.
              Meta reviews the template, we handle the sending, and every reply lands back in your
              shared inbox.
            </p>
            <div className="stage__cta">
              <Link className="btn btn--primary btn--lg" href="/signup">
                Start free — no card
              </Link>
              <Link className="btn btn--ghost btn--lg" href="/contact">
                Book a 15-min demo
              </Link>
            </div>

            <div className="stage__scene">
              <ImageSlot
                label="Campaign scene image"
                dimensions="1600 × 620 · PNG, JPG or WebP"
                alt="Campaign messages arriving on a phone"
                variant="plain"
                minHeight={360}
              />
            </div>
          </div>
        </section>

        {/* ---------------- capabilities (interactive) ---------------- */}
        <section className="sec" id="capabilities">
          <div className="wrap">
            <div className="sec__head">
              <p className="eyebrow">What you can send</p>
              <h2>Far more than a plain text message</h2>
              <p className="lede">
                WhatsApp supports buttons, forms, catalogues and payments natively. Pick a capability
                to see how it looks on the customer&apos;s phone.
              </p>
            </div>
            <CapabilityAccordion />
          </div>
        </section>

        {/* ---------------- one inbox ---------------- */}
        <section className="sec sec--tight">
          <div className="wrap ring__grid">
            <div>
              <p className="eyebrow">One inbox</p>
              <h2>WhatsApp first — and everywhere else your customers turn up</h2>
              <p className="lede" style={{ marginTop: 16 }}>
                Start where the conversations already happen, then add the other channels when
                you&apos;re ready. They all land in the same inbox, with the same history and the
                same team.
              </p>
              <ul className="ring__pts">
                <li>
                  <Tick />
                  <span>
                    <b>One thread per customer</b>, no matter which channel they used last.
                  </span>
                </li>
                <li>
                  <Tick />
                  <span>
                    <b>The same saved replies</b> and the same assistant across all of them.
                  </span>
                </li>
                <li>
                  <Tick />
                  <span>
                    <b>Reporting that adds up</b>, instead of five dashboards that disagree.
                  </span>
                </li>
              </ul>
              <Link className="btn btn--ghost" href="/contact" style={{ marginTop: 26 }}>
                See every channel
              </Link>
            </div>

            <div className="ring" role="img" aria-label="WhatsApp at the centre of a ring of other messaging channels">
              <svg className="ring__svg" viewBox="0 0 480 480" fill="none">
                <circle cx="240" cy="240" r="175" stroke="var(--line-strong)" strokeWidth="1.5" />
                <circle className="ring__pulse" cx="240" cy="240" r="125" fill="var(--accent)" opacity=".13" />
                <circle className="ring__pulse ring__pulse--2" cx="240" cy="240" r="100" fill="var(--accent)" opacity=".1" />
                <circle className="ring__pulse ring__pulse--3" cx="240" cy="240" r="75" fill="var(--accent)" opacity=".08" />

                <circle cx="240" cy="240" r="46" fill="var(--surface)" />
                <g transform="translate(240 240)">
                  <path
                    transform="translate(-23 -23) scale(1.92)"
                    fill="#25D366"
                    d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.4A10 10 0 1 0 12 2Zm5.3 14.1c-.2.6-1.2 1.2-1.7 1.2-.4 0-1 .1-3-.8a11 11 0 0 1-4.5-4c-.3-.5-1-1.5-1-2.9s.7-2 1-2.3c.2-.3.5-.3.7-.3h.5c.2 0 .4 0 .6.5l.8 2c.1.2.1.4 0 .5l-.3.5-.4.4c-.1.2-.3.3-.1.6a9 9 0 0 0 4 3.4c.3.2.5.1.6 0l1-1.2c.2-.2.4-.2.6-.1l2 1c.2 0 .3.2.3.3v.2c0 .3 0 .7-.1 1Z"
                  />
                </g>

                <RingBadge cx={240} cy={66} r={34} drift="y">
                  <g stroke="#7C5CFF">
                    <rect x="-13" y="-11" width="26" height="20" rx="4" />
                    <path d="m-13 -7 13 8 13-8" />
                  </g>
                </RingBadge>
                <RingBadge cx={414} cy={240} r={34} drift="x">
                  <g stroke="#E5486B">
                    <rect x="-12" y="-13" width="24" height="26" rx="7" />
                    <circle cx="0" cy="0" r="6" />
                  </g>
                </RingBadge>
                <RingBadge cx={240} cy={414} r={34} drift="y2">
                  <g stroke="#1479C9">
                    <path d="M-12-12h24v18a2 2 0 0 1-2 2H-4l-8 6Z" />
                    <path d="M-6-4h12M-6 1h7" />
                  </g>
                </RingBadge>
                <RingBadge cx={66} cy={240} r={34} drift="x2">
                  <g stroke="var(--accent-press)">
                    <path d="M-12-9a2 2 0 0 1 2-2h4l2 5-3 2a13 13 0 0 0 7 7l2-3 5 2v4a2 2 0 0 1-2 2A20 20 0 0 1-12-9Z" />
                  </g>
                </RingBadge>
                <RingBadge cx={363} cy={117} r={30} drift="y">
                  <g stroke="#B7791F">
                    <path d="M-11-6 0-11l11 5v9a11 11 0 0 1-22 0Z" />
                    <path d="M-4 0h8" />
                  </g>
                </RingBadge>
                <RingBadge cx={117} cy={363} r={30} drift="x">
                  <g stroke="#0E9A59">
                    <circle cx="0" cy="0" r="11" />
                    <path d="M-11 0h22M0-11a17 17 0 0 1 0 22a17 17 0 0 1 0-22" />
                  </g>
                </RingBadge>
                <RingBadge cx={363} cy={363} r={30} drift="y2">
                  <g stroke="#5A6570">
                    <path d="M-10-8h20v16h-20z" />
                    <path d="m-10-8 10 7 10-7" />
                  </g>
                </RingBadge>
                <RingBadge cx={117} cy={117} r={30} drift="x2">
                  <g stroke="#7C5CFF">
                    <circle cx="0" cy="-3" r="5" />
                    <path d="M-9 9a9 9 0 0 1 18 0" />
                  </g>
                </RingBadge>
              </svg>
            </div>
          </div>
        </section>

        {/* ---------------- more features ---------------- */}
        <section className="sec" id="more">
          <div className="wrap">
            <div className="sec__head sec__head--center">
              <p className="eyebrow eyebrow--center">More features</p>
              <h2>Smarter WhatsApp marketing, made simple</h2>
              <p className="lede">
                The smaller things that decide whether this actually works on a busy Tuesday.
              </p>
            </div>

            <div className="mfeat">
              {MORE.map((m) => (
                <div className="mcard" key={m.t}>
                  <span className={`mcard__ico${m.tone ? ` mcard__ico--${m.tone}` : ''}`}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="3" y="5" width="18" height="14" rx="3" />
                      <path d="M7 10h4M7 14h8" />
                    </svg>
                  </span>
                  <h3>{m.t}</h3>
                  <p>{m.d}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ---------------- testimonials ---------------- */}
        <section className="sec sec--tight">
          <div className="wrap">
            <div className="sec__head sec__head--center">
              <p className="eyebrow eyebrow--center">In their words</p>
              <h2>Founders who stopped chasing customers on email</h2>
            </div>
            <div className="quotes">
              {QUOTES.map((q) => (
                <div className="quote" key={q.nm}>
                  <div className="stars" aria-label="5 out of 5">
                    ★★★★★
                  </div>
                  <p className="quote__txt">&ldquo;{q.txt}&rdquo;</p>
                  <div className="quote__who">
                    <span className="quote__av">{q.av}</span>
                    <div>
                      <div className="quote__nm">{q.nm}</div>
                      <div className="quote__co">{q.co}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ---------------- steps ---------------- */}
        <section className="sec sec--tight">
          <div className="wrap">
            <div className="sec__head">
              <p className="eyebrow">Getting started</p>
              <h2>Live by this evening</h2>
              <p className="lede">Three steps, and nothing for your customers to install.</p>
            </div>
            <div className="steps">
              {STEPS.map((s) => (
                <div className="step" key={s.n}>
                  <div className="step__n num">{s.n}</div>
                  <h3>{s.t}</h3>
                  <p>{s.d}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ---------------- pricing ---------------- */}
        <section className="sec" id="pricing">
          <div className="wrap">
            <div className="sec__head">
              <p className="eyebrow">Pricing</p>
              <h2>Start free. Pay as you grow.</h2>
              <p className="lede">
                Platform fee is what you see here. WhatsApp&apos;s own per-message charge is billed
                at cost, with no markup from us.
              </p>
            </div>

            <div className="plans">
              {PLANS.map((p) => (
                <div className={`plan${p.highlight ? ' plan--hi' : ''}`} key={p.nm}>
                  {p.highlight && <span className="plan__tag">Most popular</span>}
                  <div className="plan__nm">{p.nm}</div>
                  <div className="plan__pr num">
                    {p.pr}
                    <small> /month</small>
                  </div>
                  <p className="plan__d">{p.d}</p>
                  <ul>
                    {p.feats.map((f) => (
                      <li key={f}>
                        <Tick size={16} style={{ marginTop: 2, flex: 'none' }} />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <Link className={`btn ${p.highlight ? 'btn--primary' : 'btn--ghost'}`} href={p.href}>
                    {p.cta}
                  </Link>
                </div>
              ))}
            </div>

            <p className="rates">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginTop: 3, flex: 'none', color: 'var(--muted)' }}>
                <circle cx="12" cy="12" r="9" />
                <path d="M12 11v5M12 8h.01" />
              </svg>
              <span>
                Meta charges per conversation on top: <b>₹1.09</b> for a marketing message and{' '}
                <b>₹0.145</b> for a utility or authentication message. Replies inside the 24-hour
                service window are free.
              </span>
            </p>
          </div>
        </section>

        {/* ---------------- faq ---------------- */}
        <section className="sec sec--tight" id="faq">
          <div className="wrap">
            <div className="sec__head">
              <p className="eyebrow">Questions</p>
              <h2>What people ask before signing up</h2>
            </div>

            <div className="faq__grid">
              <div className="faq">
                {FAQS.map((f, i) => (
                  <details key={f.q} open={i === 0}>
                    <summary>{f.q}</summary>
                    <p>{f.a}</p>
                  </details>
                ))}
              </div>

              <aside className="faq__aside">
                <div className="aside__card">
                  <ImageSlot
                    label="Support image"
                    dimensions="800 × 640 · PNG, JPG or WebP"
                    alt="Our support team"
                    variant="flush"
                  />
                  <div className="aside__body">
                    <h3>Still have a question?</h3>
                    <p>
                      Message us on WhatsApp and a real person from the team answers — usually within
                      a few minutes during business hours.
                    </p>
                    <Link className="btn btn--primary" href="/contact">
                      Chat with us
                    </Link>
                    <div className="aside__meta">
                      <span className="aside__dot" aria-hidden="true" />
                      Mon–Sat, 10am–7pm IST
                    </div>
                  </div>
                </div>
              </aside>
            </div>
          </div>
        </section>

        {/* ---------------- closing ---------------- */}
        <section className="wrap">
          <div className="close">
            <div className="close__in">
              <h2>Your customers are already on WhatsApp.</h2>
              <p>Go live in ten minutes. No setup fee, no card, and nothing for them to download.</p>
              <div className="close__cta">
                <Link className="btn btn--primary btn--lg" href="/signup">
                  Start free
                </Link>
                <Link className="btn btn--ghost btn--lg" href="/contact">
                  Talk to us on WhatsApp
                </Link>
              </div>
              <p className="close__fine">
                Free plan · 100 contacts · upgrade whenever you outgrow it
              </p>
            </div>
          </div>
        </section>
      </main>

      <footer className="ftr">
        <div className="wrap">
          <div className="ftr__grid">
            <div>
              <Link className="logo" href="/">
                <span className="logo__mark" aria-hidden="true">
                  <Mark />
                </span>
                AiSend
              </Link>
              <p className="ftr__about">
                WhatsApp marketing, support and payments for businesses that would rather have a
                conversation than send another email.
              </p>
            </div>
            <div>
              <h4>Platform</h4>
              <ul>
                <li><a href="#features">Features</a></li>
                <li><a href="#pricing">Pricing</a></li>
                <li><a href="#capabilities">What you can send</a></li>
                <li><a href="#agents">AI agents</a></li>
              </ul>
            </div>
            <div>
              <h4>Free tools</h4>
              <ul>
                <li><Link href="/tools/whatsapp-link-generator">Link generator</Link></li>
                <li><Link href="/tools/whatsapp-qr-code">QR code maker</Link></li>
                <li><Link href="/tools/whatsapp-text-formatter">Text formatter</Link></li>
                <li><Link href="/tools">All tools</Link></li>
              </ul>
            </div>
            <div>
              <h4>Company</h4>
              <ul>
                <li><Link href="/contact">Contact</Link></li>
                <li><Link href="/login">Sign in</Link></li>
                <li><Link href="/signup">Start free</Link></li>
              </ul>
            </div>
            <div>
              <h4>Legal</h4>
              <ul>
                <li><Link href="/privacy">Privacy</Link></li>
                <li><Link href="/terms">Terms</Link></li>
                <li><Link href="/data-deletion">Data deletion</Link></li>
              </ul>
            </div>
          </div>
          <div className="ftr__bot">
            <span>© {year} AiSend — a WE3 Media product.</span>
            <span>
              WhatsApp is a trademark of Meta Platforms, Inc. AiSend is an independent product.
            </span>
          </div>
        </div>
      </footer>
    </div>
  )
}
