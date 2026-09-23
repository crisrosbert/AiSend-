'use client'

// src/app/tools/whatsapp-catalog-builder/catalog-extractor-tool.tsx
//
// Unlike the other /tools/* widgets, this one calls a server route
// (/api/tools/catalog-extract) instead of doing everything in the
// browser — reading an arbitrary store's HTML from client JS runs into
// CORS on nearly every real site. The number never leaves the browser
// on the other tools; here it's the store URL that's sent, and nothing
// about the visitor themselves is.

import { useState } from 'react'
import Link from 'next/link'

interface ExtractedProduct {
  name: string
  price: string | null
  currency: string | null
  image: string | null
  url: string
  sku: string | null
}

interface CatalogResponse {
  products: ExtractedProduct[]
  source: 'shopify' | 'jsonld' | 'og' | null
  pagesScanned: number
  truncated: boolean
  error: string | null
}

function formatPrice(product: ExtractedProduct): string | null {
  if (!product.price) return null
  return product.currency ? `${product.currency} ${product.price}` : product.price
}

function asWhatsAppList(products: ExtractedProduct[]): string {
  return products
    .map((p, i) => {
      const price = formatPrice(p)
      return `${i + 1}. ${p.name}${price ? ` — ${price}` : ''}`
    })
    .join('\n')
}

export function CatalogExtractorTool() {
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<CatalogResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  async function handleExtract() {
    const trimmed = url.trim()
    if (!trimmed) return

    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const res = await fetch('/api/tools/catalog-extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: trimmed }),
      })
      const data = await res.json()

      if (!res.ok) {
        setError(data?.error || 'Something went wrong. Try a different page on the same site.')
        return
      }
      setResult(data)
    } catch {
      setError('Could not reach the server. Check your connection and try again.')
    } finally {
      setLoading(false)
    }
  }

  function handleCopy() {
    if (!result?.products.length) return
    navigator.clipboard
      .writeText(asWhatsAppList(result.products))
      .then(() => {
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      })
      .catch(() => {
        /* clipboard blocked — nothing useful to show */
      })
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 sm:p-8">
      <label className="block text-sm font-semibold text-gray-800 mb-2" htmlFor="catalog-url">
        Your store or product page URL
      </label>
      <div className="flex flex-col sm:flex-row gap-3">
        <input
          id="catalog-url"
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleExtract()}
          placeholder="https://your-store.com"
          className="flex-1 border border-gray-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-[#1B6B4A] focus:ring-2 focus:ring-[#1B6B4A]/15 transition-colors"
        />
        <button
          type="button"
          onClick={handleExtract}
          disabled={loading || !url.trim()}
          className="inline-flex items-center justify-center bg-[#1B6B4A] hover:bg-[#14523A] disabled:bg-gray-300 disabled:cursor-not-allowed text-[#fff] font-semibold text-sm px-6 py-3 rounded-lg transition-colors whitespace-nowrap"
        >
          {loading ? 'Reading your site…' : 'Find my products'}
        </button>
      </div>
      <p className="mt-2.5 text-xs text-gray-400">
        Nothing you paste here is saved — the page is read once, in this request, and forgotten.
      </p>

      {error && (
        <div className="mt-6 bg-red-50 border border-red-100 rounded-lg px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {result && result.products.length > 0 && (
        <div className="mt-8">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
            <p className="text-sm text-gray-600">
              Found <strong className="text-gray-900">{result.products.length}</strong> product
              {result.products.length === 1 ? '' : 's'}
              {result.truncated ? ' (there may be more — this is a preview, not the whole catalogue)' : ''}.
            </p>
            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex items-center text-sm font-semibold text-[#1B6B4A] hover:text-[#14523A]"
            >
              {copied ? 'Copied ✓' : 'Copy as a list →'}
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {result.products.map((product, i) => (
              <div key={`${product.url}-${i}`} className="border border-gray-100 rounded-xl overflow-hidden">
                <div className="aspect-square bg-gray-50 flex items-center justify-center">
                  {product.image ? (
                    // Arbitrary host pulled from a merchant's own store — next/image
                    // would need every possible store's domain in remotePatterns.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={product.image}
                      alt={product.name}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none'
                      }}
                    />
                  ) : (
                    <span className="text-xs text-gray-300">No image found</span>
                  )}
                </div>
                <div className="p-3">
                  <p className="text-sm font-semibold text-gray-900 leading-snug line-clamp-2">{product.name}</p>
                  {formatPrice(product) && (
                    <p className="text-sm text-[#1B6B4A] font-bold mt-1">{formatPrice(product)}</p>
                  )}
                </div>
              </div>
            ))}
          </div>

          <p className="mt-6 text-sm text-gray-500 text-center">
            Ready to send this catalogue on WhatsApp instead of copy-pasting it?{' '}
            <Link href="/signup" className="text-[#1B6B4A] font-bold">Try AiSend free →</Link>
          </p>
        </div>
      )}
    </div>
  )
}
