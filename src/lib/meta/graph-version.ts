// src/lib/meta/graph-version.ts
//
// The ONE place the Meta Graph API version is chosen.
//
// Meta retires each Graph version roughly two years after release (v21.0
// stops working on 21 Jan 2027). Every Graph/Facebook URL in the app is built
// from these exports, so moving to a newer version is a single env change:
//
//     NEXT_PUBLIC_META_GRAPH_VERSION=v26.0
//
// then redeploy. It is a NEXT_PUBLIC_ variable on purpose — the Embedded
// Signup button (browser) must initialise the Facebook SDK with the same
// version the server uses.

/** Used when the env var is unset or malformed. Bump this when it nears retirement. */
const FALLBACK_GRAPH_VERSION = 'v23.0'

const VERSION_PATTERN = /^v\d+\.\d+$/

/**
 * Accepts a raw env value and returns a safe version string. Anything that is
 * not exactly `v<major>.<minor>` falls back, so a typo can neither break every
 * Meta call nor smuggle extra path/query text into the request URL.
 */
export function resolveGraphVersion(raw: string | undefined): string {
  const candidate = raw?.trim()
  return candidate && VERSION_PATTERN.test(candidate) ? candidate : FALLBACK_GRAPH_VERSION
}

// Referenced literally so Next.js inlines it into client bundles too.
export const GRAPH_VERSION = resolveGraphVersion(process.env.NEXT_PUBLIC_META_GRAPH_VERSION)

/** e.g. https://graph.facebook.com/v23.0 — append `/<id>/<edge>`. */
export const GRAPH_BASE_URL = `https://graph.facebook.com/${GRAPH_VERSION}`
