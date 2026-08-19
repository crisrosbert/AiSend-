// src/lib/agent/rag/parse-facts.test.ts
//
// A model told "output JSON and nothing else" will still wrap it in a
// fence, or open with "Here is the JSON:". Every one of these cases has
// been seen in the wild, and each one would otherwise throw inside a
// route that has already done its expensive work.

import { describe, it, expect } from 'vitest'
import { parseFacts } from '@/app/api/agent/train-from-url/route'

describe('parseFacts', () => {
  it('reads a clean object', () => {
    const facts = parseFacts(`{
      "business_name": "Kalosa Clinic",
      "what_they_do": "Skin and hair treatments in Indore.",
      "services": ["Hydrafacial", "Laser hair removal"],
      "phone": "+91 98765 43210",
      "whatsapp": null,
      "email": "hi@kalosa.in",
      "address": "12 MG Road, Indore",
      "hours": "Mon-Sat 10am-7pm"
    }`)

    expect(facts.business_name).toBe('Kalosa Clinic')
    expect(facts.services).toEqual(['Hydrafacial', 'Laser hair removal'])
    expect(facts.hours).toBe('Mon-Sat 10am-7pm')
    expect(facts.whatsapp).toBeNull()
  })

  it('unwraps a fenced code block', () => {
    const facts = parseFacts('```json\n{"business_name":"Acme","services":[]}\n```')
    expect(facts.business_name).toBe('Acme')
  })

  it('unwraps a fence with no language tag', () => {
    expect(parseFacts('```\n{"business_name":"Acme"}\n```').business_name).toBe('Acme')
  })

  it('skips a sentence of preamble', () => {
    const facts = parseFacts('Here is the extracted data:\n{"business_name":"Acme"}\nHope that helps!')
    expect(facts.business_name).toBe('Acme')
  })

  it('treats the words models use for "absent" as null', () => {
    // Asked for null, models write the string. Storing "N/A" as a phone
    // number would put it in front of a customer.
    const facts = parseFacts(`{
      "phone": "null", "email": "N/A", "address": "not stated",
      "hours": "Unknown", "whatsapp": "none", "business_name": "  "
    }`)
    expect(facts.phone).toBeNull()
    expect(facts.email).toBeNull()
    expect(facts.address).toBeNull()
    expect(facts.hours).toBeNull()
    expect(facts.whatsapp).toBeNull()
    expect(facts.business_name).toBeNull()
  })

  it('returns empty facts rather than throwing on unparseable output', () => {
    for (const raw of ['', 'I could not find any information.', '{ broken', 'null', '[]']) {
      expect(() => parseFacts(raw), raw).not.toThrow()
      expect(parseFacts(raw).business_name, raw).toBeNull()
      expect(parseFacts(raw).services, raw).toEqual([])
    }
  })

  it('coerces a non-array services value to an empty list', () => {
    expect(parseFacts('{"services":"Hydrafacial, Laser"}').services).toEqual([])
  })

  it('drops non-string entries from services', () => {
    expect(parseFacts('{"services":["Facial", null, 42, "Laser"]}').services).toEqual([
      'Facial', 'Laser',
    ])
  })

  it('caps services so one page cannot fill the agent config', () => {
    const many = JSON.stringify({ services: Array.from({ length: 40 }, (_, i) => `S${i}`) })
    expect(parseFacts(many).services).toHaveLength(8)
  })

  it('truncates long fields', () => {
    const facts = parseFacts(JSON.stringify({ address: 'x'.repeat(1000) }))
    expect(facts.address!.length).toBe(300)
  })

  it('ignores keys it was not asked for', () => {
    const facts = parseFacts('{"business_name":"Acme","secret_key":"leak","__proto__":{"x":1}}')
    expect(facts.business_name).toBe('Acme')
    expect(Object.keys(facts).sort()).toEqual([
      'address', 'business_name', 'email', 'hours',
      'phone', 'services', 'what_they_do', 'whatsapp',
    ])
  })
})
