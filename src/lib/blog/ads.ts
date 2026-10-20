// Clickable ads shown in the left column of every blog post.
//
// To use your own artwork: upload the image to  public/blog-ads/  (for example
// public/blog-ads/signup.png), then set `image` to "/blog-ads/signup.png" and
// `href` to the landing page it should open. Portrait images about 420 x 560 px
// look best (the column is 210 px wide and shows them at 2x). An ad without an
// `image` shows a simple built-in card, so the column is never empty.

export interface BlogAd {
  /** Path under /public, e.g. "/blog-ads/signup.png". Leave out to show the built-in card. */
  image?: string
  /** Where a click goes. Internal ("/signup") or full https:// links both work. */
  href: string
  /** Describes the picture, for screen readers. */
  alt: string
  /** Built-in card text, used only when there is no image. */
  title?: string
  text?: string
  button?: string
}

export const BLOG_ADS: readonly BlogAd[] = [
  {
    href: '/signup',
    alt: 'Start free on AiSend',
    title: 'Message customers on the official WhatsApp API',
    text: 'Campaigns, chatbots and a shared inbox in one dashboard.',
    button: 'Start for FREE',
  },
  {
    href: '/tools',
    alt: 'Free WhatsApp tools',
    title: 'Free WhatsApp tools',
    text: 'Templates, QR codes, chat buttons and an AI chatbot, no card needed.',
    button: 'Try the tools',
  },
]

/** Adds tracking to the link: which post the click came from. */
export function adHref(ad: BlogAd, slug: string): string {
  const url = new URL(ad.href, 'https://placeholder.invalid')
  url.searchParams.set('utm_source', 'blog')
  url.searchParams.set('utm_medium', 'ad')
  url.searchParams.set('utm_content', slug)
  return /^https?:\/\//i.test(ad.href) ? url.toString() : `${url.pathname}${url.search}${url.hash}`
}
