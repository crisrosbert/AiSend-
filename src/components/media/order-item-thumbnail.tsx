'use client'

/**
 * File: src/components/media/order-item-thumbnail.tsx
 * Purpose: Small clickable product-image thumbnail for order line items.
 * Click to zoom into a full-screen lightbox view.
 */

import { useState } from 'react'
import { Package } from 'lucide-react'
import { Lightbox } from './lightbox'

export interface OrderItemThumbnailProps {
  imageUrl: string | null
  alt: string
}

export function OrderItemThumbnail({ imageUrl, alt }: OrderItemThumbnailProps) {
  const [open, setOpen] = useState(false)

  if (!imageUrl) {
    return (
      <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-700">
        <Package className="h-5 w-5 text-gray-400" />
      </div>
    )
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="h-10 w-10 flex-shrink-0 cursor-zoom-in overflow-hidden rounded-lg border border-gray-200 dark:border-gray-600"
        aria-label={`View image of ${alt}`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={imageUrl} alt={alt} className="h-full w-full object-cover" />
      </button>

      {open && (
        <Lightbox
          images={[imageUrl]}
          alt={alt}
          index={0}
          onClose={() => setOpen(false)}
          onIndexChange={() => {}}
        />
      )}
    </>
  )
}
