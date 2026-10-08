import type { ReactNode } from 'react'
import { VideoSlot } from '@/app/(marketing)/video-slot'
import type { Block, Inline } from '@/lib/blog/markdown'

/**
 * Renders parsed blog blocks as React elements. Nothing here builds HTML
 * strings, so post text can never become markup. External links open in
 * a new tab with rel="noopener noreferrer".
 */

function isExternal(href: string): boolean {
  return /^https?:\/\//i.test(href)
}

export function Inlines({ nodes }: { nodes: readonly Inline[] }): ReactNode {
  return nodes.map((n, i) => {
    switch (n.type) {
      case 'text':
        return n.text
      case 'strong':
        return <strong key={i}><Inlines nodes={n.children} /></strong>
      case 'em':
        return <em key={i}><Inlines nodes={n.children} /></em>
      case 'code':
        return <code key={i}>{n.text}</code>
      case 'link':
        return isExternal(n.href) ? (
          <a key={i} href={n.href} target="_blank" rel="noopener noreferrer">
            <Inlines nodes={n.children} />
          </a>
        ) : (
          <a key={i} href={n.href}>
            <Inlines nodes={n.children} />
          </a>
        )
      default: {
        const unreachable: never = n
        return unreachable
      }
    }
  })
}

export function PostBody({ blocks }: { blocks: readonly Block[] }) {
  return (
    <div className="blog-body">
      {blocks.map((b, i) => {
        switch (b.type) {
          case 'heading': {
            const Tag = `h${b.level}` as 'h2' | 'h3' | 'h4'
            return (
              <Tag key={i} id={b.id}>
                <Inlines nodes={b.children} />
              </Tag>
            )
          }
          case 'paragraph':
            return <p key={i}><Inlines nodes={b.children} /></p>
          case 'list': {
            const Tag = b.ordered ? 'ol' : 'ul'
            return (
              <Tag key={i}>
                {b.items.map((item, j) => (
                  <li key={j}><Inlines nodes={item} /></li>
                ))}
              </Tag>
            )
          }
          case 'quote':
            return <blockquote key={i}><Inlines nodes={b.children} /></blockquote>
          case 'code':
            return <pre key={i}><code>{b.text}</code></pre>
          case 'image':
            return (
              <figure key={i}>
                {/* Plain <img>: post pictures are pasted https URLs from any host. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={b.src} alt={b.alt} loading="lazy" decoding="async" />
                {b.alt ? <figcaption>{b.alt}</figcaption> : null}
              </figure>
            )
          case 'video':
            return <VideoSlot key={i} src={b.src} title="Video" label="Video" />
          case 'table':
            return (
              <div key={i} className="blog-table">
                <table>
                  <thead>
                    <tr>
                      {b.header.map((cell, j) => (
                        <th key={j}><Inlines nodes={cell} /></th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {b.rows.map((row, r) => (
                      <tr key={r}>
                        {row.map((cell, j) => (
                          <td key={j}><Inlines nodes={cell} /></td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          case 'hr':
            return <hr key={i} />
          default: {
            const unreachable: never = b
            return unreachable
          }
        }
      })}
    </div>
  )
}
