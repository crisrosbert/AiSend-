# Edge Cases — Cross-Cutting

> Applies to **every** phase. Re-read before any milestone that touches
> tenancy, time, money, or user-supplied text.

## Multi-tenancy & security

| ID | Scenario | Expected behaviour / handling | Pri |
|---|---|---|---|
| EC-X-01 | Service-role query missing an `org_id` filter | Cross-tenant read or, worse, a DM sent from the wrong business. Route all worker DB access through one scoped module. | **P0** |
| EC-X-02 | An id from the URL trusted without an ownership check | `/automations/:id` must verify the row belongs to the caller's org even with RLS on — the API route may run server-side with elevated rights. | **P0** |
| EC-X-03 | User-supplied text rendered without escaping | Stored XSS via DM/comment content, aimed at your own agents (EC-1.10-06). | **P0** |
| EC-X-04 | Secrets in logs or error messages | Tokens, app secret, service-role key. Redact centrally in the logger, not at each call site. | **P0** |
| EC-X-05 | Webhook or drain endpoint reachable without auth | Drain requires the shared secret; webhook requires a valid signature. Neither may be exempted "temporarily for debugging". | **P0** |
| EC-X-06 | Any future feature fetching a user-supplied URL | SSRF into cloud metadata endpoints. Allowlist schemes and block private ranges. | **P0** |

## Time

| ID | Scenario | Expected behaviour / handling | Pri |
|---|---|---|---|
| EC-X-07 | Mixed local/UTC time anywhere | Every stored timestamp is `timestamptz` in UTC; convert only at render. | **P0** |
| EC-X-08 | Meta timestamps in seconds vs milliseconds | Normalise once in the normalizer (EC-1.4-11). | **P0** |
| EC-X-09 | DST transition | Affects scheduling (EC-5-07) and any "daily" cap boundary. | P1 |

## Data & text

| ID | Scenario | Expected behaviour / handling | Pri |
|---|---|---|---|
| EC-X-10 | Emoji counted as one character by JS `.length` | Surrogate pairs break length limits and truncation. Use grapheme-aware handling anywhere a limit is enforced. | P1 |
| EC-X-11 | RTL text, zero-width characters, unicode confusables | Normalise in the normalizer (EC-1.4-09); confusables are how keyword filters get evaded. | P1 |
| EC-X-12 | Hinglish / transliterated keywords | Users will type "kitna", "kitnaa", "kitne". Multi-keyword any-of exists for this — say so in the UI copy. | P1 |
| EC-X-13 | Null vs empty string vs whitespace | Decide once, defend everywhere (EC-1.5-02). | P1 |

## Operational

| ID | Scenario | Expected behaviour / handling | Pri |
|---|---|---|---|
| EC-X-14 | Meta ships a breaking API version | One adapter, pinned version (P6). Subscribe to Meta's changelog; a version sunset is a scheduled outage you were told about. | **P0** |
| EC-X-15 | Meta policy change removes a capability | Have the self-host/agency-licence fallback in mind (plan §6 risk register). | P1 |
| EC-X-16 | At-least-once delivery treated as exactly-once | The whole system is at-least-once. Every side effect needs an idempotency story: EC-1.3-05, EC-1.6-05, EC-1.7-05, EC-3-13, EC-5-03. | **P0** |
| EC-X-17 | Silent failure anywhere | Every skip, failure, and dead-letter must be visible in the runs viewer. A 2-person team cannot debug what it cannot see — this is the operational thesis of the whole design. | **P0** |
