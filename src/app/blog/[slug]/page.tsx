import Link from 'next/link'
import { notFound } from 'next/navigation'
import { SiteHeader } from '@/components/layout/site-header'
import { SiteFooter } from '@/components/layout/site-footer'
import { CoverArt } from '@/components/art/cover-art'
import { PostBody } from '@/components/blog/post-body'
import { PostCard } from '@/components/blog/post-card'
import { PostAccordion } from '@/components/blog/post-accordion'
import { BlogLeadForm } from '@/components/blog/blog-lead-form'
import { PostCtaBanner, RelatedTools } from '@/components/blog/post-extras'
import { PostShare } from '@/components/blog/post-share'
import { PostAuthor } from '@/components/blog/post-author'
import { PostSidebar } from '@/components/blog/post-sidebar'
import { LeadPopup } from '@/components/blog/lead-popup'
import { categoriesWithCounts, categorySlug } from '@/lib/blog/categories'
import { BLOG_TOOLS } from '@/lib/blog/tool-catalog'
import { extractFaq, groupSections } from '@/lib/blog/post-extras'
import { formatPostDate, loadPosts, relatedPosts } from '@/lib/blog/posts'
import { articleJsonLd, breadcrumbJsonLd, faqJsonLd, serializeJsonLd } from '@/lib/seo/json-ld'
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
  const faq = extractFaq(post.blocks)
  const categories = categoriesWithCounts(all)
  const catPath = `/blog/category/${categorySlug(post.category)}`

  // Banners that sit inside a long post, one third and two thirds of the way down.
  const bannerTools = (post.tools.length ? post.tools : ['whatsapp-template-generator', 'ai-chatbot-widget'])
    .flatMap((s) => BLOG_TOOLS.filter((t) => t.slug === s))
    .slice(0, 2)
  const { intro, sections } = groupSections(post.blocks)
  const cutAt = sections.length >= 4 ? [Math.floor(sections.length / 3), Math.floor((sections.length * 2) / 3)] : []
  const chunks: Array<{ blocks: typeof post.blocks; banner?: number }> = []
  if (!post.accordion) {
    let start = 0
    chunks.push({ blocks: intro })
    cutAt.forEach((cut, i) => {
      chunks.push({ blocks: sections.slice(start, cut).flatMap((sec) => [sec.heading, ...sec.body]), banner: i })
      start = cut
    })
    chunks.push({ blocks: sections.slice(start).flatMap((sec) => [sec.heading, ...sec.body]) })
  }

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
      { name: post.category, path: catPath },
      { name: post.title, path },
    ]),
    ...(faq.length ? [faqJsonLd(faq)] : []),
  ]

  return (
    <>
      <div className="lp blog" style={{ fontFamily: "'Inter', sans-serif" }}>
        <SiteHeader />
        <main>
          <header className="post-head">
            <div className="post-head__inner">
              <nav className="post-crumbs" aria-label="Breadcrumb">
                <Link href="/">Home</Link> / <Link href="/blog">Blog</Link> /{' '}
                <Link href={catPath}>{post.category}</Link>
              </nav>
              <Link className="post-head__cat" href={catPath}>{post.category}</Link>
              <h1>{post.title}</h1>
              <p className="post-head__desc">{post.description}</p>
              <div className="post-meta">
                <span>By {post.author}</span>
                {post.hideDate ? null : <span>Published: {formatPostDate(post.date)}</span>}
                {!post.hideDate && post.updated && post.updated !== post.date ? (
                  <span>Updated on: {formatPostDate(post.updated)}</span>
                ) : null}
                <span>{post.readingMinutes} min read</span>
              </div>
              <PostShare title={post.title} />
            </div>
          </header>

          {post.cover ? (
            <div className="post-cover">
              <picture>
                {post.coverMobile ? <source media="(max-width: 720px)" srcSet={post.coverMobile} /> : null}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={post.cover} alt={post.coverAlt ?? ''} />
              </picture>
            </div>
          ) : (
            <div className="post-cover post-cover--art">
              <CoverArt seed={post.slug} hint={post.tags.join(' ')} />
            </div>
          )}

          <div className={`post-layout post-layout--side${showToc ? ' post-layout--toc' : ''}`}>
            {showToc ? (
              <aside className="post-toc" aria-label="Table of contents">
                <p className="post-toc__title">On this page</p>
                <ul>
                  {post.toc.filter((t) => !post.accordion || t.level === 2).map((t) => (
                    <li key={t.id} className={t.level > 2 ? 'is-sub' : undefined}>
                      <a href={`#${t.id}`}>{t.text}</a>
                    </li>
                  ))}
                </ul>
              </aside>
            ) : null}

            <article className="post-article">
              {post.accordion ? (
                <PostAccordion
                  blocks={post.blocks}
                  inserts={{
                    3: (
                      <PostCtaBanner
                        title="Automate your WhatsApp in minutes"
                        text="Greetings, follow-ups, chatbots and a shared inbox in one dashboard."
                        button="Start free"
                      />
                    ),
                  }}
                />
              ) : (
                chunks.map((c, i) => (
                  <div key={i}>
                    <PostBody blocks={c.blocks} />
                    {c.banner !== undefined && bannerTools[c.banner] ? (
                      <PostCtaBanner
                        variant="blue"
                        tag={bannerTools[c.banner].ai ? 'Free AI tool' : 'Free tool'}
                        title={bannerTools[c.banner].name}
                        text={bannerTools[c.banner].text}
                        button="Try it free"
                        href={`/tools/${bannerTools[c.banner].slug}`}
                      />
                    ) : null}
                  </div>
                ))
              )}
              {post.tags.length ? (
                <div className="post-tags">
                  {post.tags.map((t) => (
                    <span key={t}>{t}</span>
                  ))}
                </div>
              ) : null}
              <PostAuthor name={post.author} checked={post.factCheck} />
              {post.accordion ? (
                <>
                  <PostCtaBanner
                    variant="light"
                    title="Ready to automate your WhatsApp?"
                    text="Create your account free and send your first automated reply today."
                    button="Create free account"
                  />
                  <BlogLeadForm
                    slug={post.slug}
                    title="Want help setting up WhatsApp automation?"
                    text="Leave your WhatsApp number and our team will message you with the next steps."
                  />
                </>
              ) : (
                <div className="post-cta">
                  <p>Run WhatsApp marketing, chatbots and a shared inbox from one dashboard.</p>
                  <a href="/signup">Start free</a>
                </div>
              )}
            </article>
            <PostSidebar categories={categories} currentCategory={post.category} slug={post.slug} />
          </div>

          <RelatedTools slugs={post.tools} />

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
        <LeadPopup slug={post.slug} />
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
