// src/lib/widget/whatsapp-strip.test.ts
//
// Tests for the optional WhatsApp strip: the settings check used by /widget,
// the gate used by /api/widget/config, the missing-column retry, and the
// plain-JavaScript helpers inside public/widget.js (cut out of the file between
// the WA-HELPERS-START / WA-HELPERS-END markers and run here).

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  WA_BUTTON_TEXT_DEFAULT,
  WA_BUTTON_TEXT_MAX,
  buttonTextOrDefault,
  checkWhatsappSettings,
  cleanButtonText,
  isMissingWhatsappColumnError,
  whatsappStripView,
  withoutWhatsappColumns,
} from './whatsapp-strip'

// ── load the helpers out of widget.js ──
const widgetSource = readFileSync(join(process.cwd(), 'public', 'widget.js'), 'utf8')
const start = widgetSource.indexOf('// WA-HELPERS-START')
const end = widgetSource.indexOf('// WA-HELPERS-END')

interface WidgetHelpers {
  waClean: (s: unknown) => string
  waCut: (s: string, max: number, dots?: boolean) => string
  waStripText: (raw: unknown) => string
  waDigits: (raw: unknown) => string | null
  waPrefill: (title: unknown, url: unknown) => string
  waLink: (digits: string | null, title: unknown, url: unknown) => string
  WA_TEXT_DEFAULT: string
  WA_TEXT_MAX: number
}
function loadHelpers(): WidgetHelpers {
  const block = widgetSource.slice(start, end)
  // eslint-disable-next-line @typescript-eslint/no-implied-eval
  return new Function(
    block +
      '\nreturn { waClean: waClean, waCut: waCut, waStripText: waStripText, waDigits: waDigits,' +
      ' waPrefill: waPrefill, waLink: waLink, WA_TEXT_DEFAULT: WA_TEXT_DEFAULT, WA_TEXT_MAX: WA_TEXT_MAX };',
  )() as WidgetHelpers
}

describe('widget.js helper block is present', () => {
  it('has both markers in the right order', () => {
    expect(start).toBeGreaterThan(0)
    expect(end).toBeGreaterThan(start)
  })
})

const w = loadHelpers()

describe('button text (dashboard side)', () => {
  it('default is the approved sentence', () => {
    expect(WA_BUTTON_TEXT_DEFAULT).toBe('Talk to the clinic team directly')
    expect(WA_BUTTON_TEXT_MAX).toBe(50)
  })
  it('empty / blank / non-string falls back to the default', () => {
    expect(buttonTextOrDefault('')).toBe(WA_BUTTON_TEXT_DEFAULT)
    expect(buttonTextOrDefault('   ')).toBe(WA_BUTTON_TEXT_DEFAULT)
    expect(buttonTextOrDefault(null)).toBe(WA_BUTTON_TEXT_DEFAULT)
    expect(buttonTextOrDefault(42)).toBe(WA_BUTTON_TEXT_DEFAULT)
  })
  it('keeps the owner example', () => {
    expect(cleanButtonText('Talk to Dr. Ashish Khare directly')).toBe('Talk to Dr. Ashish Khare directly')
  })
  it('is plain text: angle brackets removed, one line, spaces collapsed', () => {
    expect(cleanButtonText('<b>Hi</b>\n  there\t!')).toBe('bHi/b there !')
    expect(cleanButtonText('<script>alert(1)</script>')).toBe('scriptalert(1)/script')
  })
  it('is cut to 50 characters', () => {
    const out = cleanButtonText('x'.repeat(80))
    expect(out.length).toBe(50)
  })
  it('never ends with half an emoji', () => {
    const text = 'a'.repeat(49) + '\u{1F600}' // the emoji straddles the 50 limit
    const out = cleanButtonText(text)
    expect(out).toBe('a'.repeat(49))
    expect(out.length <= 50).toBe(true)
  })
})

describe('checkWhatsappSettings', () => {
  it('ON + valid Indian number in any accepted form stores digits only', () => {
    for (const phone of ['9820123987', '919820123987', '+91 98201 23987', '+91-98201-23987', '09820123987', '0091 98201 23987']) {
      const r = checkWhatsappSettings({ enabled: true, phone, text: '' })
      expect(r.ok, phone).toBe(true)
      if (r.ok) {
        expect(r.phone).toBe('919820123987')
        expect(r.phone.includes('+')).toBe(false)
      }
    }
  })
  it('ON + valid international E.164 stores digits only', () => {
    const r = checkWhatsappSettings({ enabled: true, phone: '+44 7911 123456', text: null })
    expect(r).toMatchObject({ ok: true, phone: '447911123456' })
  })
  it('ON + invalid or empty number BLOCKS saving with a message', () => {
    for (const phone of ['', '   ', null, undefined, '12345', '76644354756', '0000000000', 'call me', '447911123456']) {
      const r = checkWhatsappSettings({ enabled: true, phone, text: '' })
      expect(r.ok, String(phone)).toBe(false)
      if (!r.ok) {
        expect(r.field).toBe('phone')
        expect(r.message.length).toBeGreaterThan(5)
      }
    }
  })
  it('OFF + empty number is fine', () => {
    expect(checkWhatsappSettings({ enabled: false, phone: '', text: '' })).toEqual({ ok: true, phone: '', text: null })
  })
  it('OFF + good number is cleaned to digits, no warning', () => {
    expect(checkWhatsappSettings({ enabled: false, phone: '+91 98201 23987', text: '' })).toEqual({
      ok: true, phone: '919820123987', text: null,
    })
  })
  it('OFF + odd saved number is kept as typed with a soft warning (never blocks)', () => {
    const r = checkWhatsappSettings({ enabled: false, phone: '12345', text: '' })
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.phone).toBe('12345')
      expect(r.warning).toBeTruthy()
    }
  })
  it('empty text is stored as null (= default); typed text is cleaned', () => {
    expect(checkWhatsappSettings({ enabled: false, phone: '', text: '  ' })).toMatchObject({ text: null })
    expect(checkWhatsappSettings({ enabled: true, phone: '9820123987', text: ' Chat <now> ' })).toMatchObject({ text: 'Chat now' })
  })
})

describe('whatsappStripView (what the website visitor is told)', () => {
  const ok = { business_phone: '919820123987' }
  it('ON only when switch is on AND the number is valid', () => {
    expect(whatsappStripView({ ...ok, whatsapp_button_enabled: true }).whatsapp_button_enabled).toBe(true)
  })
  it('OFF when the switch is off', () => {
    expect(whatsappStripView({ ...ok, whatsapp_button_enabled: false }).whatsapp_button_enabled).toBe(false)
  })
  it('OFF when the number is missing or bad', () => {
    for (const business_phone of [null, undefined, '', '123', 'abc', '0000000000']) {
      expect(whatsappStripView({ business_phone, whatsapp_button_enabled: true }).whatsapp_button_enabled).toBe(false)
    }
  })
  it('OFF when the columns do not exist yet (keys absent)', () => {
    expect(whatsappStripView({ ...ok })).toEqual({
      whatsapp_button_enabled: false,
      whatsapp_button_text: WA_BUTTON_TEXT_DEFAULT,
    })
  })
  it('OFF for anything that is not the boolean true', () => {
    for (const v of ['true', 1, 'yes', null]) {
      expect(whatsappStripView({ ...ok, whatsapp_button_enabled: v }).whatsapp_button_enabled).toBe(false)
    }
  })
  it('serves cleaned text, never raw', () => {
    expect(whatsappStripView({ ...ok, whatsapp_button_enabled: true, whatsapp_button_text: '<img src=x onerror=1>' }).whatsapp_button_text)
      .toBe('img src=x onerror=1')
  })
})

describe('missing-column detection and retry payload', () => {
  it('detects Postgres 42703 and PostgREST PGRST204 for the new columns', () => {
    expect(isMissingWhatsappColumnError({ code: '42703', message: 'column "whatsapp_button_enabled" of relation "widget_configs" does not exist' })).toBe(true)
    expect(isMissingWhatsappColumnError({ code: 'PGRST204', message: "Could not find the 'whatsapp_button_text' column of 'widget_configs' in the schema cache" })).toBe(true)
  })
  it('does not swallow other errors', () => {
    expect(isMissingWhatsappColumnError({ code: '42703', message: 'column "bot_name" does not exist' })).toBe(false)
    expect(isMissingWhatsappColumnError({ code: '23505', message: 'duplicate key whatsapp_button_enabled' })).toBe(false)
    expect(isMissingWhatsappColumnError({ code: '42501', message: 'permission denied' })).toBe(false)
    expect(isMissingWhatsappColumnError(null)).toBe(false)
    expect(isMissingWhatsappColumnError('boom')).toBe(false)
  })
  it('retry payload drops only the two new columns', () => {
    const payload = { bot_name: 'A', business_phone: '919820123987', whatsapp_button_enabled: true, whatsapp_button_text: 'x', updated_at: 't' }
    expect(withoutWhatsappColumns(payload)).toEqual({ bot_name: 'A', business_phone: '919820123987', updated_at: 't' })
    expect(payload.whatsapp_button_enabled).toBe(true) // original untouched
  })
})

describe('widget.js helpers: number', () => {
  it('accepts every normal way of writing the number', () => {
    for (const p of ['9820123987', '919820123987', '+919820123987', '+91 98201 23987', '09820123987', '0091 98201 23987']) {
      expect(w.waDigits(p), p).toBe('919820123987')
    }
    expect(w.waDigits('+44 7911 123456')).toBe('447911123456')
  })
  it('rejects rubbish', () => {
    for (const p of [null, undefined, '', 'abc', 'call me', '123', '1234567', '0123456789', '1234567890', '12345678901234567']) {
      expect(w.waDigits(p), String(p)).toBeNull()
    }
  })
})

describe('widget.js helpers: text', () => {
  it('default and max match the dashboard', () => {
    expect(w.WA_TEXT_DEFAULT).toBe(WA_BUTTON_TEXT_DEFAULT)
    expect(w.WA_TEXT_MAX).toBe(WA_BUTTON_TEXT_MAX)
  })
  it('gives the same answer as the dashboard cleaner', () => {
    const samples = [
      '', '   ', 'Talk to Dr. Ashish Khare directly', '<b>x</b>', 'a\nb\tc', 'x'.repeat(80),
      'a'.repeat(49) + '\u{1F600}', 'Chat on WhatsApp \u{1F4AC}', "It's & \"quoted\"",
    ]
    for (const s of samples) expect(w.waStripText(s), JSON.stringify(s)).toBe(buttonTextOrDefault(s))
    expect(w.waStripText(null)).toBe(WA_BUTTON_TEXT_DEFAULT)
  })
})

describe('widget.js helpers: wa.me link and prefilled message', () => {
  const decode = (link: string) => decodeURIComponent(link.split('?text=')[1])

  it('builds https://wa.me/<digits>?text=<encoded>', () => {
    const link = w.waLink('919820123987', 'Gynecomastia Treatment', 'https://kalosa.in/gynecomastia?utm=x#top')
    expect(link.startsWith('https://wa.me/919820123987?text=')).toBe(true)
    expect(link.includes(' ')).toBe(false)
    expect(decode(link)).toBe(
      'Hi, I\'m on "Gynecomastia Treatment" https://kalosa.in/gynecomastia and I\'d like to talk to the team.',
    )
  })
  it('message holds the page title and the URL', () => {
    const m = w.waPrefill('Kalosa Aesthetics - Home', 'https://kalosa.in/')
    expect(m).toContain('Kalosa Aesthetics - Home')
    expect(m).toContain('https://kalosa.in/')
    expect(m.startsWith("Hi, I'm on ")).toBe(true)
    expect(m.endsWith("I'd like to talk to the team.")).toBe(true)
  })
  it('drops ?query and #hash (tracking codes, personal data)', () => {
    const m = w.waPrefill('T', 'https://x.in/p?email=a@b.com&gclid=1#frag')
    expect(m).toContain('https://x.in/p')
    expect(m).not.toContain('email')
    expect(m).not.toContain('gclid')
    expect(m).not.toContain('frag')
  })
  it('long title is cut to 60 with ...', () => {
    const m = w.waPrefill('T'.repeat(200), 'https://x.in/')
    const title = m.split('"')[1]
    expect(title.length).toBe(60)
    expect(title.endsWith('...')).toBe(true)
  })
  it('very long URL falls back to the site address', () => {
    const m = w.waPrefill('T', 'https://x.in/' + 'a'.repeat(400))
    expect(m).toContain('https://x.in')
    expect(m.length).toBeLessThan(200)
  })
  it('total message stays short', () => {
    const m = w.waPrefill('T'.repeat(500), 'https://x.in/' + 'a'.repeat(500))
    expect(m.length <= 300).toBe(true)
  })
  it('missing title or URL still reads well', () => {
    expect(w.waPrefill('', 'https://x.in/')).toBe("Hi, I'm on https://x.in/ and I'd like to talk to the team.")
    expect(w.waPrefill('Home', '')).toBe('Hi, I\'m on "Home" and I\'d like to talk to the team.')
    expect(w.waPrefill('', '')).toBe("Hi, I'd like to talk to the team.")
    expect(w.waPrefill(null, undefined)).toBe("Hi, I'd like to talk to the team.")
  })
  it('quotes in the title cannot break the message; newlines are flattened', () => {
    const m = w.waPrefill('Say "hi"\nnow', 'https://x.in/')
    expect(m).toContain('"Say \'hi\' now"')
  })
  it('special characters survive URL encoding (& # ? % emoji, Hindi)', () => {
    const title = 'Q&A #1 100% ok? \u{1F600} नमस्ते'
    const link = w.waLink('919820123987', title, 'https://x.in/')
    expect(link.split('?text=')[1]).not.toMatch(/[&# ]/)
    expect(decode(link)).toContain(title)
  })
  it('no link without a number', () => {
    expect(w.waLink(null, 't', 'u')).toBe('')
  })
})

describe('widget.js source safety and wiring', () => {
  it('strip is built only from escaped text; click opens a new tab with noopener', () => {
    expect(widgetSource).toContain("esc(waStripText(config.whatsapp_button_text))")
    expect(widgetSource).toMatch(/aisend-wa-strip"[^']*target="_blank" rel="noopener noreferrer"/)
  })
  it('strip is off unless the server flag is strictly true and the number is usable', () => {
    expect(widgetSource).toContain('config.whatsapp_button_enabled === true && !!waDigits(config.business_phone)')
  })
  it('config defaults keep the strip off', () => {
    expect(widgetSource).toMatch(/whatsapp_button_enabled:\s*false/)
  })
  it('hand-off button is still there and uses digits', () => {
    expect(widgetSource).toContain('Continue on WhatsApp')
    expect(widgetSource).toContain("data.handoff && data.business_phone")
  })
})
