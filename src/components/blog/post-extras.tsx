import Link from 'next/link'
import { BLOG_TOOLS } from '@/lib/blog/tool-catalog'

/** A wide banner that asks for the click. Used inside and at the end of a post. */
export function PostCtaBanner({
  title,
  text,
  button,
  href = '/signup',
  variant = 'dark',
}: {
  title: string
  text: string
  button: string
  href?: string
  variant?: 'dark' | 'light'
}) {
  return (
    <aside className={`cta-banner cta-banner--${variant}`}>
      <div className="cta-banner__copy">
        <p className="cta-banner__title">{title}</p>
        <p className="cta-banner__text">{text}</p>
      </div>
      <Link className="cta-banner__btn" href={href}>
        {button}
      </Link>
    </aside>
  )
}

/** Free tools that fit the post. Slugs come from the post's `tools:` list. */
export function RelatedTools({ slugs }: { slugs: readonly string[] }) {
  const tools = slugs.flatMap((s) => BLOG_TOOLS.filter((t) => t.slug === s))
  if (!tools.length) return null
  return (
    <section className="post-tools" aria-labelledby="post-tools-title">
      <div className="blog__wrap">
        <h2 id="post-tools-title">Free tools for this</h2>
        <div className="post-tools__grid">
          {tools.map((t) => (
            <Link key={t.slug} className="post-tool" href={`/tools/${t.slug}`}>
              <span className="post-tool__tag">Free tool</span>
              <span className="post-tool__name">{t.name}</span>
              <span className="post-tool__text">{t.text}</span>
              <span className="post-tool__go">Open the tool →</span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}
