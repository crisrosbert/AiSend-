'use client'

// src/app/tools/whatsapp-link-generator/link-generator-tool.tsx
//
// The actual tool. Deliberately has ZERO dependency on the rest of the
// app — no Supabase, no auth, no API route. Everything happens in the
// browser: the phone number never leaves this tab, nothing is ever
// saved anywhere. That's not just simpler, it's the point — a visitor
// should be able to trust a "free tool" page with their number, and a
// page that quietly phones home with it would deserve the opposite.

import { useMemo, useState } from 'react'
import QRCode from 'qrcode'
import Link from 'next/link'

const COUNTRIES = [
  { code: '91', label: '🇮🇳 India (+91)' },
  { code: '55', label: '🇧🇷 Brazil (+55)' },
  { code: '62', label: '🇮🇩 Indonesia (+62)' },
  { code: '234', label: '🇳🇬 Nigeria (+234)' },
  { code: '60', label: '🇲🇾 Malaysia (+60)' },
  { code: '20', label: '🇪🇬 Egypt (+20)' },
  { code: '92', label: '🇵🇰 Pakistan (+92)' },
  { code: '880', label: '🇧🇩 Bangladesh (+880)' },
  { code: '971', label: '🇦🇪 UAE (+971)' },
  { code: '966', label: '🇸🇦 Saudi Arabia (+966)' },
  { code: '27', label: '🇿🇦 South Africa (+27)' },
  { code: '63', label: '🇵🇭 Philippines (+63)' },
  { code: '52', label: '🇲🇽 Mexico (+52)' },
  { code: '1', label: '🇺🇸 US / Canada (+1)' },
  { code: '44', label: '🇬🇧 UK (+44)' },
]

function digitsOnly(value: string): string {
  return value.replace(/\D/g, '')
}

export function LinkGeneratorTool() {
  const [countryCode, setCountryCode] = useState('91')
  const [phone, setPhone] = useState('')
  const [message, setMessage] = useState('Hi! I found you on WhatsApp and wanted to reach out.')
  const [copied, setCopied] = useState(false)
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)
  const [qrError, setQrError] = useState(false)

  const phoneDigits = digitsOnly(phone)
  const isValidPhone = phoneDigits.length >= 6 && phoneDigits.length <= 14

  const link = useMemo(() => {
    if (!isValidPhone) return ''
    const params = message.trim() ? `?text=${encodeURIComponent(message.trim())}` : ''
    return `https://wa.me/${countryCode}${phoneDigits}${params}`
  }, [countryCode, phoneDigits, isValidPhone, message])

  async function handleGenerate() {
    if (!link) return
    setQrError(false)
    try {
      const dataUrl = await QRCode.toDataURL(link, {
        width: 220,
        margin: 1,
        color: { dark: '#0c1f17', light: '#ffffff' },
      })
      setQrDataUrl(dataUrl)
    } catch {
      setQrError(true)
    }
  }

  function handleCopy() {
    if (!link) return
    navigator.clipboard.writeText(link).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    })
  }

  return (
    <div className="wlg-grid">
      <style>{`
        .wlg-grid { display: grid; grid-template-columns: 1fr 340px; gap: 32px; align-items: start; }
        @media (max-width: 860px) { .wlg-grid { grid-template-columns: 1fr; } }

        .wlg-card { min-width: 0; background: #fff; border: 1px solid #e6ece9; border-radius: 18px; padding: 28px; box-shadow: 0 8px 24px -14px rgba(11,35,26,.12); }
        .wlg-label { display: block; font-size: 13px; font-weight: 700; color: #0c1f17; margin-bottom: 6px; }
        .wlg-row { display: flex; gap: 10px; }
        .wlg-select, .wlg-input, .wlg-textarea {
          width: 100%; border: 1.5px solid #e2e8e4; border-radius: 10px; padding: 11px 13px;
          font-size: 14.5px; font-family: inherit; color: #0c1f17; background: #fbfdfc; outline: none;
        }
        .wlg-select:focus, .wlg-input:focus, .wlg-textarea:focus { border-color: #25D366; background: #fff; }
        .wlg-select { flex: 0 0 168px; }
        .wlg-textarea { resize: vertical; min-height: 76px; }
        .wlg-hint { font-size: 12px; color: #8a978f; margin-top: 5px; }
        .wlg-field { margin-top: 18px; }
        .wlg-field:first-child { margin-top: 0; }

        .wlg-btn {
          margin-top: 22px; width: 100%; border: none; border-radius: 12px; padding: 14px;
          background: linear-gradient(180deg, #25D366, #1DA851); color: #04150f; font-weight: 800; font-size: 15px;
          cursor: pointer; box-shadow: 0 10px 24px -10px rgba(29,168,81,.55);
        }
        .wlg-btn:disabled { opacity: .45; cursor: default; box-shadow: none; }

        .wlg-result { margin-top: 20px; border-top: 1px solid #eef2f0; padding-top: 20px; }
        .wlg-linkrow { display: flex; gap: 8px; align-items: center; min-width: 0; }
        .wlg-linkbox {
          flex: 1; min-width: 0; font-family: 'JetBrains Mono', monospace; font-size: 12.5px; color: #0f4a35;
          background: #f0faf3; border: 1px solid #cdeee5; border-radius: 9px; padding: 10px 12px;
          overflow-x: auto; white-space: nowrap;
        }
        .wlg-copybtn {
          flex-shrink: 0; border: 1px solid #cdeee5; background: #fff; color: #0f6e37; font-weight: 700;
          font-size: 13px; border-radius: 9px; padding: 10px 14px; cursor: pointer;
        }
        .wlg-qr { margin-top: 16px; display: flex; align-items: center; gap: 14px; }
        .wlg-qr img { border-radius: 10px; border: 1px solid #eef2f0; }

        /* phone preview */
        .wlg-phone { background: #fff; border: 1px solid #e6ece9; border-radius: 22px; overflow: hidden; box-shadow: 0 8px 24px -14px rgba(11,35,26,.12); }
        .wlg-phone-head { background: #075E54; color: #fff; padding: 14px 16px; display: flex; align-items: center; gap: 10px; }
        .wlg-phone-avatar { width: 30px; height: 30px; border-radius: 50%; background: rgba(255,255,255,.18); flex-shrink: 0; }
        .wlg-phone-body {
          min-height: 220px; padding: 14px;
          background-color: #E9FBEF;
          background-image: radial-gradient(rgba(37,211,102,.16) 1px, transparent 1.5px), radial-gradient(rgba(37,211,102,.10) 1px, transparent 1.5px);
          background-size: 26px 26px, 26px 26px; background-position: 0 0, 13px 13px;
        }
        .wlg-bubble { margin-left: auto; max-width: 88%; background: #C8F5D6; border-radius: 12px 12px 2px 12px; padding: 10px 12px; font-size: 13.5px; color: #0c1f17; box-shadow: 0 1px 2px rgba(0,0,0,.06); }
        .wlg-phone-foot { padding: 10px 14px; border-top: 1px solid #eef2f0; display:flex; align-items:center; }
        .wlg-phone-foot-pill { flex:1; height: 34px; border-radius: 999px; background: #f1f5f3; }
      `}</style>

      <div className="wlg-card">
        <div className="wlg-field">
          <label className="wlg-label">Your WhatsApp number</label>
          <div className="wlg-row">
            <select className="wlg-select" value={countryCode} onChange={(e) => setCountryCode(e.target.value)}>
              {COUNTRIES.map((c) => (
                <option key={c.code} value={c.code}>{c.label}</option>
              ))}
            </select>
            <input
              className="wlg-input"
              inputMode="tel"
              placeholder="87078 79485"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>
          <p className="wlg-hint">Double-check the country code — this is what your customers will message.</p>
        </div>

        <div className="wlg-field">
          <label className="wlg-label">Pre-filled message (optional)</label>
          <textarea
            className="wlg-textarea"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder='e.g. "Hi! I want to know more about your services"'
          />
        </div>

        <button className="wlg-btn" disabled={!isValidPhone} onClick={handleGenerate}>
          Generate my WhatsApp link
        </button>

        {link && (
          <div className="wlg-result">
            <label className="wlg-label">Your link</label>
            <div className="wlg-linkrow">
              <div className="wlg-linkbox">{link}</div>
              <button className="wlg-copybtn" onClick={handleCopy}>{copied ? 'Copied ✓' : 'Copy'}</button>
            </div>

            {qrDataUrl && !qrError && (
              <div className="wlg-qr">
                {/* data: URL, not a remote image — eslint's img warning doesn't apply here */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={qrDataUrl} alt="QR code for your WhatsApp link" width={110} height={110} />
                <div>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#0c1f17' }}>Scan to chat</p>
                  <p style={{ margin: '4px 0 0', fontSize: 12.5, color: '#8a978f', maxWidth: 200 }}>
                    Put this on a poster, business card, or storefront — no typing required.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        <p style={{ marginTop: 18, fontSize: 11.5, color: '#a7b3ac' }}>
          Nothing you type here is saved or sent anywhere — the link is built entirely in your browser.
        </p>
      </div>

      <div className="wlg-phone">
        <div className="wlg-phone-head">
          <div className="wlg-phone-avatar" />
          <div>
            <div style={{ fontSize: 13.5, fontWeight: 700 }}>
              {phone ? `+${countryCode} ${phone}` : `+${countryCode} …`}
            </div>
            <div style={{ fontSize: 10.5, color: 'rgba(255,255,255,.65)' }}>This is how your customer sees it</div>
          </div>
        </div>
        <div className="wlg-phone-body">
          {message.trim() && <div className="wlg-bubble">{message}</div>}
        </div>
        <div className="wlg-phone-foot"><div className="wlg-phone-foot-pill" /></div>
      </div>

      <p style={{ gridColumn: '1 / -1', marginTop: 4, fontSize: 13, color: '#6b7c73' }}>
        Want to send this to thousands of contacts instead of one at a time —
        with delivery tracking and auto-replies?{' '}
        <Link href="/signup" style={{ color: '#0f6e37', fontWeight: 700 }}>Try AiSend free →</Link>
      </p>
    </div>
  )
}
