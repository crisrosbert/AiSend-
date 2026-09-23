// src/lib/tools/catalog-extractor.test.ts

import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  parseShopifyFeed,
  extractJsonLdProducts,
  extractOgProduct,
  extractCatalog,
} from './catalog-extractor'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('parseShopifyFeed', () => {
  it('reads name, price, image and sku off the first variant/image', () => {
    const body = JSON.stringify({
      products: [
        {
          title: 'Everyday Tote',
          handle: 'everyday-tote',
          variants: [{ price: '1299.00', sku: 'TOTE-001' }],
          images: [{ src: 'https://cdn.example.com/tote.jpg' }],
        },
      ],
    })

    expect(parseShopifyFeed(body, 'https://shop.example.com')).toEqual([
      {
        name: 'Everyday Tote',
        price: '1299.00',
        currency: null,
        image: 'https://cdn.example.com/tote.jpg',
        url: 'https://shop.example.com/products/everyday-tote',
        sku: 'TOTE-001',
      },
    ])
  })

  it('skips a product with no title rather than inventing one', () => {
    const body = JSON.stringify({ products: [{ handle: 'x', variants: [], images: [] }] })
    expect(parseShopifyFeed(body, 'https://shop.example.com')).toEqual([])
  })

  it('returns [] for malformed JSON instead of throwing', () => {
    expect(parseShopifyFeed('not json', 'https://shop.example.com')).toEqual([])
  })

  it('returns [] when the body has no products array', () => {
    expect(parseShopifyFeed(JSON.stringify({ ok: true }), 'https://shop.example.com')).toEqual([])
  })
})

describe('extractJsonLdProducts', () => {
  it('reads a single Product node', () => {
    const html = `<script type="application/ld+json">${JSON.stringify({
      '@type': 'Product',
      name: 'Wireless Mouse',
      sku: 'WM-42',
      image: 'https://cdn.example.com/mouse.jpg',
      offers: { price: '19.99', priceCurrency: 'USD' },
    })}</script>`

    expect(extractJsonLdProducts(html, 'https://shop.example.com/products/mouse')).toEqual([
      {
        name: 'Wireless Mouse',
        price: '19.99',
        currency: 'USD',
        image: 'https://cdn.example.com/mouse.jpg',
        url: 'https://shop.example.com/products/mouse',
        sku: 'WM-42',
      },
    ])
  })

  it('reads several Product nodes off an @graph — a collection page listing many products', () => {
    const html = `<script type="application/ld+json">${JSON.stringify({
      '@graph': [
        { '@type': 'Product', name: 'Item A', offers: { price: '10' } },
        { '@type': 'Product', name: 'Item B', offers: { price: '20' } },
        { '@type': 'WebPage', name: 'not a product' },
      ],
    })}</script>`

    const found = extractJsonLdProducts(html, 'https://shop.example.com/collections/all')
    expect(found.map((p) => p.name)).toEqual(['Item A', 'Item B'])
  })

  it('takes the first offer when offers is an array', () => {
    const html = `<script type="application/ld+json">${JSON.stringify({
      '@type': 'Product',
      name: 'Multi-offer Item',
      offers: [{ price: '5' }, { price: '50' }],
    })}</script>`

    expect(extractJsonLdProducts(html, 'https://x.com')[0].price).toBe('5')
  })

  it('ignores a malformed JSON-LD block instead of throwing', () => {
    const html = '<script type="application/ld+json">{not valid</script>'
    expect(extractJsonLdProducts(html, 'https://x.com')).toEqual([])
  })

  it('returns [] when nothing on the page is a Product', () => {
    const html = `<script type="application/ld+json">${JSON.stringify({
      '@type': 'Organization',
      name: 'Some Business',
    })}</script>`
    expect(extractJsonLdProducts(html, 'https://x.com')).toEqual([])
  })
})

describe('extractOgProduct', () => {
  it('reads og:title, og:image and product:price tags', () => {
    const html = `
      <meta property="og:type" content="product" />
      <meta property="og:title" content="Canvas Backpack" />
      <meta property="og:image" content="https://cdn.example.com/backpack.jpg" />
      <meta property="product:price:amount" content="49.00" />
      <meta property="product:price:currency" content="EUR" />
    `
    expect(extractOgProduct(html, 'https://x.com/p/backpack')).toEqual({
      name: 'Canvas Backpack',
      price: '49.00',
      currency: 'EUR',
      image: 'https://cdn.example.com/backpack.jpg',
      url: 'https://x.com/p/backpack',
      sku: null,
    })
  })

  it('reads tags written content-first, property-second', () => {
    // HTML attribute order carries no meaning — a page can write either.
    const html = `
      <meta content="product" property="og:type" />
      <meta content="Reversed Order Item" property="og:title" />
    `
    expect(extractOgProduct(html, 'https://x.com')?.name).toBe('Reversed Order Item')
  })

  it('returns null when og:type is not "product"', () => {
    const html = '<meta property="og:type" content="website" /><meta property="og:title" content="Home" />'
    expect(extractOgProduct(html, 'https://x.com')).toBeNull()
  })

  it('returns null when og:type is product but there is no og:title', () => {
    const html = '<meta property="og:type" content="product" />'
    expect(extractOgProduct(html, 'https://x.com')).toBeNull()
  })
})

describe('extractCatalog', () => {
  it('rejects a private/internal address before making any request', async () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)

    const result = await extractCatalog('http://169.254.169.254/')

    expect(result.error).toMatch(/public internet/)
    expect(result.products).toEqual([])
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('prefers the Shopify feed when it returns products', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string | URL) => {
        const url = String(input)
        if (url.includes('/products.json')) {
          return {
            ok: true,
            url,
            text: async () =>
              JSON.stringify({
                products: [{ title: 'Feed Item', handle: 'feed-item', variants: [{ price: '9' }], images: [] }],
              }),
          }
        }
        throw new Error(`unexpected fetch: ${url}`)
      }),
    )

    const result = await extractCatalog('https://shop.example.com')
    expect(result.source).toBe('shopify')
    expect(result.products).toHaveLength(1)
    expect(result.products[0].name).toBe('Feed Item')
  })

  it('falls back to crawling product-shaped links when there is no Shopify feed', async () => {
    const seedHtml = `
      <a href="/products/mug">Mug</a>
      <a href="/about">About</a>
    `
    const productHtml = `<script type="application/ld+json">${JSON.stringify({
      '@type': 'Product',
      name: 'Ceramic Mug',
      offers: { price: '15' },
    })}</script>`

    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string | URL) => {
        const url = String(input)
        if (url.includes('/products.json')) return { ok: false }
        if (url === 'https://shop.example.com/') {
          return { ok: true, url, text: async () => seedHtml }
        }
        if (url === 'https://shop.example.com/products/mug') {
          return { ok: true, url, text: async () => productHtml }
        }
        return { ok: false }
      }),
    )

    const result = await extractCatalog('https://shop.example.com')
    expect(result.source).toBe('jsonld')
    expect(result.products.map((p) => p.name)).toEqual(['Ceramic Mug'])
  })

  it('reports a clear reason when nothing is found', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string | URL) => {
        const url = String(input)
        if (url.includes('/products.json')) return { ok: false }
        if (url === 'https://blog.example.com/') {
          return { ok: true, url, text: async () => '<p>Just a blog, no products here.</p>' }
        }
        return { ok: false }
      }),
    )

    const result = await extractCatalog('https://blog.example.com')
    expect(result.products).toEqual([])
    expect(result.error).toMatch(/couldn't find a product catalogue/)
  })
})
