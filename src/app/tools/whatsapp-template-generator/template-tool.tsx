'use client'

// src/app/tools/whatsapp-template-generator/template-tool.tsx
//
// Write a WhatsApp message template, see it the way a customer will, and
// check it against the rules that most often get a template refused. Like the
// other tools on these pages it needs nothing from the rest of the app:
// everything you type stays in this tab.
//
// The checking and the JSON live in lib/tools/template-checker.ts. This file
// is the form, the live preview and the results.

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { Icon, type IconName } from '@/components/tools/landing/icons'
import { PRESET_EVENT, type PresetDetail } from '@/lib/tools/landing-config'
import {
  LIMITS,
  buildApiPayload,
  checkTemplate,
  findVariables,
  renderWithSamples,
  suggestTemplateName,
  type ButtonType,
  type Severity,
  type TemplateButton,
  type TemplateCategory,
  type TemplateInput,
} from '@/lib/tools/template-checker'
import { TEMPLATE_PRESETS, presetById } from '@/lib/tools/template-presets'
import { TemplateBubble } from './template-bubble'

const CATEGORIES: ReadonlyArray<{ id: TemplateCategory; label: string; text: string }> = [
  {
    id: 'marketing',
    label: 'Marketing',
    text: 'Offers, launches, reminders to come back and anything else that promotes your business.',
  },
  {
    id: 'utility',
    label: 'Utility',
    text: 'A follow-up on something the customer did, such as an order update, a booking or a payment.',
  },
  {
    id: 'authentication',
    label: 'Authentication',
    text: 'One-time passcodes for logging in or confirming an action. Meta writes the wording and you choose the options.',
  },
]

const LANGUAGES: ReadonlyArray<{ code: string; label: string }> = [
  { code: 'en', label: 'English' },
  { code: 'en_US', label: 'English (US)' },
  { code: 'en_GB', label: 'English (UK)' },
  { code: 'hi', label: 'Hindi' },
  { code: 'mr', label: 'Marathi' },
  { code: 'gu', label: 'Gujarati' },
  { code: 'bn', label: 'Bengali' },
  { code: 'ta', label: 'Tamil' },
  { code: 'te', label: 'Telugu' },
  { code: 'kn', label: 'Kannada' },
  { code: 'ml', label: 'Malayalam' },
  { code: 'pa', label: 'Punjabi' },
  { code: 'ur', label: 'Urdu' },
  { code: 'ar', label: 'Arabic' },
  { code: 'es', label: 'Spanish' },
  { code: 'pt_BR', label: 'Portuguese (Brazil)' },
  { code: 'fr', label: 'French' },
  { code: 'de', label: 'German' },
  { code: 'id', label: 'Indonesian' },
]

const BUTTON_KINDS: ReadonlyArray<{ type: ButtonType; add: string; label: string; limit: number | null }> = [
  { type: 'quick_reply', add: 'Quick reply', label: 'Quick reply', limit: null },
  { type: 'url', add: 'Link', label: 'Link button', limit: LIMITS.urls },
  { type: 'phone', add: 'Call', label: 'Call button', limit: LIMITS.phones },
  { type: 'copy_code', add: 'Copy code', label: 'Copy-code button', limit: LIMITS.copyCodes },
]

const VERDICT_TITLES: Record<Severity, string> = {
  error: 'Fix these first',
  warning: 'Worth another look',
  tip: 'Good practice',
}
const FINDING_ICON: Record<Severity, IconName> = { error: 'warning', warning: 'warning', tip: 'bolt' }

const MAX_SAMPLE_SLOTS = 100

function blankTemplate(): TemplateInput {
  return {
    name: '',
    category: 'utility',
    language: 'en',
    headerText: '',
    headerSample: '',
    body: '',
    bodySamples: [],
    footer: '',
    buttons: [],
    auth: { securityNote: true, expiryMinutes: 10, buttonText: 'Copy code' },
  }
}

function startingTemplate(): TemplateInput {
  return presetById('order-update') ?? blankTemplate()
}

function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`
}

/** The fixed message Meta sends for an authentication template. */
function authBody(securityNote: boolean): string {
  return `*123456* is your verification code.${securityNote ? ' For your security, do not share this code.' : ''}`
}

function templateAsText(t: TemplateInput): string {
  if (t.category === 'authentication') {
    const lines = [authBody(t.auth.securityNote).replace(/\*/g, '')]
    if (t.auth.expiryMinutes !== null) lines.push(`This code expires in ${t.auth.expiryMinutes} minutes.`)
    lines.push(`[${t.auth.buttonText}]`)
    return lines.join('\n')
  }
  const lines: string[] = []
  if (t.headerText.trim()) lines.push(`Header: ${t.headerText.trim()}`)
  lines.push(`Body: ${t.body.trim()}`)
  if (t.footer.trim()) lines.push(`Footer: ${t.footer.trim()}`)
  for (const b of t.buttons) {
    lines.push(`Button (${b.type.replace('_', ' ')}): ${b.text.trim()}${b.value.trim() ? ` → ${b.value.trim()}` : ''}`)
  }
  return lines.join('\n')
}

function save(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

function Counter({ value, max }: { value: number; max: number }) {
  return <span className={`tl-count${value > max ? ' tl-count--over' : ''}`}>{value}/{max}</span>
}

export function TemplateTool() {
  const [t, setT] = useState<TemplateInput>(startingTemplate)
  const [copied, setCopied] = useState<'json' | 'text' | null>(null)
  const bodyBox = useRef<HTMLTextAreaElement>(null)

  const update = (patch: Partial<TemplateInput>) => setT((prev) => ({ ...prev, ...patch }))
  const isAuth = t.category === 'authentication'

  // Cards further down the page load a ready-made template.
  useEffect(() => {
    const onPreset = (e: Event) => {
      const { message, data } = (e as CustomEvent<PresetDetail>).detail ?? {}
      const preset = data?.preset ? presetById(data.preset) : null
      if (preset) setT(preset)
      else if (typeof message === 'string') setT((prev) => ({ ...prev, category: prev.category === 'authentication' ? 'utility' : prev.category, body: message }))
      bodyBox.current?.focus({ preventScroll: true })
    }
    window.addEventListener(PRESET_EVENT, onPreset)
    return () => window.removeEventListener(PRESET_EVENT, onPreset)
  }, [])

  const result = useMemo(() => checkTemplate(t), [t])
  const payloadJson = useMemo(() => JSON.stringify(buildApiPayload(t), null, 2), [t])

  // ── variables ──────────────────────────────────────────────────────────
  const bodyNumbers = useMemo(
    () => Array.from(new Set(findVariables(t.body).numbers)).filter((n) => n >= 1 && n <= MAX_SAMPLE_SLOTS).sort((a, b) => a - b),
    [t.body],
  )
  const headerHasVariable = findVariables(t.headerText).numbers.length > 0

  function setBodySample(n: number, value: string) {
    setT((prev) => {
      const next = [...prev.bodySamples]
      while (next.length < n) next.push('')
      next[n - 1] = value
      return { ...prev, bodySamples: next }
    })
  }

  function insertAtCursor(text: string) {
    const el = bodyBox.current
    const at = el?.selectionStart ?? t.body.length
    const to = el?.selectionEnd ?? at
    update({ body: t.body.slice(0, at) + text + t.body.slice(to) })
    requestAnimationFrame(() => {
      el?.focus()
      el?.setSelectionRange(at + text.length, at + text.length)
    })
  }

  function addVariable() {
    const used = findVariables(t.body).numbers
    insertAtCursor(`{{${(used.length ? Math.max(...used) : 0) + 1}}}`)
  }

  function wrapSelection(mark: string) {
    const el = bodyBox.current
    if (!el) return
    const a = el.selectionStart
    const b = el.selectionEnd
    const picked = t.body.slice(a, b)
    update({ body: t.body.slice(0, a) + mark + picked + mark + t.body.slice(b) })
    requestAnimationFrame(() => {
      el.focus()
      el.setSelectionRange(a + mark.length, a + mark.length + picked.length)
    })
  }

  // ── buttons ────────────────────────────────────────────────────────────
  const countOf = (type: ButtonType) => t.buttons.filter((b) => b.type === type).length

  function addButton(type: ButtonType) {
    const fresh: TemplateButton = { type, text: type === 'copy_code' ? 'Copy offer code' : '', value: '', sample: '' }
    update({ buttons: [...t.buttons, fresh] })
  }
  function setButton(i: number, patch: Partial<TemplateButton>) {
    update({ buttons: t.buttons.map((b, j) => (j === i ? { ...b, ...patch } : b)) })
  }
  function removeButton(i: number) {
    update({ buttons: t.buttons.filter((_, j) => j !== i) })
  }

  // ── category change ────────────────────────────────────────────────────
  function chooseCategory(category: TemplateCategory) {
    setT((prev) => ({ ...prev, category }))
  }

  // ── copying ────────────────────────────────────────────────────────────
  async function copy(kind: 'json' | 'text') {
    const value = kind === 'json' ? payloadJson : templateAsText(t)
    try {
      await navigator.clipboard.writeText(value)
      setCopied(kind)
      setTimeout(() => setCopied(null), 1800)
    } catch {
      /* clipboard blocked: the request body is also shown below */
    }
  }

  function downloadJson() {
    save(new Blob([payloadJson], { type: 'application/json' }), `${t.name.trim() || 'template'}.json`)
  }

  // ── what the phone shows ───────────────────────────────────────────────
  const previewHeader = isAuth ? undefined : renderWithSamples(t.headerText.trim(), [t.headerSample])
  const previewBody = isAuth ? authBody(t.auth.securityNote) : renderWithSamples(t.body.trim(), t.bodySamples)
  const previewFooter = isAuth
    ? t.auth.expiryMinutes !== null ? `This code expires in ${t.auth.expiryMinutes} minutes.` : undefined
    : t.footer.trim() || undefined
  const previewButtons = isAuth
    ? [{ kind: 'copy_code' as const, label: t.auth.buttonText.trim() }]
    : t.buttons.map((b) => ({ kind: b.type, label: b.type === 'copy_code' ? b.text.trim() || 'Copy code' : b.text.trim() }))

  const suggestion = suggestTemplateName(t.name)
  const nameNeedsFix = t.name.trim() !== '' && suggestion !== '' && suggestion !== t.name.trim()

  const verdict: 'ok' | 'warn' | 'bad' = !result.ready ? 'bad' : result.warnings > 0 ? 'warn' : 'ok'
  const verdictText =
    verdict === 'bad'
      ? `Fix ${plural(result.errors, 'thing')} before you submit`
      : verdict === 'warn'
        ? `Ready to submit, with ${plural(result.warnings, 'thing')} worth another look`
        : 'Looks ready to submit'
  const groups: Severity[] = ['error', 'warning', 'tip']

  return (
    <div id="generator" className="tl-toolwrap">
      <div className="tl-tool">
        <div className="tl-toolcard">
          {/* 1. Type and name */}
          <div className="tl-tstep">
            <span className="tl-tnum" aria-hidden="true">1</span>
            <div className="tl-tbody">
              <span className="tl-label" id="tpl-start">Start from an example, or write your own</span>
              <div className="tl-chips" role="group" aria-labelledby="tpl-start">
                {TEMPLATE_PRESETS.map((p) => (
                  <button key={p.id} type="button" className="tl-qchip" onClick={() => setT(structuredClone(p.template))}>
                    {p.title}
                  </button>
                ))}
                <button type="button" className="tl-qchip tl-qchip--plain" onClick={() => setT(blankTemplate())}>
                  Start blank
                </button>
              </div>

              <span className="tl-sublabel" id="tpl-cat">Category</span>
              <div className="tl-seg" role="group" aria-labelledby="tpl-cat">
                {CATEGORIES.map((c) => (
                  <button key={c.id} type="button" aria-pressed={t.category === c.id} onClick={() => chooseCategory(c.id)}>
                    {c.label}
                  </button>
                ))}
              </div>
              <p className="tl-hint">{CATEGORIES.find((c) => c.id === t.category)?.text}</p>

              <div className="tl-row tl-row--wrap">
                <div className="tl-col">
                  <label className="tl-sublabel" htmlFor="tpl-name">Template name</label>
                  <input
                    id="tpl-name" className="tl-input" value={t.name} spellCheck={false} autoComplete="off"
                    placeholder="order_shipped" onChange={(e) => update({ name: e.target.value })}
                    aria-invalid={nameNeedsFix ? true : undefined}
                  />
                </div>
                <div className="tl-col tl-col--narrow">
                  <label className="tl-sublabel" htmlFor="tpl-lang">Language</label>
                  <select id="tpl-lang" className="tl-select" value={t.language} onChange={(e) => update({ language: e.target.value })}>
                    {LANGUAGES.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
                  </select>
                </div>
              </div>
              {nameNeedsFix ? (
                <p className="tl-hint">
                  Names use lowercase letters, numbers and underscores.{' '}
                  <button type="button" className="tl-textlink" onClick={() => update({ name: suggestion })}>
                    Use {suggestion}
                  </button>
                </p>
              ) : (
                <p className="tl-hint">Lowercase letters, numbers and underscores only, such as order_shipped_v1.</p>
              )}
            </div>
          </div>

          {/* 2. The message */}
          <div className="tl-tstep">
            <span className="tl-tnum" aria-hidden="true">2</span>
            <div className="tl-tbody">
              <span className="tl-label">{isAuth ? 'Choose the options' : 'Write the message'}</span>

              {isAuth ? (
                <>
                  <p className="tl-hint tl-hint--top">
                    Authentication messages have fixed wording. You decide whether to add the security reminder and when the code expires.
                  </p>
                  <div className="tl-optlist">
                    <label className="tl-check">
                      <input
                        type="checkbox" checked={t.auth.securityNote}
                        onChange={(e) => update({ auth: { ...t.auth, securityNote: e.target.checked } })}
                      />
                      <span>Add &ldquo;For your security, do not share this code.&rdquo;</span>
                    </label>
                    <label className="tl-check">
                      <input
                        type="checkbox" checked={t.auth.expiryMinutes !== null}
                        onChange={(e) => update({ auth: { ...t.auth, expiryMinutes: e.target.checked ? 10 : null } })}
                      />
                      <span>Show when the code expires</span>
                    </label>
                  </div>
                  {t.auth.expiryMinutes !== null && (
                    <div className="tl-row tl-row--center tl-gap-top">
                      <label className="tl-sublabel tl-sublabel--inline" htmlFor="tpl-expiry">Expires after</label>
                      <input
                        id="tpl-expiry" className="tl-input tl-input--num" type="number" inputMode="numeric" min={1} max={90}
                        value={t.auth.expiryMinutes}
                        onChange={(e) => update({ auth: { ...t.auth, expiryMinutes: e.target.value === '' ? 0 : Number(e.target.value) } })}
                      />
                      <span className="tl-unit">minutes (1 to 90)</span>
                    </div>
                  )}
                  <div className="tl-labelrow tl-gap-top">
                    <label className="tl-sublabel tl-sublabel--tight" htmlFor="tpl-authbtn">Button text</label>
                    <Counter value={t.auth.buttonText.length} max={LIMITS.buttonText} />
                  </div>
                  <input
                    id="tpl-authbtn" className="tl-input" value={t.auth.buttonText}
                    onChange={(e) => update({ auth: { ...t.auth, buttonText: e.target.value } })}
                  />
                </>
              ) : (
                <>
                  <div className="tl-labelrow">
                    <label className="tl-sublabel tl-sublabel--tight" htmlFor="tpl-header">Header <span className="tl-opt">(optional)</span></label>
                    <Counter value={t.headerText.length} max={LIMITS.header} />
                  </div>
                  <input
                    id="tpl-header" className="tl-input" value={t.headerText} placeholder="Your order is on its way"
                    onChange={(e) => update({ headerText: e.target.value })}
                  />
                  {headerHasVariable && (
                    <div className="tl-sample">
                      <code className="tl-varchip">{'{{1}}'}</code>
                      <input
                        className="tl-input" value={t.headerSample} placeholder="Example, such as Priya"
                        aria-label="Example for the header variable" onChange={(e) => update({ headerSample: e.target.value })}
                      />
                    </div>
                  )}

                  <div className="tl-labelrow tl-gap-top">
                    <label className="tl-sublabel tl-sublabel--tight" htmlFor="tpl-body">Message</label>
                    <Counter value={t.body.trim().length} max={LIMITS.body} />
                  </div>
                  <div className="tl-fmtbar" role="toolbar" aria-label="Formatting">
                    <button type="button" className="tl-fmtbtn" onClick={() => wrapSelection('*')} aria-label="Bold" title="Bold"><b>B</b></button>
                    <button type="button" className="tl-fmtbtn" onClick={() => wrapSelection('_')} aria-label="Italic" title="Italic"><i>I</i></button>
                    <button type="button" className="tl-fmtbtn" onClick={() => wrapSelection('~')} aria-label="Strikethrough" title="Strikethrough"><s>S</s></button>
                    <button type="button" className="tl-fmtbtn tl-fmtbtn--wide" onClick={addVariable}>
                      <Icon name="plus" size={14} strokeWidth={2.4} />
                      Add variable
                    </button>
                  </div>
                  <textarea
                    id="tpl-body" ref={bodyBox} className="tl-textarea tl-textarea--tall" value={t.body}
                    placeholder="Hi {{1}}, your order {{2}} has shipped."
                    onChange={(e) => update({ body: e.target.value })}
                  />
                  <p className="tl-hint">
                    A variable is a blank filled in for each customer, written {'{{1}}'}, {'{{2}}'} and so on. Never start or end the message with one.
                  </p>

                  {bodyNumbers.length > 0 && (
                    <div className="tl-samples">
                      <span className="tl-sublabel">Examples for the review</span>
                      {bodyNumbers.map((n) => (
                        <div className="tl-sample" key={n}>
                          <code className="tl-varchip">{`{{${n}}}`}</code>
                          <input
                            className="tl-input" value={t.bodySamples[n - 1] ?? ''} placeholder="A real-looking example"
                            aria-label={`Example for variable ${n}`} onChange={(e) => setBodySample(n, e.target.value)}
                          />
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="tl-labelrow tl-gap-top">
                    <label className="tl-sublabel tl-sublabel--tight" htmlFor="tpl-footer">Footer <span className="tl-opt">(optional)</span></label>
                    <Counter value={t.footer.length} max={LIMITS.footer} />
                  </div>
                  <input
                    id="tpl-footer" className="tl-input" value={t.footer} placeholder="Reply to this message if you need help"
                    onChange={(e) => update({ footer: e.target.value })}
                  />
                </>
              )}
            </div>
          </div>

          {/* 3. Buttons */}
          {!isAuth && (
            <div className="tl-tstep">
              <span className="tl-tnum" aria-hidden="true">3</span>
              <div className="tl-tbody">
                <span className="tl-label">Buttons <span className="tl-opt">(optional)</span></span>

                {t.buttons.map((b, i) => {
                  const kind = BUTTON_KINDS.find((k) => k.type === b.type)!
                  const urlHasVariable = b.type === 'url' && findVariables(b.value).numbers.length > 0
                  return (
                    <div className="tl-btnrow" key={`${b.type}-${i}`}>
                      <div className="tl-btnrow__head">
                        <span className="tl-btnrow__type">{kind.label}</span>
                        <button type="button" className="tl-iconbtn" onClick={() => removeButton(i)} aria-label={`Remove ${kind.label.toLowerCase()} ${i + 1}`}>
                          <Icon name="minus" size={16} strokeWidth={2.2} />
                        </button>
                      </div>

                      {b.type !== 'copy_code' && (
                        <>
                          <div className="tl-labelrow">
                            <label className="tl-sublabel tl-sublabel--tight" htmlFor={`tpl-b${i}-text`}>Button text</label>
                            <Counter value={b.text.length} max={LIMITS.buttonText} />
                          </div>
                          <input
                            id={`tpl-b${i}-text`} className="tl-input" value={b.text}
                            placeholder={b.type === 'quick_reply' ? 'Stop promotions' : b.type === 'url' ? 'Track order' : 'Call us'}
                            onChange={(e) => setButton(i, { text: e.target.value })}
                          />
                        </>
                      )}

                      {b.type === 'url' && (
                        <>
                          <label className="tl-sublabel" htmlFor={`tpl-b${i}-value`}>Web address</label>
                          <input
                            id={`tpl-b${i}-value`} className="tl-input" value={b.value} spellCheck={false} inputMode="url"
                            placeholder="https://example.com/track/{{1}}" onChange={(e) => setButton(i, { value: e.target.value })}
                          />
                          {urlHasVariable ? (
                            <div className="tl-sample">
                              <code className="tl-varchip">{'{{1}}'}</code>
                              <input
                                className="tl-input" value={b.sample ?? ''} placeholder="Example for the end of the link"
                                aria-label="Example for the link variable" onChange={(e) => setButton(i, { sample: e.target.value })}
                              />
                            </div>
                          ) : (
                            <p className="tl-hint">Add {'{{1}}'} at the very end to send each customer to their own page.</p>
                          )}
                        </>
                      )}

                      {b.type === 'phone' && (
                        <>
                          <label className="tl-sublabel" htmlFor={`tpl-b${i}-value`}>Phone number</label>
                          <input
                            id={`tpl-b${i}-value`} className="tl-input" value={b.value} inputMode="tel" spellCheck={false}
                            placeholder="+919876543210" onChange={(e) => setButton(i, { value: e.target.value })}
                          />
                          <p className="tl-hint">International format: + then the country code and number, with no spaces.</p>
                        </>
                      )}

                      {b.type === 'copy_code' && (
                        <>
                          <label className="tl-sublabel" htmlFor={`tpl-b${i}-value`}>Example code</label>
                          <input
                            id={`tpl-b${i}-value`} className="tl-input" value={b.value} spellCheck={false}
                            placeholder="SAVE20" onChange={(e) => setButton(i, { value: e.target.value })}
                          />
                          <p className="tl-hint">Only a sample for the review. You send the real code with each message.</p>
                        </>
                      )}
                    </div>
                  )
                })}

                <div className="tl-addrow" role="group" aria-label="Add a button">
                  {BUTTON_KINDS.map((k) => {
                    const full = k.limit !== null && countOf(k.type) >= k.limit
                    const tooMany = t.buttons.length >= LIMITS.buttons
                    return (
                      <button key={k.type} type="button" className="tl-btn tl-btn--ghost tl-btn--sm" disabled={full || tooMany} onClick={() => addButton(k.type)}>
                        <Icon name="plus" size={15} strokeWidth={2.4} />
                        {k.add}
                      </button>
                    )
                  })}
                </div>
                <p className="tl-hint">
                  Up to {LIMITS.buttons} buttons. At most {LIMITS.urls} link buttons, {LIMITS.phones} call button and {LIMITS.copyCodes} copy-code button.
                </p>
              </div>
            </div>
          )}

          {/* 4. Check and export */}
          <div className="tl-tstep">
            <span className="tl-tnum" aria-hidden="true">{isAuth ? 3 : 4}</span>
            <div className="tl-tbody">
              <span className="tl-label">Check it, then copy it</span>

              <div className={`tl-verdict tl-verdict--${verdict}`} role="status" aria-live="polite">
                <Icon name={verdict === 'bad' ? 'warning' : 'shield'} size={22} />
                <div>
                  <b>{verdictText}</b>
                  <span>
                    {plural(result.errors, 'problem')}, {plural(result.warnings, 'warning')}, {plural(result.tips, 'tip')}
                  </span>
                </div>
              </div>

              {groups.map((sev) => {
                const items = result.findings.filter((f) => f.severity === sev)
                if (items.length === 0) return null
                return (
                  <div key={sev} className="tl-fgroup">
                    <h4 className="tl-fhead">{VERDICT_TITLES[sev]}</h4>
                    <ul className="tl-findings">
                      {items.map((f, i) => (
                        <li key={`${f.id}-${i}`} className={`tl-finding tl-finding--${sev}`}>
                          <Icon name={FINDING_ICON[sev]} size={19} />
                          <div>
                            <b>{f.title}</b>
                            <p>{f.detail}</p>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                )
              })}

              <p className="tl-hint tl-hint--top">
                This check covers the most common reasons for rejection. Meta reviews every template itself and makes the final decision.
              </p>

              <div className="tl-actions">
                <button type="button" className="tl-btn tl-btn--primary tl-btn--sm" disabled={!result.ready} onClick={() => copy('json')}>
                  <Icon name={copied === 'json' ? 'check' : 'code'} size={17} strokeWidth={copied === 'json' ? 2.4 : 1.8} />
                  {copied === 'json' ? 'Copied' : 'Copy API request body'}
                </button>
                <button type="button" className="tl-btn tl-btn--ghost tl-btn--sm" disabled={!result.ready} onClick={downloadJson}>
                  <Icon name="download" size={16} />
                  Download JSON
                </button>
                <button type="button" className="tl-btn tl-btn--ghost tl-btn--sm" onClick={() => copy('text')}>
                  <Icon name={copied === 'text' ? 'check' : 'copy'} size={16} strokeWidth={copied === 'text' ? 2.4 : 1.8} />
                  {copied === 'text' ? 'Copied' : 'Copy as text'}
                </button>
              </div>

              <details className="tl-code">
                <summary>See the request body</summary>
                {result.ready ? (
                  <pre tabIndex={0}>{payloadJson}</pre>
                ) : (
                  <p className="tl-hint tl-hint--pad">Fix the problems above and the request body appears here.</p>
                )}
              </details>
              <p className="tl-hint">
                Send it with <code>POST /&#123;WABA-ID&#125;/message_templates</code> on the WhatsApp Cloud API, or paste the text into the template manager.
              </p>
            </div>
          </div>

          <p className="tl-toolfoot">
            Nothing you type here is saved or sent anywhere. The check runs entirely in your browser.
          </p>
        </div>

        <aside className="tl-prevcol" aria-label="Preview">
          <p className="tl-prevcap">How it looks on a phone</p>
          <div className="tl-phone tl-phone--tpl">
            <div className="tl-phone__head">
              <span className="tl-phone__avatar"><Icon name="store" size={17} /></span>
              <div>
                <div className="tl-phone__name">Your business</div>
                <div className="tl-phone__status">Business account</div>
              </div>
            </div>
            <div className="tl-phone__body">
              <span className="tl-day">Today</span>
              <TemplateBubble header={previewHeader} body={previewBody} footer={previewFooter} buttons={previewButtons} />
            </div>
            <div className="tl-phone__foot">
              <span className="tl-phone__input">Message</span>
              <span className="tl-phone__send"><Icon name="send" size={16} /></span>
            </div>
          </div>
          <p className="tl-qrprev__tip">
            <Icon name="file" size={16} />
            Names and numbers in the preview are your examples.
          </p>
        </aside>
      </div>

      <p className="tl-upsell">
        Once a template is approved, send it to thousands of opted-in contacts at once.{' '}
        <Link href="/signup">Try AiSend free</Link>
      </p>
    </div>
  )
}
