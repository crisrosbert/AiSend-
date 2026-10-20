import Link from 'next/link'
import { CoverArt } from '@/components/art/cover-art'
import { BLOG_TOOLS } from '@/lib/blog/tool-catalog'
import type { CategoryCount } from '@/lib/blog/categories'
import { formatPostDate, type PostMeta } from '@/lib/blog/posts'
import { BlogLeadForm } from '@/components/blog/blog-lead-form'

/** Right-hand column of a post: categories, latest posts, call-back form, free tools and a sign-up card. */
export function PostSidebar({
  categories,
  currentCategory,
  slug,
  popular,
}: {
  categories: readonly CategoryCount[]
  currentCategory: string
  slug: string
  popular: readonly PostMeta[]
}) {
  return (
    <aside className="post-side" aria-label="More from AiSend">
      <details className="side-card side-card--cats" open>
        <summary className="side-card__title">Categories</summary>
        <ul className="side-cats">
          {categories.map((c) => (
            <li key={c.slug}>
              <Link href={`/blog/category/${c.slug}`} aria-current={c.name === currentCategory ? 'true' : undefined}>
                <span className="side-cats__box" aria-hidden="true" />
                <span className="side-cats__name">{c.name}</span>
                <span className="side-cats__n">{c.count}</span>
              </Link>
            </li>
          ))}
        </ul>
      </details>

      {popular.length ? (
        <section className="side-pop">
          <h2 className="side-pop__title">Popular Posts</h2>
          {popular.map((p) => (
            <Link key={p.slug} className="side-pop__card" href={`/blog/${p.slug}`}>
              <div className="side-pop__img">
                {p.cover ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.coverMobile ?? p.cover} alt={p.coverAlt ?? ''} loading="lazy" decoding="async" />
                ) : (
                  <CoverArt seed={p.slug} hint={p.tags.join(' ')} />
                )}
              </div>
              <span className="side-pop__name">{p.title}</span>
              {p.hideDate ? null : <span className="side-pop__date">{formatPostDate(p.date)}</span>}
            </Link>
          ))}
        </section>
      ) : null}

      <div className="side-card side-card--call">
        <BlogLeadForm
          slug={`${slug}-sidebar`}
          title="Request a Call back Now"
          text="Leave your WhatsApp number and our team will message you."
        />
      </div>

      <section className="side-card side-card--tools">
        <h2 className="side-card__title">Free tools</h2>
        <ul className="side-tools">
          {BLOG_TOOLS.map((t) => (
            <li key={t.slug}>
              <Link href={`/tools/${t.slug}`}>
                <span className="side-tools__name">{t.name}</span>
                <span className={`side-tools__tag${t.ai ? ' is-ai' : ''}`}>{t.ai ? 'AI · Free' : 'Free'}</span>
              </Link>
            </li>
          ))}
        </ul>
        <Link className="side-card__more" href="/tools">See all free tools →</Link>
      </section>

      <section className="side-green">
        <h2>Start Messaging Customers the Right Way</h2>
        <p>Official WhatsApp Business API campaigns, chatbots and a shared inbox in one dashboard.</p>
        <Link href="/signup">Start Free →</Link>
      </section>
    </aside>
  )
}
