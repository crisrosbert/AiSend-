/* eslint-disable @next/next/no-img-element */
'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import type { BotProfile } from '@/lib/tools/chatbot/profile'
import type { LeadCard } from '@/lib/tools/chatbot/booking'
import { LeadCardView } from '../../chatbot-tool'
import '../../chatbot.css'

type Msg = { role: 'user' | 'model'; text: string; card?: LeadCard }

export function DemoChat({ site, profile, session }: { site: string; profile: BotProfile; session: string }) {
  const [msgs, setMsgs] = useState<Msg[]>([{ role: 'model', text: profile.greeting }])
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)
  useEffect(() => { endRef.current?.scrollIntoView({ block: 'end' }) }, [msgs, busy])

  async function send(text: string) {
    const q = text.trim()
    if (!q || busy) return
    const next: Msg[] = [...msgs, { role: 'user', text: q }]
    setMsgs(next)
    setDraft('')
    setBusy(true)
    try {
      const res = await fetch('/api/tools/chatbot/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session,
          profile,
          messages: next.slice(-10).map(({ role, text }) => ({ role, text })),
          tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
        }),
      })
      const data = await res.json().catch(() => ({}))
      const reply = res.ok && data.reply ? data.reply : res.status === 401 ? 'This demo session timed out. Refresh the page to continue.' : data?.error || 'Sorry, I could not answer that. Please try again.'
      setMsgs((m) => [...m, { role: 'model', text: reply, card: res.ok ? data.card : undefined }])
    } catch {
      setMsgs((m) => [...m, { role: 'model', text: 'Connection problem. Please try again.' }])
    } finally {
      setBusy(false)
    }
  }

  const initial = profile.name.trim().charAt(0).toUpperCase() || 'A'
  return (
    <div className="cb-demo">
      <div className="cb-demo__bar">
        <span>Demo chatbot for <b>{site}</b>. Built from the site&apos;s public pages, not affiliated with or endorsed by them.</span>
        <Link href={`/tools/ai-chatbot-widget/remove?site=${encodeURIComponent(site)}`}>Own this site? Remove</Link>
      </div>
      <div className="cb-demo__stage">
        <div className="cb-widget cb-widget--full" role="region" aria-label="Chatbot demo">
          <div className="cb-wh">
            <span className="cb-av" style={{ background: profile.color }}>{profile.logoUrl ? <img src={profile.logoUrl} alt="" referrerPolicy="no-referrer" /> : initial}</span>
            <div><b>{profile.name}</b><small>● Online</small></div>
          </div>
          <div className="cb-msgs" aria-live="polite">
            {msgs.map((m, i) => (
              <div key={i} className="cb-mrow">
                <div className={`cb-m ${m.role === 'user' ? 'cb-m--me' : 'cb-m--bot'}`} style={m.role === 'user' ? { background: profile.color } : undefined}>{m.text}</div>
                {m.card ? <LeadCardView card={m.card} site={site} color={profile.color} /> : null}
              </div>
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
        <p className="cb-demo__cta">Want this on your own website? <Link href="/tools/ai-chatbot-widget">Build yours free →</Link></p>
      </div>
    </div>
  )
}
