// src/lib/seo/home-json-ld.test.ts
import { describe, it, expect } from 'vitest'
import { SITE_URL } from './site'
import { serializeJsonLd } from './json-ld'
import { homeJsonLd, HOME_DESCRIPTION, HOME_TITLE } from './home-json-ld'

describe('homeJsonLd', () => {
  const graph = homeJsonLd()['@graph']
  const byType = (t: string) => graph.find((n) => n['@type'] === t)

  it('has an Organization, a WebSite and a SoftwareApplication', () => {
    expect(graph.map((n) => n['@type'])).toEqual(['Organization', 'WebSite', 'SoftwareApplication'])
  })

  it('uses the repo site URL, never a made-up domain', () => {
    expect(byType('Organization')?.url).toBe(`${SITE_URL}/`)
    expect(byType('WebSite')?.url).toBe(`${SITE_URL}/`)
    expect(JSON.stringify(graph)).not.toMatch(/https?:\/\/(?!app\.performancemktg\.net)/)
  })

  it('lists only the free plan price', () => {
    expect(byType('SoftwareApplication')?.offers).toMatchObject({ price: '0', priceCurrency: 'INR' })
  })

  it('carries no ratings, reviews or awards', () => {
    const text = JSON.stringify(graph)
    expect(text).not.toMatch(/aggregateRating|review|award|sameAs|telephone/i)
  })

  it('survives serializeJsonLd and cannot close the script tag', () => {
    const out = serializeJsonLd(homeJsonLd())
    expect(out).not.toContain('<')
    expect(out).not.toContain('>')
    expect(JSON.parse(out)['@graph']).toHaveLength(3)
  })

  it('keeps the title and description a sensible length for search results', () => {
    expect(HOME_TITLE.length <= 65).toBe(true)
    expect(HOME_DESCRIPTION.length <= 160).toBe(true)
    expect(HOME_DESCRIPTION.length > 80).toBe(true)
  })
})
