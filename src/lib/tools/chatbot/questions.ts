// "Questions your visitors will likely ask": worked out from what the site
// actually contains (page paths, titles, menu labels, contact facts), no AI
// call. Each question is something the scanned site can answer, so the chips
// the visitor clicks do not lead to "I'm not sure".

import type { SiteFacts } from '@/lib/agent/rag/site-facts'

export interface LikelyQuestion {
  q: string
  tag: string
}

const MENU_SKIP = /^(home|login|log in|sign ?in|sign ?up|register|cart|search|blog|menu|account|my account|checkout|privacy|terms)/i

export function likelyQuestions(
  pages: ReadonlyArray<{ url: string; title: string }>,
  facts: SiteFacts | undefined,
  name: string,
  max = 8,
): LikelyQuestion[] {
  const text = pages.map((p) => `${p.url} ${p.title}`).join(' ').toLowerCase()
  const menu = (facts?.menu ?? []).join(' | ').toLowerCase()
  const all = `${text} ${menu}`
  const has = (re: RegExp) => re.test(all)
  const out: LikelyQuestion[] = []
  const add = (q: string, tag: string) => {
    if (!out.some((o) => o.q === q)) out.push({ q, tag })
  }

  if (has(/pric|plan|cost|fee|rate/)) add('What are your prices?', 'Pricing')
  if (has(/shop|product|store|catalog|collection/)) add('Which products do you sell?', 'Products')
  else if (has(/service|solution|treatment|course|package/)) add('What services do you offer?', 'Services')
  if (has(/offer|sale|discount|coupon|deal/)) add('Do you have any offers right now?', 'Offers')
  if (has(/deliver|ship/)) add('How long does delivery take?', 'Delivery')
  if (has(/return|refund|exchange|cancel/)) add('What is your return and refund policy?', 'Returns')
  if (has(/book|appointment|demo|consult|reserv/)) add('Can I book an appointment?', 'Booking')
  if (facts?.hours || has(/hours|timing/)) add('What are your opening hours?', 'Hours')
  if (facts?.address || has(/location|find us|visit|store locator/)) add('Where are you located?', 'Location')
  if (facts?.phones.length || facts?.emails.length || facts?.whatsapp.length || has(/contact/)) add('How can I contact you?', 'Contact')
  if (has(/about|story|team/)) add(`Tell me about ${name}`, 'About')
  if (has(/faq|help|support/)) add('How do I get support?', 'Support')

  // A few of the site's own menu labels become "tell me about X" questions.
  for (const label of facts?.menu ?? []) {
    if (out.length >= max) break
    const l = label.trim()
    if (l.length < 3 || l.length > 28 || MENU_SKIP.test(l)) continue
    if (out.some((o) => o.q.toLowerCase().includes(l.toLowerCase()))) continue
    add(`Tell me about ${l}`, 'From your menu')
  }
  if (out.length < 4) add(`What does ${name} offer?`, 'About')
  return out.slice(0, max)
}
