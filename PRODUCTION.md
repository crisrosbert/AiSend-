# AiSend — Production Deployment Guide

This guide takes you from a fresh clone to a live, secure deployment.
Everything in this repo already passes `typecheck`, `lint` (0 errors),
`test` (82 passing), and a full production `build` of all 57 routes.

---

## 1. Prerequisites

- Node.js **20+** (see `engines` in package.json)
- A **Supabase** project (free tier works to start)
- A **Meta for Developers** app with the WhatsApp product added
- A hosting target: Vercel, Hostinger Managed Node.js, or any box
  that can run `npm run build && npm start`

---

## 2. Supabase setup

1. Create a project at supabase.com.
2. Open the SQL editor and run every file in `supabase/migrations/`
   **in order** (001 → 009). They create all tables, indexes, RLS
   policies, and the avatars storage bucket.
3. From **Project Settings → API**, copy:
   - Project URL → `NEXT_PUBLIC_SUPABASE_URL`
   - anon public key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - service_role key → `SUPABASE_SERVICE_ROLE_KEY` (server-only; never
     expose it to the browser)
4. In **Authentication → URL Configuration**, set your site URL and
   redirect URLs to your production domain.

---

## 3. Environment variables

Copy `.env.local.example` → `.env.local` (local) or set them in your
host's dashboard (production).

Required:

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public anon key (RLS-scoped) |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-side key for webhook + engines |
| `ENCRYPTION_KEY` | 64 hex chars (32 bytes) for AES-256-GCM token encryption. Generate: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `META_APP_SECRET` | Verifies HMAC-SHA256 signatures on inbound webhooks |

Recommended:

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_SITE_URL` | Canonical https URL of this deployment |

Optional:

| Variable | Purpose |
|---|---|
| `AUTOMATION_CRON_SECRET` | Protects `GET /api/automations/cron`; required if automations use Wait steps |

**Do not rotate `ENCRYPTION_KEY` casually** — every stored WhatsApp
token becomes unreadable and users must reconnect their numbers.

---

## 4. WhatsApp (Meta Cloud API) setup

1. In your Meta app, add the **WhatsApp** product and note the
   App Secret (→ `META_APP_SECRET`).
2. Configure the webhook:
   - Callback URL: `https://YOUR_DOMAIN/api/whatsapp/webhook`
   - Verify token: whatever you set in the app's WhatsApp settings UI
   - Subscribe to `messages` and `message_template_status_update`
3. Each user connects their number in **Settings → WhatsApp** (manual
   token entry, or Embedded Signup if you configure
   `NEXT_PUBLIC_META_APP_ID` / config ID in
   `src/components/settings/connect-whatsapp.tsx`).
4. Tokens are encrypted at rest with AES-256-GCM before hitting the DB.

---

## 5. Deploy

### Vercel
- Import the repo, set the env vars, deploy. `vercel.json` is included.
- Add a Vercel Cron hitting `/api/automations/cron` (with the
  `AUTOMATION_CRON_SECRET` as a query/header) every minute if you use
  Wait steps, and `/api/cron/appointment-reminders` for booking
  reminders.

### Hostinger / any Node host
```bash
npm ci
npm run build
npm start          # serves on PORT (default 3000)
```
Use the host's cron feature (or an external pinger) for the two cron
endpoints above.

---

## 6. Post-deploy hardening checklist

- [ ] **Enforce CSP** — `next.config.ts` currently ships CSP as
  `Content-Security-Policy-Report-Only`. Watch the browser console for
  violations over a deploy or two, then rename the header key to
  `Content-Security-Policy` to enforce.
- [ ] **HTTPS only** — HSTS is already set; make sure your host
  redirects http → https.
- [ ] **Search indexing** — `src/app/layout.tsx` sets
  `robots: { index: false }`. Flip to `true` when you want the
  landing page indexed.
- [ ] **Backups** — enable Supabase point-in-time recovery or
  scheduled backups on paid tiers.
- [ ] **Rate limits** — `src/lib/rate-limit.ts` is in-memory
  (per-instance). If you scale to multiple instances, swap it for a
  Redis/Upstash-backed limiter.
- [ ] **Monitoring** — add Sentry (or similar) to catch runtime errors;
  the dashboard error boundary at
  `src/app/(dashboard)/dashboard-error-boundary.tsx` is the natural
  reporting hook.

---

## 7. Commands

```bash
npm run dev         # local dev server
npm run build       # production build (verified passing)
npm start           # serve the build
npm run typecheck   # tsc --noEmit (passing)
npm run lint        # eslint (0 errors)
npm test            # vitest (82 passing)
```

---

## 8. What was fixed to make this production-ready

- **Build no longer depends on Google's font CDN at build time.**
  `next/font/google` was replaced with runtime `<link>` loading
  (`display=swap`) plus system-font fallbacks, so `next build` works
  on restricted CI networks. CSP updated to allow
  fonts.googleapis.com / fonts.gstatic.com.
- **Full rebrand to AiSend** (was "Clickstream WA"/wacrm) across app
  metadata, auth pages, marketing, legal pages, and package.json.
- **Lint: 30 errors → 0.** Unescaped JSX entities fixed; `useTemplate`
  functions renamed to `applyTemplate` (ESLint hook-name false
  positive); derived state converted to `useMemo`; prop-sync effects
  converted to React's render-time adjustment pattern; impure
  `Math.random()` render call replaced with `useId()`; Facebook SDK
  and admin API responses properly typed. Two genuinely schema-less
  config components keep `any` behind scoped, documented
  eslint-disables.
- All 82 unit tests and the full 57-route production build verified
  green after every change.
