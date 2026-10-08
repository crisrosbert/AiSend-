// src/lib/blog/posts.ts
//
// Loads the blog from files. Every post is one Markdown file in
// content/blog/. The filename is the URL:
//
//   content/blog/whatsapp-api-pricing-india.md  →  /blog/whatsapp-api-pricing-india
//
// Files whose name starts with "_" are ignored (that is how the template
// sits in the folder without being published), and a post with
// `draft: true` is skipped until the flag is removed.
//
// ── What happens to a broken post ────────────────────────────────────
// The site must never go down because of one bad file, and a content slip
// must never block an unrelated deploy (a bot hotfix, say). So at build
// time a broken post is SKIPPED and the reason is logged. The tests load
// everything in strict mode instead, where the same mistake is an error —
// that is where it gets caught and fixed before it matters.

import { existsSync, readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { parseVideoUrl } from '@/lib/video-embed'
import { FrontmatterError, parseFrontmatter } from './frontmatter'
import { parseMarkdown, plainText, type Block } from './markdown'

export interface TocItem {
  id: string
  text: string
  level: 2 | 3 | 4
}

export interface PostMeta {
  slug: string
  title: string
  description: string
  /** ISO date, YYYY-MM-DD. */
  date: string
  updated?: string
  author: string
  category: string
  tags: string[]
  /** Cover picture (https URL). */
  cover?: string
  coverAlt?: string
  draft: boolean
  readingMinutes: number
}

export interface Post extends PostMeta {
  blocks: Block[]
  toc: TocItem[]
}

export const BLOG_DIR = path.join(process.cwd(), 'content', 'blog')

const KEBAB = /^[a-z0-9]+(-[a-z0-9]+)*$/
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/
const ALLOWED_KEYS = new Set([
  'title',
  'description',
  'date',
  'updated',
  'author',
  'category',
  'tags',
  'cover',
  'coverAlt',
  'draft',
])

export class PostError extends Error {
  constructor(file: string, message: string) {
    super(`content/blog/${file}: ${message}`)
  }
}

function isRealDate(value: string): boolean {
  if (!ISO_DATE.test(value)) return false
  const d = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value
}

function words(blocks: readonly Block[]): number {
  const text = blocks
    .map((b) => {
      switch (b.type) {
        case 'heading':
          return b.text
        case 'paragraph':
        case 'quote':
          return plainText(b.children)
        case 'list':
          return b.items.map(plainText).join(' ')
        case 'table':
          return [...b.header, ...b.rows.flat()].map(plainText).join(' ')
        default:
          return ''
      }
    })
    .join(' ')
  return text.split(/\s+/).filter(Boolean).length
}

export function readingMinutes(blocks: readonly Block[]): number {
  return Math.max(1, Math.round(words(blocks) / 200))
}

function str(file: string, data: Record<string, string | string[]>, key: string, required: true): string
function str(file: string, data: Record<string, string | string[]>, key: string, required: false): string | undefined
function str(
  file: string,
  data: Record<string, string | string[]>,
  key: string,
  required: boolean,
): string | undefined {
  const v = data[key]
  if (v === undefined || v === '') {
    if (required) throw new PostError(file, `"${key}" is required`)
    return undefined
  }
  if (Array.isArray(v)) throw new PostError(file, `"${key}" must be text, not a list`)
  return v
}

/** Turn one file's text into a validated post. Throws PostError on any problem. */
export function parsePost(file: string, source: string): Post {
  const slug = file.replace(/\.md$/, '')
  if (!KEBAB.test(slug)) {
    throw new PostError(file, 'the filename must be lowercase letters, numbers and hyphens (it becomes the URL)')
  }

  let parsed
  try {
    parsed = parseFrontmatter(source)
  } catch (e) {
    if (e instanceof FrontmatterError) throw new PostError(file, e.message)
    throw e
  }
  const { data, body } = parsed

  for (const key of Object.keys(data)) {
    if (!ALLOWED_KEYS.has(key)) {
      throw new PostError(file, `unknown setting "${key}" (a typo? allowed: ${[...ALLOWED_KEYS].join(', ')})`)
    }
  }

  const title = str(file, data, 'title', true)
  const description = str(file, data, 'description', true)
  const date = str(file, data, 'date', true)
  const author = str(file, data, 'author', true)
  const category = str(file, data, 'category', true)
  const updated = str(file, data, 'updated', false)
  const cover = str(file, data, 'cover', false)
  const coverAlt = str(file, data, 'coverAlt', false)
  const draftRaw = str(file, data, 'draft', false)

  if (!isRealDate(date)) throw new PostError(file, `"date" must be a real date like 2026-10-05, got "${date}"`)
  if (updated !== undefined) {
    if (!isRealDate(updated)) throw new PostError(file, `"updated" must be a real date like 2026-10-05, got "${updated}"`)
    if (updated < date) throw new PostError(file, '"updated" cannot be earlier than "date"')
  }
  if (draftRaw !== undefined && draftRaw !== 'true' && draftRaw !== 'false') {
    throw new PostError(file, `"draft" must be true or false, got "${draftRaw}"`)
  }
  if (cover !== undefined) {
    if (!/^https:\/\/\S+$/.test(cover)) throw new PostError(file, `"cover" must be an https:// link, got "${cover}"`)
    if (!coverAlt) throw new PostError(file, '"coverAlt" is required when there is a cover (describe the picture)')
  }

  const rawTags = data.tags
  if (rawTags !== undefined && !Array.isArray(rawTags)) {
    throw new PostError(file, '"tags" must be a list like [whatsapp, api]')
  }

  const blocks = parseMarkdown(body)
  if (blocks.length === 0) throw new PostError(file, 'the post has no content')

  for (const block of blocks) {
    if (block.type === 'image' && !/^https:\/\/\S+$/.test(block.src)) {
      throw new PostError(file, `picture "${block.src}" must be an https:// link`)
    }
    if (block.type === 'video' && parseVideoUrl(block.src).kind === 'none') {
      throw new PostError(file, `video "${block.src}" is not a YouTube, Vimeo or .mp4 https link`)
    }
  }

  const toc: TocItem[] = blocks.flatMap((b) =>
    b.type === 'heading' && b.level <= 3 ? [{ id: b.id, text: b.text, level: b.level }] : [],
  )

  return {
    slug,
    title,
    description,
    date,
    ...(updated ? { updated } : {}),
    author,
    category,
    tags: rawTags ?? [],
    ...(cover ? { cover, coverAlt } : {}),
    draft: draftRaw === 'true',
    readingMinutes: readingMinutes(blocks),
    blocks,
    toc,
  }
}

export interface LoadOptions {
  dir?: string
  /** Throw on the first broken post instead of skipping it. Tests use this. */
  strict?: boolean
  includeDrafts?: boolean
}

/** All published posts, newest first. */
export function loadPosts(options: LoadOptions = {}): Post[] {
  const dir = options.dir ?? BLOG_DIR
  if (!existsSync(dir)) return []

  const posts: Post[] = []
  for (const file of readdirSync(dir).sort()) {
    if (!file.endsWith('.md') || file.startsWith('_')) continue
    try {
      const post = parsePost(file, readFileSync(path.join(dir, file), 'utf8'))
      if (post.draft && !options.includeDrafts) continue
      posts.push(post)
    } catch (e) {
      if (options.strict || !(e instanceof PostError)) throw e
      console.error(`[blog] skipped a post: ${e.message}`)
    }
  }

  // Newest first; the filename breaks ties so the order never flickers.
  return posts.sort((a, b) => (a.date === b.date ? a.slug.localeCompare(b.slug) : a.date < b.date ? 1 : -1))
}

export function getPost(slug: string, options: LoadOptions = {}): Post | undefined {
  return loadPosts(options).find((p) => p.slug === slug)
}

/** Posts worth reading next: same category first, then shared tags, newest first. */
export function relatedPosts(post: PostMeta, all: readonly Post[], limit = 3): Post[] {
  const score = (p: Post): number =>
    (p.category === post.category ? 2 : 0) + p.tags.filter((t) => post.tags.includes(t)).length
  return all
    .filter((p) => p.slug !== post.slug)
    .map((p) => ({ p, s: score(p) }))
    .filter(({ s }) => s > 0)
    .sort((a, b) => b.s - a.s || (a.p.date < b.p.date ? 1 : -1))
    .slice(0, limit)
    .map(({ p }) => p)
}

export function formatPostDate(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  })
}
