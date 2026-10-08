// src/lib/seo/site.ts
//
// The one place that knows what this site is called and where it lives.
// Marketing pages, the blog and the sitemap all read from here, so a
// domain or brand change is a one-line edit.

export const SITE_URL = 'https://app.performancemktg.net'
export const SITE_NAME = 'PerformanceMktg'

/** Turn a site path ("/blog/x") into a full URL. Full URLs pass through. */
export function absoluteUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path
  return `${SITE_URL}${path.startsWith('/') ? path : `/${path}`}`
}
