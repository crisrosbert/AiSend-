'use client'

import { useId, useState, type FormEvent } from 'react'
import Link from 'next/link'
import { COUNTRIES } from '@/lib/tools/wa-link'
import {
  LEAD_INTERESTS,
  buildWhatsAppLeadLink,
  submitLead,
  validateLeadForm,
  type CleanLead,
  type LeadFormErrors,
} from '@/lib/tools/lead-form'
import { TOOL_LEAD } from '@/lib/tools/landing-config'

type Phase =
  | { name: 'idle' }
  | { name: 'sending' }
  | { name: 'sent'; lead: CleanLead; whatsappLink: string; viaWhatsApp: boolean }
  | { name: 'failed'; error: string; whatsappLink: string }

/**
 * Lead form for the end of a post: a clean, Google-Forms-style card with
 * floating labels. Same pipeline as the free-tool pages: the lead goes into
 * the CRM through /api/leads/capture when a capture key is set, otherwise it
 * is handed to the team on WhatsApp so no enquiry is lost.
 */
export function BlogLeadForm({ slug, title, text }: { slug: string; title: string; text: string }) {
  const uid = useId()
  const [name, setName] = useState('')
  const [countryCode, setCountryCode] = useState('91')
  const [phone, setPhone] = useState('')
  const [interest, setInterest] = useState('')
  const [consent, setConsent] = useState(false)
  const [trap, setTrap] = useState('')
  const [errors, setErrors] = useState<LeadFormErrors>({})
  const [phase, setPhase] = useState<Phase>({ name: 'idle' })
  const id = (f: string) => `${uid}-${f}`
  const source = `blog post "${slug}"`

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (phase.name === 'sending') return
    const result = validateLeadForm({ name, countryCode, phone, email: '', interest, message: '', consent })
    if (!result.ok) {
      setErrors(result.errors)
      const first = (['name', 'phone', 'consent'] as const).find((f) => result.errors[f])
      if (first) document.getElementById(id(first))?.focus()
      return
    }
    setErrors({})
    const lead = result.value
    const whatsappLink = buildWhatsAppLeadLink({ to: TOOL_LEAD.whatsappNumber, lead, source })

    if (!TOOL_LEAD.captureKey) {
      window.open(whatsappLink, '_blank', 'noopener,noreferrer')
      setPhase({ name: 'sent', lead, whatsappLink, viaWhatsApp: true })
      return
    }

    setPhase({ name: 'sending' })
    const params = new URLSearchParams(window.location.search)
    const outcome = await submitLead({
      lead,
      honeypot: trap,
      key: TOOL_LEAD.captureKey,
      pageUrl: window.location.href,
      form: `blog-${slug}`,
      extra: {
        utm_source: params.get('utm_source') ?? undefined,
        utm_medium: params.get('utm_medium') ?? undefined,
        utm_campaign: params.get('utm_campaign') ?? undefined,
        gclid: params.get('gclid') ?? undefined,
        fbclid: params.get('fbclid') ?? undefined,
        referrer: document.referrer || undefined,
        landing_page: window.location.pathname,
      },
    })
    setPhase(
      outcome.ok
        ? { name: 'sent', lead, whatsappLink, viaWhatsApp: false }
        : { name: 'failed', error: outcome.error, whatsappLink },
    )
  }

  if (phase.name === 'sent') {
    return (
      <section className="gform" role="status">
        <div className="gform__bar" />
        <div className="gform__body">
          <h2 className="gform__title">Thanks, {phase.lead.name.split(' ')[0]}</h2>
          <p className="gform__text">
            {phase.viaWhatsApp
              ? 'We opened WhatsApp with your details. Press send there and we will reply as soon as we can.'
              : `We have your request and will message you on +${phase.lead.phone}.`}
          </p>
          <a className="gform__btn gform__btn--ghost" href={phase.whatsappLink} target="_blank" rel="noopener noreferrer">
            {phase.viaWhatsApp ? 'Open WhatsApp again' : 'Prefer to chat now? Message us'}
          </a>
        </div>
      </section>
    )
  }

  const bad = (f: keyof LeadFormErrors) => (errors[f] ? true : undefined)

  return (
    <section className="gform" aria-labelledby={id('title')}>
      <div className="gform__bar" />
      <form className="gform__body" onSubmit={onSubmit} noValidate>
        <h2 className="gform__title" id={id('title')}>{title}</h2>
        <p className="gform__text">{text}</p>

        <div className={`gfield${errors.name ? ' gfield--bad' : ''}`}>
          <input
            id={id('name')} placeholder=" " value={name} onChange={(e) => setName(e.target.value)}
            autoComplete="name" aria-invalid={bad('name')}
          />
          <label htmlFor={id('name')}>Your name</label>
          {errors.name && <p className="gfield__err">{errors.name}</p>}
        </div>

        <div className="gphone">
          <select value={countryCode} onChange={(e) => setCountryCode(e.target.value)} aria-label="Country code">
            {COUNTRIES.map((c) => (
              <option key={c.code} value={c.code}>{c.label}</option>
            ))}
          </select>
          <div className={`gfield${errors.phone ? ' gfield--bad' : ''}`}>
            <input
              id={id('phone')} placeholder=" " inputMode="tel" autoComplete="tel-national" value={phone}
              onChange={(e) => setPhone(e.target.value)} aria-invalid={bad('phone')}
            />
            <label htmlFor={id('phone')}>WhatsApp number</label>
            {errors.phone && <p className="gfield__err">{errors.phone}</p>}
          </div>
        </div>

        <div className="gfield">
          <select id={id('interest')} value={interest} onChange={(e) => setInterest(e.target.value)} className="gselect">
            <option value="">Choose one (optional)</option>
            {LEAD_INTERESTS.map((o) => (
              <option key={o} value={o}>{o}</option>
            ))}
          </select>
          <label htmlFor={id('interest')} className="gfield__fixed">What do you need help with?</label>
        </div>

        <div className="gform__trap" aria-hidden="true">
          <label>
            Website
            <input tabIndex={-1} autoComplete="off" value={trap} onChange={(e) => setTrap(e.target.value)} />
          </label>
        </div>

        <label className="gform__consent" htmlFor={id('consent')}>
          <input id={id('consent')} type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} aria-invalid={bad('consent')} />
          <span>
            I agree that AiSend may contact me on WhatsApp about this request, as described in the{' '}
            <Link href="/privacy">Privacy Policy</Link> and <Link href="/terms">Terms</Link>.
          </span>
        </label>
        {errors.consent && <p className="gfield__err">{errors.consent}</p>}

        {phase.name === 'failed' && (
          <p className="gform__alert" role="alert">
            {phase.error}{' '}
            <a href={phase.whatsappLink} target="_blank" rel="noopener noreferrer">Message us on WhatsApp instead</a>
          </p>
        )}

        <button className="gform__btn" type="submit" disabled={phase.name === 'sending'}>
          {phase.name === 'sending' ? 'Sending…' : 'Get a call on WhatsApp'}
        </button>
      </form>
    </section>
  )
}
