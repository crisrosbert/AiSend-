# AiSend — Architecture & File Guide

A tour of every part of the codebase and what it does.

## Stack

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind v4 ·
Supabase (Postgres + Auth + Storage + Realtime, RLS everywhere) ·
Meta WhatsApp Cloud API.

---

## Root config

| File | What it does |
|---|---|
| `package.json` | Scripts, deps. Notable: `@supabase/ssr`, `reactflow` (flow canvas), `@dnd-kit` (Kanban drag), `sonner` (toasts). |
| `next.config.ts` | Security headers on every response: HSTS, X-Frame-Options DENY, Permissions-Policy, and a CSP (report-only until you enforce it). Also cache-control policy. |
| `src/middleware.ts` | Runs on every request: refreshes the Supabase session cookie and redirects unauthenticated users to `/login`, authenticated ones away from auth pages. |
| `tsconfig.json` / `eslint.config.mjs` / `.prettierrc` | Strict TS, Next+React-hooks lint rules, formatting. |
| `vitest.config.ts` | Unit test runner config. |
| `vercel.json` | Vercel deployment hints. |
| `.env.local.example` | Documented template of every env var. |
| `.github/workflows/ci.yml` | CI: typecheck + build on every PR. |
| `supabase/migrations/*.sql` | Ordered schema: 001 core tables (profiles, contacts, conversations, messages, broadcasts, whatsapp_config…), 002 pipeline extras, 003–005 broadcast tracking, 006–007 automations engine tables, 008 avatar storage, 009 canned replies + message actions. All with RLS. |

---

## `src/app` — routes

### `(auth)/` — public auth pages
`login`, `signup`, `forgot-password` + a shared centered-card layout.
Talk to Supabase Auth directly from the client.

### `(dashboard)/` — the product (session required)
| Route | Purpose |
|---|---|
| `dashboard/` | KPI overview: metric cards, conversations chart, response-time chart, pipeline donut, activity feed. |
| `inbox/` | Live chat: conversation list, message thread, composer, template picker, contact sidebar. Realtime via Supabase channels. |
| `recent/` | Recently active conversations. |
| `contacts/` | Contact table, CSV import, tags, custom fields, detail view. |
| `pipelines/` | Kanban deal board (drag & drop), deal forms, per-pipeline analytics and settings. |
| `broadcasts/` | Campaign list, 4-step wizard (template → audience → personalize → schedule), per-recipient delivery/read tracking, resend-to-unread. |
| `automations/` | No-code automation list + visual builder (ReactFlow canvas), execution logs. |
| `journeys/` | AI agent workspaces: `canvas` (flow), `persona` (voice/behavior), `brain` (knowledge base / RAG sources), `actions` (API tools). |
| `agents/`, `ads/`, `candidates/`, `bookings/`, `leads/`, `media/`, `widget/`, `integrations/` | AI agent management, ad-lead capture, hiring pipeline, appointment bookings, website leads, media library, embeddable chat widget config, third-party integrations. |
| `billing/` | Plans, credits, recharge modal. |
| `settings/` | Profile, password, sessions, WhatsApp connection (manual + Meta Embedded Signup), message templates, tags, canned replies, business profile. |
| `dashboard-shell.tsx` / `layout.tsx` | Sidebar + header chrome around every page. |
| `dashboard-error-boundary.tsx` | Catches render crashes so one widget can't blank the app. |

### `[slug]/` — multi-tenant mirrors
The same dashboard pages served under a per-organization slug
(`/acme/inbox`), enabling one deployment to host multiple workspaces.

### `admin/` — operator console
Client/organization list with plan + WhatsApp status, search, and
status toggles. Guarded by an admin check server-side.

### Marketing & legal
`page.tsx` (landing), `(marketing)/landing-page.tsx`, `contact`,
`privacy`, `terms`, `legal-shell.tsx`, `icon.tsx` (generated favicon).

### `api/` — server routes
| Route | Purpose |
|---|---|
| `whatsapp/webhook` | THE entry point for Meta. Verifies HMAC signature, ingests inbound messages/statuses, triggers automations and AI agents. |
| `whatsapp/send`, `broadcast`, `react`, `media/[id]`, `profile`, `config`, `templates/*`, `embedded-signup` | Outbound sends, broadcast fan-out, reactions, media proxy, number config, template sync/create, OAuth code exchange for Embedded Signup. |
| `automations/*` | CRUD, duplicate, the execution `engine`, and `cron` (drains Wait steps). |
| `ai/respond`, `agent/ingest` | LLM reply generation and knowledge-base ingestion (RAG). |
| `billing/*`, `redeem` | Subscribe, recharge, verify payments, redeem codes. |
| `broadcasts/draft`, `resend-unread` | Draft persistence, re-target unread recipients. |
| `contacts/opt-out`, `canned-replies`, `widget/*`, `cron/appointment-reminders`, `admin/clients` | Opt-out handling, canned replies CRUD, widget config/message endpoints, booking reminders, admin data. |

---

## `src/lib` — business logic

| Module | What it does |
|---|---|
| `whatsapp/meta-api.ts` | Typed client for the Meta Graph API (send text/template/media, mark read, etc.). |
| `whatsapp/encryption.ts` | AES-256-GCM encrypt/decrypt for access tokens at rest (+ tests). |
| `whatsapp/webhook-signature.ts` | HMAC-SHA256 verification of inbound webhooks (+ tests). |
| `whatsapp/phone-utils.ts` | E.164 normalization/formatting (+ 23 tests). |
| `agent/engine.ts`, `llm-provider.ts`, `fallback.ts`, `engine-capabilities.ts` | The AI agent: routes a conversation through an LLM with tool use and graceful fallbacks. |
| `agent/rag/` | `ingest.ts` (chunk + embed sources), `retrieve.ts` (similarity search for grounding answers). |
| `agent/tools/` | Tools the agent can call: bookings, knowledge base, lead forms, media, payments. |
| `automations/` | `engine.ts` (step executor), `validate.ts` (+18 tests), `steps-tree.ts`, `templates.ts`, `trigger-meta.ts`, `meta-send.ts`, `admin-client.ts` (service-role Supabase client). |
| `journeys/runner.ts` | Executes AI journey flows. |
| `hiring-agent/`, `ads-agent/` | Specialized agent handlers + prompts. |
| `billing/` | `plans.ts` (plan matrix), `credits.ts` (ledger math). |
| `dashboard/` | `queries.ts` (metrics SQL), `date-utils.ts` (+ tests), `types.ts`. |
| `rate-limit.ts` | In-memory sliding-window limiter (+ tests). Swap for Redis when scaling horizontally. |
| `broadcast-status.ts` | Delivery-state machine for recipients (+ tests). |
| `opt-out.ts`, `optin/manager.ts`, `template-library.ts` | Compliance opt-in/out and the prebuilt template catalog. |
| `supabase/client.ts` / `server.ts` | Browser and server Supabase factories (cookie-aware SSR). |
| `utils.ts` | `cn()` class-merge helper. |

## `src/components`

- `ui/` — 21 shadcn-style primitives (button, dialog, table, tabs…).
- `layout/` — `sidebar.tsx` (dark icon rail, unread badge),
  `header.tsx`, `mobile-tab-bar.tsx`.
- `inbox/`, `broadcasts/`, `contacts/`, `pipelines/`, `automations/`,
  `dashboard/`, `settings/`, `billing/` — feature components matching
  the routes above. Notable: `settings/connect-whatsapp.tsx` (Meta
  Embedded Signup popup flow), `automations/flow-canvas.tsx`
  (ReactFlow builder), `broadcasts/step1–4` (campaign wizard).

## `src/hooks`

`use-auth.tsx` (session + profile context), `use-realtime.ts`
(Supabase channel subscriptions), `use-total-unread.ts` (live unread
badge), `use-broadcast-sending.ts` (send progress).

## `src/types`

`index.ts` (Contact, Conversation, Message, Broadcast, Deal…),
`journey.ts` (journey/node types).

## `public/`

`widget.js` — the embeddable website chat widget customers paste into
their sites; static SVGs.

---

## Data flow in one paragraph

A customer messages the business's WhatsApp number → Meta POSTs to
`/api/whatsapp/webhook` → signature verified → message stored in
Postgres (RLS-scoped) → Supabase Realtime pushes it to any open inbox
→ the automation engine checks triggers and the AI agent (if enabled)
drafts/sends a reply through `lib/whatsapp/meta-api.ts` → delivery and
read receipts come back through the same webhook and update broadcast
and message statuses live.
