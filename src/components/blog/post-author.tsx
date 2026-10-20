import Link from 'next/link'

/**
 * Who wrote the post. For the team byline this says plainly what the team
 * does and how the facts were checked; it does not invent a person or
 * credentials. A named author gets the same box with just their name.
 */
export function PostAuthor({ name, checked }: { name: string; checked?: string }) {
  const isTeam = /^team\b/i.test(name)
  const initials = name.replace(/^team\s+/i, '').slice(0, 2).toUpperCase()
  return (
    <section className="post-author" aria-label="About the author">
      <div className="post-author__badge" aria-hidden="true">{initials}</div>
      <div className="post-author__text">
        <p className="post-author__label">Written by</p>
        <p className="post-author__name">{name}</p>
        <p className="post-author__bio">
          {isTeam
            ? 'We build AiSend, a platform for WhatsApp marketing on the official WhatsApp Business API: campaigns, chatbots and a shared inbox. We write about what we see businesses get right and wrong on WhatsApp, and we keep these guides up to date.'
            : 'Writes about WhatsApp marketing and customer messaging for AiSend.'}
        </p>
        {checked ? <p className="post-author__checked">{checked}</p> : null}
        <p className="post-author__links">
          <Link href="/blog">More articles</Link> · <Link href="/tools">Free tools</Link>
        </p>
      </div>
    </section>
  )
}
