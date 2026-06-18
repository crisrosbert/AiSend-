'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

/**
 * Clickstream WA — public marketing landing page (v2).
 *
 * Original design (not a clone of any reference site). Premium dark
 * forest-green aesthetic with a warm-cream card accent, highlighted
 * phrase headlines, an animated WhatsApp sale, credibility band, service
 * grid, a Why-us comparison, real WE3 Media contact/office data, and a
 * multi-city presence row. Fully responsive.
 *
 * Data source: WE3 Media (performancemktg.net) — the operating company
 * behind Clickstream WA. Only verifiable facts (contact, offices, stated
 * stats, WhatsApp focus) are used. Testimonials are clearly marked
 * placeholders to fill with real quotes — no invented proof.
 */

const FOREST = '#0c3b32'
const FOREST_DEEP = '#08291f'
const LEAF = '#1aa260'
const LEAF_BRIGHT = '#7ee06a'
const CREAM = '#f7efe0'
const INK = '#0b231a'

const CHAT: Array<{ from: 'them' | 'biz'; text: string }> = [
  { from: 'them', text: 'Hi, do you have the silk saree in maroon?' },
  { from: 'biz', text: 'Yes! Maroon Banarasi silk — ₹4,500. Reserve one for you? 😊' },
  { from: 'them', text: 'Yes please, book it' },
  { from: 'biz', text: 'Done ✅ Secure payment link: pay.clickstream/r/9Fa2 — ships today.' },
  { from: 'them', text: 'Paid! 🎉' },
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
        .hl { background:${LEAF_BRIGHT}; color:${FOREST_DEEP}; padding:0 .28em; border-radius:6px; box-decoration-break:clone; -webkit-box-decoration-break:clone; }
        .pill { display:inline-flex; align-items:center; gap:7px; border:1px solid rgba(255,255,255,.25); color:#cfeede; border-radius:99px; padding:6px 15px; font-size:12.5px; font-weight:600; letter-spacing:.04em; text-transform:uppercase; }
        .pill-dark { display:inline-flex; align-items:center; gap:7px; border:1px solid #cdeadc; color:${LEAF}; border-radius:99px; padding:6px 14px; font-size:12px; font-weight:700; letter-spacing:.06em; text-transform:uppercase; }
        .btn { display:inline-flex; align-items:center; justify-content:center; gap:8px; background:${LEAF}; color:#fff; font-weight:700; border:none; border-radius:12px; padding:14px 26px; font-size:15px; cursor:pointer; text-decoration:none; transition:transform .12s, box-shadow .2s, filter .2s; box-shadow:0 10px 24px rgba(26,162,96,.3); }
        .btn:hover { filter:brightness(1.05); box-shadow:0 14px 30px rgba(26,162,96,.4); }
        .btn:active { transform:translateY(1px); }
        .btn-bright { background:${LEAF_BRIGHT}; color:${FOREST_DEEP}; box-shadow:0 10px 24px rgba(126,224,106,.3); }
        .btn-ghost { display:inline-flex; align-items:center; gap:8px; border:1.5px solid rgba(255,255,255,.3); color:#fff; background:transparent; border-radius:12px; padding:14px 24px; font-size:15px; font-weight:600; text-decoration:none; transition:background .2s; }
        .btn-ghost:hover { background:rgba(255,255,255,.08); }
        .fade { animation:fd .6s ease both; }
        @keyframes fd { from{opacity:0; transform:translateY(16px);} to{opacity:1; transform:none;} }
        @keyframes bub { from{opacity:0; transform:translateY(8px) scale(.97);} to{opacity:1; transform:none;} }
        .bub { animation:bub .35s ease both; }
        .hero { display:grid; grid-template-columns:1.06fr .94fr; gap:48px; align-items:center; }
        .svc { display:grid; grid-template-columns:repeat(3,1fr); gap:18px; }
        .stat4 { display:grid; grid-template-columns:repeat(4,1fr); gap:16px; }
        .cmp-row { display:grid; grid-template-columns:1.6fr 1fr 1fr; }
        .cities { display:flex; flex-wrap:wrap; gap:8px 22px; justify-content:center; }
        .navlinks { display:flex; gap:26px; align-items:center; }
        .only-m { display:none; }
        @media(max-width:920px){ .hero{grid-template-columns:1fr; gap:34px;} .svc{grid-template-columns:1fr 1fr;} }
        @media(max-width:640px){
          .svc{grid-template-columns:1fr;} .stat4{grid-template-columns:1fr 1fr;}
          .navlinks{display:none;} .only-m{display:inline-flex;}
          .h1{font-size:36px !important;} .sec{padding:56px 0 !important;}
          .cmp-row{grid-template-columns:1.4fr .8fr .8fr;}
        }
      `}</style>

      {/* NAV */}
      <header style={{ position: 'sticky', top: 0, zIndex: 50, background: 'rgba(12,59,50,.92)', backdropFilter: 'blur(10px)', borderBottom: '1px solid rgba(255,255,255,.08)' }}>
        <div className="w" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 68 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 34, height: 34, borderRadius: 9, background: LEAF, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(26,162,96,.4)' }}>
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none"><path d="M12 2a10 10 0 0 0-8.5 15.3L2 22l4.8-1.5A10 10 0 1 0 12 2Z" fill="#fff" /></svg>
            </div>
            <span className="disp" style={{ fontSize: 19, fontWeight: 800, color: '#fff' }}>Clickstream <span style={{ color: LEAF_BRIGHT }}>WA</span></span>
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
      <section className="sec" style={{ background: `radial-gradient(900px 500px at 78% -10%, #14513f 0%, ${FOREST} 55%)`, color: '#fff', padding: '74px 0 84px' }}>
        <div className="w hero">
          <div className="fade">
            <span className="pill" style={{ marginBottom: 22 }}><span style={{ width: 7, height: 7, borderRadius: 99, background: LEAF_BRIGHT }} /> Official WhatsApp Business API</span>
            <h1 className="disp h1" style={{ fontSize: 54, lineHeight: 1.04, fontWeight: 800, margin: '0 0 20px' }}>
              Turn WhatsApp chats into <span className="hl">paid orders.</span>
            </h1>
            <p style={{ fontSize: 18, lineHeight: 1.6, color: '#cfe5db', margin: '0 0 30px', maxWidth: 520 }}>
              Broadcast offers, automate replies, and collect payments on the number your customers already message. Clickstream WA is the WhatsApp growth engine for Indian businesses — by the team at WE3 Media.
            </p>
            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 28 }}>
              <Link href="/signup" className="btn btn-bright">Start free trial →</Link>
              <a href="https://wa.me/918707879485" className="btn-ghost">Talk to us on WhatsApp</a>
            </div>
            <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', fontSize: 13, color: '#9cc4b4' }}>
              <span>✓ Go live in 10 minutes</span>
              <span>✓ No setup fee</span>
              <span>✓ Month-to-month</span>
            </div>
          </div>

          <div className="fade" style={{ display: 'flex', justifyContent: 'center' }}>
            <div style={{ width: 318, maxWidth: '100%', background: '#05140e', borderRadius: 30, padding: 9, boxShadow: '0 30px 70px rgba(0,0,0,.45)' }}>
              <div style={{ borderRadius: 22, overflow: 'hidden', background: '#e5ddd5' }}>
                <div style={{ background: '#0f5a44', color: '#fff', padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
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
      <section style={{ background: FOREST_DEEP, color: '#fff', padding: '38px 0' }}>
        <div className="w stat4">
          {[['100+', 'Business clients'], ['10+ yrs', 'Marketing experience'], ['285%', 'Avg. client growth'], ['98%', 'Client retention']].map(([nu, la]) => (
            <div key={la} style={{ textAlign: 'center' }}>
              <div className="disp" style={{ fontSize: 30, fontWeight: 800, color: LEAF_BRIGHT }}>{nu}</div>
              <div style={{ fontSize: 12.5, color: 'rgba(255,255,255,.65)', marginTop: 4 }}>{la}</div>
            </div>
          ))}
        </div>
      </section>

      {/* PROBLEM */}
      <section className="sec" style={{ padding: '78px 0' }}>
        <div className="w" style={{ maxWidth: 760, textAlign: 'center' }}>
          <span className="pill-dark" style={{ marginBottom: 16 }}>The real problem</span>
          <h2 className="disp" style={{ fontSize: 38, fontWeight: 800, lineHeight: 1.12, margin: '0 0 16px' }}>
            A late reply is a <span style={{ color: LEAF }}>lost sale.</span>
          </h2>
          <p style={{ fontSize: 18, lineHeight: 1.7, color: '#46584f', margin: 0 }}>
            Your customer messaged ready to buy. You were busy — packing orders, with a client, on a call. By the time you replied, they bought from whoever answered first. Clickstream WA answers every message the moment it arrives, sends offers to thousands at once, and collects payment right inside the chat.
          </p>
        </div>
      </section>

      {/* FEATURES */}
      <section id="features" className="sec" style={{ padding: '10px 0 80px' }}>
        <div className="w">
          <div style={{ textAlign: 'center', marginBottom: 42 }}>
            <span className="pill-dark" style={{ marginBottom: 12 }}>What you get</span>
            <h2 className="disp" style={{ fontSize: 36, fontWeight: 800, margin: 0 }}>Everything to run your <span className="hl">WhatsApp business</span></h2>
          </div>
          <div className="svc">
            {[
              ['📢', 'Bulk broadcasts', 'Send festive offers and updates to thousands using approved templates, with live delivery tracking.'],
              ['🤖', 'Smart automations', 'Keyword auto-replies and drip flows that work 24/7 so no enquiry ever goes cold.'],
              ['💳', 'Payments in chat', 'Share UPI, card and COD links inside the conversation and close the sale on the spot.'],
              ['📋', 'Template library', '27+ ready-made templates across 11 industries — submit to Meta and get approved fast.'],
              ['👥', 'Team inbox', 'Multiple agents on one number, with routing, tags, pipelines and a shared history.'],
              ['📊', 'Live analytics', 'Track sent, delivered, read and replied for every campaign — and double down on what works.'],
            ].map(([ic, t, b]) => (
              <div key={t} style={{ background: '#fff', border: '1px solid #e6ece9', borderRadius: 16, padding: 24, boxShadow: '0 1px 3px rgba(11,35,26,.05)' }}>
                <div style={{ width: 46, height: 46, borderRadius: 12, background: '#effaf4', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, marginBottom: 14 }}>{ic}</div>
                <h3 className="disp" style={{ fontSize: 18, fontWeight: 700, margin: '0 0 8px' }}>{t}</h3>
                <p style={{ fontSize: 14.5, lineHeight: 1.6, color: '#46584f', margin: 0 }}>{b}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* HOW */}
      <section id="how" className="sec" style={{ padding: '80px 0', background: '#f5f8f6' }}>
        <div className="w">
          <div style={{ textAlign: 'center', marginBottom: 42 }}>
            <span className="pill-dark" style={{ marginBottom: 12 }}>Live by this evening</span>
            <h2 className="disp" style={{ fontSize: 36, fontWeight: 800, margin: 0 }}>Three steps to your WhatsApp store</h2>
          </div>
          <div className="svc">
            {[
              ['01', 'Connect your number', 'Use your existing business number. Nothing for you or your customers to install.'],
              ['02', 'We set you up', 'Templates, automations and your contacts — configured around your business by our team.'],
              ['03', 'Broadcast & sell', 'Send campaigns, answer instantly, and turn conversations into paid orders.'],
            ].map(([nu, t, b]) => (
              <div key={nu} style={{ background: '#fff', border: '1px solid #e6ece9', borderRadius: 16, padding: 26 }}>
                <div className="disp" style={{ fontSize: 30, fontWeight: 800, color: '#aee3c6' }}>{nu}</div>
                <h3 className="disp" style={{ fontSize: 19, fontWeight: 700, margin: '10px 0 8px' }}>{t}</h3>
                <p style={{ fontSize: 14.5, lineHeight: 1.6, color: '#46584f', margin: 0 }}>{b}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* WHY US */}
      <section id="why" className="sec" style={{ padding: '80px 0', background: FOREST, color: '#fff' }}>
        <div className="w" style={{ maxWidth: 880 }}>
          <div style={{ textAlign: 'center', marginBottom: 38 }}>
            <span className="pill" style={{ marginBottom: 14 }}>Why Clickstream WA</span>
            <h2 className="disp" style={{ fontSize: 34, fontWeight: 800, margin: 0 }}>Built by marketers, not just coders</h2>
            <p style={{ fontSize: 16, color: '#bfe0d2', margin: '12px auto 0', maxWidth: 560 }}>
              Backed by WE3 Media — 10+ years running performance campaigns for 100+ businesses. You get the software and a team that knows how to sell.
            </p>
          </div>
          <div style={{ background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.1)', borderRadius: 16, overflow: 'hidden' }}>
            <div className="cmp-row" style={{ padding: '14px 18px', fontSize: 13, fontWeight: 700, color: '#9cc4b4', borderBottom: '1px solid rgba(255,255,255,.1)' }}>
              <div>What matters</div><div style={{ textAlign: 'center', color: LEAF_BRIGHT }}>Clickstream WA</div><div style={{ textAlign: 'center' }}>Generic tools</div>
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
                <div style={{ textAlign: 'center', color: LEAF_BRIGHT, fontWeight: 700 }}>✓</div>
                <div style={{ textAlign: 'center', color: 'rgba(255,255,255,.35)' }}>✕</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* TESTIMONIALS (placeholders) */}
      <section className="sec" style={{ padding: '78px 0' }}>
        <div className="w">
          <div style={{ textAlign: 'center', marginBottom: 38 }}>
            <span className="pill-dark" style={{ marginBottom: 12 }}>Client results</span>
            <h2 className="disp" style={{ fontSize: 34, fontWeight: 800, margin: 0 }}>Trusted by growing brands</h2>
          </div>
          <div className="svc">
            {[
              ['Dr. Ashish Khare', 'Kalosa Aesthetics — Gurgaon', '[Add Dr. Khare\u2019s real quote about the results delivered.]'],
              ['Nasir', 'House of Nasir — Luxury Menswear', '[Add House of Nasir\u2019s real quote about online orders.]'],
              ['Swati Choudhary', 'Optimal Hiring Solutions', '[Add Swati\u2019s real quote about leads generated.]'],
            ].map(([name, role, quote]) => (
              <div key={name} style={{ background: CREAM, borderRadius: 16, padding: 24 }}>
                <div style={{ color: '#e0a93b', fontSize: 15, marginBottom: 10 }}>★★★★★</div>
                <p style={{ fontSize: 14.5, lineHeight: 1.6, color: '#5a4f3a', margin: '0 0 16px', fontStyle: 'italic' }}>{quote}</p>
                <div style={{ fontWeight: 700, fontSize: 14.5, color: INK }}>{name}</div>
                <div style={{ fontSize: 13, color: '#8a7d63' }}>{role}</div>
              </div>
            ))}
          </div>
          <p style={{ textAlign: 'center', fontSize: 12.5, color: '#9aa8a0', marginTop: 18 }}>
            Replace the bracketed text with real, approved client quotes before going live.
          </p>
        </div>
      </section>

      {/* PRICING */}
      <section id="pricing" className="sec" style={{ padding: '20px 0 80px' }}>
        <div className="w">
          <div style={{ textAlign: 'center', marginBottom: 42 }}>
            <span className="pill-dark" style={{ marginBottom: 12 }}>Simple pricing</span>
            <h2 className="disp" style={{ fontSize: 36, fontWeight: 800, margin: '0 0 10px' }}>Start free. Pay as you grow.</h2>
            <p style={{ fontSize: 16, color: '#46584f', margin: 0 }}>Plus WhatsApp message charges: ₹1.09 marketing · ₹0.145 utility · service replies free.</p>
          </div>
          <div className="svc">
            {[
              { name: 'Free', price: '₹0', tag: 'Try it with your number', feats: ['WhatsApp inbox', '100 contacts', '2 broadcasts / month', 'Basic templates'], hot: false },
              { name: 'Starter', price: '₹999', tag: 'For growing businesses', feats: ['Everything in Free', '5,000 contacts', '50 broadcasts / month', '3 team members', 'Automations'], hot: true },
              { name: 'Growth', price: '₹1,999', tag: 'For scaling teams', feats: ['Everything in Starter', 'Unlimited contacts', 'Unlimited broadcasts', '10 team members', 'Priority support'], hot: false },
            ].map((p) => (
              <div key={p.name} style={{ background: '#fff', border: p.hot ? `2px solid ${LEAF}` : '1px solid #e6ece9', borderRadius: 18, padding: 28, position: 'relative', boxShadow: p.hot ? '0 16px 40px rgba(26,162,96,.16)' : '0 1px 3px rgba(11,35,26,.05)' }}>
                {p.hot && <span style={{ position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)', background: LEAF, color: '#fff', fontSize: 12, fontWeight: 700, padding: '4px 14px', borderRadius: 99 }}>Most popular</span>}
                <h3 className="disp" style={{ fontSize: 20, fontWeight: 700, margin: '0 0 4px' }}>{p.name}</h3>
                <p style={{ fontSize: 13, color: '#6b7c73', margin: '0 0 16px' }}>{p.tag}</p>
                <div style={{ marginBottom: 18 }}><span className="disp" style={{ fontSize: 38, fontWeight: 800 }}>{p.price}</span><span style={{ fontSize: 14, color: '#6b7c73' }}> /month</span></div>
                <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 22px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {p.feats.map((f) => <li key={f} style={{ display: 'flex', gap: 8, fontSize: 14.5, color: '#46584f' }}><span style={{ color: LEAF, fontWeight: 700 }}>✓</span>{f}</li>)}
                </ul>
                <Link href="/signup" className="btn" style={{ width: '100%', background: p.hot ? LEAF : '#0c3b32' }}>{p.price === '₹0' ? 'Start free' : `Choose ${p.name}`}</Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PRESENCE */}
      <section style={{ padding: '64px 0', background: FOREST_DEEP, color: '#fff' }}>
        <div className="w" style={{ textAlign: 'center' }}>
          <span className="pill" style={{ marginBottom: 16 }}>Pan-India presence</span>
          <h2 className="disp" style={{ fontSize: 30, fontWeight: 800, margin: '0 0 22px' }}>Helping businesses grow across India</h2>
          <div className="cities" style={{ maxWidth: 820, margin: '0 auto', fontSize: 14.5, color: '#bfe0d2' }}>
            {['Kanpur', 'Gurugram', 'Delhi', 'Mumbai', 'Bengaluru', 'Hyderabad', 'Chennai', 'Ahmedabad', 'Kolkata', 'Lucknow', 'Jaipur', 'Noida', 'Pune', 'Surat', 'Indore'].map((c) => (
              <span key={c}>{c}</span>
            ))}
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="sec" style={{ padding: '76px 0', background: `linear-gradient(135deg, ${LEAF}, ${FOREST})`, color: '#fff' }}>
        <div className="w" style={{ textAlign: 'center', maxWidth: 720 }}>
          <h2 className="disp" style={{ fontSize: 40, fontWeight: 800, lineHeight: 1.1, margin: '0 0 16px' }}>Your customers are already on WhatsApp.</h2>
          <p style={{ fontSize: 18, color: 'rgba(255,255,255,.85)', margin: '0 0 30px' }}>Go live in 10 minutes — no commitment, no setup fee.</p>
          <Link href="/signup" className="btn btn-bright">Start your free trial →</Link>
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{ background: FOREST_DEEP, color: '#cfe5db', padding: '52px 0 30px' }}>
        <div className="w" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 28 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 12 }}>
              <div style={{ width: 30, height: 30, borderRadius: 8, background: LEAF, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800 }}>C</div>
              <span className="disp" style={{ fontSize: 17, fontWeight: 800, color: '#fff' }}>Clickstream WA</span>
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
          <span>WhatsApp is a trademark of Meta Platforms, Inc. Clickstream WA is an independent product.</span>
        </div>
      </footer>
    </div>
  )
}
