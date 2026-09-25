'use client'

/**
 * File: src/components/media/product-thumbnail.tsx
 * Purpose: Clickable product thumbnail that opens a full-screen swipeable
 * gallery when the product has one or more images. Shows a "+N" badge
 * when multiple images are available (WhatsApp media-album pattern).
 */

import { useState } from 'react'
import Image from 'next/image'
import { Package, Images } from 'lucide-react'
import { Lightbox } from './lightbox'

export interface ProductThumbnailProps {
  images: string[]
  alt: string
  children?: React.ReactNode // overlay content, e.g. stock badge
}

export function ProductThumbnail({ images, alt, children }: ProductThumbnailProps) {
  const [open, setOpen] = useState(false)
  const [index, setIndex] = useState(0)
  const primaryImage = images[0]

  if (!primaryImage) {
    return (
      <div className="relative aspect-square bg-gray-100 dark:bg-gray-700">
        <div className="flex h-full items-center justify-center">
          <Package className="h-12 w-12 text-gray-300 dark:text-gray-600" />
        </div>
        {children}
      </div>
    )
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setIndex(0)
          setOpen(true)
        }}
        className="group relative aspect-square w-full cursor-zoom-in bg-gray-100 dark:bg-gray-700"
        aria-label={`View ${alt} images`}
      >
        <Image
          src={primaryImage}
          alt={alt}
          fill
          className="object-cover transition-transform group-hover:scale-105"
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
          unoptimized
        />
        {/* Multi-image badge */}
        {images.length > 1 && (
          <div className="absolute bottom-2 left-2 inline-flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-xs font-medium text-white backdrop-blur-sm">
            <Images className="h-3 w-3" />
            {images.length}
          </div>
        )}
        {children}
      </button>

      {open && (
        <Lightbox
          images={images}
          alt={alt}
          index={index}
          onClose={() => setOpen(false)}
          onIndexChange={setIndex}
        />
      )}
    </>
  )
}
