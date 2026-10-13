import type { ReactNode } from 'react'
import type { Block } from '@/lib/blog/markdown'
import { groupSections } from '@/lib/blog/post-extras'
import { AccordionControls } from './accordion-controls'
import { Inlines, PostBody } from './post-body'

/**
 * A post as collapsible sections, one per top-level heading. All the text is
 * in the page either way, so search engines read it all; only the first
 * section starts open. `inserts` puts a block (a banner, say) after the
 * section with that number.
 */
export function PostAccordion({
  blocks,
  inserts = {},
}: {
  blocks: readonly Block[]
  inserts?: Record<number, ReactNode>
}) {
  const { intro, sections } = groupSections(blocks)
  return (
    <div id="post-sections">
      {intro.length ? <PostBody blocks={intro} /> : null}
      {sections.length > 2 ? <AccordionControls targetId="post-sections" /> : null}
      {sections.map((s, i) => (
        <div key={s.heading.id}>
          <details className="acc" open={i === 0}>
            <summary className="acc__summary">
              <h2 id={s.heading.id}>
                <Inlines nodes={s.heading.children} />
              </h2>
              <span className="acc__chev" aria-hidden="true" />
            </summary>
            <div className="acc__panel">
              <PostBody blocks={s.body} />
            </div>
          </details>
          {inserts[i] ?? null}
        </div>
      ))}
    </div>
  )
}
