import Link from 'next/link'
import { formatPostDate, type PostMeta } from '@/lib/blog/posts'

export function PostCard({ post }: { post: PostMeta }) {
  return (
    <Link className="blog-card" href={`/blog/${post.slug}`}>
      <div className="blog-card__cover">
        {post.cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={post.cover} alt={post.coverAlt ?? ''} loading="lazy" decoding="async" />
        ) : null}
      </div>
      <div className="blog-card__body">
        <span className="blog-card__cat">{post.category}</span>
        <h3 className="blog-card__title">{post.title}</h3>
        <p className="blog-card__desc">{post.description}</p>
        <span className="blog-card__meta">
          {formatPostDate(post.date)} · {post.readingMinutes} min read
        </span>
      </div>
    </Link>
  )
}
