/**
 * File: src/app/(dashboard)/ai-agent/products/page.tsx
 * Purpose: View all synced products in the AI Agent catalog
 */

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Package, RefreshCw, CheckCircle2, XCircle } from 'lucide-react'
import { ProductThumbnail } from '@/components/media/product-thumbnail'

export default async function AiAgentProductsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: products, error } = await supabase
    .from('ai_agent_products')
    .select('id, name, description, price, currency, image_url, image_urls, product_url, in_stock, updated_at')
    .eq('user_id', user.id)
    .order('name', { ascending: true })

  if (error) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-4 p-6 text-center">
        <p className="text-gray-600 dark:text-gray-400">Failed to load products: {error.message}</p>
        <Link href="/ai-agent" className="text-sm text-indigo-600 underline dark:text-indigo-400">Back to AI Agent</Link>
      </div>
    )
  }

  const sym = (currency: string) => currency === 'INR' ? '₹' : currency

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link
            href="/ai-agent"
            className="rounded-lg border border-gray-200 bg-white p-2 text-gray-500 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Product Catalog</h1>
            <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
              {products?.length ?? 0} products synced
            </p>
          </div>
        </div>
        <Link
          href="/ai-agent/settings"
          className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
        >
          <RefreshCw className="h-4 w-4" />
          Sync Again
        </Link>
      </div>

      {/* Empty state */}
      {(!products || products.length === 0) && (
        <div className="flex min-h-[40vh] flex-col items-center justify-center gap-4 text-center">
          <div className="rounded-2xl bg-gray-100 p-6 dark:bg-gray-800">
            <Package className="mx-auto h-12 w-12 text-gray-400" />
          </div>
          <div>
            <p className="font-semibold text-gray-900 dark:text-white">No products synced yet</p>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Go to Settings and sync your store to import products.
            </p>
          </div>
          <Link
            href="/ai-agent/settings"
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            Go to Settings
          </Link>
        </div>
      )}

      {/* Product grid */}
      {products && products.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {products.map((product) => (
            <div
              key={product.id}
              className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800"
            >
              {/* Product image — tap to open full-screen gallery */}
              <ProductThumbnail
                images={
                  Array.isArray(product.image_urls) && product.image_urls.length > 0
                    ? product.image_urls
                    : product.image_url
                      ? [product.image_url]
                      : []
                }
                alt={product.name}
              >
                {/* Stock badge */}
                <div className="absolute right-2 top-2">
                  {product.in_stock ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/50 dark:text-green-400">
                      <CheckCircle2 className="h-3 w-3" /> In Stock
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-900/50 dark:text-red-400">
                      <XCircle className="h-3 w-3" /> Out of Stock
                    </span>
                  )}
                </div>
              </ProductThumbnail>

              {/* Product info */}
              <div className="p-3 space-y-1">
                <p className="font-medium text-gray-900 dark:text-white line-clamp-2 text-sm leading-snug">
                  {product.name}
                </p>
                {product.description && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2">
                    {product.description}
                  </p>
                )}
                <div className="flex items-center justify-between pt-1">
                  <p className="text-base font-semibold text-indigo-600 dark:text-indigo-400">
                    {sym(product.currency)}{Number(product.price).toLocaleString('en-IN')}
                  </p>
                  {product.product_url && (
                    <a
                      href={product.product_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-gray-400 underline hover:text-indigo-500 dark:hover:text-indigo-400"
                    >
                      View
                    </a>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
