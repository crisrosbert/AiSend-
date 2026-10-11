// src/lib/meta/graph-version.test.ts
//
// The Graph API version used to be hardcoded in seven files, so retiring a
// version meant a hunt through the codebase. Now one env var can move the
// whole app — which means a typo in that env var must never turn every Meta
// call into a 404 or, worse, redirect requests to another path.

import { describe, it, expect } from 'vitest'
import { resolveGraphVersion } from './graph-version'

describe('resolveGraphVersion', () => {
  const fallback = resolveGraphVersion(undefined)

  it('falls back to a well-formed version when nothing is configured', () => {
    expect(fallback).toMatch(/^v\d+\.\d+$/)
  })

  it.each([
    ['v26.0', 'v26.0'],
    ['v24.0', 'v24.0'],
    ['  v25.0\n', 'v25.0'], // trailing newline from a pasted dashboard value
  ])('accepts the configured version %j', (raw, want) => {
    expect(resolveGraphVersion(raw)).toBe(want)
  })

  it.each([
    ['empty string', ''],
    ['whitespace', '   '],
    ['no leading v', '24.0'],
    ['alias instead of a number', 'latest'],
    ['missing minor part', 'v24'],
    ['path traversal', 'v24.0/../../oauth'],
    ['query injection', 'v24.0?x=1'],
    ['extra segment', 'v24.0.1'],
  ])('ignores a malformed value (%s) and uses the fallback', (_label, raw) => {
    expect(resolveGraphVersion(raw)).toBe(fallback)
  })
})
