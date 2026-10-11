'use client'

// src/app/tools/whatsapp-chat-widget/widget-tool.tsx
//
// The chat button maker. You choose where the chat goes and how the button
// looks, watch it float over a stand-in website, then copy one block of code.
//
// The code itself comes from lib/tools/chat-widget.ts. The preview is an
// iframe that holds the same code, so what you see is what the website gets.
// The iframe is sandboxed: it can run its own script and open WhatsApp, and
// nothing else, and it shares no data with this page.

import { useDeferredValue, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { COUNTRIES, buildWhatsAppLink } from '@/lib/tools/wa-link'
import { PRESET_EVENT, type PresetDetail } from '@/lib/tools/landing-config'
import { normalizeHex } from '@/lib/tools/qr-style'
import {
  DEFAULT_WIDGET,
  buildPreviewDocument,
  buildWidgetSnippet,
  type WidgetConfig,
  type WidgetScreens,
  type WidgetSide,
  type WidgetSize,
} from '@/lib/tools/chat-widget'
import { Icon } from '@/components/tools/landing/icons'

const COLOURS = [
  { name: 'WhatsApp green', hex: '#25d366' },
  { name: 'Deep green', hex: '#1b6b4a' },
  { name: 'Navy', hex: '#123c69' },
  { name: 'Plum', hex: '#5b2a86' },
  { name: 'Charcoal', hex: '#1f2937' },
  { name: 'Crimson', hex: '#b3261e' },
]

const SIZES: Array<{ id: WidgetSize; label: string }> = [
  { id: 'small', label: 'Small' },
  { id: 'medium', label: 'Medium' },
  { id: 'large', label: 'Large' },
]

const SCREENS: Array<{ id: WidgetScreens; label: string }> = [
  { id: 'all', label: 'Everywhere' },
  { id: 'desktop', label: 'Computers only' },
  { id: 'mobile', label: 'Phones only' },
]

const LABEL_CHOICES = ['Chat with us', 'Need help?', 'Message us']

const PLATFORMS: ReadonlyArray<{ name: string; steps: readonly string[]; note?: string }> = [
  {
    name: 'WordPress',
    steps: [
      'Install a plugin that adds code to your footer, such as WPCode or Insert Headers and Footers.',
      'Open the plugin and find the footer box.',
      'Paste the code, then save.',
    ],
    note: 'A plugin is safer than editing theme files, because a theme update will not remove your code.',
  },
  {
    name: 'Shopify',
    steps: [
      'In your Shopify admin, open Online Store, then Themes.',
      'Next to your live theme choose the three dots, then Edit code.',
      'Open the layout folder and the file named theme.liquid.',
      'Paste the code just above the closing body tag and save.',
    ],
  },
  {
    name: 'Wix',
    steps: [
      'Open your site settings and find Custom code.',
      'Choose to add custom code and paste the block.',
      'Set it to load on all pages, at the end of the body.',
      'Apply, then publish your site.',
    ],
    note: 'Custom code may need a paid Wix plan and a connected domain.',
  },
  {
    name: 'Squarespace',
    steps: [
      'Open Settings, then Developer tools, then Code injection.',
      'Paste the code into the footer box.',
      'Save.',
    ],
    note: 'Code injection is available on some Squarespace plans only.',
  },
  {
    name: 'Webflow',
    steps: [
      'Open your project settings and choose Custom code.',
      'Paste the block into the footer code box.',
      'Save, then publish your site.',
    ],
  },
  {
    name: 'Google Tag Manager',
    steps: [
      'Create a new tag and choose Custom HTML.',
      'Paste the whole block into it.',
      'Set the trigger to all pages, then save and publish the container.',
    ],
  },
  {
    name: 'Plain HTML site',
    steps: [
      'Open the page or template file in an editor.',
      'Paste the block just above the closing body tag.',
      'Upload the file and reload your site.',
    ],
  },
]

const PHONE_PROBLEMS: Record<'too-short' | 'too-long', string> = {
  'too-short': 'That number looks too short. Check the country code and the digits.',
  'too-long': 'That number looks too long. Check the country code, and remove any digits you typed twice.',
}

const SAMPLE_LINK = 'https://wa.me/919876543210'
const MAX_PREVIEW_DELAY = 1
/** The preview frame is narrow, so it treats anything under this as a phone. */
const PREVIEW_BREAKPOINT = 480

type Device = 'desktop' | 'mobile'

export function ChatWidgetTool() {
  const [countryCode, setCountryCode] = useState('91')
  const [phone, setPhone] = useState('')
  const [message, setMessage] = useState('Hi! I have a question about your products.')

  const [position, setPosition] = useState<WidgetSide>(DEFAULT_WIDGET.position)
  const [color, setColor] = useState(DEFAULT_WIDGET.color)
  const [colorText, setColorText] = useState(DEFAULT_WIDGET.color)
  const [size, setSize] = useState<WidgetSize>(DEFAULT_WIDGET.size)
  const [offsetX, setOffsetX] = useState(DEFAULT_WIDGET.offsetX)
  const [offsetY, setOffsetY] = useState(DEFAULT_WIDGET.offsetY)
  const [label, setLabel] = useState(DEFAULT_WIDGET.label)
  const [showOn, setShowOn] = useState<WidgetScreens>(DEFAULT_WIDGET.showOn)
  const [pulse, setPulse] = useState(DEFAULT_WIDGET.pulse)

  const [popupOn, setPopupOn] = useState(DEFAULT_WIDGET.popup.enabled)
  const [agentName, setAgentName] = useState(DEFAULT_WIDGET.popup.agentName)
  const [agentRole, setAgentRole] = useState(DEFAULT_WIDGET.popup.agentRole)
  const [popupText, setPopupText] = useState(DEFAULT_WIDGET.popup.message)
  const [cta, setCta] = useState(DEFAULT_WIDGET.popup.cta)
  const [delay, setDelay] = useState(DEFAULT_WIDGET.popup.delaySeconds)
  const [poweredBy, setPoweredBy] = useState(DEFAULT_WIDGET.poweredBy)

  const [device, setDevice] = useState<Device>('desktop')
  const [copied, setCopied] = useState(false)

  // ── the link the chat opens ────────────────────────────────────────────
  const chat = useMemo(() => buildWhatsAppLink({ countryCode, phone, message }), [countryCode, phone, message])
  const link = chat.ok ? chat.link : ''
  const phoneProblem = !chat.ok && chat.reason !== 'empty' ? PHONE_PROBLEMS[chat.reason] : null

  // ── the widget ─────────────────────────────────────────────────────────
  const config: WidgetConfig = useMemo(
    () => ({
      link: link || SAMPLE_LINK,
      position,
      color: normalizeHex(color) ?? DEFAULT_WIDGET.color,
      size,
      offsetX,
      offsetY,
      label,
      showOn,
      pulse,
      poweredBy,
      popup: { enabled: popupOn, delaySeconds: delay, agentName, agentRole, message: popupText, cta },
    }),
    [link, position, color, size, offsetX, offsetY, label, showOn, pulse, poweredBy, popupOn, delay, agentName, agentRole, popupText, cta],
  )

  const snippet = useMemo(() => buildWidgetSnippet(config), [config])

  // The preview opens the popup after a second so you do not wait to see it.
  const previewDoc = useMemo(() => {
    const quick = { ...config, popup: { ...config.popup, delaySeconds: Math.min(config.popup.delaySeconds, MAX_PREVIEW_DELAY) } }
    return buildPreviewDocument(buildWidgetSnippet(quick, { breakpoint: PREVIEW_BREAKPOINT }))
  }, [config])
  const shownDoc = useDeferredValue(previewDoc)

  const hiddenHere = (device === 'desktop' && showOn === 'mobile') || (device === 'mobile' && showOn === 'desktop')

  // Cards further down the page load a ready-made setup.
  useEffect(() => {
    const onPreset = (e: Event) => {
      const { message: next, data } = (e as CustomEvent<PresetDetail>).detail ?? {}
      if (typeof next === 'string') {
        setPopupOn(true)
        setPopupText(next)
      }
      if (data?.agent) setAgentName(data.agent)
      if (data?.role) setAgentRole(data.role)
      if (data?.cta) setCta(data.cta)
      if (typeof data?.label === 'string') setLabel(data.label)
      if (data?.position === 'left' || data?.position === 'right') setPosition(data.position)
      const hex = data?.color ? normalizeHex(data.color) : null
      if (hex) {
        setColor(hex)
        setColorText(hex)
      }
    }
    window.addEventListener(PRESET_EVENT, onPreset)
    return () => window.removeEventListener(PRESET_EVENT, onPreset)
  }, [])

  function chooseColour(hex: string) {
    setColor(hex)
    setColorText(hex)
  }
  function onColourText(value: string) {
    setColorText(value)
    const hex = normalizeHex(value)
    if (hex) setColor(hex)
  }

  async function copyCode() {
    if (!link) return
    try {
      await navigator.clipboard.writeText(snippet)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      /* clipboard blocked: the code is also shown in the box below */
    }
  }

  return (
    <div id="generator" className="tl-toolwrap">
      <div className="tl-tool tl-tool--wide">
        <div className="tl-toolcard">
          {/* 1. Where the chat goes */}
          <div className="tl-tstep">
            <span className="tl-tnum" aria-hidden="true">1</span>
            <div className="tl-tbody">
              <span className="tl-label">Where should the button open a chat?</span>
              <label className="tl-sublabel tl-sublabel--first" htmlFor="cw-phone">Your WhatsApp number</label>
              <div className="tl-row">
                <select
                  className="tl-select tl-select--cc" value={countryCode} aria-label="Country code"
                  onChange={(e) => setCountryCode(e.target.value)}
                >
                  {COUNTRIES.map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}
                </select>
                <input
                  id="cw-phone" className="tl-input" inputMode="tel" autoComplete="tel-national" placeholder="98765 43210"
                  value={phone} onChange={(e) => setPhone(e.target.value)}
                  aria-invalid={phoneProblem ? true : undefined} aria-describedby="cw-phone-help"
                />
              </div>
              {phoneProblem ? (
                <p id="cw-phone-help" className="tl-error" role="alert">{phoneProblem}</p>
              ) : (
                <p id="cw-phone-help" className="tl-hint">Spaces, dashes and a leading 0 are fine.</p>
              )}

              <label className="tl-sublabel" htmlFor="cw-message">
                First message <span className="tl-opt">(optional)</span>
              </label>
              <textarea
                id="cw-message" className="tl-textarea" value={message} onChange={(e) => setMessage(e.target.value)}
                placeholder="What should people say when the chat opens?"
              />
              <p className="tl-hint">It waits in the chat box when a visitor clicks. They still tap send themselves.</p>
            </div>
          </div>

          {/* 2. The button */}
          <div className="tl-tstep">
            <span className="tl-tnum" aria-hidden="true">2</span>
            <div className="tl-tbody">
              <span className="tl-label">Design the button</span>

              <span className="tl-sublabel tl-sublabel--first" id="cw-side">Side of the screen</span>
              <div className="tl-seg" role="group" aria-labelledby="cw-side">
                <button type="button" aria-pressed={position === 'right'} onClick={() => setPosition('right')}>Right</button>
                <button type="button" aria-pressed={position === 'left'} onClick={() => setPosition('left')}>Left</button>
              </div>

              <span className="tl-sublabel" id="cw-colour">Colour</span>
              <div className="tl-swatches" role="group" aria-labelledby="cw-colour">
                {COLOURS.map((c) => (
                  <button
                    key={c.hex} type="button" className="tl-swatch" style={{ background: c.hex }}
                    aria-pressed={color === c.hex} aria-label={c.name} title={c.name} onClick={() => chooseColour(c.hex)}
                  />
                ))}
                <input
                  className="tl-input tl-input--hex" value={colorText} onChange={(e) => onColourText(e.target.value)}
                  aria-label="Custom colour (hex)" spellCheck={false} maxLength={7}
                  aria-invalid={normalizeHex(colorText) ? undefined : true}
                />
              </div>

              <span className="tl-sublabel" id="cw-size">Size</span>
              <div className="tl-seg" role="group" aria-labelledby="cw-size">
                {SIZES.map((s) => (
                  <button key={s.id} type="button" aria-pressed={size === s.id} onClick={() => setSize(s.id)}>{s.label}</button>
                ))}
              </div>

              <label className="tl-sublabel" htmlFor="cw-label">
                Words next to the icon <span className="tl-opt">(optional)</span>
              </label>
              <div className="tl-chips" role="group" aria-label="Quick labels">
                {LABEL_CHOICES.map((l) => (
                  <button key={l} type="button" className="tl-qchip" onClick={() => setLabel(l)}>{l}</button>
                ))}
                <button type="button" className="tl-qchip tl-qchip--plain" onClick={() => setLabel('')}>Icon only</button>
              </div>
              <input
                id="cw-label" className="tl-input" value={label} maxLength={28} placeholder="Chat with us"
                onChange={(e) => setLabel(e.target.value)}
              />

              <div className="tl-ranges">
                <div>
                  <label className="tl-sublabel" htmlFor="cw-x">Distance from the side: <output>{offsetX}px</output></label>
                  <input id="cw-x" className="tl-range" type="range" min={0} max={80} value={offsetX} onChange={(e) => setOffsetX(Number(e.target.value))} />
                </div>
                <div>
                  <label className="tl-sublabel" htmlFor="cw-y">Distance from the bottom: <output>{offsetY}px</output></label>
                  <input id="cw-y" className="tl-range" type="range" min={0} max={80} value={offsetY} onChange={(e) => setOffsetY(Number(e.target.value))} />
                </div>
              </div>

              <span className="tl-sublabel" id="cw-show">Show it on</span>
              <div className="tl-seg" role="group" aria-labelledby="cw-show">
                {SCREENS.map((s) => (
                  <button key={s.id} type="button" aria-pressed={showOn === s.id} onClick={() => setShowOn(s.id)}>{s.label}</button>
                ))}
              </div>

              <div className="tl-optlist">
                <label className="tl-check">
                  <input type="checkbox" checked={pulse} onChange={(e) => setPulse(e.target.checked)} />
                  <span>Add a soft pulse to draw the eye</span>
                </label>
              </div>
              {pulse && <p className="tl-hint">The pulse stops for visitors who have asked their device for less motion.</p>}
            </div>
          </div>

          {/* 3. The popup */}
          <div className="tl-tstep">
            <span className="tl-tnum" aria-hidden="true">3</span>
            <div className="tl-tbody">
              <span className="tl-label">Welcome popup</span>
              <label className="tl-check">
                <input type="checkbox" checked={popupOn} onChange={(e) => setPopupOn(e.target.checked)} />
                <span>Greet visitors with a short message</span>
              </label>
              {!popupOn && <p className="tl-hint">Without the popup, the button opens WhatsApp as soon as it is clicked.</p>}

              {popupOn && (
                <>
                  <div className="tl-row tl-row--wrap">
                    <div className="tl-col">
                      <label className="tl-sublabel" htmlFor="cw-agent">Name shown</label>
                      <input id="cw-agent" className="tl-input" value={agentName} maxLength={30} onChange={(e) => setAgentName(e.target.value)} />
                    </div>
                    <div className="tl-col">
                      <label className="tl-sublabel" htmlFor="cw-role">Line under the name</label>
                      <input id="cw-role" className="tl-input" value={agentRole} maxLength={50} onChange={(e) => setAgentRole(e.target.value)} />
                    </div>
                  </div>

                  <label className="tl-sublabel" htmlFor="cw-popup">Greeting</label>
                  <textarea
                    id="cw-popup" className="tl-textarea" value={popupText} maxLength={220}
                    onChange={(e) => setPopupText(e.target.value)}
                  />

                  <div className="tl-row tl-row--wrap">
                    <div className="tl-col">
                      <label className="tl-sublabel" htmlFor="cw-cta">Button text</label>
                      <input id="cw-cta" className="tl-input" value={cta} maxLength={28} onChange={(e) => setCta(e.target.value)} />
                    </div>
                    <div className="tl-col tl-col--narrow">
                      <label className="tl-sublabel" htmlFor="cw-delay">Opens after</label>
                      <div className="tl-row tl-row--center">
                        <input
                          id="cw-delay" className="tl-input tl-input--num" type="number" inputMode="numeric" min={0} max={120}
                          value={delay} onChange={(e) => setDelay(e.target.value === '' ? 0 : Number(e.target.value))}
                        />
                        <span className="tl-unit">seconds</span>
                      </div>
                    </div>
                  </div>
                  <p className="tl-hint">A visitor who closes the popup is not shown it again during that visit.</p>

                  <div className="tl-optlist">
                    <label className="tl-check">
                      <input type="checkbox" checked={poweredBy} onChange={(e) => setPoweredBy(e.target.checked)} />
                      <span>Show a small &ldquo;Made with AiSend&rdquo; link in the popup</span>
                    </label>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* 4. The code */}
          <div className={`tl-tstep${link ? '' : ' tl-tstep--off'}`}>
            <span className="tl-tnum" aria-hidden="true">4</span>
            <div className="tl-tbody">
              <span className="tl-label">Copy the code</span>
              {!link && <p className="tl-warn tl-warn--first" role="status">Add your WhatsApp number in step 1 to unlock the code.</p>}
              <div className="tl-actions tl-actions--first">
                <button type="button" className="tl-btn tl-btn--primary tl-btn--sm" disabled={!link} onClick={copyCode}>
                  <Icon name={copied ? 'check' : 'code'} size={17} strokeWidth={copied ? 2.4 : 1.8} />
                  {copied ? 'Copied' : 'Copy code'}
                </button>
                <a
                  className="tl-btn tl-btn--ghost tl-btn--sm" href={link || undefined} target="_blank" rel="noopener noreferrer"
                  aria-disabled={!link} onClick={(e) => { if (!link) e.preventDefault() }}
                >
                  <Icon name="external" size={16} />
                  Test the chat link
                </a>
              </div>
              <details className="tl-code" open>
                <summary>See the code</summary>
                <pre tabIndex={0}>{snippet}</pre>
              </details>

              <span className="tl-sublabel" id="cw-where">Where to paste it</span>
              <p className="tl-hint tl-hint--top">Paste the whole block just before the closing body tag of your pages. Pick your platform:</p>
              <div className="tl-platforms" role="group" aria-labelledby="cw-where">
                {PLATFORMS.map((p) => (
                  <details key={p.name} className="tl-platform">
                    <summary>{p.name}</summary>
                    <ol className="tl-platform__steps">
                      {p.steps.map((s) => <li key={s}>{s}</li>)}
                    </ol>
                    {p.note && <p className="tl-hint">{p.note}</p>}
                  </details>
                ))}
              </div>
            </div>
          </div>

          <p className="tl-toolfoot">
            Nothing you type here is saved or sent anywhere. The code is made in your browser, and your number goes only into the button&rsquo;s link.
          </p>
        </div>

        <aside className="tl-prevcol" aria-label="Preview">
          <div className="tl-prevhead">
            <span className="tl-prevcap tl-prevcap--left">Live preview</span>
            <div className="tl-seg" role="group" aria-label="Preview size">
              <button type="button" aria-pressed={device === 'desktop'} onClick={() => setDevice('desktop')}>Computer</button>
              <button type="button" aria-pressed={device === 'mobile'} onClick={() => setDevice('mobile')}>Phone</button>
            </div>
          </div>

          <div className={`tl-browser tl-browser--${device}`}>
            <div className="tl-browser__bar" aria-hidden="true">
              <i /><i /><i />
              <span>yourwebsite.com</span>
            </div>
            <div className="tl-browser__view">
              <iframe
                key={device}
                title="Preview of the chat button on a website"
                className="tl-browser__frame"
                srcDoc={shownDoc}
                sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox"
              />
            </div>
          </div>

          {hiddenHere && (
            <p className="tl-warn" role="status">
              With your settings the button is hidden on {device === 'desktop' ? 'computers' : 'phones'}, so this preview shows nothing.
            </p>
          )}
          <p className="tl-qrprev__tip">
            <Icon name="clock" size={16} />
            {popupOn ? 'The popup opens after one second here. On your site it waits as long as you set.' : 'Click the button to open WhatsApp.'}
          </p>
        </aside>
      </div>

      <p className="tl-upsell">
        Want every chat from your website to land in a shared team inbox, with automatic replies?{' '}
        <Link href="/signup">Try AiSend free</Link>
      </p>
    </div>
  )
}
