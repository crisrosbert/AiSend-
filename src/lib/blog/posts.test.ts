// src/lib/blog/posts.test.ts

import { describe, it, expect, vi, afterEach } from 'vitest'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { parseFrontmatter, FrontmatterError } from './frontmatter'
import { parsePost, loadPosts, relatedPosts, readingMinutes, PostError, BLOG_DIR } from './posts'
import { parseMarkdown } from './markdown'

const GOOD = `---
title: How to Get the WhatsApp Business API
description: A plain guide to getting the WhatsApp Business API approved and live.
date: 2026-10-05
author: Team AiSend
category: Guides
tags: [whatsapp, api]
---

# Intro

Hello world.

## Steps

- one
- two
`

const withFields = (extra: string, base = GOOD) => base.replace('tags: [whatsapp, api]', `tags: [whatsapp, api]\n${extra}`)

describe('parseFrontmatter', () => {
  it('reads text, quoted text and lists', () => {
    const { data, body } = parseFrontmatter('---\na: hello\nb: "x: y"\nc: [p, "q", r]\n---\nbody')
    expect(data).toEqual({ a: 'hello', b: 'x: y', c: ['p', 'q', 'r'] })
    expect(body).toBe('body')
  })

  it('handles Windows line endings and a BOM', () => {
    const { data } = parseFrontmatter('﻿---\r\na: 1\r\n---\r\nx')
    expect(data).toEqual({ a: '1' })
  })

  it('explains what is wrong', () => {
    expect(() => parseFrontmatter('no settings')).toThrow(FrontmatterError)
    expect(() => parseFrontmatter('---\na: 1\n')).toThrow(/not closed/)
    expect(() => parseFrontmatter('---\njunk\n---\n')).toThrow(/line 2/)
    expect(() => parseFrontmatter('---\na: 1\na: 2\n---\n')).toThrow(/twice/)
  })
})

describe('parsePost', () => {
  it('reads a valid post', () => {
    const p = parsePost('whatsapp-api.md', GOOD)
    expect(p).toMatchObject({
      slug: 'whatsapp-api',
      category: 'Guides',
      tags: ['whatsapp', 'api'],
      draft: false,
      readingMinutes: 1,
    })
    expect(p.toc.map((t) => t.text)).toEqual(['Intro', 'Steps'])
  })

  it.each([
    ['a bad filename', () => parsePost('Bad_Name.md', GOOD), /filename/],
    ['a missing title', () => parsePost('a.md', GOOD.replace(/title:.*\n/, '')), /"title" is required/],
    ['an impossible date', () => parsePost('a.md', GOOD.replace('2026-10-05', '2026-02-31')), /real date/],
    ['updated before date', () => parsePost('a.md', withFields('updated: 2026-01-01')), /earlier/],
    ['a typo in a setting', () => parsePost('a.md', withFields('titel: x')), /unknown setting "titel"/],
    ['a cover without alt text', () => parsePost('a.md', withFields('cover: https://x.com/a.png')), /coverAlt/],
    ['an http cover', () => parsePost('a.md', withFields('cover: http://x.com/a.png\ncoverAlt: a')), /https/],
    ['a bad draft flag', () => parsePost('a.md', withFields('draft: maybe')), /true or false/],
    ['tags that are not a list', () => parsePost('a.md', GOOD.replace('[whatsapp, api]', 'whatsapp')), /list/],
    ['an empty body', () => parsePost('a.md', GOOD.split('---\n\n')[0] + '---\n\n'), /no content/],
    ['a bad video', () => parsePost('a.md', GOOD + '\n@[video](https://example.com/page)\n'), /video/],
    ['a non-https picture', () => parsePost('a.md', GOOD + '\n![x](http://a.com/b.png)\n'), /https/],
  ])('rejects %s', (_name, fn, message) => {
    expect(fn).toThrow(PostError)
    expect(fn).toThrow(message)
  })

  it('names the file in the error', () => {
    expect(() => parsePost('oops.md', 'x')).toThrow(/content\/blog\/oops\.md/)
  })
})

describe('readingMinutes', () => {
  it('is at least one minute and scales with length', () => {
    expect(readingMinutes(parseMarkdown('short'))).toBe(1)
    expect(readingMinutes(parseMarkdown(Array(600).fill('word').join(' ')))).toBe(3)
  })
})

describe('loadPosts', () => {
  let dir = ''
  const make = (files: Record<string, string>) => {
    dir = mkdtempSync(path.join(tmpdir(), 'blog-'))
    for (const [name, text] of Object.entries(files)) writeFileSync(path.join(dir, name), text)
    return dir
  }
  afterEach(() => {
    if (dir) rmSync(dir, { recursive: true, force: true })
    vi.restoreAllMocks()
    dir = ''
  })

  it('returns nothing when the folder is missing', () => {
    expect(loadPosts({ dir: path.join(tmpdir(), 'does-not-exist-xyz') })).toEqual([])
  })

  it('sorts newest first, skips _files and drafts', () => {
    make({
      'old.md': GOOD.replace('2026-10-05', '2026-01-01'),
      'new.md': GOOD.replace('2026-10-05', '2026-09-01'),
      '_template.md': 'not a post',
      'wip.md': withFields('draft: true'),
      'notes.txt': 'ignored',
    })
    expect(loadPosts({ dir }).map((p) => p.slug)).toEqual(['new', 'old'])
    expect(loadPosts({ dir, includeDrafts: true }).map((p) => p.slug)).toContain('wip')
  })

  it('skips a broken post in normal mode but fails loudly in strict mode', () => {
    make({ 'good.md': GOOD, 'bad.md': 'oops' })
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(loadPosts({ dir }).map((p) => p.slug)).toEqual(['good'])
    expect(spy).toHaveBeenCalledWith(expect.stringContaining('bad.md'))
    expect(() => loadPosts({ dir, strict: true })).toThrow(/bad\.md/)
  })
})

describe('relatedPosts', () => {
  const mk = (slug: string, category: string, tags: string[], date: string) =>
    ({ ...parsePost(`${slug}.md`, GOOD), slug, category, tags, date })
  const a = mk('a', 'Guides', ['x'], '2026-01-01')
  const b = mk('b', 'Guides', ['y'], '2026-02-01')
  const c = mk('c', 'News', ['x'], '2026-03-01')
  const d = mk('d', 'News', ['z'], '2026-04-01')

  it('ranks same category and shared tags, excludes itself and unrelated posts', () => {
    expect(relatedPosts(a, [a, b, c, d]).map((p) => p.slug)).toEqual(['b', 'c'])
  })

  it('respects the limit', () => {
    expect(relatedPosts(a, [a, b, c, d], 1)).toHaveLength(1)
  })
})

describe('the real blog folder', () => {
  it('has no broken posts and no duplicate titles (strict)', () => {
    const posts = loadPosts({ dir: BLOG_DIR, strict: true, includeDrafts: true })
    const titles = posts.map((p) => p.title.toLowerCase())
    expect(new Set(titles).size).toBe(titles.length)
    for (const p of posts) {
      expect(p.title.length, `${p.slug} title`).toBeLessThanOrEqual(60)
      expect(p.description.length, `${p.slug} description`).toBeGreaterThanOrEqual(70)
      expect(p.description.length, `${p.slug} description`).toBeLessThanOrEqual(160)
    }
  })
})
