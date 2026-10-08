import Link from 'next/link'
import { notFound } from 'next/navigation'
import { SiteHeader } from '@/components/layout/site-header'
import { SiteFooter } from '@/components/layout/site-footer'
import { PostBody } from '@/components/blog/post-body'
import { PostCard } from '@/components/blog/post-card'
import { formatPostDate, loadPosts, relatedPosts } from '@/lib/blog/posts'
import { articleJsonLd, breadcrumbJsonLd, serializeJsonLd } from '@/lib/seo/json-ld'
import { buildMetadata } from '@/lib/seo/metadata'
import '../blog.css'

// Only posts that exist at build time are valid pages; anything else is a 404.
export const dynamicParams = false

export function generateStaticParams() {
  return loadPosts().map((p) => ({ slug: p.slug }))
}

type Props = { params: Promise<{ slug: string }> }

function find(slug: string) {
  const all = loadPosts()
  const post = all.find((p) => p.slug === slug)
  return { all, post }
}

export async function generateMetadata({ params }: Props) {
  const { slug } = await params
  const { post } = find(slug)
  if (!post) return {}
  return buildMetadata({
    title: post.title,
    description: post.description,
    path: `/blog/${post.slug}`,
    ogImage: post.cover,
    type: 'article',
    published: post.date,
    modified: post.updated ?? post.date,
    keywords: post.tags,
  })
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params
  const { all, post } = find(slug)
  if (!post) notFound()

  const path = `/blog/${post.slug}`
  const related = relatedPosts(post, all)
  const showToc = post.toc.length >= 3

  const structuredData = [
    articleJsonLd({
      title: post.title,
      description: post.description,
      path,
      published: post.date,
      modified: post.updated,
      author: post.author,
      image: post.cover,
    }),
    breadcrumbJsonLd([
      { name: 'Home', path: '/' },
      { name: 'Blog', path: '/blog' },
      { name: post.title, path },
    ]),
  ]

  return (
    <>
      <div className="lp blog" style={{ fontFamily: "'Inter', sans-serif" }}>
        <SiteHeader />
        <main>
          <header className="post-head">
            <div className="post-head__inner">
              <nav className="post-crumbs" aria-label="Breadcrumb">
                <Link href="/">Home</Link> / <Link href="/blog">Blog</Link>
              </nav>
              <h1>{post.title}</h1>
              <p className="post-head__desc">{post.description}</p>
              <div className="post-meta">
                <span>{post.author}</span>
                <span>{formatPostDate(post.date)}</span>
                {post.updated && post.updated !== post.date ? (
                  <span>Updated {formatPostDate(post.updated)}</span>
                ) : null}
                <span>{post.readingMinutes} min read</span>
              </div>
            </div>
          </header>

          {post.cover ? (
            <div className="post-cover">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={post.cover} alt={post.coverAlt ?? ''} />
            </div>
          ) : null}

          <div className={`post-layout${showToc ? ' post-layout--toc' : ''}`}>
            {showToc ? (
              <aside className="post-toc" aria-label="Table of contents">
                <p className="post-toc__title">On this page</p>
                <ul>
                  {post.toc.map((t) => (
                    <li key={t.id} className={t.level > 2 ? 'is-sub' : undefined}>
                      <a href={`#${t.id}`}>{t.text}</a>
                    </li>
                  ))}
                </ul>
              </aside>
            ) : null}

            <article className="post-article">
              <PostBody blocks={post.blocks} />
              {post.tags.length ? (
                <div className="post-tags">
                  {post.tags.map((t) => (
                    <span key={t}>{t}</span>
                  ))}
                </div>
              ) : null}
              <div className="post-cta">
                <p>Run WhatsApp marketing, chatbots and a shared inbox from one dashboard.</p>
                <a href="/signup">Start free</a>
              </div>
            </article>
          </div>

          {related.length ? (
            <section className="post-related">
              <div className="blog__wrap">
                <h2>Keep reading</h2>
                <div className="blog-grid">
                  {related.map((p) => (
                    <PostCard key={p.slug} post={p} />
                  ))}
                </div>
              </div>
            </section>
          ) : null}
        </main>
        {structuredData.map((data, i) => (
          <script
            key={i}
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }}
          />
        ))}
      </div>
      <SiteFooter />
    </>
  )
}
