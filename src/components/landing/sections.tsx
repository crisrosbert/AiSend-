import Link from 'next/link'
import { ArrowRight, Check, ChevronDown } from 'lucide-react'
import { ImageSlot } from '@/app/(marketing)/image-slot'
import { VideoSlot } from '@/app/(marketing)/video-slot'
import { getIcon } from '@/lib/landing/icons'
import type {
  CardsSection,
  ComparisonSection,
  CtaSection,
  FaqSection,
  HeroSection,
  LogosSection,
  ProseSection,
  StatsSection,
  StepsSection,
  TestimonialsSection,
  VideoSection,
} from '@/lib/landing/types'

/**
 * The building blocks every landing page is made from. A page never lays
 * itself out: it lists sections, and these render them in the app's theme
 * (brand emerald, Inter, rounded cards, soft shadows).
 *
 * Two gotchas from globals.css are handled here so no page has to know:
 *  - headings get dark text from an unlayered rule that beats Tailwind, so
 *    headings on green bands set their colour inline (ON_DARK);
 *  - `text-white` is remapped to dark, so white text is `text-[#fff]`.
 */

export type Tone = 'white' | 'tinted'

const TONE_CLASS: Record<Tone, string> = {
  white: 'bg-white',
  tinted: 'bg-[#f5f7f6]',
}

const ON_DARK = { color: '#ffffff' } as const

/** Only https image links may be used as an avatar background. */
function safeBackground(url: string | undefined): string | undefined {
  return url && /^https:\/\//i.test(url) ? `url(${JSON.stringify(url)})` : undefined
}

function Container({ children }: { children: React.ReactNode }) {
  return <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">{children}</div>
}

function SectionHead({
  title,
  body,
  eyebrow,
  align = 'center',
}: {
  title: string
  body?: string
  eyebrow?: string
  align?: 'center' | 'left'
}) {
  return (
    <div className={align === 'center' ? 'max-w-3xl mx-auto text-center' : 'max-w-2xl'}>
      {eyebrow ? (
        <p className="mb-3 text-xs sm:text-sm font-bold uppercase tracking-[0.14em] text-[#1B6B4A]">
          {eyebrow}
        </p>
      ) : null}
      <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight leading-tight">{title}</h2>
      {body ? (
        <p className="mt-4 text-base sm:text-lg text-gray-600 leading-relaxed">{body}</p>
      ) : null}
    </div>
  )
}

/* ── Hero ─────────────────────────────────────────────────────────── */

export function Hero({ section }: { section: HeroSection }) {
  // The last sentence of the headline is picked out in brand green; the
  // words themselves are untouched.
  const sentences = section.title.split('. ')
  const head = sentences.length > 1 ? `${sentences.slice(0, -1).join('. ')}.` : section.title
  const accent = sentences.length > 1 ? sentences[sentences.length - 1] : ''

  return (
    <section id={section.id} className="relative overflow-hidden gradient-hero-bg">
      <Container>
        <div className="grid lg:grid-cols-2 gap-10 lg:gap-14 items-center py-14 md:py-20">
          <div>
            {section.eyebrow ? (
              <p className="mb-4 inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-4 py-1.5 text-xs sm:text-sm font-semibold text-emerald-950">
                {section.eyebrow}
              </p>
            ) : null}
            <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight leading-[1.1]">
              {head}
              {accent ? (
                <>
                  {' '}
                  <span className="text-[#1B6B4A]">{accent}</span>
                </>
              ) : null}
            </h1>
            <p className="mt-5 text-lg text-gray-700 leading-relaxed">{section.lead}</p>

            {section.subtitle ? (
              <h2 className="mt-8 text-xl sm:text-2xl font-bold tracking-tight">{section.subtitle}</h2>
            ) : null}
            {section.body ? (
              <p className="mt-2 text-base text-gray-600 leading-relaxed">{section.body}</p>
            ) : null}

            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href={section.primaryCta.href}
                className="inline-flex items-center justify-center gap-2 bg-[#1B6B4A] hover:bg-[#14523A] text-[#fff] font-bold text-base px-7 py-3.5 rounded-xl shadow-lg shadow-emerald-900/10 transition-colors"
              >
                {section.primaryCta.label}
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
              {section.secondaryCta ? (
                <Link
                  href={section.secondaryCta.href}
                  className="inline-flex items-center justify-center bg-white hover:bg-gray-50 text-gray-900 font-bold text-base px-7 py-3.5 rounded-xl border border-gray-300 transition-colors"
                >
                  {section.secondaryCta.label}
                </Link>
              ) : null}
            </div>
          </div>

          <ImageSlot
            src={section.image}
            alt={section.imageAlt}
            label="Hero image"
            dimensions="1200 × 900 · PNG, JPG or WebP"
            variant="plain"
            minHeight={340}
          />
        </div>
      </Container>
    </section>
  )
}

/* ── Logos ────────────────────────────────────────────────────────── */

export function Logos({ section, tone }: { section: LogosSection; tone: Tone }) {
  return (
    <section id={section.id} className={`py-14 md:py-16 scroll-mt-24 ${TONE_CLASS[tone]}`}>
      <Container>
        <SectionHead title={section.title} body={section.body} eyebrow={section.eyebrow} />
        <div className="mt-10 max-w-5xl mx-auto">
          <ImageSlot
            src={section.image}
            alt={section.imageAlt}
            label="Client logos strip"
            dimensions="1400 × 200 · PNG, SVG or WebP"
            variant="plain"
            minHeight={120}
          />
        </div>
      </Container>
    </section>
  )
}

/* ── Stats ────────────────────────────────────────────────────────── */

export function Stats({ section, tone }: { section: StatsSection; tone: Tone }) {
  return (
    <section id={section.id} className={`py-16 md:py-20 scroll-mt-24 ${TONE_CLASS[tone]}`}>
      <Container>
        <div className="grid lg:grid-cols-2 gap-10 lg:gap-14 items-center">
          <div>
            <SectionHead
              title={section.title}
              body={section.body}
              eyebrow={section.eyebrow}
              align="left"
            />
            <dl className="mt-8 grid grid-cols-2 gap-4">
              {section.stats.map((s) => (
                <div
                  key={s.label}
                  className="bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-6"
                >
                  <dt className="sr-only">{s.label}</dt>
                  <dd className="text-3xl sm:text-4xl font-extrabold text-[#1B6B4A] tracking-tight">
                    {s.value}
                  </dd>
                  <dd className="mt-1 text-sm font-semibold text-gray-600" aria-hidden="true">
                    {s.label}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
          <ImageSlot
            src={section.image}
            alt={section.imageAlt}
            label="Statistics image"
            dimensions="1200 × 800 · PNG, JPG or WebP"
            variant="plain"
            minHeight={300}
          />
        </div>
      </Container>
    </section>
  )
}

/* ── Comparison ───────────────────────────────────────────────────── */

export function Comparison({ section, tone }: { section: ComparisonSection; tone: Tone }) {
  return (
    <section id={section.id} className={`py-16 md:py-20 scroll-mt-24 ${TONE_CLASS[tone]}`}>
      <Container>
        <SectionHead title={section.title} body={section.body} eyebrow={section.eyebrow} />

        {section.points?.length ? (
          <div className="mt-10 grid md:grid-cols-2 gap-5 max-w-4xl mx-auto">
            {section.points.map((p, i) => (
              <div
                key={p.label}
                className={
                  i === 1
                    ? 'rounded-2xl border border-emerald-200 bg-emerald-50/60 p-6'
                    : 'rounded-2xl border border-gray-200 bg-white p-6'
                }
              >
                <span
                  className={
                    i === 1
                      ? 'inline-block px-3 py-1 rounded-full text-xs font-bold bg-[#1B6B4A] text-[#fff] mb-3'
                      : 'inline-block px-3 py-1 rounded-full text-xs font-bold bg-gray-100 text-gray-700 mb-3'
                  }
                >
                  {p.label}
                </span>
                <p className="text-gray-700 leading-relaxed">{p.text}</p>
              </div>
            ))}
          </div>
        ) : null}

        {section.tableTitle ? (
          <h3 className="mt-14 text-2xl font-bold tracking-tight text-center">{section.tableTitle}</h3>
        ) : null}

        <div className="mt-6 overflow-x-auto rounded-2xl border border-gray-200 shadow-sm bg-white">
          <table className="w-full min-w-[680px] text-left text-sm sm:text-base">
            <caption className="sr-only">{section.tableTitle ?? section.title}</caption>
            <thead>
              <tr className="bg-[#1B6B4A] text-[#fff]">
                {section.columns.map((c) => (
                  <th key={c} scope="col" className="px-5 py-4 font-bold">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {section.rows.map((row, i) => (
                <tr key={row[0]} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/70'}>
                  <th scope="row" className="px-5 py-4 font-bold text-gray-900 align-top">
                    {row[0]}
                  </th>
                  <td className="px-5 py-4 text-gray-600 align-top">{row[1]}</td>
                  <td className="px-5 py-4 text-gray-900 font-medium align-top bg-emerald-50/60">
                    {row[2]}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {section.footnote ? (
          <p className="mt-6 max-w-3xl mx-auto text-center text-gray-700 leading-relaxed">
            {section.footnote}
          </p>
        ) : null}

        <div className="mt-10 max-w-5xl mx-auto">
          <ImageSlot
            src={section.image}
            alt={section.imageAlt}
            label="Comparison image"
            dimensions="1400 × 700 · PNG, JPG or WebP"
            variant="plain"
            minHeight={240}
          />
        </div>
      </Container>
    </section>
  )
}

/* ── Cards ────────────────────────────────────────────────────────── */

const GRID_COLUMNS: Record<CardsSection['columns'], string> = {
  2: 'sm:grid-cols-2',
  3: 'sm:grid-cols-2 lg:grid-cols-3',
  4: 'sm:grid-cols-2 lg:grid-cols-4',
}

export function Cards({ section, tone }: { section: CardsSection; tone: Tone }) {
  const wideImage = section.image ? (
    <div className={section.imagePosition === 'above' ? 'mt-10 max-w-5xl mx-auto' : 'mt-12 max-w-5xl mx-auto'}>
      <ImageSlot
        src={section.image}
        alt={section.imageAlt ?? section.title}
        label={`${section.title} image`}
        dimensions="1400 × 700 · PNG, JPG or WebP"
        variant="plain"
        minHeight={240}
      />
    </div>
  ) : null

  return (
    <section id={section.id} className={`py-16 md:py-20 scroll-mt-24 ${TONE_CLASS[tone]}`}>
      <Container>
        <SectionHead title={section.title} body={section.body} eyebrow={section.eyebrow} />
        {section.imagePosition === 'above' ? wideImage : null}

        <div
          className={`${section.imagePosition === 'above' ? 'mt-10' : 'mt-12'} grid ${GRID_COLUMNS[section.columns]} gap-6`}
        >
          {section.items.map((item) => {
            const Icon = getIcon(item.icon ?? 'sparkles')
            const linkLabel = item.cta ?? section.cta
            const link =
              item.href && linkLabel ? (
                <Link
                  href={item.href}
                  className="mt-5 inline-flex items-center gap-1.5 text-sm font-bold text-[#1B6B4A] hover:text-[#14523A]"
                >
                  {linkLabel}
                  {section.variant === 'icon' ? (
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  ) : null}
                </Link>
              ) : null

            if (section.variant === 'check') {
              return (
                <div
                  key={item.title}
                  className="rounded-2xl border border-emerald-100 bg-emerald-50/50 p-7"
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#1B6B4A] text-[#fff]">
                    <Check className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <h3 className="mt-4 text-lg font-bold leading-snug">{item.title}</h3>
                  <p className="mt-2 text-gray-600 leading-relaxed">{item.body}</p>
                  {link}
                </div>
              )
            }

            if (section.variant === 'media') {
              return (
                <article
                  key={item.title}
                  className="flex flex-col bg-white rounded-2xl border border-gray-200 shadow-sm hover:shadow-md hover:border-emerald-200 transition-all overflow-hidden"
                >
                  {item.video ? (
                    <VideoSlot src={item.video} title={item.title} label={item.title} />
                  ) : (
                    <ImageSlot
                      src={item.image}
                      alt={item.title}
                      label={item.title}
                      dimensions="1000 × 600 · PNG, JPG or WebP"
                      variant="flush"
                      minHeight={190}
                    />
                  )}
                  <div className="flex flex-1 flex-col p-7">
                    <h3 className="text-xl font-bold leading-snug">{item.title}</h3>
                    <p className="mt-2 flex-1 text-gray-600 leading-relaxed">{item.body}</p>
                    {link}
                  </div>
                </article>
              )
            }

            // variant === 'icon'
            return (
              <article
                key={item.title}
                className="flex flex-col bg-white rounded-2xl border border-gray-200 shadow-sm hover:shadow-md hover:border-emerald-200 transition-all overflow-hidden"
              >
                {item.image ? (
                  <ImageSlot
                    src={item.image}
                    alt={item.title}
                    label={item.title}
                    dimensions="1000 × 600 · PNG, JPG or WebP"
                    variant="flush"
                    minHeight={170}
                  />
                ) : (
                  <div className="px-7 pt-7">
                    <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 text-[#1B6B4A]">
                      <Icon className="h-6 w-6" aria-hidden="true" />
                    </span>
                  </div>
                )}
                <div className="flex flex-1 flex-col p-7 pt-5">
                  <h3 className="text-lg font-bold leading-snug">{item.title}</h3>
                  <p className="mt-2 flex-1 text-gray-600 leading-relaxed">{item.body}</p>
                  {link}
                </div>
              </article>
            )
          })}
        </div>

        {section.imagePosition === 'above' ? null : wideImage}
      </Container>
    </section>
  )
}

/* ── Video band ───────────────────────────────────────────────────── */

export function VideoBand({ section }: { section: VideoSection }) {
  const anchor = section.id ? `${section.id}-player` : 'video-player'
  return (
    <section id={section.id} className="py-16 md:py-20 bg-[#1B6B4A] scroll-mt-24">
      <Container>
        <div className="grid lg:grid-cols-2 gap-10 lg:gap-14 items-center">
          <div>
            {section.eyebrow ? (
              <p className="mb-3 text-xs sm:text-sm font-bold uppercase tracking-[0.14em] text-emerald-200">
                {section.eyebrow}
              </p>
            ) : null}
            <h2
              className="text-3xl sm:text-4xl font-extrabold tracking-tight leading-tight"
              style={ON_DARK}
            >
              {section.title}
            </h2>
            {section.body ? (
              <p className="mt-4 text-lg text-emerald-100 leading-relaxed">{section.body}</p>
            ) : null}
            {section.cta ? (
              <a
                href={`#${anchor}`}
                className="mt-8 inline-flex items-center justify-center bg-[#fff] hover:bg-emerald-50 text-[#1B6B4A] font-bold text-base px-7 py-3.5 rounded-xl shadow-lg transition-colors"
              >
                {section.cta}
              </a>
            ) : null}
          </div>
          <div id={anchor} className="scroll-mt-28">
            <VideoSlot
              src={section.video}
              poster={section.poster}
              title={section.videoTitle}
              label="Video"
            />
          </div>
        </div>
      </Container>
    </section>
  )
}

/* ── Steps ────────────────────────────────────────────────────────── */

export function Steps({ section, tone }: { section: StepsSection; tone: Tone }) {
  return (
    <section id={section.id} className={`py-16 md:py-20 scroll-mt-24 ${TONE_CLASS[tone]}`}>
      <Container>
        <SectionHead title={section.title} body={section.body} eyebrow={section.eyebrow} />
        <ol className="mt-12 grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {section.steps.map((step, i) => (
            <li
              key={step.title}
              className="bg-white rounded-2xl border border-gray-100 shadow-sm p-7"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#1B6B4A] text-[#fff] font-extrabold">
                {i + 1}
              </span>
              <h3 className="mt-4 text-lg font-bold leading-snug">{step.title}</h3>
              <p className="mt-2 text-gray-600 leading-relaxed">{step.body}</p>
            </li>
          ))}
        </ol>
      </Container>
    </section>
  )
}

/* ── Testimonials ─────────────────────────────────────────────────── */

export function Testimonials({ section, tone }: { section: TestimonialsSection; tone: Tone }) {
  return (
    <section id={section.id} className={`py-16 md:py-20 scroll-mt-24 ${TONE_CLASS[tone]}`}>
      <Container>
        <SectionHead title={section.title} body={section.body} eyebrow={section.eyebrow} />
        <div className="mt-12 grid md:grid-cols-3 gap-6">
          {section.items.map((t) => (
            <figure
              key={t.name}
              className="flex flex-col bg-white rounded-2xl border border-gray-100 shadow-sm p-7"
            >
              <h3 className="text-xl font-bold leading-snug">{t.headline}</h3>
              <blockquote className="mt-3 flex-1 text-gray-600 leading-relaxed">{t.quote}</blockquote>
              <figcaption className="mt-6 flex items-center gap-3">
                {/* The initial sits underneath; a loaded avatar paints over
                    it, so a bad link still leaves a tidy circle. */}
                <span
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-[#14523A] font-bold bg-cover bg-center"
                  style={{ backgroundImage: safeBackground(t.avatar) }}
                  aria-hidden="true"
                >
                  {t.name.charAt(0)}
                </span>
                <span className="text-sm">
                  <span className="block font-bold text-gray-900">{t.name}</span>
                  <span className="block text-gray-600">
                    {t.role}, {t.company}
                  </span>
                </span>
              </figcaption>
            </figure>
          ))}
        </div>
      </Container>
    </section>
  )
}

/* ── Closing call to action ───────────────────────────────────────── */

export function Cta({ section }: { section: CtaSection }) {
  return (
    <section id={section.id} className="pb-16 md:pb-20 bg-white scroll-mt-24">
      <Container>
        <div className="rounded-3xl bg-[#1B6B4A] px-6 py-12 sm:px-12 sm:py-14">
          <div className="grid lg:grid-cols-2 gap-10 items-center">
            <div>
              <h2
                className="text-3xl sm:text-4xl font-extrabold tracking-tight leading-tight"
                style={ON_DARK}
              >
                {section.title}
              </h2>
              <p className="mt-4 text-lg font-semibold text-emerald-100 leading-relaxed">
                {section.body}
              </p>
              <Link
                href={section.cta.href}
                className="mt-8 inline-flex items-center justify-center bg-[#fff] hover:bg-emerald-50 text-[#1B6B4A] font-bold text-base px-8 py-3.5 rounded-xl shadow-lg transition-colors"
              >
                {section.cta.label}
              </Link>
            </div>
            <div className="rounded-2xl bg-[#fff] p-3">
              <ImageSlot
                src={section.image}
                alt={section.imageAlt}
                label="Closing call-to-action image"
                dimensions="1200 × 800 · PNG, JPG or WebP"
                variant="plain"
                minHeight={240}
              />
            </div>
          </div>
        </div>
      </Container>
    </section>
  )
}

/* ── FAQ ──────────────────────────────────────────────────────────── */

export function Faq({ section, tone }: { section: FaqSection; tone: Tone }) {
  return (
    <section id={section.id} className={`py-16 md:py-20 scroll-mt-24 ${TONE_CLASS[tone]}`}>
      <Container>
        <SectionHead title={section.title} eyebrow={section.eyebrow} />
        <div className="mt-10 max-w-3xl mx-auto space-y-3">
          {section.items.map((f) => (
            <details
              key={f.q}
              className="faq-item group bg-white rounded-2xl border border-gray-200 px-6 shadow-sm"
            >
              <summary className="flex items-center justify-between gap-4 py-5 text-left font-bold text-gray-900">
                <span>{f.q}</span>
                <ChevronDown
                  className="faq-chevron h-5 w-5 shrink-0 text-[#1B6B4A] transition-transform"
                  aria-hidden="true"
                />
              </summary>
              <p className="pb-5 text-gray-600 leading-relaxed">{f.a}</p>
            </details>
          ))}
        </div>
      </Container>
    </section>
  )
}

/* ── Prose ────────────────────────────────────────────────────────── */

export function Prose({ section, tone }: { section: ProseSection; tone: Tone }) {
  return (
    <section id={section.id} className={`py-16 md:py-20 scroll-mt-24 ${TONE_CLASS[tone]}`}>
      <Container>
        <div className="max-w-3xl mx-auto">
          <SectionHead title={section.title} eyebrow={section.eyebrow} align="left" />
          <div className="mt-6 space-y-4 text-base sm:text-lg text-gray-700 leading-relaxed">
            {section.paragraphs.map((p) => (
              <p key={p}>{p}</p>
            ))}
          </div>
        </div>
      </Container>
    </section>
  )
}
