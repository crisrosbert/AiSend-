import { describe, expect, it } from 'vitest'
import {
  DEFAULT_WIDGET,
  buildPreviewDocument,
  buildWidgetSnippet,
  isSafeWhatsAppLink,
  readableTextColor,
  type WidgetConfig,
} from './chat-widget'

const LINK = 'https://wa.me/919876543210?text=Hi%20there'

function config(over: Partial<WidgetConfig> = {}): WidgetConfig {
  return {
    ...DEFAULT_WIDGET,
    link: LINK,
    ...over,
    popup: { ...DEFAULT_WIDGET.popup, ...(over.popup ?? {}) },
  }
}

/** The text between <script> and </script> of the snippet. */
function scriptOf(html: string): string {
  const m = html.match(/<script>([\s\S]*?)<\/script>/)
  return m ? m[1] : ''
}

describe('isSafeWhatsAppLink', () => {
  it('accepts wa.me and api.whatsapp.com links over https', () => {
    expect(isSafeWhatsAppLink('https://wa.me/919876543210')).toBe(true)
    expect(isSafeWhatsAppLink('https://wa.me/919876543210?text=Hi')).toBe(true)
    expect(isSafeWhatsAppLink('https://api.whatsapp.com/send?phone=919876543210&text=Hi')).toBe(true)
  })

  it('refuses everything else', () => {
    for (const bad of [
      '',
      'javascript:alert(1)',
      'http://wa.me/919876543210',
      'https://evil.example/wa.me/919876543210',
      'https://wa.me.evil.example/1',
      '//wa.me/919876543210',
      'data:text/html,hi',
    ]) {
      expect(isSafeWhatsAppLink(bad)).toBe(false)
    }
  })
})

describe('readableTextColor', () => {
  it('picks dark text on light colours and white text on dark ones', () => {
    expect(readableTextColor('#ffffff')).toBe('#0c1f17')
    expect(readableTextColor('#25d366')).toBe('#0c1f17')
    expect(readableTextColor('#14523a')).toBe('#ffffff')
    expect(readableTextColor('#000000')).toBe('#ffffff')
  })

  it('falls back to white for a colour it cannot read', () => {
    expect(readableTextColor('not a colour')).toBe('#ffffff')
  })
})

describe('buildWidgetSnippet: structure', () => {
  const html = buildWidgetSnippet(config())

  it('is one block: styles, markup and a single script', () => {
    expect(html).toContain('<style>')
    expect(html).toContain('id="aswa"')
    expect((html.match(/<script/g) ?? []).length).toBe(1)
  })

  it('prefixes every class so it cannot clash with the site it sits on', () => {
    const classes = Array.from(html.matchAll(/class="([^"]+)"/g), (m) => m[1].split(/\s+/)).flat()
    expect(classes.length).toBeGreaterThan(3)
    for (const c of classes) expect(c.startsWith('aswa')).toBe(true)
  })

  it('loads nothing from anywhere else', () => {
    expect(html).not.toMatch(/<link|@import|url\(|\ssrc=/)
  })

  it('is the same every time for the same settings', () => {
    expect(buildWidgetSnippet(config())).toBe(html)
  })

  it('has a script that parses', () => {
    expect(() => new Function(scriptOf(html))).not.toThrow()
  })

  it('uses a generic chat icon, not a brand logo', () => {
    expect(html).toContain('<svg')
    expect(html.toLowerCase()).not.toContain('whatsapp-logo')
  })
})

describe('buildWidgetSnippet: link', () => {
  it('points the button at the WhatsApp link', () => {
    const html = buildWidgetSnippet(config({ popup: { ...DEFAULT_WIDGET.popup, enabled: false } }))
    expect(html).toContain(`href="${LINK}"`)
  })

  it('escapes & in the address so the markup stays valid', () => {
    const link = 'https://api.whatsapp.com/send?phone=919876543210&text=Hi'
    expect(buildWidgetSnippet(config({ link }))).toContain('send?phone=919876543210&amp;text=Hi')
  })

  it('never writes an unsafe address into the page', () => {
    const html = buildWidgetSnippet(config({ link: 'javascript:alert(1)' }))
    expect(html).not.toContain('javascript')
    expect(html).toContain('href="https://wa.me/"')
  })

  it('opens WhatsApp in a new tab without giving the tab access to the page', () => {
    const html = buildWidgetSnippet(config())
    expect(html).toMatch(/target="_blank" rel="noopener noreferrer"/)
  })
})

describe('buildWidgetSnippet: look', () => {
  it('puts the button on the chosen side', () => {
    expect(buildWidgetSnippet(config({ position: 'left' }))).toContain('aswa--left')
    expect(buildWidgetSnippet(config({ position: 'right' }))).toContain('aswa--right')
  })

  it('uses the chosen colour and a readable icon colour', () => {
    const dark = buildWidgetSnippet(config({ color: '#14523a' }))
    expect(dark).toContain('#14523a')
    expect(dark).toContain('--aswa-t:#ffffff')
    const light = buildWidgetSnippet(config({ color: '#25d366' }))
    expect(light).toContain('--aswa-t:#0c1f17')
  })

  it('falls back to the default colour when the one given is not a colour', () => {
    const html = buildWidgetSnippet(config({ color: 'red; } body { display:none' }))
    expect(html).not.toContain('body {')
    expect(html).toContain('--aswa-c:#1b6b4a')
  })

  it('sizes the button and keeps the distances from the edge within sensible limits', () => {
    const small = buildWidgetSnippet(config({ size: 'small' }))
    const large = buildWidgetSnippet(config({ size: 'large' }))
    expect(small).toContain('--aswa-s:52px')
    expect(large).toContain('--aswa-s:68px')
    const far = buildWidgetSnippet(config({ offsetX: 9999, offsetY: -50 }))
    expect(far).toContain('--aswa-x:120px')
    expect(far).toContain('--aswa-y:0px')
  })

  it('shows a text label only when there is one', () => {
    expect(buildWidgetSnippet(config({ label: '' }))).not.toContain('<span class="aswa__label">')
    expect(buildWidgetSnippet(config({ label: 'Chat with us' }))).toContain('<span class="aswa__label">Chat with us</span>')
  })

  it('pulses only when asked, and only for people who have not asked for less motion', () => {
    const on = buildWidgetSnippet(config({ pulse: true }))
    expect(on).toContain('@keyframes aswa-pulse')
    expect(on).toMatch(/prefers-reduced-motion: ?no-preference[\s\S]*aswa-pulse/)
    expect(buildWidgetSnippet(config({ pulse: false }))).not.toContain('aswa-pulse')
  })

  it('hides the button on the screens it was not meant for', () => {
    expect(buildWidgetSnippet(config({ showOn: 'all' }))).not.toContain('max-width: 767px')
    expect(buildWidgetSnippet(config({ showOn: 'desktop' }))).toMatch(/max-width: 767px\)\s*\{\s*#aswa\s*\{\s*display: ?none/)
    expect(buildWidgetSnippet(config({ showOn: 'mobile' }))).toMatch(/min-width: 768px\)\s*\{\s*#aswa\s*\{\s*display: ?none/)
  })
})

describe('buildWidgetSnippet: breakpoint', () => {
  it('uses 768px as the line between phone and computer by default', () => {
    expect(buildWidgetSnippet(config({ showOn: 'mobile' }))).toContain('min-width: 768px')
    expect(buildWidgetSnippet(config({ showOn: 'desktop' }))).toContain('max-width: 767px')
  })

  it('can use another line, which the narrow preview needs', () => {
    expect(buildWidgetSnippet(config({ showOn: 'desktop' }), { breakpoint: 480 })).toContain('max-width: 479px')
    expect(buildWidgetSnippet(config({ showOn: 'mobile' }), { breakpoint: 480 })).toContain('min-width: 480px')
  })

  it('ignores a breakpoint that makes no sense', () => {
    expect(buildWidgetSnippet(config({ showOn: 'mobile' }), { breakpoint: -5 })).toContain('min-width: 768px')
    expect(buildWidgetSnippet(config({ showOn: 'mobile' }), { breakpoint: Number.NaN })).toContain('min-width: 768px')
  })
})

describe('buildWidgetSnippet: popup', () => {
  it('has a popup card and a button that opens it when the popup is on', () => {
    const html = buildWidgetSnippet(config({ popup: { ...DEFAULT_WIDGET.popup, enabled: true } }))
    expect(html).toContain('id="aswa-card"')
    expect(html).toContain('<button')
    expect(html).toContain('aria-expanded="false"')
    expect(html).toContain('data-popup="1"')
  })

  it('is just a link when the popup is off', () => {
    const html = buildWidgetSnippet(config({ popup: { ...DEFAULT_WIDGET.popup, enabled: false } }))
    expect(html).not.toContain('aswa-card')
    expect(html).not.toContain('aria-expanded')
    expect(html).toContain('data-popup="0"')
  })

  it('shows the agent, the message and the button text', () => {
    const html = buildWidgetSnippet(
      config({ popup: { ...DEFAULT_WIDGET.popup, agentName: 'Priya', agentRole: 'Sales team', message: 'Hi! Need a hand?', cta: 'Start chat' } }),
    )
    expect(html).toContain('Priya')
    expect(html).toContain('Sales team')
    expect(html).toContain('Hi! Need a hand?')
    expect(html).toContain('>Start chat</a>')
  })

  it('uses the first letter of the name for the avatar', () => {
    const html = buildWidgetSnippet(config({ popup: { ...DEFAULT_WIDGET.popup, agentName: 'rahul' } }))
    expect(html).toMatch(/aswa__avatar[^>]*>R</)
  })

  it('keeps the delay a whole number of seconds from 0 to 120', () => {
    const delay = (n: number) =>
      buildWidgetSnippet(config({ popup: { ...DEFAULT_WIDGET.popup, delaySeconds: n } })).match(/data-delay="(\d+)"/)![1]
    expect(delay(5)).toBe('5')
    expect(delay(2.6)).toBe('3')
    expect(delay(-4)).toBe('0')
    expect(delay(9999)).toBe('120')
    expect(delay(Number.NaN)).toBe('0')
  })
})

describe('buildWidgetSnippet: text from the person using the tool', () => {
  const evil = '</script><img src=x onerror=alert(1)>"\'&'
  const html = buildWidgetSnippet(
    config({
      label: evil,
      popup: { ...DEFAULT_WIDGET.popup, agentName: evil, agentRole: evil, message: evil, cta: evil },
    }),
  )

  it('escapes it everywhere it is shown', () => {
    expect(html).not.toContain('<img')
    expect(html).toContain('&lt;/script&gt;&lt;img')
    expect(html).toContain('&amp;')
  })

  it('still has exactly one script block', () => {
    expect((html.match(/<script/g) ?? []).length).toBe(1)
    expect((html.match(/<\/script>/g) ?? []).length).toBe(1)
  })

  it('keeps all of it out of the script', () => {
    expect(scriptOf(html)).not.toContain('onerror')
    expect(scriptOf(html)).not.toContain(evil)
  })

  it('trims very long text', () => {
    const long = buildWidgetSnippet(config({ popup: { ...DEFAULT_WIDGET.popup, message: 'x'.repeat(5000) } }))
    expect(long.length).toBeLessThan(20000)
  })
})

describe('buildWidgetSnippet: made-with link', () => {
  it('adds a small link that search engines are told not to follow', () => {
    const html = buildWidgetSnippet(config({ poweredBy: true }))
    expect(html).toMatch(/<a [^>]*rel="nofollow noopener noreferrer"[^>]*>Made with AiSend<\/a>/)
    expect(html).toContain('utm_source=chat-widget')
  })

  it('can be left out', () => {
    expect(buildWidgetSnippet(config({ poweredBy: false }))).not.toContain('Made with AiSend')
  })
})

describe('buildPreviewDocument', () => {
  const snippet = buildWidgetSnippet(config())
  const doc = buildPreviewDocument(snippet)

  it('is a full page with the snippet in it', () => {
    expect(doc.startsWith('<!doctype html>')).toBe(true)
    expect(doc).toContain('name="viewport"')
    expect(doc).toContain(snippet)
  })

  it('loads nothing from another site', () => {
    expect(doc).not.toMatch(/<link|@import|\ssrc=["']https?:/)
  })
})
