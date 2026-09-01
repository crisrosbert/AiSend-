# Edge Cases — Phase 4: Ice Breakers

> `implementationPlan.md` §4, Phase 4 · profile-sync call in the Graph adapter.

| ID | Scenario | Expected behaviour / handling | Pri |
|---|---|---|---|
| EC-4-01 | More than the allowed number of prompts, or over-length titles | Validate at save time against the current documented limits. **Verify against current Meta docs.** | P1 |
| EC-4-02 | User edits Ice Breakers directly in the Instagram app | Your DB and the profile diverge. Treat Instagram as the source of truth on read, warn on overwrite. | P1 |
| EC-4-03 | Sync partially applies | The profile call replaces the whole set; a failed sync must not leave the user believing it saved. Confirm by reading back. | **P0** |
| EC-4-04 | Ice Breaker tap arrives as a **postback** | It routes through the existing postback trigger (EC-1.5-09) — make sure a payload exists and is unique per prompt. | **P0** |
| EC-4-05 | Prompt payload referencing a deleted automation | Tapping it does nothing, silently. Block deletion or repoint the payload. | P1 |
| EC-4-06 | Emoji/RTL text in prompts | Length limits count characters differently than you expect. Test with emoji. | P2 |
| EC-4-07 | Account disconnected then reconnected | Ice Breakers must be re-synced; they live on the IG profile, not in your DB. | P1 |
