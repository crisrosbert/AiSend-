// src/lib/seo/metadata.ts
//
// One builder for the <head> of every marketing page and blog post, so
// they all get the same complete set: title, description, canonical link,
// robots, OpenGraph and Twitter cards.
//
// The root layout sets `robots: noindex` for the whole app (the dashboard
// must never be indexed), so every public page has to opt back IN. Doing
// that here, once, is what stops a new landing page from quietly shipping
// invisible to Google.

import type { Metadata } from 'next'
import { SITE_NAME, absoluteUrl } from './site'

export interface PageSeo {
  title: string
  description: string
  /** Site path, e.g. "/whatsapp-business-api". Becomes the canonical URL. */
  path: string
  /** Full https URL of the social-share picture. Optional. */
  ogImage?: string
  type?: 'website' | 'article'
  /** ISO dates, articles only. */
  published?: string
  modified?: string
  keywords?: readonly string[]
  /** Keep a page out of search results (e.g. a blog with no posts yet). */
  noindex?: boolean
}

export function buildMetadata(seo: PageSeo): Metadata {
  const url = absoluteUrl(seo.path)
  const images = seo.ogImage ? [{ url: seo.ogImage }] : undefined

  const base: Metadata = {
    title: seo.title,
    description: seo.description,
    ...(seo.keywords?.length ? { keywords: [...seo.keywords] } : {}),
    robots: seo.noindex
      ? { index: false, follow: false }
      : { index: true, follow: true },
    alternates: { canonical: url },
    twitter: {
      card: images ? 'summary_large_image' : 'summary',
      title: seo.title,
      description: seo.description,
      ...(images ? { images: [seo.ogImage as string] } : {}),
    },
  }

  if (seo.type === 'article') {
    return {
      ...base,
      openGraph: {
        type: 'article',
        title: seo.title,
        description: seo.description,
        url,
        siteName: SITE_NAME,
        ...(images ? { images } : {}),
        ...(seo.published ? { publishedTime: seo.published } : {}),
        ...(seo.modified ? { modifiedTime: seo.modified } : {}),
      },
    }
  }

  return {
    ...base,
    openGraph: {
      type: 'website',
      title: seo.title,
      description: seo.description,
      url,
      siteName: SITE_NAME,
      ...(images ? { images } : {}),
    },
  }
}
