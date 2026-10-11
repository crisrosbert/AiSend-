// src/lib/tools/roi.ts
//
// The arithmetic behind the WhatsApp vs SMS vs email calculator. Every figure
// is worked out from the numbers the person types in; nothing here is a
// benchmark or a claim about how any channel performs. The example setups are
// labelled as examples in the tool, and are only a place to start.
//
// The chain for one channel, for one month:
//   messages   = contacts x campaigns
//   delivered  = messages x delivery %
//   responses  = delivered x response %      (a click or a reply)
//   orders     = responses x conversion %
//   revenue    = orders x order value
//   profit     = revenue x margin %  (before the cost of messaging)
//   cost       = per-message price x (sent or delivered) + fixed monthly cost
//   net profit = profit - cost
//   return     = net profit / cost

export const CHANNEL_IDS = ['whatsapp', 'sms', 'email'] as const
export type ChannelId = (typeof CHANNEL_IDS)[number]

export interface SharedInputs {
  /** People you message in each campaign. */
  contacts: number
  campaignsPerMonth: number
  /** Average value of one order. */
  orderValue: number
  /** Share of each order that is profit, before messaging costs. */
  marginPercent: number
}

export interface ChannelInputs {
  costPerMessage: number
  /** WhatsApp charges for messages delivered; SMS and email usually for messages sent. */
  chargedOn: 'sent' | 'delivered'
  deliveryPercent: number
  /** Share of delivered messages that get a click or a reply. */
  responsePercent: number
  /** Share of responses that become an order. */
  conversionPercent: number
  /** Platform or subscription cost for the month. */
  fixedMonthlyCost: number
}

export interface ChannelResult {
  messages: number
  delivered: number
  responses: number
  orders: number
  revenue: number
  grossProfit: number
  cost: number
  netProfit: number
  /** Net profit as a percentage of cost. Null when nothing was spent. */
  roiPercent: number | null
  /** Revenue per unit of cost. Null when nothing was spent. */
  roas: number | null
  /** Null when there were no orders. */
  costPerOrder: number | null
}

export interface Comparison {
  results: Record<ChannelId, ChannelResult>
  /** Highest return on what was spent. Null when no channel earns anything. */
  bestByRoi: ChannelId | null
  /** Most money left after costs. Null when no channel earns anything. */
  bestByNetProfit: ChannelId | null
}

// Anyone can type 1e308 into a number box. Capping every input keeps the
// sums below far from the point where they turn into Infinity or NaN, and is
// still far above any real list, price or order.
const MAX_INPUT = 1e9

function money(n: number): number {
  return Number.isFinite(n) && n > 0 ? Math.min(n, MAX_INPUT) : 0
}
function count(n: number): number {
  return Math.floor(money(n))
}
function percent(n: number): number {
  return Math.min(100, money(n))
}

export function sanitizeShared(s: SharedInputs): SharedInputs {
  return {
    contacts: count(s.contacts),
    campaignsPerMonth: count(s.campaignsPerMonth),
    orderValue: money(s.orderValue),
    marginPercent: percent(s.marginPercent),
  }
}

export function sanitizeChannel(c: ChannelInputs): ChannelInputs {
  return {
    costPerMessage: money(c.costPerMessage),
    chargedOn: c.chargedOn === 'delivered' ? 'delivered' : 'sent',
    deliveryPercent: percent(c.deliveryPercent),
    responsePercent: percent(c.responsePercent),
    conversionPercent: percent(c.conversionPercent),
    fixedMonthlyCost: money(c.fixedMonthlyCost),
  }
}

export function calculateChannel(sharedIn: SharedInputs, channelIn: ChannelInputs): ChannelResult {
  const s = sanitizeShared(sharedIn)
  const c = sanitizeChannel(channelIn)

  const messages = s.contacts * s.campaignsPerMonth
  const delivered = messages * (c.deliveryPercent / 100)
  const responses = delivered * (c.responsePercent / 100)
  const orders = responses * (c.conversionPercent / 100)
  const revenue = orders * s.orderValue
  const grossProfit = revenue * (s.marginPercent / 100)
  const cost = (c.chargedOn === 'delivered' ? delivered : messages) * c.costPerMessage + c.fixedMonthlyCost
  const netProfit = grossProfit - cost

  return {
    messages,
    delivered,
    responses,
    orders,
    revenue,
    grossProfit,
    cost,
    netProfit,
    roiPercent: cost > 0 ? (netProfit / cost) * 100 : null,
    roas: cost > 0 ? revenue / cost : null,
    costPerOrder: orders > 0 ? cost / orders : null,
  }
}

/** The first channel with the highest value; ties go to the earlier channel. */
function best(results: Record<ChannelId, ChannelResult>, value: (r: ChannelResult) => number | null): ChannelId | null {
  if (CHANNEL_IDS.every((id) => results[id].revenue <= 0)) return null
  let winner: ChannelId | null = null
  let top = -Infinity
  for (const id of CHANNEL_IDS) {
    const v = value(results[id])
    if (v !== null && v > top) {
      top = v
      winner = id
    }
  }
  return winner
}

export function compare(shared: SharedInputs, channels: Record<ChannelId, ChannelInputs>): Comparison {
  const results = {
    whatsapp: calculateChannel(shared, channels.whatsapp),
    sms: calculateChannel(shared, channels.sms),
    email: calculateChannel(shared, channels.email),
  }
  return {
    results,
    bestByRoi: best(results, (r) => r.roiPercent),
    bestByNetProfit: best(results, (r) => r.netProfit),
  }
}

/**
 * The conversion rate (in percent) at which a channel just covers its cost,
 * with everything else as typed. Below it the channel loses money. Null when
 * it cannot be worked out: nobody responds, an order earns nothing, or there
 * is no cost to recover.
 */
export function breakEvenConversion(sharedIn: SharedInputs, channelIn: ChannelInputs): number | null {
  const s = sanitizeShared(sharedIn)
  const r = calculateChannel(sharedIn, { ...channelIn, conversionPercent: 0 })
  const profitPerOrder = s.orderValue * (s.marginPercent / 100)
  if (r.cost <= 0 || r.responses <= 0 || profitPerOrder <= 0) return null
  return (r.cost / (r.responses * profitPerOrder)) * 100
}

export interface Setup {
  id: string
  title: string
  shared: SharedInputs
  channels: Record<ChannelId, ChannelInputs>
}

// Illustrative starting points only. They are not benchmarks. Real prices,
// response rates and conversion rates differ by country, list and offer, and
// the tool says so next to the inputs.
const WHATSAPP = { chargedOn: 'delivered', fixedMonthlyCost: 0 } as const
const SMS = { chargedOn: 'sent', fixedMonthlyCost: 0 } as const
const EMAIL = { chargedOn: 'sent', fixedMonthlyCost: 0 } as const

export const EXAMPLE_SETUPS: readonly Setup[] = [
  {
    id: 'store',
    title: 'Online store',
    shared: { contacts: 5000, campaignsPerMonth: 4, orderValue: 1500, marginPercent: 30 },
    channels: {
      whatsapp: { ...WHATSAPP, costPerMessage: 0.86, deliveryPercent: 95, responsePercent: 8, conversionPercent: 5 },
      sms: { ...SMS, costPerMessage: 0.2, deliveryPercent: 90, responsePercent: 2, conversionPercent: 3 },
      email: { ...EMAIL, costPerMessage: 0.05, deliveryPercent: 97, responsePercent: 2, conversionPercent: 2 },
    },
  },
  {
    id: 'restaurant',
    title: 'Restaurant or cafe',
    shared: { contacts: 3000, campaignsPerMonth: 6, orderValue: 600, marginPercent: 35 },
    channels: {
      whatsapp: { ...WHATSAPP, costPerMessage: 0.86, deliveryPercent: 95, responsePercent: 10, conversionPercent: 6 },
      sms: { ...SMS, costPerMessage: 0.2, deliveryPercent: 90, responsePercent: 3, conversionPercent: 3 },
      email: { ...EMAIL, costPerMessage: 0.05, deliveryPercent: 97, responsePercent: 2, conversionPercent: 1.5 },
    },
  },
  {
    id: 'coaching',
    title: 'Coaching or courses',
    shared: { contacts: 2000, campaignsPerMonth: 3, orderValue: 12000, marginPercent: 60 },
    channels: {
      whatsapp: { ...WHATSAPP, costPerMessage: 0.86, deliveryPercent: 95, responsePercent: 6, conversionPercent: 2 },
      sms: { ...SMS, costPerMessage: 0.2, deliveryPercent: 90, responsePercent: 1.5, conversionPercent: 1 },
      email: { ...EMAIL, costPerMessage: 0.05, deliveryPercent: 97, responsePercent: 2.5, conversionPercent: 0.8 },
    },
  },
  {
    id: 'clinic',
    title: 'Clinic or salon',
    shared: { contacts: 1500, campaignsPerMonth: 2, orderValue: 800, marginPercent: 50 },
    channels: {
      whatsapp: { ...WHATSAPP, costPerMessage: 0.86, deliveryPercent: 95, responsePercent: 12, conversionPercent: 8 },
      sms: { ...SMS, costPerMessage: 0.2, deliveryPercent: 90, responsePercent: 4, conversionPercent: 5 },
      email: { ...EMAIL, costPerMessage: 0.05, deliveryPercent: 97, responsePercent: 2, conversionPercent: 2 },
    },
  },
]

export const DEFAULT_SETUP: Setup = EXAMPLE_SETUPS[0]
