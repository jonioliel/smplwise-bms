# FLAKY-FIX-2520 — Flaky fixes: dialog texts never fade below contrast; a refused revoke keeps its reason

> Generated card. Edit management/tasks.json, then run this script with --write.

**Phase:** V1 | **Priority:** P2 | **Status:** IN_PROGRESS

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
- **R-FLAKY-FIX-2520-1 / AT-FLAKY-FIX-2520-1:** Dialog texts never fade below the contrast floor during the enter animation and a refused revoke keeps its reason, so the flaky axe / text checks stop failing.

## Deliverables
- Branch pilot/FLAKY-FIX-2520, change note docs/changes/FLAKY-FIX-2520.md, tests

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
