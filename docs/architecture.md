# Architecture — Instagram Automation Platform (**InstaAuto**)

> **Derived from:** [`problemStatement.md`](./problemStatement.md)
> **Scope of this document:** the Phase 1 system — *comment automation* and
> *DM automation* — plus the seams that later phases (stories, AI fallback,
> Reels, flow builder) plug into without a rewrite.
> **Separate from AiSend.** No shared database, deployment, or auth realm.
> AiSend is a pattern reference only.

---

## 0. Architectural principles

These fall directly out of the constraints in §7 of the problem statement.

| # | Principle | Forced by |
|---|---|---|
| P1 | **The webhook does no work.** Verify → persist raw event → enqueue → `200 OK`. | Meta retries on non-2xx; serverless timeouts. |
| P2 | **Triggers and actions are registries, not `if/else`.** Adding a trigger or action never edits the webhook handler. | ChatbotX pattern; story/AI phases land later. |
| P3 | **The matcher is channel-agnostic.** `(NormalizedEvent, Rule[]) → Action[]`, pure and unit-testable. | Reuse across channels; testability. |
| P4 | **Every write path is idempotent**, keyed on Meta's event id. | Meta redelivers webhooks. |
| P5 | **Policy is enforced before the API call**, never discovered from an error. | 24-hour window, user-initiated-only. |
| P6 | **One adapter owns the Graph API.** Version pinned in one file (v24.0). | Meta ships breaking versions. |
| P7 | **RLS on every tenant table.** The app's anon key can never read across orgs. | Multi-tenant from day one. |

---

## 1. System context

```
   Instagram user                         Operator (business / agency)
        │                                              │
        │ comments on a post                           │ configures rules,
        │ sends a DM                                   │ takes over threads
        ▼                                              ▼
 ┌──────────────────┐   webhook POST   ┌──────────────────────────────────┐
 │  Meta / Instagram│ ───────────────▶ │  Next.js 16 app on Vercel        │
 │  Graph API v24.0 │ ◀─────────────── │  (App Router: UI + API routes)   │
 └──────────────────┘   send replies   └───────────────┬──────────────────┘
        ▲                                              │
        │ OAuth (Instagram Login)                      │ SQL (RLS)
        │                                              ▼
        │                              ┌──────────────────────────────────┐
        └───────── tokens ────────────▶│  Supabase: Postgres + Storage    │
                (encrypted at rest)    │  events · jobs · rules · inbox   │
                                       └──────────────────────────────────┘
                                                       ▲
                                       Vercel Cron ────┘ drains the job queue
```

---

## 2. Runtime flow

### 2.1 Comment automation (the money path)

```
1. User comments "price" on a Reel
2. Meta ──POST──▶ /api/instagram/webhook
3. Handler: verify X-Hub-Signature-256 (HMAC-SHA256, raw body)
4. Handler: INSERT ig_events (provider_event_id UNIQUE)  ← dedupe point (P4)
5. Handler: INSERT job {type: 'process_event'}           ← enqueue
6. Handler: return 200 OK                            (target < 500ms)
        ───────────────────────────────────────────────
7. Worker (cron / post-response drain) picks the job
8. Normalizer: raw payload ─▶ NormalizedEvent
       {channel:'instagram', type:'comment', accountId, actorId,
        text, mediaId, commentId, occurredAt}
9. Guard: actorId === connected account? ─▶ drop (self-comment filter)
10. Matcher: (event, rules for account) ─▶ Action[]
       scope check (global | this mediaId) → keyword match → first-match
       or all-match per rule config
11. Policy gate: rate budget, 24h window (DM action only), opt-out, caps
12. Action executor, per action:
       reply_comment  ─▶ POST /{comment-id}/replies
       send_dm        ─▶ POST /{ig-id}/messages  (recipient = commenter)
       add_tag / log  ─▶ local only
13. Persist automation_runs + per-action outcome; bump counters
14. Failure ─▶ job retried with exponential backoff, capped
```

### 2.2 DM automation

Same spine, diverging at steps 8–12:

- Normalizer emits `type:'dm'` (plus `type:'postback'` for quick-reply taps,
  carrying the payload string).
- Guards drop **echo** messages (the account's own sends come back as events)
  and messages from a thread currently flagged *human-handled*.
- Matcher runs the DM rule set; a `postback` event matches on payload id, not
  on text.
- Actions: `send_dm` with optional `quick_replies[]`, `handoff_to_human`,
  `add_tag`.
- Every inbound and outbound message is written to `ig_messages` so the live
  inbox renders the same thread the automation is acting on.

### 2.3 Why a queue and not "just reply in the webhook"

A Reel that lands can produce hundreds of comments a minute. Replying inline
means: Meta's retry timer competing with Graph API latency, no rate-limit
backpressure, no retry story, and a Vercel timeout mid-fan-out leaving half the
actions done and the event marked delivered. The queue makes the webhook's
contract trivially satisfiable and moves every failure into a retryable,
inspectable row.

---

## 3. Component map

| Component | Path (proposed) | Responsibility |
|---|---|---|
| **Webhook receiver** | `src/app/api/instagram/webhook/route.ts` | `GET` = subscription verify (`hub.challenge`). `POST` = signature verify, persist raw event, enqueue, return 200. Contains **no** business logic. |
| **OAuth callback** | `src/app/api/instagram/callback/route.ts` | Instagram Login code→token exchange, long-lived token swap, encrypt, store, subscribe the account to webhook fields. |
| **Signature verifier** | `src/lib/instagram/webhook-signature.ts` | HMAC-SHA256 over the **raw** body, constant-time compare. |
| **Graph adapter** | `src/lib/instagram/graph-client.ts` | The only file that knows URLs, API version, and payload shapes. Typed methods: `replyToComment`, `sendMessage`, `sendQuickReplies`, `getMedia`, `refreshToken`. |
| **Token vault** | `src/lib/instagram/token-store.ts` | AES-256-GCM encrypt/decrypt at rest; refresh-before-expiry. |
| **Normalizer** | `src/lib/events/normalize.ts` | Meta payload → `NormalizedEvent`. The only place Meta's shape is understood after ingestion. |
| **Trigger registry** | `src/lib/automation/triggers/` | `comment.ts`, `dm.ts`, `postback.ts` (+ later `story-reply.ts`, `mention.ts`). Each declares which `NormalizedEvent` types it consumes and how it evaluates its own config. |
| **Matcher** | `src/lib/automation/matcher.ts` | Pure: `(event, rules) → Action[]`. No I/O, no Instagram knowledge. Heavily unit-tested. |
| **Policy gate** | `src/lib/automation/policy.ts` | 24h window, opt-out, per-account rate budget, per-actor cooldown, daily caps. |
| **Action registry** | `src/lib/automation/actions/` | `reply-comment.ts`, `send-dm.ts`, `add-tag.ts`, `handoff.ts` (+ later `ai-reply.ts`). Each: `validate(config)`, `execute(ctx, config)`. |
| **Queue** | `src/lib/queue/` | `enqueue.ts`, `claim.ts` (`FOR UPDATE SKIP LOCKED`), `retry.ts`. Postgres-backed. |
| **Worker entry** | `src/app/api/jobs/drain/route.ts` | Invoked by Vercel Cron (and optionally after the webhook responds). Claims a batch, runs it, records outcomes. Auth: shared secret header. |
| **Inbox** | `src/app/(dashboard)/inbox/` | Thread list + message pane + manual composer; marks a thread human-handled. |
| **Automations UI** | `src/app/(dashboard)/automations/` | Flat rule editor for Phase 1: trigger type → keywords → scope → actions. |
| **Dashboard** | `src/app/(dashboard)/dashboard/` | Active automations, messages sent, audience reached, recent runs. |

> **Next.js 16 note:** route-handler and dynamic-`params` conventions changed
> across recent majors. Before writing any route file, read the relevant guide
> under `node_modules/next/dist/docs/` (per `AGENTS.md`) rather than relying on
> older App Router habits.

---

## 4. Core types

```ts
// src/lib/events/types.ts
export type Channel = 'instagram';

export type NormalizedEvent = {
  id: string;                 // our ig_events.id
  providerEventId: string;    // Meta's id — the dedupe key
  channel: Channel;
  type: 'comment' | 'dm' | 'postback' | 'story_reply' | 'mention';
  accountId: string;          // connected IG account (tenant scope)
  actorId: string;            // who did it (IGSID)
  actorUsername?: string;
  text?: string;
  mediaId?: string;           // post/reel the comment belongs to
  commentId?: string;
  parentCommentId?: string;
  payload?: string;           // quick-reply / button postback
  occurredAt: string;         // ISO
  raw: unknown;
};

// src/lib/automation/types.ts
export type MatchMode = 'exact' | 'contains' | 'starts_with';

export type TriggerConfig =
  | { kind: 'comment'; keywords: string[]; matchMode: MatchMode;
      caseSensitive?: boolean; scope: { type: 'global' } | { type: 'media'; mediaIds: string[] } }
  | { kind: 'dm'; keywords: string[]; matchMode: MatchMode; caseSensitive?: boolean }
  | { kind: 'postback'; payloads: string[] };

export type ActionConfig =
  | { kind: 'reply_comment'; templates: string[] }        // rotated, anti-spam
  | { kind: 'send_dm'; text: string; quickReplies?: { title: string; payload: string }[] }
  | { kind: 'add_tag'; tag: string }
  | { kind: 'handoff_to_human' };

export type Rule = {
  id: string; accountId: string; name: string; enabled: boolean;
  priority: number;                 // lower runs first
  trigger: TriggerConfig;
  actions: ActionConfig[];
  stopOnMatch: boolean;             // first-match-wins vs. run-all
};

export type ActionOutcome =
  | { status: 'sent'; providerId?: string }
  | { status: 'skipped'; reason: 'window_closed' | 'opted_out' | 'rate_limited' | 'cooldown' | 'cap_reached' }
  | { status: 'failed'; error: string; retryable: boolean };
```

The matcher's whole contract:

```ts
export function match(event: NormalizedEvent, rules: Rule[]): MatchedAction[];
```

Pure in, pure out — which is why comment scoping, keyword edge cases,
case-folding, emoji, and priority ordering are all testable without a network.

---

## 5. Data model (Supabase / Postgres)

All tenant tables carry `org_id` and are protected by RLS. Only the worker uses
the service-role key; the app uses the anon key under RLS.

| Table | Key columns | Purpose |
|---|---|---|
| `orgs` | `id`, `name`, `owner_user_id` | Tenant root. |
| `org_members` | `org_id`, `user_id`, `role` | Access control (`owner`/`admin`/`agent`). |
| `ig_accounts` | `id`, `org_id`, `ig_user_id`, `username`, `account_type`, `access_token_ciphertext`, `token_expires_at`, `webhook_subscribed`, `status` | One connected Instagram Business/Creator account. Token **encrypted**, never returned to the client. |
| `ig_events` | `id`, `account_id`, `provider_event_id **UNIQUE**`, `type`, `raw jsonb`, `received_at`, `processed_at`, `status` | Raw ingest log **and** the idempotency ledger (P4). |
| `jobs` | `id`, `org_id`, `type`, `payload jsonb`, `status`, `attempts`, `run_after`, `locked_at`, `last_error` | The queue. Claimed with `FOR UPDATE SKIP LOCKED`. |
| `automations` | `id`, `org_id`, `account_id`, `name`, `enabled`, `priority`, `trigger jsonb`, `actions jsonb`, `stop_on_match` | A rule. JSONB so new trigger/action kinds need no migration (P2). |
| `automation_runs` | `id`, `automation_id`, `event_id`, `matched`, `actions jsonb`, `status`, `duration_ms`, `error` | One row per rule evaluation — the audit trail and the debugging surface. |
| `ig_threads` | `id`, `account_id`, `participant_igsid`, `last_inbound_at`, `last_outbound_at`, `human_handled`, `unread_count` | Conversation state. `last_inbound_at` is the **24-hour-window clock**. |
| `ig_messages` | `id`, `thread_id`, `direction`, `text`, `quick_replies jsonb`, `provider_message_id`, `sent_at`, `status` | Inbox history, inbound and outbound alike. |
| `ig_comments` | `id`, `account_id`, `media_id`, `comment_id`, `parent_id`, `author_igsid`, `text`, `replied_at` | Comment log + replied-once guard. |
| `contacts` | `id`, `org_id`, `igsid`, `username`, `tags text[]`, `opted_out`, `first_seen_at` | Person-level state across threads. |
| `rate_budgets` | `account_id`, `window_start`, `calls_used` | Local view of Graph API budget. |

**Indexes that matter:** `ig_events(provider_event_id)` unique;
`jobs(status, run_after)` for the claim query; `ig_threads(account_id,
participant_igsid)` unique; `automations(account_id, enabled, priority)`;
`ig_comments(comment_id)` unique.

**Why JSONB for trigger/action config:** the registry (P2) means the *shape* of
config is owned by TypeScript validators per kind, not by the schema. Adding
`story_reply` or `ai_reply` in a later phase is a new registry file plus a
validator — zero migrations, zero webhook edits.

---

## 6. Reliability

| Concern | Mechanism |
|---|---|
| **Duplicate delivery** | `ig_events.provider_event_id` UNIQUE. A conflicting insert short-circuits to `200 OK` and enqueues nothing. |
| **Retries** | `jobs.attempts` + `run_after` exponential backoff (1m, 5m, 25m, cap 3 attempts for sends). Terminal failures land in `automation_runs` with the error. |
| **Partial fan-out** | Each action records its own outcome; a retry re-runs only actions not marked `sent`. |
| **Poison jobs** | After max attempts → `status='dead'`, surfaced in the runs UI. Never silently dropped. |
| **Ordering** | Per-thread ordering is best-effort; the queue is claimed in `occurred_at` order per account, which is sufficient for keyword replies. |
| **Cold starts / timeouts** | Worker claims a bounded batch (e.g. 25) and returns; cron re-invokes. No unbounded loops in a serverless function. |
| **Rate limiting** | `rate_budgets` sliding window per account; over budget → job re-scheduled, not failed. |
| **Token expiry** | Refresh-before-expiry on a daily cron; on `190` errors the account is marked `needs_reauth` and automations pause instead of erroring in a loop. |

---

## 7. Security & compliance

- **Webhook signature** — HMAC-SHA256 over the raw body against the app secret,
  constant-time compare. Unsigned or mismatched → `401`, nothing persisted.
- **Token encryption** — AES-256-GCM at rest; decrypted only inside the worker;
  never serialized into any API response or client component.
- **RLS everywhere** — every tenant table filters on `org_id` via the member's
  session. Cross-tenant reads are impossible with the anon key (P7).
- **Service-role key** — worker/webhook only, server-side env, never exposed to
  the browser bundle.
- **Worker endpoint auth** — `/api/jobs/drain` requires a shared secret header
  (plus Vercel Cron's own header check).
- **Messaging policy (P5)** — the policy gate blocks a `send_dm` when
  `now - thread.last_inbound_at > 24h`, when the contact is `opted_out`, or when
  a per-actor cooldown/daily cap is hit. The Graph API is never used as the
  validator.
- **User-initiated only** — there is no action kind that starts a conversation
  with someone who has not interacted. Bulk/cold DM is not representable in the
  action registry, by design.
- **Scopes requested** — `instagram_business_basic`,
  `instagram_business_manage_messages`, `instagram_business_manage_comments`
  for Phase 1; nothing broader until the feature needing it ships.
- **Secrets** — all Meta/Supabase credentials via env vars; `.env.example`
  documents them; nothing committed.

---

## 8. Observability

- `automation_runs` is the primary trace: event → rule → actions → outcome →
  duration, rendered per automation in the UI.
- `ig_events.status` (`received | processing | processed | failed`) gives ingest
  health at a glance.
- `jobs` dead-letter count is the single alerting signal worth watching first.
- Counters for the dashboard (`messages sent`, `audience reached`) are
  incremented in the same transaction as the run record, so the dashboard can
  never disagree with the log.

---

## 9. Environment variables

| Var | Used by |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Browser + SSR client under RLS. |
| `SUPABASE_SERVICE_ROLE_KEY` | Worker and webhook only. |
| `INSTAGRAM_APP_ID` / `INSTAGRAM_APP_SECRET` | OAuth exchange + webhook signature. |
| `INSTAGRAM_REDIRECT_URI` | Must match the Meta app config exactly. |
| `INSTAGRAM_WEBHOOK_VERIFY_TOKEN` | `GET` subscription handshake. |
| `INSTAGRAM_GRAPH_VERSION` | Pinned (`v24.0`); the adapter reads only this. |
| `TOKEN_ENCRYPTION_KEY` | 32-byte key for AES-256-GCM. |
| `JOB_RUNNER_SECRET` | Auth for `/api/jobs/drain`. |
| `APP_URL` | Absolute URLs for OAuth and cron. |

---

## 10. Deployment topology

```
GitHub (fork of vistaratech/InstaAuto)
   │  push
   ▼
Vercel ──┬─ Next.js app (UI + /api/*)
         ├─ Cron: */1 * * * *  → /api/jobs/drain
         └─ Cron: daily        → /api/instagram/refresh-tokens
   │
   ▼
Supabase (Postgres + Storage + RLS)
   ▲
Meta Developer App (Instagram Login product)
   └─ Webhook callback → https://<domain>/api/instagram/webhook
      fields: comments, messages, messaging_postbacks
```

Setup order: Supabase project + migrations → Meta app + scopes → Vercel import
+ env vars → deploy → set webhook callback & verify token → connect an IG
Business/Creator account → create the first automation.

---

## 11. Phasing against the architecture

| Phase | What lands | New surface needed |
|---|---|---|
| **1 — Comment + DM automation** | Everything in §2–§8. | — |
| 2 — Story automation | `triggers/story-reply.ts`, `triggers/mention.ts`, one webhook field subscription. | No schema change (JSONB config). |
| 3 — AI fallback reply | `actions/ai-reply.ts` + provider adapter; runs when the matcher returns zero actions. | Persona table; provider key env var. |
| 4 — Ice Breakers | Profile-sync call in the Graph adapter. | Small config table. |
| 5 — Reels publish/schedule | New action kind + scheduled job type; reuses the existing queue. | `content_pool` table; `content_publish` scope. |
| 6 — Visual flow builder | Rules become graphs; the matcher gains a step-tree executor behind the same `(event, rules) → actions` contract. | `automation_steps` table. |

Because P2/P3 hold, none of these require touching the webhook receiver or the
queue — which is the entire point of paying the trigger/action-registry tax up
front.

---

## 12. Decision record

| ID | Decision | Rationale | Alternatives rejected |
|---|---|---|---|
| ADR-1 | Official Graph API only | Sustainable, sellable, no ban risk | `instagrapi`, private mobile API, Android UI automation |
| ADR-2 | Fork `vistaratech/InstaAuto` | MIT, identical stack, working OAuth + webhook already | Greenfield build; `openreply` (thinner docs, no edge) |
| ADR-3 | ChatbotX patterns, not ChatbotX code | Clean-room; avoids licensing entanglement | Copying modules |
| ADR-4 | Postgres-backed queue | Zero extra vendors, transactional with the event insert | Upstash/QStash, inline processing, Supabase pg_cron only |
| ADR-5 | JSONB trigger/action config | New kinds ship without migrations | Column-per-field schema |
| ADR-6 | Matcher is pure and channel-agnostic | Testability; reusable engine shape | Instagram logic embedded in the webhook |
| ADR-7 | Multi-tenant schema from day one | Retrofitting `org_id` + RLS later is a rewrite | Single-account self-host schema |
| ADR-8 | Kept separate from AiSend | Different channel, different product, different data | Merging into AiSend's codebase |
| ADR-9 | No scheduling/publishing in Phase 1 | Different product category (Nuelink) | Competing on both fronts at once |

---

## 13. Build order for Phase 1

1. Fork + run the base repo locally; get Supabase and a Meta test app green.
2. Land the schema in §5 with RLS (`ig_events`, `jobs`, `automations`,
   `automation_runs`, threads/messages/comments/contacts).
3. Rewrite the webhook to the P1 contract: verify → persist → enqueue → 200.
4. Ship the normalizer + `NormalizedEvent` type.
5. Ship the matcher **with its unit tests first** — keyword modes, scoping,
   priority, self/echo filtering.
6. Ship the queue + `/api/jobs/drain` + Vercel Cron.
7. Ship the action registry: `reply_comment`, `send_dm`, `add_tag`, `handoff`.
8. Ship the policy gate (24h window, opt-out, cooldown, caps).
9. Automations UI (flat rule editor) + inbox with manual takeover.
10. Dashboard counters + `automation_runs` viewer.
11. End-to-end test on a real Business account against the success criteria in
    §5 of the problem statement.
