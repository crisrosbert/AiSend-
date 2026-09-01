# Edge Cases — Phase 0: Foundations

> Milestones 0.1–0.7 in [`../implementationPlan.md`](../implementationPlan.md) §2.
> Nothing here is your code's fault — which is exactly why these cost whole
> days when hit in week 6 instead of week 1.

## Account & app setup

| ID | Scenario | Expected behaviour / handling | Pri |
|---|---|---|---|
| EC-0-01 | User connects a **Personal** Instagram account | The API returns no business account. Detect at OAuth and show "Convert to Business or Creator in the Instagram app, then reconnect" — not a raw API error. | P1 |
| EC-0-02 | Creator account (not Business) | Supported for messaging, but confirm each scope's behaviour — some comment/insights capabilities differ. **Verify against current Meta docs.** | P1 |
| EC-0-03 | IG account not linked to a Facebook Page | Instagram Login (as opposed to Facebook Login) does not require a Page, but some endpoints historically did. Test explicitly with an unlinked account. | P1 |
| EC-0-04 | App still in **Development mode** | Webhooks fire only for users with a role on the app (admin/developer/tester). A "nothing is arriving" bug that is not a bug. Document it in the README. | P0 |
| EC-0-05 | Test account not added as a tester, or invite not accepted | Same silent no-events symptom as above. Add a connection-status check that says which one is wrong. | P1 |
| EC-0-06 | Business verification incomplete | Blocks App Review submission, not development. Start it week 1 (plan §1 Track B). | P0 |
| EC-0-07 | Two people connect the **same IG account** to two different orgs | Decide now: first-wins, or move-and-notify. Undefined behaviour here becomes a data-integrity bug in M1.2. | P0 |

## Webhook handshake

| ID | Scenario | Expected behaviour / handling | Pri |
|---|---|---|---|
| EC-0-08 | `GET` verify: `hub.mode` is not `subscribe` | Return `403`, do not echo the challenge. | P1 |
| EC-0-09 | `GET` verify: token mismatch | Return `403`. Never echo the challenge on a failed compare. | P0 |
| EC-0-10 | Challenge echoed as JSON instead of **plain text** | Meta rejects the subscription. Return the raw `hub.challenge` string with no quotes, no JSON wrapper. Classic 2-hour bug. | P0 |
| EC-0-11 | Callback URL is a **Vercel preview** deployment | Preview URLs change per commit; Meta holds one URL. Point the subscription at the production domain only, and never at a `*.vercel.app` preview. | P1 |
| EC-0-12 | Callback behind auth (Vercel password protection / middleware redirect) | Meta gets a `302`/`401` and the subscription fails. **Exclude `/api/instagram/webhook` from middleware auth explicitly** — the app's own `middleware.ts` redirecting unauthenticated requests to `/login` is the single most common cause. | P0 |
| EC-0-13 | Self-signed or invalid TLS cert (custom domain mid-propagation) | Meta requires valid HTTPS. Verify the cert before subscribing. | P1 |
| EC-0-14 | Webhook subscribed at the **app** level but not per-account | Both are required: app-level field subscriptions **and** subscribing each connected account. Missing the second gives "verified but no events". | P0 |

## Environment & deployment

| ID | Scenario | Expected behaviour / handling | Pri |
|---|---|---|---|
| EC-0-15 | Env var present locally, missing on Vercel | Fail fast at boot with a named error listing the missing vars, rather than `undefined` reaching the Graph API. Validate the §9 env surface in one module. | P1 |
| EC-0-16 | `NEXT_PUBLIC_*` used for a secret | Anything `NEXT_PUBLIC_` ships to the browser. Assert at build time that the service-role key and app secret are **not** prefixed. | P0 |
| EC-0-17 | Supabase pooled vs direct connection string | Transaction-mode poolers break `FOR UPDATE SKIP LOCKED` sessions and prepared statements. Choose the right one for the worker (M1.6) and document which. | P0 |
| EC-0-18 | `INSTAGRAM_REDIRECT_URI` differs by one character from the Meta app config (trailing slash) | OAuth fails with an opaque error. Derive it from `APP_URL` in one place. | P1 |
| EC-0-19 | Vercel **Hobby** plan cron limits | Hobby crons are heavily restricted (daily granularity); the plan's `*/1 * * * *` drain needs Pro. Budget for it or use an external pinger. **Verify current Vercel limits.** | P0 |
| EC-0-20 | Clock/timezone of the deployment | Everything must be UTC end to end. One local-time assumption breaks the 24h window (M1.8). | P1 |

## Exit-criterion traps

| ID | Scenario | Expected behaviour / handling | Pri |
|---|---|---|---|
| EC-0-21 | "Webhook works" concluded from the Meta console's **Test** button | The test button sends a synthetic payload with fake IDs and does not prove real delivery. The Phase 0 exit gate requires a **real comment from a real account**. | P0 |
| EC-0-22 | Real event arrives but nothing is logged | Vercel function logs drop fast and `console.log` in an edge runtime may not surface. Persist raw events to a table from day one. | P1 |
