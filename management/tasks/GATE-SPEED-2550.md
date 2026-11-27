# GATE-SPEED-2550 — Gate engine speed-ups: measured pixel estimate and chunks, heavy unit split, load-aware limit, fresh seeds

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
- **R-GATE-SPEED-2550-1 / AT-GATE-SPEED-2550-1:** The gate engine copies under scripts/gate plan pixel chunks from measured durations, split the heavy unit files, size the run limit by load and use fresh duration / cost seeds; the self-tests and test_gate_speed pass from the tree; installed on the runner only by the lead before the 2.55 gate.

## Deliverables
- Branch pilot/GATE-SPEED-2550, change note docs/changes/GATE-SPEED-2550.md, tests

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
