import type { MetadataRoute } from 'next'
import { LANDING_PAGES } from '@/content/landing'
import { loadPosts } from '@/lib/blog/posts'
import { SITE_URL as BASE_URL } from '@/lib/seo/site'

// Only the pages robots.ts actually allows — listing a disallowed page
// here would just confuse crawlers with contradictory signals.
//
// Landing pages and blog posts are added automatically from their content
// files, with their real "last updated" dates (not "now"), so crawlers
// can tell what actually changed.
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date()
  const posts = loadPosts()

  return [
    { url: `${BASE_URL}/`, lastModified: now, changeFrequency: 'weekly', priority: 1 },
    ...LANDING_PAGES.map((p) => ({
      url: `${BASE_URL}/${p.slug}`,
      lastModified: new Date(`${p.updated}T00:00:00Z`),
      changeFrequency: 'monthly' as const,
      priority: 0.9,
    })),
    ...(posts.length
      ? [
          {
            url: `${BASE_URL}/blog`,
            lastModified: new Date(`${posts[0].updated ?? posts[0].date}T00:00:00Z`),
            changeFrequency: 'weekly' as const,
            priority: 0.7,
          },
        ]
      : []),
    ...posts.map((p) => ({
      url: `${BASE_URL}/blog/${p.slug}`,
      lastModified: new Date(`${p.updated ?? p.date}T00:00:00Z`),
      changeFrequency: 'monthly' as const,
      priority: 0.6,
    })),
    { url: `${BASE_URL}/tools`, lastModified: now, changeFrequency: 'weekly', priority: 0.9 },
    { url: `${BASE_URL}/tools/whatsapp-link-generator`, lastModified: now, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${BASE_URL}/tools/whatsapp-bulk-sender`, lastModified: now, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${BASE_URL}/tools/whatsapp-qr-code`, lastModified: now, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${BASE_URL}/tools/whatsapp-text-formatter`, lastModified: now, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${BASE_URL}/tools/whatsapp-catalog-builder`, lastModified: now, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${BASE_URL}/privacy`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${BASE_URL}/terms`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${BASE_URL}/contact`, lastModified: now, changeFrequency: 'yearly', priority: 0.4 },
  ]
}
