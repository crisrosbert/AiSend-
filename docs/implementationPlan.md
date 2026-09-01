# Implementation Plan — Instagram Automation Platform (**InstaAuto**)

> **Derived from:** [`architecture.md`](./architecture.md) ·
> [`problemStatement.md`](./problemStatement.md)
> **Reading key:** every milestone cites the architecture section it
> implements (`§n`) and the principles it must preserve (`P1`–`P7`).
> A milestone is *done* only when its **Exit criteria** pass — not when the
> code compiles.

---

## 0. Planning assumptions

| Assumption | Value |
|---|---|
| Team | 2 people. **Dev A** = full-time engineering. **Dev B** = part-time engineering + owns Meta compliance, distribution, support. |
| Effective capacity | ~7 engineering dev-days/week combined (not 10 — B is split). |
| Phase 1 estimate | **~45 dev-days ≈ 7–9 calendar weeks.** |
| Definition of Done | Typechecks · lints · unit tests green · migration applied on a clean DB · manually verified against a real IG test account · env vars documented in `.env.example`. |
| Migration discipline | One numbered SQL file per milestone, forward-only, never edited after merge. |
| Branching | One branch per milestone, squash-merged. No milestone branch lives >4 days. |

> **Next.js 16 caveat (per `AGENTS.md` and `architecture.md` §3):** before the
> first route handler is written, read the relevant guide under
> `node_modules/next/dist/docs/`. Route-handler and dynamic-`params`
> conventions changed across recent majors; assuming older App Router habits
> will cost a day.

---

## 1. Two parallel tracks

Phase 1 is not one sequence. There are two, and **the compliance track is the
real critical path** — it has external latency you cannot compress by coding
faster.

```
Track A — PRODUCT BUILD  (Dev A, weeks 1–9)
  M1.1 schema ─▶ M1.2 adapter ─▶ M1.3 webhook ─▶ M1.4 normalizer
       ├─▶ M1.5 matcher (parallel, pure, no deps)
       └─▶ M1.6 queue ─▶ M1.7 actions ─▶ M1.8 policy
                              └─▶ M1.9 automations UI
                              └─▶ M1.10 inbox
                                     └─▶ M1.11 dashboard ─▶ M1.12 hardening

Track B — META COMPLIANCE  (Dev B, START WEEK 1, not week 8)
  App creation ─▶ business verification ─▶ privacy policy + data-deletion
  callback ─▶ test users ─▶ screencast ─▶ App Review submission ─▶ (2–6 wks
  external wait, rejection possible) ─▶ Advanced Access
```

**Rule:** Track B's App Review submission must go in by **end of Week 5**,
using the demo built at M1.9. If you wait for a finished product, the external
review clock starts 4 weeks too late and becomes the launch date.

---

## 2. Phase 0 — Foundations (Week 1, ~4 dev-days)

**Goal:** every external dependency proven working before any product code.

| # | Task | Owner | Output |
|---|---|---|---|
| 0.1 | Fork `vistaratech/InstaAuto`, run locally, read its existing webhook + OAuth end to end | A | Working local app; a written note of what to keep vs. replace |
| 0.2 | Create Supabase project (dev + prod), wire `@supabase/ssr` clients | A | Both envs reachable |
| 0.3 | Create Meta Developer app, add **Instagram Login** product, request Phase 1 scopes only (§7) | B | App id/secret in `.env.local` |
| 0.4 | Add an IG **Business/Creator** test account as an app tester | B | Test account connected |
| 0.5 | Deploy the untouched fork to Vercel, set the webhook callback + verify token, confirm the `GET` handshake returns `hub.challenge` | A | **Green webhook verification in Meta console** |
| 0.6 | Seed `.env.example` with all 10 vars from §9 | A | Documented env surface |
| 0.7 | Start business verification + host privacy policy & data-deletion callback | B | Compliance clock started |

**Exit criteria**
- A real comment on the test account produces a **logged inbound webhook hit**
  on the deployed Vercel app. Nothing needs to happen with it yet — but the
  pipe must be proven open before anything else is built on the assumption
  that it is.

**Why this is Phase 0 and not part of Phase 1:** every one of these can fail
for reasons outside your code (account type wrong, callback unreachable,
verification stalled). Discovering that in week 6 is a project-killer;
discovering it in week 1 is a Tuesday.

---

## 3. Phase 1 — Comment + DM automation

Implements `architecture.md` §2–§8. Roughly 45 dev-days.

### M1.1 — Schema & RLS (§5, P7) · 5 dev-days

| Task | Detail |
|---|---|
| Migration `001_core.sql` | `orgs`, `org_members`, `ig_accounts`, `contacts` |
| Migration `002_events_queue.sql` | `ig_events` (with the **UNIQUE `provider_event_id`**), `jobs` |
| Migration `003_automation.sql` | `automations`, `automation_runs` |
| Migration `004_inbox.sql` | `ig_threads`, `ig_messages`, `ig_comments` |
| Migration `005_limits.sql` | `rate_budgets` |
| Indexes | All five from §5 |
| RLS policies | Every tenant table filters on `org_id` via `org_members`; service-role bypass documented |
| Types | Generate Supabase TS types into `src/types/db.ts` |

**Exit:** an RLS test — sign in as org A, attempt to read org B's rows through
the anon key, get **zero rows** on every table. Write it as an automated test,
not a manual check; this is the one guarantee that silently rots.

---

### M1.2 — Graph adapter, token vault, OAuth (§3, P6) · 5 dev-days

| Task | Detail |
|---|---|
| `lib/instagram/graph-client.ts` | Only file with URLs + `INSTAGRAM_GRAPH_VERSION`. Methods: `replyToComment`, `sendMessage`, `sendQuickReplies`, `getMedia`, `exchangeCode`, `refreshToken`. Typed errors, esp. code `190`. |
| `lib/instagram/token-store.ts` | AES-256-GCM encrypt/decrypt; `getDecryptedToken(accountId)` is server-only |
| `api/instagram/callback/route.ts` | code → short token → long-lived token → encrypt → store → **subscribe account to webhook fields** (`comments`, `messages`, `messaging_postbacks`) |
| `api/instagram/refresh-tokens/route.ts` | Daily cron; refresh-before-expiry; on `190` set `status='needs_reauth'` and pause automations |
| Connect/disconnect UI | Settings page: connect button, account card, disconnect |

**Exit:** connect the test account, restart the app, confirm the token still
works after a simulated refresh; confirm the ciphertext never appears in any
API response or client bundle (grep the built output).

---

### M1.3 — Webhook receiver (§2.1 steps 2–6, P1 + P4) · 3 dev-days

| Task | Detail |
|---|---|
| `lib/instagram/webhook-signature.ts` | HMAC-SHA256 over the **raw** body, constant-time compare. Unit-tested with a known-good fixture. |
| `api/instagram/webhook/route.ts` `GET` | Verify-token handshake |
| `api/instagram/webhook/route.ts` `POST` | verify → `INSERT ig_events` → `INSERT jobs` → `200`. **No business logic.** |
| Dedupe | `ON CONFLICT (provider_event_id) DO NOTHING`; a conflict returns `200` and enqueues **nothing** |
| Raw-body access | Confirm the Next 16 way to read the unparsed body — a framework that parses first breaks the signature |

**Exit:**
- Tampered signature → `401`, **zero rows written**.
- Same payload posted 3× → 1 `ig_events` row, 1 `jobs` row.
- p95 handler latency **< 500 ms** measured on Vercel, not locally.

---

### M1.4 — Normalizer (§4) · 3 dev-days

Meta payload → `NormalizedEvent`. The single place Meta's shape is understood
post-ingest. Cover: comment (incl. replies-to-replies via `parentCommentId`),
DM text, DM with attachment, quick-reply postback, echo messages.

**Exit:** a fixture suite of ≥12 real captured Meta payloads, each asserting an
exact `NormalizedEvent`. Capture these from the test account in Phase 0 —
hand-written fixtures encode your assumptions, not Meta's behaviour.

---

### M1.5 — Matcher, tests first (§4, P3) · 4 dev-days · *parallelizable*

Pure `(event, rules) → MatchedAction[]`. No I/O, no Instagram imports — an
import of the Graph client in this file is a review-blocking defect.

Cases to cover: three `matchMode`s · case folding · emoji and unicode ·
multi-keyword any-of · comment scope `global` vs `media` · `priority` ordering ·
`stopOnMatch` vs run-all · postback matching on payload not text · empty/no-match.

**Exit:** ≥30 unit tests green, **zero network in the test run**. This module
is where correctness lives; it is the one place that gets tests before code.

---

### M1.6 — Queue + worker + cron (§2.3, §6) · 5 dev-days

| Task | Detail |
|---|---|
| `lib/queue/enqueue.ts` | Transactional with the event insert |
| `lib/queue/claim.ts` | `SELECT … FOR UPDATE SKIP LOCKED LIMIT 25`, ordered by `occurred_at` per account |
| `lib/queue/retry.ts` | Backoff 1m / 5m / 25m, max 3 attempts for sends, then `status='dead'` |
| `api/jobs/drain/route.ts` | Shared-secret header + Vercel Cron header; bounded batch; always returns, never loops |
| `vercel.json` crons | `*/1 * * * *` → drain; daily → refresh-tokens |

**Exit:** enqueue 200 synthetic jobs, run the drainer, confirm each executes
**exactly once** under two concurrent drainer invocations (the `SKIP LOCKED`
proof). Kill a job mid-flight, confirm it retries and eventually dead-letters
rather than vanishing.

---

### M1.7 — Action registry (§3, P2) · 5 dev-days

`lib/automation/actions/` — each module exports `validate(config)` and
`execute(ctx, config)`; a registry index maps `kind` → module.

- `reply-comment.ts` — `POST /{comment-id}/replies`; rotate `templates[]` to
  avoid identical-reply spam flags; write `ig_comments.replied_at` as a
  **replied-once guard**.
- `send-dm.ts` — `POST /{ig-id}/messages`, optional `quickReplies`; writes
  `ig_messages` (outbound) and updates `ig_threads.last_outbound_at`.
- `add-tag.ts` / `handoff.ts` — local writes only.
- Executor — per-action `ActionOutcome`; a retry re-runs only actions **not**
  already `sent` (§6 partial fan-out).

**Exit:** a real comment on the test Reel produces a real public reply **and** a
real DM. Then force a mid-fan-out failure and confirm the retry does not
double-send the action that already succeeded.

---

### M1.8 — Policy gate (§7, P5) · 3 dev-days

`lib/automation/policy.ts`, evaluated **before** any Graph call:

- 24h window — `now - thread.last_inbound_at > 24h` → `skipped: window_closed`
- `contacts.opted_out` → `skipped: opted_out`
- per-actor cooldown, per-account daily cap → `skipped: cooldown | cap_reached`
- `rate_budgets` over budget → job **rescheduled**, not failed

**Exit:** with the thread clock manually aged past 24h, the send is blocked
locally and **no Graph API call is made** (assert on a mocked client's call
count). The API must never be the thing that discovers a policy violation.

---

### M1.9 — Automations UI · 5 dev-days

Flat rule editor (no flow canvas in Phase 1): trigger kind → keywords + match
mode → scope (global / pick posts) → actions → priority + `stopOnMatch`.
Client-side validation reuses the registry's `validate()`, so UI and executor
can never disagree. Include a **"test this rule"** box: paste sample text, see
which rule matches — this is the single highest-value support-load reducer in
the product.

**Exit:** a non-technical person creates a working comment→DM automation
unaided. **Track B records the screencast here for App Review submission.**

---

### M1.10 — Inbox · 5 dev-days

Thread list · message pane · manual composer · human-takeover toggle that sets
`ig_threads.human_handled` and suppresses automation on that thread ·
Supabase Realtime for live inbound · unread counts.

**Exit:** send a DM from a phone, see it appear live without refresh; reply
manually; confirm automations stop firing on that thread afterwards.

---

### M1.11 — Dashboard + runs viewer (§8) · 3 dev-days

Counters (active automations, messages sent, audience reached) incremented in
the **same transaction** as the run record. `automation_runs` viewer showing
event → matched rule → actions → outcome → duration, filterable by status.
Surface the dead-letter count prominently — it is the first alerting signal.

**Exit:** every action taken in M1.7/M1.8 testing is visible and explainable in
the UI. If a user asks "why didn't my automation fire", this screen answers it
without you opening a database.

---

### M1.12 — Hardening & launch readiness · 4 dev-days

Load test (200 comments in 60s) · CSP + security headers · error boundaries ·
`needs_reauth` reconnect flow · onboarding empty states · README self-host
guide · CI (typecheck + build + test on every PR).

---

### Phase 1 exit gate

Maps 1:1 to §5 of the problem statement. **All eight, or Phase 1 is not done:**

| # | Gate | Verified by |
|---|---|---|
| 1 | Account connects and survives token refresh | M1.2 |
| 2 | Keyword comment → public reply + DM within ~5s | M1.7 |
| 3 | Keyword DM → reply, quick replies render, postbacks route | M1.7 |
| 4 | Duplicate webhooks → exactly one action | M1.3 + M1.6 |
| 5 | Self-comments and echoes never trigger | M1.4 + M1.5 |
| 6 | Out-of-window sends blocked **before** the API call | M1.8 |
| 7 | Every run visible in a log | M1.11 |
| 8 | Fork → Vercel + Supabase free tier, no server ops | M1.12 |

Plus the non-negotiable ninth: **Meta Advanced Access granted** (Track B).
Without it the product only ever works for testers.

---

## 4. Later phases

Each is deliberately small because `P2`/`P3` were paid for in Phase 1 — none
of them touches the webhook receiver or the queue.

| Phase | Scope | New surface | Est. | Gate to start |
|---|---|---|---|---|
| **2 — Story automation** | `triggers/story-reply.ts`, `triggers/mention.ts`; subscribe one more webhook field | None (JSONB config) | 5 d | Phase 1 live with ≥10 real accounts |
| **3 — AI fallback reply** | `actions/ai-reply.ts` + provider adapter; fires only when the matcher returns **zero** actions; persona config; humanized delay that **must not cross the 24h window** | `personas` table; provider key env var | 10 d | Users asking for it — not before; it adds cost per message and a new failure mode |
| **4 — Ice Breakers** | Profile-sync call in the Graph adapter, ≤4 prompts | Small config table | 3 d | Anytime after Phase 2 |
| **5 — Reels publish/schedule** | New action kind + scheduled job type, reusing the queue | `content_pool` table; `instagram_business_content_publish` scope (**new App Review**) | 12 d | Only if customers ask. Note §6 of the problem statement — this edges toward the Nuelink category |
| **6 — Visual flow builder** | Rules become graphs; matcher gains a step-tree executor behind the **same** `(event, rules) → actions` contract | `automation_steps` table | 15 d | When flat rules demonstrably block real customer use cases |

**Sequencing advice:** ship Phase 1 to paying users and sit there. Phases 2–6
are each defensible, but building 2→6 before anyone pays is how a 2-person team
spends a year and learns nothing. Phase 3 (AI) is the most-requested and the
most operationally expensive — take money for it.

---

## 5. Calendar view (indicative)

| Week | Track A (product) | Track B (compliance & GTM) |
|---|---|---|
| 1 | Phase 0 · M1.1 start | App + test account + **verification started** |
| 2 | M1.1 · M1.2 | Privacy policy, data-deletion callback live |
| 3 | M1.3 · M1.4 · M1.5 (parallel) | Draft App Review answers |
| 4 | M1.5 · M1.6 | Niche + pricing decision |
| 5 | M1.7 · M1.8 | **App Review submitted** (screencast from M1.9 draft) |
| 6 | M1.9 | Landing page, waitlist |
| 7 | M1.10 | First 5 design partners lined up |
| 8 | M1.11 | Review responses / resubmission if rejected |
| 9 | M1.12 · exit gate | Onboard design partners |

Weeks 5–9 on Track B assume one rejection cycle. Plan for it; Meta commonly
rejects a first submission over the screencast or the data-deletion callback.

---

## 6. Risk register

| Risk | Trigger to watch | Mitigation |
|---|---|---|
| **App Review rejected/stalled** | No response 3 weeks post-submit | Submit Week 5 with buffer; keep a self-host/agency-licence path where each customer uses their own Meta app and only needs dev-mode access for their own account |
| Raw-body parsing breaks signatures | Signature test fails against real Meta traffic | Verify with real traffic in M1.3, not fixtures alone |
| Viral post floods the queue | Drain backlog grows | `SKIP LOCKED` batching + `rate_budgets`; alert on backlog depth |
| Double-sends from retries | Duplicate DMs in testing | Per-action `sent` state (M1.7) + `ig_comments.replied_at` guard |
| Meta API version breakage | Graph errors after a version sunset | P6 — one adapter, pinned version; upgrade is a one-file diff |
| Base repo bugs (0 stars, no releases) | Unexplained behaviour in inherited code | Replace rather than patch the webhook/OAuth paths in M1.2–M1.3 |
| Support load buries a 2-person team | >1 support hour/day | M1.9 rule-tester + M1.11 runs viewer are the deflection tools; build them properly |
| Scope creep into Phases 2–6 | "Just add AI quickly" | The phase gates above are the answer |

---

## 7. What to do first, concretely

1. **Today:** create the Meta app and start business verification (Track B).
   It has the longest external latency of anything in this plan.
2. **This week:** Phase 0 exit criterion — a real comment on your test account
   showing up as a logged webhook hit on a deployed Vercel URL.
3. **Then:** M1.1 schema with the RLS test, because everything else writes
   into it.

Do not start M1.9 (UI) early because it is the fun part. The UI is worthless
without M1.5–M1.8 underneath it, and the App Review screencast — the only
external deadline that matters — needs a *working* rule, not a pretty form.
