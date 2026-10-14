import { describe, expect, it } from 'vitest'
import { extractFacts, factsToText, mergeFacts } from './site-facts'

const html = `
<html><head>
<script type="application/ld+json">{"@context":"https://schema.org","@graph":[{"@type":"Dentist","name":"Smile Clinic","telephone":"+91 98765 43210","email":"hi@smile.in",
"address":{"@type":"PostalAddress","streetAddress":"12 MG Road","addressLocality":"Pune","addressRegion":"MH","postalCode":"411001","addressCountry":"IN"},
"openingHoursSpecification":[{"dayOfWeek":["Monday","Tuesday"],"opens":"09:00","closes":"18:00"}],
"sameAs":["https://www.instagram.com/smileclinic/"]}]}</script></head>
<body><header><nav><a href="/">Home</a><a href="/services">Teeth Whitening</a><a href="/implants">Dental Implants</a></nav></header>
<main><p>Welcome.</p></main>
<footer><p>Call <a href="tel:+919999900000">+91 99999 00000</a></p>
<a href="mailto:care@smile.in?subject=Hi">Email</a><a href="https://wa.me/919876543210?text=hi">WhatsApp</a>
<a href="https://www.facebook.com/sharer/sharer.php?u=x">share</a><a href="https://www.facebook.com/smileclinic">fb</a>
<p>© 2026 Smile Clinic. Plot 5, Baner. Phone 020 2567 8901</p></footer></body></html>`

describe('extractFacts', () => {
  const f = extractFacts(html)
  it('reads JSON-LD first', () => {
    expect(f.name).toBe('Smile Clinic')
    expect(f.phones[0]).toBe('+91 98765 43210')
    expect(f.address).toBe('12 MG Road, Pune, MH, 411001, IN')
    expect(f.hours).toBe('Monday, Tuesday 09:00-18:00')
  })
  it('reads tel:, mailto:, WhatsApp and footer text', () => {
    expect(f.phones).toContain('+919999900000')
    expect(f.emails).toEqual(expect.arrayContaining(['hi@smile.in', 'care@smile.in']))
    expect(f.whatsapp).toEqual(['919876543210'])
    expect(f.phones.some((p) => p.includes('2567'))).toBe(true)
  })
  it('skips share links, keeps real profiles', () => {
    expect(f.social).toEqual(expect.arrayContaining(['https://www.instagram.com/smileclinic', 'https://www.facebook.com/smileclinic']))
    expect(f.social.some((s) => s.includes('sharer'))).toBe(false)
  })
  it('takes the menu from the nav, which the text extractor throws away', () => {
    expect(f.menu).toEqual(['Teeth Whitening', 'Dental Implants'])
  })
  it('renders a block for the prompt', () => {
    const t = factsToText(f)
    expect(t).toMatch(/^Business name: Smile Clinic/)
    expect(t).toMatch(/Email: .*care@smile\.in/)
    expect(t).toMatch(/Website menu: Teeth Whitening \| Dental Implants/)
  })
  it('does not treat a year as a phone number', () => {
    expect(extractFacts('<footer>© 2026 All rights reserved</footer>').phones).toEqual([])
  })
  it('merges without duplicates', () => {
    const m = mergeFacts(f, extractFacts('<a href="tel:+919999900000">x</a><a href="mailto:new@smile.in">y</a>'))
    expect(m.phones.filter((p) => p.replace(/\D/g, '') === '919999900000')).toHaveLength(1)
    expect(m.emails).toContain('new@smile.in')
  })
})
