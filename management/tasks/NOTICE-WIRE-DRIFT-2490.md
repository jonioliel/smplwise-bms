# NOTICE-WIRE-DRIFT-2490 — Notice board union answers no longer log a false contract drift

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
- **R-NOTICE-WIRE-DRIFT-2490-1 / AT-NOTICE-WIRE-DRIFT-2490-1:** Union answers of the notice board routes are validated against the right member so no false contract-drift error is logged; payload unchanged.

## Deliverables
- Branch pilot/NOTICE-WIRE-DRIFT-2490, change note docs/changes/NOTICE-WIRE-DRIFT-2490.md, tests

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
