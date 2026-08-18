// src/app/data-deletion/page.tsx
//
// The page Meta's confirmation URL points at.
//
// Someone who asked Facebook to delete their data is sent here with
// their confirmation code and needs a plain answer: was it received,
// has it happened, and when.
//
// ── WHY THIS RUNS ON THE SERVER ──────────────────────────────────────
// The requests table has row-level security on and no policies, so the
// browser cannot read it at all. The lookup happens here, with the
// service role, and only a status is ever sent to the page. Nothing
// personal is rendered — not a name, not an email, not even the Meta
// user id — because a page addressed by a code in a URL is a page that
// ends up in browser history and referrer headers.

import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

interface DeletionStatus {
  status: string
  requestedAt: string | null
  completedAt: string | null
}

async function lookup(code: string): Promise<DeletionStatus | null> {
  if (!code || code.length > 40) return null
  try {
    const db = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )
    const { data } = await db
      .from('data_deletion_requests')
      .select('status, requested_at, completed_at')
      .eq('confirmation_code', code)
      .maybeSingle()

    if (!data) return null
    return {
      status: data.status,
      requestedAt: data.requested_at,
      completedAt: data.completed_at,
    }
  } catch {
    return null
  }
}

function describe(status: string): { headline: string; detail: string; tone: 'done' | 'working' | 'problem' } {
  switch (status) {
    case 'completed':
      return {
        headline: 'Your data has been deleted',
        detail:
          'Everything associated with your account has been permanently removed from AiSend, including your contacts, conversations and message history. Nothing is recoverable.',
        tone: 'done',
      }
    case 'no_data':
      return {
        headline: 'There was nothing to delete',
        detail:
          'We received your request, but no AiSend account was linked to your Facebook profile. No data about you is held.',
        tone: 'done',
      }
    case 'processing':
      return {
        headline: 'Deletion in progress',
        detail:
          'Your request is being carried out now. Larger accounts take a little longer. Check back shortly using the same link.',
        tone: 'working',
      }
    case 'failed':
      return {
        headline: 'Something went wrong',
        detail:
          'We received your request but could not complete it automatically. Our team has been alerted and will finish it by hand. Your request has not been forgotten.',
        tone: 'problem',
      }
    default:
      return {
        headline: 'Request received',
        detail:
          'Your deletion request has been recorded and is queued. It is normally carried out within 24 hours. Check back using the same link.',
        tone: 'working',
      }
  }
}

function formatDate(value: string | null): string {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
}

export default async function DataDeletionPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>
}) {
  const { code = '' } = await searchParams
  const record = code ? await lookup(code) : null
  const info = record ? describe(record.status) : null

  const accent =
    info?.tone === 'done' ? '#0f7a41' : info?.tone === 'problem' ? '#b45309' : '#075E54'

  return (
    <main
      style={{
        minHeight: '100vh',
        background: '#f2f6f3',
        color: '#0b1f1c',
        fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        padding: '48px 20px',
      }}
    >
      <div style={{ width: '100%', maxWidth: 620 }}>
        <div
          style={{
            background: '#fff',
            border: '1px solid #d2ddd6',
            borderRadius: 12,
            padding: '30px 30px 26px',
            borderTop: `4px solid ${accent}`,
          }}
        >
          <p
            style={{
              margin: 0,
              fontSize: 11,
              letterSpacing: '.13em',
              textTransform: 'uppercase',
              color: '#6e827c',
              fontFamily: 'ui-monospace, monospace',
            }}
          >
            AiSend · Data deletion
          </p>

          {!code && (
            <>
              <h1 style={{ margin: '10px 0 12px', fontSize: 24, lineHeight: 1.2 }}>
                Check a deletion request
              </h1>
              <p style={{ margin: 0, color: '#40544f', lineHeight: 1.6, fontSize: 15 }}>
                Open the link you were given when you made the request — it carries your
                confirmation code. If you no longer have it, email{' '}
                <a href="mailto:support@aisend.in" style={{ color: accent }}>
                  support@aisend.in
                </a>{' '}
                from the address on your account and we will look it up for you.
              </p>
            </>
          )}

          {code && !record && (
            <>
              <h1 style={{ margin: '10px 0 12px', fontSize: 24, lineHeight: 1.2 }}>
                We could not find that code
              </h1>
              <p style={{ margin: 0, color: '#40544f', lineHeight: 1.6, fontSize: 15 }}>
                Check the link was copied in full. If it still does not work, email{' '}
                <a href="mailto:support@aisend.in" style={{ color: accent }}>
                  support@aisend.in
                </a>{' '}
                quoting the code and we will confirm the status by hand.
              </p>
            </>
          )}

          {record && info && (
            <>
              <h1 style={{ margin: '10px 0 12px', fontSize: 24, lineHeight: 1.2 }}>
                {info.headline}
              </h1>
              <p style={{ margin: '0 0 22px', color: '#40544f', lineHeight: 1.6, fontSize: 15 }}>
                {info.detail}
              </p>

              <dl
                style={{
                  margin: 0,
                  display: 'grid',
                  gridTemplateColumns: 'auto 1fr',
                  gap: '9px 18px',
                  fontSize: 13.5,
                  borderTop: '1px solid #e4ebe6',
                  paddingTop: 18,
                }}
              >
                <dt style={{ color: '#6e827c' }}>Confirmation code</dt>
                <dd style={{ margin: 0, fontFamily: 'ui-monospace, monospace' }}>{code}</dd>

                <dt style={{ color: '#6e827c' }}>Requested</dt>
                <dd style={{ margin: 0 }}>{formatDate(record.requestedAt)}</dd>

                <dt style={{ color: '#6e827c' }}>Completed</dt>
                <dd style={{ margin: 0 }}>{formatDate(record.completedAt)}</dd>
              </dl>
            </>
          )}
        </div>

        <p style={{ margin: '18px 2px 0', fontSize: 12.5, color: '#6e827c', lineHeight: 1.6 }}>
          Deleting your AiSend account does not delete anything held by WhatsApp or Meta.
          To remove data there, use the privacy settings in your Facebook or WhatsApp
          account. See our <a href="/privacy" style={{ color: '#075E54' }}>privacy policy</a>{' '}
          for what we store and why.
        </p>
      </div>
    </main>
  )
}
