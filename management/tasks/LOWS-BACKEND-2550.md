# LOWS-BACKEND-2550 — The open LOW backend findings of the 2.52 deep review: security, video, core, domain modules

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
- **R-LOWS-BACKEND-2550-1 / AT-LOWS-BACKEND-2550-1:** The deep review's low backend findings SEC-6..8, V-06..10, CORE-06..09 and CORE-11, D-06..10 and D-12 are fixed with a test each that fails on the base; CORE-10 and D-11 are deferred to later rows by the owner.

## Deliverables
- Branch pilot/LOWS-BACKEND-2550, change note docs/changes/LOWS-BACKEND-2550.md, tests

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
