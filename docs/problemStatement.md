# Problem Statement — Instagram Automation Platform (Working name: **InstaAuto**)

> **Status:** Context-setup document (Phase 0)
> **Owner:** crisrosbert
> **Last updated:** 2026-09-01
> **Relationship to AiSend:** This is a **separate, standalone project**.
> It is *not* merged into AiSend (the WhatsApp CRM in this org) and does
> not share a database, deployment, or auth realm with it. AiSend is only
> a *reference implementation* — patterns may be borrowed, code is not
> back-merged in either direction.

---

## 1. The problem

Businesses, creators, and agencies that sell through Instagram lose money in
the gap between **interest** and **conversation**:

1. Someone comments `price` / `link` / `info` on a Reel or post.
2. Nobody replies for hours (or ever), because a human has to watch the
   comment feed.
3. Instagram's own reach mechanics punish unanswered comments and slow DM
   response times.
4. The lead cools, or a competitor's bot answers first.

The proven fix is **inbound engagement automation** — a keyword on a comment
triggers a public reply *and* a private DM, and a keyword in a DM triggers an
instant scripted answer. This is what ManyChat sells.

### Why this is worth building

| Signal | Value |
|---|---|
| ManyChat customers | ~1,000,000 |
| ManyChat total funding | $163.1M across 5 rounds (incl. $140M Series B, 2025, led by Summit Partners) |
| ManyChat estimated ARR | ~$34.6M (GetLatka, 2024). Other estimates range $25M–$100M+ (Owler, Growjo). Private company — all figures are third-party estimates, not filings. |
| Headcount | ~547 (2026), up from ~386 (2025) |

The feature set that produces those numbers is **narrow** — keyword triggers,
comment→DM, DM auto-reply, an inbox. It is fully replicable on the official
Instagram Graph API, and MIT-licensed open-source implementations of it
already exist. The moat is distribution and polish, not technology.

---

## 2. Prior art evaluated

### 2a. Official Graph API based (compliant, sustainable)

| Project | Notes |
|---|---|
| **`vistaratech/InstaAuto`** | **Chosen base.** Next.js 16 (App Router), React 19 + TypeScript, Tailwind + shadcn/ui, Supabase (Postgres + Storage), Vercel, Instagram Graph API v24.0 with Instagram Login. MIT. Very early: ~102 commits, 0 stars/forks, no releases. |
| `diwenne/openreply` | Same category — comment→DM, tracked links, follow-gating, keyword triggers. Self-hosted, needs own Meta app + webhook. No clear differentiator over InstaAuto; thinner docs. |
| `insta-p8` | Another variant in the "open-source ManyChat alternative" space. |

### 2b. Unofficial / private-API based (rejected)

| Project | Why rejected |
|---|---|
| `shubhamraj2202/instagram-autoresponder` | Python + `instagrapi` (private API). ToS violation, account-ban risk. |
| `Skuxblan/Instagram-Auto-Responder` | Python, mobile private API. Same risk. |
| `mehmataka/Instagram-DM-Automation` | Android UI automation driving the real app. Same risk, worse ops. |

**Decision:** build only on the **official Instagram Graph API**. Private-API
and UI-automation approaches are excluded permanently — they cannot be sold to
customers whose accounts they can get banned, and they teach the wrong
architecture.

### 2c. Architecture reference — `ChatbotXIO/ChatbotX`

ChatbotX is used for **ideas and structural patterns only — no code copying**.
Three patterns to import:

1. **Trigger/Action separation** — the thing that *fires* (a comment arrived,
   a DM arrived) is a separate, registrable component from the thing that
   *runs* (post a public reply, send a DM, add a tag). Adding a new trigger or
   a new action must not require touching the webhook handler.
2. **Event-bus / queue between webhook and execution** — the webhook's only
   job is verify → persist → enqueue → `200 OK`. All matching and sending
   happens in a worker. This is what makes rate-limiting, retries, and
   idempotency tractable.
3. **Matcher as a standalone, channel-agnostic module** — the automation
   matcher takes a normalized event and a rule set and returns actions. It
   knows nothing about Instagram specifically, so the same module can later
   serve other channels.

### 2d. Explicitly *not* a competitor: Nuelink

Nuelink is **outbound scheduling/publishing** (12 platforms, content calendar,
e-commerce/RSS auto-posting, evergreen recycling, link-in-bio, mobile apps).
This project is **inbound engagement automation**. Functional overlap is close
to zero. Scheduling/publishing is a **non-goal** (see §6) — matching Nuelink
would mean building an entirely different product.

---

## 3. Target users

- **Creators / coaches** selling a link, course, or PDF from Reels.
- **D2C small brands** doing catalogue/price enquiries in DMs.
- **Social media agencies** managing several client accounts.
- **Self-hosters** who refuse per-seat SaaS pricing and want their own data.

---

## 4. Goals

### Phase 1 (this milestone) — Comment Automation + DM Automation

**Comment automation**
- Keyword match on incoming comments, scoped **globally** or **per-post**.
- On match, run either or both:
  - **(a)** public reply on the comment thread,
  - **(b)** private DM to the commenter (the comment→DM flow).
- Self-comment filtering — the connected account's own comments never trigger.
- Basic metrics: comments matched, public replies sent, DMs sent.

**DM automation**
- Keyword-based auto-reply on inbound DMs.
- Multi-keyword matching per rule (any-of), with match modes
  (exact / contains / starts-with), case-insensitive by default.
- Simple button / quick-reply support, and handling of the resulting postback.
- Live inbox with manual reply, so a human can take over a thread.

**Cross-cutting Phase 1 requirements**
- Instagram OAuth connect/disconnect (Instagram Login, Business/Creator only).
- Webhook verification + signature validation.
- Idempotent event processing (Meta redelivers).
- Rate-limit and 24-hour messaging-window compliance.
- Dashboard: active automations, messages sent, audience reached.

### Later phases (out of scope for Phase 1, on the roadmap)

- Story automation (mentions, replies, emoji reactions).
- AI fallback reply when no keyword matches (Groq/OpenAI-compatible gateway),
  with configurable persona, language matching, typing indicators, humanized
  delays.
- Ice Breakers (up to 4 prompts synced to the IG Messenger profile).
- Reels publishing/scheduling and a content pool.
- Multi-account / multi-workspace and team roles.
- Visual flow builder (multi-step branching), replacing flat keyword rules.

---

## 5. Success criteria for Phase 1

| # | Criterion |
|---|---|
| 1 | A Business/Creator account connects via Instagram Login and stays connected across token refresh. |
| 2 | A comment containing a configured keyword produces a public reply **and** a DM within ~5s of the webhook. |
| 3 | A DM containing a configured keyword produces the configured reply, with quick replies rendering and their postbacks routed. |
| 4 | Duplicate webhook deliveries produce **exactly one** outbound action. |
| 5 | Own-account comments and echo events never trigger automations. |
| 6 | Sends outside the 24-hour window are blocked before they hit the Graph API, not after. |
| 7 | Every automation run is visible in a log with the event, matched rule, actions and outcome. |
| 8 | The whole thing deploys from a GitHub fork to Vercel + Supabase free tiers with no server management. |

---

## 6. Non-goals

- **Outbound scheduling/publishing** (the Nuelink category) — not in this product.
- **Any private-API, scraping, or UI automation** — permanently excluded.
- **Merging into AiSend** — AiSend stays a WhatsApp CRM; this stays an
  Instagram product. Shared *patterns*, never a shared codebase or database.
- **Cold/bulk DM blasting** — violates Meta policy and gets accounts banned.
- **Multi-platform channels** (WhatsApp, Messenger, TikTok) in Phase 1.

---

## 7. Constraints & risks

| Constraint | Detail |
|---|---|
| **24-hour messaging window** | A business may message a user only within 24h of the user's last interaction. Humanized delays must never push a send past the window. |
| **User-initiated only** | Every automation must be triggered by a user action (comment, DM, story reply). No unsolicited outreach. |
| **Account type** | Instagram **Business or Creator** only; personal accounts are unsupported by the API. |
| **Required scopes** | `instagram_business_basic`, `instagram_business_manage_messages`, `instagram_business_manage_comments` (Phase 1). Later: `instagram_business_content_publish`, `instagram_business_manage_insights`. |
| **App Review** | Advanced access for the messaging/comments scopes requires Meta App Review before serving accounts other than testers. This gates GA, not development. |
| **Graph API rate limits** | Per-account call limits; bursts of comment traffic on a viral Reel must be queued, not fired synchronously. |
| **Webhook reliability** | Meta retries on non-2xx and can redeliver. Handlers must be idempotent and must respond fast (webhook returns before doing work). |
| **Serverless execution limits** | Vercel function timeouts mean long work (fan-out, retries, waits) belongs in a queue drained by a cron/worker, not in the request. |
| **Base repo immaturity** | InstaAuto has 0 stars/forks and no releases — expect to fix its bugs ourselves; there is no upstream community to lean on. |
| **Platform dependency** | Meta can change API versions, scopes, or policy. Version pinning (v24.0) plus an adapter layer isolates the blast radius. |

---

## 8. Stack decision

| Layer | Choice | Reason |
|---|---|---|
| Source | GitHub (fork of `vistaratech/InstaAuto`) | MIT license; upstream diffs remain pullable. |
| App + API | Next.js 16 App Router, React 19, TypeScript | Same as base repo and same as AiSend — no tooling context-switch. |
| UI | Tailwind + shadcn/ui | Base repo's choice; fast to extend. |
| Data | Supabase (Postgres + Storage + RLS) | Free tier, RLS for tenant isolation, same as AiSend. |
| Hosting | Vercel | Serverless functions host the webhook; free tier suffices for pilot. |
| Instagram | Graph API v24.0 with Instagram Login | The only compliant path. |

**Why this stack for *us* specifically:** it is identical to AiSend's stack, so
no tooling context-switch; the base repo is MIT so anything learned or written
can be reused commercially; and the
`webhook → matcher → DB → reply` shape is the same shape any future
automation engine takes, so Phase 1 doubles as a proving ground for that
pattern without touching AiSend's production code.

---

## 9. Open questions

1. Multi-tenant from day one (org → connected accounts) or single-account
   self-host first? *(Leaning: multi-tenant schema, single-account UI.)*
2. Queue implementation on Vercel — Postgres-backed job table drained by cron,
   or a hosted queue (Upstash/QStash)? *(Leaning: Postgres table first,
   zero extra vendors.)*
3. Do we keep the fork tracking upstream `InstaAuto`, or hard-fork once the
   trigger/action refactor lands?
4. Product name and domain.
