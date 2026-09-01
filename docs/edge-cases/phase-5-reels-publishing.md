# Edge Cases — Phase 5: Reels Publish / Schedule

> `implementationPlan.md` §4, Phase 5 · new action kind + scheduled job type,
> reusing the M1.6 queue. Requires the `instagram_business_content_publish`
> scope and therefore **a second App Review**.

## Container lifecycle

| ID | Scenario | Expected behaviour / handling | Pri |
|---|---|---|---|
| EC-5-01 | Container status is `IN_PROGRESS` when you try to publish | Publishing is a two-step create-then-publish with an async encode in between. Poll status with backoff; never publish blind. | **P0** |
| EC-5-02 | Container status `ERROR` or `EXPIRED` | Containers expire (historically ~24h). Surface the real reason; do not retry an expired container — create a new one. | **P0** |
| EC-5-03 | Publish call retried after it already succeeded | Duplicate public post — the most embarrassing possible bug. Idempotency key on the publish action plus a `published_media_id` check before retrying. | **P0** |
| EC-5-04 | Video fails Instagram's spec (duration, aspect ratio, codec, size) | Validate client-side before upload and map API errors to human text. **Verify current specs.** | P1 |
| EC-5-05 | Media URL must be publicly reachable for Meta to fetch | Supabase Storage objects behind RLS will 403 for Meta. Use signed URLs valid long enough for the encode. | **P0** |

## Scheduling

| ID | Scenario | Expected behaviour / handling | Pri |
|---|---|---|---|
| EC-5-06 | Scheduled time already in the past (timezone bug or a paused queue) | Publish immediately, or skip with a clear reason — decide, never guess. | P1 |
| EC-5-07 | User's local timezone vs stored UTC, across a DST change | Store UTC plus the originating timezone; a post scheduled for "9am" must stay 9am local across DST. | **P0** |
| EC-5-08 | Daily publishing rate limit reached | Queue and inform, do not fail silently. **Verify the current per-account limit.** | P1 |
| EC-5-09 | Audio/copyright block, or a shadow-restricted post | The API may report success while the post is restricted. Read back after publishing. | P1 |
| EC-5-10 | Account disconnected between schedule and publish | Skip with a notification; never dead-letter a customer's scheduled content without telling them. | **P0** |
| EC-5-11 | Scope not yet granted (App Review pending) | Feature must be hidden or clearly gated, not fail at publish time. | P1 |

> **Product note:** this phase edges into the Nuelink category that
> `problemStatement.md` §6 declares a non-goal. Build it only against real
> customer demand.
