// src/lib/landing/types.ts
//
// The shape of a landing page. A page is a list of SECTIONS, rendered top
// to bottom in the order given — so a new page is a content file that picks
// the sections it needs, reorders or drops the ones it doesn't. No layout
// code per page.
//
// Every picture and video is a URL. Leave one as '' and the spot shows a
// labelled placeholder (big slots) or a clean icon (small cards) instead of
// a broken image.

import type { IconName } from './icons'

export interface Cta {
  label: string
  /** "/signup", "#faq", or a full https:// link. */
  href: string
}

interface SectionBase {
  /** Anchor id, e.g. "pricing" → /page#pricing. Unique within the page. */
  id?: string
  /** Small uppercase label above the heading. Optional. */
  eyebrow?: string
}

/** Opening block: headline, pitch, buttons, picture. Must be the first section. */
export interface HeroSection extends SectionBase {
  type: 'hero'
  /** The page's <h1>. The last sentence is picked out in brand green. */
  title: string
  lead: string
  subtitle?: string
  body?: string
  primaryCta: Cta
  secondaryCta?: Cta
  image: string
  imageAlt: string
}

/** A strip of customer / partner logos, as one picture. */
export interface LogosSection extends SectionBase {
  type: 'logos'
  title: string
  body?: string
  image: string
  imageAlt: string
}

/** Big numbers, with a picture beside them. */
export interface StatsSection extends SectionBase {
  type: 'stats'
  title: string
  body?: string
  stats: readonly { value: string; label: string }[]
  image: string
  imageAlt: string
}

/** A three-column table (feature · option A · option B), with intro cards. */
export interface ComparisonSection extends SectionBase {
  type: 'comparison'
  title: string
  body?: string
  /** Two short cards above the table. The second is highlighted. */
  points?: readonly { label: string; text: string }[]
  tableTitle?: string
  columns: readonly [string, string, string]
  rows: readonly (readonly [string, string, string])[]
  footnote?: string
  image: string
  imageAlt: string
}

export interface CardItem {
  /** Shown when there is no picture. Optional; `check` cards ignore it. */
  icon?: IconName
  title: string
  body: string
  /** Picture shown above the text. Empty → the icon is shown instead. */
  image?: string
  /** `media` cards only: a YouTube / Vimeo / .mp4 link, shown instead of the picture. */
  video?: string
  /** Where the card's link goes. */
  href?: string
  /** Link label. Falls back to the section's `cta`. */
  cta?: string
}

/**
 * A grid of cards — benefits, features, use cases, case studies.
 *   icon  — icon (or picture) on top, plain text
 *   check — tick badge, for short promises
 *   media — picture / video always shown (placeholder if empty), then link
 */
export interface CardsSection extends SectionBase {
  type: 'cards'
  title: string
  body?: string
  columns: 2 | 3 | 4
  variant: 'icon' | 'check' | 'media'
  items: readonly CardItem[]
  /** Default link label for items that have an `href`. */
  cta?: string
  /** One wide picture for the whole section. */
  image?: string
  imageAlt?: string
  imagePosition?: 'above' | 'below'
}

/** Green band: headline and button beside a video player. */
export interface VideoSection extends SectionBase {
  type: 'video'
  title: string
  body?: string
  /** Button label; scrolls to the video. */
  cta?: string
  video: string
  poster?: string
  videoTitle: string
}

/** Numbered how-it-works steps. */
export interface StepsSection extends SectionBase {
  type: 'steps'
  title: string
  body?: string
  steps: readonly { title: string; body: string }[]
}

export interface TestimonialsSection extends SectionBase {
  type: 'testimonials'
  title: string
  body?: string
  items: readonly {
    headline: string
    quote: string
    name: string
    role: string
    company: string
    /** Headshot URL. Empty → the first letter of the name. */
    avatar?: string
  }[]
}

/** Closing call to action on a green card, with a picture. */
export interface CtaSection extends SectionBase {
  type: 'cta'
  title: string
  body: string
  cta: Cta
  image: string
  imageAlt: string
}

export interface FaqSection extends SectionBase {
  type: 'faq'
  title: string
  items: readonly { q: string; a: string }[]
}

/** A heading and a few paragraphs. For anything the other sections don't cover. */
export interface ProseSection extends SectionBase {
  type: 'prose'
  title: string
  paragraphs: readonly string[]
}

export type Section =
  | HeroSection
  | LogosSection
  | StatsSection
  | ComparisonSection
  | CardsSection
  | VideoSection
  | StepsSection
  | TestimonialsSection
  | CtaSection
  | FaqSection
  | ProseSection

export interface LandingContent {
  /** URL path segment: /<slug>. Lowercase letters, digits and hyphens. */
  slug: string
  seo: {
    /** The <title>. The site name is appended automatically. Keep it under ~60 chars. */
    title: string
    /** The search-result snippet. 70–160 characters. */
    description: string
    /** Social-share picture (https URL). Optional. */
    ogImage?: string
    keywords?: readonly string[]
  }
  /** Last path label in the breadcrumb trail ("Home › WhatsApp Business API"). */
  breadcrumb: string
  /** ISO dates (YYYY-MM-DD). `updated` feeds the sitemap. */
  published: string
  updated: string
  sections: readonly Section[]
}
