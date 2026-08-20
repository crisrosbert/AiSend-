// src/lib/widget/logo-upload.test.ts
//
// Until now an agent got a logo only if the crawler found one, and it
// frequently cannot: plenty of sites carry no og:image, the crawler
// then falls back to /favicon.ico — 32px, blurry the moment it is
// enlarged into a chat header — and many hosts block hot-linking, so
// the URL loads for us and 403s for the visitor.
//
// All three end identically: a generic speech bubble where the
// business's mark should be, on a widget meant to look like it belongs
// to that business. Skyline Properties shipped exactly that.
//
// So the drawer can upload one. These cover the checks that run before
// anything reaches the bucket — the bucket enforces the same limits,
// but it answers with an opaque storage error, while these can say
// which rule was broken and what to do instead.

import { describe, it, expect } from 'vitest'

/** Mirrors the guards in uploadLogo(). */
const ACCEPTED = /^image\/(png|jpeg|webp|gif|svg\+xml)$/
const MAX_BYTES = 2 * 1024 * 1024

function rejectionFor(file: { type: string; size: number }): string | null {
  if (!ACCEPTED.test(file.type)) return 'type'
  if (file.size > MAX_BYTES) return 'size'
  return null
}

describe('what may be uploaded as a logo', () => {
  it('accepts the formats a logo actually arrives in', () => {
    for (const type of [
      'image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/svg+xml',
    ]) {
      expect(rejectionFor({ type, size: 50_000 }), type).toBeNull()
    }
  })

  it('rejects a PDF or a document', () => {
    // Both are plausible mistakes when someone has a brand pack rather
    // than a loose image file.
    expect(rejectionFor({ type: 'application/pdf', size: 10_000 })).toBe('type')
    expect(rejectionFor({ type: 'text/html', size: 10_000 })).toBe('type')
  })

  it('rejects anything over 2 MB, matching the bucket', () => {
    // The bucket is declared with a 2 MB limit in migration 008. If
    // these ever disagree the merchant gets a raw storage error instead
    // of a sentence telling them the file is too big.
    expect(rejectionFor({ type: 'image/png', size: MAX_BYTES + 1 })).toBe('size')
    expect(rejectionFor({ type: 'image/png', size: MAX_BYTES })).toBeNull()
  })

  it('checks the type before the size', () => {
    // A 5 MB PDF is the wrong TYPE first and foremost. Telling someone
    // to shrink it would send them off to compress a file that was
    // never going to be accepted.
    expect(rejectionFor({ type: 'application/pdf', size: 5_000_000 })).toBe('type')
  })
})

describe('where the file is stored', () => {
  // The avatars bucket's RLS policy requires the FIRST path segment to
  // equal the uploader's auth.uid(). Getting this wrong fails at insert
  // time with a permissions error that says nothing about paths.
  const pathFor = (userId: string, agentId: string, ext: string, now: number) =>
    `${userId}/agent-${agentId}-${now}.${ext}`

  const userId = '2de7c22c-9fb5-4766-8372-4a9639fdeacf'
  const agentId = 'ea3e1375-931d-4778-ac0a-42576795775c'

  it('starts the path with the user id, as the bucket policy demands', () => {
    expect(pathFor(userId, agentId, 'png', 1)).toMatch(new RegExp(`^${userId}/`))
  })

  it('keeps one agent’s logo from overwriting another’s', () => {
    // Same tenant, same instant, different agents: the paths must still
    // differ or uploading to one agent would silently change the other.
    const a = pathFor(userId, 'agent-a', 'png', 1000)
    const b = pathFor(userId, 'agent-b', 'png', 1000)
    expect(a).not.toBe(b)
  })

  it('gives every upload a fresh name', () => {
    // A stable filename would be served from cache long after the
    // change, and the merchant would conclude the upload failed.
    expect(pathFor(userId, agentId, 'png', 1000))
      .not.toBe(pathFor(userId, agentId, 'png', 2000))
  })
})
