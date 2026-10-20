import { BLOG_ADS, adHref, type BlogAd } from '@/lib/blog/ads'

function Ad({ ad, slug }: { ad: BlogAd; slug: string }) {
  const external = /^https?:\/\//i.test(ad.href)
  return (
    <a
      className={`ad${ad.image ? ' ad--img' : ''}`}
      href={adHref(ad, slug)}
      {...(external ? { target: '_blank', rel: 'sponsored noopener' } : {})}
    >
      {ad.image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={ad.image} alt={ad.alt} loading="lazy" decoding="async" />
      ) : (
        <>
          <span className="ad__badge">Free to start</span>
          <span className="ad__title">{ad.title}</span>
          <span className="ad__text">{ad.text}</span>
          <span className="ad__btn">{ad.button ?? 'Learn more'}</span>
        </>
      )}
    </a>
  )
}

/** The clickable ads. `rail` is the left column on wide screens; `inline` sits inside the article on narrower ones. */
export function PostAds({ slug, placement }: { slug: string; placement: 'rail' | 'inline' }) {
  const ads = placement === 'inline' ? BLOG_ADS.slice(0, 1) : BLOG_ADS
  if (!ads.length) return null
  return (
    <aside className={`post-ads post-ads--${placement}`} aria-label="Sponsored">
      {ads.map((ad) => (
        <Ad key={ad.href + (ad.image ?? '')} ad={ad} slug={slug} />
      ))}
    </aside>
  )
}
