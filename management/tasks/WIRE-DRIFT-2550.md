# WIRE-DRIFT-2550 — Wire models of the access-control reads and the WisKey validation match the real answers

> Generated card. Edit management/tasks.json, then run this script with --write.

**Phase:** V1 | **Priority:** P3 | **Status:** REVIEW

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
- **R-WIRE-DRIFT-2550-1 / AT-WIRE-DRIFT-2550-1:** The response models of the access-control reads and the WisKey validation describe what the routes answer; the generated frontend types are regenerated; test_wire_drift_2550 fails when a model and its route drift apart again.

## Deliverables
- Branch pilot/WIRE-DRIFT-2550, change note docs/changes/WIRE-DRIFT-2550.md, tests

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
