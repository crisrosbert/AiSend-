import LandingPage from './(marketing)/landing-page'

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
