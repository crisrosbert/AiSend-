'use client'

import LegalShell from '../(marketing)/legal-shell'
import { useState } from 'react'

/**
 * Public Contact page. Razorpay + Meta review both look for visible,
 * working contact info (email, phone, business address). Includes a
 * simple mailto-based form so it works with zero backend; swap to an
 * API route later if you want stored submissions.
 */

const BRAND = '#1aa260'
const BRAND_DEEP = '#14834e'

export default function ContactPage() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')

  const mailto = `mailto:crisrosbert@gmail.com?subject=${encodeURIComponent(
    `Contact from ${name || 'website'}`,
  )}&body=${encodeURIComponent(`From: ${name} <${email}>\n\n${message}`)}`

  return (
    <LegalShell title="Contact us" subtitle="We'd love to hear from you. We typically reply within one business day.">
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 28 }}>
        {/* details */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
          <div style={{ background: '#fff', border: '1px solid #e6ece9', borderRadius: 14, padding: 18 }}>
            <div style={{ fontSize: 13, color: '#6b7c73', marginBottom: 4 }}>Email</div>
            <a href="mailto:crisrosbert@gmail.com" style={{ fontSize: 15, fontWeight: 600, color: BRAND_DEEP, textDecoration: 'none' }}>crisrosbert@gmail.com</a>
          </div>
          <div style={{ background: '#fff', border: '1px solid #e6ece9', borderRadius: 14, padding: 18 }}>
            <div style={{ fontSize: 13, color: '#6b7c73', marginBottom: 4 }}>WhatsApp</div>
            <a href="https://wa.me/918796437535" style={{ fontSize: 15, fontWeight: 600, color: BRAND_DEEP, textDecoration: 'none' }}>+91 87964 37535</a>
          </div>
          <div style={{ background: '#fff', border: '1px solid #e6ece9', borderRadius: 14, padding: 18 }}>
            <div style={{ fontSize: 13, color: '#6b7c73', marginBottom: 4 }}>Business</div>
            <div style={{ fontSize: 15, fontWeight: 600 }}>Clickstream WA</div>
            <div style={{ fontSize: 13, color: '#6b7c73', marginTop: 2 }}>India</div>
          </div>
        </div>

        {/* form */}
        <div style={{ background: '#fff', border: '1px solid #e6ece9', borderRadius: 16, padding: 24, maxWidth: 560 }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700, margin: '0 0 16px' }}>Send us a message</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Your name</label>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Amit Sharma"
                style={inputStyle} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@business.com"
                style={inputStyle} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Message</label>
              <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={4} placeholder="How can we help?"
                style={{ ...inputStyle, resize: 'vertical' }} />
            </div>
            <a
              href={mailto}
              style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                background: `linear-gradient(180deg, ${BRAND}, ${BRAND_DEEP})`, color: '#fff',
                fontWeight: 600, borderRadius: 11, padding: '12px 22px', fontSize: 15,
                textDecoration: 'none', boxShadow: '0 8px 18px rgba(26,162,96,.26)',
              }}
            >
              Send message
            </a>
            <p style={{ fontSize: 12, color: '#9aa8a0', margin: 0 }}>
              This opens your email app with the message pre-filled. You can also email us directly.
            </p>
          </div>
        </div>
      </div>
    </LegalShell>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  border: '1px solid #e6ece9',
  borderRadius: 10,
  padding: '11px 13px',
  fontSize: 15,
  fontFamily: 'var(--font-sans)',
  color: '#0b231a',
  outline: 'none',
  background: '#fff',
}
