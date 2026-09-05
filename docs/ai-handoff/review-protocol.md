# Review Protocol — what to bring back, and what gets checked

> Step 3–5 of the loop in [`README.md`](./README.md). This is where the
> "monitoring" actually happens: on the work product, not on the tool.

---

## 1. What to bring for review

**Best (once GitHub access works):** the branch or PR link. The reviewer reads
the diff directly, can run the tests, and can check files ChatGPT didn't
mention — which is where the interesting problems usually are.

**Fallback:** paste the diff plus ChatGPT's own report (the four-part output
format from `master-context.md`). Note the weakness — a reviewer can only judge
what you pasted, and the most common ChatGPT failure is a file it changed
without mentioning.

**Always include ChatGPT's claims**, specifically:
- which edge-case IDs it says it handled
- which Exit criteria it says pass, and how it verified them
- anything it flagged as uncertain

Claims are the useful part. Verifying a specific claim is much faster than
re-deriving the whole milestone, and a false claim is itself a finding.

---

## 2. What the review checks, every time

### Tier 1 — invariants (automatic fail)

| Check | Why |
|---|---|
| Does `matcher.ts` import Supabase, the Graph client, or `fetch`? | Invariant 3 (P3). Kills testability, and it always creeps back |
| Does the webhook handler contain matching, sending, or Graph calls? | Invariant 1 (P1) |
| Are Graph URLs or the API version outside `graph-client.ts`? | Invariant 6 (P6) |
| Any worker query without an `org_id` filter? | Service-role bypasses RLS — cross-tenant send (EC-1.1-02) |
| Is the HMAC computed over re-serialised JSON? | Every signature breaks (EC-1.3-01) |
| Any secret in a `NEXT_PUBLIC_*` var? | Ships to the browser (EC-0-16) |
| Any side effect without an idempotency guard? | At-least-once system (EC-X-16) |

### Tier 2 — the milestone's P0 edge cases

Each P0 in that milestone's edge-case file: handled, or explicitly deferred
with a reason. "Not mentioned" counts as not handled — it usually means the
case never crossed ChatGPT's mind.

### Tier 3 — exit criteria

For each criterion ChatGPT claims passes: is there a test, an output, or a
reproducible check behind the claim? A criterion asserted without evidence is
treated as unverified, not as passing.

### Tier 4 — ordinary code review

Correctness, error handling, types, and whether the code matches the
surrounding conventions of the repo.

---

## 3. What comes back to you

A pass/fail list, ordered most-severe first, in a form you can paste straight
into ChatGPT's fix-loop prompt:

```
FAIL  EC-1.5-01  matcher.ts:34 — empty keywords[] returns every rule as a
      match. `keywords.every()` on an empty array is true. Would DM the
      entire audience.

FAIL  Invariant 3  matcher.ts:8 — imports createClient from
      @/lib/supabase/server. The matcher must be pure.

PASS  EC-1.5-06  deterministic tiebreak present and tested.

UNVERIFIED  Exit criterion 4 — claimed passing, no test shown.
```

---

## 4. Merge gate

A milestone merges when:

1. Zero Tier-1 failures.
2. Every P0 in that milestone's edge-case file is handled or consciously
   deferred (deferrals recorded in the code as `// EC-x.y-nn: deferred
   because …`).
3. Every Exit criterion is verified, with evidence.
4. Typecheck, lint and tests pass in CI, not just in ChatGPT's sandbox.

---

## 5. Known ChatGPT failure modes on this specific project

Watch for these — they recur, and none of them look wrong at a glance:

| Failure mode | Where it shows up |
|---|---|
| **Confident invention of Meta API details** — endpoints, windows, limits | Worst at M1.7 (`EC-1.7-06`, private reply vs DM). Anything marked "verify against current Meta docs" must be checked live, never accepted from the model |
| **Architectural drift across sessions** | By M1.7 it has forgotten M1.5's purity rule. This is why `AGENTS.md` in the repo matters more than the chat context |
| **Optimistic exit-criteria claims** | "Idempotency handled" with no concurrent test. Tier 3 exists for this |
| **Silently widening scope** | Adds an AI reply or a story trigger because it seemed natural. Phase gates exist for a reason |
| **Happy-path-only error handling** | Retryable vs non-retryable Graph errors collapsed into one `catch` |
| **Next.js version drift** | Writes Next 13/14 App Router patterns from training data. Hence the `node_modules/next/dist/docs/` instruction |
| **Editing an applied migration** | Instead of adding a new numbered one |
| **Tests that assert the implementation** | Rewritten to match whatever the code does, rather than the spec |

---

## 6. Cadence

Review **every milestone**, not every few. Twelve small reviews catch drift;
three big ones catch it after it has been built on. The single most expensive
thing you can do is let M1.5's matcher ship impure and discover it at M1.9,
when four modules depend on the shape it grew.
