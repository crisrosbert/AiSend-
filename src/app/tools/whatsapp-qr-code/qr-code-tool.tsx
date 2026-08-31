'use client'

// src/app/tools/whatsapp-qr-code/qr-code-tool.tsx
//
// Same zero-dependency rule as the link generator: everything happens
// in the browser, nothing is saved, no call to the rest of the app.

import { useMemo, useState } from 'react'
import QRCode from 'qrcode'

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

export function QrCodeTool() {
  const [countryCode, setCountryCode] = useState('91')
  const [phone, setPhone] = useState('')
  const [message, setMessage] = useState('')
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)
  const [qrError, setQrError] = useState(false)
  const [generating, setGenerating] = useState(false)

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
    setGenerating(true)
    try {
      const dataUrl = await QRCode.toDataURL(link, {
        width: 560,
        margin: 2,
        color: { dark: '#0c1f17', light: '#ffffff' },
      })
      setQrDataUrl(dataUrl)
    } catch {
      setQrError(true)
    } finally {
      setGenerating(false)
    }
  }

  function handleDownload() {
    if (!qrDataUrl) return
    const a = document.createElement('a')
    a.href = qrDataUrl
    a.download = `whatsapp-qr-${countryCode}${phoneDigits || 'code'}.png`
    document.body.appendChild(a)
    a.click()
    a.remove()
  }

  return (
    <div className="qrt-wrap">
      <style>{`
        .qrt-wrap { display: grid; grid-template-columns: 1fr 320px; gap: 32px; align-items: start; }
        @media (max-width: 820px) { .qrt-wrap { grid-template-columns: 1fr; } }

        .qrt-card { min-width: 0; background: #fff; border: 1px solid #e6ece9; border-radius: 18px; padding: 28px; box-shadow: 0 8px 24px -14px rgba(11,35,26,.12); }
        .qrt-label { display: block; font-size: 13px; font-weight: 700; color: #0c1f17; margin-bottom: 6px; }
        .qrt-row { display: flex; gap: 10px; }
        .qrt-select, .qrt-input {
          border: 1.5px solid #e2e8e4; border-radius: 10px; padding: 11px 13px;
          font-size: 14.5px; font-family: inherit; color: #0c1f17; background: #fbfdfc; outline: none;
        }
        .qrt-select:focus, .qrt-input:focus { border-color: #25D366; background: #fff; }
        .qrt-select { flex: 0 0 168px; }
        .qrt-input { flex: 1; min-width: 0; }
        .qrt-field { margin-top: 18px; }
        .qrt-field:first-child { margin-top: 0; }
        .qrt-hint { font-size: 12px; color: #8a978f; margin-top: 5px; }

        .qrt-btn {
          margin-top: 22px; width: 100%; border: none; border-radius: 12px; padding: 14px;
          background: linear-gradient(180deg, #25D366, #1DA851); color: #04150f; font-weight: 800; font-size: 15px;
          cursor: pointer; box-shadow: 0 10px 24px -10px rgba(29,168,81,.55);
        }
        .qrt-btn:disabled { opacity: .45; cursor: default; box-shadow: none; }

        .qrt-preview {
          background: #fff; border: 1px solid #e6ece9; border-radius: 18px; padding: 24px;
          box-shadow: 0 8px 24px -14px rgba(11,35,26,.12); text-align: center;
        }
        .qrt-preview-empty { color: #a7b3ac; font-size: 13.5px; padding: 40px 12px; }
        .qrt-preview img { width: 100%; max-width: 260px; border-radius: 12px; border: 1px solid #eef2f0; }
        .qrt-download {
          margin-top: 16px; width: 100%; border: 1.5px solid #cdeee5; background: #f0faf3; color: #0f6e37;
          font-weight: 700; font-size: 14px; border-radius: 10px; padding: 11px; cursor: pointer;
        }
      `}</style>

      <div className="qrt-card">
        <div className="qrt-field">
          <label className="qrt-label">Your WhatsApp number</label>
          <div className="qrt-row">
            <select className="qrt-select" value={countryCode} onChange={(e) => setCountryCode(e.target.value)}>
              {COUNTRIES.map((c) => (
                <option key={c.code} value={c.code}>{c.label}</option>
              ))}
            </select>
            <input
              className="qrt-input"
              inputMode="tel"
              placeholder="87078 79485"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>
          <p className="qrt-hint">This is the number people reach when they scan the code.</p>
        </div>

        <div className="qrt-field">
          <label className="qrt-label">Pre-filled message (optional)</label>
          <input
            className="qrt-input"
            style={{ width: '100%' }}
            placeholder='e.g. "I scanned your QR code — tell me more!"'
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />
        </div>

        <button className="qrt-btn" disabled={!isValidPhone || generating} onClick={handleGenerate}>
          {generating ? 'Generating…' : 'Generate QR code'}
        </button>

        <p style={{ marginTop: 18, fontSize: 11.5, color: '#a7b3ac' }}>
          Nothing you type here is saved or sent anywhere — the code is built entirely in your browser.
        </p>
      </div>

      <div className="qrt-preview">
        {qrDataUrl && !qrError ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qrDataUrl} alt="WhatsApp QR code" />
            <button className="qrt-download" onClick={handleDownload}>Download PNG</button>
          </>
        ) : (
          <div className="qrt-preview-empty">
            Your QR code will appear here — big enough to print on a poster, table tent, or packaging.
          </div>
        )}
      </div>
    </div>
  )
}
