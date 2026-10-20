'use client'

import { useCallback, useEffect, useId, useState, type FormEvent } from 'react'
import Link from 'next/link'
import { COUNTRIES } from '@/lib/tools/wa-link'
import { buildWhatsAppLeadLink, submitLead, validateLeadForm, type LeadFormErrors } from '@/lib/tools/lead-form'
import { TOOL_LEAD } from '@/lib/tools/landing-config'

const SEEN_KEY = 'aisend-blog-popup'

/**
 * A single, polite pop-up on blog posts. It shows once per visit, after the
 * reader has scrolled a good way down or spent a while on the page, and never
 * covers the page before that. Esc, the close button and a click outside all
 * close it. The form uses the same lead pipeline as the form at the end of the post.
 */
export function LeadPopup({ slug }: { slug: string }) {
  const uid = useId()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [countryCode, setCountryCode] = useState('91')
  const [phone, setPhone] = useState('')
  const [consent, setConsent] = useState(false)
  const [trap, setTrap] = useState('')
  const [errors, setErrors] = useState<LeadFormErrors>({})
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'failed'>('idle')
  const [wa, setWa] = useState('')

  const close = useCallback(() => {
    setOpen(false)
    try { sessionStorage.setItem(SEEN_KEY, '1') } catch { /* storage can be blocked */ }
  }, [])

  useEffect(() => {
    try { if (sessionStorage.getItem(SEEN_KEY)) return } catch { /* show anyway */ }
    let shown = false
    const show = () => { if (!shown) { shown = true; setOpen(true) } }
    const timer = window.setTimeout(show, 45_000)
    const onScroll = () => {
      const h = document.documentElement
      if ((h.scrollTop + window.innerHeight) / h.scrollHeight > 0.6) show()
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => { window.clearTimeout(timer); window.removeEventListener('scroll', onScroll) }
  }, [])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, close])

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (state === 'sending') return
    const result = validateLeadForm({ name, countryCode, phone, email: '', interest: '', message: '', consent })
    if (!result.ok) { setErrors(result.errors); return }
    setErrors({})
    const lead = result.value
    const link = buildWhatsAppLeadLink({ to: TOOL_LEAD.whatsappNumber, lead, source: `blog popup "${slug}"` })
    setWa(link)
    if (!TOOL_LEAD.captureKey) {
      window.open(link, '_blank', 'noopener,noreferrer')
      setState('sent')
      return
    }
    setState('sending')
    const out = await submitLead({
      lead, honeypot: trap, key: TOOL_LEAD.captureKey, pageUrl: window.location.href,
      form: `blog-popup-${slug}`, extra: { landing_page: window.location.pathname, referrer: document.referrer || undefined },
    })
    setState(out.ok ? 'sent' : 'failed')
  }

  if (!open) return null
  const id = (f: string) => `${uid}-${f}`

  return (
    <div className="popup" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) close() }}>
      <div className="popup__card" role="dialog" aria-modal="true" aria-labelledby={id('t')}>
        <button type="button" className="popup__x" onClick={close} aria-label="Close">×</button>
        <div className="popup__pitch">
          <p className="popup__eyebrow">Free to start</p>
          <h2 id={id('t')}>Message customers on WhatsApp the official way</h2>
          <p>Send campaigns to opted-in contacts, reply from one shared inbox and set up an AI chatbot. No credit card needed to begin.</p>
          <ul>
            <li>Approved templates and opt-out handling built in</li>
            <li>Chatbot and shared team inbox</li>
            <li>Free tools you can use today</li>
          </ul>
          <Link className="popup__link" href="/tools" onClick={close}>Try the free tools →</Link>
        </div>

        {state === 'sent' ? (
          <div className="popup__form" role="status">
            <h3>Thanks, {name.split(' ')[0] || 'there'}</h3>
            <p>We have your request. If WhatsApp opened, press send there and we will reply soon.</p>
            <a className="popup__btn" href={wa} target="_blank" rel="noopener noreferrer">Open WhatsApp</a>
          </div>
        ) : (
          <form className="popup__form" onSubmit={onSubmit} noValidate>
            <h3>Get a call on WhatsApp</h3>
            <label htmlFor={id('n')}>Your name</label>
            <input id={id('n')} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" aria-invalid={errors.name ? true : undefined} />
            {errors.name && <p className="popup__err">{errors.name}</p>}
            <label htmlFor={id('p')}>WhatsApp number</label>
            <div className="popup__phone">
              <select value={countryCode} onChange={(e) => setCountryCode(e.target.value)} aria-label="Country code">
                {COUNTRIES.map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}
              </select>
              <input id={id('p')} inputMode="tel" autoComplete="tel-national" value={phone} onChange={(e) => setPhone(e.target.value)} aria-invalid={errors.phone ? true : undefined} />
            </div>
            {errors.phone && <p className="popup__err">{errors.phone}</p>}
            <div className="gform__trap" aria-hidden="true"><input tabIndex={-1} autoComplete="off" value={trap} onChange={(e) => setTrap(e.target.value)} /></div>
            <label className="popup__consent" htmlFor={id('c')}>
              <input id={id('c')} type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
              <span>I agree that AiSend may contact me on WhatsApp about this request. <Link href="/privacy">Privacy Policy</Link></span>
            </label>
            {errors.consent && <p className="popup__err">{errors.consent}</p>}
            {state === 'failed' && <p className="popup__err">Could not send right now. Please try again in a moment.</p>}
            <button className="popup__btn" type="submit" disabled={state === 'sending'}>{state === 'sending' ? 'Sending…' : 'Request a call'}</button>
          </form>
        )}
      </div>
    </div>
  )
}
