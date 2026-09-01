# Edge Cases — Phase 6: Visual Flow Builder

> `implementationPlan.md` §4, Phase 6 · rules become graphs; the matcher gains
> a step-tree executor behind the **same** `(event, rules) → actions` contract.

## Graph validity

| ID | Scenario | Expected behaviour / handling | Pri |
|---|---|---|---|
| EC-6-01 | **Cycle in the graph** | Infinite execution and unbounded sends. Detect cycles at save time *and* enforce a hard step budget at runtime. Both — save-time validation alone will be bypassed by data written before the check existed. | **P0** |
| EC-6-02 | Orphan / unreachable nodes | Warn at save; skip at runtime. | P1 |
| EC-6-03 | Node with no outgoing edge on a branch condition | Flow silently ends mid-conversation. Require an explicit end node. | P1 |
| EC-6-04 | Deleted node referenced by a running execution | Executions must pin a **version** of the flow (EC-6-06), not read live. | **P0** |
| EC-6-05 | Condition referencing a variable that does not exist | Evaluate to false with a logged warning; never throw inside the executor. | P1 |

## Execution state

| ID | Scenario | Expected behaviour / handling | Pri |
|---|---|---|---|
| EC-6-06 | Flow edited while executions are mid-flight | Version the flow; running executions finish on their pinned version. Same problem as EC-1.5-11, one order of magnitude worse. | **P0** |
| EC-6-07 | **Wait step** longer than the 24h messaging window | The step after the wait cannot send. Warn at design time, enforce at runtime (EC-1.8-04). This is the single most common flow-builder footgun. | **P0** |
| EC-6-08 | User replies during a wait step | Decide: cancel the flow, branch, or ignore. Undefined behaviour here produces bots that talk past their users. | **P0** |
| EC-6-09 | Two events for the same contact start two parallel executions | Per-contact execution lock, or de-duplicate; otherwise the user receives two interleaved conversations. | **P0** |
| EC-6-10 | Execution abandoned (user never replies) | TTL and cleanup, or the executions table grows forever holding locks. | P1 |
| EC-6-11 | Human takeover mid-flow | Pause the execution, do not cancel it — the agent may hand back. | P1 |
| EC-6-12 | Very deep or wide flow | Step budget per execution and a node-count cap per flow. | P1 |
| EC-6-13 | Migrating existing flat Phase 1 rules into graphs | Must be lossless and reversible, or Phase 1 customers lose working automations on upgrade day. | **P0** |
