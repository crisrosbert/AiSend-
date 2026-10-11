'use client'

// src/app/tools/whatsapp-qr-code/qr-code-tool.tsx
//
// The QR code maker. Like the link generator it needs nothing from the rest
// of the app: the number, the link and any logo you add stay in this tab.
//
// The picture is one SVG (lib/tools/qr-svg.ts). The preview shows it, the SVG
// download saves it, and the PNG download draws it onto a canvas at the size
// chosen, so what you see is what you print.

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { COUNTRIES, buildWhatsAppLink } from '@/lib/tools/wa-link'
import { PRESET_EVENT, type PresetDetail } from '@/lib/tools/landing-config'
import { buildMatrix, eccForOptions, renderQrSvg, type DotStyle, type QrLogo } from '@/lib/tools/qr-svg'
import { normalizeHex, parseWhatsAppShareLink, qrReadability } from '@/lib/tools/qr-style'
import { Icon } from '@/components/tools/landing/icons'

type Mode = 'chat' | 'link'
type LogoChoice = 'none' | 'chat' | 'image'

const CODE_COLOURS = [
  { name: 'Ink', hex: '#0c1f17' },
  { name: 'Emerald', hex: '#1b6b4a' },
  { name: 'Deep green', hex: '#14523a' },
  { name: 'Navy', hex: '#123c69' },
  { name: 'Plum', hex: '#5b2a86' },
  { name: 'Black', hex: '#000000' },
]
const BACKGROUNDS = [
  { name: 'White', hex: '#ffffff' },
  { name: 'Mint', hex: '#f0faf3' },
  { name: 'Cream', hex: '#fff6d6' },
]
const DOT_STYLES: Array<{ id: DotStyle; label: string }> = [
  { id: 'square', label: 'Square' },
  { id: 'rounded', label: 'Rounded' },
  { id: 'dots', label: 'Dots' },
]
const PNG_SIZES = [
  { px: 512, label: 'Small (512 px)' },
  { px: 1024, label: 'Medium (1024 px)' },
  { px: 2048, label: 'Print (2048 px)' },
]
const QUICK_MESSAGES = [
  { label: 'Order', text: 'Hi! I scanned your QR code and would like to place an order.' },
  { label: 'Enquiry', text: 'Hi! I scanned your QR code and have a question.' },
  { label: 'Book', text: 'Hi! I scanned your QR code and would like to book.' },
]

const PHONE_PROBLEMS: Record<'too-short' | 'too-long', string> = {
  'too-short': 'That number looks too short. Check the country code and the digits.',
  'too-long': 'That number looks too long. Check the country code, and remove any digits you typed twice.',
}
const LINK_PROBLEMS: Record<'not-whatsapp' | 'missing-code', string> = {
  'not-whatsapp': 'That is not a WhatsApp group or channel link. It should start with chat.whatsapp.com or whatsapp.com/channel.',
  'missing-code': 'The link is missing its invite code at the end. Copy the whole link from WhatsApp.',
}

const SAMPLE_TEXT = 'https://wa.me/919876543210'
const MAX_LOGO_FILE = 2 * 1024 * 1024

/** Shrinks an uploaded logo so the SVG stays small. Resolves to a PNG data URL. */
function readLogo(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('read'))
    reader.onload = () => {
      const img = new Image()
      img.onerror = () => reject(new Error('decode'))
      img.onload = () => {
        const max = 192
        const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight))
        const canvas = document.createElement('canvas')
        canvas.width = Math.max(1, Math.round(img.naturalWidth * k))
        canvas.height = Math.max(1, Math.round(img.naturalHeight * k))
        const ctx = canvas.getContext('2d')
        if (!ctx) return reject(new Error('canvas'))
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
        resolve(canvas.toDataURL('image/png'))
      }
      img.src = String(reader.result)
    }
    reader.readAsDataURL(file)
  })
}

function svgToPng(svg: string, px: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const ratio = (() => {
      const m = svg.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/)
      return m ? Number(m[2]) / Number(m[1]) : 1
    })()
    const img = new Image()
    img.onerror = () => reject(new Error('render'))
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = px
      canvas.height = Math.round(px * ratio)
      const ctx = canvas.getContext('2d')
      if (!ctx) return reject(new Error('canvas'))
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('png'))), 'image/png')
    }
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
  })
}

function save(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

export function QrCodeTool() {
  const [mode, setMode] = useState<Mode>('chat')
  const [countryCode, setCountryCode] = useState('91')
  const [phone, setPhone] = useState('')
  const [message, setMessage] = useState('Hi! I scanned your QR code and have a question.')
  const [shareInput, setShareInput] = useState('')

  const [dots, setDots] = useState<DotStyle>('rounded')
  const [fg, setFg] = useState('#14523a')
  const [fgText, setFgText] = useState('#14523a')
  const [bg, setBg] = useState('#ffffff')
  const [logoChoice, setLogoChoice] = useState<LogoChoice>('none')
  const [logoImage, setLogoImage] = useState<string | null>(null)
  const [logoError, setLogoError] = useState<string | null>(null)
  const [frameOn, setFrameOn] = useState(false)
  const [frameText, setFrameText] = useState('Scan to chat')
  const [pngPx, setPngPx] = useState(1024)

  const [copied, setCopied] = useState(false)
  const [busy, setBusy] = useState(false)
  const [exportError, setExportError] = useState(false)
  const messageBox = useRef<HTMLTextAreaElement>(null)
  const logoInput = useRef<HTMLInputElement>(null)

  // ── what the code will open ────────────────────────────────────────────
  const chatResult = useMemo(() => buildWhatsAppLink({ countryCode, phone, message }), [countryCode, phone, message])
  const shareResult = useMemo(() => parseWhatsAppShareLink(shareInput), [shareInput])

  const target = mode === 'chat' ? (chatResult.ok ? chatResult.link : '') : shareResult.ok ? shareResult.url : ''
  const problem =
    mode === 'chat'
      ? !chatResult.ok && chatResult.reason !== 'empty' ? PHONE_PROBLEMS[chatResult.reason] : null
      : !shareResult.ok && shareResult.reason !== 'empty' ? LINK_PROBLEMS[shareResult.reason] : null

  // ── how it looks ───────────────────────────────────────────────────────
  const readability = qrReadability(fg, bg)
  const logo: QrLogo =
    logoChoice === 'chat'
      ? { kind: 'chat', color: normalizeHex(fg) ?? '#14523a' }
      : logoChoice === 'image' && logoImage
        ? { kind: 'image', dataUrl: logoImage }
        : { kind: 'none' }

  const svg = useMemo(() => {
    const safeFg = normalizeHex(fg) ?? '#0c1f17'
    const safeBg = normalizeHex(bg) ?? '#ffffff'
    const opts = { fg: safeFg, bg: safeBg, dots, logo, frameLabel: frameOn ? frameText : '' }
    const text = target || SAMPLE_TEXT
    return renderQrSvg(buildMatrix(text, eccForOptions(opts)), opts)
    // `logo` is rebuilt every render from the values below
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, fg, bg, dots, logoChoice, logoImage, frameOn, frameText])

  const previewSrc = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
  const canDownload = Boolean(target) && readability.status !== 'low-contrast'

  // Cards further down the page load a ready-made message and style.
  useEffect(() => {
    const onPreset = (e: Event) => {
      const { message: next, data } = (e as CustomEvent<PresetDetail>).detail ?? {}
      if (typeof next === 'string') {
        setMode('chat')
        setMessage(next)
        messageBox.current?.focus({ preventScroll: true })
      }
      if (data?.frame) { setFrameOn(true); setFrameText(data.frame) }
      if (data?.dots === 'square' || data?.dots === 'rounded' || data?.dots === 'dots') setDots(data.dots)
    }
    window.addEventListener(PRESET_EVENT, onPreset)
    return () => window.removeEventListener(PRESET_EVENT, onPreset)
  }, [])

  function chooseColour(hex: string) {
    setFg(hex)
    setFgText(hex)
  }

  function onFgText(value: string) {
    setFgText(value)
    const hex = normalizeHex(value)
    if (hex) setFg(hex)
  }

  async function onLogoFile(file: File | undefined) {
    setLogoError(null)
    if (!file) return
    if (!/^image\/(png|jpeg|webp)$/.test(file.type)) {
      setLogoError('Use a PNG, JPG or WebP image.')
      return
    }
    if (file.size > MAX_LOGO_FILE) {
      setLogoError('That image is over 2 MB. Pick a smaller one.')
      return
    }
    try {
      setLogoImage(await readLogo(file))
      setLogoChoice('image')
    } catch {
      setLogoError('We could not read that image. Try another one.')
    }
  }

  const baseName = mode === 'chat' && chatResult.ok ? `whatsapp-qr-${chatResult.number}` : 'whatsapp-group-qr'

  async function downloadPng() {
    if (!canDownload) return
    setBusy(true)
    setExportError(false)
    try {
      save(await svgToPng(svg, pngPx), `${baseName}.png`)
    } catch {
      setExportError(true)
    } finally {
      setBusy(false)
    }
  }

  function downloadSvg() {
    if (!canDownload) return
    save(new Blob([svg], { type: 'image/svg+xml' }), `${baseName}.svg`)
  }

  async function copyLink() {
    if (!target) return
    try {
      await navigator.clipboard.writeText(target)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      /* clipboard blocked: the link is also shown under the code */
    }
  }

  return (
    <div id="generator" className="tl-toolwrap">
      <div className="tl-tool">
        <div className="tl-toolcard">
          {/* 1. What it opens */}
          <div className="tl-tstep">
            <span className="tl-tnum" aria-hidden="true">1</span>
            <div className="tl-tbody">
              <span className="tl-label" id="qr-what">What should the code open?</span>
              <div className="tl-seg" role="group" aria-labelledby="qr-what">
                <button type="button" aria-pressed={mode === 'chat'} onClick={() => setMode('chat')}>A chat with my number</button>
                <button type="button" aria-pressed={mode === 'link'} onClick={() => setMode('link')}>A group or channel</button>
              </div>

              {mode === 'chat' ? (
                <>
                  <label className="tl-label tl-label--gap" htmlFor="qr-phone">Your WhatsApp number</label>
                  <div className="tl-row">
                    <select
                      className="tl-select tl-select--cc" value={countryCode} aria-label="Country code"
                      onChange={(e) => setCountryCode(e.target.value)}
                    >
                      {COUNTRIES.map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}
                    </select>
                    <input
                      id="qr-phone" className="tl-input" inputMode="tel" autoComplete="tel-national" placeholder="98765 43210"
                      value={phone} onChange={(e) => setPhone(e.target.value)}
                      aria-invalid={problem ? true : undefined} aria-describedby="qr-target-help"
                    />
                  </div>

                  <label className="tl-label tl-label--gap" htmlFor="qr-message">
                    First message <span className="tl-opt">(optional)</span>
                  </label>
                  <div className="tl-chips" role="group" aria-label="Quick messages">
                    {QUICK_MESSAGES.map((q) => (
                      <button key={q.label} type="button" className="tl-qchip" onClick={() => setMessage(q.text)}>{q.label}</button>
                    ))}
                  </div>
                  <textarea
                    id="qr-message" ref={messageBox} className="tl-textarea" value={message}
                    onChange={(e) => setMessage(e.target.value)} placeholder="What should people say when the chat opens?"
                  />
                </>
              ) : (
                <>
                  <label className="tl-label tl-label--gap" htmlFor="qr-share">Group or channel link</label>
                  <input
                    id="qr-share" className="tl-input" inputMode="url" autoComplete="off" spellCheck={false}
                    placeholder="https://chat.whatsapp.com/…" value={shareInput}
                    onChange={(e) => setShareInput(e.target.value)}
                    aria-invalid={problem ? true : undefined} aria-describedby="qr-target-help"
                  />
                </>
              )}

              {problem ? (
                <p id="qr-target-help" className="tl-error" role="alert">{problem}</p>
              ) : (
                <p id="qr-target-help" className="tl-hint">
                  {mode === 'chat'
                    ? 'Spaces, dashes and a leading 0 are fine. The message waits in the chat box and your customer taps send.'
                    : 'In WhatsApp, open the group or channel, copy its invite link and paste it here.'}
                </p>
              )}
            </div>
          </div>

          {/* 2. Style */}
          <div className="tl-tstep">
            <span className="tl-tnum" aria-hidden="true">2</span>
            <div className="tl-tbody">
              <span className="tl-label" id="qr-style">Make it yours</span>

              <span className="tl-sublabel" id="qr-dots">Shape</span>
              <div className="tl-seg" role="group" aria-labelledby="qr-dots">
                {DOT_STYLES.map((d) => (
                  <button key={d.id} type="button" aria-pressed={dots === d.id} onClick={() => setDots(d.id)}>{d.label}</button>
                ))}
              </div>

              <span className="tl-sublabel" id="qr-colour">Code colour</span>
              <div className="tl-swatches" role="group" aria-labelledby="qr-colour">
                {CODE_COLOURS.map((c) => (
                  <button
                    key={c.hex} type="button" className="tl-swatch" style={{ background: c.hex }}
                    aria-pressed={fg === c.hex} aria-label={c.name} title={c.name} onClick={() => chooseColour(c.hex)}
                  />
                ))}
                <input
                  className="tl-input tl-input--hex" value={fgText} onChange={(e) => onFgText(e.target.value)}
                  aria-label="Custom code colour (hex)" spellCheck={false} maxLength={7}
                  aria-invalid={normalizeHex(fgText) ? undefined : true}
                />
              </div>

              <span className="tl-sublabel" id="qr-bg">Background</span>
              <div className="tl-swatches" role="group" aria-labelledby="qr-bg">
                {BACKGROUNDS.map((c) => (
                  <button
                    key={c.hex} type="button" className="tl-swatch tl-swatch--light" style={{ background: c.hex }}
                    aria-pressed={bg === c.hex} aria-label={c.name} title={c.name} onClick={() => setBg(c.hex)}
                  />
                ))}
              </div>

              {readability.status === 'low-contrast' && (
                <p className="tl-error" role="alert">
                  These colours are too close together for a phone to read. Pick a darker code colour or a lighter background.
                </p>
              )}
              {readability.status === 'inverted' && (
                <p className="tl-warn" role="status">
                  A light code on a dark background is not read by some older phones. A dark code on a light background works everywhere.
                </p>
              )}

              <span className="tl-sublabel" id="qr-mid">In the middle</span>
              <div className="tl-seg" role="group" aria-labelledby="qr-mid">
                <button type="button" aria-pressed={logoChoice === 'none'} onClick={() => setLogoChoice('none')}>Nothing</button>
                <button type="button" aria-pressed={logoChoice === 'chat'} onClick={() => setLogoChoice('chat')}>Chat icon</button>
                <button type="button" aria-pressed={logoChoice === 'image'} onClick={() => logoInput.current?.click()}>
                  Your logo
                </button>
              </div>
              <input
                ref={logoInput} type="file" accept="image/png,image/jpeg,image/webp" hidden
                aria-label="Upload your logo"
                onChange={(e) => { void onLogoFile(e.target.files?.[0]); e.target.value = '' }}
              />
              {logoError && <p className="tl-error" role="alert">{logoError}</p>}
              {logoChoice !== 'none' && (
                <p className="tl-hint">The code is built with the strongest error correction so the middle can be covered. Scan it once before you print.</p>
              )}

              <span className="tl-sublabel">Label under the code</span>
              <div className="tl-row tl-row--center">
                <label className="tl-check">
                  <input type="checkbox" checked={frameOn} onChange={(e) => setFrameOn(e.target.checked)} />
                  <span>Add a frame with a label</span>
                </label>
              </div>
              {frameOn && (
                <input
                  className="tl-input" style={{ marginTop: 10 }} value={frameText} maxLength={28}
                  onChange={(e) => setFrameText(e.target.value)} aria-label="Label text" placeholder="Scan to chat"
                />
              )}
            </div>
          </div>

          {/* 3. Download */}
          <div className={`tl-tstep${canDownload ? '' : ' tl-tstep--off'}`}>
            <span className="tl-tnum" aria-hidden="true">3</span>
            <div className="tl-tbody">
              <span className="tl-label">Download and test</span>
              <div className="tl-row tl-row--center">
                <label className="tl-sublabel tl-sublabel--inline" htmlFor="qr-size">Picture size</label>
                <select id="qr-size" className="tl-select tl-select--size" value={pngPx} onChange={(e) => setPngPx(Number(e.target.value))}>
                  {PNG_SIZES.map((s) => <option key={s.px} value={s.px}>{s.label}</option>)}
                </select>
              </div>
              <div className="tl-actions">
                <button type="button" className="tl-btn tl-btn--primary tl-btn--sm" disabled={!canDownload || busy} onClick={downloadPng}>
                  <Icon name="download" size={17} />
                  {busy ? 'Preparing…' : 'Download PNG'}
                </button>
                <button type="button" className="tl-btn tl-btn--ghost tl-btn--sm" disabled={!canDownload} onClick={downloadSvg}>
                  <Icon name="download" size={16} />
                  Download SVG
                </button>
                <button type="button" className="tl-btn tl-btn--ghost tl-btn--sm" disabled={!target} onClick={copyLink}>
                  <Icon name={copied ? 'check' : 'copy'} size={16} strokeWidth={copied ? 2.4 : 1.8} />
                  {copied ? 'Copied' : 'Copy link'}
                </button>
                <a
                  className="tl-btn tl-btn--ghost tl-btn--sm" href={target || undefined} target="_blank" rel="noopener noreferrer"
                  aria-disabled={!target} onClick={(e) => { if (!target) e.preventDefault() }}
                >
                  <Icon name="external" size={16} />
                  Test the link
                </a>
              </div>
              {exportError && <p className="tl-error" role="alert">The picture could not be prepared in this browser. Try the SVG download instead.</p>}
              <p className="tl-hint">PNG is for screens and quick printing. SVG stays sharp at any size, so send it to your printer for posters and boards.</p>
            </div>
          </div>

          <p className="tl-toolfoot">
            Nothing you type or upload here is saved or sent anywhere. The code is drawn entirely in your browser.
          </p>
        </div>

        <aside className="tl-prevcol" aria-label="Preview">
          <p className="tl-prevcap">{target ? 'Your QR code' : 'A sample. Add your details to make yours'}</p>
          <div className={`tl-qrprev${target ? '' : ' tl-qrprev--sample'}`}>
            {/* data: URL generated in the browser, so next/image has nothing to optimise */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={previewSrc} alt={target ? 'Preview of your WhatsApp QR code' : 'Sample QR code'} />
          </div>
          {target && <p className="tl-qrprev__link">{target.length > 54 ? `${target.slice(0, 52)}…` : target}</p>}
          <p className="tl-qrprev__tip">
            <Icon name="scan" size={16} />
            Scan it with your own phone before you print.
          </p>
        </aside>
      </div>

      <p className="tl-upsell">
        Want every scan to land in a shared team inbox, with automatic replies and follow-ups?{' '}
        <Link href="/signup">Try AiSend free</Link>
      </p>
    </div>
  )
}
