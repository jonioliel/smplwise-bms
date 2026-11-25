# HAND-SWITCH-HOME-EDIT-2500 — The home editor's widget on / off choices are the compact switch

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
- **R-HAND-SWITCH-HOME-EDIT-2500-1 / AT-HAND-SWITCH-HOME-EDIT-2500-1:** The home editor's widget on / off choices use the compact switch of HAND-SWITCH-2480; pixel baselines refreshed on the runner.

## Deliverables
- Branch pilot/HAND-SWITCH-HOME-EDIT-2500, change note docs/changes/HAND-SWITCH-HOME-EDIT-2500.md, tests

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
