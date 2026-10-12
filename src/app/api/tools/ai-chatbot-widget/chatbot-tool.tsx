/* eslint-disable @next/next/no-img-element */
'use client'

import { useEffect, useRef, useState, type FormEvent } from 'react'
import { TOOL_LEAD } from '@/lib/tools/landing-config'
import { buildWhatsAppLeadLink, submitLead, validateLeadForm } from '@/lib/tools/lead-form'
import type { BotProfile, Tone } from '@/lib/tools/chatbot/profile'
import { saveDraft } from '@/lib/tools/chatbot/draft'
import './chatbot.css'

type Msg = { role: 'user' | 'model'; text: string }
type Scan = { site: string; profile: BotProfile; pages: number; session: string }

const STEPS = [
  { t: 'Scans your website', d: 'Learns your business, products and services' },
  { t: 'Builds a knowledge base', d: 'Adds available content so the chatbot can answer questions' },
  { t: 'Shapes a personality', d: 'Creates a name, role and tone of voice' },
]
const COLORS = ['#1B6B4A', '#0F766E', '#2563EB', '#7C3AED', '#DB2777', '#EA580C', '#111827']
const TONE_LABEL: Record<Tone, string> = { friendly: 'Friendly', professional: 'Professional', casual: 'Casual' }

export function ChatbotTool() {
  const [url, setUrl] = useState('')
  const [phase, setPhase] = useState<'start' | 'scanning' | 'ready'>('start')
  const [step, setStep] = useState(0)
  const [error, setError] = useState('')
  const [scan, setScan] = useState<Scan | null>(null)
  const [profile, setProfile] = useState<BotProfile | null>(null)
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [gate, setGate] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (phase !== 'scanning') return
    setStep(0)
    const a = setTimeout(() => setStep(1), 4500)
    const b = setTimeout(() => setStep(2), 9500)
    return () => {
      clearTimeout(a)
      clearTimeout(b)
    }
  }, [phase])

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' })
  }, [msgs, busy])

  async function start(e: FormEvent) {
    e.preventDefault()
    if (!url.trim()) return setError('Enter your website address.')
    setError('')
    setPhase('scanning')
    try {
      const res = await fetch('/api/tools/chatbot/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || (res.status === 429 ? 'Too many tries. Please wait a few minutes.' : 'Could not scan that website.'))
      setScan(data)
      setProfile(data.profile)
      setMsgs([{ role: 'model', text: data.profile.greeting }])
      setPhase('ready')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
      setPhase('start')
    }
  }

  async function send(text: string) {
    const q = text.trim()
    if (!q || busy || !scan || !profile) return
    const next: Msg[] = [...msgs, { role: 'user', text: q }]
    setMsgs(next)
    setDraft('')
    setBusy(true)
    try {
      const res = await fetch('/api/tools/chatbot/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session: scan.session, profile, messages: next.slice(-6) }),
      })
      const data = await res.json().catch(() => ({}))
      const reply = res.ok && data.reply ? data.reply : data?.error || 'Sorry, I could not answer that. Please try again.'
      setMsgs((m) => [...m, { role: 'model', text: reply }])
    } catch {
      setMsgs((m) => [...m, { role: 'model', text: 'Connection problem. Please try again.' }])
    } finally {
      setBusy(false)
    }
  }

  function patch(p: Partial<BotProfile>) {
    setProfile((cur) => (cur ? { ...cur, ...p } : cur))
  }

  if (phase !== 'ready' || !profile || !scan) {
    return (
      <div className="cb">
        <div className="cb-card cb-start">
          {phase === 'scanning' ? (
            <>
              <div className="cb-row" aria-live="polite"><input readOnly value={url} aria-label="Website" /></div>
              <ul className="cb-steps">
                {STEPS.map((s, i) => (
                  <li key={s.t} className={`cb-step ${i < step ? 'is-done' : i === step ? 'is-on' : ''}`}>
                    <span className="cb-step__dot">{i < step ? '✓' : ''}</span>
                    <div><b>{s.t}</b><span>{s.d}</span></div>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <form onSubmit={start}>
              <div className="cb-row">
                <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="yourwebsite.com" inputMode="url" autoComplete="url" aria-label="Your website address" />
                <button className="cb-btn" type="submit">Create chatbot</button>
              </div>
              {error ? <p className="cb-err" role="alert">{error}</p> : null}
              <ul className="cb-steps" style={{ marginTop: 24 }}>
                {STEPS.map((s) => (
                  <li key={s.t} className="cb-step is-done">
                    <span className="cb-step__dot">✓</span>
                    <div><b>{s.t}</b><span>{s.d}</span></div>
                  </li>
                ))}
              </ul>
              <p className="cb-fine">No signup needed to try it. We only read public pages of the website you enter.</p>
            </form>
          )}
        </div>
      </div>
    )
  }

  const initial = profile.name.trim().charAt(0).toUpperCase() || 'A'
  return (
    <div className="cb">
      <div className="cb-work">
        <div className="cb-card cb-panel">
          <h3>Your chatbot profile</h3>
          <p className="cb-hint">Built from {scan.pages} page{scan.pages === 1 ? '' : 's'} of {scan.site}. Edit anything, then test it on the right.</p>
          <div className="cb-field"><label htmlFor="cb-name">Name</label><input id="cb-name" value={profile.name} maxLength={40} onChange={(e) => patch({ name: e.target.value })} /></div>
          <div className="cb-field"><label htmlFor="cb-role">Role</label><textarea id="cb-role" rows={2} value={profile.role} maxLength={120} onChange={(e) => patch({ role: e.target.value })} /></div>
          <div className="cb-field">
            <label htmlFor="cb-tone">Tone of voice</label>
            <select id="cb-tone" value={profile.tone} onChange={(e) => patch({ tone: e.target.value as Tone })}>
              {(Object.keys(TONE_LABEL) as Tone[]).map((t) => <option key={t} value={t}>{TONE_LABEL[t]}</option>)}
            </select>
          </div>
          <div className="cb-field"><label htmlFor="cb-greet">Greeting</label><input id="cb-greet" value={profile.greeting} maxLength={160} onChange={(e) => { patch({ greeting: e.target.value }); setMsgs((m) => (m.length === 1 ? [{ role: 'model', text: e.target.value }] : m)) }} /></div>
          <div className="cb-field">
            <label>Suggested questions</label>
            {profile.suggestions.map((s, i) => (
              <input key={i} value={s} maxLength={80} aria-label={`Suggested question ${i + 1}`} onChange={(e) => patch({ suggestions: profile.suggestions.map((x, j) => (j === i ? e.target.value : x)) })} style={{ marginBottom: 6 }} />
            ))}
          </div>
          <div className="cb-field">
            <label>Colour</label>
            <div className="cb-colors">
              {COLORS.map((c) => <button key={c} type="button" aria-label={`Colour ${c}`} className={`cb-swatch${profile.color === c ? ' is-on' : ''}`} style={{ background: c }} onClick={() => patch({ color: c })} />)}
            </div>
          </div>
          <div className="cb-cta">
            <button className="cb-btn" onClick={() => { saveDraft({ site: scan.site, name: profile.name, greeting: profile.greeting, color: profile.color }); setGate(true) }}>Add to website for free →</button>
            <button className="cb-btn cb-btn--ghost" onClick={() => { setPhase('start'); setScan(null) }}>Try another website</button>
          </div>
        </div>

        <div className="cb-card cb-stage">
          <div className="cb-widget" role="region" aria-label="Chatbot preview">
            <div className="cb-wh">
              <span className="cb-av" style={{ background: profile.color }}>
                {profile.logoUrl ? <img src={profile.logoUrl} alt="" /> : initial}
              </span>
              <div><b>{profile.name}</b><small>● Online</small></div>
            </div>
            <div className="cb-msgs" aria-live="polite">
              {msgs.map((m, i) => (
                <div key={i} className={`cb-m ${m.role === 'user' ? 'cb-m--me' : 'cb-m--bot'}`} style={m.role === 'user' ? { background: profile.color } : undefined}>{m.text}</div>
              ))}
              {busy ? <div className="cb-m cb-m--bot"><span className="cb-typing"><i /><i /><i /></span></div> : null}
              <div ref={endRef} />
            </div>
            {msgs.length === 1 ? (
              <div className="cb-sugg">
                {profile.suggestions.filter(Boolean).map((s) => <button key={s} onClick={() => send(s)}>{s}</button>)}
              </div>
            ) : null}
            <form className="cb-in" onSubmit={(e) => { e.preventDefault(); send(draft) }}>
              <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Write your message…" maxLength={400} aria-label="Message" />
              <button type="submit" disabled={busy || !draft.trim()} style={{ background: profile.color }} aria-label="Send">➤</button>
            </form>
          </div>
        </div>
      </div>
      {gate ? <Gate site={scan.site} onClose={() => setGate(false)} /> : null}
    </div>
  )
}

function Gate({ site, onClose }: { site: string; onClose: () => void }) {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [consent, setConsent] = useState(false)
  const [trap, setTrap] = useState('')
  const [err, setErr] = useState('')
  const [done, setDone] = useState<string | null>(null)
  const signup = `/signup?from=ai-chatbot&site=${encodeURIComponent(site)}`

  async function submit(e: FormEvent) {
    e.preventDefault()
    const r = validateLeadForm({ name, countryCode: '91', phone, email, interest: '', message: `Free AI chatbot for ${site}`, consent })
    if (!r.ok) return setErr(Object.values(r.errors)[0] || 'Please check the form.')
    setErr('')
    const wa = buildWhatsAppLeadLink({ to: TOOL_LEAD.whatsappNumber, lead: r.value, source: 'Free AI chatbot widget' })
    if (TOOL_LEAD.captureKey) {
      const res = await submitLead({ lead: r.value, honeypot: trap, key: TOOL_LEAD.captureKey, pageUrl: window.location.href, form: 'ai-chatbot-widget' })
      if (res.ok) return setDone('')
    }
    setDone(wa)
  }

  return (
    <div className="cb-modal" role="dialog" aria-modal="true" aria-label="Add the chatbot to your website">
      <div className="cb-modal__box">
        <button className="cb-modal__x" onClick={onClose} aria-label="Close">×</button>
        <h3 style={{ margin: '0 0 6px', fontSize: 22 }}>Your chatbot is ready</h3>
        <p style={{ margin: '0 0 18px', color: '#6b7280', fontSize: 14.5 }}>Create a free account to embed it on {site}, see visitor chats and capture leads.</p>
        <a className="cb-btn" href={signup} style={{ display: 'block', textAlign: 'center', textDecoration: 'none' }}>Create free account →</a>
        <p className="cb-fine" style={{ textAlign: 'center', margin: '14px 0' }}>or let our team set it up for you</p>
        {done !== null ? (
          <div>
            <p style={{ fontWeight: 600 }}>Thanks! We will contact you shortly.</p>
            {done ? <a className="cb-btn cb-btn--ghost" href={done} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-block', textDecoration: 'none' }}>Message us on WhatsApp</a> : null}
          </div>
        ) : (
          <form onSubmit={submit} noValidate>
            <div className="cb-field"><label htmlFor="g-n">Name</label><input id="g-n" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" /></div>
            <div className="cb-field"><label htmlFor="g-p">WhatsApp number (India)</label><input id="g-p" value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" autoComplete="tel-national" /></div>
            <div className="cb-field"><label htmlFor="g-e">Email (optional)</label><input id="g-e" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" /></div>
            <input type="text" tabIndex={-1} autoComplete="off" aria-hidden="true" value={trap} onChange={(e) => setTrap(e.target.value)} style={{ position: 'absolute', left: '-9999px' }} />
            <label style={{ display: 'flex', gap: 8, fontSize: 13, color: '#4b5563', marginBottom: 12 }}>
              <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} /> I agree to be contacted about this on WhatsApp, phone or email.
            </label>
            {err ? <p className="cb-err" role="alert">{err}</p> : null}
            <button className="cb-btn cb-btn--ghost" type="submit">Request setup help</button>
          </form>
        )}
      </div>
    </div>
  )
}
