// src/lib/billing/razorpay-checkout.ts
//
// The browser half of Razorpay: loading Checkout and typing the global
// it installs.
//
// Kept out of the components because two of them need it — the credits
// modal and the plan picker — and a second copy of a script loader is a
// second chance to load the script twice, which registers two handlers
// for one payment.

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void }
  }
}

const CHECKOUT_SRC = 'https://checkout.razorpay.com/v1/checkout.js'

/**
 * Ensure Checkout is on the page.
 *
 * Resolves false rather than throwing when the script cannot load —
 * ad blockers and corporate proxies block payment domains often enough
 * that it is an expected outcome, not an exception. The caller shows a
 * message; nothing is left half-open.
 *
 * Re-entrant: a second call while the first is still loading waits on
 * the same promise instead of appending another tag.
 */
let pending: Promise<boolean> | null = null

export function loadRazorpayScript(): Promise<boolean> {
  if (typeof window === 'undefined') return Promise.resolve(false)
  if (window.Razorpay) return Promise.resolve(true)
  if (pending) return pending

  pending = new Promise<boolean>((resolve) => {
    // Reuse a tag already in the document — React strict mode mounts
    // twice in development, and without this every mount adds another.
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${CHECKOUT_SRC}"]`,
    )
    if (existing) {
      existing.addEventListener('load', () => resolve(true))
      existing.addEventListener('error', () => resolve(false))
      return
    }

    const script = document.createElement('script')
    script.src = CHECKOUT_SRC
    script.async = true
    script.onload = () => resolve(true)
    script.onerror = () => resolve(false)
    document.body.appendChild(script)
  }).finally(() => {
    // Cleared so a failed load can be retried — otherwise one blocked
    // request would make the button dead for the rest of the session.
    pending = null
  })

  return pending
}
