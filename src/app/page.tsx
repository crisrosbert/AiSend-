import type { Metadata } from 'next'
import LandingPage from './(marketing)/landing-page'

// The root layout defaults every page to noindex — correct for the
// authed app, wrong here. Without this override the actual public
// homepage was invisible to Google, which defeats the entire point of
// a marketing page (and of anything else meant to rank, like /tools).
export const metadata: Metadata = {
  robots: { index: true, follow: true },
}

/**
 * Public homepage. Previously redirected straight to /dashboard, which
 * meant the app had NO public marketing page — a blocker for Razorpay
 * and Meta Tech Provider review (both require a real, accessible
 * landing page describing the product). Now serves the marketing page;
 * the in-app CTAs route to /login and /signup.
 */
export default function RootPage() {
  return <LandingPage />
}
