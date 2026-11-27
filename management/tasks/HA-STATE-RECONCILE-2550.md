# HA-STATE-RECONCILE-2550 — Periodic full state reconcile of the platform mirror (ha.state_reconcile_min)

> Generated card. Edit management/tasks.json, then run this script with --write.

**Phase:** V1 | **Priority:** P2 | **Status:** REVIEW

**Owner role:** engineering | **Hardware:** False

**Dependencies:** None

**Chapters:** 

**Screens:** N/A

## Model policy — not a live model switch
```json
{
  "implementation": "balanced",
  "review": "balanced",
  "effort": "medium",
  "escalation": "Triage the failure; at most 2 repair attempts, then explicit review. No automatic spending authorization."
}
```

## Acceptance
- **R-HA-STATE-RECONCILE-2550-1 / AT-HA-STATE-RECONCILE-2550-1:** Every ha.state_reconcile_min minutes (default 10, 0 = off) one read-only get_states listing corrects only the states the home system reports as newer than the mirror's; an older listing never overwrites a newer event; skipped while disconnected or while a cycle runs.

## Deliverables
- Branch pilot/HA-STATE-RECONCILE-2550, change note docs/changes/HA-STATE-RECONCILE-2550.md, tests

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
