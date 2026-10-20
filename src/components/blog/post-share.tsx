'use client'

import { useState } from 'react'

/** Share this post: WhatsApp, LinkedIn, X, Facebook and copy-link. The address is read in the browser, so it is always the page you are on. */
export function PostShare({ title }: { title: string }) {
  const [copied, setCopied] = useState(false)

  function open(build: (url: string, text: string) => string) {
    const url = window.location.href.split('#')[0]
    window.open(build(encodeURIComponent(url), encodeURIComponent(title)), '_blank', 'noopener,noreferrer,width=640,height=560')
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(window.location.href.split('#')[0])
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      window.prompt('Copy this link', window.location.href.split('#')[0])
    }
  }

  return (
    <div className="post-share" role="group" aria-label="Share this article">
      <span className="post-share__label">Share</span>
      <button type="button" aria-label="Share on WhatsApp" onClick={() => open((u, t) => `https://wa.me/?text=${t}%20${u}`)}>
        WhatsApp
      </button>
      <button type="button" aria-label="Share on LinkedIn" onClick={() => open((u) => `https://www.linkedin.com/sharing/share-offsite/?url=${u}`)}>
        LinkedIn
      </button>
      <button type="button" aria-label="Share on X" onClick={() => open((u, t) => `https://twitter.com/intent/tweet?url=${u}&text=${t}`)}>
        X
      </button>
      <button type="button" aria-label="Share on Facebook" onClick={() => open((u) => `https://www.facebook.com/sharer/sharer.php?u=${u}`)}>
        Facebook
      </button>
      <button type="button" className="post-share__copy" onClick={copy}>
        {copied ? 'Link copied' : 'Copy link'}
      </button>
    </div>
  )
}
