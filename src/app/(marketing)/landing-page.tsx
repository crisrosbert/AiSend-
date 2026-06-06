'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

/**
 * Clickstream WA — public marketing landing page.
 *
 * Design direction: trustworthy Indian SaaS. Refined forest-green brand,
 * Sora display + Plus Jakarta body (already loaded app-wide), an animated
 * WhatsApp conversation that "closes a sale", hard credibility stats,
 * crisp feature grid, transparent per-message pricing, founder trust, and
 * strong CTAs. Fully responsive (mobile-first).
 *
 * This is intentionally a single self-contained file so it's easy to drop
 * in via GitHub web UI. All styles are inline / scoped <style> so it
 * doesn't depend on the dashboard design system.
 */

const BRAND = '#1aa260'
const BRAND_DEEP = '#14834e'
const INK = '#0b231a'

const CHAT_SCRIPT: Array<{ from: 'them' | 'bot'; text: string; delay: number }> = [
  { from: 'them', text: 'Hi, is the blue kurta available in M?', delay: 600 },
  { from: 'bot', text: 'Yes! The Indigo Cotton Kurta (M) is in stock — ₹1,299. Want me to reserve it? 😊', delay: 1400 },
  { from: 'them', text: 'Haan, book it please', delay: 2400 },
  { from: 'bot', text: 'Done ✅ Here is your secure payment link: pay.clickstream.wa/r/8Kd2 — your order ships today.', delay: 3300 },
  { from: 'them', text: 'Paid! 🎉', delay: 4300 },
]

export default function LandingPage() {
  const [visibleMsgs, setVisibleMsgs] = useState(0)

  // Replay the chat animation on a loop so the hero feels alive.
  useEffect(() => {
    let timers: ReturnType<typeof setTimeout>[] = []
    const run = () => {
      setVisibleMsgs(0)
      CHAT_SCRIPT.forEach((m, i) => {
        timers.push(setTimeout(() => setVisibleMsgs(i + 1), m.delay))
      })
      timers.push(setTimeout(run, 6800))
    }
    run()
    return () => timers.forEach(clearTimeout)
  }, [])

  return (
    <div style={{ fontFamily: 'var(--font-sans)', color: INK, background: '#ffffff' }}>
      <style>{`
        * { box-sizing: border-box; }
        .cs-display { font-family: var(--font-display); letter-spacing: -0.025em; }
        .cs-wrap { max-width: 1180px; margin: 0 auto; padding: 0 20px; }
        .cs-btn-primary {
          display:inline-flex; align-items:center; justify-content:center; gap:8px;
          background: linear-gradient(180deg, ${BRAND}, ${BRAND_DEEP});
          color:#fff; font-weight:600; border:none; border-radius:12px;
          padding:14px 26px; font-size:15px; cursor:pointer; text-decoration:none;
          box-shadow:0 10px 24px rgba(26,162,96,.28); transition:transform .12s ease, box-shadow .2s ease, filter .2s ease;
        }
        .cs-btn-primary:hover { filter:brightness(1.04); box-shadow:0 14px 30px rgba(26,162,96,.34); }
        .cs-btn-primary:active { transform:translateY(1px); }
        .cs-btn-ghost {
          display:inline-flex; align-items:center; justify-content:center; gap:8px;
          background:#fff; color:${BRAND_DEEP}; font-weight:600; border:1.5px solid #cdeadc;
          border-radius:12px; padding:14px 24px; font-size:15px; cursor:pointer; text-decoration:none;
          transition:background .2s ease, border-color .2s ease;
        }
        .cs-btn-ghost:hover { background:#f0faf4; border-color:${BRAND}; }
        .cs-fade { animation: csFade .5s ease both; }
        @keyframes csFade { from { opacity:0; transform:translateY(14px);} to {opacity:1; transform:none;} }
        @keyframes bubbleIn { from { opacity:0; transform:translateY(8px) scale(.97);} to {opacity:1; transform:none;} }
        .cs-bubble { animation: bubbleIn .35s ease both; }
        .cs-grid-features { display:grid; grid-template-columns:repeat(3,1fr); gap:18px; }
        .cs-hero-grid { display:grid; grid-template-columns:1.05fr .95fr; gap:48px; align-items:center; }
        .cs-stats { display:grid; grid-template-columns:repeat(4,1fr); gap:16px; }
        .cs-pricing { display:grid; grid-template-columns:repeat(3,1fr); gap:20px; align-items:stretch; }
        .cs-nav-links { display:flex; gap:28px; align-items:center; }
        .cs-mobile-only { display:none; }
        @media (max-width: 920px) {
          .cs-hero-grid { grid-template-columns:1fr; gap:36px; }
          .cs-grid-features { grid-template-columns:1fr 1fr; }
          .cs-pricing { grid-template-columns:1fr; }
        }
        @media (max-width: 640px) {
          .cs-grid-features { grid-template-columns:1fr; }
          .cs-stats { grid-template-columns:1fr 1fr; }
          .cs-nav-links { display:none; }
          .cs-mobile-only { display:inline-flex; }
          .cs-h1 { font-size:34px !important; }
          .cs-section { padding:56px 0 !important; }
        }
      `}</style>

      {/* ───────────────── NAV ───────────────── */}
      <header style={{ position: 'sticky', top: 0, zIndex: 50, background: 'rgba(255,255,255,.85)', backdropFilter: 'blur(10px)', borderBottom: '1px solid #eef2f0' }}>
        <div className="cs-wrap" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 66 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 34, height: 34, borderRadius: 9, background: BRAND, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 10px rgba(26,162,96,.3)' }}>
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none"><path d="M12 2a10 10 0 0 0-8.5 15.3L2 22l4.8-1.5A10 10 0 1 0 12 2Z" fill="#fff"/><path d="M8.5 9.5c0-.6.5-1 1-1 .3 0 .6.2.8.5l.7 1.2c.1.3.1.6-.1.8l-.4.5c.5.9 1.2 1.6 2.1 2.1l.5-.4c.2-.2.5-.2.8-.1l1.2.7c.3.2.5.5.5.8 0 .5-.4 1-1 1-3.6 0-6.4-2.8-6.4-6.1Z" fill={BRAND}/></svg>
            </div>
            <span className="cs-display" style={{ fontSize: 19, fontWeight: 700 }}>Clickstream <span style={{ color: BRAND }}>WA</span></span>
          </div>
          <nav className="cs-nav-links">
            <a href="#features" style={{ color: '#46584f', textDecoration: 'none', fontSize: 14, fontWeight: 500 }}>Features</a>
            <a href="#how" style={{ color: '#46584f', textDecoration: 'none', fontSize: 14, fontWeight: 500 }}>How it works</a>
            <a href="#pricing" style={{ color: '#46584f', textDecoration: 'none', fontSize: 14, fontWeight: 500 }}>Pricing</a>
            <Link href="/login" style={{ color: INK, textDecoration: 'none', fontSize: 14, fontWeight: 600 }}>Login</Link>
            <Link href="/signup" className="cs-btn-primary" style={{ padding: '10px 18px', fontSize: 14 }}>Start free</Link>
          </nav>
          <Link href="/signup" className="cs-btn-primary cs-mobile-only" style={{ padding: '9px 16px', fontSize: 13 }}>Start free</Link>
        </div>
      </header>

      {/* ───────────────── HERO ───────────────── */}
      <section className="cs-section" style={{ padding: '72px 0 80px', background: 'radial-gradient(1200px 400px at 70% -10%, #effaf4 0%, transparent 60%)' }}>
        <div className="cs-wrap cs-hero-grid">
          <div className="cs-fade">
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#effaf4', border: '1px solid #cdeadc', color: BRAND_DEEP, borderRadius: 99, padding: '6px 14px', fontSize: 13, fontWeight: 600, marginBottom: 22 }}>
              <span style={{ width: 7, height: 7, borderRadius: 99, background: BRAND, display: 'inline-block' }} />
              Built on Official WhatsApp Business API
            </div>
            <h1 className="cs-display cs-h1" style={{ fontSize: 52, lineHeight: 1.05, fontWeight: 800, margin: '0 0 20px' }}>
              Turn every WhatsApp chat into a <span style={{ color: BRAND }}>paid order.</span>
            </h1>
            <p style={{ fontSize: 18, lineHeight: 1.6, color: '#46584f', margin: '0 0 30px', maxWidth: 520 }}>
              Broadcast offers, automate replies, and collect payments — all on the number your customers already message. Clickstream WA is the WhatsApp growth engine for Indian businesses.
            </p>
            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 26 }}>
              <Link href="/signup" className="cs-btn-primary">Start 14-day free trial →</Link>
              <a href="#how" className="cs-btn-ghost">See how it works</a>
            </div>
            <div style={{ display: 'flex', gap: 22, flexWrap: 'wrap', fontSize: 13, color: '#6b7c73' }}>
              <span>✓ No setup fee</span>
              <span>✓ Green tick assistance</span>
              <span>✓ Go live in 10 minutes</span>
            </div>
          </div>

          {/* Animated WhatsApp phone */}
          <div className="cs-fade" style={{ display: 'flex', justifyContent: 'center' }}>
            <div style={{ width: 320, maxWidth: '100%', background: '#0b141a', borderRadius: 30, padding: 10, boxShadow: '0 30px 70px rgba(11,35,26,.28)' }}>
              <div style={{ borderRadius: 22, overflow: 'hidden', background: '#e5ddd5' }}>
                {/* phone header */}
                <div style={{ background: BRAND_DEEP, color: '#fff', padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 34, height: 34, borderRadius: 99, background: 'rgba(255,255,255,.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>S</div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>Sari Studio · Surat</div>
                    <div style={{ fontSize: 11, opacity: .8 }}>online</div>
                  </div>
                </div>
                {/* messages */}
                <div style={{ padding: 14, minHeight: 330, display: 'flex', flexDirection: 'column', gap: 8, backgroundImage: 'linear-gradient(rgba(229,221,213,.6),rgba(229,221,213,.6))' }}>
                  {CHAT_SCRIPT.slice(0, visibleMsgs).map((m, i) => (
                    <div key={i} className="cs-bubble" style={{
                      alignSelf: m.from === 'them' ? 'flex-start' : 'flex-end',
                      maxWidth: '82%',
                      background: m.from === 'them' ? '#ffffff' : '#d9fdd3',
                      borderRadius: 10,
                      borderTopLeftRadius: m.from === 'them' ? 2 : 10,
                      borderTopRightRadius: m.from === 'them' ? 10 : 2,
                      padding: '8px 11px', fontSize: 13.5, lineHeight: 1.45,
                      boxShadow: '0 1px 1px rgba(11,35,26,.12)', color: INK,
                    }}>
                      {m.text}
                      <span style={{ display: 'block', textAlign: 'right', fontSize: 10, color: '#7c8a83', marginTop: 3 }}>
                        {m.from === 'bot' ? '✓✓ ' : ''}9:4{i}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ───────────────── STATS BAR ───────────────── */}
      <section style={{ background: INK, color: '#fff', padding: '40px 0' }}>
        <div className="cs-wrap cs-stats">
          {[
            ['98%', 'Messages opened'],
            ['45–60%', 'Click-through rates'],
            ['535M+', 'Indians on WhatsApp'],
            ['10 min', 'To go live'],
          ].map(([n, l]) => (
            <div key={l} style={{ textAlign: 'center' }}>
              <div className="cs-display" style={{ fontSize: 30, fontWeight: 800, color: '#5fd99b' }}>{n}</div>
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,.7)', marginTop: 4 }}>{l}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ───────────────── PROBLEM ───────────────── */}
      <section className="cs-section" style={{ padding: '80px 0' }}>
        <div className="cs-wrap" style={{ maxWidth: 760, textAlign: 'center' }}>
          <p style={{ color: BRAND_DEEP, fontWeight: 700, fontSize: 13, letterSpacing: '.08em', textTransform: 'uppercase', margin: '0 0 14px' }}>The real problem</p>
          <h2 className="cs-display" style={{ fontSize: 38, fontWeight: 800, lineHeight: 1.15, margin: '0 0 18px' }}>A late reply is a lost sale.</h2>
          <p style={{ fontSize: 18, lineHeight: 1.7, color: '#46584f', margin: 0 }}>
            Your customer messaged you ready to buy. You were busy — packing orders, with a client, on a call. By the time you replied, they bought from whoever answered first. Clickstream WA answers every message the second it arrives, in your customer's language, even at midnight.
          </p>
        </div>
      </section>

      {/* ───────────────── FEATURES ───────────────── */}
      <section id="features" className="cs-section" style={{ padding: '20px 0 80px' }}>
        <div className="cs-wrap">
          <div style={{ textAlign: 'center', marginBottom: 44 }}>
            <p style={{ color: BRAND_DEEP, fontWeight: 700, fontSize: 13, letterSpacing: '.08em', textTransform: 'uppercase', margin: '0 0 12px' }}>Everything you need</p>
            <h2 className="cs-display" style={{ fontSize: 36, fontWeight: 800, margin: 0 }}>One platform. Your whole WhatsApp business.</h2>
          </div>
          <div className="cs-grid-features">
            {[
              ['📢', 'Bulk broadcasts', 'Send offers, festive campaigns and updates to thousands — with approved templates and real-time delivery tracking.'],
              ['🤖', 'Smart automations', 'Keyword auto-replies, drip flows and instant answers that run 24/7 so no enquiry goes cold.'],
              ['💳', 'Payments in chat', 'Share UPI / card / COD links right inside the conversation and close the sale on the spot.'],
              ['📋', 'Template library', '27+ ready-made templates across 11 industries — submit to Meta and get approved fast.'],
              ['👥', 'Team inbox', 'Multiple agents on one WhatsApp number, with smart routing, tags and pipelines.'],
              ['📊', 'Live analytics', 'Track sent, delivered, read and replied for every campaign — and retarget what works.'],
            ].map(([icon, title, body]) => (
              <div key={title} style={{ background: '#fff', border: '1px solid #e6ece9', borderRadius: 16, padding: 24, boxShadow: '0 1px 3px rgba(11,35,26,.05)' }}>
                <div style={{ width: 46, height: 46, borderRadius: 12, background: '#effaf4', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, marginBottom: 14 }}>{icon}</div>
                <h3 className="cs-display" style={{ fontSize: 18, fontWeight: 700, margin: '0 0 8px' }}>{title}</h3>
                <p style={{ fontSize: 14.5, lineHeight: 1.6, color: '#46584f', margin: 0 }}>{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ───────────────── HOW IT WORKS ───────────────── */}
      <section id="how" className="cs-section" style={{ padding: '80px 0', background: '#f5f8f6' }}>
        <div className="cs-wrap">
          <div style={{ textAlign: 'center', marginBottom: 44 }}>
            <p style={{ color: BRAND_DEEP, fontWeight: 700, fontSize: 13, letterSpacing: '.08em', textTransform: 'uppercase', margin: '0 0 12px' }}>Live by this evening</p>
            <h2 className="cs-display" style={{ fontSize: 36, fontWeight: 800, margin: 0 }}>Three steps to your WhatsApp store.</h2>
          </div>
          <div className="cs-grid-features">
            {[
              ['01', 'Connect your WhatsApp', 'Use your existing business number. Nothing to install for you or your customers.'],
              ['02', 'We set up your account', 'Templates, automations and your contact list — configured around your business.'],
              ['03', 'Broadcast & sell', 'Share campaigns, answer instantly, and turn conversations into paid orders.'],
            ].map(([n, title, body]) => (
              <div key={n} style={{ background: '#fff', border: '1px solid #e6ece9', borderRadius: 16, padding: 26 }}>
                <div className="cs-display" style={{ fontSize: 30, fontWeight: 800, color: '#aee3c6' }}>{n}</div>
                <h3 className="cs-display" style={{ fontSize: 19, fontWeight: 700, margin: '10px 0 8px' }}>{title}</h3>
                <p style={{ fontSize: 14.5, lineHeight: 1.6, color: '#46584f', margin: 0 }}>{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ───────────────── PRICING ───────────────── */}
      <section id="pricing" className="cs-section" style={{ padding: '80px 0' }}>
        <div className="cs-wrap">
          <div style={{ textAlign: 'center', marginBottom: 44 }}>
            <p style={{ color: BRAND_DEEP, fontWeight: 700, fontSize: 13, letterSpacing: '.08em', textTransform: 'uppercase', margin: '0 0 12px' }}>Simple, honest pricing</p>
            <h2 className="cs-display" style={{ fontSize: 36, fontWeight: 800, margin: '0 0 10px' }}>Start free. Pay as you grow.</h2>
            <p style={{ fontSize: 16, color: '#46584f', margin: 0 }}>Plus WhatsApp message charges: ₹1.09 marketing · ₹0.145 utility · service replies free.</p>
          </div>
          <div className="cs-pricing">
            {[
              { name: 'Free', price: '₹0', tag: 'Try it with your number', feats: ['WhatsApp inbox', '100 contacts', '2 broadcasts / month', 'Basic templates'], primary: false },
              { name: 'Starter', price: '₹999', tag: 'For growing businesses', feats: ['Everything in Free', '5,000 contacts', '50 broadcasts / month', '3 team members', 'Automations'], primary: true },
              { name: 'Growth', price: '₹1,999', tag: 'For scaling teams', feats: ['Everything in Starter', 'Unlimited contacts', 'Unlimited broadcasts', '10 team members', 'Priority support'], primary: false },
            ].map((p) => (
              <div key={p.name} style={{
                background: '#fff',
                border: p.primary ? `2px solid ${BRAND}` : '1px solid #e6ece9',
                borderRadius: 18, padding: 28, position: 'relative',
                boxShadow: p.primary ? '0 16px 40px rgba(26,162,96,.16)' : '0 1px 3px rgba(11,35,26,.05)',
              }}>
                {p.primary && (
                  <span style={{ position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)', background: BRAND, color: '#fff', fontSize: 12, fontWeight: 700, padding: '4px 14px', borderRadius: 99 }}>Most popular</span>
                )}
                <h3 className="cs-display" style={{ fontSize: 20, fontWeight: 700, margin: '0 0 4px' }}>{p.name}</h3>
                <p style={{ fontSize: 13, color: '#6b7c73', margin: '0 0 16px' }}>{p.tag}</p>
                <div style={{ marginBottom: 18 }}>
                  <span className="cs-display" style={{ fontSize: 38, fontWeight: 800 }}>{p.price}</span>
                  <span style={{ fontSize: 14, color: '#6b7c73' }}> /month</span>
                </div>
                <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 22px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {p.feats.map((f) => (
                    <li key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 14.5, color: '#46584f' }}>
                      <span style={{ color: BRAND, fontWeight: 700 }}>✓</span>{f}
                    </li>
                  ))}
                </ul>
                <Link href="/signup" className={p.primary ? 'cs-btn-primary' : 'cs-btn-ghost'} style={{ width: '100%' }}>
                  {p.price === '₹0' ? 'Start free' : `Choose ${p.name}`}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ───────────────── FINAL CTA ───────────────── */}
      <section className="cs-section" style={{ padding: '78px 0', background: `linear-gradient(135deg, ${BRAND_DEEP}, ${INK})`, color: '#fff' }}>
        <div className="cs-wrap" style={{ textAlign: 'center', maxWidth: 720 }}>
          <h2 className="cs-display" style={{ fontSize: 40, fontWeight: 800, lineHeight: 1.1, margin: '0 0 16px' }}>
            Your customers are already on WhatsApp.
          </h2>
          <p style={{ fontSize: 18, color: 'rgba(255,255,255,.82)', margin: '0 0 30px' }}>
            Your business deserves to be there too. Go live in 10 minutes — no commitment.
          </p>
          <Link href="/signup" className="cs-btn-primary" style={{ background: '#fff', color: BRAND_DEEP, boxShadow: '0 12px 30px rgba(0,0,0,.25)' }}>
            Start your free trial →
          </Link>
        </div>
      </section>

      {/* ───────────────── FOOTER ───────────────── */}
      <footer style={{ background: '#fff', borderTop: '1px solid #eef2f0', padding: '40px 0' }}>
        <div className="cs-wrap" style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: 24, alignItems: 'center' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 8 }}>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: BRAND, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 13 }}>C</div>
              <span className="cs-display" style={{ fontSize: 16, fontWeight: 700 }}>Clickstream WA</span>
            </div>
            <p style={{ fontSize: 13, color: '#6b7c73', margin: 0, maxWidth: 320 }}>
              WhatsApp marketing & engagement for Indian businesses. Built on the Official WhatsApp Business API.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 28, fontSize: 14, flexWrap: 'wrap' }}>
            <Link href="/privacy" style={{ color: '#46584f', textDecoration: 'none' }}>Privacy Policy</Link>
            <Link href="/terms" style={{ color: '#46584f', textDecoration: 'none' }}>Terms</Link>
            <a href="#pricing" style={{ color: '#46584f', textDecoration: 'none' }}>Pricing</a>
            <Link href="/login" style={{ color: '#46584f', textDecoration: 'none' }}>Login</Link>
          </div>
        </div>
        <div className="cs-wrap" style={{ marginTop: 26, paddingTop: 20, borderTop: '1px solid #f1f5f3', fontSize: 12.5, color: '#9aa8a0' }}>
          © {new Date().getFullYear()} Clickstream WA. Made in India. WhatsApp is a trademark of Meta Platforms, Inc.
        </div>
      </footer>
    </div>
  )
}
