# Edge Cases — Phase 1: Comment + DM Automation

> Milestones M1.1–M1.12 in [`../implementationPlan.md`](../implementationPlan.md) §3.
> This is the long one. Read the section for the milestone you are about to
> build; do not read it all at once.

---

## M1.1 — Schema & RLS

| ID | Scenario | Expected behaviour / handling | Pri |
|---|---|---|---|
| EC-1.1-01 | Signed-in user has **no `org_members` row** | Every RLS-protected query returns empty. Distinguish "no org" (onboarding state) from "empty org" (zero data) in the UI, or you ship a blank dashboard with no explanation. | P1 |
| EC-1.1-02 | Worker uses the **service-role key**, which bypasses RLS entirely | RLS protects the *app*, not the worker. The worker must filter by `org_id`/`account_id` in every query by hand. One missing filter = cross-tenant send. Centralise worker DB access in one module so the filter cannot be forgotten. | **P0** |
| EC-1.1-03 | Same person (IGSID) interacts with two different orgs' accounts | Two separate `contacts` rows, one per org. A global unique on `igsid` alone is a cross-tenant leak. Unique key is `(org_id, igsid)`. | **P0** |
| EC-1.1-04 | Account disconnected/deleted while events and runs exist | Do **not** cascade-delete `ig_events` / `automation_runs` — they are the audit trail. Soft-delete the account; keep history. | P1 |
| EC-1.1-05 | Automation deleted but `automation_runs` reference it | `ON DELETE SET NULL` plus a denormalised `automation_name` snapshot on the run, or the log becomes unreadable after a cleanup. | P1 |
| EC-1.1-06 | `provider_event_id` collides **across accounts** | Meta ids are generally globally unique, but do not bet the dedupe key on it. Make the unique constraint `(account_id, provider_event_id)`. | **P0** |
| EC-1.1-07 | `timestamp` used instead of `timestamptz` | Every window/cooldown calculation silently shifts. All time columns are `timestamptz`, all writes UTC. | **P0** |
| EC-1.1-08 | Duplicate tags in `contacts.tags text[]` | `add_tag` run twice appends twice. De-duplicate on write. | P2 |
| EC-1.1-09 | RLS policy written for `SELECT` only | `INSERT`/`UPDATE`/`DELETE` remain wide open. Every table needs all four, or explicit denial. | **P0** |
| EC-1.1-10 | Migration edited after being applied to prod | Forward-only. A new numbered file, never an edit. | P1 |

---

## M1.2 — Graph adapter, token vault, OAuth

| ID | Scenario | Expected behaviour / handling | Pri |
|---|---|---|---|
| EC-1.2-01 | User clicks **Cancel** on the OAuth screen | Callback receives `error=access_denied`. Redirect back to settings with a friendly message; do not 500. | P1 |
| EC-1.2-02 | User grants only **some** scopes | Meta lets users deselect permissions. Read the granted-scope list back and block connection if a required scope is missing, naming which one. | **P0** |
| EC-1.2-03 | Short-lived token obtained, **long-lived exchange fails** | Do not persist a half-connected account. Wrap the whole exchange; on failure store nothing and show a retry. | P1 |
| EC-1.2-04 | Reconnecting an already-connected account | Upsert on `(org_id, ig_user_id)` — never insert a duplicate account row with a fresh token while the old row keeps serving stale ones. | **P0** |
| EC-1.2-05 | Account already connected to a **different org** | Per the decision in EC-0-07. Whatever you choose, it must be explicit and logged. | **P0** |
| EC-1.2-06 | Token expires mid-job | The worker decrypts at execution time, not enqueue time. On `190` mark `needs_reauth`, pause the account's automations, and reschedule rather than dead-letter. | P1 |
| EC-1.2-07 | Error code `190` sub-codes (458 not authorized / 463 expired / 467 invalid) | Distinguish them: 463 → refresh; 458/467 → require reconnect. Treating all as "refresh" causes an infinite refresh loop. | P1 |
| EC-1.2-08 | User changes IG password, or revokes the app from Instagram settings | Token invalidated with no webhook to tell you. Handle the **deauthorize callback** if configured, and treat `190` as the real signal. | P1 |
| EC-1.2-09 | Refresh cron and a live request both refresh the same token | Two refreshes race; one token wins and the other row is stale. Refresh inside a row lock, or make refresh idempotent with an expiry check. | P1 |
| EC-1.2-10 | Refresh runs on a token already past expiry | Long-lived tokens generally cannot be refreshed after they lapse. Refresh **before** expiry (e.g. at 80% of lifetime), and surface `needs_reauth` if missed. | **P0** |
| EC-1.2-11 | `TOKEN_ENCRYPTION_KEY` rotated | All stored ciphertext becomes undecryptable. Store a key id alongside the ciphertext from day one, even with only one key. | P1 |
| EC-1.2-12 | Encrypted token leaks into a response | Never select the ciphertext column in app-side queries; use an explicit column list and a view for the client. Grep the built bundle in the exit check. | **P0** |
| EC-1.2-13 | Account subscribed to webhook fields fails silently after connect | Subscription is a separate API call from OAuth. Verify it succeeded and store `webhook_subscribed`; retry if false. | **P0** |
| EC-1.2-14 | One Meta user has **multiple IG accounts** | The picker must handle N accounts, and connecting one must not disturb the others. | P1 |

---

## M1.3 — Webhook receiver

| ID | Scenario | Expected behaviour / handling | Pri |
|---|---|---|---|
| EC-1.3-01 | Framework parses the body before you hash it | Signature is computed over the **raw** bytes. Re-serialising JSON changes whitespace/key order and breaks every signature. Read the body as text once, hash it, then parse. | **P0** |
| EC-1.3-02 | `X-Hub-Signature-256` header missing | `401`, nothing persisted. Do not fall back to the older `sha1` header. | **P0** |
| EC-1.3-03 | Header format `sha256=<hex>` | Strip the prefix before comparing. Compare with a constant-time function, not `===`. | **P0** |
| EC-1.3-04 | One POST contains **multiple `entry[]` / `changes[]`** | Meta batches. Iterate and persist each as its own event; one bad entry must not abort the others or cause a full retry of already-stored ones. | **P0** |
| EC-1.3-05 | Two concurrent deliveries of the same event | `ON CONFLICT DO NOTHING` and treat the conflict as success (`200`, enqueue nothing). Catching the unique violation as a 500 causes an infinite Meta retry loop. | **P0** |
| EC-1.3-06 | Message events have `mid`, comments have `id`, some events have neither stable id | Define the dedupe key per event type, with a deterministic composite fallback (`account + type + actor + timestamp + hash(payload)`). Never fall back to "no dedupe". | **P0** |
| EC-1.3-07 | DB unreachable | Return **non-2xx** so Meta retries. Returning `200` on a failed persist silently drops the event forever. This is the one case where a fast `200` is wrong. | **P0** |
| EC-1.3-08 | Event for an account we do not have, or a disconnected one | Persist it (audit) but do not enqueue. Never 500. | P1 |
| EC-1.3-09 | Unknown event type (reaction, seen, typing, message_deleted) | Store raw, mark unhandled, return `200`. An unrecognised field must never crash the handler. | **P0** |
| EC-1.3-10 | Very large payload (long comment, many entries) | Bound the raw JSONB size; truncate with a marker rather than failing the insert. | P2 |
| EC-1.3-11 | Handler exceeds the function timeout | Nothing after the `200` is guaranteed to run on serverless. Do not rely on post-response work — the cron drain is the contract (P1). | **P0** |
| EC-1.3-12 | Replay attack: attacker resends a captured valid payload | Signature is valid, so dedupe is your only defence — another reason the dedupe key must never be absent. | P1 |

---

## M1.4 — Normalizer

| ID | Scenario | Expected behaviour / handling | Pri |
|---|---|---|---|
| EC-1.4-01 | **Echo** message (the account's own outbound comes back) | Drop before matching. Missing this creates a bot replying to itself in a loop. | **P0** |
| EC-1.4-02 | Comment authored by the connected account itself | Self-comment filter (architecture §2.1 step 9), including replies posted by your own automation. | **P0** |
| EC-1.4-03 | Reply to a comment (nested) | `parentCommentId` set. Decide whether nested replies trigger rules at all — default no, or two bots ping-pong. | **P0** |
| EC-1.4-04 | DM with **attachment only**, no text | `text` is `undefined`. Everything downstream must tolerate it (see EC-1.5-03). | **P0** |
| EC-1.4-05 | Story reply arriving as a message with a story reference | In Phase 1 it must be classified and **ignored**, not mis-normalised as a plain DM that then triggers DM rules. | P1 |
| EC-1.4-06 | Unsupported types: share, sticker, voice, video note, unsend | Normalise to a known type with no text; never throw. | P1 |
| EC-1.4-07 | Comment deleted between delivery and processing | Normalisation succeeds; the *action* fails later (EC-1.7-01). Do not try to re-fetch here. | P2 |
| EC-1.4-08 | Emoji-only or sticker-only comment | Valid input; `text` is the emoji. Must survive matching. | P1 |
| EC-1.4-09 | Unicode normalisation forms (NFC vs NFD), zero-width joiners, RTL marks | Normalise text to NFC and strip zero-width characters **once, here** — not scattered through the matcher. Users paste these accidentally; spammers use them deliberately. | P1 |
| EC-1.4-10 | Fixtures hand-written rather than captured | Hand-written fixtures encode your assumptions, not Meta's behaviour. Capture real payloads in Phase 0. | **P0** |
| EC-1.4-11 | Timestamps in seconds vs milliseconds | Meta mixes units across fields. Normalise to ISO once; a ×1000 error puts every event in 1970 and breaks the 24h window. | **P0** |

---

## M1.5 — Matcher

| ID | Scenario | Expected behaviour / handling | Pri |
|---|---|---|---|
| EC-1.5-01 | **Empty `keywords[]`** | Must match **nothing**. The natural `every()`/`some()` slip makes it match *everything* and DMs your entire audience. Test this first. | **P0** |
| EC-1.5-02 | Keyword is an empty string or whitespace after trim | Discard at validation *and* defend in the matcher. `''.includes()` is always true. | **P0** |
| EC-1.5-03 | Event has no `text` (attachment-only DM) | Return no matches; never call string methods on `undefined`. | **P0** |
| EC-1.5-04 | `contains` false positives — "price" inside "priceless" | Document the intended semantics and test them. If word-boundary matching is wanted, it is a distinct `matchMode`, not a silent change to `contains`. | P1 |
| EC-1.5-05 | Case folding beyond ASCII (Turkish dotless ı, German ß, Greek final sigma) | Use `toLocaleLowerCase()` deliberately or normalise case once; know which behaviour you shipped. | P2 |
| EC-1.5-06 | Two rules with the **same `priority`** | Ordering becomes DB-order-dependent and therefore flaky. Tiebreak deterministically (`priority`, then `created_at`, then `id`). | **P0** |
| EC-1.5-07 | `stopOnMatch` interacting with priority | First match by sorted order wins and halts. Write the test that proves rule 2 does *not* run. | P1 |
| EC-1.5-08 | Comment rule with `scope.type='media'` and **empty `mediaIds`** | Match nothing (consistent with EC-1.5-01), not everything. | **P0** |
| EC-1.5-09 | Postback event matched against text keywords | Postbacks match on `payload`, exactly and case-sensitively. Never fuzzy-match a payload. | **P0** |
| EC-1.5-10 | Matcher imports the Graph client or Supabase | Review-blocking defect (P3). The module must be pure; enforce with a lint rule if possible. | **P0** |
| EC-1.5-11 | Rule disabled or edited after the event was queued | Decide explicitly: evaluate against the rule as of **execution** time (simpler, surprising) or as of **event** time (snapshot in the job payload). Document it; users will notice. | **P0** |
| EC-1.5-12 | Hundreds of rules on one account | Sort/filter once per event, not per keyword. Cheap now, prevents a rewrite later. | P2 |
| EC-1.5-13 | Keyword containing regex metacharacters | Phase 1 is literal matching only — never pass user keywords to `RegExp`. If regex is added later it needs sandboxing and a ReDoS guard. | **P0** |

---

## M1.6 — Queue, worker, cron

| ID | Scenario | Expected behaviour / handling | Pri |
|---|---|---|---|
| EC-1.6-01 | Two cron invocations overlap | `FOR UPDATE SKIP LOCKED` is the guarantee. Prove it with two concurrent drainers in a test (plan M1.6 exit). | **P0** |
| EC-1.6-02 | Worker crashes or times out holding a lock | Rows stay `locked_at` forever and the queue silently stalls. Reclaim locks older than N minutes on every drain. | **P0** |
| EC-1.6-03 | Job for a deleted account/org | Terminate the job as `skipped`, not `failed` — dead-letters should mean real problems. | P1 |
| EC-1.6-04 | Retry storm on a systemic outage | Backoff plus a per-account circuit breaker: after N consecutive failures pause and alert instead of burning the rate budget. | P1 |
| EC-1.6-05 | Job succeeds but the status write fails | The job re-runs. This is exactly why per-action `sent` state exists (EC-1.7-05). At-least-once delivery is the model — design for it, do not pretend otherwise. | **P0** |
| EC-1.6-06 | Vercel cron granularity is coarser than planned | See EC-0-19. Latency budget ("~5s" in success criterion 2) depends on drain frequency; if cron is 1-minute, that criterion needs a post-response drain trigger as well. | **P0** |
| EC-1.6-07 | Batch of 25 exceeds the function time limit | Track elapsed time inside the loop and return early, leaving the rest queued. Never let a batch straddle a timeout. | P1 |
| EC-1.6-08 | Ordering — DM reply sent before the comment reply | Best-effort ordering per account by `occurred_at` is fine for keyword replies, but do not promise strict ordering in the UI. | P2 |
| EC-1.6-09 | `run_after` set with local time | See EC-1.1-07. UTC everywhere. | P1 |
| EC-1.6-10 | Dead-lettered jobs invisible | Surface the count in the dashboard (M1.11). A silent dead-letter queue is the same as data loss. | **P0** |

---

## M1.7 — Action registry

| ID | Scenario | Expected behaviour / handling | Pri |
|---|---|---|---|
| EC-1.7-01 | Comment deleted before the reply posts | Graph returns an object-not-found error. Classify as **non-retryable**; mark skipped, not failed. | P1 |
| EC-1.7-02 | Commenter blocked the business, deleted their account, or has DMs restricted | Send fails permanently. Non-retryable; record the reason so the runs viewer explains it. | P1 |
| EC-1.7-03 | Bot replies to its own reply | Combination of EC-1.4-01/02 plus the `ig_comments.replied_at` guard. Verify by pointing a rule at a keyword your own reply text contains — the nastiest version of this bug. | **P0** |
| EC-1.7-04 | Identical reply text posted many times | Instagram flags repetitive replies as spam. Rotate `templates[]`; with a single template, add jitter or accept the risk knowingly. | P1 |
| EC-1.7-05 | Retry after a **partial** fan-out (comment reply sent, DM failed) | Re-run only actions not already `sent`. Without per-action state the user gets duplicate public replies. | **P0** |
| EC-1.7-06 | Comment→DM uses the wrong endpoint | A private reply to a comment and a standard DM are **different endpoints with different windows** (private replies to comments have their own, longer allowance). Getting this wrong makes comment→DM fail for anyone who never DMed you. **Verify against current Meta docs.** | **P0** |
| EC-1.7-07 | Quick-reply limits (count and title length) exceeded | Validate at rule-save time (M1.9) *and* before send. Meta rejects the whole message otherwise. **Verify current limits.** | P1 |
| EC-1.7-08 | Message text over the length limit | Truncate with an ellipsis or reject at save time — do not let the API reject it at send time. | P1 |
| EC-1.7-09 | Rate limit hit mid-fan-out (`4`, `613`, `80007`) | Retryable. Re-schedule the remaining actions; do not mark the run failed. | **P0** |
| EC-1.7-10 | Recipient opted out between match and send | Re-check policy immediately before the API call, not only at match time. | P1 |
| EC-1.7-11 | Two rules both send a DM to the same person for one event | Per-actor de-duplication within a single event's action set, or the user gets two DMs a second apart. | P1 |
| EC-1.7-12 | Action config from the DB has a shape the code no longer expects | Run `validate(config)` before `execute`; a malformed JSONB row must skip that action with a clear error, not crash the drainer for every tenant. | **P0** |

---

## M1.8 — Policy gate

| ID | Scenario | Expected behaviour / handling | Pri |
|---|---|---|---|
| EC-1.8-01 | `last_inbound_at` is `null` (never messaged us) | Standard DM must be blocked. The comment→DM path is the exception (EC-1.7-06) — encode the difference explicitly. | **P0** |
| EC-1.8-02 | Event sits in the queue and the window closes before execution | Check the window at **execution**, not at match. A backlog must not produce out-of-window sends. | **P0** |
| EC-1.8-03 | Exactly on the 24h boundary, plus clock skew | Use one server-side clock and a small safety margin (e.g. block at 23h55m). Never trust an event's own timestamp for this. | **P0** |
| EC-1.8-04 | Humanized delay (Phase 3) pushes a send past the window | The delay must be clamped so the send always lands inside the window. | **P0** |
| EC-1.8-05 | Daily cap "day" boundary | In whose timezone? Pick UTC and say so in the UI, or caps reset at a time users find arbitrary. | P1 |
| EC-1.8-06 | Rate-budget window rollover loses in-flight counts | Increment atomically in SQL, not read-modify-write in JS. | P1 |
| EC-1.8-07 | Opt-out keyword ("STOP") | Decide whether Phase 1 honours a keyword opt-out or only an explicit UI flag. Whichever — the check lives in the policy gate, not in an action. | P1 |
| EC-1.8-08 | Policy check performed *after* the Graph call | Violates P5 outright. The exit test asserts a mocked client's call count is **zero**. | **P0** |
| EC-1.8-09 | Human took over the thread (M1.10) while a job was queued | `human_handled` is re-checked at execution. Otherwise the bot talks over a live agent. | **P0** |

---

## M1.9 — Automations UI

| ID | Scenario | Expected behaviour / handling | Pri |
|---|---|---|---|
| EC-1.9-01 | User creates a rule with a one-letter keyword ("a") | Warn loudly before save — this matches nearly every comment and will burn the rate budget. | P1 |
| EC-1.9-02 | Two rules with overlapping keywords | Show which one wins given priority/`stopOnMatch`. The rule-tester box is the fix. | P1 |
| EC-1.9-03 | UI validation diverges from the executor's `validate()` | Share the exact same validator module both sides. Two copies drift within a month. | **P0** |
| EC-1.9-04 | Rule edited while jobs referencing it are queued | Per EC-1.5-11. Whatever you chose, the UI should say it ("changes apply to new events"). | P1 |
| EC-1.9-05 | Rule deleted with jobs in flight | Job must skip cleanly, not crash the drainer. | P1 |
| EC-1.9-06 | Media picker: posts deleted, archived, or beyond the first page | Handle pagination and stale media ids; a scoped rule pointing at a deleted post should surface as a warning, not fail silently. | P1 |
| EC-1.9-07 | Two team members edit the same rule simultaneously | Last-write-wins silently overwrites. At minimum, detect via `updated_at` and warn. | P2 |
| EC-1.9-08 | Very long template text, or emoji/newlines in templates | Preview should reflect what actually sends, including newline handling. | P2 |
| EC-1.9-09 | User enables a rule before connecting an account | Block with an explanatory state rather than creating rules that can never fire. | P1 |

---

## M1.10 — Inbox

| ID | Scenario | Expected behaviour / handling | Pri |
|---|---|---|---|
| EC-1.10-01 | Realtime connection drops and reconnects | Messages arriving during the gap never render. Refetch the thread on reconnect; do not rely on the socket alone. | **P0** |
| EC-1.10-02 | Agent takes over exactly as an automation job executes | See EC-1.8-09. The flag must be checked at send time, and the UI should show that a bot message was already in flight. | **P0** |
| EC-1.10-03 | Thread with thousands of messages | Paginate/virtualise. Loading all of them freezes the tab. | P1 |
| EC-1.10-04 | Optimistic send fails | Show the message as failed with a retry, never silently drop it from the UI. | P1 |
| EC-1.10-05 | Unread counts drift from reality | Derive from data rather than incrementing a counter in two places. | P2 |
| EC-1.10-06 | Message content rendered as HTML | User-supplied DM text must be escaped. An `<img onerror>` in a DM is a stored XSS against your own agents. | **P0** |
| EC-1.10-07 | Media attachment URLs from Meta expire | Proxy and/or cache; a broken image an hour later looks like data loss. | P1 |

---

## M1.11 — Dashboard & runs viewer

| ID | Scenario | Expected behaviour / handling | Pri |
|---|---|---|---|
| EC-1.11-01 | Job retried → counters incremented twice | Increment in the same transaction as the *terminal* outcome, keyed on the action, not once per attempt. | **P0** |
| EC-1.11-02 | "Today" computed in the browser's timezone but data stored UTC | Pick one and label it in the UI. | P1 |
| EC-1.11-03 | Run row exists but its automation was deleted | Show the snapshot name (EC-1.1-05), not "unknown". | P1 |
| EC-1.11-04 | Runs table grows unbounded | Plan retention (e.g. 90 days) and an index for the default filter before it is a million rows. | P1 |
| EC-1.11-05 | A skipped action shows as a failure | `skipped` (policy) and `failed` (error) are different states with different user meanings. Never collapse them. | P1 |
| EC-1.11-06 | User asks "why didn't my automation fire?" and the answer is "no matching rule" | Log **non-matches** too, at least in a sampled/short-retention form. Otherwise the most common support question has no evidence trail. | P1 |

---

## M1.12 — Hardening

| ID | Scenario | Expected behaviour / handling | Pri |
|---|---|---|---|
| EC-1.12-01 | CSP blocks Instagram CDN images or the Supabase realtime socket | Test the enforced CSP in production, not report-only. | P1 |
| EC-1.12-02 | 200 comments in 60s (viral post) | Load-test target from the plan. Watch: drain backlog depth, rate-budget behaviour, DB connection exhaustion. | **P0** |
| EC-1.12-03 | Supabase connection limits exhausted by concurrent function invocations | Pooling configured correctly (EC-0-17); cap drain concurrency. | **P0** |
| EC-1.12-04 | `needs_reauth` account with active rules | The UI must scream about it — silently-not-working automation is the worst possible failure mode for retention. | **P0** |
| EC-1.12-05 | Fresh clone by a self-hoster missing a migration or env var | The README quickstart is itself a test. Run it on a clean machine before calling M1.12 done. | P1 |
| EC-1.12-06 | Error boundaries absent — one widget crash blanks the dashboard | Per-section boundaries. | P1 |
