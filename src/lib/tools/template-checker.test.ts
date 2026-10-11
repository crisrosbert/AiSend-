import { describe, expect, it } from 'vitest'
import {
  buildApiPayload,
  checkTemplate,
  findVariables,
  renderWithSamples,
  suggestTemplateName,
  type TemplateInput,
} from './template-checker'

function valid(over: Partial<TemplateInput> = {}): TemplateInput {
  return {
    name: 'order_shipped_v1',
    category: 'utility',
    language: 'en',
    headerText: '',
    headerSample: '',
    body: 'Hi {{1}}, your order {{2}} has shipped and will arrive by {{3}}. You can track it using the button below.',
    bodySamples: ['Priya', '1042', 'Friday'],
    footer: '',
    buttons: [{ type: 'url', text: 'Track order', value: 'https://example.com/track/{{1}}', sample: 'abc123' }],
    auth: { securityNote: true, expiryMinutes: 10, buttonText: 'Copy code' },
    ...over,
  }
}

const ids = (input: TemplateInput) => checkTemplate(input).findings.map((f) => f.id)
const severityOf = (input: TemplateInput, id: string) => checkTemplate(input).findings.find((f) => f.id === id)?.severity

describe('findVariables', () => {
  it('lists the numbers in order of appearance', () => {
    expect(findVariables('Hi {{1}}, {{2}} and {{1}} again')).toEqual({ numbers: [1, 2, 1], malformed: false })
  })

  it('flags braces that are not a clean {{number}}', () => {
    expect(findVariables('Hi {{name}}').malformed).toBe(true)
    expect(findVariables('Hi {{ 1 }}').malformed).toBe(true)
    expect(findVariables('Hi {{1}').malformed).toBe(true)
    expect(findVariables('Hi {1}}').malformed).toBe(true)
    expect(findVariables('Hi {{1}}').malformed).toBe(false)
  })
})

describe('checkTemplate: a good template', () => {
  it('is ready, with no errors', () => {
    const r = checkTemplate(valid())
    expect(r.errors).toBe(0)
    expect(r.ready).toBe(true)
  })
})

describe('checkTemplate: name', () => {
  it('needs a name', () => {
    expect(ids(valid({ name: '' }))).toContain('name-required')
  })

  it('allows only lowercase letters, numbers and underscores', () => {
    expect(ids(valid({ name: 'Order Shipped' }))).toContain('name-format')
    expect(ids(valid({ name: 'order-shipped' }))).toContain('name-format')
    expect(ids(valid({ name: 'order_shipped_2' }))).not.toContain('name-format')
  })

  it('stops at 512 characters', () => {
    expect(ids(valid({ name: 'a'.repeat(513) }))).toContain('name-too-long')
    expect(ids(valid({ name: 'a'.repeat(512) }))).not.toContain('name-too-long')
  })
})

describe('checkTemplate: body', () => {
  it('is required', () => {
    expect(ids(valid({ body: '  ', bodySamples: [], buttons: [] }))).toContain('body-required')
  })

  it('stops at 1024 characters', () => {
    const text = (n: number) => 'a'.repeat(n)
    expect(ids(valid({ body: text(1025), bodySamples: [], buttons: [] }))).toContain('body-too-long')
    expect(ids(valid({ body: text(1024), bodySamples: [], buttons: [] }))).not.toContain('body-too-long')
  })

  it('warns when the message is very short', () => {
    expect(severityOf(valid({ body: 'Thanks!', bodySamples: [], buttons: [] }), 'body-short')).toBe('warning')
  })
})

describe('checkTemplate: variables', () => {
  it('rejects named or badly typed variables', () => {
    expect(ids(valid({ body: 'Hi {{name}}, your order is on its way to you today.', bodySamples: [] }))).toContain('variable-format')
  })

  it('wants numbering with no gaps that starts at 1', () => {
    const gap = valid({ body: 'Hi {{1}}, your order {{3}} has shipped and will reach you soon.', bodySamples: ['A', 'B', 'C'] })
    expect(ids(gap)).toContain('variable-sequence')
    const late = valid({ body: 'Hi there, your order {{2}} has shipped and will reach you soon today.', bodySamples: ['A', 'B'] })
    expect(ids(late)).toContain('variable-sequence')
  })

  it('lets the same variable appear twice', () => {
    const twice = valid({ body: 'Hi {{1}}, thanks {{1}}, your order {{2}} has shipped and will arrive soon.', bodySamples: ['A', 'B'] })
    expect(ids(twice)).not.toContain('variable-sequence')
  })

  it('rejects a body that starts or ends with a variable', () => {
    expect(ids(valid({ body: '{{1}} your order has shipped and is on its way to you.', bodySamples: ['A'] }))).toContain('variable-start')
    expect(ids(valid({ body: 'Your order has shipped and is on its way to you, {{1}}', bodySamples: ['A'] }))).toContain('variable-end')
    expect(ids(valid({ body: 'Your order has shipped and is on its way to you, {{1}}.', bodySamples: ['A'] }))).not.toContain('variable-end')
  })

  it('rejects variables stuck together and warns when only a space separates them', () => {
    expect(ids(valid({ body: 'Hi, your order {{1}}{{2}} has shipped and is on its way to you.', bodySamples: ['A', 'B'] }))).toContain('variable-adjacent')
    expect(severityOf(valid({ body: 'Hi, your order {{1}} {{2}} has shipped and is on its way to you.', bodySamples: ['A', 'B'] }), 'variable-close')).toBe('warning')
  })

  it('warns when there are too many variables for the amount of text', () => {
    const crowded = valid({ body: 'Hi {{1}}, {{2}} {{3}} {{4}} {{5}} soon.', bodySamples: ['a', 'b', 'c', 'd', 'e'] })
    expect(severityOf(crowded, 'variable-ratio')).toBe('warning')
    expect(ids(valid())).not.toContain('variable-ratio')
  })

  it('asks for an example value for every variable', () => {
    expect(ids(valid({ bodySamples: ['Priya', '', 'Friday'] }))).toContain('sample-missing')
    expect(ids(valid({ bodySamples: ['Priya'] }))).toContain('sample-missing')
    expect(ids(valid())).not.toContain('sample-missing')
  })
})

describe('checkTemplate: header and footer', () => {
  it('stops the header at 60 characters and one variable', () => {
    expect(ids(valid({ headerText: 'h'.repeat(61) }))).toContain('header-too-long')
    expect(ids(valid({ headerText: 'Order {{1}} for {{2}}', headerSample: 'x' }))).toContain('header-variables')
  })

  it('needs an example for a header variable', () => {
    expect(ids(valid({ headerText: 'Order {{1}}', headerSample: '' }))).toContain('sample-missing')
    expect(ids(valid({ headerText: 'Order {{1}}', headerSample: '1042' }))).not.toContain('sample-missing')
  })

  it('warns about formatting characters in the header', () => {
    expect(severityOf(valid({ headerText: '*Big* news' }), 'header-format')).toBe('warning')
  })

  it('stops the footer at 60 characters and allows no variables', () => {
    expect(ids(valid({ footer: 'f'.repeat(61) }))).toContain('footer-too-long')
    expect(ids(valid({ footer: 'Order {{1}}' }))).toContain('footer-variable')
  })
})

describe('checkTemplate: buttons', () => {
  const quick = (text: string) => ({ type: 'quick_reply' as const, text, value: '' })

  it('limits the button text to 25 characters and requires some', () => {
    expect(ids(valid({ buttons: [quick('x'.repeat(26))] }))).toContain('button-text-long')
    expect(ids(valid({ buttons: [quick('')] }))).toContain('button-text-empty')
  })

  it('allows at most 10 buttons', () => {
    const many = Array.from({ length: 11 }, (_, i) => quick(`Option ${i + 1}`))
    expect(ids(valid({ buttons: many }))).toContain('buttons-too-many')
    expect(ids(valid({ buttons: many.slice(0, 10) }))).not.toContain('buttons-too-many')
  })

  it('allows 2 link buttons, 1 call button and 1 copy-code button', () => {
    const link = (n: number) => ({ type: 'url' as const, text: `Link ${n}`, value: `https://example.com/${n}`, sample: '' })
    expect(ids(valid({ buttons: [link(1), link(2), link(3)] }))).toContain('url-too-many')
    const call = { type: 'phone' as const, text: 'Call us', value: '+919876543210' }
    expect(ids(valid({ buttons: [call, call] }))).toContain('phone-too-many')
    const copy = { type: 'copy_code' as const, text: 'Copy code', value: 'SAVE20' }
    expect(ids(valid({ buttons: [copy, copy] }))).toContain('copy-too-many')
  })

  it('needs a full https address for link buttons', () => {
    expect(ids(valid({ buttons: [{ type: 'url', text: 'Open', value: 'example.com', sample: '' }] }))).toContain('url-invalid')
    expect(ids(valid({ buttons: [{ type: 'url', text: 'Open', value: 'http://example.com', sample: '' }] }))).toContain('url-invalid')
    expect(ids(valid({ buttons: [{ type: 'url', text: 'Open', value: 'https://example.com/a', sample: '' }] }))).not.toContain('url-invalid')
  })

  it('allows a variable only at the very end of a link, with an example', () => {
    const middle = { type: 'url' as const, text: 'Open', value: 'https://example.com/{{1}}/details', sample: 'x' }
    expect(ids(valid({ buttons: [middle] }))).toContain('url-variable-position')
    const noSample = { type: 'url' as const, text: 'Open', value: 'https://example.com/{{1}}', sample: '' }
    expect(ids(valid({ buttons: [noSample] }))).toContain('sample-missing')
  })

  it('warns about link shorteners', () => {
    const short = { type: 'url' as const, text: 'Open', value: 'https://bit.ly/abc', sample: '' }
    expect(severityOf(valid({ buttons: [short] }), 'url-shortener')).toBe('warning')
  })

  it('wants the call number in international format', () => {
    expect(ids(valid({ buttons: [{ type: 'phone', text: 'Call us', value: '98765 43210' }] }))).toContain('phone-format')
    expect(ids(valid({ buttons: [{ type: 'phone', text: 'Call us', value: '+919876543210' }] }))).not.toContain('phone-format')
  })

  it('explains how quick replies are arranged next to other buttons', () => {
    const mixed = valid({ buttons: [{ type: 'url', text: 'Track', value: 'https://example.com/t', sample: '' }, quick('Stop updates')] })
    expect(severityOf(mixed, 'buttons-mixed')).toBe('tip')
  })
})

describe('checkTemplate: category', () => {
  it('warns when a utility template reads like a promotion', () => {
    const promo = valid({ body: 'Hi {{1}}, your order {{2}} has shipped. Get 20% off your next order with this limited time offer.', bodySamples: ['A', 'B'], buttons: [] })
    expect(severityOf(promo, 'utility-promotional')).toBe('warning')
    expect(ids(valid())).not.toContain('utility-promotional')
  })

  it('warns when a utility template does not point to an order, booking or account', () => {
    const vague = valid({ body: 'We are glad you are with us and we hope you are having a lovely week so far.', bodySamples: [], buttons: [] })
    expect(severityOf(vague, 'utility-generic')).toBe('warning')
    expect(ids(valid())).not.toContain('utility-generic')
  })

  it('does not apply the utility rules to marketing templates', () => {
    const promo = valid({ category: 'marketing', body: 'Hi {{1}}, enjoy 20% off everything this weekend with code SAVE20. Shop now.', bodySamples: ['A'], buttons: [] })
    expect(ids(promo)).not.toContain('utility-promotional')
  })

  it('suggests an opt-out button for marketing templates', () => {
    const marketing = valid({ category: 'marketing', body: 'Hi {{1}}, our new collection is now in store. Come and see it this weekend.', bodySamples: ['A'], buttons: [] })
    expect(severityOf(marketing, 'marketing-optout')).toBe('tip')
    const withStop = { ...marketing, buttons: [{ type: 'quick_reply' as const, text: 'Stop promotions', value: '' }] }
    expect(ids(withStop)).not.toContain('marketing-optout')
  })

  it('checks the expiry time of an authentication template', () => {
    const auth = (expiryMinutes: number | null) => valid({ category: 'authentication', auth: { securityNote: true, expiryMinutes, buttonText: 'Copy code' } })
    expect(ids(auth(0))).toContain('auth-expiry')
    expect(ids(auth(91))).toContain('auth-expiry')
    expect(ids(auth(10))).not.toContain('auth-expiry')
    expect(ids(auth(null))).not.toContain('auth-expiry')
    expect(checkTemplate(auth(10)).ready).toBe(true)
  })

  it('ignores the body and buttons of an authentication template, which are fixed', () => {
    const r = checkTemplate(valid({ category: 'authentication', body: '', bodySamples: [], buttons: [] }))
    expect(r.findings.map((f) => f.id)).not.toContain('body-required')
    expect(r.ready).toBe(true)
  })
})

describe('checkTemplate: content', () => {
  const body = (text: string) => valid({ body: text, bodySamples: [], buttons: [], category: 'marketing' })

  it('warns when the template asks for secrets', () => {
    expect(severityOf(body('Please reply with your card number and CVV to confirm the delivery of your order.'), 'sensitive-request')).toBe('warning')
    expect(ids(body('Your PIN code is the same one you gave us, no need to change anything today.'))).not.toContain('sensitive-request')
  })

  it('warns about threats', () => {
    expect(severityOf(body('Pay today or we will take legal action against you and your family without notice.'), 'threatening-language')).toBe('warning')
  })

  it('warns about shouting and repeated punctuation', () => {
    expect(severityOf(body('BUY NOW AND GET THE BEST PRICE ON EVERYTHING TODAY ONLY, DO NOT MISS IT'), 'shouting')).toBe('warning')
    expect(severityOf(body('Our new collection is here!!! Come and see what is new this weekend.'), 'repeated-punctuation')).toBe('warning')
  })
})

describe('renderWithSamples', () => {
  it('puts the example values into the text', () => {
    expect(renderWithSamples('Hi {{1}}, order {{2}} is ready', ['Priya', '1042'])).toBe('Hi Priya, order 1042 is ready')
  })

  it('leaves a variable visible when it has no example yet', () => {
    expect(renderWithSamples('Hi {{1}}, order {{2}}', ['Priya'])).toBe('Hi Priya, order {{2}}')
    expect(renderWithSamples('Hi {{1}}', [''])).toBe('Hi {{1}}')
  })
})

type Component = { type: string; [key: string]: any } // eslint-disable-line @typescript-eslint/no-explicit-any
type Payload = { name: string; category: string; language: string; components: Component[] }

describe('buildApiPayload', () => {
  it('builds the body with its examples', () => {
    const p = buildApiPayload(valid({ buttons: [] })) as Payload
    expect(p.name).toBe('order_shipped_v1')
    expect(p.category).toBe('UTILITY')
    expect(p.language).toBe('en')
    const body = p.components.find((c: Component) => c.type === 'BODY')
    expect(body!.text).toContain('{{1}}')
    expect(body!.example.body_text).toEqual([['Priya', '1042', 'Friday']])
  })

  it('leaves out the example when there are no variables', () => {
    const p = buildApiPayload(valid({ body: 'Your order has shipped and is on its way to you.', bodySamples: [], buttons: [] })) as Payload
    expect(p.components.find((c: Component) => c.type === 'BODY')!.example).toBeUndefined()
  })

  it('adds header and footer only when they are filled in', () => {
    const none = buildApiPayload(valid({ buttons: [] })) as Payload
    expect(none.components.map((c: Component) => c.type)).toEqual(['BODY'])
    const both = buildApiPayload(valid({ headerText: 'Order {{1}}', headerSample: '1042', footer: 'Thank you', buttons: [] })) as Payload
    expect(both.components.map((c: Component) => c.type)).toEqual(['HEADER', 'BODY', 'FOOTER'])
    expect(both.components[0]).toMatchObject({ format: 'TEXT', text: 'Order {{1}}', example: { header_text: ['1042'] } })
  })

  it('writes each button type the way the API expects, with quick replies grouped first', () => {
    const p = buildApiPayload(
      valid({
        buttons: [
          { type: 'url', text: 'Track', value: 'https://example.com/t/{{1}}', sample: 'abc' },
          { type: 'quick_reply', text: 'Stop updates', value: '' },
          { type: 'phone', text: 'Call us', value: '+919876543210' },
          { type: 'copy_code', text: 'Copy code', value: 'SAVE20' },
        ],
      }),
    ) as Payload
    const buttons = p.components.find((c: Component) => c.type === 'BUTTONS')!.buttons
    expect(buttons[0]).toEqual({ type: 'QUICK_REPLY', text: 'Stop updates' })
    expect(buttons[1]).toEqual({ type: 'URL', text: 'Track', url: 'https://example.com/t/{{1}}', example: ['https://example.com/t/abc'] })
    expect(buttons[2]).toEqual({ type: 'PHONE_NUMBER', text: 'Call us', phone_number: '+919876543210' })
    expect(buttons[3]).toEqual({ type: 'COPY_CODE', example: 'SAVE20' })
  })

  it('builds an authentication template from its options only', () => {
    const p = buildApiPayload(valid({ category: 'authentication', name: 'login_code', auth: { securityNote: true, expiryMinutes: 10, buttonText: 'Copy code' } })) as Payload
    expect(p.category).toBe('AUTHENTICATION')
    expect(p.components).toEqual([
      { type: 'BODY', add_security_recommendation: true },
      { type: 'FOOTER', code_expiration_minutes: 10 },
      { type: 'BUTTONS', buttons: [{ type: 'OTP', otp_type: 'COPY_CODE', text: 'Copy code' }] },
    ])
  })
})

describe('suggestTemplateName', () => {
  it('turns a title into a valid name', () => {
    expect(suggestTemplateName('Order Shipped!')).toBe('order_shipped')
  })

  it('collapses runs of spaces, dashes and symbols into one underscore', () => {
    expect(suggestTemplateName('  Diwali -- Sale   2026 ')).toBe('diwali_sale_2026')
  })

  it('keeps names that are already valid', () => {
    expect(suggestTemplateName('order_shipped_v1')).toBe('order_shipped_v1')
  })

  it('drops letters it cannot use and returns an empty name when nothing is left', () => {
    expect(suggestTemplateName('नमस्ते')).toBe('')
    expect(suggestTemplateName('!!!')).toBe('')
  })

  it('always produces a name the checker accepts', () => {
    const name = suggestTemplateName('Cart Reminder (Hindi) #2')
    expect(name).toBe('cart_reminder_hindi_2')
    expect(/^[a-z0-9_]+$/.test(name)).toBe(true)
  })
})

describe('checkTemplate: absurd variable numbers', () => {
  it('stays quick and keeps the message short when someone types {{5000}}', () => {
    const input = valid({ body: 'Hi there, your code is {{5000}} and it is valid today.', bodySamples: [] })
    const started = Date.now()
    const result = checkTemplate(input)
    expect(Date.now() - started).toBeLessThan(500)

    const missing = result.findings.find((f) => f.id === 'sample-missing')
    expect(missing).toBeDefined()
    expect(missing!.detail.length).toBeLessThan(600)
    expect(result.findings.map((f) => f.id)).toContain('variable-sequence')
  })

  it('says how many more examples are missing instead of listing every one', () => {
    const body = 'Hello team, ' + Array.from({ length: 12 }, (_, i) => `item {{${i + 1}}} is ready`).join(', ') + ' for you today.'
    const result = checkTemplate(valid({ body, bodySamples: [] }))
    const detail = result.findings.find((f) => f.id === 'sample-missing')!.detail
    expect(detail).toMatch(/and \d+ more/)
  })
})
