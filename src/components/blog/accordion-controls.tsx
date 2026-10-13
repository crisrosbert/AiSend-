'use client'

import { useEffect } from 'react'

/**
 * Expand / collapse buttons for the post's sections, and opening the right
 * section when the page is reached through a link like /blog/post#section
 * (contents list, search result, shared link).
 */
export function AccordionControls({ targetId }: { targetId: string }) {
  useEffect(() => {
    const openForHash = () => {
      const id = decodeURIComponent(window.location.hash.slice(1))
      if (!id) return
      const el = document.getElementById(id)
      const box = el?.closest('details')
      if (box && !box.open) {
        box.open = true
        el?.scrollIntoView()
      }
    }
    openForHash()
    window.addEventListener('hashchange', openForHash)
    return () => window.removeEventListener('hashchange', openForHash)
  }, [])

  const setAll = (open: boolean) => {
    document.querySelectorAll<HTMLDetailsElement>(`#${targetId} details`).forEach((d) => {
      d.open = open
    })
  }

  return (
    <div className="acc-controls">
      <button type="button" onClick={() => setAll(true)}>Expand all</button>
      <button type="button" onClick={() => setAll(false)}>Collapse all</button>
    </div>
  )
}
