// src/lib/integrations/google-sheets.ts
//
// ── WHY THIS EXISTS ──────────────────────────────────────────────────
// A merchant's team doesn't live in a CRM — they live in a spreadsheet.
// This mirrors every ingested lead into one Google Sheet the whole team
// already has open, so Supabase stays the source of truth (dedupe,
// automations, the AI agent all read from it) while the Sheet stays a
// read-only reflection the team can glance at without touching the app.
//
// ── WHY A SERVICE ACCOUNT, NOT "Sign in with Google" ────────────────
// Real per-merchant Google OAuth needs the app verified by Google for
// the Sheets scope (a review process, not a toggle) before it works for
// anyone outside a short test-user allowlist. A service account sidesteps
// that entirely: ONE Google Cloud service account belongs to this app,
// and a merchant grants it access the same way they'd share a sheet
// with a colleague — paste the service account's email into the
// sheet's Share dialog. No OAuth consent screen, no Google review, and
// it keeps working even if nobody is signed in.
//
// ── SETUP (one-time, per deployment, not per merchant) ───────────────
//   1. Google Cloud Console → create a service account → enable the
//      Google Sheets API for the project → create a JSON key.
//   2. Set two env vars from that key file:
//        GOOGLE_SERVICE_ACCOUNT_EMAIL = the "client_email" field
//        GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY = the "private_key" field
//          (keep the \n escape sequences — they're unescaped below)
//   3. Each merchant shares their Sheet with that service account email
//      (Editor access) and pastes the sheet URL into Integrations →
//      Google Sheets in the dashboard.
//
// No `googleapis` dependency — this codebase stays lean, and a service
// account's OAuth flow is three HTTP calls, not a library.

import crypto from 'node:crypto'
import { supabaseAdmin } from '@/lib/automations/admin-client'

const SHEETS_SCOPE = 'https://www.googleapis.com/auth/spreadsheets'
const TOKEN_URL = 'https://oauth2.googleapis.com/token'

function base64url(input: Buffer | string): string {
  return (Buffer.isBuffer(input) ? input : Buffer.from(input))
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

let cachedToken: { token: string; expiresAt: number } | null = null

/**
 * Mint a short-lived OAuth access token for the service account via the
 * JWT Bearer grant (RFC 7523) — hand-rolled with Node's own `crypto`
 * module rather than pulling in `google-auth-library`.
 */
async function getAccessToken(): Promise<string | null> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 30_000) {
    return cachedToken.token
  }

  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL
  const rawKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY
  if (!email || !rawKey) {
    console.warn('[google-sheets] GOOGLE_SERVICE_ACCOUNT_EMAIL / _PRIVATE_KEY not configured — sync skipped')
    return null
  }
  // Env vars can't hold real newlines; the key is stored with literal
  // "\n" and must be unescaped before PEM parsing will accept it.
  const privateKey = rawKey.includes('\\n') ? rawKey.replace(/\\n/g, '\n') : rawKey

  const now = Math.floor(Date.now() / 1000)
  const header = { alg: 'RS256', typ: 'JWT' }
  const claim = {
    iss: email,
    scope: SHEETS_SCOPE,
    aud: TOKEN_URL,
    iat: now,
    exp: now + 3600,
  }
  const unsigned = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(claim))}`
  const signature = crypto.createSign('RSA-SHA256').update(unsigned).sign(privateKey)
  const jwt = `${unsigned}.${base64url(signature)}`

  try {
    const res = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: jwt,
      }),
    })
    const json = await res.json()
    if (!res.ok || !json.access_token) {
      console.error('[google-sheets] token exchange failed:', JSON.stringify(json).slice(0, 300))
      return null
    }
    cachedToken = { token: json.access_token, expiresAt: Date.now() + json.expires_in * 1000 }
    return json.access_token
  } catch (err) {
    console.error('[google-sheets] token exchange error:', err)
    return null
  }
}

/** Pulls the spreadsheet id out of any Sheets URL shape a merchant might paste. */
function spreadsheetIdFromUrl(url: string): string | null {
  const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/)
  return match?.[1] ?? null
}

export interface LeadRowInput {
  name: string | null
  phone: string | null
  source: string
  campaign?: string | null
  interest?: string | null
  status: string
  lastMessage?: string | null
}

/**
 * Append one row to the merchant's configured Google Sheet, if they have
 * Google Sheets connected under Integrations. Silent no-op when they
 * don't — this is a mirror, not a requirement, and a merchant who never
 * set it up should see leads land in the app exactly as before.
 */
export async function syncLeadToGoogleSheet(tenantId: string, row: LeadRowInput): Promise<void> {
  try {
    const { data: connection } = await supabaseAdmin()
      .from('integration_connections')
      .select('status, config')
      .eq('user_id', tenantId)
      .eq('app_id', 'google-sheets')
      .maybeSingle()

    if (!connection || connection.status !== 'connected') return

    const sheetUrl: string | undefined = connection.config?.sheet_url
    const sheetName: string = connection.config?.sheet_name || 'Sheet1'
    if (!sheetUrl) return

    const spreadsheetId = spreadsheetIdFromUrl(sheetUrl)
    if (!spreadsheetId) {
      console.warn(`[google-sheets] tenant ${tenantId}: could not parse spreadsheet id from "${sheetUrl}"`)
      return
    }

    const accessToken = await getAccessToken()
    if (!accessToken) return

    // Columns match the plan a merchant's team actually works from:
    // Date, Name, Phone, Source, Campaign, Interest, Status, Last Message.
    // "Assigned To" is deliberately left blank for the team to fill in —
    // this app has no concept of per-lead human ownership to write there.
    const values = [[
      new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
      row.name ?? '',
      row.phone ?? '',
      row.source,
      row.campaign ?? '',
      row.interest ?? '',
      row.status,
      '',
      row.lastMessage ?? '',
    ]]

    const range = encodeURIComponent(`${sheetName}!A:I`)
    const res = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}:append?valueInputOption=USER_ENTERED`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ values }),
      },
    )

    if (!res.ok) {
      const text = await res.text().catch(() => '')
      // The single most common failure: the merchant never shared the
      // sheet with the service account email. Say so plainly in logs —
      // "403" alone sends someone down the wrong debugging path.
      console.error(
        `[google-sheets] append failed for tenant ${tenantId} (${res.status}): ${text.slice(0, 300)}. ` +
          `Make sure the sheet is shared with ${process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL} as an Editor.`,
      )
    }
  } catch (err) {
    console.error('[google-sheets] sync failed:', err)
  }
}
