// Category helpers for the blog: a stable URL slug per category, and the list
// with counts that the sidebar and category pages use.

import type { PostMeta } from './posts'

export function categorySlug(name: string): string {
  return name.toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

export interface CategoryCount {
  name: string
  slug: string
  count: number
}

/** Every category in use, most posts first, then A to Z. */
export function categoriesWithCounts(posts: readonly PostMeta[]): CategoryCount[] {
  const map = new Map<string, number>()
  for (const p of posts) map.set(p.category, (map.get(p.category) ?? 0) + 1)
  return [...map.entries()]
    .map(([name, count]) => ({ name, slug: categorySlug(name), count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
}
