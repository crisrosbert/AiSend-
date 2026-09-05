# Milestone Prompts — copy-paste into ChatGPT, one per session

> Assumes the Project instructions from [`master-context.md`](./master-context.md)
> are set and the docs are uploaded. Each prompt is one session and one branch.
> Do not run two in parallel.

---

## Phase 0 — before any of these

Phase 0 is **yours, not ChatGPT's**: Meta app creation, business verification,
test account, webhook subscription. No amount of code substitutes for it, and
the Phase 0 exit gate (a real comment showing up as a logged webhook hit on a
deployed URL) must pass before M1.3 can be verified at all.

---

## M1.1 — Schema & RLS

```
Implement M1.1 from implementationPlan.md: the Postgres schema and RLS.

Deliver five forward-only migrations under supabase/migrations/:
  001_core.sql        orgs, org_members, ig_accounts, contacts
  002_events_queue.sql ig_events, jobs
  003_automation.sql   automations, automation_runs
  004_inbox.sql        ig_threads, ig_messages, ig_comments
  005_limits.sql       rate_budgets

Follow the column list in architecture.md §5 exactly. Also:
- All five indexes named at the end of §5.
- RLS policies on every tenant table for SELECT, INSERT, UPDATE and DELETE —
  not SELECT only (EC-1.1-09).
- The ig_events unique constraint is (account_id, provider_event_id), not
  provider_event_id alone (EC-1.1-06).
- contacts unique key is (org_id, igsid) (EC-1.1-03).
- Every timestamp column is timestamptz (EC-1.1-07).
- Do not cascade-delete ig_events or automation_runs when an account or
  automation is removed — they are the audit trail (EC-1.1-04, EC-1.1-05).

Then generate Supabase TypeScript types into src/types/db.ts.

Exit criterion to satisfy and demonstrate: an automated test that signs in as
org A, queries every tenant table through the anon key for org B's rows, and
gets zero rows. Write that test.

Read edge-cases/phase-1-comment-dm-automation.md §M1.1 and cross-cutting.md
first. Report which EC ids you handled.
```

---

## M1.2 — Graph adapter, token vault, OAuth

```
Implement M1.2: the Instagram Graph adapter, encrypted token storage, and the
OAuth connect flow.

Files:
  src/lib/instagram/graph-client.ts   the ONLY file with Graph URLs or the API
                                      version (read from INSTAGRAM_GRAPH_VERSION)
  src/lib/instagram/token-store.ts    AES-256-GCM encrypt/decrypt, server-only
  src/app/api/instagram/callback/route.ts        OAuth code exchange
  src/app/api/instagram/refresh-tokens/route.ts  daily refresh cron
  settings UI to connect / disconnect an account

Requirements:
- graph-client methods: replyToComment, sendMessage, sendQuickReplies,
  getMedia, exchangeCode, refreshToken. Typed errors, with error code 190 and
  its subcodes distinguished (EC-1.2-07).
- After the token exchange, subscribe the account to webhook fields and store
  whether that succeeded — it is a separate API call from OAuth and failing it
  silently means no events ever arrive (EC-1.2-13).
- Upsert on (org_id, ig_user_id) so reconnecting updates rather than duplicates
  (EC-1.2-04).
- Read back the granted scopes and refuse the connection if a required one is
  missing, naming which (EC-1.2-02).
- Refresh at ~80% of token lifetime, not at expiry (EC-1.2-10).
- Store a key id alongside the ciphertext for future key rotation (EC-1.2-11).
- The ciphertext column must never be selected in app-side queries (EC-1.2-12).
- Handle the user cancelling OAuth without a 500 (EC-1.2-01).

This is Next.js 16 — check node_modules/next/dist/docs/ for route handler
conventions before writing the routes.

Read edge-cases §M1.2. Report EC ids handled.
```

---

## M1.3 — Webhook receiver

```
Implement M1.3: the webhook receiver at src/app/api/instagram/webhook/route.ts,
plus src/lib/instagram/webhook-signature.ts.

The handler's entire contract: verify signature → persist raw event → enqueue
job → return 200. No matching, no sending, no Graph calls (invariant 1).

Critical requirements:
- Read the request body as raw text ONCE and compute the HMAC over those exact
  bytes. Do not parse to JSON and re-serialise — that changes whitespace and
  breaks every signature (EC-1.3-01). Tell me explicitly how you obtained the
  raw body in Next.js 16.
- Constant-time comparison; strip the "sha256=" prefix (EC-1.3-03).
- Missing signature header → 401, nothing persisted (EC-1.3-02).
- One POST can contain multiple entry[] and changes[] — persist each as its own
  event; one bad entry must not abort the others (EC-1.3-04).
- Duplicate delivery → ON CONFLICT DO NOTHING, return 200, enqueue nothing.
  A unique-violation must not surface as a 500, or Meta retries forever
  (EC-1.3-05).
- Define the dedupe key per event type with a deterministic composite fallback;
  never fall back to no dedupe (EC-1.3-06).
- If the DB is unreachable, return non-2xx so Meta retries. This is the one
  case where a fast 200 is wrong (EC-1.3-07).
- Unknown event types (reactions, seen, typing) → store raw, mark unhandled,
  200. Never crash (EC-1.3-09).
- GET handshake: check hub.mode === 'subscribe', compare the verify token, and
  return hub.challenge as PLAIN TEXT, not JSON (EC-0-10).

Also confirm: does this project's middleware.ts intercept /api/instagram/webhook
and redirect unauthenticated requests? If so, exclude the webhook path — this is
the most common cause of a webhook that verifies but never receives events
(EC-0-12).

Exit criteria to demonstrate: tampered signature → 401 with zero rows written;
same payload posted three times → exactly one ig_events row and one jobs row.

Read edge-cases §M1.3 and §Phase 0. Report EC ids handled.
```

---

## M1.4 — Normalizer

```
Implement M1.4: src/lib/events/normalize.ts, converting raw Meta payloads into
the NormalizedEvent type defined in architecture.md §4.

This is the only place Meta's payload shape is understood after ingestion.

Must handle: comment, reply-to-comment (parentCommentId set), DM with text,
DM with attachment only (text undefined — EC-1.4-04), quick-reply postback,
echo messages, and unsupported types (share, sticker, voice) normalised without
throwing.

Must drop or clearly flag:
- echo messages, i.e. the account's own outbound coming back (EC-1.4-01)
- comments authored by the connected account itself (EC-1.4-02)
Missing either creates a bot that replies to itself in a loop.

Also:
- Normalise text to NFC and strip zero-width characters here, once — not
  scattered downstream (EC-1.4-09).
- Meta mixes seconds and milliseconds across timestamp fields. Normalise to ISO
  and be explicit about which fields you found in which unit (EC-1.4-11).
- Story replies must be classified and IGNORED in Phase 1 — not mis-normalised
  as plain DMs, which would silently trigger DM rules (EC-1.4-05).

Tests: a fixture suite of at least 12 payloads, each asserting the exact
NormalizedEvent. IMPORTANT — I will supply real captured payloads from my test
account. Do not invent fixtures from memory; ask me for them (EC-1.4-10).

Read edge-cases §M1.4. Report EC ids handled.
```

---

## M1.5 — Matcher (tests first)

```
Implement M1.5: src/lib/automation/matcher.ts.

Signature: match(event: NormalizedEvent, rules: Rule[]): MatchedAction[]

WRITE THE TESTS FIRST, then the implementation.

This module is PURE. It must not import Supabase, the Graph client, fetch, or
anything with I/O. An I/O import here is a failed task (invariant 3, EC-1.5-10).

Behaviour to get exactly right:
- Empty keywords[] matches NOTHING. The natural every()/some() slip makes it
  match everything, which would DM the customer's entire audience. Test this
  case first (EC-1.5-01).
- Empty/whitespace keyword strings are discarded — ''.includes() is always true
  (EC-1.5-02).
- Event with no text (attachment-only DM) returns no matches, never throws
  (EC-1.5-03).
- Comment rule with scope.type='media' and empty mediaIds matches nothing, not
  everything (EC-1.5-08).
- Deterministic tiebreak when two rules share a priority: priority, then
  created_at, then id. Otherwise ordering is DB-order-dependent and flaky
  (EC-1.5-06).
- stopOnMatch halts after the first match in sorted order — test that rule 2
  does NOT run (EC-1.5-07).
- Postbacks match on payload, exactly and case-sensitively. Never fuzzy-match a
  payload (EC-1.5-09).
- Literal matching only. Never pass user keywords to RegExp (EC-1.5-13).
- Document the 'contains' semantics: does "price" match "priceless"? State the
  intended behaviour and test it (EC-1.5-04).

Target: 30+ unit tests, zero network in the test run.

Read edge-cases §M1.5. Report EC ids handled.
```

---

## M1.6 — Queue, worker, cron

```
Implement M1.6: the Postgres-backed job queue and the worker entry point.

Files:
  src/lib/queue/enqueue.ts   transactional with the event insert
  src/lib/queue/claim.ts     SELECT ... FOR UPDATE SKIP LOCKED LIMIT 25
  src/lib/queue/retry.ts     backoff 1m/5m/25m, max 3 attempts, then dead
  src/app/api/jobs/drain/route.ts   shared-secret auth + Vercel Cron header
  vercel.json cron entries

Requirements:
- Reclaim locks older than N minutes on every drain, or a crashed worker stalls
  the queue forever (EC-1.6-02).
- Track elapsed time inside the batch loop and return early rather than
  straddling the function timeout (EC-1.6-07).
- Jobs for deleted accounts terminate as 'skipped', not 'failed' — dead-letters
  should mean real problems (EC-1.6-03).
- Per-account circuit breaker after N consecutive failures (EC-1.6-04).
- Assume at-least-once: a job whose status write fails will re-run. Do not
  design as if exactly-once (EC-1.6-05).

Two things to check and report rather than assume:
1. Vercel's current cron granularity limits on the plan we're on — the design
   assumes */1 * * * * (EC-0-19, EC-1.6-06). If that isn't available, say so;
   it affects the ~5s latency success criterion.
2. Whether our Supabase connection string is transaction-mode pooled —
   transaction poolers break FOR UPDATE SKIP LOCKED sessions (EC-0-17).

Exit criterion to demonstrate: enqueue 200 synthetic jobs, run two concurrent
drainers, prove each job executes exactly once.

Read edge-cases §M1.6. Report EC ids handled.
```

---

## M1.7 — Action registry

```
Implement M1.7: src/lib/automation/actions/ as a registry.

Each action module exports validate(config) and execute(ctx, config); an index
maps kind → module. Adding an action must not require editing the webhook or
the queue (invariant 2).

Actions: reply-comment.ts, send-dm.ts, add-tag.ts, handoff.ts

Requirements:
- Per-action ActionOutcome. On retry, re-run only actions not already marked
  'sent' — without this, a partial fan-out produces duplicate public replies
  (EC-1.7-05).
- ig_comments.replied_at as a replied-once guard (EC-1.7-03).
- Rotate templates[] to avoid Instagram's repetitive-reply spam flags
  (EC-1.7-04).
- Classify Graph errors as retryable vs non-retryable: deleted comment and
  blocked user are non-retryable skips; rate limits (4, 613, 80007) are
  retryable (EC-1.7-01, EC-1.7-02, EC-1.7-09).
- Run validate(config) before execute — a malformed JSONB row must skip that
  action, not crash the drainer for every tenant (EC-1.7-12).
- De-duplicate per-actor within one event's action set, so two matching rules
  don't send two DMs a second apart (EC-1.7-11).

IMPORTANT — verify before implementing, do not answer from memory:
A private reply to a comment and a standard DM are different endpoints with
different messaging windows. The comment→DM flow is our headline feature and it
must use the correct one, or it fails for everyone who has never DMed the
business (EC-1.7-06). Tell me what the current Meta documentation says. Same for
quick-reply count/title limits and message length limits (EC-1.7-07,
EC-1.7-08).

Read edge-cases §M1.7. Report EC ids handled.
```

---

## M1.8 — Policy gate

```
Implement M1.8: src/lib/automation/policy.ts.

Every check runs BEFORE any Graph API call. The API is never the thing that
discovers a policy violation (invariant 5).

Checks:
- 24h window: now - thread.last_inbound_at > 24h → skipped: window_closed
- contacts.opted_out → skipped: opted_out
- per-actor cooldown, per-account daily cap → skipped: cooldown | cap_reached
- rate_budgets over budget → job RESCHEDULED, not failed

Requirements:
- Evaluate at execution time, not match time. A queue backlog must never
  produce an out-of-window send (EC-1.8-02).
- last_inbound_at null → standard DM blocked. The comment→DM path is the
  documented exception; encode the difference explicitly (EC-1.8-01).
- One server-side clock, with a safety margin (block at ~23h55m) rather than
  exactly 24h (EC-1.8-03).
- Re-check human_handled at execution — a human may have taken the thread over
  while the job was queued (EC-1.8-09).
- Increment rate budgets atomically in SQL, not read-modify-write in JS
  (EC-1.8-06).
- State which timezone the daily cap resets in (EC-1.8-05).

Exit criterion to demonstrate: with a thread's clock aged past 24h, the send is
blocked and a mocked Graph client records ZERO calls (EC-1.8-08).

Read edge-cases §M1.8. Report EC ids handled.
```

---

## M1.9 — Automations UI

```
Implement M1.9: the flat rule editor at src/app/(dashboard)/automations/.

No flow canvas — Phase 1 is flat rules: trigger kind → keywords + match mode →
scope (global or selected posts) → actions → priority + stopOnMatch.

Requirements:
- Client-side validation imports the SAME validate() modules the executor uses.
  Two copies drift within a month (EC-1.9-03).
- Include a "test this rule" box: paste sample text, see which rule matches and
  why. This is the highest-value support-load reducer in the product — build it
  properly, not as an afterthought.
- Warn on a keyword short enough to match nearly everything (EC-1.9-01).
- Show which rule wins when keywords overlap, given priority and stopOnMatch
  (EC-1.9-02).
- Media picker must handle pagination and deleted/archived posts (EC-1.9-06).
- Block rule creation when no account is connected, with an explanatory state
  (EC-1.9-09).
- Say in the UI whether edits apply to already-queued events (EC-1.9-04) —
  match whatever M1.5 decided for EC-1.5-11.

Read edge-cases §M1.9. Report EC ids handled.
```

---

## M1.10 — Inbox

```
Implement M1.10: src/app/(dashboard)/inbox/ — thread list, message pane,
manual composer, human-takeover toggle, Supabase Realtime for live inbound.

Requirements:
- On realtime reconnect, REFETCH the thread. Messages arriving during a
  disconnect never come through the socket and are silently lost (EC-1.10-01).
- The takeover toggle sets ig_threads.human_handled; M1.8 re-checks it at send
  time (EC-1.10-02).
- User-supplied message text is ESCAPED, never rendered as HTML. An <img
  onerror> in a DM is stored XSS against our own agents (EC-1.10-06).
- Paginate/virtualise long threads (EC-1.10-03).
- A failed optimistic send shows as failed with a retry, never disappears
  (EC-1.10-04).
- Meta media URLs expire — proxy or cache them (EC-1.10-07).

Read edge-cases §M1.10. Report EC ids handled.
```

---

## M1.11 — Dashboard & runs viewer

```
Implement M1.11: dashboard counters and the automation_runs viewer.

Requirements:
- Increment counters in the same transaction as the TERMINAL outcome, keyed on
  the action — not once per attempt, or retries double-count (EC-1.11-01).
- 'skipped' (policy) and 'failed' (error) are different states with different
  user meanings. Never collapse them into one (EC-1.11-05).
- Show the dead-letter count prominently — it is the first alerting signal
  (EC-1.6-10).
- Show the automation name snapshot for runs whose automation was deleted
  (EC-1.11-03).
- Log non-matches too, at least sampled with short retention. "Why didn't my
  automation fire?" is the most common support question and it needs evidence
  (EC-1.11-06).
- Plan retention and an index for the default filter before the table hits a
  million rows (EC-1.11-04).

Read edge-cases §M1.11. Report EC ids handled.
```

---

## M1.12 — Hardening

```
Implement M1.12: hardening and launch readiness.

- Load test: 200 comments in 60 seconds. Report drain backlog depth,
  rate-budget behaviour, and DB connection count under that load (EC-1.12-02,
  EC-1.12-03).
- Enforce the CSP in production, not report-only, and verify Instagram CDN
  images and the Supabase realtime socket still work (EC-1.12-01).
- Per-section error boundaries so one widget crash cannot blank the dashboard.
- A loud, unmissable UI state for accounts in needs_reauth — silently
  non-working automation is the worst possible retention failure (EC-1.12-04).
- CI: typecheck + build + test on every PR.
- README self-host guide, verified by running it on a clean machine
  (EC-1.12-05).

Then walk the full Phase 1 exit gate — all eight criteria in
implementationPlan.md §3 — and report each as pass/fail with how you verified
it. Do not mark one as passing without saying how you checked.
```

---

## Fix-loop prompt (use after each review)

```
Review of the last milestone found these problems. Fix each, and for each one
tell me what the root cause was — not just what you changed:

[paste the reviewer's findings here]

Do not refactor anything unrelated while fixing these.
```
