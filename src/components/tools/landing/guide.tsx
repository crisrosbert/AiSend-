// The long-form part of a tool page: a readable guide with a table of
// contents. It exists for the visitor who wants to understand the topic, and
// it is also the page's main body of text for search. All copy comes in as
// data, so each tool writes its own guide and the layout stays the same.

import Link from 'next/link'
import { parseInline } from '@/lib/tools/inline-markup'

export type GuideBlock =
  | { kind: 'p'; text: string }
  | { kind: 'list'; items: readonly string[]; ordered?: boolean }
  | { kind: 'h4'; text: string }
  | { kind: 'table'; head: readonly string[]; rows: readonly (readonly string[])[]; caption?: string }
  | { kind: 'note'; title: string; text: string }

export interface GuideSection {
  /** Used in the address of the section, e.g. "#print-it-right". */
  id: string
  heading: string
  blocks: readonly GuideBlock[]
}

function Inline({ text }: { text: string }) {
  return (
    <>
      {parseInline(text).map((t, i) => {
        if (t.type === 'bold') return <strong key={i}>{t.text}</strong>
        if (t.type === 'code') return <code key={i}>{t.text}</code>
        if (t.type === 'link') {
          return t.href.startsWith('/') ? (
            <Link key={i} href={t.href}>{t.text}</Link>
          ) : (
            <a key={i} href={t.href} target="_blank" rel="noopener noreferrer">{t.text}</a>
          )
        }
        return <span key={i}>{t.text}</span>
      })}
    </>
  )
}

function Block({ block }: { block: GuideBlock }) {
  switch (block.kind) {
    case 'p':
      return <p><Inline text={block.text} /></p>
    case 'h4':
      return <h4>{block.text}</h4>
    case 'list': {
      const items = block.items.map((item) => <li key={item}><Inline text={item} /></li>)
      return block.ordered ? <ol className="tl-steplist">{items}</ol> : <ul>{items}</ul>
    }
    case 'table':
      return (
        <div className="tl-tablewrap" role="region" aria-label={block.caption ?? 'Table'} tabIndex={0}>
          <table>
            {block.caption && <caption>{block.caption}</caption>}
            <thead>
              <tr>{block.head.map((h) => <th key={h} scope="col">{h}</th>)}</tr>
            </thead>
            <tbody>
              {block.rows.map((row) => (
                <tr key={row[0]}>
                  {row.map((cell, i) => (
                    i === 0
                      ? <th key={i} scope="row"><Inline text={cell} /></th>
                      : <td key={i}><Inline text={cell} /></td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )
    case 'note':
      return (
        <aside className="tl-note">
          <b>{block.title}</b>
          <p><Inline text={block.text} /></p>
        </aside>
      )
  }
}

export function Guide({
  heading,
  intro,
  sections,
}: {
  heading: string
  intro: string
  sections: readonly GuideSection[]
}) {
  return (
    <section className="tl-section" aria-labelledby="tl-guide">
      <div className="tl-wrap">
        <div className="tl-head">
          <h2 id="tl-guide" className="tl-h2">{heading}</h2>
          <p className="tl-sub">{intro}</p>
        </div>

        <div className="tl-guide">
          <nav className="tl-toc" aria-label="In this guide">
            <b>In this guide</b>
            <ol>
              {sections.map((s) => (
                <li key={s.id}><a href={`#${s.id}`}>{s.heading}</a></li>
              ))}
            </ol>
          </nav>

          <article className="tl-article">
            {sections.map((s) => (
              <section key={s.id} id={s.id} aria-labelledby={`${s.id}-h`}>
                <h3 id={`${s.id}-h`}>{s.heading}</h3>
                {s.blocks.map((b, i) => <Block key={i} block={b} />)}
              </section>
            ))}
          </article>
        </div>
      </div>
    </section>
  )
}
