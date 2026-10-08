import { SiteHeader } from '@/components/layout/site-header'
import { SiteFooter } from '@/components/layout/site-footer'
import { PostCard } from '@/components/blog/post-card'
import { loadPosts } from '@/lib/blog/posts'
import { breadcrumbJsonLd, serializeJsonLd } from '@/lib/seo/json-ld'
import { buildMetadata } from '@/lib/seo/metadata'
import './blog.css'

const TITLE = 'WhatsApp Marketing Blog'
const DESCRIPTION =
  'Guides, playbooks and product news on the WhatsApp Business API, broadcasts, chatbots and customer engagement.'

export function generateMetadata() {
  // An empty blog is a thin page: keep it out of search until there is something on it.
  return buildMetadata({
    title: TITLE,
    description: DESCRIPTION,
    path: '/blog',
    noindex: loadPosts().length === 0,
  })
}

export default function BlogIndexPage() {
  const posts = loadPosts()

  return (
    <>
      <div className="lp blog" style={{ fontFamily: "'Inter', sans-serif" }}>
        <SiteHeader />
        <main>
          <section className="blog-hero">
            <div className="blog__wrap">
              <p className="blog-hero__eyebrow">Blog</p>
              <h1>{TITLE}</h1>
              <p>{DESCRIPTION}</p>
            </div>
          </section>
          <div className="blog__wrap">
            {posts.length ? (
              <div className="blog-grid">
                {posts.map((p) => (
                  <PostCard key={p.slug} post={p} />
                ))}
              </div>
            ) : (
              <p className="blog-empty">New articles are on the way.</p>
            )}
          </div>
        </main>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: serializeJsonLd(
              breadcrumbJsonLd([
                { name: 'Home', path: '/' },
                { name: 'Blog', path: '/blog' },
              ]),
            ),
          }}
        />
      </div>
      <SiteFooter />
    </>
  )
}
