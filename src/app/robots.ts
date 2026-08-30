import type { MetadataRoute } from 'next'

// Real robots.txt, generated at request time. A dashboard/(auth) page's
// own noindex metadata keeps it out of the index even without this, but
// a crawler still fetches noindex pages to discover that tag — blocking
// them here as well is what actually keeps them off Meta's/Google's
// crawl budget, and it's the file both Search Console and Meta's App
// Review look for by convention.
const DISALLOW = [
  '/dashboard',
  '/inbox',
  '/contacts',
  '/pipelines',
  '/broadcasts',
  '/automations',
  '/bookings',
  '/leads',
  '/widget',
  '/settings',
  '/agents',
  '/journeys',
  '/analytics',
  '/health',
  '/billing',
  '/media',
  '/candidates',
  '/ads',
  '/recent',
  '/integrations',
  '/login',
  '/signup',
  '/forgot-password',
  '/callback',
  '/data-deletion',
  '/admin',
  '/api',
]

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: DISALLOW,
    },
    sitemap: 'https://app.performancemktg.net/sitemap.xml',
  }
}
