'use client'

// src/app/tools/whatsapp-link-generator/link-generator-tool.tsx
//
// The actual tool. Deliberately has ZERO dependency on the rest of the
// app — no Supabase, no auth, no API route. Everything happens in the
// browser: the phone number never leaves this tab, nothing is ever
// saved anywhere. That's not just simpler, it's the point — a visitor
// should be able to trust a "free tool" page with their number, and a
// page that quietly phones home with it would deserve the opposite.
//
// The link appears as soon as the number is valid (no extra "generate"
// click), and the preview shows what the visitor will really see: the
// message waiting in the chat box, NOT already sent — a pre-filled
// message is never sent until the person taps send themselves.

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import QRCode from 'qrcode'
import Link from 'next/link'
import { COUNTRIES, buildWhatsAppLink } from '@/lib/tools/wa-link'
import { PRESET_EVENT } from '@/lib/tools/landing-config'
import { Icon } from '@/components/tools/landing/icons'

const QUICK_MESSAGES = [
  { label: 'Pricing', text: 'Hi! Could you share your pricing and plans?' },
  { label: 'Book a demo', text: "Hi! I'd like to book a demo." },
  { label: 'Order enquiry', text: 'Hi! I have a question about my order.' },
  { label: 'Support', text: 'Hi! I need some help with something.' },
]

const PHONE_PROBLEMS: Record<'too-short' | 'too-long', string> = {
  'too-short': 'That number looks too short. Check the country code and the digits.',
  'too-long': 'That number looks too long. Check the country code, and remove any digits you typed twice.',
}

// The share sheet exists on phones and some browsers. Read once, and report
// "no" while rendering on the server so the first paint matches.
const noSubscription = () => () => {}
const supportsShare = () => typeof navigator.share === 'function'
const serverSupportsShare = () => false

export function LinkGeneratorTool() {
  const [countryCode, setCountryCode] = useState('91')
  const [phone, setPhone] = useState('')
  const [message, setMessage] = useState("Hi! I'd like to know more about your services.")
  const [copied, setCopied] = useState(false)
  const [qr, setQr] = useState<{ link: string; url: string } | null>(null)
  const canShare = useSyncExternalStore(noSubscription, supportsShare, serverSupportsShare)
  const linkBox = useRef<HTMLDivElement>(null)
  const messageBox = useRef<HTMLTextAreaElement>(null)

  const result = useMemo(
    () => buildWhatsAppLink({ countryCode, phone, message }),
    [countryCode, phone, message],
  )
  const link = result.ok ? result.link : ''
  // A QR drawn for an older link is never shown for the current one.
  const qrDataUrl = qr && qr.link === link ? qr.url : null
  const phoneProblem = !result.ok && result.reason !== 'empty' ? PHONE_PROBLEMS[result.reason] : null

  // Cards further down the page load a ready-made message into the box.
  useEffect(() => {
    const onPreset = (e: Event) => {
      const next = (e as CustomEvent<{ message?: string }>).detail?.message
      if (typeof next === 'string') {
        setMessage(next)
        messageBox.current?.focus({ preventScroll: true })
      }
    }
    window.addEventListener(PRESET_EVENT, onPreset)
    return () => window.removeEventListener(PRESET_EVENT, onPreset)
  }, [])

  // QR is drawn at 4x its on-screen size so the downloaded PNG prints sharply.
  useEffect(() => {
    if (!link) return
    let stale = false
    QRCode.toDataURL(link, { width: 512, margin: 2, color: { dark: '#0c1f17', light: '#ffffff' } })
      .then((url) => { if (!stale) setQr({ link, url }) })
      .catch(() => { if (!stale) setQr(null) })
    return () => { stale = true }
  }, [link])

  async function copy() {
    if (!link) return
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      // Clipboard blocked (older browser, insecure context): select the link
      // so Ctrl+C / long-press still works.
      const box = linkBox.current
      if (box) {
        const range = document.createRange()
        range.selectNodeContents(box)
        const selection = window.getSelection()
        selection?.removeAllRanges()
        selection?.addRange(range)
      }
    }
  }

  function share() {
    if (!link) return
    navigator.share({ title: 'Chat with me on WhatsApp', url: link }).catch(() => {
      /* the person closed the share sheet */
    })
  }

  const shownNumber = phone.trim() ? `${phone.trim().startsWith('+') ? '' : `+${countryCode} `}${phone.trim()}` : `+${countryCode} …`

  return (
    <div id="generator" className="tl-toolwrap">
      <div className="tl-tool">
      <div className="tl-toolcard">
        <div className="tl-tstep">
          <span className="tl-tnum" aria-hidden="true">1</span>
          <div className="tl-tbody">
            <label className="tl-label" htmlFor="wlg-phone">Your WhatsApp number</label>
            <div className="tl-row">
              <select
                className="tl-select tl-select--cc" value={countryCode} aria-label="Country code"
                onChange={(e) => setCountryCode(e.target.value)}
              >
                {COUNTRIES.map((c) => (
                  <option key={c.code} value={c.code}>{c.label}</option>
                ))}
              </select>
              <input
                id="wlg-phone" className="tl-input" inputMode="tel" autoComplete="tel-national" placeholder="98765 43210"
                value={phone} onChange={(e) => setPhone(e.target.value)}
                aria-invalid={phoneProblem ? true : undefined} aria-describedby="wlg-phone-help"
              />
            </div>
            {phoneProblem ? (
              <p id="wlg-phone-help" className="tl-error" role="alert">{phoneProblem}</p>
            ) : (
              <p id="wlg-phone-help" className="tl-hint">
                Pick the country, then type the number. Spaces, dashes and a leading 0 are fine.
              </p>
            )}
          </div>
        </div>

        <div className="tl-tstep">
          <span className="tl-tnum" aria-hidden="true">2</span>
          <div className="tl-tbody">
            <label className="tl-label" htmlFor="wlg-message">
              First message <span className="tl-opt">(optional)</span>
            </label>
            <div className="tl-chips" role="group" aria-label="Quick messages">
              {QUICK_MESSAGES.map((q) => (
                <button key={q.label} type="button" className="tl-qchip" onClick={() => setMessage(q.text)}>
                  {q.label}
                </button>
              ))}
            </div>
            <textarea
              id="wlg-message" ref={messageBox} className="tl-textarea" value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder='e.g. "Hi! I want to know more about your services"'
            />
            <p className="tl-hint">It waits in the chat box. Your customer taps send.</p>
          </div>
        </div>

        <div className={`tl-tstep${link ? '' : ' tl-tstep--off'}`}>
          <span className="tl-tnum" aria-hidden="true">3</span>
          <div className="tl-tbody">
            <span className="tl-label" id="wlg-link-label">Your link</span>
            <div className="tl-linkrow">
              <div
                ref={linkBox} aria-labelledby="wlg-link-label" aria-live="polite"
                className={`tl-linkbox${link ? '' : ' tl-linkbox--empty'}`}
              >
                {link || 'Enter your number and your link appears here'}
              </div>
            </div>

            <div className="tl-actions">
              <button type="button" className="tl-btn tl-btn--primary tl-btn--sm" disabled={!link} onClick={copy}>
                <Icon name={copied ? 'check' : 'copy'} size={17} strokeWidth={copied ? 2.4 : 1.8} />
                {copied ? 'Copied' : 'Copy link'}
              </button>
              <a
                className="tl-btn tl-btn--ghost tl-btn--sm" href={link || undefined} target="_blank" rel="noopener noreferrer"
                aria-disabled={!link} onClick={(e) => { if (!link) e.preventDefault() }}
              >
                <Icon name="external" size={16} />
                Test in WhatsApp
              </a>
              {qrDataUrl && (
                <a className="tl-btn tl-btn--ghost tl-btn--sm" href={qrDataUrl} download="whatsapp-link-qr.png">
                  <Icon name="download" size={16} />
                  Download QR
                </a>
              )}
              {canShare && link && (
                <button type="button" className="tl-btn tl-btn--ghost tl-btn--sm" onClick={share}>
                  <Icon name="share" size={16} />
                  Share
                </button>
              )}
            </div>

            {qrDataUrl && (
              <div className="tl-qr">
                {/* data: URL generated in the browser, so next/image has nothing to optimise */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={qrDataUrl} alt="QR code for your WhatsApp link" width={124} height={124} />
                <div>
                  <b>Scan to chat</b>
                  <p>Print it on a poster, packaging or a business card. Phones open the chat straight from the camera.</p>
                </div>
              </div>
            )}
          </div>
        </div>

        <p className="tl-toolfoot">
          Nothing you type here is saved or sent anywhere. The link is built entirely in your browser.
        </p>
      </div>

      <aside className="tl-prevcol" aria-label="Preview">
        <p className="tl-prevcap">What your customer sees when they tap</p>
        <div className="tl-phone">
          <div className="tl-phone__head">
            <span className="tl-phone__avatar"><Icon name="store" size={17} /></span>
            <div style={{ minWidth: 0 }}>
              <div className="tl-phone__name" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {shownNumber}
              </div>
              <div className="tl-phone__status">WhatsApp chat</div>
            </div>
          </div>
          <div className="tl-phone__body">
            <span className="tl-day">Today</span>
          </div>
          <div className="tl-phone__foot tl-phone__foot--tall">
            <span className={`tl-phone__input${message.trim() ? ' tl-phone__input--filled' : ''}`}>
              {message.trim() || 'Message'}
            </span>
            <span className="tl-phone__send"><Icon name="send" size={16} /></span>
          </div>
        </div>
      </aside>
      </div>

      <p className="tl-upsell">
        Want to message thousands of contacts instead of one at a time, with delivery tracking and auto-replies?{' '}
        <Link href="/signup">Try AiSend free</Link>
      </p>
    </div>
  )
}
