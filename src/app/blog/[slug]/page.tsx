import Link from 'next/link'
import { notFound } from 'next/navigation'
import { SiteHeader } from '@/components/layout/site-header'
import { SiteFooter } from '@/components/layout/site-footer'
import { CoverArt } from '@/components/art/cover-art'
import { PostBody } from '@/components/blog/post-body'
import { PostAccordion } from '@/components/blog/post-accordion'
import { BlogLeadForm } from '@/components/blog/blog-lead-form'
import { PostCtaBanner, RelatedTools } from '@/components/blog/post-extras'
import { PostShare } from '@/components/blog/post-share'
import { PostAuthor } from '@/components/blog/post-author'
import { PostSidebar } from '@/components/blog/post-sidebar'
import { LeadPopup } from '@/components/blog/lead-popup'
import { PostAds } from '@/components/blog/post-ad'
import { categoriesWithCounts, categorySlug } from '@/lib/blog/categories'
import { BLOG_TOOLS, toolImage } from '@/lib/blog/tool-catalog'
import { extractFaq, groupSections } from '@/lib/blog/post-extras'
import { formatPostDate, loadPosts, relatedPosts } from '@/lib/blog/posts'
import { articleJsonLd, breadcrumbJsonLd, faqJsonLd, serializeJsonLd } from '@/lib/seo/json-ld'
import { buildMetadata } from '@/lib/seo/metadata'
import '../blog.css'

const FONT_HREF = 'https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,300..800&display=swap'

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
  const popular = all
    .filter((p) => p.slug !== post.slug)
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .slice(0, 3)
  const more = related.length ? related : popular

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
      <link rel="stylesheet" href={FONT_HREF} precedence="default" />
      <div className="lp blog blog--post" style={{ fontFamily: "'DM Sans', 'Inter', sans-serif" }}>
        <SiteHeader />
        <main>
          <header className="post-head">
            <div className="post-wrap">
              <nav className="post-crumbs" aria-label="Breadcrumb">
                <Link href="/">Home</Link> <span>&gt;</span> <Link href="/blog">Blog</Link> <span>&gt;</span>{' '}
                <Link href={catPath}>{post.category}</Link> <span>&gt;</span> <span aria-current="page">{post.title}</span>
              </nav>
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
              <h1>{post.title}</h1>
              <div className="post-meta">
                <Link className="post-head__cat" href={catPath}>{post.category}</Link>
                {post.hideDate ? null : (
                  <span className="post-meta__date">
                    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2" fill="none" stroke="currentColor" strokeWidth="2" /><path d="M3 10h18M8 3v4M16 3v4" stroke="currentColor" strokeWidth="2" fill="none" /></svg>
                    <b>Published:</b> {formatPostDate(post.date)}
                  </span>
                )}
                {!post.hideDate && post.updated && post.updated !== post.date ? (
                  <span><b>Updated on:</b> {formatPostDate(post.updated)}</span>
                ) : null}
                <span>{post.readingMinutes} min read</span>
                <PostShare title={post.title} />
              </div>
            </div>
          </header>

          <div className="post-layout post-layout--side">
            <PostAds slug={post.slug} placement="rail" />
            <article className="post-article">
              {showToc ? (
                <details className="post-toc" open>
                  <summary className="post-toc__title">Table of Contents</summary>
                  <ol>
                    {post.toc.filter((t) => t.level === 2).map((t) => (
                      <li key={t.id}>
                        <a href={`#${t.id}`}>{t.text}</a>
                      </li>
                    ))}
                  </ol>
                </details>
              ) : null}
              <PostAds slug={post.slug} placement="inline" />
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
                        image={toolImage(bannerTools[c.banner].slug)}
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
                  <div className="post-cta__copy">
                    <p className="post-cta__title">Run WhatsApp marketing from one dashboard</p>
                    <p className="post-cta__text">Campaigns, chatbots and a shared inbox on the official WhatsApp Business API.</p>
                  </div>
                  <a className="post-cta__btn" href="/signup">Start free →</a>
                </div>
              )}
            </article>
            <PostSidebar categories={categories} currentCategory={post.category} slug={post.slug} popular={popular} />
          </div>

          <RelatedTools slugs={post.tools} />

          <section className="post-related">
            <div className="post-wrap">
              <h2>Related Blog Posts</h2>
              <div className="rel-row">
                {more.map((p) => (
                  <Link key={p.slug} className="rel-card" href={`/blog/${p.slug}`}>
                    <div className="rel-card__img">
                      {p.cover ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={p.coverMobile ?? p.cover} alt={p.coverAlt ?? ''} loading="lazy" decoding="async" />
                      ) : (
                        <CoverArt seed={p.slug} hint={p.tags.join(' ')} />
                      )}
                    </div>
                    <span className="post-head__cat">{p.category}</span>
                    <h3>{p.title}</h3>
                    <div className="rel-card__foot">
                      <span>{p.hideDate ? `${p.readingMinutes} min read` : formatPostDate(p.date)}</span>
                      <span className="rel-card__go" aria-hidden="true">→</span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </section>
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
