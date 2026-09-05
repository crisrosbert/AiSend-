# AI Handoff — Building Phase 1 with ChatGPT, reviewed by Claude

> **Companion to:** [`../implementationPlan.md`](../implementationPlan.md) ·
> [`../edge-cases/`](../edge-cases/)
> **Purpose:** the exact operating procedure for having ChatGPT write the
> Phase 1 code while a reviewer (Claude, or a human) checks every milestone
> against the specs already written.

---

## 1. What each side can and cannot do

**Read this before setting anything up.** Getting the roles wrong is the
difference between a useful loop and a pile of plausible code nobody verified.

| | Can | Cannot |
|---|---|---|
| **ChatGPT (Codex / Projects)** | Write code, run it in its own sandbox, open PRs against a connected GitHub repo | Know what it got wrong; remember your architecture between sessions unless you re-supply it |
| **Claude (this session)** | Read a diff/branch/pasted code and review it against these docs; run tests in this container; write follow-up specs | **Log into your ChatGPT account, see its conversations, or watch it work.** No such connector exists |
| **You** | Move artifacts between the two, make product calls | Skip the review step and still get a working system |

**The monitoring is of the *work product*, not the *tool*.** ChatGPT produces a
branch or a diff; that is the artifact I review. There is no live feed.

---

## 2. The loop

```
      ┌──────────────────────────────────────────────────────┐
      │  ONE MILESTONE AT A TIME (M1.1 … M1.12)              │
      └──────────────────────────────────────────────────────┘

 1. YOU     paste the milestone prompt from milestone-prompts.md
            into ChatGPT (docs already uploaded to the Project)
 2. CHATGPT writes the code, runs its own tests, opens a PR /
            gives you a diff
 3. YOU     bring it here: PR link (once GitHub access works) or
            pasted diff
 4. CLAUDE  reviews against architecture.md + the milestone's
            edge-case IDs; returns a pass/fail list
 5. YOU     paste the failures back into ChatGPT as a fix prompt
 6. repeat 3–5 until the milestone's Exit criteria pass
 7. merge, move to the next milestone
```

**Never run two milestones in parallel with ChatGPT.** It loses architectural
consistency across sessions faster than you will notice, and M1.5's purity
rule (P3) is exactly the sort of thing that quietly dies in session three.

---

## 3. One-time setup (~30 minutes)

### 3.1 Create a ChatGPT Project

Put all four doc sets in the Project's files so every chat in it starts with
the same context:

- `problemStatement.md`
- `architecture.md`
- `implementationPlan.md`
- `edge-cases/` — at minimum the phase file for what you are building, plus
  `cross-cutting.md`

Set the Project's custom instructions to the contents of
[`master-context.md`](./master-context.md).

### 3.2 Connect the repo

Use ChatGPT's Codex / GitHub connection against the **fork**, on a branch per
milestone (`feat/m1-1-schema`). Never let it work on `main`.

### 3.3 Add an `AGENTS.md` to the fork

Codex reads `AGENTS.md` from the repo root automatically — this is the highest-
leverage 10 minutes in the whole setup, because it survives every new session
without you pasting anything. Put the non-negotiables there:

```markdown
# Agent rules for this repository

## Architecture invariants — never violate
- The webhook handler does no business logic: verify → persist → enqueue → 200.
- `src/lib/automation/matcher.ts` is pure. It must not import Supabase, the
  Graph client, or anything with I/O.
- Only `src/lib/instagram/graph-client.ts` may contain Graph API URLs or the
  API version.
- Policy (24h window, opt-out, caps) is checked BEFORE any Graph API call.
- Every tenant table is RLS-protected; worker queries must filter by org_id
  explicitly because the service-role key bypasses RLS.
- The system is at-least-once. Every side effect needs an idempotency guard.

## Before writing any route handler
Read the relevant guide in `node_modules/next/dist/docs/`. This is Next.js 16;
App Router conventions differ from older versions.

## Definition of done
Typecheck + lint + unit tests pass. New migration applies on a clean DB.
No secret in a `NEXT_PUBLIC_*` var.
```

### 3.4 Fix GitHub access

Without it, step 3 of the loop is copy-paste of large diffs, which is slow and
lossy. Install the Claude GitHub App on the repo so reviews can read branches
directly.

---

## 4. Files here

| File | Use |
|---|---|
| [`master-context.md`](./master-context.md) | Paste once as ChatGPT Project instructions |
| [`milestone-prompts.md`](./milestone-prompts.md) | 12 copy-paste prompts, one per Phase 1 milestone |
| [`review-protocol.md`](./review-protocol.md) | What to bring back for review, and what gets checked |

---

## 5. The honest caveat

ChatGPT will produce code that looks right and passes its own tests while
violating an invariant that only shows up under load or across tenants —
`EC-1.1-02` (service-role bypassing RLS) and `EC-1.5-01` (empty keywords
matching everything) are both exactly this shape: clean-looking code,
catastrophic behaviour.

That is what the review step is for. **If you skip step 4 to move faster, you
are not moving faster** — you are moving the bug to production, where a
2-person team pays for it in support load.
