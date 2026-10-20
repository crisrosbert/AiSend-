import Link from 'next/link'
import { BLOG_TOOLS } from '@/lib/blog/tool-catalog'
import type { CategoryCount } from '@/lib/blog/categories'
import { BlogLeadForm } from '@/components/blog/blog-lead-form'

/** Right-hand column of a post: categories, every free tool (AI ones labelled), and a call-back form. */
export function PostSidebar({
  categories,
  currentCategory,
  slug,
}: {
  categories: readonly CategoryCount[]
  currentCategory: string
  slug: string
}) {
  return (
    <aside className="post-side" aria-label="More from AiSend">
      <section className="side-card">
        <h2 className="side-card__title">Categories</h2>
        <ul className="side-cats">
          {categories.map((c) => (
            <li key={c.slug}>
              <Link href={`/blog/category/${c.slug}`} aria-current={c.name === currentCategory ? 'true' : undefined}>
                <span>{c.name}</span>
                <span className="side-cats__n">{c.count}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="side-card">
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

      <div className="side-card side-card--form">
        <BlogLeadForm
          slug={`${slug}-sidebar`}
          title="Request a call back"
          text="Leave your WhatsApp number and our team will message you."
        />
      </div>
    </aside>
  )
}
