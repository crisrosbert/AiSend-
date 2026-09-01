# Edge Cases — Phase 2: Story Automation

> `implementationPlan.md` §4, Phase 2 · adds `triggers/story-reply.ts`,
> `triggers/mention.ts` and one webhook field subscription.

| ID | Scenario | Expected behaviour / handling | Pri |
|---|---|---|---|
| EC-2-01 | Story **expires (24h)** before the job runs | The referenced media is gone; any reply that quotes story content must degrade gracefully. Never fail the whole run because the story 404s. | **P0** |
| EC-2-02 | Story reply vs story **mention** vs comment-on-story | Three different payload shapes reaching the same handler. Normalise to distinct `NormalizedEvent.type`s in M1.4's normalizer, not in the trigger. | **P0** |
| EC-2-03 | Emoji-slider / reaction-only story reply | No text at all. Same class as EC-1.4-04 — the matcher must return nothing rather than throw. | P1 |
| EC-2-04 | Quick-reaction spam (user taps a reaction 20 times) | Per-actor cooldown (M1.8) must cover story events too, or you send 20 DMs. | **P0** |
| EC-2-05 | Mention by an account you do not follow / a private account | Media fetch may be unauthorised. Handle as non-retryable skip. | P1 |
| EC-2-06 | Story reply messaging window | Story replies are user-initiated messages, but confirm which window applies before assuming the standard 24h. **Verify against current Meta docs.** | **P0** |
| EC-2-07 | Your own story reply / your own mention | Self-filter, same as EC-1.4-02. | **P0** |
| EC-2-08 | Existing DM rules unintentionally firing on story replies | In Phase 1 story replies were ignored (EC-1.4-05). Turning them into real events can silently activate every existing DM rule for every customer. **Gate behind an explicit per-rule opt-in and communicate the change.** | **P0** |
| EC-2-09 | New webhook field subscribed at app level but not per account | Same trap as EC-0-14. | P1 |
