import { describe, expect, it } from 'vitest'
import { categoriesWithCounts, categorySlug } from './categories'

describe('categories', () => {
  it('makes clean slugs', () => {
    expect(categorySlug('WhatsApp Safety')).toBe('whatsapp-safety')
    expect(categorySlug('AI & Automation')).toBe('ai-and-automation')
  })
  it('counts posts per category', () => {
    const posts = [{ category: 'Guides' }, { category: 'Guides' }, { category: 'Pricing' }] as never[]
    expect(categoriesWithCounts(posts)).toEqual([
      { name: 'Guides', slug: 'guides', count: 2 },
      { name: 'Pricing', slug: 'pricing', count: 1 },
    ])
  })
})
