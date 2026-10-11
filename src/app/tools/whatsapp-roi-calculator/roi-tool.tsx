'use client'

// src/app/tools/whatsapp-roi-calculator/roi-tool.tsx
//
// Compare what the same campaign returns on WhatsApp, SMS and email. Every
// figure comes from the numbers typed in here (lib/tools/roi.ts does the
// arithmetic). The starting numbers are examples, not benchmarks, and the page
// says so beside the inputs. Nothing typed here leaves the browser.

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Icon } from '@/components/tools/landing/icons'
import { PRESET_EVENT, teamWhatsAppLink, type PresetDetail } from '@/lib/tools/landing-config'
import {
  CHANNEL_IDS,
  DEFAULT_SETUP,
  EXAMPLE_SETUPS,
  breakEvenConversion,
  compare,
  type ChannelId,
  type ChannelInputs,
  type SharedInputs,
  type Setup,
} from '@/lib/tools/roi'

const CURRENCIES = [
  { code: 'INR', label: '₹ Rupee', locale: 'en-IN' },
  { code: 'USD', label: '$ US dollar', locale: 'en-US' },
  { code: 'EUR', label: '€ Euro', locale: 'en-IE' },
  { code: 'GBP', label: '£ Pound', locale: 'en-GB' },
  { code: 'AED', label: 'AED Dirham', locale: 'en-AE' },
]

const CHANNEL_INFO: Record<ChannelId, { name: string; note: string }> = {
  whatsapp: {
    name: 'WhatsApp',
    note: 'Meta charges for each template message delivered. Check the current rate for your country.',
  },
  sms: { name: 'SMS', note: 'Use your SMS provider’s price per message, including any route or registration cost.' },
  email: { name: 'Email', note: 'Work out the cost per email from your email provider’s plan and how much you send.' },
}

type SharedText = Record<keyof SharedInputs, string>
type ChannelText = { [K in keyof ChannelInputs]: K extends 'chargedOn' ? ChannelInputs['chargedOn'] : string }

const toText = (n: number) => String(n)
const num = (s: string) => (s.trim() === '' ? 0 : Number(s))

function sharedToText(s: SharedInputs): SharedText {
  return {
    contacts: toText(s.contacts),
    campaignsPerMonth: toText(s.campaignsPerMonth),
    orderValue: toText(s.orderValue),
    marginPercent: toText(s.marginPercent),
  }
}
function channelToText(c: ChannelInputs): ChannelText {
  return {
    costPerMessage: toText(c.costPerMessage),
    chargedOn: c.chargedOn,
    deliveryPercent: toText(c.deliveryPercent),
    responsePercent: toText(c.responsePercent),
    conversionPercent: toText(c.conversionPercent),
    fixedMonthlyCost: toText(c.fixedMonthlyCost),
  }
}
function channelFromText(c: ChannelText): ChannelInputs {
  return {
    costPerMessage: num(c.costPerMessage),
    chargedOn: c.chargedOn,
    deliveryPercent: num(c.deliveryPercent),
    responsePercent: num(c.responsePercent),
    conversionPercent: num(c.conversionPercent),
    fixedMonthlyCost: num(c.fixedMonthlyCost),
  }
}
function setupToText(s: Setup) {
  return {
    shared: sharedToText(s.shared),
    channels: {
      whatsapp: channelToText(s.channels.whatsapp),
      sms: channelToText(s.channels.sms),
      email: channelToText(s.channels.email),
    } as Record<ChannelId, ChannelText>,
  }
}

function Field({
  id, label, value, onChange, suffix, step = 'any', hint,
}: {
  id: string; label: string; value: string; onChange: (v: string) => void; suffix?: string; step?: string; hint?: string
}) {
  return (
    <div className="tl-numfield">
      <label className="tl-sublabel tl-sublabel--tight" htmlFor={id}>{label}</label>
      <div className="tl-numfield__box">
        <input
          id={id} className="tl-input" type="number" inputMode="decimal" min={0} step={step} value={value}
          onChange={(e) => onChange(e.target.value)} aria-describedby={hint ? `${id}-hint` : undefined}
        />
        {suffix && <span className="tl-numfield__suffix" aria-hidden="true">{suffix}</span>}
      </div>
      {hint && <p id={`${id}-hint`} className="tl-hint">{hint}</p>}
    </div>
  )
}

export function RoiTool() {
  const initial = useMemo(() => setupToText(DEFAULT_SETUP), [])
  const [shared, setShared] = useState<SharedText>(initial.shared)
  const [channels, setChannels] = useState<Record<ChannelId, ChannelText>>(initial.channels)
  const [currency, setCurrency] = useState('INR')
  const [setupId, setSetupId] = useState<string>(DEFAULT_SETUP.id)

  const cur = CURRENCIES.find((c) => c.code === currency) ?? CURRENCIES[0]
  const symbol = useMemo(
    () => (new Intl.NumberFormat(cur.locale, { style: 'currency', currency: cur.code }).formatToParts(0).find((p) => p.type === 'currency')?.value ?? ''),
    [cur],
  )
  const fmtMoney = (n: number) =>
    new Intl.NumberFormat(cur.locale, { style: 'currency', currency: cur.code, maximumFractionDigits: 0 }).format(n)
  const fmtMoney2 = (n: number) =>
    new Intl.NumberFormat(cur.locale, { style: 'currency', currency: cur.code, maximumFractionDigits: 2 }).format(n)
  const fmtInt = (n: number) => new Intl.NumberFormat(cur.locale, { maximumFractionDigits: 0 }).format(Math.round(n))
  const fmtPct = (n: number | null) => (n === null ? 'n/a' : `${new Intl.NumberFormat(cur.locale, { maximumFractionDigits: 0 }).format(n)}%`)

  const sharedInputs: SharedInputs = useMemo(
    () => ({
      contacts: num(shared.contacts),
      campaignsPerMonth: num(shared.campaignsPerMonth),
      orderValue: num(shared.orderValue),
      marginPercent: num(shared.marginPercent),
    }),
    [shared],
  )
  const channelInputs = useMemo(
    () => ({
      whatsapp: channelFromText(channels.whatsapp),
      sms: channelFromText(channels.sms),
      email: channelFromText(channels.email),
    }),
    [channels],
  )
  const result = useMemo(() => compare(sharedInputs, channelInputs), [sharedInputs, channelInputs])
  const topProfit = Math.max(1, ...CHANNEL_IDS.map((id) => Math.max(0, result.results[id].netProfit)))

  const ready = sharedInputs.contacts > 0 && sharedInputs.campaignsPerMonth > 0 && sharedInputs.orderValue > 0

  function loadSetup(s: Setup) {
    const t = setupToText(s)
    setShared(t.shared)
    setChannels(t.channels)
    setSetupId(s.id)
  }

  // Cards further down the page load an example business.
  useEffect(() => {
    const onPreset = (e: Event) => {
      const { data } = (e as CustomEvent<PresetDetail>).detail ?? {}
      const found = EXAMPLE_SETUPS.find((s) => s.id === data?.setup)
      if (found) {
        const t = setupToText(found)
        setShared(t.shared)
        setChannels(t.channels)
        setSetupId(found.id)
      }
    }
    window.addEventListener(PRESET_EVENT, onPreset)
    return () => window.removeEventListener(PRESET_EVENT, onPreset)
  }, [])

  const setShare = (key: keyof SharedInputs, v: string) => {
    setShared((p) => ({ ...p, [key]: v }))
    setSetupId('custom')
  }
  const setChan = (id: ChannelId, key: keyof ChannelInputs, v: string) => {
    setChannels((p) => ({ ...p, [id]: { ...p[id], [key]: v } }))
    setSetupId('custom')
  }

  // ── what to say ─────────────────────────────────────────────────────────
  const name = (id: ChannelId) => CHANNEL_INFO[id].name
  const { bestByRoi, bestByNetProfit } = result
  let verdict: string
  if (!ready || !bestByRoi || !bestByNetProfit) {
    verdict = 'Add your contacts, campaigns and order value to see which channel earns the most.'
  } else if (bestByRoi === bestByNetProfit) {
    verdict = `${name(bestByRoi)} comes out ahead on both return and profit with these numbers.`
  } else {
    verdict = `${name(bestByRoi)} returns the most for every ${symbol}1 spent, but ${name(bestByNetProfit)} leaves you the most profit overall.`
  }

  const shareMessage = useMemo(() => {
    const wa = result.results.whatsapp
    return [
      'Hi, I used the WhatsApp ROI calculator.',
      `I message ${fmtInt(sharedInputs.contacts)} contacts, ${fmtInt(sharedInputs.campaignsPerMonth)} campaigns a month, with an average order of ${fmtMoney(sharedInputs.orderValue)}.`,
      ready ? `On WhatsApp that comes to about ${fmtMoney(wa.netProfit)} net profit a month. I would like help setting it up.` : 'I would like help setting up WhatsApp campaigns.',
    ].join(' ')
    // formatting helpers are rebuilt every render and depend only on `cur`
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result, sharedInputs, ready, cur])

  const rows: Array<{ label: string; value: (id: ChannelId) => string; strong?: boolean }> = [
    { label: 'Messages sent', value: (id) => fmtInt(result.results[id].messages) },
    { label: 'Delivered', value: (id) => fmtInt(result.results[id].delivered) },
    { label: 'Responses (clicks or replies)', value: (id) => fmtInt(result.results[id].responses) },
    { label: 'Orders', value: (id) => fmtInt(result.results[id].orders) },
    { label: 'Revenue', value: (id) => fmtMoney(result.results[id].revenue) },
    { label: 'Profit before messaging cost', value: (id) => fmtMoney(result.results[id].grossProfit) },
    { label: 'Messaging cost', value: (id) => fmtMoney(result.results[id].cost) },
    { label: 'Net profit', value: (id) => fmtMoney(result.results[id].netProfit), strong: true },
    { label: 'Return on cost', value: (id) => fmtPct(result.results[id].roiPercent), strong: true },
    { label: `Revenue for each ${symbol}1 spent`, value: (id) => (result.results[id].roas === null ? 'n/a' : fmtMoney2(result.results[id].roas!)) },
    { label: 'Cost of each order', value: (id) => (result.results[id].costPerOrder === null ? 'n/a' : fmtMoney2(result.results[id].costPerOrder!)) },
    {
      label: 'Break-even conversion',
      value: (id) => {
        const b = breakEvenConversion(sharedInputs, channelInputs[id])
        return b === null ? 'n/a' : `${b.toFixed(1)}%`
      },
    },
  ]

  return (
    <div id="generator" className="tl-toolwrap">
      <div className="tl-tool">
        <div className="tl-toolcard">
          {/* 1. Your campaigns */}
          <div className="tl-tstep tl-tstep--stack">
            <span className="tl-tnum" aria-hidden="true">1</span>
            <div className="tl-tbody">
              <span className="tl-label" id="roi-start">Start from an example, or use your own numbers</span>
              <div className="tl-chips" role="group" aria-labelledby="roi-start">
                {EXAMPLE_SETUPS.map((s) => (
                  <button key={s.id} type="button" className="tl-qchip" aria-pressed={setupId === s.id} onClick={() => loadSetup(s)}>
                    {s.title}
                  </button>
                ))}
              </div>
              <p className="tl-warn tl-warn--first" role="note">
                These are example numbers, not industry benchmarks. Your own prices and results matter far more, so replace them.
              </p>

              <div className="tl-row tl-row--wrap tl-row--tight">
                <div className="tl-col tl-col--narrow">
                  <label className="tl-sublabel tl-sublabel--tight" htmlFor="roi-currency">Currency</label>
                  <select id="roi-currency" className="tl-select" value={currency} onChange={(e) => setCurrency(e.target.value)}>
                    {CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}
                  </select>
                </div>
              </div>

              <div className="tl-grid2">
                <Field id="roi-contacts" label="People in each campaign" value={shared.contacts} onChange={(v) => setShare('contacts', v)} step="1" />
                <Field id="roi-campaigns" label="Campaigns a month" value={shared.campaignsPerMonth} onChange={(v) => setShare('campaignsPerMonth', v)} step="1" />
                <Field id="roi-order" label="Average order value" value={shared.orderValue} onChange={(v) => setShare('orderValue', v)} suffix={symbol} />
                <Field id="roi-margin" label="Profit on each order" value={shared.marginPercent} onChange={(v) => setShare('marginPercent', v)} suffix="%" hint="Before messaging costs." />
              </div>
            </div>
          </div>

          {/* 2. Each channel */}
          <div className="tl-tstep tl-tstep--stack">
            <span className="tl-tnum" aria-hidden="true">2</span>
            <div className="tl-tbody">
              <span className="tl-label">What each channel costs and brings in</span>
              <div className="tl-channels">
                {CHANNEL_IDS.map((id) => {
                  const c = channels[id]
                  return (
                    <fieldset key={id} className="tl-chan">
                      <legend>{CHANNEL_INFO[id].name}</legend>
                      <Field id={`roi-${id}-cost`} label="Cost per message" value={c.costPerMessage} onChange={(v) => setChan(id, 'costPerMessage', v)} suffix={symbol} step="0.01" />
                      <div className="tl-numfield">
                        <label className="tl-sublabel tl-sublabel--tight" htmlFor={`roi-${id}-basis`}>You pay for messages</label>
                        <select
                          id={`roi-${id}-basis`} className="tl-select" value={c.chargedOn}
                          onChange={(e) => setChan(id, 'chargedOn', e.target.value)}
                        >
                          <option value="sent">Sent</option>
                          <option value="delivered">Delivered</option>
                        </select>
                      </div>
                      <Field id={`roi-${id}-delivery`} label="Delivered" value={c.deliveryPercent} onChange={(v) => setChan(id, 'deliveryPercent', v)} suffix="%" />
                      <Field id={`roi-${id}-response`} label="Click or reply" value={c.responsePercent} onChange={(v) => setChan(id, 'responsePercent', v)} suffix="%" />
                      <Field id={`roi-${id}-conversion`} label="Responses that buy" value={c.conversionPercent} onChange={(v) => setChan(id, 'conversionPercent', v)} suffix="%" />
                      <Field id={`roi-${id}-fixed`} label="Fixed cost a month" value={c.fixedMonthlyCost} onChange={(v) => setChan(id, 'fixedMonthlyCost', v)} suffix={symbol} />
                      <p className="tl-hint">{CHANNEL_INFO[id].note}</p>
                    </fieldset>
                  )
                })}
              </div>
            </div>
          </div>

          {/* 3. The detail */}
          <div className="tl-tstep tl-tstep--stack">
            <span className="tl-tnum" aria-hidden="true">3</span>
            <div className="tl-tbody">
              <span className="tl-label">The full picture, month by month</span>
              <div className="tl-tablewrap tl-tablewrap--tool" role="region" aria-label="Results for each channel" tabIndex={0}>
                <table className="tl-rtable">
                  <thead>
                    <tr>
                      <th scope="col"><span className="sr-only">Measure</span></th>
                      {CHANNEL_IDS.map((id) => <th key={id} scope="col">{name(id)}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.label} className={r.strong ? 'tl-rtable__strong' : undefined}>
                        <th scope="row">{r.label}</th>
                        {CHANNEL_IDS.map((id) => <td key={id}>{r.value(id)}</td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="tl-hint">
                Break-even conversion is the share of responses that must buy for a channel to cover its cost. Below that, it loses money.
              </p>
            </div>
          </div>

          <p className="tl-toolfoot">
            Nothing you type here is saved or sent anywhere. The figures are worked out in your browser from the numbers you enter.
          </p>
        </div>

        <aside className="tl-prevcol" aria-label="Results">
          <p className="tl-prevcap">Your monthly results</p>
          <div className="tl-rcard">
            <p className="tl-rcard__verdict" role="status" aria-live="polite">{verdict}</p>

            <ul className="tl-bars">
              {CHANNEL_IDS.map((id) => {
                const r = result.results[id]
                const width = ready ? Math.max(0, Math.min(100, (Math.max(0, r.netProfit) / topProfit) * 100)) : 0
                return (
                  <li key={id} className="tl-bar">
                    <div className="tl-bar__top">
                      <b>{name(id)}</b>
                      <span className="tl-bar__badges">
                        {ready && bestByNetProfit === id && <span className="tl-tick">Most profit</span>}
                        {ready && bestByRoi === id && <span className="tl-tick tl-tick--blue">Best return</span>}
                      </span>
                    </div>
                    <div className="tl-bar__track" aria-hidden="true">
                      <i style={{ width: `${width}%` }} className={r.netProfit < 0 ? 'tl-bar__neg' : undefined} />
                    </div>
                    <div className="tl-bar__nums">
                      <span>
                        <small>Net profit</small>
                        {fmtMoney(r.netProfit)}
                      </span>
                      <span>
                        <small>Return on cost</small>
                        {fmtPct(r.roiPercent)}
                      </span>
                    </div>
                  </li>
                )
              })}
            </ul>

            <a
              className="tl-btn tl-btn--primary tl-btn--sm tl-rcard__cta"
              href={teamWhatsAppLink(shareMessage)} target="_blank" rel="noopener noreferrer"
            >
              <Icon name="chat" size={17} />
              Send these numbers to our team
            </a>
            <p className="tl-hint">Opens WhatsApp with a message ready to send. You decide whether to send it.</p>
          </div>
        </aside>
      </div>

      <p className="tl-upsell">
        Ready to run the WhatsApp campaigns? Send templates to opted-in contacts and manage the replies in one inbox.{' '}
        <Link href="/signup">Try AiSend free</Link>
      </p>
    </div>
  )
}
