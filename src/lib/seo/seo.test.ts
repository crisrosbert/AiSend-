// src/lib/seo/seo.test.ts

import { describe, it, expect } from 'vitest'
import { absoluteUrl, SITE_URL } from './site'
import {
  serializeJsonLd,
  faqJsonLd,
  breadcrumbJsonLd,
  articleJsonLd,
} from './json-ld'
import { buildMetadata } from './metadata'

describe('absoluteUrl', () => {
  it('turns a site path into a full URL, with or without the leading slash', () => {
    expect(absoluteUrl('/blog/x')).toBe(`${SITE_URL}/blog/x`)
    expect(absoluteUrl('blog/x')).toBe(`${SITE_URL}/blog/x`)
  })

  it('leaves a full URL alone', () => {
    expect(absoluteUrl('https://cdn.example.com/a.png')).toBe('https://cdn.example.com/a.png')
  })
})

const LS = String.fromCharCode(0x2028)
const PS = String.fromCharCode(0x2029)

describe('serializeJsonLd', () => {
  it('cannot be broken out of a <script> tag by the copy inside it', () => {
    const out = serializeJsonLd({ a: '</script><img src=x onerror=alert(1)>' })
    expect(out).not.toContain('<')
    expect(out).not.toContain('>')
    // …and it is still the same data once parsed.
    expect(JSON.parse(out)).toEqual({ a: '</script><img src=x onerror=alert(1)>' })
  })

  it('escapes ampersands and the JS line separators', () => {
    const out = serializeJsonLd({ a: `Q&A ${LS} ${PS}` })
    expect(out).not.toContain('&')
    expect(out).not.toContain(LS)
    expect(out).not.toContain(PS)
    expect(JSON.parse(out).a).toBe(`Q&A ${LS} ${PS}`)
  })
})

describe('structured data builders', () => {
  it('builds a FAQPage with one Question per item', () => {
    const data = faqJsonLd([
      { q: 'One?', a: 'Yes.' },
      { q: 'Two?', a: 'No.' },
    ])
    expect(data['@type']).toBe('FAQPage')
    expect(data.mainEntity).toHaveLength(2)
    expect(data.mainEntity[0]).toMatchObject({
      '@type': 'Question',
      name: 'One?',
      acceptedAnswer: { '@type': 'Answer', text: 'Yes.' },
    })
  })

  it('numbers breadcrumb steps from 1 and uses absolute URLs', () => {
    const data = breadcrumbJsonLd([
      { name: 'Home', path: '/' },
      { name: 'Blog', path: '/blog' },
    ])
    expect(data.itemListElement.map((s) => s.position)).toEqual([1, 2])
    expect(data.itemListElement[1].item).toBe(`${SITE_URL}/blog`)
  })

  it('builds an Article that falls back to the publish date for dateModified', () => {
    const data = articleJsonLd({
      title: 'T',
      description: 'D',
      path: '/blog/t',
      published: '2026-10-01',
      author: 'Priya',
    })
    expect(data.dateModified).toBe('2026-10-01')
    expect(data).not.toHaveProperty('image')
    expect(data.author).toEqual({ '@type': 'Person', name: 'Priya' })
  })

  it('includes the image only when there is one', () => {
    const data = articleJsonLd({
      title: 'T',
      description: 'D',
      path: '/blog/t',
      published: '2026-10-01',
      modified: '2026-10-03',
      author: 'Priya',
      image: 'https://cdn.example.com/c.png',
    })
    expect(data.image).toEqual(['https://cdn.example.com/c.png'])
    expect(data.dateModified).toBe('2026-10-03')
  })
})

describe('buildMetadata', () => {
  const seo = { title: 'T', description: 'D', path: '/p' }

  it('opts the page IN to indexing, since the root layout opts everything out', () => {
    expect(buildMetadata(seo).robots).toEqual({ index: true, follow: true })
  })

  it('can keep a page out of search results', () => {
    expect(buildMetadata({ ...seo, noindex: true }).robots).toEqual({
      index: false,
      follow: false,
    })
  })

  it('sets an absolute canonical URL', () => {
    expect(buildMetadata(seo).alternates?.canonical).toBe(`${SITE_URL}/p`)
  })

  it('uses a plain Twitter card without an image, and a large one with it', () => {
    expect(buildMetadata(seo).twitter).toMatchObject({ card: 'summary' })
    const withImage = buildMetadata({ ...seo, ogImage: 'https://cdn.example.com/o.png' })
    expect(withImage.twitter).toMatchObject({ card: 'summary_large_image' })
    expect(withImage.openGraph).toMatchObject({ images: [{ url: 'https://cdn.example.com/o.png' }] })
  })

  it('carries article dates into OpenGraph', () => {
    const md = buildMetadata({
      ...seo,
      type: 'article',
      published: '2026-10-01',
      modified: '2026-10-02',
    })
    expect(md.openGraph).toMatchObject({
      type: 'article',
      publishedTime: '2026-10-01',
      modifiedTime: '2026-10-02',
    })
  })

  it('only adds keywords when given some', () => {
    expect(buildMetadata(seo)).not.toHaveProperty('keywords')
    expect(buildMetadata({ ...seo, keywords: ['a', 'b'] }).keywords).toEqual(['a', 'b'])
  })
})
