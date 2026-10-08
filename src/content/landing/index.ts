// src/content/landing/index.ts
//
// Every landing page on the site. The sitemap and the SEO checks read this
// list, so a page that is not listed here is invisible to both.
//
// Adding a page (3 steps):
//   1. content file   src/content/landing/<slug>.ts      (copy an existing one)
//   2. route file     src/app/<slug>/page.tsx            (5 lines, copy an existing one)
//   3. list it below.
// registry.test.ts fails the build if any of the three is missing or if the
// page breaks an SEO rule (title/description length, duplicate slug, a
// button that points nowhere, …).

import type { LandingContent } from '@/lib/landing/types'
import whatsappBusinessApi from './whatsapp-business-api'

export const LANDING_PAGES: readonly LandingContent[] = [whatsappBusinessApi]
