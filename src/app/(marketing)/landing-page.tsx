'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

/**
 * AiSend — public marketing landing page (v3).
 *
 * Rewritten to stop reusing the same "pill eyebrow + centered heading +
 * 3-card grid" block for every single section — that repetition is
 * what makes a page read as templated. Each section now has its own
 * shape: a numbered spec-list for Features, a connected timeline for
 * How-it-works, a name wall instead of fabricated star-rating quotes
 * for social proof (the old version shipped literal "[Add real quote]"
 * bracket text to a live page — dishonest AND broken-looking).
 *
 * Palette now matches the app itself (WhatsApp green + the same dark
 * teal used in the dashboard sidebar) rather than an unrelated forest
 * green invented just for this page — a visitor who signs up should
 * recognise the product they land in.
 *
 * Data: WE3 Media (performancemktg.net), the company behind AiSend.
 * Only verifiable facts are used (contact info, offices, stated
 * client names/industries, pricing). No invented quotes or logos.
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
]

const FEATURES: Array<{ n: string; t: string; b: string }> = [
  { n: '01', t: 'Bulk broadcasts', b: 'Festive offers and updates to thousands using Meta-approved templates, with live delivery tracking down to the recipient.' },
  { n: '02', t: 'Smart automations', b: 'Keyword auto-replies and drip flows that run at 2am as reliably as 2pm — no enquiry goes cold waiting for someone to be online.' },
  { n: '03', t: 'Payments in chat', b: 'UPI, card and COD links sent inside the conversation. The customer pays without ever leaving WhatsApp.' },
  { n: '04', t: 'Template library', b: '27+ ready-made templates across 11 industries, written to clear Meta review on the first submission.' },
  { n: '05', t: 'Team inbox', b: 'Multiple agents on one number — routing, tags, deal pipelines and a shared history nobody has to re-ask for.' },
  { n: '06', t: 'Live analytics', b: 'Sent, delivered, read, replied — for every campaign, so the next one is built on what actually worked.' },
]

const STEPS: Array<{ n: string; t: string; b: string }> = [
  { n: '01', t: 'Connect your number', b: 'The one your customers already have saved. Nothing for them to install, nothing for you to migrate.' },
  { n: '02', t: 'We set you up', b: 'Templates, automations and your contact list — configured around your business by our team, not a generic wizard.' },
  { n: '03', t: 'Broadcast & sell', b: 'Send a campaign, answer instantly when it lands, close the sale before your customer opens a second tab.' },
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
  {
    q: 'Can I try it before paying?',
    a: 'Yes — the Free plan runs on your own number with 100 contacts and 2 broadcasts a month, no card required.',
  },
  {
    q: 'What happens if I outgrow my plan?',
    a: 'Upgrade whenever you need to. Every plan is month-to-month — no annual contract, no lock-in.',
  },
  {
    q: 'Can my whole team reply from one number?',
    a: 'Yes, on Starter and above — multiple teammates share one inbox with tags, assignment and a shared conversation history.',
  },
];

function FAQAccordion() {
  const [open, setOpen] = useState<number | null>(0);
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
}

const CLIENTS: Array<{ name: string; role: string }> = [
  { name: 'Kalosa Aesthetics', role: 'Clinic — Gurugram' },
  { name: 'House of Nasir', role: 'Luxury menswear' },
  { name: 'Optimal Hiring Solutions', role: 'Recruitment' },
  { name: 'Dr. Shilpi Bhadani', role: 'Marketing consultancy' },
  { name: 'Asort', role: 'D2C retail' },
]

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
          </nav>
          <Link href="/signup" className="btn only-m" style={{ padding: '9px 15px', fontSize: 13 }}>Start free</Link>
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
            </div>
            <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', fontSize: 13, color: '#9cc4b4' }}>
              <span>✓ Go live in 10 minutes</span>
              <span>✓ No setup fee</span>
              <span>✓ Month-to-month</span>
            </div>
          </div>

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
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* STATS BAND */}
      <section style={{ background: TEAL_DEEP, color: '#fff', padding: '38px 0' }}>
        <div className="w stat4">
          {[['100+', 'Business clients'], ['10+ yrs', 'Marketing experience'], ['285%', 'Avg. client growth'], ['98%', 'Client retention']].map(([nu, la]) => (
            <div key={la} style={{ textAlign: 'center' }}>
              <div className="disp" style={{ fontSize: 30, fontWeight: 800, color: GREEN }}>{nu}</div>
              <div style={{ fontSize: 12.5, color: 'rgba(255,255,255,.65)', marginTop: 4 }}>{la}</div>
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
            </div>
            <div className="why-wa-num">
              <div className="disp why-wa-figure">~98%</div>
              <p className="why-wa-label">Of WhatsApp messages get opened. Most marketing emails don&apos;t clear 20%.</p>
            </div>
            <div className="why-wa-num">
              <div className="disp why-wa-figure">1st</div>
              <p className="why-wa-label">Reply usually wins the sale. WhatsApp is where that reply has to happen fastest.</p>
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
          </div>
          <div className="feat-list">
            {FEATURES.map((f) => (
              <div key={f.n} className="feat-row">
                <div className="disp" style={{ fontSize: 22, fontWeight: 800, color: '#aee3c6' }}>{f.n}</div>
                <div>
                  <h3 className="disp" style={{ fontSize: 18, fontWeight: 700, margin: '0 0 6px' }}>{f.t}</h3>
                  <p style={{ fontSize: 14.5, lineHeight: 1.6, color: '#46584f', margin: 0, maxWidth: 560 }}>{f.b}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* HOW IT WORKS — a connected timeline instead of three identical cards */}
      <section id="how" className="sec" style={{ padding: '80px 0', background: PAPER_TINT }}>
        <div className="w">
          <div style={{ marginBottom: 46, maxWidth: 520 }}>
            <h2 className="disp" style={{ fontSize: 32, fontWeight: 800, margin: '0 0 8px' }}>Live by this evening</h2>
            <p style={{ fontSize: 15, color: '#6b7c73', margin: 0 }}>Three steps. No app for your customers to install.</p>
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
                </div>
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: INK, lineHeight: 1.2 }}>{c.name}</div>
                  <div style={{ fontSize: 11.5, color: '#8a978f' }}>{c.role}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section id="pricing" className="sec" style={{ padding: '20px 0 84px', background: PAPER_TINT }}>
        <div className="w">
          <div style={{ marginBottom: 42, maxWidth: 560 }}>
            <h2 className="disp" style={{ fontSize: 32, fontWeight: 800, margin: '0 0 10px' }}>Start free. Pay as you grow.</h2>
            <p style={{ fontSize: 15, color: '#46584f', margin: 0 }}>Plus WhatsApp message charges: ₹1.09 marketing · ₹0.145 utility · service replies free.</p>
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
              </div>
              <span className="disp" style={{ fontSize: 17, fontWeight: 800, color: '#fff' }}>AiSend</span>
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
            </div>
          </div>
        </div>
        <div className="w" style={{ marginTop: 34, paddingTop: 20, borderTop: '1px solid rgba(255,255,255,.1)', fontSize: 12.5, color: '#7fa899', display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between' }}>
          <span>© {new Date().getFullYear()} WE3 Media. All rights reserved.</span>
          <span>WhatsApp is a trademark of Meta Platforms, Inc. AiSend is an independent product.</span>
        </div>
      </footer>
    </div>
  )
}
