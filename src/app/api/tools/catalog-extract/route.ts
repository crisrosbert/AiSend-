// src/app/api/tools/catalog-extract/route.ts
//
// Backend for the free "WhatsApp Catalog Builder" tool page. Unlike the
// other /tools/* pages (link generator, QR code, text formatter), this
// one can't run entirely in the browser: reading an arbitrary store's
// HTML from client-side JavaScript hits CORS on nearly every site, and
// the "never fetch a private address" check has to happen somewhere
// that isn't the visitor's own browser to mean anything.
//
// No login wall in front of this — it's a free, no-signup tool like the
// others — so the crawl budget in catalog-extractor.ts is deliberately
// small (8 pages, 18s) rather than the agent-training crawler's larger
// one. It's still an unauthenticated endpoint that makes outbound
// requests on the caller's behalf; extractCatalog's own URL validation
// is the load-bearing defence, not anything in this file.

import { NextResponse } from 'next/server'
import { extractCatalog } from '@/lib/tools/catalog-extractor'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}))
  const url: string | undefined = body?.url

  if (!url || typeof url !== 'string') {
    return NextResponse.json({ error: 'A URL is required.' }, { status: 400 })
  }

  const result = await extractCatalog(url)

  if (result.error && result.products.length === 0) {
    return NextResponse.json({ error: result.error }, { status: 422 })
  }

  return NextResponse.json(result)
}
