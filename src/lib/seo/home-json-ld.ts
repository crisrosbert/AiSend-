// src/lib/seo/home-json-ld.ts
//
// Search-engine data for the HOME page only: who we are (Organization),
// what the site is (WebSite) and what the product is (SoftwareApplication).
//
// Everything here is a fact the product can stand behind today. There is
// deliberately NO rating, review count, award, price other than the free
// plan, social profile or phone number: none of those are verified, and
// wrong structured data can get a site penalised by Google.
//
// It reuses the repo's own helpers: SITE_URL / absoluteUrl for the address
// and serializeJsonLd (in ./json-ld) to turn the data into a string that
// cannot break out of its <script> tag.

import { SITE_URL, absoluteUrl } from './site'

/** The brand as customers see it. (SITE_NAME in ./site is a different, older name.) */
export const HOME_BRAND = 'AiSend'

export const HOME_TITLE = 'AiSend — WhatsApp CRM, broadcasts and AI agents'

export const HOME_DESCRIPTION =
  'WhatsApp CRM for Indian businesses: shared inbox, template broadcasts, AI agents and chatbot flows on the official WhatsApp Business API. Start free, no card.'

const ORG_ID = `${SITE_URL}/#organization`
const SITE_ID = `${SITE_URL}/#website`
const APP_ID = `${SITE_URL}/#software`

export function homeJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': ORG_ID,
        name: HOME_BRAND,
        url: absoluteUrl('/'),
      },
      {
        '@type': 'WebSite',
        '@id': SITE_ID,
        name: HOME_BRAND,
        url: absoluteUrl('/'),
        inLanguage: 'en',
        publisher: { '@id': ORG_ID },
      },
      {
        '@type': 'SoftwareApplication',
        '@id': APP_ID,
        name: HOME_BRAND,
        url: absoluteUrl('/'),
        description: HOME_DESCRIPTION,
        applicationCategory: 'BusinessApplication',
        operatingSystem: 'Web',
        publisher: { '@id': ORG_ID },
        // Only the free plan is a certain price (₹0). Paid plan prices are
        // not final, so they are not listed here.
        offers: {
          '@type': 'Offer',
          name: 'Free Forever plan',
          price: '0',
          priceCurrency: 'INR',
        },
      },
    ],
  }
}
