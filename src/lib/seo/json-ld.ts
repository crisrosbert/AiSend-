// src/lib/seo/json-ld.ts
//
// Structured data (JSON-LD) for search engines: FAQ rich results, article
// cards, breadcrumb trails.
//
// A JSON-LD <script> is raw HTML, so the serialiser escapes the characters
// that could end the tag early or smuggle markup in. Copy that reads fine
// on a page ("Q&A", "<b>") must never be able to break out of the script.

import { SITE_NAME, SITE_URL, absoluteUrl } from './site'

// Built from char codes on purpose: a literal U+2028 in source is invisible and
// easy for an editor to mangle.
const LINE_SEP = String.fromCharCode(0x2028)
const PARA_SEP = String.fromCharCode(0x2029)

export function serializeJsonLd(data: unknown): string {
  return JSON.stringify(data)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .split(LINE_SEP).join('\\u2028')
    .split(PARA_SEP).join('\\u2029')
}

export function faqJsonLd(items: readonly { q: string; a: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((f) => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  }
}

export function breadcrumbJsonLd(trail: readonly { name: string; path: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: trail.map((step, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: step.name,
      item: absoluteUrl(step.path),
    })),
  }
}

export function webPageJsonLd(page: { name: string; description: string; path: string }) {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: page.name,
    description: page.description,
    url: absoluteUrl(page.path),
    isPartOf: { '@type': 'WebSite', name: SITE_NAME, url: SITE_URL },
  }
}

export function articleJsonLd(article: {
  title: string
  description: string
  path: string
  published: string
  modified?: string
  author: string
  image?: string
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: article.title,
    description: article.description,
    mainEntityOfPage: { '@type': 'WebPage', '@id': absoluteUrl(article.path) },
    datePublished: article.published,
    dateModified: article.modified ?? article.published,
    author: { '@type': 'Person', name: article.author },
    publisher: { '@type': 'Organization', name: SITE_NAME, url: SITE_URL },
    ...(article.image ? { image: [article.image] } : {}),
  }
}
