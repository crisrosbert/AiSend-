'use client'

import { useState, type FormEvent } from 'react'

export function RemoveForm({ initialSite }: { initialSite: string }) {
  const [site, setSite] = useState(initialSite)
  const [contact, setContact] = useState('')
  const [state, setState] = useState<'idle' | 'busy' | 'done'>('idle')
  const [err, setErr] = useState('')

  async function submit(e: FormEvent) {
    e.preventDefault()
    setState('busy')
    setErr('')
    const res = await fetch('/api/tools/chatbot/remove', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ site, contact }),
    }).catch(() => null)
    const data = await res?.json().catch(() => ({}))
    if (res?.ok) return setState('done')
    setErr(data?.error || 'Something went wrong.')
    setState('idle')
  }

  if (state === 'done') return <p style={{ fontWeight: 600 }}>Done. {site} is hidden and its demo links are switched off.</p>
  return (
    <form onSubmit={submit} className="cb" style={{ display: 'block' }}>
      <div className="cb-field"><label htmlFor="r-s">Website</label><input id="r-s" value={site} onChange={(e) => setSite(e.target.value)} placeholder="example.com" /></div>
      <div className="cb-field"><label htmlFor="r-c">Your email (optional)</label><input id="r-c" type="email" value={contact} onChange={(e) => setContact(e.target.value)} /></div>
      {err ? <p className="cb-err" role="alert">{err}</p> : null}
      <button className="cb-btn" type="submit" disabled={state === 'busy'}>Remove my website</button>
    </form>
  )
}
