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
import { Icon } from './icons'

type Phase =
  | { name: 'idle' }
  | { name: 'sending' }
  | { name: 'sent'; lead: CleanLead; whatsappLink: string; viaWhatsApp: boolean }
  | { name: 'failed'; error: string; whatsappLink: string }

/**
 * "Request a call back". Saves the lead into the CRM when a capture key is
 * configured; otherwise (or if saving fails) it hands the lead to the team on
 * WhatsApp, so an enquiry is never lost. A hidden field catches form-filling
 * bots; the server also rate-limits.
 */
export function LeadForm({ formId, sourceLabel }: { formId: string; sourceLabel: string }) {
  const uid = useId()
  const [name, setName] = useState('')
  const [countryCode, setCountryCode] = useState('91')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [interest, setInterest] = useState('')
  const [message, setMessage] = useState('')
  const [consent, setConsent] = useState(false)
  const [trap, setTrap] = useState('')
  const [errors, setErrors] = useState<LeadFormErrors>({})
  const [phase, setPhase] = useState<Phase>({ name: 'idle' })

  const id = (field: string) => `${uid}-${field}`

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (phase.name === 'sending') return

    const result = validateLeadForm({ name, countryCode, phone, email, interest, message, consent })
    if (!result.ok) {
      setErrors(result.errors)
      const first = (['name', 'phone', 'email', 'consent'] as const).find((f) => result.errors[f])
      if (first) document.getElementById(id(first))?.focus()
      return
    }
    setErrors({})

    const lead = result.value
    const whatsappLink = buildWhatsAppLeadLink({ to: TOOL_LEAD.whatsappNumber, lead, source: sourceLabel })

    if (!TOOL_LEAD.captureKey) {
      // No CRM key yet: the WhatsApp message itself is the lead. Opened before
      // any await so the browser treats it as a user-initiated tab.
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
      form: formId,
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
    const first = phase.lead.name.split(' ')[0]
    return (
      <div className="tl-form" role="status">
        <div className="tl-done">
          <span className="tl-done__tick"><Icon name="check" size={28} strokeWidth={2.4} /></span>
          <h3>Thanks, {first}</h3>
          <p style={{ marginTop: 8 }}>
            {phase.viaWhatsApp
              ? 'We opened WhatsApp with your details. Press send there and we will reply as soon as we can.'
              : `We have your request and will call you on +${phase.lead.phone}.`}
          </p>
          <a className="tl-btn tl-btn--ghost" href={phase.whatsappLink} target="_blank" rel="noopener noreferrer">
            <Icon name="chat" size={18} />
            {phase.viaWhatsApp ? 'Open WhatsApp again' : 'Prefer to chat now? Message us'}
          </a>
        </div>
      </div>
    )
  }

  const invalid = (f: keyof LeadFormErrors) => (errors[f] ? true : undefined)

  return (
    <form className="tl-form" onSubmit={onSubmit} noValidate aria-labelledby={id('title')}>
      <h3 id={id('title')}>Request a call back</h3>

      <div className="tl-field">
        <label htmlFor={id('name')}>Your name</label>
        <input
          id={id('name')} className="tl-input" value={name} onChange={(e) => setName(e.target.value)}
          autoComplete="name" aria-invalid={invalid('name')} aria-describedby={errors.name ? id('name-err') : undefined}
        />
        {errors.name && <p id={id('name-err')} className="tl-error">{errors.name}</p>}
      </div>

      <div className="tl-field">
        <label htmlFor={id('phone')}>Mobile number</label>
        <div className="tl-row">
          <select
            className="tl-select tl-select--cc" value={countryCode} onChange={(e) => setCountryCode(e.target.value)}
            aria-label="Country code"
          >
            {COUNTRIES.map((c) => (
              <option key={c.code} value={c.code}>{c.label}</option>
            ))}
          </select>
          <input
            id={id('phone')} className="tl-input" inputMode="tel" autoComplete="tel-national" value={phone}
            onChange={(e) => setPhone(e.target.value)} aria-invalid={invalid('phone')}
            aria-describedby={errors.phone ? id('phone-err') : undefined}
          />
        </div>
        {errors.phone && <p id={id('phone-err')} className="tl-error">{errors.phone}</p>}
      </div>

      <div className="tl-field">
        <label htmlFor={id('email')}>Email <span className="tl-opt">(optional)</span></label>
        <input
          id={id('email')} className="tl-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)}
          autoComplete="email" aria-invalid={invalid('email')} aria-describedby={errors.email ? id('email-err') : undefined}
        />
        {errors.email && <p id={id('email-err')} className="tl-error">{errors.email}</p>}
      </div>

      <div className="tl-field">
        <label htmlFor={id('interest')}>What do you need help with? <span className="tl-opt">(optional)</span></label>
        <select id={id('interest')} className="tl-select" value={interest} onChange={(e) => setInterest(e.target.value)}>
          <option value="">Choose one</option>
          {LEAD_INTERESTS.map((o) => (
            <option key={o} value={o}>{o}</option>
          ))}
        </select>
      </div>

      <div className="tl-field">
        <label htmlFor={id('message')}>Message <span className="tl-opt">(optional)</span></label>
        <textarea id={id('message')} className="tl-textarea" value={message} onChange={(e) => setMessage(e.target.value)} />
      </div>

      {/* Humans never see this; bots fill every field. */}
      <div className="tl-trap" aria-hidden="true">
        <label>
          Website
          <input tabIndex={-1} autoComplete="off" value={trap} onChange={(e) => setTrap(e.target.value)} />
        </label>
      </div>

      <label className="tl-consent" htmlFor={id('consent')}>
        <input id={id('consent')} type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)}
          aria-invalid={invalid('consent')} />
        <span>
          I agree that AiSend may contact me about this request, as described in the{' '}
          <Link href="/privacy">Privacy Policy</Link> and <Link href="/terms">Terms</Link>.
        </span>
      </label>
      {errors.consent && <p className="tl-error">{errors.consent}</p>}

      {phase.name === 'failed' && (
        <div className="tl-alert" role="alert">
          {phase.error}{' '}
          <a href={phase.whatsappLink} target="_blank" rel="noopener noreferrer" style={{ fontWeight: 700, color: 'inherit' }}>
            Message us on WhatsApp instead
          </a>
        </div>
      )}

      <button className="tl-btn tl-btn--primary" type="submit" disabled={phase.name === 'sending'}>
        {phase.name === 'sending' ? 'Sending…' : 'Request a call back'}
      </button>
    </form>
  )
}
