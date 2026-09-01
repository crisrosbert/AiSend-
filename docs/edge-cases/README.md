# Edge Cases — Index

> **Companion to:** [`../implementationPlan.md`](../implementationPlan.md) ·
> [`../architecture.md`](../architecture.md)
> **Purpose:** the list you keep open **while coding a milestone**, so the
> nasty cases get handled during implementation instead of being discovered
> by a customer.

## How to use this

Every case has a stable ID: `EC-<milestone>-<n>` (e.g. `EC-1.5-07`).

1. Before starting a milestone, read its edge-case file end to end.
2. While coding, handle each case **or** consciously defer it — a deferred
   case gets a `// EC-x.y-nn: deferred because …` comment in the code, never
   silence.
3. Before the milestone's exit criteria, walk the table again. Anything
   marked **P0** must have a test.

## Priority key

| | Meaning |
|---|---|
| **P0** | Silent data loss, cross-tenant leak, duplicate sends, or policy violation. Ship-blocking. Needs an automated test. |
| **P1** | User-visible breakage or support ticket generator. Fix in the milestone. |
| **P2** | Rough edge. Log it, handle it cheaply, revisit later. |

## Files

| Phase | File | Covers |
|---|---|---|
| 0 | [`phase-0-foundations.md`](./phase-0-foundations.md) | Meta app, OAuth prerequisites, webhook handshake, deploy |
| 1 | [`phase-1-comment-dm-automation.md`](./phase-1-comment-dm-automation.md) | M1.1–M1.12 — the whole Phase 1 build |
| 2 | [`phase-2-story-automation.md`](./phase-2-story-automation.md) | Story replies, mentions, reactions |
| 3 | [`phase-3-ai-fallback.md`](./phase-3-ai-fallback.md) | LLM fallback replies |
| 4 | [`phase-4-ice-breakers.md`](./phase-4-ice-breakers.md) | Ice Breaker profile sync |
| 5 | [`phase-5-reels-publishing.md`](./phase-5-reels-publishing.md) | Reels containers, scheduling |
| 6 | [`phase-6-flow-builder.md`](./phase-6-flow-builder.md) | Graph execution, waits, versioning |
| — | [`cross-cutting.md`](./cross-cutting.md) | Security, tenancy, time, i18n — applies to every phase |

## Standing rule

Anything in these files marked **"verify against current Meta docs"** is a
behaviour that Meta has changed before and may change again. Do not encode it
from memory or from this document — check the live API reference at
implementation time, and pin the version (`P6`).
