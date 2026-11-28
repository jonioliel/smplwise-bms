# FIX-CORE2-2570 — Second deep review core / data / release fixes CD2-06, CD2-08, CD2-12..CD2-15, CD2-17, CD2-18, CD2-20, CD2-21: e-mail orphans and limits, multi-arch Dockerfile default, legacy alias writes

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
- **R-FIX-CORE2-2570-1 / AT-FIX-CORE2-2570-1:** Second deep review core / data / release fixes CD2-06, CD2-08, CD2-12..CD2-15, CD2-17, CD2-18, CD2-20, CD2-21: e-mail orphans and limits, multi-arch Dockerfile default, legacy alias writes; merged into the 2.57.0 train, change note docs/changes/FIX-CORE2-2570.md.

## Deliverables
- Branch pilot/FIX-CORE2-2570, change note docs/changes/FIX-CORE2-2570.md, tests

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
