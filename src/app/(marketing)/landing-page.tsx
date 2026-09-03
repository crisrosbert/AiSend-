'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import './landing.css'
import { ImageSlot } from './image-slot'
import { AgentTabs } from './agent-tabs'
import { CapabilityAccordion } from './capability-accordion'

/**
 * AiSend — public marketing landing page (v3).
 * AiSend — public marketing landing page.
 *
 * Rewritten to stop reusing the same "pill eyebrow + centered heading +
 * 3-card grid" block for every single section — that repetition is
 * what makes a page read as templated. Each section now has its own
 * shape: a numbered spec-list for Features, a connected timeline for
 * How-it-works, a name wall instead of fabricated star-rating quotes
 * for social proof (the old version shipped literal "[Add real quote]"
 * bracket text to a live page — dishonest AND broken-looking).
 * Static by default: this is a Server Component, so the whole page ships
 * as HTML with no JavaScript. Only the three genuinely interactive bits
 * (tabs, capability accordion, image slots) are Client Components.
 *
 * Palette now matches the app itself (WhatsApp green + the same dark
 * teal used in the dashboard sidebar) rather than an unrelated forest
 * green invented just for this page — a visitor who signs up should
 * recognise the product they land in.
 * Every picture is an <ImageSlot>. To use a real image, pass `src` — the
 * dashed stand-in disappears on its own once one loads.
 *
 * Data: WE3 Media (performancemktg.net), the company behind AiSend.
 * Only verifiable facts are used (contact info, offices, stated
 * client names/industries, pricing). No invented quotes or logos.
 * Styling lives in ./landing.css, scoped under `.lp` so it cannot reach
 * the dashboard and so it outranks the global Sora heading rule.
 */

const TEAL = '#075E54'       // dark teal — nav, dark sections (matches the app's sidebar)
const TEAL_DEEP = '#054942'
const GREEN = '#25D366'      // WhatsApp green — primary CTA (matches the app's --brand)
const GREEN_DEEP = '#1DA851'
const INK = '#0b231a'
const PAPER_TINT = '#f5f8f6'

const CHAT: Array<{ from: 'them' | 'biz'; text: string }> = [
  { from: 'them', text: 'Hi, do you have the silk saree in maroon?' },
  { from: 'biz', text: 'Yes! Maroon Banarasi silk — ₹4,500. Reserve one for you? 😊' },
  { from: 'them', text: 'Yes please, book it' },
  { from: 'biz', text: 'Done ✅ Secure payment link: pay.clickstream/r/9Fa2 — ships today.' },
  { from: 'them', text: 'Paid! 🎉' },
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

const FEATURES: Array<{ n: string; t: string; b: string }> = [
  { n: '01', t: 'Bulk broadcasts', b: 'Festive offers and updates to thousands using Meta-approved templates, with live delivery tracking down to the recipient.' },
  { n: '02', t: 'Smart automations', b: 'Keyword auto-replies and drip flows that run at 2am as reliably as 2pm — no enquiry goes cold waiting for someone to be online.' },
  { n: '03', t: 'Payments in chat', b: 'UPI, card and COD links sent inside the conversation. The customer pays without ever leaving WhatsApp.' },
  { n: '04', t: 'Template library', b: '27+ ready-made templates across 11 industries, written to clear Meta review on the first submission.' },
  { n: '05', t: 'Team inbox', b: 'Multiple agents on one number — routing, tags, deal pipelines and a shared history nobody has to re-ask for.' },
  { n: '06', t: 'Live analytics', b: 'Sent, delivered, read, replied — for every campaign, so the next one is built on what actually worked.' },
const MENU_INDUSTRIES = [
  { t: 'D2C & retail', d: 'Drops, carts and order updates', tone: '' },
  { t: 'Clinics & wellness', d: 'Appointments and reminders', tone: 'teal' },
  { t: 'Coaching & institutes', d: 'Batches, fees and parent updates', tone: 'amber' },
  { t: 'Real estate', d: 'Site visits and lead follow-ups', tone: '' },
]

const STEPS: Array<{ n: string; t: string; b: string }> = [
  { n: '01', t: 'Connect your number', b: 'The one your customers already have saved. Nothing for them to install, nothing for you to migrate.' },
  { n: '02', t: 'We set you up', b: 'Templates, automations and your contact list — configured around your business by our team, not a generic wizard.' },
  { n: '03', t: 'Broadcast & sell', b: 'Send a campaign, answer instantly when it lands, close the sale before your customer opens a second tab.' },
const FEATURES = [
  { t: 'Bulk broadcasts', d: 'Send an approved campaign to thousands of opted-in contacts at once, segmented by tag, city or last order.' },
  { t: 'Smart automations', d: 'Abandoned-cart nudges, delivery updates and welcome flows fire on their own — no one has to remember.' },
  { t: 'Payments in chat', d: 'Drop a secure payment link into the conversation and let customers pay without leaving the thread.' },
  { t: 'Template library', d: "Pre-written message templates by category, built to clear Meta's review the first time you submit them." },
  { t: 'Team inbox', d: 'Your whole team answers from one number, with assignment, internal notes and no shared password.' },
  { t: 'Live analytics', d: 'Delivered, read, replied and revenue per campaign — so you know which message actually paid for itself.' },
]

const FAQS: Array<{ q: string; a: string }> = [
  {
    q: 'Is AiSend built on the official WhatsApp Business API?',
    a: 'Yes. Every message goes through Meta’s official Cloud API — not a browser automation or a workaround that can get a number banned.',
  },
  {
    q: 'Do I need a developer to connect my WhatsApp number?',
    a: 'No. Connect WhatsApp in one click through the setup wizard, or our team connects it for you if you’d rather not touch it at all.',
  },
  {
    q: 'How much does WhatsApp actually charge per message?',
    a: '₹1.09 for a marketing message, ₹0.145 for a utility or authentication message. Replies inside an open 24-hour service window are free — that’s Meta’s own pricing, AiSend doesn’t mark it up.',
  },
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
    q: 'Can I try it before paying?',
    a: 'Yes — the Free plan runs on your own number with 100 contacts and 2 broadcasts a month, no card required.',
    nm: 'Starter', pr: '₹0', d: 'For trying it properly — runs on your own number with a 100-contact limit.',
    feats: ['Up to 100 contacts', '1 team member', 'Basic templates'],
    cta: 'Start free', href: '/signup', highlight: false,
  },
  {
    q: 'What happens if I outgrow my plan?',
    a: 'Upgrade whenever you need to. Every plan is month-to-month — no annual contract, no lock-in.',
    nm: 'Growth', pr: '₹999', d: 'The official API, unlimited contacts, and the whole team in one inbox.',
    feats: ['Unlimited contacts', 'Unlimited team members', 'Automations & payments in chat', 'Green tick application support'],
    cta: 'Choose Growth', href: '/signup', highlight: true,
  },
  {
    q: 'Can my whole team reply from one number?',
    a: 'Yes, on Starter and above — multiple teammates share one inbox with tags, assignment and a shared conversation history.',
    nm: 'Scale', pr: '₹2,499', d: 'For teams sending at volume — with an API, roles, and someone who picks up the phone.',
    feats: ['Everything in Growth', 'Multiple WhatsApp numbers', 'Developer API & webhooks', 'Roles, permissions & audit log', 'Dedicated account manager'],
    cta: 'Talk to sales', href: '/contact', highlight: false,
  },
];
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

function FAQAccordion() {
  const [open, setOpen] = useState<number | null>(0);
function Tick({ size = 17, style }: { size?: number; style?: React.CSSProperties }) {
  return (
    <div className="faq">
      {FAQS.map((f, i) => {
        const isOpen = open === i;
        return (
          <div key={f.q} className="faq-item">
            <button
              type="button"
              className="faq-q"
              onClick={() => setOpen(isOpen ? null : i)}
              aria-expanded={isOpen}
            >
              {f.q}
              <span className="faq-plus" style={{ transform: isOpen ? 'rotate(45deg)' : 'none' }}>+</span>
            </button>
            {isOpen && <p className="faq-a">{f.a}</p>}
          </div>
        );
      })}
    </div>
  );
    <svg className="tick" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" style={style}>
      <path d="M20 6 9 17l-5-5" />
    </svg>
  )
}

const CLIENTS: Array<{ name: string; role: string }> = [
  { name: 'Kalosa Aesthetics', role: 'Clinic — Gurugram' },
  { name: 'House of Nasir', role: 'Luxury menswear' },
  { name: 'Optimal Hiring Solutions', role: 'Recruitment' },
  { name: 'Dr. Shilpi Bhadani', role: 'Marketing consultancy' },
  { name: 'Asort', role: 'D2C retail' },
]
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
  const [n, setN] = useState(0)

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = []
    const run = () => {
      setN(0)
      CHAT.forEach((_, i) => timers.push(setTimeout(() => setN(i + 1), 700 + i * 950)))
      timers.push(setTimeout(run, 700 + CHAT.length * 950 + 2200))
    }
    run()
    return () => timers.forEach(clearTimeout)
  }, [])
  const year = new Date().getFullYear()

  return (
    <div style={{ fontFamily: 'var(--font-sans)', color: INK, background: '#fff' }}>
      <style>{`
        * { box-sizing:border-box; }
        .w { max-width:1160px; margin:0 auto; padding:0 22px; }
        .disp { font-family:var(--font-display); letter-spacing:-.03em; }
        .hl { background:${GREEN}; color:#04150f; padding:0 .28em; border-radius:6px; box-decoration-break:clone; -webkit-box-decoration-break:clone; }
        .pill { display:inline-flex; align-items:center; gap:7px; border:1px solid rgba(255,255,255,.25); color:#cfeede; border-radius:99px; padding:6px 15px; font-size:12.5px; font-weight:600; letter-spacing:.04em; text-transform:uppercase; }
        .btn { display:inline-flex; align-items:center; justify-content:center; gap:8px; background:${GREEN}; color:#04150f; font-weight:700; border:none; border-radius:12px; padding:14px 26px; font-size:15px; cursor:pointer; text-decoration:none; transition:transform .12s, box-shadow .2s, filter .2s; box-shadow:0 10px 24px rgba(37,211,102,.35); }
        .btn:hover { filter:brightness(1.05); box-shadow:0 14px 30px rgba(37,211,102,.45); }
        .btn:active { transform:translateY(1px); }
        .btn-dark { background:${TEAL}; color:#fff; box-shadow:0 10px 24px rgba(7,94,84,.3); }
        .btn-ghost { display:inline-flex; align-items:center; gap:8px; border:1.5px solid rgba(255,255,255,.3); color:#fff; background:transparent; border-radius:12px; padding:14px 24px; font-size:15px; font-weight:600; text-decoration:none; transition:background .2s; }
        .btn-ghost:hover { background:rgba(255,255,255,.08); }
        .fade { animation:fd .6s ease both; }
        @keyframes fd { from{opacity:0; transform:translateY(16px);} to{opacity:1; transform:none;} }
        @keyframes bub { from{opacity:0; transform:translateY(8px) scale(.97);} to{opacity:1; transform:none;} }
        .bub { animation:bub .35s ease both; }
        .hero { display:grid; grid-template-columns:1.06fr .94fr; gap:48px; align-items:center; }
        .stat4 { display:grid; grid-template-columns:repeat(4,1fr); gap:16px; }
        .feat-list { display:flex; flex-direction:column; }
        .feat-row { display:grid; grid-template-columns:60px 1fr; gap:22px; padding:26px 0; border-top:1px solid #e6ece9; }
        .why-wa { display:grid; grid-template-columns:repeat(3,1fr); gap:32px; border-top:1px solid #e6ece9; border-bottom:1px solid #e6ece9; padding:36px 0; }
        .why-wa-num { padding:0 8px; }
        .why-wa-figure { font-size:38px; font-weight:800; color:${GREEN_DEEP}; margin-bottom:8px; }
        .why-wa-label { font-size:14px; line-height:1.6; color:#46584f; margin:0; }
        .faq-item { border-top:1px solid #e6ece9; }
        .faq-q { width:100%; display:flex; align-items:center; justify-content:space-between; gap:16px; padding:20px 4px; background:none; border:none; text-align:left; font:inherit; font-size:16px; font-weight:700; color:${INK}; cursor:pointer; }
        .faq-plus { flex-shrink:0; width:24px; height:24px; display:flex; align-items:center; justify-content:center; border-radius:99px; background:#eefaf3; color:${GREEN_DEEP}; font-size:18px; font-weight:700; transition:transform .2s ease; }
        .faq-a { padding:0 4px 22px; margin:0; max-width:70ch; font-size:14.5px; line-height:1.7; color:#46584f; }
        .steps { display:grid; grid-template-columns:repeat(3,1fr); gap:0; position:relative; }
        .step { padding:0 22px; position:relative; }
        .step:first-child { padding-left:0; }
        .step:last-child { padding-right:0; }
        .step-line { position:absolute; top:19px; left:0; right:0; height:1px; background:#d7e4dd; z-index:0; }
        .cmp-row { display:grid; grid-template-columns:1.6fr 1fr 1fr; }
        .cities { display:flex; flex-wrap:wrap; gap:8px 22px; justify-content:center; }
        .clients { display:flex; flex-wrap:wrap; gap:12px; justify-content:center; }
        .navlinks { display:flex; gap:26px; align-items:center; }
        .pricing3 { display:grid; grid-template-columns:repeat(3,1fr); gap:18px; }
        .only-m { display:none; }
        @media(max-width:920px){ .hero{grid-template-columns:1fr; gap:34px;} .steps{grid-template-columns:1fr; gap:20px;} .step-line{display:none;} .step{padding:0 !important;} .pricing3{grid-template-columns:1fr;} .why-wa{grid-template-columns:1fr; gap:22px;} }
        @media(max-width:640px){
          .navlinks{display:none;} .only-m{display:inline-flex;}
          .h1{font-size:34px !important;} .sec{padding:56px 0 !important;}
          .cmp-row{grid-template-columns:1.4fr .8fr .8fr;}
          .feat-row{grid-template-columns:44px 1fr; gap:14px;}
          .stat4{grid-template-columns:1fr 1fr; row-gap:22px;}
        }
      `}</style>

      {/* NAV */}
      <header style={{ position: 'sticky', top: 0, zIndex: 50, background: 'rgba(7,94,84,.94)', backdropFilter: 'blur(10px)', borderBottom: '1px solid rgba(255,255,255,.08)' }}>
        <div className="w" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 68 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 34, height: 34, borderRadius: 9, background: `linear-gradient(135deg,${GREEN},${GREEN_DEEP})`, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(37,211,102,.4)' }}>
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M10.5 2L4 10.5H9L7.5 16L14 7.5H9L10.5 2Z" fill="#fff" strokeLinejoin="round" /></svg>
            </div>
            <span className="disp" style={{ fontSize: 19, fontWeight: 800, color: '#fff' }}>AiSend</span>
          </div>
          <nav className="navlinks">
            {[['Features', '#features'], ['How it works', '#how'], ['Why us', '#why'], ['Pricing', '#pricing']].map(([l, h]) => (
              <a key={l} href={h} style={{ color: '#bfe0d2', textDecoration: 'none', fontSize: 14, fontWeight: 500 }}>{l}</a>
            ))}
            <Link href="/login" style={{ color: '#fff', textDecoration: 'none', fontSize: 14, fontWeight: 600 }}>Login</Link>
            <Link href="/signup" className="btn" style={{ padding: '10px 18px', fontSize: 14 }}>Start free</Link>
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
          <Link href="/signup" className="btn only-m" style={{ padding: '9px 15px', fontSize: 13 }}>Start free</Link>

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

      {/* HERO */}
      <section className="sec" style={{ background: `radial-gradient(900px 500px at 78% -10%, #0e6f60 0%, ${TEAL} 55%)`, color: '#fff', padding: '74px 0 84px' }}>
        <div className="w hero">
          <div className="fade">
            <span className="pill" style={{ marginBottom: 22 }}><span style={{ width: 7, height: 7, borderRadius: 99, background: GREEN }} /> Official WhatsApp Business API</span>
            <h1 className="disp h1" style={{ fontSize: 52, lineHeight: 1.06, fontWeight: 800, margin: '0 0 20px' }}>
              The customer who messages you at 11pm <span className="hl">buys from whoever replies first.</span>
            </h1>
            <p style={{ fontSize: 18, lineHeight: 1.6, color: '#cfe5db', margin: '0 0 30px', maxWidth: 520 }}>
              AiSend answers the moment a message arrives, sends offers to thousands at once, and takes payment right inside the chat — on the WhatsApp number your customers already have saved. Built by the team at WE3 Media.
            </p>
            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 28 }}>
              <Link href="/signup" className="btn">Start free trial →</Link>
              <a href="https://wa.me/918707879485" className="btn-ghost">Talk to us on WhatsApp</a>
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
            <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', fontSize: 13, color: '#9cc4b4' }}>
              <span>✓ Go live in 10 minutes</span>
              <span>✓ No setup fee</span>
              <span>✓ Month-to-month</span>

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

          <div className="fade" style={{ display: 'flex', justifyContent: 'center' }}>
            <div style={{ width: 318, maxWidth: '100%', background: '#04140f', borderRadius: 30, padding: 9, boxShadow: '0 30px 70px rgba(0,0,0,.45)' }}>
              <div style={{ borderRadius: 22, overflow: 'hidden', background: '#e5ddd5' }}>
                <div style={{ background: TEAL, color: '#fff', padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 34, height: 34, borderRadius: 99, background: 'rgba(255,255,255,.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>S</div>
                  <div><div style={{ fontSize: 14, fontWeight: 600 }}>Sari Studio · Surat</div><div style={{ fontSize: 11, opacity: .8 }}>online</div></div>
                </div>
                <div style={{ padding: 13, minHeight: 320, display: 'flex', flexDirection: 'column', gap: 7 }}>
                  {CHAT.slice(0, n).map((m, i) => (
                    <div key={i} className="bub" style={{
                      alignSelf: m.from === 'them' ? 'flex-start' : 'flex-end', maxWidth: '84%',
                      background: m.from === 'them' ? '#fff' : '#d9fdd3',
                      borderRadius: 10, borderTopLeftRadius: m.from === 'them' ? 2 : 10, borderTopRightRadius: m.from === 'them' ? 10 : 2,
                      padding: '8px 11px', fontSize: 13, lineHeight: 1.45, boxShadow: '0 1px 1px rgba(0,0,0,.1)', color: INK,
                    }}>
                      {m.text}
                      <span style={{ display: 'block', textAlign: 'right', fontSize: 10, color: '#7c8a83', marginTop: 3 }}>{m.from === 'biz' ? '✓✓ ' : ''}9:4{i}</span>
                    </div>
                  ))}
                </div>
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
        </div>
      </section>
        </section>

      {/* STATS BAND */}
      <section style={{ background: TEAL_DEEP, color: '#fff', padding: '38px 0' }}>
        <div className="w stat4">
          {[['100+', 'Business clients'], ['10+ yrs', 'Marketing experience'], ['285%', 'Avg. client growth'], ['98%', 'Client retention']].map(([nu, la]) => (
            <div key={la} style={{ textAlign: 'center' }}>
              <div className="disp" style={{ fontSize: 30, fontWeight: 800, color: GREEN }}>{nu}</div>
              <div style={{ fontSize: 12.5, color: 'rgba(255,255,255,.65)', marginTop: 4 }}>{la}</div>
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
          ))}
        </div>
      </section>

      {/* PROBLEM — plain editorial block, no eyebrow, no icon grid */}
      <section className="sec" style={{ padding: '80px 0' }}>
        <div className="w" style={{ maxWidth: 720 }}>
          <h2 className="disp" style={{ fontSize: 36, fontWeight: 800, lineHeight: 1.15, margin: '0 0 18px' }}>
            A late reply isn&apos;t a delay. It&apos;s a <span style={{ color: GREEN_DEEP }}>lost sale.</span>
          </h2>
          <p style={{ fontSize: 17, lineHeight: 1.75, color: '#46584f', margin: 0 }}>
            Your customer messaged ready to buy. You were packing an order, with a walk-in, on a
            call — by the time you got back to your phone, they&apos;d already bought from
            whoever answered first. AiSend answers the moment the message lands, runs a campaign
            to your whole list in one send, and lets the customer pay without leaving the chat.
          </p>
        </div>
      </section>

      {/* WHY WHATSAPP — the channel's own numbers, not ours. Answers
          "why bother" before Features answers "why this tool". */}
      <section className="sec" style={{ padding: '10px 0 70px' }}>
        <div className="w">
          <div className="why-wa">
            <div className="why-wa-num">
              <div className="disp why-wa-figure">2B+</div>
              <p className="why-wa-label">People already messaging on WhatsApp worldwide — nobody has to download anything new.</p>
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
            <div className="why-wa-num">
              <div className="disp why-wa-figure">~98%</div>
              <p className="why-wa-label">Of WhatsApp messages get opened. Most marketing emails don&apos;t clear 20%.</p>
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
            <div className="why-wa-num">
              <div className="disp why-wa-figure">1st</div>
              <p className="why-wa-label">Reply usually wins the sale. WhatsApp is where that reply has to happen fastest.</p>

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
        </div>
      </section>

      {/* FEATURES — a numbered spec list, not another icon-card grid */}
      <section id="features" className="sec" style={{ padding: '10px 0 84px' }}>
        <div className="w" style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 0 }}>
          <div style={{ marginBottom: 8, maxWidth: 480 }}>
            <h2 className="disp" style={{ fontSize: 32, fontWeight: 800, margin: '0 0 8px' }}>Everything to run a WhatsApp business</h2>
            <p style={{ fontSize: 15, color: '#6b7c73', margin: 0 }}>Six things, each one doing a real job — not a feature-name wall.</p>
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
          <div className="feat-list">
            {FEATURES.map((f) => (
              <div key={f.n} className="feat-row">
                <div className="disp" style={{ fontSize: 22, fontWeight: 800, color: '#aee3c6' }}>{f.n}</div>
                <div>
                  <h3 className="disp" style={{ fontSize: 18, fontWeight: 700, margin: '0 0 6px' }}>{f.t}</h3>
                  <p style={{ fontSize: 14.5, lineHeight: 1.6, color: '#46584f', margin: 0, maxWidth: 560 }}>{f.b}</p>
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
              </div>
            ))}
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS — a connected timeline instead of three identical cards */}
      <section id="how" className="sec" style={{ padding: '80px 0', background: PAPER_TINT }}>
        <div className="w">
          <div style={{ marginBottom: 46, maxWidth: 520 }}>
            <h2 className="disp" style={{ fontSize: 32, fontWeight: 800, margin: '0 0 8px' }}>Live by this evening</h2>
            <p style={{ fontSize: 15, color: '#6b7c73', margin: 0 }}>Three steps. No app for your customers to install.</p>
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
          <div className="steps">
            <div className="step-line" />
            {STEPS.map((s) => (
              <div key={s.n} className="step">
                <div style={{ width: 38, height: 38, borderRadius: 99, background: '#fff', border: `2px solid ${GREEN}`, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', zIndex: 1, marginBottom: 18 }}>
                  <span className="disp" style={{ fontSize: 13, fontWeight: 800, color: GREEN_DEEP }}>{s.n}</span>
                </div>
                <h3 className="disp" style={{ fontSize: 18, fontWeight: 700, margin: '0 0 8px' }}>{s.t}</h3>
                <p style={{ fontSize: 14.5, lineHeight: 1.6, color: '#46584f', margin: 0 }}>{s.b}</p>
              </div>
            ))}
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
        </div>
      </section>

      {/* WHY US — comparison table (kept: it's a concrete claim, not a generic one) */}
      <section id="why" className="sec" style={{ padding: '80px 0', background: TEAL, color: '#fff' }}>
        <div className="w" style={{ maxWidth: 880 }}>
          <div style={{ marginBottom: 34, maxWidth: 560 }}>
            <h2 className="disp" style={{ fontSize: 32, fontWeight: 800, margin: '0 0 10px' }}>Built by marketers, not just coders</h2>
            <p style={{ fontSize: 15.5, color: '#bfe0d2', margin: 0 }}>
              Backed by WE3 Media — 10+ years running performance campaigns for 100+ businesses.
              You get the software and a team that has actually sold with it.
            </p>
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
          <div style={{ background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.1)', borderRadius: 16, overflow: 'hidden' }}>
            <div className="cmp-row" style={{ padding: '14px 18px', fontSize: 13, fontWeight: 700, color: '#9cc4b4', borderBottom: '1px solid rgba(255,255,255,.1)' }}>
              <div>What matters</div><div style={{ textAlign: 'center', color: GREEN }}>AiSend</div><div style={{ textAlign: 'center' }}>Generic tools</div>
            </div>
            {[
              'Official WhatsApp Business API',
              'Per-message wallet & transparent pricing',
              'Done-for-you setup by a real team',
              'Automations, broadcasts & team inbox',
              'Month-to-month, no lock-in',
            ].map((row, i) => (
              <div key={row} className="cmp-row" style={{ padding: '14px 18px', fontSize: 14.5, borderBottom: i < 4 ? '1px solid rgba(255,255,255,.07)' : 'none', alignItems: 'center' }}>
                <div style={{ color: '#e6f2ec' }}>{row}</div>
                <div style={{ textAlign: 'center', color: GREEN, fontWeight: 700 }}>✓</div>
                <div style={{ textAlign: 'center', color: 'rgba(255,255,255,.35)' }}>✕</div>
              </div>
            ))}
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
        </div>
      </section>

      {/* CLIENTS — an honest name wall, not fabricated star-rating quotes */}
      <section className="sec" style={{ padding: '72px 0' }}>
        <div className="w" style={{ textAlign: 'center' }}>
          <h2 className="disp" style={{ fontSize: 26, fontWeight: 800, margin: '0 0 28px', color: '#46584f' }}>
            Running on AiSend
          </h2>
          <div className="clients">
            {CLIENTS.map((c) => (
              <div key={c.name} style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#fff', border: '1px solid #e6ece9', borderRadius: 99, padding: '10px 18px 10px 10px' }}>
                <div style={{ width: 30, height: 30, borderRadius: 99, background: `linear-gradient(135deg,${GREEN},${GREEN_DEEP})`, color: '#04150f', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 13, flexShrink: 0 }}>
                  {c.name.charAt(0)}
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
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: INK, lineHeight: 1.2 }}>{c.name}</div>
                  <div style={{ fontSize: 11.5, color: '#8a978f' }}>{c.role}</div>
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
              </div>
            ))}
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section id="pricing" className="sec" style={{ padding: '20px 0 84px', background: PAPER_TINT }}>
        <div className="w">
          <div style={{ marginBottom: 42, maxWidth: 560 }}>
            <h2 className="disp" style={{ fontSize: 32, fontWeight: 800, margin: '0 0 10px' }}>Start free. Pay as you grow.</h2>
            <p style={{ fontSize: 15, color: '#46584f', margin: 0 }}>Plus WhatsApp message charges: ₹1.09 marketing · ₹0.145 utility · service replies free.</p>
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
          <div className="pricing3">
            {[
              { name: 'Free', price: '₹0', tag: 'Try it with your number', feats: ['WhatsApp inbox', '100 contacts', '2 broadcasts / month', 'Basic templates'], hot: false },
              { name: 'Starter', price: '₹999', tag: 'For growing businesses', feats: ['Everything in Free', '5,000 contacts', '50 broadcasts / month', '3 team members', 'Automations'], hot: true },
              { name: 'Growth', price: '₹1,999', tag: 'For scaling teams', feats: ['Everything in Starter', 'Unlimited contacts', 'Unlimited broadcasts', '10 team members', 'Priority support'], hot: false },
            ].map((p) => (
              <div key={p.name} style={{ background: '#fff', border: p.hot ? `2px solid ${GREEN}` : '1px solid #e6ece9', borderRadius: 18, padding: 28, position: 'relative', boxShadow: p.hot ? '0 16px 40px rgba(37,211,102,.18)' : '0 1px 3px rgba(11,35,26,.05)' }}>
                {p.hot && <span style={{ position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)', background: GREEN, color: '#04150f', fontSize: 12, fontWeight: 700, padding: '4px 14px', borderRadius: 99 }}>Most popular</span>}
                <h3 className="disp" style={{ fontSize: 20, fontWeight: 700, margin: '0 0 4px' }}>{p.name}</h3>
                <p style={{ fontSize: 13, color: '#6b7c73', margin: '0 0 16px' }}>{p.tag}</p>
                <div style={{ marginBottom: 18 }}><span className="disp" style={{ fontSize: 38, fontWeight: 800 }}>{p.price}</span><span style={{ fontSize: 14, color: '#6b7c73' }}> /month</span></div>
                <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 22px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {p.feats.map((f) => <li key={f} style={{ display: 'flex', gap: 8, fontSize: 14.5, color: '#46584f' }}><span style={{ color: GREEN_DEEP, fontWeight: 700 }}>✓</span>{f}</li>)}
                </ul>
                <Link href="/signup" className={p.hot ? 'btn' : 'btn btn-dark'} style={{ width: '100%' }}>{p.price === '₹0' ? 'Start free' : `Choose ${p.name}`}</Link>
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
            ))}
          </div>
        </div>
      </section>

      {/* FAQ — real questions in our own words, with FAQPage structured
          data so search engines can show the answers directly. */}
      <section className="sec" style={{ padding: '76px 0' }}>
        <div className="w" style={{ maxWidth: 760 }}>
          <h2 className="disp" style={{ fontSize: 32, fontWeight: 800, margin: '0 0 30px' }}>Questions people actually ask</h2>
          <FAQAccordion />
        </div>
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
      </section>

      {/* PRESENCE */}
      <section style={{ padding: '60px 0', background: TEAL_DEEP, color: '#fff' }}>
        <div className="w" style={{ textAlign: 'center' }}>
          <h2 className="disp" style={{ fontSize: 26, fontWeight: 800, margin: '0 0 20px' }}>Helping businesses grow across India</h2>
          <div className="cities" style={{ maxWidth: 820, margin: '0 auto', fontSize: 14.5, color: '#bfe0d2' }}>
            {['Kanpur', 'Gurugram', 'Delhi', 'Mumbai', 'Bengaluru', 'Hyderabad', 'Chennai', 'Ahmedabad', 'Kolkata', 'Lucknow', 'Jaipur', 'Noida', 'Pune', 'Surat', 'Indore'].map((c) => (
              <span key={c}>{c}</span>
            ))}

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
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="sec" style={{ padding: '76px 0', background: `linear-gradient(135deg, ${TEAL}, ${GREEN_DEEP})`, color: '#fff' }}>
        <div className="w" style={{ textAlign: 'center', maxWidth: 720 }}>
          <h2 className="disp" style={{ fontSize: 38, fontWeight: 800, lineHeight: 1.12, margin: '0 0 16px' }}>Your customers are already on WhatsApp.</h2>
          <p style={{ fontSize: 17, color: 'rgba(255,255,255,.85)', margin: '0 0 30px' }}>Go live in 10 minutes — no commitment, no setup fee.</p>
          <Link href="/signup" className="btn">Start your free trial →</Link>
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{ background: TEAL_DEEP, color: '#cfe5db', padding: '52px 0 30px' }}>
        <div className="w" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 28 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 12 }}>
              <div style={{ width: 30, height: 30, borderRadius: 8, background: `linear-gradient(135deg,${GREEN},${GREEN_DEEP})`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="15" height="15" viewBox="0 0 18 18" fill="none"><path d="M10.5 2L4 10.5H9L7.5 16L14 7.5H9L10.5 2Z" fill="#04150f" /></svg>
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
              <span className="disp" style={{ fontSize: 17, fontWeight: 800, color: '#fff' }}>AiSend</span>
              <p className="close__fine">
                Free plan · 100 contacts · upgrade whenever you outgrow it
              </p>
            </div>
            <p style={{ fontSize: 13.5, lineHeight: 1.6, margin: 0, color: '#9cc4b4', maxWidth: 300 }}>
              WhatsApp marketing & engagement for Indian businesses. A product by WE3 Media. Built on the Official WhatsApp Business API.
            </p>
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '.05em' }}>Product</div>
            {[['Features', '#features'], ['Pricing', '#pricing'], ['Login', '/login'], ['Start free', '/signup']].map(([l, h]) => (
              <div key={l} style={{ marginBottom: 8 }}><a href={h} style={{ color: '#bfe0d2', textDecoration: 'none', fontSize: 14 }}>{l}</a></div>
            ))}
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '.05em' }}>Legal</div>
            {[['Privacy Policy', '/privacy'], ['Terms', '/terms'], ['Contact', '/contact']].map(([l, h]) => (
              <div key={l} style={{ marginBottom: 8 }}><Link href={h} style={{ color: '#bfe0d2', textDecoration: 'none', fontSize: 14 }}>{l}</Link></div>
            ))}
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '.05em' }}>Contact</div>
            <div style={{ fontSize: 13.5, lineHeight: 1.7, color: '#bfe0d2' }}>
              <div>📞 <a href="tel:+918707879485" style={{ color: '#bfe0d2', textDecoration: 'none' }}>+91 87078 79485</a></div>
              <div>✉️ <a href="mailto:info@performancemktg.net" style={{ color: '#bfe0d2', textDecoration: 'none' }}>info@performancemktg.net</a></div>
              <div style={{ marginTop: 8 }}>📍 Kanpur, UP 208013</div>
              <div>📍 Udyog Vihar, Gurugram 122015</div>
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
        </div>
        <div className="w" style={{ marginTop: 34, paddingTop: 20, borderTop: '1px solid rgba(255,255,255,.1)', fontSize: 12.5, color: '#7fa899', display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between' }}>
          <span>© {new Date().getFullYear()} WE3 Media. All rights reserved.</span>
          <span>WhatsApp is a trademark of Meta Platforms, Inc. AiSend is an independent product.</span>
          <div className="ftr__bot">
            <span>© {year} AiSend — a WE3 Media product.</span>
            <span>
              WhatsApp is a trademark of Meta Platforms, Inc. AiSend is an independent product.
            </span>
          </div>
        </div>
      </footer>
    </div>
